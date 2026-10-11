/**
 * Awrady Dashboard - State Manager & Reactive Store
 * Manages global application state, data migration, state subscription, and debounced persistence.
 */

class StateManager {
    constructor() {
        this.STORAGE_KEY = (typeof window !== "undefined" && window.APP_CONSTANTS && window.APP_CONSTANTS.STORAGE_KEY) 
            ? window.APP_CONSTANTS.STORAGE_KEY 
            : "AWRAD_APP_DATA_V1";
            
        this.data = {
            categories: [],
            tasks: [],
            logs: {}
        };

        this.listeners = [];
        this.saveDebounced = null;
        this.initDebouncedSave();
    }

    /**
     * Initialize the debounced save helper (300ms)
     */
    initDebouncedSave() {
        if (typeof window !== "undefined" && typeof window.debounce === "function") {
            this.saveDebounced = window.debounce(() => {
                this.persistImmediate();
            }, 300);
        } else {
            this.saveDebounced = () => this.persistImmediate();
        }

        if (typeof window !== "undefined") {
            window.addEventListener("beforeunload", () => {
                this.persistImmediate();
            });
            document.addEventListener("visibilitychange", () => {
                if (document.visibilityState === "hidden") {
                    this.persistImmediate();
                }
            });
        }
    }

    /**
     * Initialize state from storage engine or local fallbacks
     */
    async init() {
        let savedData = null;

        if (window.storageEngine) {
            savedData = await window.storageEngine.loadData(this.STORAGE_KEY);
        }

        if (savedData) {
            this.data = savedData;
        } else {
            this.loadDefaultData();
        }

        this.ensureDataIntegrity();
        return this.data;
    }

    /**
     * Load default category & task dataset
     */
    loadDefaultData() {
        if (window.DEFAULT_AWRAD_DATA) {
            this.data = JSON.parse(JSON.stringify(window.DEFAULT_AWRAD_DATA));
        } else {
            this.data = {
                categories: window.DEFAULT_CATEGORIES ? JSON.parse(JSON.stringify(window.DEFAULT_CATEGORIES)) : [],
                tasks: window.DEFAULT_TASKS ? JSON.parse(JSON.stringify(window.DEFAULT_TASKS)) : [],
                logs: {}
            };
        }
    }

