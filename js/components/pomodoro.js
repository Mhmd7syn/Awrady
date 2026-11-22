/**
 * Awrady Dashboard - Pomodoro Focus Timer Component
 * Ultra-simple, robust, and bug-free focus timer engine.
 */

import { APP_CONSTANTS } from '../config/constants.js';
import { isTimeTask, getTaskUnit } from '../core/task-rules.js';
import { ScheduleEngine } from '../core/schedule-engine.js';
import { AppState } from '../core/state.js';
import { saveData } from '../core/store.js';
import {
    ensureAudioUnlocked,
    startAudioKeepalive,
    stopAudioKeepalive,
    requestPomoNotificationPermission,
    restoreDocumentTitle,
    dispatchSystemNotification,
    dispatchFiveMinuteWarning,
    startTitleBlinking,
    stopTitleBlinking,
    playPomoAlarm
} from './pomodoro-alerts.js';

const PomodoroTimer = {
    mode: "work", // 'work' | 'rest'
    isRunning: false,
    totalSeconds: APP_CONSTANTS.POMODORO_DEFAULTS.WORK_MINUTES * 60,
    remainingSeconds: APP_CONSTANTS.POMODORO_DEFAULTS.WORK_MINUTES * 60,
    lastSavedRemainingSeconds: APP_CONSTANTS.POMODORO_DEFAULTS.WORK_MINUTES * 60,
    targetEndTime: null,
    intervalId: null,
    taskId: null,
    taskName: "",
    workMinutes: APP_CONSTANTS.POMODORO_DEFAULTS.WORK_MINUTES,
    defaultWorkMinutes: APP_CONSTANTS.POMODORO_DEFAULTS.WORK_MINUTES,
    restMinutes: APP_CONSTANTS.POMODORO_DEFAULTS.REST_MINUTES,
    originalTitle: "",
    audioContext: null,
    keepAliveNode: null,
    worker: null,
    titleBlinkInterval: null,
    hasFiredFiveMinWarning: false
};

/**
 * Get active application dataset with safe fallbacks
 */
function getActiveAppData() {
    return (typeof window !== "undefined" && window.appData) ? window.appData : null;
}

/**
 * Safe gesture audio unlock for restored sessions
 */
let gestureUnlockRegistered = false;
let gestureUnlockHandler = null;

function registerGestureAudioUnlock() {
    if (gestureUnlockRegistered) return;
    gestureUnlockRegistered = true;

    gestureUnlockHandler = (e) => {
        if (e && !e.isTrusted) return;
        cleanupGestureAudioUnlock();
        ensureAudioUnlocked(e);
        if (PomodoroTimer.isRunning && !PomodoroTimer.keepAliveNode) {
            startAudioKeepalive();
        }
    };

    document.addEventListener("pointerdown", gestureUnlockHandler, { capture: true, once: true });
    document.addEventListener("click", gestureUnlockHandler, { capture: true, once: true });
    document.addEventListener("keydown", gestureUnlockHandler, { capture: true, once: true });
}

function cleanupGestureAudioUnlock() {
    if (!gestureUnlockRegistered) return;
    if (gestureUnlockHandler) {
        document.removeEventListener("pointerdown", gestureUnlockHandler, true);
        document.removeEventListener("click", gestureUnlockHandler, true);
        document.removeEventListener("keydown", gestureUnlockHandler, true);
        gestureUnlockHandler = null;
    }
    gestureUnlockRegistered = false;
}

/**
 * Initialize DOM listeners for Pomodoro controls
 */
