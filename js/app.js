/**
 * ============================================================================
 * AWRAD PRO - APPLICATION ENGINE & INTERACTIVE LOGIC
 * Features:
 *  - Smart Hijri Date Calculation & Automatic Ayyam Bidh (White Days 13,14,15) detection
 *  - Automatic Ramadan Season detection and fasting assignment
 *  - Interactive Smart Nawafel / Sunah Prompt upon completing prayers
 *  - Full Dynamic Category Management (Add, Edit icons/labels, Delete)
 *  - Task Customization & Permanent Archival (without losing historical points)
 *  - Parity with accurate scoring equations and Chart.js Analytics
 * ============================================================================
 */

const STORAGE_KEY = APP_CONSTANTS.STORAGE_KEY;

// Global Application State
var appData = {
    tasks: [],
    logs: {}
};
Object.defineProperty(appData, "categories", {
    get: () => APP_CONSTANTS.CATEGORIES,
    enumerable: false,
    configurable: true
});
window.appData = appData;

let currentDateStr = getLocalTodayString();
let chartTimeRange = "all";
let chartInstance = null;
let editingTaskId = null;

function getUserStorageKey() {
    const u = (window.awradyAPI?.currentUser || (window.authManager && window.authManager.getCurrentUser()) || APP_CONSTANTS.GUEST_USER).toLowerCase();
    return `${STORAGE_KEY}_${u}`;
}

// ============================================================================
// INITIALIZATION & STATE MANAGEMENT
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
    setupDataManagement();
    if (window.authManager) {
        window.authManager.init();
        if (window.authManager.isLoggedIn()) {
            window.startApp(window.authManager.getCurrentUser());
        }
    } else {
        window.startApp(APP_CONSTANTS.GUEST_USER);
    }
});

window.startApp = async function(username) {
    if (window.awradyAPI) {
        window.awradyAPI.currentUser = username;
    }
    if (window.securityLock) {
        window.securityLock.init();
    }
    await initData();
    if (!window._appControlsBound) {
        setupNavigation();
        setupDailyControls();
        setupTaskManager();
        setupNawafelToast();
        setupQiyamToast();
        setupPomodoroControls();
        window._appControlsBound = true;
    }
    renderDailyView();
    renderAllTimeStats();
    updateHeaderTodayScore();
};

window.logoutApp = function() {
    appData = {
        tasks: [],
        logs: {}
    };
    Object.defineProperty(appData, "categories", {
        get: () => APP_CONSTANTS.CATEGORIES,
        enumerable: false,
        configurable: true
    });
    window.appData = appData;
    const todayEl = document.getElementById("header-today-score");
    if (todayEl) todayEl.textContent = "0%";
    const container = document.getElementById("daily-tasks-container");
    if (container) container.innerHTML = "";
};

let _dbSaveTimer = null;

function loadLocalState() {
    try {
        const localSaved = localStorage.getItem(getUserStorageKey()) || localStorage.getItem(STORAGE_KEY);
        if (localSaved) {
            const parsed = JSON.parse(localSaved);
            if (parsed) {
                if (parsed.tasks && parsed.tasks.length > 0) appData.tasks = parsed.tasks;
                if (parsed.logs) appData.logs = parsed.logs;
            }
        }
    } catch (e) {
        console.error("[initData] LocalStorage error:", e);
    }
}

function mergeDayLog(localLog, cloudRow) {
    const cloudLog = rowToLog(cloudRow);
    if (!localLog) return cloudLog;
    if (!localLog._dirty && (!localLog._dirtyTasks || Object.keys(localLog._dirtyTasks).length === 0)) {
        return cloudLog;
    }

    const mergedEntries = { ...(cloudLog.entries || {}) };
    const dirtyTasks = localLog._dirtyTasks || {};

    if (Object.keys(dirtyTasks).length > 0) {
        for (const taskId in dirtyTasks) {
            if (dirtyTasks[taskId] && localLog.entries?.[taskId] !== undefined) {
                mergedEntries[taskId] = localLog.entries[taskId];
            }
        }
    } else if (localLog.entries) {
        Object.assign(mergedEntries, localLog.entries);
    }

    const mergedPrayerExtras = {
        ...(cloudLog.prayerExtras || {}),
        ...(localLog.prayerExtras || {})
    };

    const disabledSet = new Set([...(cloudLog.disabledTaskIds || []), ...(localLog.disabledTaskIds || [])]);
    const bonusSet = new Set([...(cloudLog.bonusTaskIds || []), ...(localLog.bonusTaskIds || [])]);

    return {
        ...cloudLog,
        entries: mergedEntries,
        prayerExtras: mergedPrayerExtras,
        disabledTaskIds: Array.from(disabledSet),
        bonusTaskIds: Array.from(bonusSet),
        _dirty: true,
        _dirtyTasks: { ...dirtyTasks },
        _loadedFromDB: true
    };
}

