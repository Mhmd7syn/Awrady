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

const AFFECTED_START_DATE = "2026-11-08";

function cleanStoredDayLog(log, dateStr) {
    if (!log || !log.taskProgress) return false;
    // Only resolve the issue for days from the regression commit onwards; old days before 2026-11-08 are never touched
    if (dateStr < AFFECTED_START_DATE) return false;

    const cleanProgress = {};
    const cleanEntries = {};
    let hasClutter = false;

    for (const [tid, info] of Object.entries(log.taskProgress)) {
        const val = typeof info === "object" && info !== null ? (Number(info.achieved) || 0) : (Number(info) || 0);
        const target = typeof info === "object" && info !== null ? (Number(info.target) || 0) : 0;
        const isBonus = typeof info === "object" && info !== null ? Boolean(info.isBonus) : false;
        const isDirty = Boolean(log._dirtyTasks?.[tid]);
        const task = (appData.tasks || []).find(t => t.id === tid);

        if (task && task.isArchived) {
            // Archived tasks: keep only if positive progress or explicit bonus
            if (val > 0 || isBonus || isDirty) {
                cleanProgress[tid] = info;
                cleanEntries[tid] = val;
            } else {
                hasClutter = true;
            }
            continue;
        }

        const isScheduled = task ? ScheduleEngine.isTaskScheduledForDate(task, dateStr, appData, val) : target > 0;
        const isPaused = log.disabledTaskIds?.includes(tid) || (target === 0 && isScheduled);

        // Keep active tasks that genuinely belong to this day
        if (val > 0 || target > 0 || isScheduled || isPaused || isBonus || isDirty) {
            cleanProgress[tid] = info;
            cleanEntries[tid] = val;
        } else {
            hasClutter = true;
        }
    }

    for (const [tid, entryVal] of Object.entries(log.entries || {})) {
        if (cleanProgress[tid] !== undefined) continue;
        const numVal = Number(entryVal) || 0;
        const task = (appData.tasks || []).find(t => t.id === tid);
        const isDirty = Boolean(log._dirtyTasks?.[tid]);
        if (task && task.isArchived) {
            if (numVal > 0 || isDirty) {
                cleanEntries[tid] = numVal;
            } else {
                hasClutter = true;
            }
            continue;
        }
        if (numVal > 0 || isDirty) {
            cleanEntries[tid] = numVal;
        } else if (task && !task.isArchived && ScheduleEngine.isTaskScheduledForDate(task, dateStr, appData, numVal)) {
            cleanEntries[tid] = numVal;
        } else {
            hasClutter = true;
        }
    }

    if (hasClutter) {
        log.taskProgress = cleanProgress;
        log.entries = cleanEntries;
        return true;
    }
    return false;
}

function loadLocalState() {
    try {
        const localSaved = localStorage.getItem(getUserStorageKey()) || localStorage.getItem(STORAGE_KEY);
        if (localSaved) {
            const parsed = JSON.parse(localSaved);
            if (parsed) {
                if (parsed.tasks && parsed.tasks.length > 0) appData.tasks = parsed.tasks;
                if (parsed.logs) {
                    appData.logs = parsed.logs;
                    let hadAnyClutter = false;
                    Object.keys(appData.logs).forEach(dateStr => {
                        if (cleanStoredDayLog(appData.logs[dateStr], dateStr)) {
                            hadAnyClutter = true;
                        }
                    });
                    if (hadAnyClutter) {
                        try {
                            localStorage.setItem(getUserStorageKey(), JSON.stringify(appData));
                            if ((window.awradyAPI?.currentUser || "").toLowerCase() === APP_CONSTANTS.GUEST_USER) {
                                localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
                            }
                        } catch (_) {}
                    }
                }
            }
        }
    } catch (e) {
        console.error("[initData] LocalStorage error:", e);
    }
}