let pomoControlsInitialized = false;
function setupPomodoroControls() {
    if (pomoControlsInitialized) {
        populatePomoTaskSelect();
        updatePomoTaskHeader();
        return;
    }
    pomoControlsInitialized = true;

    PomodoroTimer.originalTitle = document.title || "أورادي";

    const btnStart = document.getElementById("btn-pomo-start");
    const btnPause = document.getElementById("btn-pomo-pause");
    const btnClose = document.getElementById("btn-close-pomodoro");

    if (btnStart) {
        btnStart.addEventListener("click", (e) => {
            ensureAudioUnlocked(e);
            startPomoTimer();
        });
    }
    if (btnPause) {
        btnPause.addEventListener("click", () => {
            pausePomoTimer();
        });
    }
    if (btnClose) btnClose.addEventListener("click", closePomodoroModal);

    const btnTabWork = document.getElementById("btn-pomo-work");
    const btnTabRest = document.getElementById("btn-pomo-rest");

    if (btnTabWork) {
        btnTabWork.addEventListener("click", () => {
            setPomoMode("work");
        });
    }
    if (btnTabRest) {
        btnTabRest.addEventListener("click", () => {
            setPomoMode("rest");
        });
    }

    const taskSelect = document.getElementById("pomo-task-select");
    if (taskSelect) {
        taskSelect.addEventListener("change", (e) => {
            const val = e.target.value;
            if (val) {
                PomodoroTimer.taskId = val;
                const opt = e.target.options[e.target.selectedIndex];
                PomodoroTimer.taskName = opt ? (opt.getAttribute("data-name") || opt.textContent.replace(/^⏱️\s*/, "")) : "";
                
                // Adapt duration for selected task if timer is idle
                if (!PomodoroTimer.isRunning) {
                    const appData = getActiveAppData();
                    const task = appData?.tasks?.find(t => String(t.id) === String(val));
                    if (task) {
                        adaptWorkDurationForTask(task);
                    }
                }
            } else {
                PomodoroTimer.taskId = null;
                PomodoroTimer.taskName = "";
                // Restore user default when general session is selected
                if (!PomodoroTimer.isRunning && PomodoroTimer.defaultWorkMinutes) {
                    setSessionWorkMinutes(PomodoroTimer.defaultWorkMinutes);
                }
            }
            updatePomoTaskHeader();
            savePomoState();
        });
    }

    const workInput = document.getElementById("input-pomo-work-time");
    const restInput = document.getElementById("input-pomo-rest-time");

    const onWorkInputChange = () => {
        const maxLimit = (typeof APP_CONSTANTS !== "undefined" && APP_CONSTANTS?.LIMITS?.POMO_WORK_MAX)
            ? APP_CONSTANTS.LIMITS.POMO_WORK_MAX
            : 720;
        const val = Math.max(1, Math.min(maxLimit, parseInt(workInput.value, 10) || 25));
        PomodoroTimer.workMinutes = val;
        PomodoroTimer.defaultWorkMinutes = val;
        if (PomodoroTimer.mode === "work" && !PomodoroTimer.isRunning) {
            resetPomoTimer();
        } else {
            savePomoState();
        }
    };

    const onRestInputChange = () => {
        const maxLimit = (typeof APP_CONSTANTS !== "undefined" && APP_CONSTANTS?.LIMITS?.POMO_REST_MAX)
            ? APP_CONSTANTS.LIMITS.POMO_REST_MAX
            : 180;
        const val = Math.max(1, Math.min(maxLimit, parseInt(restInput.value, 10) || 5));
        PomodoroTimer.restMinutes = val;
        if (PomodoroTimer.mode === "rest" && !PomodoroTimer.isRunning) {
            resetPomoTimer();
        } else {
            savePomoState();
        }
    };

    if (workInput) {
        workInput.addEventListener("input", onWorkInputChange);
        workInput.addEventListener("change", onWorkInputChange);
    }

    if (restInput) {
        restInput.addEventListener("input", onRestInputChange);
        restInput.addEventListener("change", onRestInputChange);
    }

    // Auto-sync immediately whenever tab visibility changes
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            stopTitleBlinking();
            if (PomodoroTimer.isRunning) {
                syncPomoTimer();
            }
        }
    });

    // Request notification permission smoothly if not already decided
    if (typeof requestPomoNotificationPermission === "function") {
        requestPomoNotificationPermission();
    }

    loadPomoState();
}

/**
 * Update the header display indicating active task
 */
function updatePomoTaskHeader() {
    const nameEl = document.getElementById("pomodoro-task-name");
    if (!nameEl) return;
    if (PomodoroTimer.taskName) {
        nameEl.textContent = `🎯 المهمة: ${PomodoroTimer.taskName}`;
    } else {
        nameEl.textContent = "🎯 جلسة تركيز عامة (بدون تحديد مهمة)";
    }
}

/**
 * Populate task dropdown with time-based tasks scheduled for today
 */