async function pushDayToCloud(dateStr) {
    if (!window.awradyAPI?.client) return;
    const log = appData.logs?.[dateStr];
    if (!log) return;

    const prayerExtras = { ...(log.prayerExtras || {}) };
    prayerExtras._meta = {
        disabledTaskIds: log.disabledTaskIds || [],
        bonusTaskIds: log.bonusTaskIds || []
    };

    const totalScore = calculateDayScore(dateStr, appData, false);
    const totalHours = calculateDayScore(dateStr, appData, true);

    const taskProgress = {};
    (appData.tasks || []).forEach(t => {
        const val = (log.entries && log.entries[t.id]) || 0;
        const target = getTaskNormalizedTarget(t, dateStr);
        taskProgress[t.id] = {
            target,
            achieved: val,
            hours: t.type === "ساعة" ? (val / 60) : 0,
            score: target > 0 ? (val / target) : 0
        };
    });

    try {
        await window.awradyAPI.saveDayProgress(dateStr, taskProgress, prayerExtras, { totalScore, totalHours });
        if (appData.logs?.[dateStr]) {
            delete appData.logs[dateStr]._dirty;
            delete appData.logs[dateStr]._dirtyTasks;
            try {
                localStorage.setItem(getUserStorageKey(), JSON.stringify(appData));
                if ((window.awradyAPI?.currentUser || "").toLowerCase() === APP_CONSTANTS.GUEST_USER) {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
                }
            } catch (_) {}
        }
        updateCloudSyncUI({
            state: "synced",
            message: "متزامن سحابياً مع Supabase 24/7"
        });
    } catch (e) {
        console.warn("[AwradyAPI] Save progress error for", dateStr, e.message);
        updateCloudSyncUI({
            state: "offline",
            message: "وضع عدم الاتصال (محفوظ محلياً)"
        });
    }
}

async function syncAllDirtyDays() {
    if (!window.awradyAPI?.client || !navigator.onLine || !appData.logs) return;
    const dirtyDates = Object.keys(appData.logs).filter(d => appData.logs[d]?._dirty || (appData.logs[d]?._dirtyTasks && Object.keys(appData.logs[d]._dirtyTasks).length > 0));
    for (const d of dirtyDates) {
        await pushDayToCloud(d);
    }
}

