/**
 * Awrady Dashboard - Cloud Storage & Real-Time Sync Adapter
 * Multi-Device 24/7 Cloud Persistence via Supabase (PostgreSQL JSONB + Realtime WebSockets)
 * Features:
 * - Native Supabase SDK support with REST Fetch Fallback (Zero-build resilient)
 * - Auto-detection and dual-compatibility with both awrady_sync and legacy enjaz_sync tables
 * - Real-time two-way synchronization across multiple devices (Mobile, Tablet, Desktop)
 * - Offline queue & reconnection listener
 * - Safe credential storage in localStorage
 */

class CloudAdapter {
    constructor() {
        this.CONFIG_STORAGE_KEY = "AWRAD_SUPABASE_CONFIG";
        this.FALLBACK_TABLES = ["awrady_sync", "enjaz_sync"];
        this.TABLE_NAME = "awrady_sync";
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
                return true;
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
     * Test connection to Supabase instance (auto-probes awrady_sync and enjaz_sync)
     */
    async testConnection() {
        if (!this.isConfigured()) {
            return { success: false, message: "لم يتم ضبط إعدادات السحابة بعد." };
        }

        const candidateTables = [this.TABLE_NAME, ...this.FALLBACK_TABLES.filter(t => t !== this.TABLE_NAME)];

        for (const tbl of candidateTables) {
            try {
                if (this.client) {
                    const { data, error } = await this.client
                        .from(tbl)
                        .select("id, updated_at")
                        .eq("id", this.config.userId)
                        .limit(1);

                    if (!error) {
                        this.TABLE_NAME = tbl;
                        return { success: true, message: `الاتصال بالسحابة يعمل بنجاح! ⚡ (الجدول: ${tbl})` };
                    }
                    if (error.code === "42P01" || error.message?.includes("does not exist")) {
                        continue;
                    }
                    return { success: false, message: "فشل الاستعلام: " + error.message };
                }

                // REST Fetch fallback test
                const res = await fetch(`${this.config.url}/rest/v1/${tbl}?id=eq.${encodeURIComponent(this.config.userId)}&select=id`, {
                    method: "GET",
                    headers: {
                        "apikey": this.config.anonKey,
                        "Authorization": `Bearer ${this.config.anonKey}`
                    }
                });

                if (res.ok) {
                    this.TABLE_NAME = tbl;
                    return { success: true, message: `الاتصال بالسحابة عبر REST يعمل بنجاح! ⚡ (الجدول: ${tbl})` };
                }
            } catch (e) {
                console.warn(`[CloudAdapter] Error probing ${tbl}:`, e);
            }
        }

        return { 
            success: false, 
            needsSchema: true, 
            message: "لم يتم العثور على جدول awrady_sync أو enjaz_sync في قاعدة بياناتك. يرجى تشغيل كود SQL أولاً." 
        };
    }

    /**
     * Load dashboard state from Supabase with auto-table fallback
     */
    async loadData() {
        if (!this.isConfigured() || !this.isOnline) {
            return null;
        }

        this.notifyStatus("syncing", "جارِ تحميل أحدث البيانات من السحابة...");

        const tablesToTry = [this.TABLE_NAME, ...this.FALLBACK_TABLES.filter(t => t !== this.TABLE_NAME)];

        for (const tbl of tablesToTry) {
            try {
                // 1. Try SDK query
                if (this.client) {
                    const { data, error } = await this.client
                        .from(tbl)
                        .select("data, updated_at, version")
                        .eq("id", this.config.userId)
                        .maybeSingle();

                    if (!error && data && data.data) {
                        this.TABLE_NAME = tbl;
                        this.notifyStatus("synced", `متزامن مع السحابة ☁️`);
                        return data.data;
                    }
                    if (error && (error.code === "42P01" || error.message?.includes("does not exist"))) {
                        continue; // try next candidate table
                    }
                    if (error && error.code !== "PGRST116") {
                        console.warn(`[CloudAdapter] SDK load warning on ${tbl}:`, error.message);
                    }
                }

                // 2. Direct REST fetch
                const endpoint = `${this.config.url}/rest/v1/${tbl}?id=eq.${encodeURIComponent(this.config.userId)}&select=data`;
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
                        this.TABLE_NAME = tbl;
                        this.notifyStatus("synced", `متزامن مع السحابة ☁️`);
                        return rows[0].data;
                    }
                }
            } catch (e) {
                console.warn(`[CloudAdapter] Error querying table ${tbl}:`, e);
            }
        }

        this.notifyStatus("offline", "تعذر الاتصال بالسحابة (تم استخدام النسخة المحلية)");
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

        this._pushDebounceTimer = setTimeout(() => {
            this.saveDataImmediate(this._pendingAppData);
        }, debounceMs);

        return true;
    }

    /**
     * Immediate upsert to Supabase with auto-table fallback
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

        const tablesToTry = [this.TABLE_NAME, ...this.FALLBACK_TABLES.filter(t => t !== this.TABLE_NAME)];

        for (const tbl of tablesToTry) {
            try {
                // 1. Try SDK Upsert
                if (this.client) {
                    const { error } = await this.client
                        .from(tbl)
                        .upsert(payload, { onConflict: "id" });

                    if (!error) {
                        this.TABLE_NAME = tbl;
                        this._pendingAppData = null;
                        this._isPushing = false;
                        this.notifyStatus("synced", "تمت المزامنة بنجاح ☁️");
                        return true;
                    }
                    if (error.code === "42P01" || error.message?.includes("does not exist")) {
                        continue;
                    }
                    console.warn(`[CloudAdapter] SDK Upsert error on ${tbl}:`, error.message);
                }

                // 2. Direct REST Upsert Fallback
                const endpoint = `${this.config.url}/rest/v1/${tbl}`;
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
                    this.TABLE_NAME = tbl;
                    this._pendingAppData = null;
                    this._isPushing = false;
                    this.notifyStatus("synced", "تمت المزامنة بنجاح ☁️");
                    return true;
                }
            } catch (e) {
                console.error(`[CloudAdapter] Error saving to ${tbl}:`, e);
            }
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
            const channelName = `${this.TABLE_NAME}-cloud-sync`;
            this.realtimeChannel = this.client
                .channel(channelName)
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
                    console.log(`[CloudAdapter] Realtime WebSocket subscription status for ${this.TABLE_NAME}:`, status);
                });

            return true;
        } catch (e) {
            console.error("[CloudAdapter] Realtime subscription error:", e);
            return false;
        }
    }

    /**
     * Disconnect and clean up Realtime WebSocket
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
     * Status notification dispatcher
     */
    notifyStatus(state, message) {
        if (typeof this.onSyncStatusCallback === "function") {
            this.onSyncStatusCallback({ state, message });
        }
    }

    /**
     * Register sync status listener
     */
    onStatusChange(callback) {
        this.onSyncStatusCallback = callback;
    }
}

// Global Singleton Instance
window.cloudAdapter = new CloudAdapter();