function populatePomoTaskSelect() {
    const select = document.getElementById("pomo-task-select");
    if (!select) return;

    select.innerHTML = '<option value="">🎯 جلسة تركيز عامة (بدون تحديد مهمة)</option>';

    const appData = getActiveAppData();

    if (appData && Array.isArray(appData.tasks)) {
        const curDate = AppState.getCurrentDate() || (typeof currentDateStr !== "undefined" ? currentDateStr : new Date().toISOString().slice(0, 10));

        // Filter: ONLY non-archived tasks that have a time unit
        const allTimeTasks = appData.tasks.filter(t => !t.isArchived && isTimeTask(t));

        const todayTimeTasks = [];
        const otherTimeTasks = [];

        allTimeTasks.forEach(t => {
            const isDisabled = ScheduleEngine.isTaskDisabledForDate(t, curDate, appData);
            if (isDisabled) return;

            const isSched = ScheduleEngine.isTaskScheduledForDate(t, curDate, appData);
            const progress = appData.logs?.[curDate]?.taskProgress?.[t.id];
            const hasLoggedToday = Boolean(Number(progress?.achieved) > 0);
            const isExplicitToday = progress?.status === "scheduled" || progress?.status === "bonus";

            if (isSched || hasLoggedToday || isExplicitToday) {
                todayTimeTasks.push(t);
            } else {
                otherTimeTasks.push(t);
            }
        });

        // Ensure currently active Pomodoro task is retained in list if it has a time unit
        if (PomodoroTimer.taskId) {
            const currentTask = appData.tasks.find(t => String(t.id) === String(PomodoroTimer.taskId));
            if (currentTask && isTimeTask(currentTask) && !todayTimeTasks.some(t => String(t.id) === String(currentTask.id)) && !otherTimeTasks.some(t => String(t.id) === String(currentTask.id))) {
                todayTimeTasks.unshift(currentTask);
            }
        }

        const appendTaskOption = (t, parentGroup) => {
            const opt = document.createElement("option");
            opt.value = t.id;
            opt.setAttribute("data-name", t.name);
            const unit = getTaskUnit(t) || "ساعة";
            const catInfo = t.subcategory ? `${t.category} - ${t.subcategory}` : (t.category && t.category !== t.name ? t.category : "");
            opt.textContent = `${t.name}${catInfo ? ` (${catInfo})` : ''} - ${unit}`;
            if (PomodoroTimer.taskId && String(PomodoroTimer.taskId) === String(t.id)) {
                opt.selected = true;
            }
            parentGroup.appendChild(opt);
        };

        if (todayTimeTasks.length > 0) {
            const groupToday = document.createElement("optgroup");
            groupToday.label = "⏱️ مهام الوقت المجدولة لليوم";
            todayTimeTasks.forEach(t => appendTaskOption(t, groupToday));
            select.appendChild(groupToday);
        }

        if (otherTimeTasks.length > 0) {
            const groupOther = document.createElement("optgroup");
            groupOther.label = "⏱️ بقية مهام الوقت";
            otherTimeTasks.forEach(t => appendTaskOption(t, groupOther));
            select.appendChild(groupOther);
        }

        if (allTimeTasks.length === 0) {
            const emptyOpt = document.createElement("option");
            emptyOpt.value = "";
            emptyOpt.disabled = true;
            emptyOpt.textContent = "لا توجد مهام وقت متوفرة";
            select.appendChild(emptyOpt);
        }
    }

    if (!PomodoroTimer.taskId) {
        select.value = "";
    }
}

/**
 * Adapts work duration to the remaining time of a time-based task.
 * If remaining time is <= 0 or >= default cached duration, retains cached default.
 * If remaining time is > 0 and < default cached duration, sets duration to remaining minutes.
 * Does not overwrite the user's permanent defaultWorkMinutes.
 */
function adaptWorkDurationForTask(task) {
    const defaultMinutes = PomodoroTimer.defaultWorkMinutes || PomodoroTimer.workMinutes || APP_CONSTANTS.POMODORO_DEFAULTS.WORK_MINUTES;

    if (!task) {
        setSessionWorkMinutes(defaultMinutes);
        return;
    }

    const isTime = typeof isTimeTask === "function" ? isTimeTask(task) : false;
    if (!isTime) {
        setSessionWorkMinutes(defaultMinutes);
        return;
    }

    const appData = getActiveAppData();
    const curDate = (typeof currentDateStr !== "undefined")
        ? currentDateStr
        : (typeof getLocalTodayString === "function" ? getLocalTodayString() : new Date().toISOString().slice(0, 10));

    const normTarget = (typeof getTaskNormalizedTarget === "function")
        ? getTaskNormalizedTarget(task, curDate)
        : (Number(task.target) || 0) * 60;

    const val = Number(appData?.logs?.[curDate]?.taskProgress?.[task.id]?.achieved) || 0;
    const remaining = normTarget - val;

    let targetDuration = defaultMinutes;
    if (remaining > 0 && remaining < defaultMinutes) {
        targetDuration = Math.round(remaining);
    } else {
        targetDuration = defaultMinutes;
    }

    setSessionWorkMinutes(targetDuration);
}