async function initData() {
    let loaded = false;

    // 1. ALWAYS load local storage first (instant UI + preserve offline changes)
    loadLocalState();

    // 2. Attempt cloud fetch & merge via direct Supabase API
    if (window.awradyAPI && window.awradyAPI.init()) {
        try {
            const results = await Promise.allSettled([
                window.awradyAPI.getTasks(true),
                window.awradyAPI.getAllProgress()
            ]);

            const tasks = results[0].status === "fulfilled" ? results[0].value : null;
            const allProgress = results[1].status === "fulfilled" ? results[1].value : null;

            if (tasks && tasks.length > 0) {
                const serverTaskIds = new Set(tasks.map(t => t.id));
                const localNewTasks = (appData.tasks || []).filter(t => !serverTaskIds.has(t.id));
                appData.tasks = [...tasks, ...localNewTasks];
                if (localNewTasks.length > 0) {
                    localNewTasks.forEach(t => window.awradyAPI.saveTask(t).catch(() => {}));
                }
            }

            if (!appData.logs) appData.logs = {};

            if (allProgress && allProgress.length > 0) {
                allProgress.forEach(row => {
                    const localLog = appData.logs[row.date];
                    if (localLog) {
                        appData.logs[row.date] = mergeDayLog(localLog, row);
                    } else {
                        appData.logs[row.date] = rowToLog(row);
                    }
                });
            }

            // Sync all dirty/pending offline days up to Supabase now that we are connected
            syncAllDirtyDays().catch(() => {});

            // Seed default tasks to Supabase if database has 0 tasks (B12 fix)
            if ((!appData.tasks || appData.tasks.length === 0) && DEFAULT_TASKS.length > 0) {
                appData.tasks = JSON.parse(JSON.stringify(DEFAULT_TASKS));
                for (const t of appData.tasks) {
                    await window.awradyAPI.saveTask(t).catch(e => console.warn("[initData] Seed task error:", e.message));
                }
            }

            // Realtime WebSocket subscription
            window.awradyAPI.onUpdate((table, payload) => {
                if (table === APP_CONSTANTS.DB.TABLES.PROGRESS && payload.new?.date === currentDateStr) {
                    const row = payload.new;
                    if (!appData.logs) appData.logs = {};
                    const currentLog = appData.logs[currentDateStr];
                    if (currentLog && (currentLog._dirty || currentLog._dirtyTasks)) {
                        appData.logs[currentDateStr] = mergeDayLog(currentLog, row);
                    } else {
                        appData.logs[currentDateStr] = rowToLog(row);
                    }
                    renderDailyView();
                    updateHeaderTodayScore();
                } else if (table === APP_CONSTANTS.DB.TABLES.TASKS) {
                    if (payload.eventType === "DELETE") {
                        appData.tasks = appData.tasks.filter(t => t.id !== payload.old?.task_id);
                    } else if (payload.new?.task_id) {
                        const row = payload.new;
                        const fields = {
                            name: row.name,
                            category: row.category,
                            subcategory: row.subcategory || null,
                            target: Number(row.target) || 1,
                            schedule: row.schedule || "Everyday",
                            isArchived: Boolean(row.is_archived)
                        };
                        const task = appData.tasks.find(t => t.id === row.task_id);
                        if (task) {
                            Object.assign(task, fields);
                        } else {
                            appData.tasks.push({ id: row.task_id, ...fields, createdAt: row.created_at });
                        }
                    }
                    renderDailyView();
                }
            });

            loaded = true;
            updateCloudSyncUI({
                    state: navigator.onLine ? "synced" : "offline",
                    message: navigator.onLine ? "متزامن سحابياً مع Supabase 24/7" : "وضع عدم الاتصال"
                });
        } catch (err) {
            console.warn("[initData] Supabase initialization fallback:", err.message);
            updateCloudSyncUI({
                    state: "offline",
                    message: "وضع عدم الاتصال (محفوظ محلياً)"
                });
        }
    }

    // 3. Fallback defaults if still empty
    if (!appData.tasks || appData.tasks.length === 0) {
        appData.tasks = JSON.parse(JSON.stringify(DEFAULT_TASKS));
    }

    window.appData = appData;
}

function loadDefaultAppData() {
    appData = {
        tasks: JSON.parse(JSON.stringify(DEFAULT_TASKS)),
        logs: {}
    };
    Object.defineProperty(appData, "categories", {
        get: () => APP_CONSTANTS.CATEGORIES,
        enumerable: false,
        configurable: true
    });
}

function saveData(immediate = false) {
    const curDate = currentDateStr;
    if (!appData.logs) appData.logs = {};
    if (!appData.logs[curDate]) appData.logs[curDate] = { entries: {} };

    appData.logs[curDate]._dirty = true;

    // 1. Offline resilient local backup
    try {
        localStorage.setItem(getUserStorageKey(), JSON.stringify(appData));
        if ((window.awradyAPI?.currentUser || "").toLowerCase() === APP_CONSTANTS.GUEST_USER) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
        }
    } catch (_) {}

    // 2. Direct database persistence via AwradyAPI
    if (window.awradyAPI?.client) {
        const executeDbSave = () => {
            pushDayToCloud(curDate);
        };

        if (immediate) {
            if (_dbSaveTimer) clearTimeout(_dbSaveTimer);
            executeDbSave();
        } else {
            if (_dbSaveTimer) clearTimeout(_dbSaveTimer);
            _dbSaveTimer = setTimeout(executeDbSave, APP_CONSTANTS.UI.SAVE_DEBOUNCE_MS);
        }
    }
}

const isTaskScheduledForDate = (task, dateStr, loggedVal = null) => ScheduleEngine.isTaskScheduledForDate(task, dateStr, appData, loggedVal);
const isBonusTaskForDate = (task, dateStr, loggedVal = null) => ScheduleEngine.isBonusTaskForDate(task, dateStr, appData, loggedVal);