function mergeDayLog(localLog, cloudRow) {
    const cloudLog = rowToLog(cloudRow);
    if (!localLog) return cloudLog;

    const dirtyTasks = localLog._dirtyTasks || {};
    const dirtyFields = localLog._dirtyFields || {};
    const hasDirtyTasks = Object.keys(dirtyTasks).length > 0;
    const hasDirtyFields = Object.keys(dirtyFields).length > 0;

    // Untouched remote fields must always take precedence over stale local cache values
    if (!localLog._dirty && !hasDirtyTasks && !hasDirtyFields) {
        return cloudLog;
    }

    const cloudUpdatedAt = cloudLog.updatedAt || (cloudRow?.updated_at ? new Date(cloudRow.updated_at).getTime() : 0);

    // 1. Task entries merge: LWW evaluated strictly on dirty tasks
    const mergedEntries = { ...(cloudLog.entries || {}) };
    const remainingDirtyTasks = {};

    for (const taskId in dirtyTasks) {
        if (!dirtyTasks[taskId]) continue;
        const taskTime = typeof dirtyTasks[taskId] === "number"
            ? dirtyTasks[taskId]
            : (localLog.updatedAt || Date.now());

        if (taskTime >= cloudUpdatedAt) {
            if (localLog.entries && localLog.entries[taskId] !== undefined) {
                mergedEntries[taskId] = localLog.entries[taskId];
            }
            remainingDirtyTasks[taskId] = dirtyTasks[taskId];
        } else {
            // Cloud is newer: cloud wins for this task
            if (cloudLog.entries && cloudLog.entries[taskId] !== undefined) {
                mergedEntries[taskId] = cloudLog.entries[taskId];
            }
        }
    }

    // 2. Prayer extras merge: check per-prayer dirty keys and blanket prayerExtras
    const mergedPrayerExtras = { ...(cloudLog.prayerExtras || {}) };
    const remainingDirtyFields = {};

    if (dirtyFields.prayerExtras) {
        const pTime = Number(dirtyFields.prayerExtras) || 0;
        if (pTime >= cloudUpdatedAt) {
            Object.assign(mergedPrayerExtras, localLog.prayerExtras || {});
            remainingDirtyFields.prayerExtras = dirtyFields.prayerExtras;
        }
    }

    for (const key in dirtyFields) {
        if (key.startsWith("prayerExtras.")) {
            const prayerId = key.slice("prayerExtras.".length);
            const pTime = Number(dirtyFields[key]) || 0;
            if (pTime >= cloudUpdatedAt) {
                if (localLog.prayerExtras?.[prayerId]) {
                    mergedPrayerExtras[prayerId] = localLog.prayerExtras[prayerId];
                } else {
                    delete mergedPrayerExtras[prayerId];
                }
                remainingDirtyFields[key] = dirtyFields[key];
            }
        }
    }

    // 3. Disabled task IDs: strict LWW on dirty field
    let mergedDisabled = cloudLog.disabledTaskIds || [];
    if (dirtyFields.disabledTaskIds) {
        const dTime = Number(dirtyFields.disabledTaskIds) || 0;
        if (dTime >= cloudUpdatedAt) {
            mergedDisabled = localLog.disabledTaskIds || [];
            remainingDirtyFields.disabledTaskIds = dirtyFields.disabledTaskIds;
        }
    }

    const isStillDirty = Object.keys(remainingDirtyTasks).length > 0 || Object.keys(remainingDirtyFields).length > 0;

    const mergedTaskProgress = { ...(cloudLog.taskProgress || {}) };
    for (const taskId in remainingDirtyTasks) {
        if (localLog.taskProgress && localLog.taskProgress[taskId]) {
            mergedTaskProgress[taskId] = localLog.taskProgress[taskId];
        }
    }

    const mergedLog = {
        ...cloudLog,
        entries: mergedEntries,
        taskProgress: mergedTaskProgress,
        prayerExtras: mergedPrayerExtras,
        disabledTaskIds: Array.from(new Set(mergedDisabled)),
        _dirty: isStillDirty,
        _dirtyTasks: remainingDirtyTasks,
        _dirtyFields: remainingDirtyFields,
        _loadedFromDB: true
    };

    if (isStillDirty) {
        // Invalidate outdated precomputed score so it recalculates accurately on next read or cloud push
        delete mergedLog.precomputedScore;
        delete mergedLog.totalHours;
    }

    return mergedLog;
}

