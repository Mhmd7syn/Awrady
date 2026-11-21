/**
 * ============================================================================
 * AWRAD PRO - OFFLINE STORE & SYNC MANAGER (AppStore)
 * Manages local cache, dirty mutation queue, and Supabase cloud sync handoff.
 * ============================================================================
 */

(function(global) {
    "use strict";

    const STORAGE_KEY = (typeof APP_CONSTANTS !== "undefined" && APP_CONSTANTS.STORAGE_KEY) || "awrady_app_data_v2";

    // In-flight saving and queue flags
    const _isSavingDay = {};
    const _queuedSaveDay = {};
    const _lastSavedCloudTimestamp = {};
    const _dbCheckedDates = new Set();
    let _dbSaveTimer = null;

    function getActiveState() {
        if (typeof AppState !== "undefined" && AppState.getAppData) {
            return AppState.getAppData();
        }
        return global.appData || { tasks: [], logs: {} };
    }

    function getActiveDate() {
        if (typeof AppState !== "undefined" && AppState.getCurrentDate) {
            return AppState.getCurrentDate();
        }
        return global.currentDateStr || (typeof getLocalTodayString === "function" ? getLocalTodayString() : new Date().toISOString().slice(0, 10));
    }

    function safeUpdateCloudSyncUI(syncInfo) {
        if (typeof updateCloudSyncUI === "function") {
            try {
                updateCloudSyncUI(syncInfo);
            } catch (_) {}
        }
    }

    const AppStore = {
        /**
         * Computes user-scoped LocalStorage key
         */
        getUserStorageKey(username = null) {
            const u = (
                username ||
                global.awradyAPI?.currentUser ||
                (global.authManager && global.authManager.getCurrentUser()) ||
                "user"
            ).toLowerCase();
            return `${STORAGE_KEY}_${u}`;
        },

        /**
         * Loads cached data from LocalStorage into AppState
         */
        loadLocalState() {
            try {
                const appData = getActiveState();
                const userKey = this.getUserStorageKey();
                let localSaved = localStorage.getItem(userKey);

                // Seamless migration: If this user has no scoped data yet, adopt un-scoped guest data from this device
                if (!localSaved) {
                    const legacyGuestKey = `${STORAGE_KEY}_primary_user`;
                    const candidate = localStorage.getItem(legacyGuestKey) || localStorage.getItem(STORAGE_KEY);
                    if (candidate) {
                        try {
                            const parsedCandidate = JSON.parse(candidate);
                            if (parsedCandidate && ((parsedCandidate.tasks && parsedCandidate.tasks.length > 0) || (parsedCandidate.logs && Object.keys(parsedCandidate.logs).length > 0))) {
                                localSaved = candidate;
                                localStorage.setItem(userKey, candidate);
                                localStorage.removeItem(legacyGuestKey);
                                localStorage.removeItem(STORAGE_KEY);
                            }
                        } catch (_) {}
                    }
                }

                if (localSaved) {
                    const parsed = JSON.parse(localSaved);
                    if (parsed) {
                        appData.tasks = (parsed.tasks && parsed.tasks.length > 0) 
                            ? parsed.tasks 
                            : ((typeof DEFAULT_TASKS !== "undefined" && DEFAULT_TASKS.length > 0) ? JSON.parse(JSON.stringify(DEFAULT_TASKS)) : []);
                        appData.logs = parsed.logs || {};

                            // 1. Clean up any zero-progress false bonus entries from local store
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

                            // 2. Clean up any empty ghost logs from local store
                            for (const dateStr in appData.logs) {
                                const log = appData.logs[dateStr];
                                if (!log) {
                                    delete appData.logs[dateStr];
                                    continue;
                                }
                                const hasAchieved = log.taskProgress && Object.values(log.taskProgress).some(p => (Number(p?.achieved) || 0) > 0);
                                const hasScore = (Number(log.total_score) || 0) > 0 || (Number(log.precomputedScore) || 0) > 0;
                                const hasDisabled = Boolean(log.taskProgress && Object.values(log.taskProgress).some(p => p?.status === "disabled"));
                                const hasBonus = Boolean(log.taskProgress && Object.values(log.taskProgress).some(p => p?.status === "bonus" || p?._explicit));
                                const hasExtras = Boolean(log.prayerExtras && Object.values(log.prayerExtras).some(v => (Number(v?.nawafel) || 0) > 0 || Boolean(v?.azkar)));
                                const hasDirty = Boolean(log._dirty || (log._dirtyTasks && Object.keys(log._dirtyTasks).length > 0));

                                if (!hasAchieved && !hasScore && !hasDisabled && !hasBonus && !hasExtras && !hasDirty) {
                                    delete appData.logs[dateStr];
                                }
                            }
                    }

                    if (typeof AppState !== "undefined" && AppState.setAppData) {
                        AppState.setAppData(appData);
                    }
                } else {
                    appData.tasks = (typeof DEFAULT_TASKS !== "undefined" && DEFAULT_TASKS.length > 0)
                        ? JSON.parse(JSON.stringify(DEFAULT_TASKS))
                        : [];
                    appData.logs = {};
                    if (typeof AppState !== "undefined" && AppState.setAppData) {
                        AppState.setAppData(appData);
                    }
                }
            } catch (e) {
                console.error("[AppStore] LocalStorage error:", e);
            }
        },

        /**
         * Persists in-memory AppState to LocalStorage
         */
        saveLocalState() {
            try {
                const appData = getActiveState();
                localStorage.setItem(this.getUserStorageKey(), JSON.stringify(appData));
            } catch (e) {
                console.error("[AppStore] Save to LocalStorage failed:", e);
            }
        },

        /**
         * Resets local application data to default tasks
         */
        loadDefaultAppData() {
            const defaults = typeof DEFAULT_TASKS !== "undefined" ? JSON.parse(JSON.stringify(DEFAULT_TASKS)) : [];
            if (typeof AppState !== "undefined" && AppState.resetState) {
                AppState.resetState(defaults);
            } else {
                global.appData = {
                    tasks: defaults,
                    logs: {}
                };
            }
        },

        /**
         * Merges cloud daily_progress row with local log, protecting locally dirty tasks
         */
        mergeDayLog(localLog, cloudRow) {
            const cloudLog = typeof rowToLog === "function" ? rowToLog(cloudRow) : cloudRow;
            if (!localLog) return cloudLog;

            const dirtyTasks = localLog._dirtyTasks || {};
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
        },

        /**
         * Pushes day progress to Supabase and resolves dirty mutation states
         */
        async pushDayToCloud(dateStr) {
            if (!global.awradyAPI?.client) return;
            const appData = getActiveState();
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
                const hasBonus = Boolean(log.taskProgress && Object.values(log.taskProgress).some(p => p?.status === "bonus" || p?._explicit));
                const hasExtras = Boolean(log.prayerExtras && Object.values(log.prayerExtras).some(v => (Number(v?.nawafel) || 0) > 0 || Boolean(v?.azkar)));

                if (!hasDirtyTasks && !hasAchieved && !hasDisabled && !hasBonus && !hasExtras) {
                    log._dirty = false;
                    return;
                }

                const saveStartTime = Date.now();
                const snapshottedDirtyTasks = { ...(log._dirtyTasks || {}) };

                const prayerExtras = { ...(log.prayerExtras || {}) };
                delete prayerExtras._meta;

                if (!log.taskProgress) log.taskProgress = {};

                const dateContext = {
                    dayAbbrev: typeof getDayOfWeekAbbrev === "function" ? getDayOfWeekAbbrev(dateStr) : "",
                    hijriInfo: typeof getHijriDateDetails === "function" ? getHijriDateDetails(dateStr) : null
                };

                const taskProgress = {};

                (appData.tasks || []).forEach(t => {
                    if (t.isArchived) return;

                    const existing = log.taskProgress[t.id];
                    const val = Number(existing?.achieved) || 0;
                    const isDisabled = typeof ScheduleEngine !== "undefined" && ScheduleEngine.isTaskDisabledForDate(t, log, appData);
                    const isExplicitBonus = Boolean(t.isBonus || (existing?.status === "bonus" && (val > 0 || existing?._explicit)));
                    const isScheduled = typeof ScheduleEngine !== "undefined" && ScheduleEngine.isTaskScheduledForDate(t, dateStr, appData, val, dateContext);

                    if (isScheduled || isDisabled || isExplicitBonus || val > 0) {
                        const status = isDisabled ? "disabled" : ((isExplicitBonus || (!isScheduled && val > 0)) ? "bonus" : "scheduled");
                        const normTarget = (status === "bonus" || status === "disabled")
                            ? 0
                            : (typeof getTaskNormalizedTarget === "function" ? getTaskNormalizedTarget(t, dateStr) : (Number(t.target) || 1));

                        const { hours: _h, score: _s, ...cleanExisting } = existing || {};
                        taskProgress[t.id] = {
                            ...cleanExisting,
                            target: normTarget,
                            achieved: val,
                            status
                        };
                    }
                });

                log.taskProgress = taskProgress;

                const totalScore = typeof ScoringEngine !== "undefined" ? ScoringEngine.calculateDayScore(dateStr, appData, false) : 0;
                const totalHours = typeof ScoringEngine !== "undefined" ? ScoringEngine.calculateDayScore(dateStr, appData, true) : 0;

                const savedRow = await global.awradyAPI.saveDayProgress(dateStr, taskProgress, prayerExtras, { totalScore, totalHours });

                if (appData.logs?.[dateStr]) {
                    const currentLog = appData.logs[dateStr];
                    if (currentLog._dirtyTasks) {
                        for (const tid in snapshottedDirtyTasks) {
                            if (currentLog._dirtyTasks[tid] && currentLog._dirtyTasks[tid] <= (snapshottedDirtyTasks[tid] || saveStartTime)) {
                                delete currentLog._dirtyTasks[tid];
                            }
                        }
                    }
                    const hasRemainingDirtyTasks = currentLog._dirtyTasks && Object.keys(currentLog._dirtyTasks).length > 0;
                    currentLog._dirty = hasRemainingDirtyTasks;

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

                    this.saveLocalState();
                }

                safeUpdateCloudSyncUI({
                    state: "synced",
                    message: "متزامن سحابياً مع Supabase 24/7"
                });
            } catch (e) {
                console.warn("[AppStore] Save progress error for", dateStr, e.message);
                safeUpdateCloudSyncUI({
                    state: "offline",
                    message: "وضع عدم الاتصال (محفوظ محلياً)"
                });
            } finally {
                _isSavingDay[dateStr] = false;
                const stillDirty = Boolean(appData.logs?.[dateStr]?._dirty);
                if (_queuedSaveDay[dateStr] || stillDirty) {
                    _queuedSaveDay[dateStr] = false;
                    if (_dbSaveTimer) clearTimeout(_dbSaveTimer);
                    const debounceMs = (typeof APP_CONSTANTS !== "undefined" && APP_CONSTANTS.UI?.SAVE_DEBOUNCE_MS) || 2000;
                    _dbSaveTimer = setTimeout(() => this.pushDayToCloud(dateStr), debounceMs);
                }
            }
        },

        /**
         * Syncs all pending dirty dates to Supabase
         */
        async syncAllDirtyDays() {
            const appData = getActiveState();
            if (!global.awradyAPI?.client || !navigator.onLine || !appData.logs) return;
            const dirtyDates = Object.keys(appData.logs).filter(d => {
                const log = appData.logs[d];
                return Boolean(log && (log._dirty || (log._dirtyTasks && Object.keys(log._dirtyTasks).length > 0)));
            });
            for (const d of dirtyDates) {
                await this.pushDayToCloud(d);
            }
        },

        /**
         * High-level save coordinator: saves locally immediately and debounces cloud push
         */
        saveData(immediate = false, targetDate = null) {
            const curDate = targetDate || getActiveDate();
            const appData = getActiveState();
            const log = appData.logs?.[curDate];
            const hasActivity = Boolean(
                log && (
                    (log._dirtyTasks && Object.keys(log._dirtyTasks).length > 0) ||
                    (log.taskProgress && Object.values(log.taskProgress).some(p => (Number(p?.achieved) || 0) > 0 || p?.status === "disabled" || p?.status === "bonus" || p?._explicit)) ||
                    (log.prayerExtras && Object.values(log.prayerExtras).some(v => (Number(v?.nawafel) || 0) > 0 || Boolean(v?.azkar)))
                )
            );

            if (hasActivity && log) {
                log._dirty = true;
                delete log.precomputedScore;
                delete log.totalHours;
            }

            // 1. Offline resilient local backup
            this.saveLocalState();

            // 2. Direct database persistence via AwradyAPI
            if (global.awradyAPI?.client && hasActivity) {
                const executeDbSave = () => {
                    this.pushDayToCloud(curDate);
                };

                if (immediate) {
                    if (_dbSaveTimer) clearTimeout(_dbSaveTimer);
                    executeDbSave();
                } else {
                    if (_dbSaveTimer) clearTimeout(_dbSaveTimer);
                    const debounceMs = (typeof APP_CONSTANTS !== "undefined" && APP_CONSTANTS.UI?.SAVE_DEBOUNCE_MS) || 2000;
                    _dbSaveTimer = setTimeout(executeDbSave, debounceMs);
                }
            }
        },

        /**
         * Flush pending debounced saves immediately (e.g. before unload)
         */
        flush() {
            if (_dbSaveTimer) {
                clearTimeout(_dbSaveTimer);
                _dbSaveTimer = null;
            }
            this.saveData(true);
        },

        /**
         * Non-blocking background fetch for a specific date's progress
         */
        async fetchDayProgress(dateStr, onComplete = null) {
            if (!global.awradyAPI?.client || _dbCheckedDates.has(dateStr)) return;
            const appData = getActiveState();
            if (appData.logs?.[dateStr]?._loadedFromDB) return;

            _dbCheckedDates.add(dateStr);
            try {
                const dayProgress = await global.awradyAPI.getDayProgress(dateStr);
                if (!appData.logs) appData.logs = {};
                if (dayProgress) {
                    const localLog = appData.logs[dateStr];
                    appData.logs[dateStr] = localLog
                        ? this.mergeDayLog(localLog, dayProgress)
                        : (typeof rowToLog === "function" ? rowToLog(dayProgress) : dayProgress);

                    if (typeof onComplete === "function") {
                        onComplete(appData.logs[dateStr]);
                    }
                } else if (appData.logs[dateStr]) {
                    appData.logs[dateStr]._loadedFromDB = true;
                }
            } catch (_) {}
        },

        /**
         * Initialize data lifecycle: LocalStorage -> Supabase Cloud Fetch -> Realtime
         */
        async initData() {
            const appData = getActiveState();

            // 1. ALWAYS load local storage first (instant UI + preserve offline changes)
            this.loadLocalState();

            // 2. Attempt cloud fetch & merge via direct Supabase API
            if (global.awradyAPI && global.awradyAPI.init()) {
                try {
                    const results = await Promise.allSettled([
                        global.awradyAPI.getTasks(true),
                        global.awradyAPI.getAllProgress()
                    ]);

                    const tasks = results[0].status === "fulfilled" ? results[0].value : null;
                    const allProgress = results[1].status === "fulfilled" ? results[1].value : null;

                    if (tasks && tasks.length > 0) {
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
                            localNewTasks.forEach(t => global.awradyAPI.saveTask(t).catch(() => {}));
                        }
                    } else if (tasks && tasks.length === 0 && appData.tasks && appData.tasks.length > 0) {
                        await global.awradyAPI.saveTasks(appData.tasks).catch(() => {});
                    }

                    if (!appData.logs) appData.logs = {};

                    if (allProgress && allProgress.length > 0) {
                        allProgress.forEach(row => {
                            const tp = row.task_progress || {};
                            const pe = row.prayer_extras || {};
                            const hasAchieved = Object.values(tp).some(p => (Number(p?.achieved) || 0) > 0);
                            const hasDisabled = Object.values(tp).some(p => p?.status === "disabled");
                            const hasBonus = Object.values(tp).some(p => p?.status === "bonus" || p?._explicit);
                            const hasExtras = Object.values(pe).some(v => (Number(v?.nawafel) || 0) > 0 || Boolean(v?.azkar));
                            const hasScore = (Number(row.total_score) || 0) > 0 || (Number(row.total_hours) || 0) > 0;

                            if (hasAchieved || hasDisabled || hasBonus || hasExtras || hasScore) {
                                const localLog = appData.logs[row.date];
                                appData.logs[row.date] = localLog ? this.mergeDayLog(localLog, row) : (typeof rowToLog === "function" ? rowToLog(row) : row);
                            }
                        });
                    } else if (allProgress && allProgress.length === 0 && appData.logs && Object.keys(appData.logs).length > 0) {
                        for (const dateStr in appData.logs) {
                            const log = appData.logs[dateStr];
                            if (log && ((log.precomputedScore || 0) > 0 || Object.keys(log.taskProgress || {}).length > 0)) {
                                this.pushDayToCloud(dateStr);
                            }
                        }
                    }

                    // Sync all dirty/pending offline days up to Supabase now that we are connected
                    this.syncAllDirtyDays().catch(() => {});

                    // Seed default tasks to Supabase if database has 0 tasks
                    if ((!appData.tasks || appData.tasks.length === 0) && typeof DEFAULT_TASKS !== "undefined" && DEFAULT_TASKS.length > 0) {
                        appData.tasks = JSON.parse(JSON.stringify(DEFAULT_TASKS));
                        for (const t of appData.tasks) {
                            await global.awradyAPI.saveTask(t).catch(e => console.warn("[AppStore] Seed task error:", e.message));
                        }
                    }

                    // Realtime WebSocket subscription
                    global.awradyAPI.onUpdate((table, payload) => {
                        const curDate = getActiveDate();
                        const tblProgress = (typeof APP_CONSTANTS !== "undefined" && APP_CONSTANTS.DB?.TABLES?.PROGRESS) || "daily_progress";
                        const tblTasks = (typeof APP_CONSTANTS !== "undefined" && APP_CONSTANTS.DB?.TABLES?.TASKS) || "tasks";

                        if (table === tblProgress && payload.new?.date === curDate) {
                            const row = payload.new;
                            if (!appData.logs) appData.logs = {};
                            const currentLog = appData.logs[curDate];
                            const hasDirty = Boolean(currentLog && (currentLog._dirty || (currentLog._dirtyTasks && Object.keys(currentLog._dirtyTasks).length > 0)));

                            const rowUpdatedAt = row.updated_at ? new Date(row.updated_at).getTime() : 0;
                            if (!hasDirty && _lastSavedCloudTimestamp[curDate] && Math.abs(rowUpdatedAt - _lastSavedCloudTimestamp[curDate]) < 2000) {
                                return;
                            }

                            appData.logs[curDate] = hasDirty
                                ? this.mergeDayLog(currentLog, row)
                                : (typeof rowToLog === "function" ? rowToLog(row) : row);

                            if (typeof renderDailyView === "function") renderDailyView();
                            if (typeof updateHeaderTodayScore === "function") updateHeaderTodayScore();
                        } else if (table === tblTasks) {
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
                            if (typeof renderDailyView === "function") renderDailyView();
                        }
                    });

                    safeUpdateCloudSyncUI({
                        state: navigator.onLine ? "synced" : "offline",
                        message: navigator.onLine ? "متزامن سحابياً مع Supabase 24/7" : "وضع عدم الاتصال"
                    });
                } catch (err) {
                    console.warn("[AppStore] Supabase initialization fallback:", err.message);
                    safeUpdateCloudSyncUI({
                        state: "offline",
                        message: "وضع عدم الاتصال (محفوظ محلياً)"
                    });
                }
            }

            // 3. Fallback defaults if still empty
            if (!appData.tasks || appData.tasks.length === 0) {
                if (typeof DEFAULT_TASKS !== "undefined") {
                    appData.tasks = JSON.parse(JSON.stringify(DEFAULT_TASKS));
                }
            }

            if (typeof AppState !== "undefined" && AppState.setAppData) {
                AppState.setAppData(appData);
            }
            this.saveLocalState();
            if (typeof renderDailyView === "function") renderDailyView();
            if (typeof updateHeaderTodayScore === "function") updateHeaderTodayScore();
        }
    };

    // Expose backwards-compatible globals
    global.AppStore = AppStore;
    global.getUserStorageKey = (u) => AppStore.getUserStorageKey(u);
    global.loadLocalState = () => AppStore.loadLocalState();
    global.saveData = (immediate, targetDate) => AppStore.saveData(immediate, targetDate);
    global.pushDayToCloud = (d) => AppStore.pushDayToCloud(d);
    global.syncAllDirtyDays = () => AppStore.syncAllDirtyDays();
    global.loadDefaultAppData = () => AppStore.loadDefaultAppData();
    global.initData = () => AppStore.initData();

})(typeof window !== "undefined" ? window : globalThis);
