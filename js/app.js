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
let chartInstance = null;

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
        window.awradyAPI.setCurrentUser(username);
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
    const container = document.getElementById("daily-tasks-grid");
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
                if (parsed.logs) {
                    appData.logs = parsed.logs;
                    // Clean up any zero-progress false bonus entries from local store
                    for (const dateStr in appData.logs) {
                        const log = appData.logs[dateStr];
                        if (log?.taskProgress) {
                            for (const tid in log.taskProgress) {
                                const tp = log.taskProgress[tid];
                                if (tp?.status === "bonus" && (Number(tp?.achieved) || 0) <= 0 && !tp?._explicit) {
                                    const task = (appData.tasks || []).find(t => t.id === tid);
                                    if (task && !task.isBonus) {
                                        delete log.taskProgress[tid];
                                    }
                                }
                            }
                        }
                    }
                    // Clean up any empty ghost logs from local store
                    for (const dateStr in appData.logs) {
                        const log = appData.logs[dateStr];
                        if (!log) {
                            delete appData.logs[dateStr];
                            continue;
                        }
                        const hasAchieved = log.taskProgress && Object.values(log.taskProgress).some(p => (Number(p?.achieved) || 0) > 0);
                        const hasScore = (Number(log.total_score) || 0) > 0 || (Number(log.precomputedScore) || 0) > 0;
                        const hasDisabled = Boolean(log.taskProgress && Object.values(log.taskProgress).some(p => p?.status === "disabled"));
                        const hasExtras = Boolean(log.prayerExtras && Object.keys(log.prayerExtras).some(k => k !== "_meta"));
                        const hasDirty = Boolean(log._dirty || (log._dirtyTasks && Object.keys(log._dirtyTasks).length > 0));

                        if (!hasAchieved && !hasScore && !hasDisabled && !hasExtras && !hasDirty) {
                            delete appData.logs[dateStr];
                        }
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
        const hasDirtyTasks = Boolean(log._dirtyTasks && Object.keys(log._dirtyTasks).length > 0);
        const hasAchieved = Boolean(log.taskProgress && Object.values(log.taskProgress).some(p => (Number(p?.achieved) || 0) > 0));
        const hasDisabled = Boolean(log.taskProgress && Object.values(log.taskProgress).some(p => p?.status === "disabled"));
        const hasExtras = Boolean(log.prayerExtras && Object.keys(log.prayerExtras).some(k => k !== "_meta"));

        if (!hasDirtyTasks && !hasAchieved && !hasDisabled && !hasExtras) {
            log._dirty = false;
            return;
        }

        const saveStartTime = Date.now();
        const snapshottedDirtyTasks = { ...(log._dirtyTasks || {}) };

        const prayerExtras = { ...(log.prayerExtras || {}) };
        delete prayerExtras._meta;

        if (!log.taskProgress) log.taskProgress = {};

        const dateContext = {
            dayAbbrev: getDayOfWeekAbbrev(dateStr),
            hijriInfo: getHijriDateDetails(dateStr)
        };

        // Populate taskProgress: scheduled tasks for this day + dirty tasks + explicit bonus or disabled
        const taskProgress = {};

        (appData.tasks || []).forEach(t => {
            if (t.isArchived) return;

            const existing = log.taskProgress[t.id];
            const val = Number(existing?.achieved) || 0;
            const isDisabled = ScheduleEngine.isTaskDisabledForDate(t, log, appData);
            const isExplicitBonus = Boolean(t.isBonus || (existing?.status === "bonus" && (val > 0 || existing?._explicit)));
            const isScheduled = ScheduleEngine.isTaskScheduledForDate(t, dateStr, appData, val, dateContext);

            // Add ONLY scheduled tasks of this day, disabled tasks, or bonus tasks with val > 0 / explicit
            if (isScheduled || isDisabled || isExplicitBonus || val > 0) {
                const status = isDisabled ? "disabled" : ((isExplicitBonus || (!isScheduled && val > 0)) ? "bonus" : "scheduled");
                const normTarget = (status === "bonus" || status === "disabled")
                    ? 0
                    : getTaskNormalizedTarget(t, dateStr);

                const { hours: _h, score: _s, ...cleanExisting } = existing || {};
                taskProgress[t.id] = {
                    ...cleanExisting,
                    target: normTarget,
                    achieved: val,
                    status
                };
            }
        });

        // Set local log.taskProgress directly to taskProgress so un-scheduled items are pruned
        log.taskProgress = taskProgress;

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
        return Boolean(log && (log._dirty || (log._dirtyTasks && Object.keys(log._dirtyTasks).length > 0)));
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
                // Preserve local dailyTargets if server didn't return them (e.g. column not yet in remote DB)
                const localDailyMap = {};
                (appData.tasks || []).forEach(t => {
                    if (t.dailyTargets && Object.keys(t.dailyTargets).length > 0) {
                        localDailyMap[t.id] = t.dailyTargets;
                    }
                });
                try {
                    const backupMap = JSON.parse(localStorage.getItem("awrady_tasks_daily_targets") || "{}");
                    Object.assign(localDailyMap, backupMap);
                } catch (_) {}

                tasks.forEach(t => {
                    if ((!t.dailyTargets || Object.keys(t.dailyTargets).length === 0) && localDailyMap[t.id]) {
                        t.dailyTargets = localDailyMap[t.id];
                    }
                });

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
                    const hasDirty = Boolean(currentLog && (currentLog._dirty || (currentLog._dirtyTasks && Object.keys(currentLog._dirtyTasks).length > 0)));

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
                        if (row.daily_targets) {
                            fields.dailyTargets = row.daily_targets;
                        }
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

function saveData(immediate = false, targetDate = null) {
    const curDate = targetDate || currentDateStr;
    const log = appData.logs?.[curDate];
    const hasActivity = Boolean(
        log && (
            (log._dirtyTasks && Object.keys(log._dirtyTasks).length > 0) ||
            (log.taskProgress && Object.values(log.taskProgress).some(p => (Number(p?.achieved) || 0) > 0 || p?.status === "disabled")) ||
            (log.prayerExtras && Object.keys(log.prayerExtras).some(k => k !== "_meta"))
        )
    );

    if (hasActivity) {
        log._dirty = true;
        delete log.precomputedScore;
        delete log.totalHours;
    }

    // 1. Offline resilient local backup
    try {
        localStorage.setItem(getUserStorageKey(), JSON.stringify(appData));
        if ((window.awradyAPI?.currentUser || "").toLowerCase() === APP_CONSTANTS.GUEST_USER) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
        }
    } catch (_) {}

    // 2. Direct database persistence via AwradyAPI
    if (window.awradyAPI?.client && hasActivity) {
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
}

async function switchActiveDate(newDate) {
    if (!newDate || newDate === currentDateStr) return;
    currentDateStr = newDate;
    const datePicker = document.getElementById("date-picker-input");
    if (datePicker) datePicker.value = currentDateStr;

    // 1. Instant optimistic render (0ms response)
    renderDailyView();

    // 2. Non-blocking cloud fetch in background
    if (window.awradyAPI?.client && (!appData.logs[currentDateStr] || !appData.logs[currentDateStr]._loadedFromDB)) {
        const targetDate = currentDateStr;
        try {
            const dayProgress = await window.awradyAPI.getDayProgress(targetDate);
            if (!appData.logs) appData.logs = {};
            if (dayProgress) {
                const localLog = appData.logs[targetDate];
                appData.logs[targetDate] = localLog
                    ? mergeDayLog(localLog, dayProgress)
                    : rowToLog(dayProgress);
            } else {
                if (!appData.logs[targetDate]) {
                    appData.logs[targetDate] = { taskProgress: {}, prayerExtras: {}, _loadedFromDB: true };
                } else {
                    appData.logs[targetDate]._loadedFromDB = true;
                }
            }

            // Re-render only if the user is still viewing this date
            if (currentDateStr === targetDate) {
                renderDailyView();
            }
        } catch (_) {}
    }
}

function setupDailyControls() {
    const datePicker = document.getElementById("date-picker-input");
    const dateDisplay = document.getElementById("current-date-display");

    const openDatePicker = () => {
        if (!datePicker) return;
        try {
            if (typeof datePicker.showPicker === "function") {
                datePicker.showPicker();
            } else {
                datePicker.focus();
            }
        } catch (_) {
            datePicker.focus();
        }
    };

    if (datePicker) {
        datePicker.value = currentDateStr;
        datePicker.addEventListener("change", (e) => {
            if (e.target.value) {
                switchActiveDate(e.target.value);
            } else {
                datePicker.value = currentDateStr;
            }
        });
        datePicker.addEventListener("click", () => {
            openDatePicker();
        });
    }

    if (dateDisplay) {
        dateDisplay.addEventListener("click", (e) => {
            if (e.target !== datePicker) {
                openDatePicker();
            }
        });
        dateDisplay.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openDatePicker();
            }
        });
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
function calculateDayScore(dateStr, appDataRef = null, returnHours = false) {
    return ScoringEngine.calculateDayScore(dateStr, appDataRef || appData, returnHours);
}

if (typeof window !== "undefined") {
    window.renderDailyView = renderDailyView;
    window.switchActiveDate = switchActiveDate;
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
