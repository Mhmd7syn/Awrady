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
                    const currentLocal = window.appData || window.stateManager.data;
                    const mergedData = this.mergeAppData(currentLocal, remoteData);

                    window.stateManager.data = mergedData;
                    window.appData = mergedData;
                    const key = window.stateManager.STORAGE_KEY || "AWRAD_APP_DATA_V1";
                    this.cacheLocally(key, mergedData);

                    if (typeof window.renderDailyView === "function") window.renderDailyView();
                    if (typeof window.renderTaskManager === "function") window.renderTaskManager();
                    if (typeof window.renderAllTimeStats === "function") window.renderAllTimeStats();
                    if (typeof window.updateHeaderTodayScore === "function") window.updateHeaderTodayScore();
                    if (typeof window.updateChartAndAnalytics === "function") window.updateChartAndAnalytics();
                }
            });

            // Initialize regular session synchronization (tab focus, visibility change & 60s background heartbeat)
            this.initSessionSync();
        } else {
            this.storageMode = "localStorage";
            this.notifyStatus("تخزين محلي (المتصفح) — السحابة اختيارية", "info");
        }
    }

    /**
     * Initialize regular session synchronization (on tab focus, visibility change, and 60s heartbeat)
     */
    initSessionSync() {
        if (typeof window === "undefined" || !this.cloudAdapter) return;

        const checkAndApplyRemoteUpdates = async () => {
            if (!this.cloudAdapter.isConfigured() || !this.cloudAdapter.isOnline) return;
            const remoteData = await this.cloudAdapter.checkForRemoteUpdates();
            if (remoteData && window.stateManager) {
                console.log("[StorageEngine] Periodic/focus sync applied remote updates from Cloud.");
                const currentLocal = window.appData || window.stateManager.data;
                const mergedData = this.mergeAppData(currentLocal, remoteData);

                window.stateManager.data = mergedData;
                window.appData = mergedData;
                const key = window.stateManager.STORAGE_KEY || "AWRAD_APP_DATA_V1";
                this.cacheLocally(key, mergedData);

                if (typeof window.renderDailyView === "function") window.renderDailyView();
                if (typeof window.renderTaskManager === "function") window.renderTaskManager();
                if (typeof window.renderAllTimeStats === "function") window.renderAllTimeStats();
                if (typeof window.updateHeaderTodayScore === "function") window.updateHeaderTodayScore();
                if (typeof window.updateChartAndAnalytics === "function") window.updateChartAndAnalytics();
            }
        };

        // Re-check when user returns to the tab or browser wakes up
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
                checkAndApplyRemoteUpdates();
            }
        });
        window.addEventListener("focus", () => {
            checkAndApplyRemoteUpdates();
        });

        // Periodic heartbeat sync every 60 seconds
        setInterval(() => {
            checkAndApplyRemoteUpdates();
        }, 60000);
    }

    /**
     * Smart merge of two application states (Local & Remote)
     * Preserves task entries, higher progress, new tasks, and new categories
     */
    mergeAppData(local, remote) {
        if (!local || typeof local !== "object") return remote;
        if (!remote || typeof remote !== "object") return local;

        const merged = { ...local };

        // 1. Merge logs (date by date and task by task)
        merged.logs = { ...(local.logs || {}) };
        const remoteLogs = remote.logs || {};

        for (const dateStr of Object.keys(remoteLogs)) {
            if (!merged.logs[dateStr]) {
                merged.logs[dateStr] = JSON.parse(JSON.stringify(remoteLogs[dateStr]));
            } else {
                const localDateLog = merged.logs[dateStr] || { entries: {} };
                const remoteDateLog = remoteLogs[dateStr] || { entries: {} };

                const mergedEntries = { ...(localDateLog.entries || {}) };
                const remoteEntries = remoteDateLog.entries || {};

                for (const taskId of Object.keys(remoteEntries)) {
                    if (mergedEntries[taskId] === undefined) {
                        mergedEntries[taskId] = remoteEntries[taskId];
                    } else {
                        const localVal = mergedEntries[taskId];
                        const remoteVal = remoteEntries[taskId];
                        if (typeof localVal === "number" && typeof remoteVal === "number") {
                            // Retain the higher progress/count recorded
                            mergedEntries[taskId] = Math.max(localVal, remoteVal);
                        } else {
                            mergedEntries[taskId] = (remoteVal !== undefined && remoteVal !== "" && remoteVal !== 0) ? remoteVal : localVal;
                        }
                    }
                }

                // Merge disabledTaskIds (union)
                const localDisabled = Array.isArray(localDateLog.disabledTaskIds) ? localDateLog.disabledTaskIds : [];
                const remoteDisabled = Array.isArray(remoteDateLog.disabledTaskIds) ? remoteDateLog.disabledTaskIds : [];
                const mergedDisabled = Array.from(new Set([...localDisabled, ...remoteDisabled]));

                // Merge bonusTaskIds (union)
                const localBonus = Array.isArray(localDateLog.bonusTaskIds) ? localDateLog.bonusTaskIds : [];
                const remoteBonus = Array.isArray(remoteDateLog.bonusTaskIds) ? remoteDateLog.bonusTaskIds : [];
                const mergedBonus = Array.from(new Set([...localBonus, ...remoteBonus]));

                // Merge prayerExtras
                const mergedPrayerExtras = {
                    ...(localDateLog.prayerExtras || {}),
                    ...(remoteDateLog.prayerExtras || {})
                };

                merged.logs[dateStr] = {
                    ...localDateLog,
                    ...remoteDateLog,
                    entries: mergedEntries,
                    disabledTaskIds: mergedDisabled,
                    bonusTaskIds: mergedBonus,
                    prayerExtras: mergedPrayerExtras
                };
            }
        }

        // 2. Merge Tasks: Union by task.id
        const localTasks = Array.isArray(local.tasks) ? local.tasks : [];
        const remoteTasks = Array.isArray(remote.tasks) ? remote.tasks : [];
        const taskMap = new Map();
        for (const t of remoteTasks) {
            if (t && t.id) taskMap.set(t.id, { ...t });
        }
        for (const t of localTasks) {
            if (t && t.id) {
                if (taskMap.has(t.id)) {
                    taskMap.set(t.id, { ...taskMap.get(t.id), ...t });
                } else {
                    taskMap.set(t.id, { ...t });
                }
            }
        }
        merged.tasks = Array.from(taskMap.values());

        // 3. Merge Categories: Union by category name
        const localCats = Array.isArray(local.categories) ? local.categories : [];
        const remoteCats = Array.isArray(remote.categories) ? remote.categories : [];
        const catMap = new Map();
        for (const c of remoteCats) {
            if (c && c.name) catMap.set(c.name, { ...c });
        }
        for (const c of localCats) {
            if (c && c.name) {
                catMap.set(c.name, { ...(catMap.get(c.name) || {}), ...c });
            }
        }
        merged.categories = Array.from(catMap.values());

        return merged;
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

        // First read local offline cache
        let localData = null;
        if (this.db) {
            try {
                localData = await new Promise((resolve) => {
                    const tx = this.db.transaction("app_data", "readonly");
                    const req = tx.objectStore("app_data").get(key);
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => resolve(null);
                });
            } catch (e) {
                console.warn("[StorageEngine] IndexedDB read error:", e);
            }
        }
        if (!localData) {
            try {
                const localRaw = localStorage.getItem(key);
                if (localRaw) localData = JSON.parse(localRaw);
            } catch (e) {}
        }

        // Try Cloud DB if configured
        if (this.cloudAdapter && this.cloudAdapter.isConfigured()) {
            try {
                const cloudData = await this.cloudAdapter.loadData();
                if (cloudData && (cloudData.tasks || cloudData.logs)) {
                    console.log("[StorageEngine] Data loaded successfully from Supabase Cloud.");
                    // Smart merge with local cache so unsaved offline work isn't lost
                    const resolvedData = localData ? this.mergeAppData(localData, cloudData) : cloudData;
                    this.cacheLocally(key, resolvedData);
                    return resolvedData;
                }
            } catch (e) {
                console.warn("[StorageEngine] Supabase cloud load error, falling back to local cache:", e);
            }
        }

        // If Cloud was unavailable, use local cache
        if (localData && (localData.tasks || localData.logs)) {
            console.log("[StorageEngine] Using local cache (IndexedDB/localStorage).");
            return localData;
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
