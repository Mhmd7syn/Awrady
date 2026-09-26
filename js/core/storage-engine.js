/**
 * Awrady Dashboard - Cloud-First Storage Engine (Supabase Only)
 * Exclusively persists application data to the Cloud via Supabase (PostgreSQL JSONB + Realtime WebSockets).
 * All legacy local disk files (File System Access API), Node.js local servers, and IndexedDB have been eliminated.
 * Manual JSON export/import is retained for user-controlled offline backups.
 */

class StorageEngine {
    constructor() {
        this.storageMode = "cloud"; // Exclusive mode: 'cloud'
        this.cloudAdapter = (typeof window !== "undefined" && window.cloudAdapter) ? window.cloudAdapter : null;
        this.onStatusChangeCallback = null;
    }

    /**
     * Initialize Storage Engine & Supabase Realtime Sync
     */
    async init(onStatusChange = null) {
        if (onStatusChange) this.onStatusChangeCallback = onStatusChange;

        if (!this.cloudAdapter && typeof window !== "undefined" && window.cloudAdapter) {
            this.cloudAdapter = window.cloudAdapter;
        }

        if (this.cloudAdapter && this.cloudAdapter.isConfigured()) {
            this.notifyStatus("متصل بالسحابة (24/7 Cloud Sync) ☁️", "success");

            // Setup real-time listener for remote device updates (Mobile <-> Desktop)
            this.cloudAdapter.subscribeToChanges((remoteData) => {
                if (remoteData && window.stateManager) {
                    console.log("[StorageEngine] Remote data received from Supabase Realtime channel.");
                    window.stateManager.data = remoteData;
                    window.appData = remoteData;

                    if (typeof window.renderDailyView === "function") window.renderDailyView();
                    if (typeof window.renderAllTimeStats === "function") window.renderAllTimeStats();
                    if (typeof window.updateHeaderTodayScore === "function") window.updateHeaderTodayScore();
                    if (typeof window.updateChartAndAnalytics === "function") window.updateChartAndAnalytics();
                }
            });
        } else {
            this.notifyStatus("السحابة غير مهيأة بعد - يرجى إدخال بيانات Supabase", "warning");
        }
    }

    /**
     * Load Data from Supabase Cloud
     */
    async loadData(defaultKey = null) {
        if (this.cloudAdapter && this.cloudAdapter.isConfigured()) {
            try {
                const cloudData = await this.cloudAdapter.loadData();
                if (cloudData && (cloudData.tasks || cloudData.logs)) {
                    console.log("[StorageEngine] Data loaded successfully from Supabase Cloud.");
                    return cloudData;
                }
            } catch (e) {
                console.error("[StorageEngine] Supabase cloud load error:", e);
            }
        }
        return null;
    }

    /**
     * Save Data to Supabase Cloud
     */
    async saveData(key, appData) {
        if (!appData) return false;

        if (this.cloudAdapter && this.cloudAdapter.isConfigured()) {
            return await this.cloudAdapter.saveData(appData);
        } else {
            console.warn("[StorageEngine] Cloud adapter not configured. Please enter Supabase credentials.");
            return false;
        }
    }

    /**
     * Immediate save to Supabase Cloud (bypassing debounce)
     */
    async saveDataImmediate(key, appData) {
        if (!appData) return false;

        if (this.cloudAdapter && this.cloudAdapter.isConfigured()) {
            return await this.cloudAdapter.saveDataImmediate(appData);
        }
        return false;
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