/**
 * Sets session work minutes directly without overwriting the user's default setting
 */
function setSessionWorkMinutes(minutes) {
    const maxLimit = (typeof APP_CONSTANTS !== "undefined" && APP_CONSTANTS?.LIMITS?.POMO_WORK_MAX)
        ? APP_CONSTANTS.LIMITS.POMO_WORK_MAX
        : 720;
    const cleanMin = Math.max(1, Math.min(maxLimit, Math.round(minutes)));
    PomodoroTimer.workMinutes = cleanMin;
    const workInput = document.getElementById("input-pomo-work-time");
    if (workInput) workInput.value = cleanMin;

    if (PomodoroTimer.mode === "work" && !PomodoroTimer.isRunning) {
        resetPomoTimer();
    } else {
        savePomoState();
    }
}

/**
 * Open Pomodoro Modal
 */
function openPomodoroModal(taskId = null, taskName = "") {
    if (taskId !== null && taskId !== undefined) {
        PomodoroTimer.taskId = String(taskId);
        PomodoroTimer.taskName = taskName || "";
        
        // Find task from appData if not provided
        const appData = getActiveAppData();
        let targetTask = null;
        if (appData && Array.isArray(appData.tasks)) {
            targetTask = appData.tasks.find(t => String(t.id) === String(taskId));
            if (targetTask && !PomodoroTimer.taskName) {
                PomodoroTimer.taskName = targetTask.name;
            }
        }

        // Adapt duration if timer is currently idle
        if (!PomodoroTimer.isRunning && targetTask) {
            adaptWorkDurationForTask(targetTask);
        }
    }

    populatePomoTaskSelect();
    updatePomoTaskHeader();

    const modal = document.getElementById("pomodoro-modal");
    if (modal) modal.classList.remove("hidden");
}

/**
 * Close Pomodoro Modal
 */
function closePomodoroModal() {
    const modal = document.getElementById("pomodoro-modal");
    if (modal) modal.classList.add("hidden");
}

/**
 * Update UI for Work vs Rest mode tabs
 */
function updatePomoModeUI(mode) {
    PomodoroTimer.mode = mode;
    const btnWork = document.getElementById("btn-pomo-work");
    const btnRest = document.getElementById("btn-pomo-rest");

    if (mode === "work") {
        if (btnWork) {
            btnWork.classList.add("active");
            btnWork.classList.replace("btn-secondary", "btn-primary");
        }
        if (btnRest) {
            btnRest.classList.remove("active");
            btnRest.classList.replace("btn-primary", "btn-secondary");
        }
    } else {
        if (btnRest) {
            btnRest.classList.add("active");
            btnRest.classList.replace("btn-secondary", "btn-primary");
        }
        if (btnWork) {
            btnWork.classList.remove("active");
            btnWork.classList.replace("btn-primary", "btn-secondary");
        }
    }
}

/**
 * Switch mode (Work / Rest), committing any uncommitted work minutes cleanly
 */
function setPomoMode(mode) {
    if (PomodoroTimer.mode === mode) return;

    if (PomodoroTimer.mode === "work") {
        const lastSaved = typeof PomodoroTimer.lastSavedRemainingSeconds === "number" ? PomodoroTimer.lastSavedRemainingSeconds : PomodoroTimer.totalSeconds;
        const uncommittedSecs = lastSaved - PomodoroTimer.remainingSeconds;
        const uncommittedMins = Math.floor(uncommittedSecs / 60);
        if (uncommittedMins > 0) {
            commitWorkMinutesToDisk(uncommittedMins);
        }
    }

    updatePomoModeUI(mode);
    resetPomoTimer();
}

/**
 * Dedicated inline Web Worker for accurate background clocking
 */
