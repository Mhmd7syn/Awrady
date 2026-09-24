/**
 * Awrad & Enjaz Dashboard - Cloud Storage & Real-Time Sync Adapter
 * Multi-Device 24/7 Cloud Persistence via Supabase (PostgreSQL JSONB + Realtime WebSockets)
 * Features:
 * - Native Supabase SDK support with REST Fetch Fallback (Zero-build resilient)
 * - Real-time two-way synchronization across multiple devices (Mobile, Tablet, Desktop)
 * - Offline queue & reconnection listener
 * - Safe credential storage in localStorage
 */

class CloudAdapter {
    constructor() {
        this.CONFIG_STORAGE_KEY = "AWRAD_SUPABASE_CONFIG";
        this.TABLE_NAME = "enjaz_sync";
        this.DEFAULT_USER_ID = "primary_user";
        
        this.config = this.loadStoredConfig();
        this.client = null;
        this.realtimeChannel = null;
        this.isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
        this.onSyncStatusCallback = null;
        this.onRemoteUpdateCallback = null;
        
        // Debounce timer for cloud push
        this._pushDebounceTimer = null;
        this._pendingAppData = null;
        this._isPushing = false;

        this.initNetworkListeners();
        if (this.isConfigured()) {
            this.initClient();
        }
    }

