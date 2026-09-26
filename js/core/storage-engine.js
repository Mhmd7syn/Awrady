/**
 * Awrady Dashboard - Resilient Hybrid Storage Engine
 * Multi-layer Data Protection & 24/7 Cloud Sync:
 * 1. 24/7 Cloud DB (Supabase / REST Realtime WebSocket Sync)
 * 2. IndexedDB Fast Key-Value Cache
 * 3. localStorage Baseline Fallback (0ms latency, always works offline)
 * 4. User-controlled manual JSON export/import backups
 */

class StorageEngine {
    constructor() {
        this.dbName = "AwradStorageDB";
        this.db = null;
        this.storageMode = "localStorage"; // 'cloud', 'indexedDB', 'localStorage'
        this.cloudAdapter = (typeof window !== "undefined" && window.cloudAdapter) ? window.cloudAdapter : null;
        this.onStatusChangeCallback = null;
    }

    /**
     * Initialize Storage Engine, IndexedDB & Cloud Sync listener
     */
    async init(onStatusChange = null) {
        if (onStatusChange) this.onStatusChangeCallback = onStatusChange;

        // 1. Open IndexedDB for offline resilience
        await this.initIndexedDB();

        // 2. Connect to Cloud Adapter if configured
        if (!this.cloudAdapter && typeof window !== "undefined" && window.cloudAdapter) {
            this.cloudAdapter = window.cloudAdapter;
        }

        if (this.cloudAdapter && this.cloudAdapter.isConfigured()) {
            this.storageMode = "cloud";
            this.notifyStatus("متصل بالسحابة (24/7 Cloud Sync) ☁️", "success");

            // Setup real-time listener for remote device updates (Mobile <-> Desktop)
            this.cloudAdapter.subscribeToChanges((remoteData) => {
                if (remoteData && window.stateManager) {
                    console.log("[StorageEngine] Remote data received from Supabase Realtime channel.");
                    window.stateManager.data = remoteData;
                    window.appData = remoteData;
                    const key = window.stateManager.STORAGE_KEY || "AWRAD_APP_DATA_V1";
                    this.cacheLocally(key, remoteData);

                    if (typeof window.renderDailyView === "function") window.renderDailyView();
                    if (typeof window.renderAllTimeStats === "function") window.renderAllTimeStats();
                    if (typeof window.updateHeaderTodayScore === "function") window.updateHeaderTodayScore();
                    if (typeof window.updateChartAndAnalytics === "function") window.updateChartAndAnalytics();
                }
            });
        } else {
            this.storageMode = "localStorage";
            this.notifyStatus("تخزين محلي (المتصفح) — السحابة اختيارية", "info");
        }
    }

    /**
     * Initialize IndexedDB database for offline storage
     */
    async initIndexedDB() {
        return new Promise((resolve) => {
            if (typeof indexedDB === "undefined") return resolve(false);
            try {
                const req = indexedDB.open(this.dbName, 2);
                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains("app_data")) {
                        db.createObjectStore("app_data");
                    }
                };
                req.onsuccess = (e) => {
                    this.db = e.target.result;
                    resolve(true);
                };
                req.onerror = () => resolve(false);
            } catch (err) {
                console.warn("[StorageEngine] IndexedDB init error:", err);
                resolve(false);
            }
        });
    }

    /**
     * Load Data with fallback: Cloud -> IndexedDB -> localStorage
     */
    async loadData(defaultKey = null) {
        const key = defaultKey || (window.APP_CONSTANTS ? window.APP_CONSTANTS.STORAGE_KEY : "AWRAD_APP_DATA_V1");

        // 1. Try Cloud DB if configured
        if (this.cloudAdapter && this.cloudAdapter.isConfigured()) {
            try {
                const cloudData = await this.cloudAdapter.loadData();
                if (cloudData && (cloudData.tasks || cloudData.logs)) {
                    console.log("[StorageEngine] Data loaded successfully from Supabase Cloud.");
                    this.cacheLocally(key, cloudData);
                    return cloudData;
                }
            } catch (e) {
                console.warn("[StorageEngine] Supabase cloud load error, falling back to local cache:", e);
            }
        }

        // 2. Try IndexedDB cache
        if (this.db) {
            try {
                const idbData = await new Promise((resolve) => {
                    const tx = this.db.transaction("app_data", "readonly");
                    const req = tx.objectStore("app_data").get(key);
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => resolve(null);
                });
                if (idbData && (idbData.tasks || idbData.logs)) {
                    console.log("[StorageEngine] Data loaded from IndexedDB cache.");
                    return idbData;
                }
            } catch (e) {
                console.warn("[StorageEngine] IndexedDB load failed:", e);
            }
        }

        // 3. Fallback to localStorage baseline
        try {
            const localRaw = localStorage.getItem(key);
            if (localRaw) {
                const localData = JSON.parse(localRaw);
                if (localData && (localData.tasks || localData.logs)) {
                    console.log("[StorageEngine] Data loaded from localStorage baseline.");
                    return localData;
                }
            }
        } catch (e) {
            console.error("[StorageEngine] Error parsing localStorage data:", e);
        }

        return null;
    }

    /**
     * Save Data: Immediately saves locally (0ms latency), then syncs to Cloud if configured
     */
    async saveData(key, appData) {
        if (!appData) return false;
        const storageKey = key || (window.APP_CONSTANTS ? window.APP_CONSTANTS.STORAGE_KEY : "AWRAD_APP_DATA_V1");

        // 1. Immediate local cache (0ms latency, offline safety)
        this.cacheLocally(storageKey, appData);

        // 2. Asynchronously sync to Cloud if configured
        if (this.cloudAdapter && this.cloudAdapter.isConfigured()) {
            this.cloudAdapter.saveData(appData);
        }

        return true;
    }

    /**
     * Immediate save to local cache & Cloud
     */
    async saveDataImmediate(key, appData) {
        if (!appData) return false;
        const storageKey = key || (window.APP_CONSTANTS ? window.APP_CONSTANTS.STORAGE_KEY : "AWRAD_APP_DATA_V1");

        // 1. Immediate local cache
        this.cacheLocally(storageKey, appData);

        // 2. Immediate cloud save
        if (this.cloudAdapter && this.cloudAdapter.isConfigured()) {
            return await this.cloudAdapter.saveDataImmediate(appData);
        }
        return true;
    }

    /**
     * Cache state locally in localStorage and IndexedDB
     */
    cacheLocally(key, appData) {
        try {
            localStorage.setItem(key, JSON.stringify(appData));
        } catch (e) {
            console.error("[StorageEngine] localStorage cache error:", e);
        }

        if (this.db) {
            try {
                const tx = this.db.transaction("app_data", "readwrite");
                tx.objectStore("app_data").put(appData, key);
            } catch (e) {
                console.warn("[StorageEngine] IndexedDB cache error:", e);
            }
        }
    }

    /**
     * Download manual JSON backup file
     */
    downloadBackupFile(appData) {
        const dataToSave = appData || (window.stateManager ? window.stateManager.data : window.appData);
        if (!dataToSave) return;
        const jsonStr = JSON.stringify(dataToSave, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const dateStr = new Date().toISOString().split("T")[0];
        a.href = url;
        a.download = `awrady_backup_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Notify status updates to UI
     */
    notifyStatus(msg, type = "info") {
        if (typeof this.onStatusChangeCallback === "function") {
            this.onStatusChangeCallback({
                message: msg,
                type: type,
                mode: this.storageMode
            });
        }
    }
}

// Global Singleton Instance
window.storageEngine = new StorageEngine();