function getPomoWorker() {
    if (PomodoroTimer.worker) return PomodoroTimer.worker;
    if (typeof Worker === "undefined") return null;

    try {
        const workerBlob = new Blob([`
            let tickId = null;
            self.onmessage = function(e) {
                if (!e.data) return;
                if (e.data.action === "start") {
                    if (tickId) clearInterval(tickId);
                    tickId = setInterval(function() {
                        self.postMessage({ type: "tick", now: Date.now() });
                    }, 1000);
                } else if (e.data.action === "stop") {
                    if (tickId) clearInterval(tickId);
                    tickId = null;
                }
            };
        `], { type: "application/javascript" });

        const workerUrl = URL.createObjectURL(workerBlob);
        const worker = new Worker(workerUrl);

        worker.onmessage = function(e) {
            if (e.data && e.data.type === "tick") {
                if (PomodoroTimer.isRunning) {
                    syncPomoTimer();
                }
            }
        };

        PomodoroTimer.worker = worker;
        return worker;
    } catch (e) {
        console.warn("[Pomodoro] Web worker fallback:", e);
        return null;
    }
}

function startWorkerTicker() {
    const worker = getPomoWorker();
    if (worker) {
        try {
            worker.postMessage({ action: "start" });
        } catch (e) {}
    }
}

function stopWorkerTicker() {
    if (PomodoroTimer.worker) {
        try {
            PomodoroTimer.worker.postMessage({ action: "stop" });
        } catch (e) {}
    }
}

/**
 * Start the countdown timer
 */
function startPomoTimer() {
    if (PomodoroTimer.isRunning) return;

    cleanupGestureAudioUnlock();

    // 1. Immediately unlock audio context on this click gesture
    ensureAudioUnlocked();

    // 2. Request notification permission if not yet decided
    if (typeof requestPomoNotificationPermission === "function") {
        requestPomoNotificationPermission();
    }

    // 3. Read current settings
    readDurationInputs();

    if (PomodoroTimer.remainingSeconds <= 0) {
        PomodoroTimer.totalSeconds = (PomodoroTimer.mode === "work" ? PomodoroTimer.workMinutes : PomodoroTimer.restMinutes) * 60;
        PomodoroTimer.remainingSeconds = PomodoroTimer.totalSeconds;
        PomodoroTimer.lastSavedRemainingSeconds = PomodoroTimer.totalSeconds;
        PomodoroTimer.hasFiredFiveMinWarning = false;
    } else if (typeof PomodoroTimer.lastSavedRemainingSeconds !== "number") {
        PomodoroTimer.lastSavedRemainingSeconds = PomodoroTimer.remainingSeconds;
    }

    PomodoroTimer.isRunning = true;
    PomodoroTimer.targetEndTime = Date.now() + (PomodoroTimer.remainingSeconds * 1000);

    stopTitleBlinking();

    // 4. Start background anti-throttling defenses
    startAudioKeepalive();
    startWorkerTicker();

    // 5. Main thread interval fallback (1 second tick for minimal CPU)
    if (PomodoroTimer.intervalId) clearInterval(PomodoroTimer.intervalId);
    PomodoroTimer.intervalId = setInterval(syncPomoTimer, 1000);

    // Toggle button visibility
    const btnStart = document.getElementById("btn-pomo-start");
    const btnPause = document.getElementById("btn-pomo-pause");
    if (btnStart) btnStart.classList.add("hidden");
    if (btnPause) btnPause.classList.remove("hidden");

    savePomoState();
    syncPomoTimer();
}

/**
 * Sync timer countdown on every interval tick
 */
function syncPomoTimer() {
    if (!PomodoroTimer.isRunning || !PomodoroTimer.targetEndTime) return;

    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((PomodoroTimer.targetEndTime - now) / 1000));
    PomodoroTimer.remainingSeconds = remaining;

    // Auto-save every 5 minutes (300s) during active work sessions
    if (PomodoroTimer.mode === "work") {
        if (typeof PomodoroTimer.lastSavedRemainingSeconds !== "number") {
            PomodoroTimer.lastSavedRemainingSeconds = PomodoroTimer.totalSeconds;
        }
        const elapsedSinceLastSave = PomodoroTimer.lastSavedRemainingSeconds - remaining;
        if (elapsedSinceLastSave >= 300) {
            const fiveMinBlocks = Math.floor(elapsedSinceLastSave / 300);
            commitWorkMinutesToDisk(fiveMinBlocks * 5);
            PomodoroTimer.lastSavedRemainingSeconds -= (fiveMinBlocks * 300);
            savePomoState();
        }

        // 5-minute advance warning alert
        if (PomodoroTimer.totalSeconds > 300 && remaining <= 300 && !PomodoroTimer.hasFiredFiveMinWarning) {
            PomodoroTimer.hasFiredFiveMinWarning = true;
            if (typeof dispatchFiveMinuteWarning === "function") {
                dispatchFiveMinuteWarning({ taskName: PomodoroTimer.taskName });
            }
        }
    }

    updatePomoDisplay();

    if (remaining <= 0) {
        handlePomoCompletion();
    }
}

