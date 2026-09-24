/**
 * Awrad & Enjaz Dashboard - Persistent Multi-Layer Storage Engine
 * Multi-layer Data Protection & 24/7 Cloud Sync:
 * 1. 24/7 Cloud DB (Supabase / REST Realtime WebSocket Sync)
 * 2. File System Access API (Direct disk file write/read with IndexedDB handle persistence)
 * 3. Local Server API (/api/storage)
 * 4. IndexedDB Fast Key-Value Cache
 * 5. localStorage Baseline Fallback
 */

class StorageEngine {
    constructor() {
        this.fileHandle = null;
        this.dbName = "AwradStorageDB";
        this.storeName = "handles";
        this.db = null;
        this.serverUrl = (typeof window !== "undefined" && window.location && window.location.origin)
            ? `${window.location.origin}/api/storage`
            : "http://localhost:3000/api/storage";
        this.isServerConnected = false;
        this.storageMode = "localStorage"; // 'cloud', 'file', 'server', 'indexedDB', 'localStorage'
        this.onStatusChangeCallback = null;
        this.cloudAdapter = (typeof window !== "undefined" && window.cloudAdapter) ? window.cloudAdapter : null;
    }

    /**
     * Initialize Storage Engine & IndexedDB
     */
    async init(onStatusChange = null) {
        if (onStatusChange) this.onStatusChangeCallback = onStatusChange;
        
        // 1. Request Browser Persistent Storage
        await this.requestPersistentStorage();

        // 2. Open IndexedDB for FileHandle & App Data persistence
        await this.initIndexedDB();

        // 3. Check 24/7 Cloud Storage connection if configured
        if (!this.cloudAdapter && typeof window !== "undefined" && window.cloudAdapter) {
            this.cloudAdapter = window.cloudAdapter;
        }

        if (this.cloudAdapter && this.cloudAdapter.isConfigured()) {
            this.storageMode = "cloud";
            this.notifyStatus("متصل بالسحابة (24/7 Cloud Sync) ☁️", "success");

            // Setup real-time listener for remote device updates (Mobile <-> Desktop)
            this.cloudAdapter.subscribeToChanges((remoteData) => {
                if (remoteData && window.stateManager) {
                    console.log("[StorageEngine] Remote data received from another device.");
                    window.stateManager.data = remoteData;
                    window.appData = remoteData;
                    this.cacheLocally(window.stateManager.STORAGE_KEY, remoteData);
                    
                    if (typeof window.renderDailyView === "function") window.renderDailyView();
                    if (typeof window.renderAllTimeStats === "function") window.renderAllTimeStats();
                    if (typeof window.updateHeaderTodayScore === "function") window.updateHeaderTodayScore();
                    if (typeof window.updateChartAndAnalytics === "function") window.updateChartAndAnalytics();
                }
            });
            return;
        }

        // 4. Try to retrieve saved local file handle
        this.fileHandle = await this.getStoredFileHandle();
        if (this.fileHandle) {
            try {
                const perm = await this.fileHandle.queryPermission({ mode: 'readwrite' });
                if (perm === 'granted') {
                    this.storageMode = "file";
                    this.notifyStatus("مرتبط بملف محلي على الكمبيوتر 💾", "success");
                    return;
                } else {
                    this.storageMode = "file_pending_permission";
                    this.notifyStatus("تأكيد إذن الملف المرتبط 🔑", "warning");
                    return;
                }
            } catch (e) {
                console.warn("[StorageEngine] Permission query error:", e);
            }
        }

        // 5. Check if Local Server is running
        const serverAvailable = await this.checkLocalServer();
        if (serverAvailable) {
            this.isServerConnected = true;
            this.storageMode = "server";
            this.notifyStatus("مرتبط بسيرفر محلي 🖥️", "info");
            return;
        }

        // 6. Fallback to IndexedDB / localStorage
        this.storageMode = "browser";
        this.notifyStatus("تخزين محلي مؤمن في المتصفح 🔒", "warning");
    }

    /**
     * Confirm/request permission for existing file handle
     */
    async confirmFilePermission() {
        if (!this.fileHandle) return false;
        try {
            const status = await this.fileHandle.requestPermission({ mode: 'readwrite' });
            if (status === 'granted') {
                this.storageMode = "file";
                this.notifyStatus("تم تأكيد إذن الملف المحلي بنجاح 💾", "success");
                return true;
            }
        } catch (e) {
            console.error("[StorageEngine] Failed requesting file permission:", e);
        }
        return false;
    }

