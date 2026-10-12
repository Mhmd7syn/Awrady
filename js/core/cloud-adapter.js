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
        this.sessionId = "client_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
        this.lastSyncedAt = null;

        this.initNetworkListeners();
        if (this.isConfigured()) {
            this.initClient();
        }
    }

    /**
     * Helper to build REST API headers (handles both JWT anon keys and sb_publishable keys)
     */
    getRestHeaders(additional = {}) {
        const headers = {
            "apikey": this.config.anonKey,
            ...additional
        };
        // Legacy anon keys are JWTs (start with ey).
        // New sb_publishable_ keys are not JWTs and should NOT be passed in Authorization: Bearer.
        if (this.config.anonKey && this.config.anonKey.startsWith("ey")) {
            headers["Authorization"] = `Bearer ${this.config.anonKey}`;
        }
        return headers;
    }

    /**
     * Load credentials from local storage or built-in defaults for zero-setup multi-device sync
     */
    loadStoredConfig() {
        const defaults = (typeof APP_CONSTANTS !== "undefined" && APP_CONSTANTS.SUPABASE) ? APP_CONSTANTS.SUPABASE : {
            DEFAULT_URL: "",
            DEFAULT_ANON_KEY: "",
            DEFAULT_USER_ID: "primary_user"
        };

        try {
            const raw = localStorage.getItem(this.CONFIG_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.disabled === true) {
                    return { url: "", anonKey: "", userId: this.DEFAULT_USER_ID };
                }
                if (parsed.url && parsed.anonKey) {
                    return {
                        url: parsed.url.trim().replace(/\/+$/, ''),
                        anonKey: parsed.anonKey.trim(),
                        userId: (parsed.userId || defaults.DEFAULT_USER_ID || this.DEFAULT_USER_ID).trim()
                    };
                }
            }
        } catch (e) {
            console.error("[CloudAdapter] Error loading config from localStorage:", e);
        }

        // Automatic connection on all devices: fall back to built-in project defaults
        return {
            url: (defaults.DEFAULT_URL || "").trim().replace(/\/+$/, ''),
            anonKey: (defaults.DEFAULT_ANON_KEY || "").trim(),
            userId: (defaults.DEFAULT_USER_ID || this.DEFAULT_USER_ID).trim()
        };
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
            localStorage.setItem(this.CONFIG_STORAGE_KEY, JSON.stringify({ disabled: true }));
        } catch (e) {}
        this.disconnectRealtime();
        this.client = null;
        this.notifyStatus("disconnected", "تخزين محلي فقط (تم إيقاف المزامنة السحابية)");
    }

    /**
     * Reset back to default built-in credentials
     */
    resetToDefaultCredentials() {
        try {
            localStorage.removeItem(this.CONFIG_STORAGE_KEY);
        } catch (e) {}
        this.config = this.loadStoredConfig();
        this.disconnectRealtime();
        this.initClient();
        return this.config;
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
                    headers: this.getRestHeaders()
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
                        this.lastSyncedAt = data.updated_at || new Date().toISOString();
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
                const endpoint = `${this.config.url}/rest/v1/${tbl}?id=eq.${encodeURIComponent(this.config.userId)}&select=data,updated_at`;
                const res = await fetch(endpoint, {
                    method: "GET",
                    headers: this.getRestHeaders({
                        "Accept": "application/json"
                    })
                });

                if (res.ok) {
                    const rows = await res.json();
                    if (Array.isArray(rows) && rows.length > 0 && rows[0].data) {
                        this.TABLE_NAME = tbl;
                        this.lastSyncedAt = rows[0].updated_at || new Date().toISOString();
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

        const syncTimestamp = new Date().toISOString();
        const dataToSave = {
            ...appData,
            _lastClientId: this.sessionId,
            _lastUpdatedAt: syncTimestamp
        };

        const payload = {
            id: this.config.userId,
            data: dataToSave,
            updated_at: syncTimestamp
        };

        const tablesToTry = [this.TABLE_NAME, ...this.FALLBACK_TABLES.filter(t => t !== this.TABLE_NAME)];
        let saveSuccess = false;

        for (const tbl of tablesToTry) {
            try {
                // 1. Try SDK Upsert
                if (this.client) {
                    const { error } = await this.client
                        .from(tbl)
                        .upsert(payload, { onConflict: "id" });

                    if (!error) {
                        this.TABLE_NAME = tbl;
                        saveSuccess = true;
                        break;
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
                    headers: this.getRestHeaders({
                        "Content-Type": "application/json",
                        "Prefer": "resolution=merge-duplicates"
                    }),
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    this.TABLE_NAME = tbl;
                    saveSuccess = true;
                    break;
                }
            } catch (e) {
                console.error(`[CloudAdapter] Error saving to ${tbl}:`, e);
            }
        }

        this._isPushing = false;

        if (saveSuccess) {
            this.lastSyncedAt = syncTimestamp;
            this.notifyStatus("synced", "تمت المزامنة بنجاح ☁️");
            // If another change occurred while pushing, push it immediately without dropping
            if (this._pendingAppData) {
                const nextData = this._pendingAppData;
                this._pendingAppData = null;
                return this.saveDataImmediate(nextData);
            }
            return true;
        } else {
            this.notifyStatus("offline", "فشلت المزامنة السحابية (محفوظ محلياً)");
            return false;
        }
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
                            const incomingData = payload.new.data;
                            // Ignore self-echo from this exact browser session/tab
                            if (incomingData._lastClientId && incomingData._lastClientId === this.sessionId) {
                                console.log("[CloudAdapter] Discarding self-echo from this session.");
                                return;
                            }
                            this.lastSyncedAt = payload.new.updated_at || new Date().toISOString();
                            if (typeof this.onRemoteUpdateCallback === "function") {
                                this.onRemoteUpdateCallback(incomingData);
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
     * Lightweight check to see if remote cloud data changed (used on tab focus and periodic background sync)
     */
    async checkForRemoteUpdates() {
        if (!this.isConfigured() || !this.isOnline || this._isPushing) {
            return null;
        }

        try {
            if (this.client) {
                const { data, error } = await this.client
                    .from(this.TABLE_NAME)
                    .select("data, updated_at")
                    .eq("id", this.config.userId)
                    .maybeSingle();

                if (!error && data && data.data) {
                    if (data.data._lastClientId === this.sessionId) {
                        return null; // Our own write
                    }
                    if (this.lastSyncedAt && data.updated_at && data.updated_at <= this.lastSyncedAt) {
                        return null; // Already up to date
                    }
                    this.lastSyncedAt = data.updated_at;
                    return data.data;
                }
            } else {
                const res = await fetch(`${this.config.url}/rest/v1/${this.TABLE_NAME}?id=eq.${encodeURIComponent(this.config.userId)}&select=data,updated_at`, {
                    method: "GET",
                    headers: this.getRestHeaders({ "Accept": "application/json" })
                });
                if (res.ok) {
                    const rows = await res.json();
                    if (Array.isArray(rows) && rows.length > 0 && rows[0].data) {
                        const row = rows[0];
                        if (row.data._lastClientId === this.sessionId) {
                            return null;
                        }
                        if (this.lastSyncedAt && row.updated_at && row.updated_at <= this.lastSyncedAt) {
                            return null;
                        }
                        this.lastSyncedAt = row.updated_at;
                        return row.data;
                    }
                }
            }
        } catch (e) {
            console.warn("[CloudAdapter] Check for remote updates warning:", e);
        }
        return null;
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