/**
 * Pause the timer countdown
 */
function pausePomoTimer() {
    cleanupGestureAudioUnlock();

    if (PomodoroTimer.isRunning && PomodoroTimer.targetEndTime) {
        const now = Date.now();
        PomodoroTimer.remainingSeconds = Math.max(0, Math.ceil((PomodoroTimer.targetEndTime - now) / 1000));
    }

    PomodoroTimer.isRunning = false;
    PomodoroTimer.targetEndTime = null;

    if (PomodoroTimer.intervalId) {
        clearInterval(PomodoroTimer.intervalId);
        PomodoroTimer.intervalId = null;
    }

    // Stop background defenses
    stopWorkerTicker();
    stopAudioKeepalive();
    stopTitleBlinking();

    restoreDocumentTitle();

    const btnStart = document.getElementById("btn-pomo-start");
    const btnPause = document.getElementById("btn-pomo-pause");
    if (btnStart) btnStart.classList.remove("hidden");
    if (btnPause) btnPause.classList.add("hidden");

    updatePomoDisplay();
    savePomoState();
}

/**
 * Reset timer back to full duration for current mode
 */
function resetPomoTimer() {
    pausePomoTimer();
    readDurationInputs();

    const durationMins = PomodoroTimer.mode === "work" ? PomodoroTimer.workMinutes : PomodoroTimer.restMinutes;
    PomodoroTimer.totalSeconds = durationMins * 60;
    PomodoroTimer.remainingSeconds = PomodoroTimer.totalSeconds;
    PomodoroTimer.lastSavedRemainingSeconds = PomodoroTimer.totalSeconds;
    PomodoroTimer.targetEndTime = null;
    PomodoroTimer.hasFiredFiveMinWarning = false;

    stopTitleBlinking();
    restoreDocumentTitle();
    updatePomoDisplay();
    savePomoState();
}

/**
 * Handle timer reaching 00:00 naturally
 */
function handlePomoCompletion() {
    pausePomoTimer();
    playPomoAlarm();
    startTitleBlinking({ mode: PomodoroTimer.mode });
    dispatchSystemNotification({ mode: PomodoroTimer.mode });

    const isWork = PomodoroTimer.mode === "work";

    if (isWork) {
        // Commit any leftover full minutes (< 5 min)
        if (typeof PomodoroTimer.lastSavedRemainingSeconds === "number") {
            const leftoverSecs = PomodoroTimer.lastSavedRemainingSeconds - PomodoroTimer.remainingSeconds;
            const leftoverMins = Math.floor(leftoverSecs / 60);
            if (leftoverMins > 0) {
                commitWorkMinutesToDisk(leftoverMins);
            }
        }
    }

    const completedMins = PomodoroTimer.workMinutes;
    // Restore user default duration if session was adapted to task remaining time
    if (PomodoroTimer.defaultWorkMinutes && PomodoroTimer.workMinutes !== PomodoroTimer.defaultWorkMinutes) {
        PomodoroTimer.workMinutes = PomodoroTimer.defaultWorkMinutes;
        const workInput = document.getElementById("input-pomo-work-time");
        if (workInput) workInput.value = PomodoroTimer.defaultWorkMinutes;
    }

    resetPomoTimer();

    // Prompt user smoothly without cutting audio or blocking execution
    setTimeout(() => {
        const msg = isWork
            ? `🎉 أحسنت! انتهت جلسة التركيز (${completedMins} دقيقة) وتم حفظ التقدم تلقائياً.\n\nهل ترغب في بدء فترة استراحة الآن؟`
            : "☕ انتهت فترة الاستراحة! هل ترغب في العودة للعمل والتركيز؟";

        if (confirm(msg)) {
            stopTitleBlinking();
            setPomoMode(isWork ? "rest" : "work");
            startPomoTimer();
        } else {
            stopTitleBlinking();
        }
    }, 600);
}

/**
 * Commit work minutes to appData logs and trigger UI updates
 */