    /**
     * Request navigator.storage.persist()
     */
    async requestPersistentStorage() {
        if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.persist) {
            try {
                const isPersisted = await navigator.storage.persist();
                console.log(`[StorageEngine] Storage persistence granted: ${isPersisted}`);
            } catch (e) {
                console.warn("[StorageEngine] Failed to request persistent storage:", e);
            }
        }
    }

    /**
     * Initialize IndexedDB to store file handle and cached app data
     */
    initIndexedDB() {
        return new Promise((resolve) => {
            if (typeof window === "undefined" || !window.indexedDB) {
                resolve(false);
                return;
            }
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
                if (!db.objectStoreNames.contains("app_data")) {
                    db.createObjectStore("app_data");
                }
            };
            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(true);
            };
            request.onerror = (err) => {
                console.error("[StorageEngine] IndexedDB open error:", err);
                resolve(false);
            };
        });
    }

    /**
     * Store FileHandle into IndexedDB
     */
    saveFileHandle(handle) {
        return new Promise((resolve) => {
            if (!this.db) return resolve(false);
            const tx = this.db.transaction(this.storeName, "readwrite");
            const store = tx.objectStore(this.storeName);
            store.put(handle, "active_json_handle");
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    }

    /**
     * Retrieve FileHandle from IndexedDB
     */
    getStoredFileHandle() {
        return new Promise((resolve) => {
            if (!this.db) return resolve(null);
            const tx = this.db.transaction(this.storeName, "readonly");
            const store = tx.objectStore(this.storeName);
            const req = store.get("active_json_handle");
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    }

    /**
     * Clear FileHandle from IndexedDB
     */
    clearFileHandle() {
        return new Promise((resolve) => {
            this.fileHandle = null;
            if (!this.db) return resolve(true);
            const tx = this.db.transaction(this.storeName, "readwrite");
            const store = tx.objectStore(this.storeName);
            store.delete("active_json_handle");
            tx.oncomplete = () => {
                this.storageMode = (this.cloudAdapter && this.cloudAdapter.isConfigured()) ? "cloud" : "browser";
                this.notifyStatus("تم فك الارتباط بالملف المحلي", "info");
                resolve(true);
            };
            tx.onerror = () => resolve(false);
        });
    }

    /**
     * Verify or request readwrite permission for FileHandle
     */
    async verifyPermission(fileHandle, readWrite = true) {
        const options = {};
        if (readWrite) {
            options.mode = 'readwrite';
        }
        if ((await fileHandle.queryPermission(options)) === 'granted') {
            return true;
        }
        if ((await fileHandle.requestPermission(options)) === 'granted') {
            return true;
        }
        return false;
    }

    /**
     * Connect/Pick local JSON file on hard disk
     */
    async connectLocalFile(createNew = null) {
        if (!('showSaveFilePicker' in window)) {
            this.notifyStatus("متصفحك لا يدعم خاصية الحفظ المباشر على الملفات", "error");
            return { success: false, reason: "unsupported" };
        }

        try {
            const options = {
                suggestedName: 'awrad_enjaz_backup.json',
                types: [{
                    description: 'ملف بيانات أورادي JSON',
                    accept: { 'application/json': ['.json'] },
                }],
            };

            let isNew = createNew;
            if (isNew === null && typeof window !== "undefined" && typeof window.confirm === "function") {
                isNew = window.confirm("هل تريد إنشاء ملف حفظ جديد على جهازك؟\n\n- انقر 'موافق' (OK) لإنشاء ملف جديد وحفظ البيانات فيه.\n- انقر 'إلغاء' (Cancel) لاختيار ملف قديم موجود حالياً على جهازك.");
            }

            let handle;
            if (isNew) {
                handle = await window.showSaveFilePicker(options);
            } else {
                const pickerOptions = {
                    types: options.types,
                    multiple: false
                };
                const handles = await window.showOpenFilePicker(pickerOptions);
                handle = handles[0];
            }

            if (handle) {
                const hasPerm = await this.verifyPermission(handle, true);
                if (hasPerm) {
                    this.fileHandle = handle;
                    await this.saveFileHandle(handle);
                    this.storageMode = "file";
                    this.notifyStatus("تم الربط بملف محلي بنجاح 💾", "success");
                    return { success: true, isNew: isNew, handle };
                }
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error("[StorageEngine] Error picking file:", err);
                this.notifyStatus("حدث خطأ أثناء اختيار الملف: " + err.message, "error");
            }
        }
        return { success: false, reason: "aborted_or_failed" };
    }

    /**
     * Check if Local Server is active
     */
    async checkLocalServer() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1200);
            const response = await fetch(this.serverUrl, { method: "HEAD", signal: controller.signal });
            clearTimeout(timeoutId);
            return response.ok;
        } catch (e) {
            return false;
        }
    }

    /**
     * Load Data from prioritized source
     * 1. Cloud Database (Primary source of truth for 24/7 multi-device access)
     * 2. Local File Handle (If connected on desktop)
     * 3. Local Server API
     * 4. IndexedDB App Data cache
     * 5. localStorage baseline fallback
     */
    async loadData(defaultKey) {
        // 1. Try 24/7 Cloud Database
        if (this.cloudAdapter && this.cloudAdapter.isConfigured()) {
            try {
                const cloudData = await this.cloudAdapter.loadData();
                if (cloudData && (cloudData.tasks || cloudData.logs)) {
                    console.log("[StorageEngine] Data loaded from 24/7 Cloud DB.");
                    this.cacheLocally(defaultKey, cloudData);
                    return cloudData;
                }
            } catch (e) {
                console.warn("[StorageEngine] Cloud load error, falling back to local cache:", e);
            }
        }

        // 2. Try File System Handle
        if (this.fileHandle) {
            try {
                const hasPerm = await this.verifyPermission(this.fileHandle, false);
                if (hasPerm) {
                    const file = await this.fileHandle.getFile();
                    const text = await file.text();
                    if (text && text.trim().length > 0) {
                        const parsed = JSON.parse(text);
                        console.log("[StorageEngine] Data loaded from local File Handle.");
                        this.cacheLocally(defaultKey, parsed);
                        return parsed;
                    }
                }
            } catch (e) {
                console.warn("[StorageEngine] Failed reading from FileHandle, falling back...", e);
            }
        }

        // 3. Try Local Server
        if (this.isServerConnected) {
            try {
                const res = await fetch(this.serverUrl);
                if (res.ok) {
                    const data = await res.json();
                    if (data && Object.keys(data).length > 0) {
                        console.log("[StorageEngine] Data loaded from Local Server.");
                        this.cacheLocally(defaultKey, data);
                        return data;
                    }
                }
            } catch (e) {
                console.warn("[StorageEngine] Failed reading from Local Server:", e);
            }
        }

        // 4. Try IndexedDB app_data cache
        if (this.db) {
            try {
                const idbData = await new Promise((resolve) => {
                    const tx = this.db.transaction("app_data", "readonly");
                    const req = tx.objectStore("app_data").get(defaultKey);
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

        // 5. Fallback to localStorage (or HTTP sync if local is outdated)
        const localRaw = localStorage.getItem(defaultKey);
        let localData = null;
        if (localRaw) {
            try {
                localData = JSON.parse(localRaw);
            } catch (e) {
                console.error("[StorageEngine] Corrupt localStorage data.");
            }
        }

        // If running over HTTP server and localStorage is missing reorganized tasks, sync from disk file
        if (typeof window !== "undefined" && window.location && window.location.protocol.startsWith("http")) {
            const isOutdated = !localData || !localData.tasks || !localData.tasks.some(t => t.id === "task_dw_videos");
            if (isOutdated) {
                try {
                    const res = await fetch("Data/awrad_enjaz_backup.json?v=" + Date.now());
                    if (res.ok) {
                        const diskData = await res.json();
                        if (diskData && diskData.tasks && diskData.tasks.length > 0) {
                            console.log("[StorageEngine] Loaded newer reorganization from Data/awrad_enjaz_backup.json via HTTP.");
                            this.cacheLocally(defaultKey, diskData);
                            return diskData;
                        }
                    }
                } catch (e) {
                    console.warn("[StorageEngine] HTTP fetch of backup failed:", e);
                }
            }
        }

        if (localData) {
            console.log("[StorageEngine] Data loaded from localStorage baseline.");
            return localData;
        }

        return null;
    }

    /**
     * Save Data to prioritized targets
     * Optimistic UI: Immediately caches in IndexedDB and localStorage (0ms latency),
     * then asynchronously pushes to Cloud DB and active file handles.
     */
    async saveData(key, appData) {
        const jsonStr = JSON.stringify(appData, null, 2);

        // Step 1: Immediate Local Optimistic Cache (0ms latency)
        this.cacheLocally(key, appData);

        // Step 2: Push to 24/7 Cloud DB if configured
        if (this.cloudAdapter && this.cloudAdapter.isConfigured()) {
            this.cloudAdapter.saveData(appData);
        }

        // Step 3: Write to File System Handle if connected on desktop
        if (this.fileHandle) {
            try {
                const hasPerm = await this.verifyPermission(this.fileHandle, true);
                if (hasPerm) {
                    const writable = await this.fileHandle.createWritable();
                    await writable.write(jsonStr);
                    await writable.close();
                    console.log("[StorageEngine] Saved to local File Handle.");
                }
            } catch (e) {
                console.error("[StorageEngine] Error writing to file handle:", e);
            }
        }

        // Step 4: Write to Local Server if connected
        if (this.isServerConnected) {
            try {
                await fetch(this.serverUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: jsonStr
                });
            } catch (e) {
                console.error("[StorageEngine] Error posting to local server:", e);
            }
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
     * Trigger immediate browser download of current state as physical JSON file
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
        a.download = `awrad_enjaz_backup_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Get Current File Name if connected
     */
    getConnectedFileName() {
        return this.fileHandle ? this.fileHandle.name : null;
    }

    /**
     * Notify status updates to UI
     */
    notifyStatus(msg, type = "info") {
        if (typeof this.onStatusChangeCallback === "function") {
            this.onStatusChangeCallback({
                message: msg,
                type: type,
                mode: this.storageMode,
                fileName: this.getConnectedFileName()
            });
        }
    }
}

// Global Singleton Instance
window.storageEngine = new StorageEngine();
