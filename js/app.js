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
Object.defineProperty(window, "currentDateStr", {
    get: () => currentDateStr,
    set: (v) => { currentDateStr = v; },
    configurable: true
});
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

    // If today has no records in the database, populate and save all its scheduled tasks
    const todayStr = currentDateStr || getLocalTodayString();
    if (window.awradyAPI?.client && (!appData.logs?.[todayStr] || !appData.logs[todayStr]._loadedFromDB)) {
        window.awradyAPI.getDayProgress(todayStr).then(dayProgress => {
            if (dayProgress) {
                if (!appData.logs) appData.logs = {};
                const localLog = appData.logs[todayStr];
                appData.logs[todayStr] = localLog
                    ? mergeDayLog(localLog, dayProgress)
                    : rowToLog(dayProgress);
            } else {
                populateDayTasksIfMissing(todayStr);
                pushDayToCloud(todayStr);
            }
            renderDailyView();
            updateDailyScoreSummary();
            updateHeaderTodayScore();
        }).catch(() => {});
    }
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
const _isSavingDay = {};
const _queuedSaveDay = {};
const _lastSavedCloudTimestamp = {};

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

    const dirtyTasks = localLog._dirtyTasks || {};
    const hasDirtyTasks = Object.keys(dirtyTasks).length > 0;

    // 1. Task progress merge: union local and cloud tasks so no task record is lost.
    // Cloud takes precedence for non-dirty tasks; locally dirty tasks strictly retain local values.
    const mergedTaskProgress = {
        ...(localLog.taskProgress || {}),
        ...(cloudLog.taskProgress || {})
    };
    const remainingDirtyTasks = {};

    for (const taskId in dirtyTasks) {
        if (!dirtyTasks[taskId]) continue;
        if (localLog.taskProgress && localLog.taskProgress[taskId]) {
            mergedTaskProgress[taskId] = localLog.taskProgress[taskId];
        }
        remainingDirtyTasks[taskId] = dirtyTasks[taskId];
    }

    // 2. Prayer extras merge: locally dirty keys retain local values
    const mergedPrayerExtras = {
        ...(cloudLog.prayerExtras || {}),
        ...(localLog.prayerExtras || {})
    };

    const isStillDirty = Object.keys(remainingDirtyTasks).length > 0;

    const mergedLog = {
        ...cloudLog,
        taskProgress: mergedTaskProgress,
        prayerExtras: mergedPrayerExtras,
        _dirty: isStillDirty,
        _dirtyTasks: remainingDirtyTasks,
        _loadedFromDB: true
    };

    if (isStillDirty) {
        delete mergedLog.precomputedScore;
        delete mergedLog.totalHours;
    }

    return mergedLog;
}