function commitWorkMinutesToDisk(minutes) {
    if (minutes <= 0) return 0;
    const realTodayStr = getLocalTodayString();
    const appData = getActiveAppData();

    if (PomodoroTimer.taskId && appData) {
        const log = typeof ensureDayRecord === "function"
            ? ensureDayRecord(realTodayStr)
            : (appData.logs[realTodayStr] || (appData.logs[realTodayStr] = { taskProgress: {} }));

        const existingProgress = log.taskProgress[PomodoroTimer.taskId];
        const currentVal = Number(existingProgress?.achieved) || 0;
        const newVal = currentVal + minutes;
        const task = (appData.tasks || []).find(t => t.id === PomodoroTimer.taskId);
        const normTarget = (existingProgress && Number(existingProgress.target) > 0)
            ? Number(existingProgress.target)
            : (task ? getTaskNormalizedTarget(task, realTodayStr) : 0);
        const status = existingProgress?.status || (task && ScheduleEngine.isTaskScheduledForDate(task, realTodayStr, appData, newVal) ? "scheduled" : (newVal > 0 ? "bonus" : "scheduled"));

        const { hours: _h, score: _s, ...cleanExisting } = existingProgress || {};
        log.taskProgress[PomodoroTimer.taskId] = {
            ...cleanExisting,
            target: normTarget,
            achieved: newVal,
            status
        };
        if (!log._dirtyTasks) log._dirtyTasks = {};
        log._dirtyTasks[PomodoroTimer.taskId] = Date.now();
        log._dirty = true;
        ScoringEngine.invalidateScoreCache(realTodayStr, appData);

        // Persist data immediately
        saveData(true, realTodayStr);

        // Update daily view & scores immediately
        renderDailyView();
        updateDailyScoreSummary();
        updateHeaderTodayScore();
        updateChartAndAnalytics();
    }

    return minutes;
}

/**
 * Update MM:SS countdown display and document title
 */
function updatePomoDisplay() {
    const mins = Math.floor(PomodoroTimer.remainingSeconds / 60);
    const secs = PomodoroTimer.remainingSeconds % 60;
    const mStr = String(mins).padStart(2, "0");
    const sStr = String(secs).padStart(2, "0");

    const minEl = document.getElementById("pomo-mins");
    const secEl = document.getElementById("pomo-secs");
    if (minEl) minEl.textContent = mStr;
    if (secEl) secEl.textContent = sStr;

    if (PomodoroTimer.isRunning) {
        const modeLabel = PomodoroTimer.mode === "work" ? "🎯 تركيز" : "☕ استراحة";
        document.title = `(${mStr}:${sStr}) ${modeLabel} - أوراد`;
    }
}

/**
 * Read duration inputs from the DOM safely
 */
function readDurationInputs() {
    const workInput = document.getElementById("input-pomo-work-time");
    const restInput = document.getElementById("input-pomo-rest-time");

    if (workInput) {
        PomodoroTimer.workMinutes = Math.max(1, Math.min(APP_CONSTANTS.LIMITS.POMO_WORK_MAX, parseInt(workInput.value, 10) || APP_CONSTANTS.POMODORO_DEFAULTS.WORK_MINUTES));
    }
    if (restInput) {
        PomodoroTimer.restMinutes = Math.max(1, Math.min(APP_CONSTANTS.LIMITS.POMO_REST_MAX, parseInt(restInput.value, 10) || APP_CONSTANTS.POMODORO_DEFAULTS.REST_MINUTES));
    }
}

/**
 * Save Pomodoro state to localStorage
 */
function savePomoState() {
    const state = {
        mode: PomodoroTimer.mode,
        isRunning: PomodoroTimer.isRunning,
        totalSeconds: PomodoroTimer.totalSeconds,
        remainingSeconds: PomodoroTimer.remainingSeconds,
        lastSavedRemainingSeconds: PomodoroTimer.lastSavedRemainingSeconds,
        targetEndTime: PomodoroTimer.targetEndTime,
        taskId: PomodoroTimer.taskId,
        taskName: PomodoroTimer.taskName,
        workMinutes: PomodoroTimer.workMinutes,
        defaultWorkMinutes: PomodoroTimer.defaultWorkMinutes || PomodoroTimer.workMinutes,
        restMinutes: PomodoroTimer.restMinutes,
        hasFiredFiveMinWarning: PomodoroTimer.hasFiredFiveMinWarning
    };

    try {
        localStorage.setItem(APP_CONSTANTS.STORAGE_KEYS.POMODORO, JSON.stringify(state));
    } catch (e) {}
}

/**
 * Load Pomodoro state from localStorage
 */