    /**
     * Load credentials from local storage
     */
    loadStoredConfig() {
        try {
            const raw = localStorage.getItem(this.CONFIG_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.url && parsed.anonKey) {
                    return {
                        url: parsed.url.trim().replace(/\/+$/, ''),
                        anonKey: parsed.anonKey.trim(),
                        userId: (parsed.userId || this.DEFAULT_USER_ID).trim()
                    };
                }
            }
        } catch (e) {
            console.error("[CloudAdapter] Error loading config from localStorage:", e);
        }
        return { url: "", anonKey: "", userId: this.DEFAULT_USER_ID };
    }

    /**
     * Check if cloud adapter has valid credentials configured
     */
    isConfigured() {
        return Boolean(this.config && this.config.url && this.config.anonKey);
    }

    /**
     * Save/update cloud credentials
     */
    saveCredentials(url, anonKey, userId = this.DEFAULT_USER_ID) {
        this.config = {
            url: (url || "").trim().replace(/\/+$/, ''),
            anonKey: (anonKey || "").trim(),
            userId: (userId || this.DEFAULT_USER_ID).trim()
        };
        try {
            localStorage.setItem(this.CONFIG_STORAGE_KEY, JSON.stringify(this.config));
        } catch (e) {
            console.error("[CloudAdapter] Failed to store config:", e);
        }
        this.disconnectRealtime();
        return this.initClient();
    }

    /**
     * Clear cloud credentials and disconnect
     */
    clearCredentials() {
        this.config = { url: "", anonKey: "", userId: this.DEFAULT_USER_ID };
        try {
            localStorage.removeItem(this.CONFIG_STORAGE_KEY);
        } catch (e) {}
        this.disconnectRealtime();
        this.client = null;
        this.notifyStatus("disconnected", "تخزين محلي فقط (غير مقترن بالسحاب)");
    }

    /**
     * Initialize Supabase Client instance
     */
    initClient() {
        if (!this.isConfigured()) return false;

        try {
            if (typeof window !== "undefined" && window.supabase && typeof window.supabase.createClient === "function") {
                this.client = window.supabase.createClient(this.config.url, this.config.anonKey, {
                    auth: { persistSession: false, autoRefreshToken: false }
                });
                console.log("[CloudAdapter] Supabase SDK client initialized successfully.");
                return true;
            } else {
                console.warn("[CloudAdapter] Supabase SDK not yet loaded globally; using REST fallback mode.");
                return true; // REST fetch will handle it
            }
        } catch (e) {
            console.error("[CloudAdapter] Client initialization error:", e);
            return false;
        }
    }

    /**
     * Monitor online/offline events
     */
    initNetworkListeners() {
        if (typeof window === "undefined") return;

        window.addEventListener("online", () => {
            this.isOnline = true;
            console.log("[CloudAdapter] Network is online. Re-checking sync...");
            this.notifyStatus("online", "تمت استعادة الاتصال بالإنترنت");
            if (this._pendingAppData) {
                this.saveDataImmediate(this._pendingAppData);
            }
        });

        window.addEventListener("offline", () => {
            this.isOnline = false;
            console.warn("[CloudAdapter] Network is offline. Changes will queue locally.");
            this.notifyStatus("offline", "وضع عدم الاتصال (التخزين المحلي مؤمن)");
        });
    }

    /**
     * Test connection to Supabase instance
     */
    async testConnection() {
        if (!this.isConfigured()) {
            return { success: false, message: "لم يتم ضبط إعدادات السحابة بعد." };
        }

        try {
            // First try via SDK if available
            if (this.client) {
                const { data, error } = await this.client
                    .from(this.TABLE_NAME)
                    .select("id, updated_at")
                    .eq("id", this.config.userId)
                    .limit(1);

                if (!error) {
                    return { success: true, message: "الاتصال بالسحابة يعمل بنجاح! ⚡" };
                }
                // If table doesn't exist yet, error code 42P01 in postgres
                if (error.code === "42P01" || error.message?.includes("does not exist")) {
                    return { success: false, needsSchema: true, message: "جدول enjaz_sync غير موجود بقاعدة بياناتك. يرجى تشغيل كود SQL أولاً." };
                }
                return { success: false, message: "فشل الاستعلام: " + error.message };
            }

            // REST Fetch fallback
            const res = await fetch(`${this.config.url}/rest/v1/${this.TABLE_NAME}?id=eq.${encodeURIComponent(this.config.userId)}&select=id`, {
                method: "GET",
                headers: {
                    "apikey": this.config.anonKey,
                    "Authorization": `Bearer ${this.config.anonKey}`
                }
            });

            if (res.ok) {
                return { success: true, message: "الاتصال بالسحابة عبر REST يعمل بنجاح! ⚡" };
            } else {
                const errText = await res.text();
                return { success: false, message: `رمز الخطأ ${res.status}: ${errText}` };
            }
        } catch (e) {
            return { success: false, message: "تعذر الاتصال بالسيرفر: " + e.message };
        }
    }

    /**
     * Load dashboard state from Supabase
     */
    async loadData() {
        if (!this.isConfigured() || !this.isOnline) {
            return null;
        }

        this.notifyStatus("syncing", "جارِ تحميل أحدث البيانات من السحابة...");

        try {
            // 1. Try SDK query
            if (this.client) {
                const { data, error } = await this.client
                    .from(this.TABLE_NAME)
                    .select("data, updated_at, version")
                    .eq("id", this.config.userId)
                    .maybeSingle();

                if (!error && data && data.data) {
                    this.notifyStatus("synced", "متزامن مع السحابة ☁️");
                    return data.data;
                }
                if (error && error.code !== "PGRST116") { // PGRST116 = no rows returned
                    console.warn("[CloudAdapter] SDK load warning:", error.message);
                }
            }

            // 2. Fallback to direct REST fetch
            const endpoint = `${this.config.url}/rest/v1/${this.TABLE_NAME}?id=eq.${encodeURIComponent(this.config.userId)}&select=data`;
            const res = await fetch(endpoint, {
                method: "GET",
                headers: {
                    "apikey": this.config.anonKey,
                    "Authorization": `Bearer ${this.config.anonKey}`,
                    "Accept": "application/json"
                }
            });

            if (res.ok) {
                const rows = await res.json();
                if (Array.isArray(rows) && rows.length > 0 && rows[0].data) {
                    this.notifyStatus("synced", "متزامن مع السحابة ☁️");
                    return rows[0].data;
                }
            }
        } catch (e) {
            console.warn("[CloudAdapter] Cloud load failed, falling back to local cache:", e);
            this.notifyStatus("offline", "تعذر الاتصال بالسحابة (تم استخدام النسخة المحلية)");
        }

        return null;
    }

    /**
     * Debounced save to Supabase
     */
    saveData(appData, debounceMs = 600) {
        this._pendingAppData = appData;
        this.notifyStatus("syncing", "جارِ مزامنة التغييرات مع السحابة... 🔄");

        if (this._pushDebounceTimer) {
            clearTimeout(this._pushDebounceTimer);
        }

        return new Promise((resolve) => {
            this._pushDebounceTimer = setTimeout(async () => {
                const result = await this.saveDataImmediate(this._pendingAppData);
                resolve(result);
            }, debounceMs);
        });
    }

    /**
     * Immediate upsert to Supabase
     */
    async saveDataImmediate(appData) {
        if (!appData || !this.isConfigured()) {
            this.notifyStatus("idle", "تخزين محلي مؤمن");
            return false;
        }

        if (!this.isOnline) {
            this._pendingAppData = appData;
            this.notifyStatus("offline", "بدون إنترنت (التعديلات محفوظة محلياً وقيد الانتظار)");
            return false;
        }

        if (this._isPushing) {
            this._pendingAppData = appData;
            return false;
        }

        this._isPushing = true;
        this.notifyStatus("syncing", "جارِ رفع التحديثات إلى السحابة... ⏳");

        const payload = {
            id: this.config.userId,
            data: appData,
            updated_at: new Date().toISOString()
        };

        try {
            // 1. Try SDK Upsert
            if (this.client) {
                const { error } = await this.client
                    .from(this.TABLE_NAME)
                    .upsert(payload, { onConflict: "id" });

                if (!error) {
                    this._pendingAppData = null;
                    this._isPushing = false;
                    this.notifyStatus("synced", "تمت المزامنة بنجاح ☁️");
                    return true;
                }
                console.warn("[CloudAdapter] SDK Upsert failed, attempting REST fallback:", error.message);
            }

            // 2. Direct REST Upsert Fallback
            const endpoint = `${this.config.url}/rest/v1/${this.TABLE_NAME}`;
            const res = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "apikey": this.config.anonKey,
                    "Authorization": `Bearer ${this.config.anonKey}`,
                    "Content-Type": "application/json",
                    "Prefer": "resolution=merge-duplicates"
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                this._pendingAppData = null;
                this._isPushing = false;
                this.notifyStatus("synced", "تمت المزامنة بنجاح ☁️");
                return true;
            } else {
                const errText = await res.text();
                console.error("[CloudAdapter] REST Upsert failed:", res.status, errText);
            }
        } catch (e) {
            console.error("[CloudAdapter] Cloud push network error:", e);
        }

        this._isPushing = false;
        this.notifyStatus("offline", "فشلت المزامنة السحابية (محفوظ محلياً)");
        return false;
    }

    /**
     * Subscribe to Realtime WebSocket updates from other devices
     */
    subscribeToChanges(onRemoteUpdate) {
        if (onRemoteUpdate) this.onRemoteUpdateCallback = onRemoteUpdate;
        if (!this.isConfigured() || !this.client) return false;

        this.disconnectRealtime();

        try {
            this.realtimeChannel = this.client
                .channel("enjaz-cloud-sync")
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: this.TABLE_NAME,
                        filter: `id=eq.${this.config.userId}`
                    },
                    (payload) => {
                        console.log("[CloudAdapter] Remote update received via WebSocket:", payload);
                        if (payload.new && payload.new.data) {
                            if (typeof this.onRemoteUpdateCallback === "function") {
                                this.onRemoteUpdateCallback(payload.new.data);
                            }
                            this.notifyStatus("synced", "تم استلام تحديث جديد من جهاز آخر 📲");
                        }
                    }
                )
                .subscribe((status) => {
                    console.log(`[CloudAdapter] Realtime subscription status: ${status}`);
                    if (status === "SUBSCRIBED") {
                        this.notifyStatus("synced", "المزامنة اللحظية مفعلة ⚡");
                    }
                });

            return true;
        } catch (e) {
            console.warn("[CloudAdapter] Could not connect realtime channel:", e);
            return false;
        }
    }

    /**
     * Disconnect Realtime Channel
     */
    disconnectRealtime() {
        if (this.realtimeChannel && this.client) {
            try {
                this.client.removeChannel(this.realtimeChannel);
            } catch (e) {}
            this.realtimeChannel = null;
        }
    }

    /**
     * Set listener for sync status changes
     */
    onStatusChange(callback) {
        this.onSyncStatusCallback = callback;
    }

    /**
     * Broadcast status update to UI
     */
    notifyStatus(state, message) {
        if (typeof this.onSyncStatusCallback === "function") {
            this.onSyncStatusCallback({
                state: state, // 'synced', 'syncing', 'offline', 'disconnected', 'idle'
                message: message,
                isConfigured: this.isConfigured(),
                isOnline: this.isOnline
            });
        }
    }
}

// Global Singleton Instance
window.cloudAdapter = new CloudAdapter();
