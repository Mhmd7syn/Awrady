/**
 * Awrad & Enjaz Dashboard - State Manager & Reactive Store
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

        if (!savedData) {
            const rawLocal = localStorage.getItem(this.STORAGE_KEY);
            if (rawLocal) {
                try {
                    savedData = JSON.parse(rawLocal);
                } catch (e) {
                    console.error("[StateManager] Failed to parse local storage fallback:", e);
                }
            }
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
                t.name = "صيام الإثنين والخميس";
                t.category = "صوم";
                t.schedule = "Mon, Thu";
            }
            if (t.id === "task_fasting_white_days") {
                t.name = "صيام الأيام البيض";
                t.category = "صوم";
                t.schedule = "WhiteDays";
            }
            if (t.id === "task_fasting_voluntary") {
                t.category = "صوم";
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

        if (typeof applyWeeklyScheduleReorg === "function" && this.data && this.data.tasks) {
            this.data = applyWeeklyScheduleReorg(this.data);
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
     * Synchronously/Immediately execute underlying storage save
     */
    async persistImmediate() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.error("[StateManager] localStorage quota/save error:", e);
        }

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