async function pushDayToCloud(dateStr) {
    if (!window.awradyAPI?.client) return;
    const log = appData.logs?.[dateStr];
    if (!log) return;

    if (_isSavingDay[dateStr]) {
        _queuedSaveDay[dateStr] = true;
        return;
    }
    _isSavingDay[dateStr] = true;

    try {
        const saveStartTime = Date.now();
        const snapshottedDirtyTasks = { ...(log._dirtyTasks || {}) };

        const prayerExtras = { ...(log.prayerExtras || {}) };
        delete prayerExtras._meta;

        if (!log.taskProgress) log.taskProgress = {};

        const dateContext = {
            dayAbbrev: getDayOfWeekAbbrev(dateStr),
            hijriInfo: getHijriDateDetails(dateStr)
        };

        // Populate taskProgress with ALL tasks that belong to this date (scheduled, bonus, or disabled)
        // so that new days without records store complete task records in the DB snapshot
        const taskProgress = {};

        (appData.tasks || []).forEach(t => {
            const existingProgress = log.taskProgress[t.id];
            const val = Number(existingProgress?.achieved) || 0;
            const isDisabled = ScheduleEngine.isTaskDisabledForDate(t, log, appData);
            const isBonus = existingProgress?.status === "bonus" || Boolean(t.isBonus) || ScheduleEngine.isBonusTaskForDate(t, dateStr, appData, val, dateContext);
            const isScheduled = existingProgress?.status === "scheduled" || (!isBonus && !isDisabled && ScheduleEngine.isTaskScheduledForDate(t, dateStr, appData, val, dateContext));

            // Never persist uncompleted archived tasks
            if (t.isArchived && val <= 0 && existingProgress?.status !== "bonus") {
                return;
            }

            // Only persist tasks that belong to this day (scheduled, active bonus, or disabled)
            if (!isScheduled && !isDisabled && !isBonus && val <= 0) {
                return;
            }

            const status = isDisabled ? "disabled" : (isBonus ? "bonus" : "scheduled");
            const normTarget = (status === "bonus" || status === "disabled")
                ? 0
                : ((existingProgress && Number(existingProgress.target) > 0) ? Number(existingProgress.target) : getTaskNormalizedTarget(t, dateStr));

            const { hours: _h, score: _s, ...cleanExisting } = existingProgress || {};
            const entry = {
                ...cleanExisting,
                target: normTarget,
                achieved: val,
                status: status
            };

            taskProgress[t.id] = entry;
            log.taskProgress[t.id] = entry;
        });

        // Also preserve any additional active taskProgress entries that might have existed
        for (const [tid, info] of Object.entries(log.taskProgress)) {
            if (!taskProgress[tid]) {
                const task = (appData.tasks || []).find(t => t.id === tid);
                if (task?.isArchived && (Number(info?.achieved) || 0) <= 0 && info?.status !== "bonus") {
                    continue;
                }
                const { hours: _h, score: _s, ...cleanInfo } = info || {};
                taskProgress[tid] = cleanInfo;
                log.taskProgress[tid] = cleanInfo;
            }
        }

        const totalScore = calculateDayScore(dateStr, appData, false);
        const totalHours = calculateDayScore(dateStr, appData, true);

        const savedRow = await window.awradyAPI.saveDayProgress(dateStr, taskProgress, prayerExtras, { totalScore, totalHours });
        if (appData.logs?.[dateStr]) {
            const currentLog = appData.logs[dateStr];
            // Prune only dirty tasks whose timestamp has not been updated since save started
            if (currentLog._dirtyTasks) {
                for (const tid in snapshottedDirtyTasks) {
                    if (currentLog._dirtyTasks[tid] && currentLog._dirtyTasks[tid] <= (snapshottedDirtyTasks[tid] || saveStartTime)) {
                        delete currentLog._dirtyTasks[tid];
                    }
                }
            }
            const hasRemainingDirtyTasks = currentLog._dirtyTasks && Object.keys(currentLog._dirtyTasks).length > 0;
            currentLog._dirty = hasRemainingDirtyTasks;

            // Preserve local active modifications for any tasks still dirty
            if (!currentLog.taskProgress) currentLog.taskProgress = {};
            for (const tid in taskProgress) {
                if (!currentLog._dirtyTasks?.[tid]) {
                    currentLog.taskProgress[tid] = taskProgress[tid];
                }
            }

            if (!currentLog._dirty) {
                currentLog.precomputedScore = totalScore;
                currentLog.totalHours = totalHours;
            } else {
                delete currentLog.precomputedScore;
                delete currentLog.totalHours;
            }
            currentLog._loadedFromDB = true;
            if (savedRow?.updated_at) {
                const updatedTs = new Date(savedRow.updated_at).getTime();
                currentLog.updatedAt = updatedTs;
                _lastSavedCloudTimestamp[dateStr] = updatedTs;
            }
            try {
                localStorage.setItem(getUserStorageKey(), JSON.stringify(appData));
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
    } finally {
        _isSavingDay[dateStr] = false;
        const stillDirty = Boolean(appData.logs?.[dateStr]?._dirty);
        if (_queuedSaveDay[dateStr] || stillDirty) {
            _queuedSaveDay[dateStr] = false;
            if (_dbSaveTimer) clearTimeout(_dbSaveTimer);
            _dbSaveTimer = setTimeout(() => pushDayToCloud(dateStr), APP_CONSTANTS.UI.SAVE_DEBOUNCE_MS);
        }
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
                    appData.logs[row.date] = localLog ? mergeDayLog(localLog, row) : rowToLog(row);
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
                    const hasDirty = Boolean(currentLog && (currentLog._dirty || (currentLog._dirtyTasks && Object.keys(currentLog._dirtyTasks).length > 0) || (currentLog._dirtyFields && Object.keys(currentLog._dirtyFields).length > 0)));

                    // Ignore echo of our own save when there are no unsaved dirty edits
                    const rowUpdatedAt = row.updated_at ? new Date(row.updated_at).getTime() : 0;
                    if (!hasDirty && _lastSavedCloudTimestamp[currentDateStr] && Math.abs(rowUpdatedAt - _lastSavedCloudTimestamp[currentDateStr]) < 2000) {
                        return;
                    }

                    appData.logs[currentDateStr] = hasDirty
                        ? mergeDayLog(currentLog, row)
                        : rowToLog(row);
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
    if (!appData.logs[curDate]) appData.logs[curDate] = { taskProgress: {} };
    if (!appData.logs[curDate].taskProgress) appData.logs[curDate].taskProgress = {};

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

function populateDayTasksIfMissing(dateStr) {
    if (!appData.logs) appData.logs = {};
    if (!appData.logs[dateStr]) appData.logs[dateStr] = { taskProgress: {} };
    const log = appData.logs[dateStr];
    if (!log.taskProgress) log.taskProgress = {};

    const dateContext = {
        dayAbbrev: getDayOfWeekAbbrev(dateStr),
        hijriInfo: getHijriDateDetails(dateStr)
    };

    let addedAny = false;
    (appData.tasks || []).forEach(t => {
        if (t.isArchived) return;
        if (log.taskProgress[t.id]) return;

        const isScheduled = ScheduleEngine.isTaskScheduledForDate(t, dateStr, appData, 0, dateContext);
        if (isScheduled) {
            const normTarget = getTaskNormalizedTarget(t, dateStr);
            log.taskProgress[t.id] = {
                target: normTarget,
                achieved: 0,
                status: "scheduled",
                hours: 0,
                score: 0
            };
            addedAny = true;
        }
    });

    if (addedAny) {
        log._dirty = true;
        delete log.precomputedScore;
        delete log.totalHours;
    }

    return addedAny;
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
                const newLog = localLog
                    ? mergeDayLog(localLog, dayProgress)
                    : rowToLog(dayProgress);
                appData.logs[currentDateStr] = newLog;
            } else {
                // If the record of this day is not available, populate and save all its scheduled tasks
                populateDayTasksIfMissing(currentDateStr);
                pushDayToCloud(currentDateStr);
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