function loadPomoState() {
    try {
        const raw = localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.POMODORO);
        if (!raw) return;
        const s = JSON.parse(raw);

        if (s.defaultWorkMinutes) {
            PomodoroTimer.defaultWorkMinutes = s.defaultWorkMinutes;
        } else if (s.workMinutes) {
            PomodoroTimer.defaultWorkMinutes = s.workMinutes;
        }
        if (s.workMinutes) {
            PomodoroTimer.workMinutes = s.workMinutes;
            const wIn = document.getElementById("input-pomo-work-time");
            if (wIn) wIn.value = s.workMinutes;
        }
        if (s.restMinutes) {
            PomodoroTimer.restMinutes = s.restMinutes;
            const rIn = document.getElementById("input-pomo-rest-time");
            if (rIn) rIn.value = s.restMinutes;
        }
        if (s.taskId) PomodoroTimer.taskId = s.taskId;
        if (s.taskName) PomodoroTimer.taskName = s.taskName;
        if (s.mode) PomodoroTimer.mode = s.mode;
        if (typeof s.lastSavedRemainingSeconds === "number") {
            PomodoroTimer.lastSavedRemainingSeconds = s.lastSavedRemainingSeconds;
        }
        if (typeof s.hasFiredFiveMinWarning === "boolean") {
            PomodoroTimer.hasFiredFiveMinWarning = s.hasFiredFiveMinWarning;
        }

        populatePomoTaskSelect();
        updatePomoTaskHeader();
        updatePomoModeUI(PomodoroTimer.mode);

        if (s.isRunning && s.targetEndTime) {
            const now = Date.now();
            if (s.targetEndTime > now) {
                // Resume running timer seamlessly
                PomodoroTimer.targetEndTime = s.targetEndTime;
                PomodoroTimer.remainingSeconds = Math.ceil((s.targetEndTime - now) / 1000);
                PomodoroTimer.totalSeconds = s.totalSeconds || (PomodoroTimer.mode === "work" ? PomodoroTimer.workMinutes * 60 : PomodoroTimer.restMinutes * 60);
                if (typeof PomodoroTimer.lastSavedRemainingSeconds !== "number") {
                    PomodoroTimer.lastSavedRemainingSeconds = PomodoroTimer.remainingSeconds;
                }
                PomodoroTimer.isRunning = true;

                const btnStart = document.getElementById("btn-pomo-start");
                const btnPause = document.getElementById("btn-pomo-pause");
                if (btnStart) btnStart.classList.add("hidden");
                if (btnPause) btnPause.classList.remove("hidden");

                startWorkerTicker();

                if (PomodoroTimer.intervalId) clearInterval(PomodoroTimer.intervalId);
                PomodoroTimer.intervalId = setInterval(syncPomoTimer, 1000);
                syncPomoTimer();

                registerGestureAudioUnlock();
            } else {
                // Timer expired while page was closed: reset safely
                resetPomoTimer();
            }
        } else {
            PomodoroTimer.totalSeconds = s.totalSeconds || (PomodoroTimer.mode === "work" ? PomodoroTimer.workMinutes * 60 : PomodoroTimer.restMinutes * 60);
            PomodoroTimer.remainingSeconds = typeof s.remainingSeconds === "number" ? s.remainingSeconds : PomodoroTimer.totalSeconds;
            if (typeof PomodoroTimer.lastSavedRemainingSeconds !== "number") {
                PomodoroTimer.lastSavedRemainingSeconds = PomodoroTimer.remainingSeconds;
            }
            updatePomoDisplay();
        }
    } catch (e) {
        console.warn("Failed to load pomo state", e);
    }
}

// Auto-initialize as soon as DOM is ready
if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setupPomodoroControls);
    } else {
        setupPomodoroControls();
    }
}

// Global exports
if (typeof window !== "undefined") {
    window.PomodoroTimer = PomodoroTimer;
    window.setupPomodoroControls = setupPomodoroControls;
    window.openPomodoroModal = openPomodoroModal;
    window.closePomodoroModal = closePomodoroModal;
    window.startPomoTimer = startPomoTimer;
    window.pausePomoTimer = pausePomoTimer;
    window.resetPomoTimer = resetPomoTimer;
    window.setPomoMode = setPomoMode;
}

export {
    PomodoroTimer,
    setupPomodoroControls,
    openPomodoroModal,
    closePomodoroModal,
    startPomoTimer,
    pausePomoTimer,
    resetPomoTimer,
    setPomoMode
};