    /**
     * Enforce structural integrity and run migration logic
     */
    ensureDataIntegrity() {
        const defaultCats = window.DEFAULT_CATEGORIES || [];
        
        if (!this.data.categories || this.data.categories.length === 0) {
            this.data.categories = JSON.parse(JSON.stringify(defaultCats));
        }

        if (!this.data.tasks || this.data.tasks.length === 0) {
            if (window.DEFAULT_TASKS) {
                this.data.tasks = JSON.parse(JSON.stringify(window.DEFAULT_TASKS));
            } else if (window.DEFAULT_AWRAD_DATA && window.DEFAULT_AWRAD_DATA.tasks) {
                this.data.tasks = JSON.parse(JSON.stringify(window.DEFAULT_AWRAD_DATA.tasks));
            } else {
                this.data.tasks = [];
            }
        }

        if (!this.data.logs) this.data.logs = {};

        // Ensure each date log has an entries object
        Object.keys(this.data.logs).forEach(dateStr => {
            if (!this.data.logs[dateStr] || typeof this.data.logs[dateStr] !== "object") {
                this.data.logs[dateStr] = { entries: {} };
            } else if (!this.data.logs[dateStr].entries) {
                this.data.logs[dateStr].entries = {};
            }
        });

        // Category & subcategory migrations
        this.data.categories.forEach(c => {
            const defCat = defaultCats.find(dc => dc.name === c.name);
            if (!c.subcategories) {
                c.subcategories = defCat ? JSON.parse(JSON.stringify(defCat.subcategories)) : [];
            }
            if (c.defaultUnit === "وقت" || c.defaultUnit === "ساعات") {
                c.defaultUnit = "ساعة";
            }
            if (c.defaultUnit === "ساعة" && (!c.defaultEstimatedMinutes || c.defaultEstimatedMinutes === 15 || c.defaultEstimatedMinutes === 30)) {
                c.defaultEstimatedMinutes = 60;
            }
            if (c.subcategories) {
                c.subcategories.forEach(sub => {
                    const defSub = defCat && defCat.subcategories ? defCat.subcategories.find(ds => ds.name === sub.name) : null;
                    if (sub.defaultUnit === "وقت" || sub.defaultUnit === "ساعات") {
                        sub.defaultUnit = "ساعة";
                    }
                    if (!sub.defaultUnit && defSub && defSub.defaultUnit) {
                        sub.defaultUnit = defSub.defaultUnit;
                    }
                    if (sub.defaultUnit === "ساعة" && (!sub.defaultEstimatedMinutes || sub.defaultEstimatedMinutes === 15 || sub.defaultEstimatedMinutes === 30 || sub.defaultEstimatedMinutes === 45)) {
                        sub.defaultEstimatedMinutes = 60;
                    } else if (sub.defaultEstimatedMinutes === undefined || sub.defaultEstimatedMinutes === null) {
                        if (defSub && defSub.defaultEstimatedMinutes) {
                            sub.defaultEstimatedMinutes = defSub.defaultEstimatedMinutes;
                        }
                    }
                });
            }
        });

        // Normalize legacy category name "صيام" to "صوم"
        this.data.categories.forEach(c => {
            if (c.name === "صيام") {
                c.name = "صوم";
                c.label = "☀️ صوم";
                c.icon = "fa-sun";
            }
        });

        // Task normalization
        this.data.tasks.forEach(t => {
            if (t.type === "صلاة - ركعة" || t.type === "ركعات") t.type = "ركعة";
            if (t.type === "قرآن - صفحة" || t.type === "صفحات") t.type = "صفحة";
            if (t.type === "صوم") t.type = "يوم";
            if (t.type === "وقت" || t.type === "ساعات" || t.type === "ساعات ودقايق") t.type = "ساعة";
            if (t.type === "مهمة" || t.type === "مرة") t.type = "تكرار";

            if (t.category === "قرآن" || t.category === "حفظ") {
                if (t.type === "ساعات ودقايق" || t.type === "ورد") {
                    t.type = "صفحة";
                }
            }
            if (t.category === "صيام") {
                t.category = "صوم";
            }
            if (t.id === "task_fasting") {
                if (!t.name) t.name = "صيام الإثنين والخميس";
                if (!t.category) t.category = "صوم";
                if (!t.schedule) t.schedule = "Mon, Thu";
            }
            if (t.id === "task_fasting_white_days") {
                if (!t.name) t.name = "صيام الأيام البيض";
                if (!t.category) t.category = "صوم";
                if (!t.schedule) t.schedule = "WhiteDays";
            }
            if (t.id === "task_fasting_voluntary") {
                if (!t.category) t.category = "صوم";
            }
        });

        // Fasting tasks defaults injection
        if (!this.data.tasks.some(t => t.id === "task_fasting")) {
            this.data.tasks.push({
                id: "task_fasting",
                name: "صيام الإثنين والخميس",
                type: "يوم",
                schedule: "Mon, Thu",
                target: 1,
                multiplier: 1.0,
                isArchived: false,
                icon: "sun",
                category: "صوم",
                subcategory: "",
                allowNotes: false
            });
        }
        if (!this.data.tasks.some(t => t.id === "task_fasting_white_days")) {
            this.data.tasks.push({
                id: "task_fasting_white_days",
                name: "صيام الأيام البيض",
                type: "يوم",
                schedule: "WhiteDays",
                target: 1,
                multiplier: 1.0,
                isArchived: false,
                icon: "sun",
                category: "صوم",
                subcategory: "",
                allowNotes: false
            });
        }
        if (!this.data.tasks.some(t => t.id === "task_fasting_voluntary")) {
            this.data.tasks.push({
                id: "task_fasting_voluntary",
                name: "صيام تطوع عام",
                type: "يوم",
                schedule: "Optional",
                target: 1,
                multiplier: 1.0,
                isArchived: false,
                icon: "sun",
                category: "صوم",
                subcategory: "",
                allowNotes: false
            });
        }

        // Standard Fard prayers injection
        const standardFardIds = ["task_fajr", "task_dhuhr", "task_asr", "task_maghrib", "task_isha"];
        const standardFardNames = ["الفجر", "الظهر", "العصر", "المغرب", "العشاء"];
        standardFardIds.forEach((fid, idx) => {
            if (!this.data.tasks.some(t => t.id === fid)) {
                this.data.tasks.push({
                    id: fid,
                    name: standardFardNames[idx],
                    type: "صلاة",
                    schedule: "Everyday",
                    target: 1,
                    multiplier: 1.0,
                    isArchived: false,
                    icon: idx === 0 ? "mosque" : (idx < 3 ? "sun" : "moon"),
                    category: "صلاة",
                    subcategory: "فرض"
                });
            }
        });

        // Fard prayers sort order
        const fardOrder = ["task_fajr", "task_dhuhr", "task_asr", "task_maghrib", "task_isha"];
        this.data.tasks.sort((a, b) => {
            const idxA = fardOrder.indexOf(a.id);
            const idxB = fardOrder.indexOf(b.id);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return 0; 
        });

        // Cleanup orphan subcategories & normalize prayer names
        this.data.tasks.forEach(t => {
            if (t.category === "صلاة") {
                if (["صلاة الفجر", "صلاة الظهر", "صلاة العصر", "صلاة المغرب", "صلاة العشاء", "الفجر", "الظهر", "العصر", "المغرب", "العشاء"].includes(t.name)) {
                    if (!t.subcategory) t.subcategory = "فرض";
                    t.type = "صلاة";
                    if (t.name.startsWith("صلاة ")) t.name = t.name.replace("صلاة ", "");
                }
            }

            const catObj = this.data.categories.find(c => c.name === t.category);
            if (catObj && catObj.subcategories && catObj.subcategories.length > 0) {
                const validNames = catObj.subcategories.map(s => s.name);
                if (t.subcategory && !validNames.includes(t.subcategory)) {
                    if (validNames.includes("نوافل")) {
                        t.subcategory = "نوافل";
                    } else {
                        t.subcategory = validNames[0] || "";
                    }
                }
            }

            // Ensure all tasks have a createdAt date (default tasks and legacy tasks get baseline date)
            if (!t.createdAt) {
                t.createdAt = "2000-01-01";
            }
            if (t.history && Array.isArray(t.history) && t.history.length === 1) {
                if (t.history[0].effectiveFrom > t.createdAt) {
                    t.history[0].effectiveFrom = t.createdAt;
                }
            }
        });

        // Migrate any legacy deleted tasks to archived
        if (Array.isArray(this.data.tasks)) {
            let migratedAny = false;
            this.data.tasks.forEach(t => {
                if (t.isDeleted) {
                    t.isArchived = true;
                    if (!t.archivedAt) {
                        t.archivedAt = t.deletedAt || (typeof currentDateStr !== "undefined" && currentDateStr ? currentDateStr : "2026-09-21");
                    }
                    delete t.isDeleted;
                    delete t.deletedAt;
                    migratedAny = true;
                }

                // If an archived task has legacy soft-delete flags (isOneTime or schedule OneTime without oneTimeDate)
                if (t.isArchived && (t.isOneTime || (t.schedule === "OneTime" && !t.oneTimeDate))) {
                    t.isOneTime = false;
                    t.oneTimeDate = null;
                    if (Array.isArray(t.history) && t.history.length > 0) {
                        const nonZeroH = [...t.history].reverse().find(h => h.target > 0 && h.schedule !== "OneTime" && !h.isOneTime);
                        if (nonZeroH) {
                            t.target = nonZeroH.target;
                            t.schedule = nonZeroH.schedule;
                            if (nonZeroH.multiplier !== undefined) t.multiplier = nonZeroH.multiplier;
                            t.history = t.history.filter(h => h.target > 0 || (h.schedule !== "OneTime" && !h.isOneTime));
                        } else {
                            if (t.schedule === "OneTime") t.schedule = "Everyday";
                            if (!t.target || t.target === 0) t.target = 1;
                        }
                    } else {
                        if (t.schedule === "OneTime") t.schedule = "Everyday";
                        if (!t.target || t.target === 0) t.target = 1;
                    }
                    if (typeof ScheduleEngine !== "undefined" && typeof ScheduleEngine.invalidateTaskCache === "function") {
                        ScheduleEngine.invalidateTaskCache(t);
                    }
                    migratedAny = true;
                }
            });
            if (migratedAny) {
                console.log("[Migration] Converted deleted tasks to archived:", this.data.tasks.filter(t => t.isArchived));
            }
        }

        // Deduplicate and consolidate one-time tasks with identical names and categories
        if (Array.isArray(this.data.tasks)) {
            const onetimeMap = new Map();
            const toRemoveIds = new Set();
            const idRedirectMap = new Map();

            this.data.tasks.forEach(t => {
                if (!t.isArchived && (t.isOneTime || t.schedule === "OneTime")) {
                    const normName = (t.name || "").trim().toLowerCase();
                    const normCat = (t.category || "").trim().toLowerCase();
                    const key = `${normName}:::${normCat}`;

                    if (!onetimeMap.has(key)) {
                        onetimeMap.set(key, t);
                        if (!Array.isArray(t.oneTimeDates)) {
                            t.oneTimeDates = t.oneTimeDate ? [t.oneTimeDate] : [];
                        }
                    } else {
                        const canonical = onetimeMap.get(key);
                        toRemoveIds.add(t.id);
                        idRedirectMap.set(t.id, canonical.id);

                        if (!Array.isArray(canonical.oneTimeDates)) {
                            canonical.oneTimeDates = canonical.oneTimeDate ? [canonical.oneTimeDate] : [];
                        }
                        const tDates = Array.isArray(t.oneTimeDates) ? t.oneTimeDates : (t.oneTimeDate ? [t.oneTimeDate] : []);
                        tDates.forEach(d => {
                            if (d && !canonical.oneTimeDates.includes(d)) {
                                canonical.oneTimeDates.push(d);
                            }
                        });
                    }
                }
            });

            // Redirect any log entries for merged tasks to canonical tasks
            if (idRedirectMap.size > 0 && this.data.logs) {
                Object.keys(this.data.logs).forEach(dateKey => {
                    const log = this.data.logs[dateKey];
                    if (!log) return;

                    idRedirectMap.forEach((canonicalId, oldId) => {
                        if (log.entries && log.entries[oldId] !== undefined) {
                            const oldVal = log.entries[oldId];
                            const curVal = log.entries[canonicalId] || 0;
                            log.entries[canonicalId] = curVal + oldVal;
                            delete log.entries[oldId];

                            const canonical = this.data.tasks.find(x => x.id === canonicalId);
                            if (canonical && Array.isArray(canonical.oneTimeDates) && !canonical.oneTimeDates.includes(dateKey)) {
                                canonical.oneTimeDates.push(dateKey);
                            }
                        }

                        if (Array.isArray(log.bonusTaskIds)) {
                            const idx = log.bonusTaskIds.indexOf(oldId);
                            if (idx !== -1) {
                                log.bonusTaskIds.splice(idx, 1);
                                if (!log.bonusTaskIds.includes(canonicalId)) {
                                    log.bonusTaskIds.push(canonicalId);
                                }
                            }
                        }

                        if (Array.isArray(log.disabledTaskIds)) {
                            const idx = log.disabledTaskIds.indexOf(oldId);
                            if (idx !== -1) {
                                log.disabledTaskIds.splice(idx, 1);
                                if (!log.disabledTaskIds.includes(canonicalId)) {
                                    log.disabledTaskIds.push(canonicalId);
                                }
                            }
                        }
                    });
                });
            }

            // Ensure all one-time tasks have their latest date in oneTimeDate for backward compatibility
            onetimeMap.forEach(canonical => {
                if (Array.isArray(canonical.oneTimeDates) && canonical.oneTimeDates.length > 0) {
                    canonical.oneTimeDates.sort();
                    canonical.oneTimeDate = canonical.oneTimeDates[canonical.oneTimeDates.length - 1];
                }
            });

            // Remove merged tasks
            if (toRemoveIds.size > 0) {
                this.data.tasks = this.data.tasks.filter(t => !toRemoveIds.has(t.id));
            }
        }

        // Purge permanently deleted tasks if tombstoned
        if (Array.isArray(this.data.deletedTaskIds) && this.data.deletedTaskIds.length > 0) {
            const delSet = new Set(this.data.deletedTaskIds);
            this.data.tasks = this.data.tasks.filter(t => !delSet.has(t.id));
        }
    }