// ============================================================================
// NAVIGATION & CONTROLS
// ============================================================================
function setupNavigation() {
    const navTabs = document.querySelectorAll(".nav-tab");
    navTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            navTabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            
            const targetViewId = tab.getAttribute("data-tab");
            
            document.querySelectorAll(".tab-view").forEach(view => {
                view.classList.remove("active");
            });
            document.getElementById(targetViewId).classList.add("active");

            if (targetViewId === "view-analytics") {
                if (!chartInstance) {
                    initChart();
                }
                updateChartAndAnalytics();
            } else if (targetViewId === "view-manager") {
                renderTaskManager();
            }
        });
    });

    const btnHeaderPomo = document.getElementById("btn-open-header-pomo");
    if (btnHeaderPomo) {
        btnHeaderPomo.addEventListener("click", () => {
            openPomodoroModal();
        });
    }

    const btnHeaderWeekly = document.getElementById("btn-open-weekly-calc");
    if (btnHeaderWeekly) {
        btnHeaderWeekly.addEventListener("click", () => {
            showWeeklyHoursModal(true);
        });
    }
}

async function switchActiveDate(newDate) {
    currentDateStr = newDate;
    const datePicker = document.getElementById("date-picker-input");
    if (datePicker) datePicker.value = currentDateStr;

    if (window.awradyAPI?.client && (!appData.logs[currentDateStr] || !appData.logs[currentDateStr]._loadedFromDB)) {
        try {
            const dayProgress = await window.awradyAPI.getDayProgress(currentDateStr);
            if (dayProgress) {
                if (!appData.logs) appData.logs = {};
                const localLog = appData.logs[currentDateStr];
                if (localLog && (localLog._dirty || localLog._dirtyTasks)) {
                    appData.logs[currentDateStr] = mergeDayLog(localLog, dayProgress);
                } else {
                    appData.logs[currentDateStr] = rowToLog(dayProgress);
                }
            }
        } catch (_) {}
    }
    renderDailyView();
}

function setupDailyControls() {
    const datePicker = document.getElementById("date-picker-input");
    if (datePicker) {
        datePicker.value = currentDateStr;
        datePicker.addEventListener("change", (e) => switchActiveDate(e.target.value));
    }

    const btnPrev = document.getElementById("btn-prev-day");
    if (btnPrev) btnPrev.addEventListener("click", () => switchActiveDate(addDays(currentDateStr, -1)));

    const btnNext = document.getElementById("btn-next-day");
    if (btnNext) btnNext.addEventListener("click", () => switchActiveDate(addDays(currentDateStr, 1)));

    const btnToday = document.getElementById("btn-jump-today");
    if (btnToday) btnToday.addEventListener("click", () => switchActiveDate(getLocalTodayString()));

    // Wire unified quick-add button
    const btnQuickAdd = document.getElementById("btn-open-quick-add");
    if (btnQuickAdd) btnQuickAdd.addEventListener("click", () => {
        openQuickAddModal();
    });
}


// ============================================================================
// SCORING ENGINE INTEGRATION & HELPERS
// ============================================================================
function getTaskWeightMinutes(task, dateStr = null) {
    return ScoringEngine.getTaskWeightMinutes(task, dateStr, appData);
}

function calculateDayScore(dateStr, appDataRef = null, returnHours = false) {
    return ScoringEngine.calculateDayScore(dateStr, appDataRef || appData, returnHours);
}

if (typeof window !== "undefined") {
    window.renderDailyView = renderDailyView;
    window.setTaskVal = setTaskVal;
    window.adjustTaskVal = adjustTaskVal;
    window.getTaskVal = getTaskVal;
    window.updateDailyScoreSummary = updateDailyScoreSummary;
    window.updateHeaderTodayScore = updateHeaderTodayScore;
    window.updateTaskCardInPlace = updateTaskCardInPlace;

    window.addEventListener("online", () => {
        syncAllDirtyDays();
    });

    window.addEventListener("beforeunload", () => {
        if (_dbSaveTimer) {
            clearTimeout(_dbSaveTimer);
            saveData(true);
        }
    });

    window.addEventListener("pagehide", () => {
        if (_dbSaveTimer) {
            clearTimeout(_dbSaveTimer);
            saveData(true);
        }
    });
}