async function pushDayToCloud(dateStr) {
    if (!window.awradyAPI?.client) return;
    const log = appData.logs?.[dateStr];
    if (!log) return;

    const prayerExtras = { ...(log.prayerExtras || {}) };
    delete prayerExtras._meta;

    const totalScore = (log.precomputedScore !== undefined && (!log._dirtyTasks || Object.keys(log._dirtyTasks).length === 0) && (!log._dirtyFields || Object.keys(log._dirtyFields).length === 0))
        ? log.precomputedScore
        : calculateDayScore(dateStr, appData, false);
    const totalHours = (log.totalHours !== undefined && (!log._dirtyTasks || Object.keys(log._dirtyTasks).length === 0) && (!log._dirtyFields || Object.keys(log._dirtyFields).length === 0))
        ? log.totalHours
        : calculateDayScore(dateStr, appData, true);

    const taskProgress = {};
    const disabledIds = log.disabledTaskIds || [];

    (appData.tasks || []).forEach(t => {
        const hasEntry = log.entries && log.entries[t.id] !== undefined;
        const val = hasEntry ? (Number(log.entries[t.id]) || 0) : 0;
        const isScheduled = ScheduleEngine.isTaskScheduledForDate(t, dateStr, appData, val);
        const isDisabled = disabledIds.includes(t.id);
        const existingProgress = log.taskProgress?.[t.id];
        const isExplicitBonus = Boolean(existingProgress?.isBonus) || Boolean(log._dirtyTasks?.[t.id] && hasEntry);
        const recordedTarget = typeof existingProgress === "object" && existingProgress !== null ? Number(existingProgress.target) : Number(existingProgress);

        // Clean DB persistence: only persist tasks that genuinely belong to this day
        if (t.isArchived) {
            const keepHistorical = dateStr < AFFECTED_START_DATE && log._loadedFromDB && recordedTarget > 0;
            if (val <= 0 && !isExplicitBonus && !keepHistorical) {
                return;
            }
        } else {
            if (!isScheduled && !isDisabled && val <= 0 && !isExplicitBonus && !(log._loadedFromDB && recordedTarget > 0)) {
                return;
            }
        }

        const isBonus = isExplicitBonus || (!isScheduled && !isDisabled);
        const normTarget = (isDisabled || isBonus) ? 0 : (recordedTarget > 0 ? recordedTarget : getTaskNormalizedTarget(t, dateStr));

        taskProgress[t.id] = {
            target: normTarget,
            achieved: val,
            hours: t.type === "ساعة" ? (val / 60) : 0,
            score: normTarget > 0 ? (val / normTarget) : (val > 0 ? 1 : 0)
        };
        if (isBonus) {
            taskProgress[t.id].isBonus = true;
        }
    });

    try {
        const savedRow = await window.awradyAPI.saveDayProgress(dateStr, taskProgress, prayerExtras, { totalScore, totalHours });
        if (appData.logs?.[dateStr]) {
            delete appData.logs[dateStr]._dirty;
            delete appData.logs[dateStr]._dirtyTasks;
            delete appData.logs[dateStr]._dirtyFields;
            appData.logs[dateStr].taskProgress = taskProgress;
            appData.logs[dateStr].precomputedScore = totalScore;
            appData.logs[dateStr].totalHours = totalHours;
            appData.logs[dateStr]._loadedFromDB = true;
            if (savedRow?.updated_at) {
                appData.logs[dateStr].updatedAt = new Date(savedRow.updated_at).getTime();
            }
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
    const dirtyDates = Object.keys(appData.logs).filter(d => {
        const log = appData.logs[d];
        if (!log) return false;
        return log._dirty ||
            (log._dirtyTasks && Object.keys(log._dirtyTasks).length > 0) ||
            (log._dirtyFields && Object.keys(log._dirtyFields).length > 0);
    });
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
                    const merged = localLog ? mergeDayLog(localLog, row) : rowToLog(row);
                    cleanStoredDayLog(merged, row.date);
                    appData.logs[row.date] = merged;
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
                    const newLog = (currentLog && (currentLog._dirty || (currentLog._dirtyTasks && Object.keys(currentLog._dirtyTasks).length > 0) || (currentLog._dirtyFields && Object.keys(currentLog._dirtyFields).length > 0)))
                        ? mergeDayLog(currentLog, row)
                        : rowToLog(row);
                    cleanStoredDayLog(newLog, currentDateStr);
                    appData.logs[currentDateStr] = newLog;
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
                            isArchived: Boolean(row.is_archived),
                            totalAchieved: Number(row.total_achieved) || 0,
                            totalHours: Number(row.total_hours) || 0,
                            totalScore: Number(row.total_score) || 0
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
    delete appData.logs[curDate].precomputedScore;
    delete appData.logs[curDate].totalHours;

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
                const newLog = (localLog && (localLog._dirty || localLog._dirtyTasks))
                    ? mergeDayLog(localLog, dayProgress)
                    : rowToLog(dayProgress);
                cleanStoredDayLog(newLog, currentDateStr);
                appData.logs[currentDateStr] = newLog;
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