    /**
     * Get current application data reference
     * @returns {Object} { categories, tasks, logs }
     */
    getData() {
        return this.data;
    }

    /**
     * Replace entire dataset (used during JSON import or reset)
     * @param {Object} newData 
     * @param {boolean} [immediate=true] 
     */
    setData(newData, immediate = true) {
        this.data = newData;
        this.ensureDataIntegrity();
        this.notify();
        this.save(immediate);
    }

    /**
     * Request state save. Uses debouncing unless immediate=true.
     * @param {boolean} [immediate=false] 
     */
    save(immediate = false) {
        if (immediate) {
            this.persistImmediate();
        } else if (this.saveDebounced) {
            this.saveDebounced();
        } else {
            this.persistImmediate();
        }
    }

    saveData(immediate = false) {
        this.save(immediate);
    }

    forceSave() {
        this.persistImmediate();
    }

    /**
     * Synchronously/Immediately execute underlying storage save (Supabase Cloud)
     */
    async persistImmediate() {
        if (window.storageEngine) {
            await window.storageEngine.saveData(this.STORAGE_KEY, this.data);
        }
    }

    /**
     * Subscribe to state change notifications
     * @param {Function} listener 
     * @returns {Function} Unsubscribe function
     */
    subscribe(listener) {
        if (typeof listener === "function") {
            this.listeners.push(listener);
        }
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /**
     * Notify all state change subscribers
     */
    notify() {
        this.listeners.forEach(fn => {
            try {
                fn(this.data);
            } catch (e) {
                console.error("[StateManager] Listener notification error:", e);
            }
        });
    }
}

// Global Singleton Instance
var stateManager = new StateManager();

if (typeof window !== "undefined") {
    window.stateManager = stateManager;
}
