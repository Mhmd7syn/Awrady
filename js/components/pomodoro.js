/**
 * Awrady Dashboard - Pomodoro Focus Timer Component
 * Ultra-simple, robust, and bug-free focus timer engine.
 */

const PomodoroTimer = {
    mode: "work", // 'work' | 'rest'
    isRunning: false,
    totalSeconds: 25 * 60,
    remainingSeconds: 25 * 60,
    targetEndTime: null,
    intervalId: null,
    taskId: null,
    taskName: "",
    workMinutes: 25,
    restMinutes: 5,
    originalTitle: ""
};

/**
 * Get active application dataset with safe fallbacks
 */
function getActiveAppData() {
    if (typeof window !== "undefined" && window.appData && Array.isArray(window.appData.tasks) && window.appData.tasks.length > 0) {
        return window.appData;
    }
    if (typeof appData !== "undefined" && appData && Array.isArray(appData.tasks) && appData.tasks.length > 0) {
        return appData;
    }
    if (typeof DEFAULT_AWRAD_DATA !== "undefined" && DEFAULT_AWRAD_DATA && Array.isArray(DEFAULT_AWRAD_DATA.tasks)) {
        return DEFAULT_AWRAD_DATA;
    }
    return null;
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
    const btnReset = document.getElementById("btn-pomo-reset");
    const btnFinish = document.getElementById("btn-pomo-finish");
    const btnClose = document.getElementById("btn-close-pomodoro");

    if (btnStart) btnStart.addEventListener("click", startPomoTimer);
    if (btnPause) btnPause.addEventListener("click", pausePomoTimer);
    if (btnReset) btnReset.addEventListener("click", resetPomoTimer);
    if (btnFinish) btnFinish.addEventListener("click", finishPomoSession);
    if (btnClose) btnClose.addEventListener("click", closePomodoroModal);

    const btnTabWork = document.getElementById("btn-pomo-work");
    const btnTabRest = document.getElementById("btn-pomo-rest");

    if (btnTabWork) btnTabWork.addEventListener("click", () => setPomoMode("work"));
    if (btnTabRest) btnTabRest.addEventListener("click", () => setPomoMode("rest"));

    const taskSelect = document.getElementById("pomo-task-select");
    if (taskSelect) {
        taskSelect.addEventListener("change", (e) => {
            const val = e.target.value;
            if (val) {
                PomodoroTimer.taskId = val;
                const opt = e.target.options[e.target.selectedIndex];
                PomodoroTimer.taskName = opt ? (opt.getAttribute("data-name") || opt.textContent.replace(/^⏱️\s*/, "")) : "";
            } else {
                PomodoroTimer.taskId = null;
                PomodoroTimer.taskName = "";
            }
            updatePomoTaskHeader();
            savePomoState();
        });
    }

    const workInput = document.getElementById("input-pomo-work-time");
    const restInput = document.getElementById("input-pomo-rest-time");

    const onWorkInputChange = () => {
        const val = Math.max(1, Math.min(180, parseInt(workInput.value, 10) || 25));
        PomodoroTimer.workMinutes = val;
        if (PomodoroTimer.mode === "work" && !PomodoroTimer.isRunning) {
            resetPomoTimer();
        } else {
            savePomoState();
        }
    };

    const onRestInputChange = () => {
        const val = Math.max(1, Math.min(60, parseInt(restInput.value, 10) || 5));
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

    // Request notification permission smoothly if not already decided
    if ("Notification" in window && Notification.permission === "default") {
        try {
            Notification.requestPermission();
        } catch (e) {}
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
 * Populate task dropdown with time-based & active tasks
 */
function populatePomoTaskSelect() {
    const select = document.getElementById("pomo-task-select");
    if (!select) return;

    select.innerHTML = '<option value="">🎯 جلسة تركيز عامة (بدون تحديد مهمة)</option>';

    const appData = getActiveAppData();

    if (appData && Array.isArray(appData.tasks)) {
        const timeTypes = ["ساعة", "ساعات", "ساعات ودقايق", "وقت", "دقيقة"];
        
        // Filter active tasks (prioritize time-based, then other non-archived tasks)
        const activeTasks = appData.tasks.filter(t => !t.isArchived);

        const timeTasks = activeTasks.filter(t => {
            const type = (t.type || "").trim();
            return timeTypes.includes(type) || type.includes("ساع") || type.includes("دقيق") || type.includes("وقت");
        });

        const otherTasks = activeTasks.filter(t => !timeTasks.includes(t));

        // Group 1: Time tasks
        if (timeTasks.length > 0) {
            const groupTime = document.createElement("optgroup");
            groupTime.label = "⏱️ مهام الوقت والعمل";
            timeTasks.forEach(t => {
                const opt = document.createElement("option");
                opt.value = t.id;
                opt.setAttribute("data-name", t.name);
                opt.textContent = `${t.name} (${t.category}${t.subcategory ? ' - ' + t.subcategory : ''})`;
                if (PomodoroTimer.taskId && String(PomodoroTimer.taskId) === String(t.id)) {
                    opt.selected = true;
                }
                groupTime.appendChild(opt);
            });
            select.appendChild(groupTime);
        }

        // Group 2: Other active tasks
        if (otherTasks.length > 0) {
            const groupOther = document.createElement("optgroup");
            groupOther.label = "📋 بقية الأوراد والمهام";
            otherTasks.forEach(t => {
                const opt = document.createElement("option");
                opt.value = t.id;
                opt.setAttribute("data-name", t.name);
                opt.textContent = `${t.name} (${t.category}${t.subcategory ? ' - ' + t.subcategory : ''})`;
                if (PomodoroTimer.taskId && String(PomodoroTimer.taskId) === String(t.id)) {
                    opt.selected = true;
                }
                groupOther.appendChild(opt);
            });
            select.appendChild(groupOther);
        }
    }

    if (!PomodoroTimer.taskId) {
        select.value = "";
    }
}

/**
 * Open Pomodoro Modal
 */
function openPomodoroModal(taskId = null, taskName = "") {
    if (taskId !== null && taskId !== undefined) {
        PomodoroTimer.taskId = String(taskId);
        PomodoroTimer.taskName = taskName || "";
        
        // Find task name from appData if not provided
        const appData = getActiveAppData();
        if (!PomodoroTimer.taskName && appData && Array.isArray(appData.tasks)) {
            const found = appData.tasks.find(t => String(t.id) === String(taskId));
            if (found) PomodoroTimer.taskName = found.name;
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
 * Switch mode (Work / Rest) with prompt to save pending work if switching away from work
 */
function setPomoMode(mode) {
    if (PomodoroTimer.mode === mode) return;

    // Check if there is elapsed work time that hasn't been saved yet
    if (PomodoroTimer.mode === "work") {
        const elapsedSecs = PomodoroTimer.totalSeconds - PomodoroTimer.remainingSeconds;
        const elapsedMins = Math.floor(elapsedSecs / 60);

        if (elapsedMins > 0) {
            const taskLabel = PomodoroTimer.taskName ? `مهمتك (${PomodoroTimer.taskName})` : "جلسة عامة";
            if (confirm(`لديك ${elapsedMins} دقيقة عمل منجزة. هل ترغب في حفظها في ${taskLabel} قبل التبديل إلى وقت الراحة؟`)) {
                commitWorkMinutesToDisk(elapsedMins, true);
            }
        }
    }

    updatePomoModeUI(mode);
    resetPomoTimer();
}

/**
 * Start the countdown timer
 */
function startPomoTimer() {
    if (PomodoroTimer.isRunning) return;

    // Read current settings
    readDurationInputs();

    if (PomodoroTimer.remainingSeconds <= 0) {
        PomodoroTimer.totalSeconds = (PomodoroTimer.mode === "work" ? PomodoroTimer.workMinutes : PomodoroTimer.restMinutes) * 60;
        PomodoroTimer.remainingSeconds = PomodoroTimer.totalSeconds;
    }

    PomodoroTimer.isRunning = true;
    PomodoroTimer.targetEndTime = Date.now() + (PomodoroTimer.remainingSeconds * 1000);

    // Toggle button visibility
    const btnStart = document.getElementById("btn-pomo-start");
    const btnPause = document.getElementById("btn-pomo-pause");
    if (btnStart) btnStart.classList.add("hidden");
    if (btnPause) btnPause.classList.remove("hidden");

    if (PomodoroTimer.intervalId) clearInterval(PomodoroTimer.intervalId);
    PomodoroTimer.intervalId = setInterval(syncPomoTimer, 250);

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

    updatePomoDisplay();

    if (remaining <= 0) {
        handlePomoCompletion();
    }
}

/**
 * Pause the timer countdown
 */
function pausePomoTimer() {
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
    PomodoroTimer.targetEndTime = null;

    updatePomoDisplay();
    savePomoState();
}

/**
 * Finish session & save elapsed minutes accurately
 */
function finishPomoSession() {
    // If timer is running, capture exact remaining time first
    if (PomodoroTimer.isRunning && PomodoroTimer.targetEndTime) {
        const now = Date.now();
        PomodoroTimer.remainingSeconds = Math.max(0, Math.ceil((PomodoroTimer.targetEndTime - now) / 1000));
    }

    pausePomoTimer();

    if (PomodoroTimer.mode === "work") {
        const elapsedSecs = PomodoroTimer.totalSeconds - PomodoroTimer.remainingSeconds;
        const elapsedMins = Math.floor(elapsedSecs / 60);

        if (elapsedMins > 0) {
            commitWorkMinutesToDisk(elapsedMins, true);
        } else if (elapsedSecs > 5) {
            alert(`تم إنهاء الجلسة. الوقت المنقضي (${elapsedSecs} ثانية) أقل من دقيقة كاملة، لذلك لم يتم تسجيل دقائق.`);
        } else {
            alert("تم إنهاء الجلسة وإعادة ضبط المؤقت.");
        }
    } else {
        alert("تم إنهاء فترة الاستراحة بنجاح! جاهز لجلسة تركيز جديدة 🎯");
    }

    resetPomoTimer();
    closePomodoroModal();
}

/**
 * Handle timer reaching 00:00 naturally
 */
function handlePomoCompletion() {
    pausePomoTimer();
    playPomoAlarm();

    const isWork = PomodoroTimer.mode === "work";
    const notifTitle = isWork ? "انتهى وقت التركيز! 🎯" : "انتهت فترة الاستراحة! ☕";
    const notifBody = isWork ? "أحسنت! تم حفظ وقت العمل تلقائياً." : "هل ترغب في بدء جلسة تركيز جديدة؟";

    if ("Notification" in window && Notification.permission === "granted") {
        try {
            new Notification(notifTitle, { body: notifBody, icon: "app-icon.ico" });
        } catch (e) {}
    }

    if (isWork) {
        const completedMins = PomodoroTimer.workMinutes;
        commitWorkMinutesToDisk(completedMins, false);
        resetPomoTimer();

        setTimeout(() => {
            const taskLabel = PomodoroTimer.taskName ? `مهمتك (${PomodoroTimer.taskName})` : "سجل اليوم";
            if (confirm(`🎉 أحسنت! انتهى وقت العمل وتم حفظ ${completedMins} دقيقة تلقائياً في ${taskLabel}.\n\nهل ترغب في بدء فترة استراحة الآن؟`)) {
                setPomoMode("rest");
                startPomoTimer();
            }
        }, 300);
    } else {
        resetPomoTimer();
        setTimeout(() => {
            if (confirm("☕ انتهت فترة الاستراحة! هل ترغب في العودة للعمل والتركيز؟")) {
                setPomoMode("work");
                startPomoTimer();
            }
        }, 300);
    }
}

/**
 * Commit work minutes to appData logs and trigger UI updates
 */
function commitWorkMinutesToDisk(minutes, showAlert = false) {
    if (minutes <= 0) return 0;
    const realTodayStr = typeof getLocalTodayString === "function" ? getLocalTodayString() : new Date().toISOString().split("T")[0];
    const appData = getActiveAppData();

    if (PomodoroTimer.taskId && appData) {
        if (!appData.logs) appData.logs = {};
        if (!appData.logs[realTodayStr]) appData.logs[realTodayStr] = { entries: {} };
        if (!appData.logs[realTodayStr].entries) appData.logs[realTodayStr].entries = {};

        const currentVal = appData.logs[realTodayStr].entries[PomodoroTimer.taskId] || 0;
        appData.logs[realTodayStr].entries[PomodoroTimer.taskId] = currentVal + minutes;

        // Persist data immediately
        if (typeof saveData === "function") saveData(true);

        // Update daily view & scores immediately
        if (typeof renderDailyView === "function") renderDailyView();
        if (typeof updateDailyScoreSummary === "function") updateDailyScoreSummary();
        if (typeof updateHeaderTodayScore === "function") updateHeaderTodayScore();
        if (typeof updateChartAndAnalytics === "function") updateChartAndAnalytics();

        if (showAlert) {
            const timeStr = typeof formatTimeHM === "function" ? formatTimeHM(minutes) : `${minutes} دقيقة`;
            alert(`✅ تم حفظ ${timeStr} عمل في مهمة (${PomodoroTimer.taskName || 'المحددة'}) بنجاح!`);
        }
    } else if (showAlert) {
        const timeStr = typeof formatTimeHM === "function" ? formatTimeHM(minutes) : `${minutes} دقيقة`;
        alert(`✅ تم إكمال ${timeStr} تركيز عام بنجاح! لم يتم ربط الوقت بمهمة معينة.`);
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
        PomodoroTimer.workMinutes = Math.max(1, Math.min(180, parseInt(workInput.value, 10) || 25));
    }
    if (restInput) {
        PomodoroTimer.restMinutes = Math.max(1, Math.min(60, parseInt(restInput.value, 10) || 5));
    }
}

/**
 * Restore default document title
 */
function restoreDocumentTitle() {
    if (PomodoroTimer.originalTitle) {
        document.title = PomodoroTimer.originalTitle;
    } else {
        document.title = "أورادي | Awrady Dashboard";
    }
}

/**
 * Play alarm chime (Audio element + Web Audio fallback)
 */
function playPomoAlarm() {
    // 1. Try HTML Audio element
    const alarm = document.getElementById("pomodoro-alarm");
    if (alarm) {
        alarm.currentTime = 0;
        const playPromise = alarm.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => playWebAudioChime());
        }
    } else {
        playWebAudioChime();
    }
}

/**
 * Synthesize a harmonious audio chime using Web Audio API (100% offline & reliable)
 */
function playWebAudioChime() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;

        // Harmonic notes (C5, E5, G5, C6)
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
            const startTime = now + (idx * 0.15);
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, startTime);

            gain.gain.setValueAtTime(0.25, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(startTime);
            osc.stop(startTime + 0.45);
        });
    } catch (e) {
        console.warn("Audio chime error:", e);
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
        targetEndTime: PomodoroTimer.targetEndTime,
        taskId: PomodoroTimer.taskId,
        taskName: PomodoroTimer.taskName,
        workMinutes: PomodoroTimer.workMinutes,
        restMinutes: PomodoroTimer.restMinutes
    };

    try {
        localStorage.setItem("AWRAD_POMO_STATE", JSON.stringify(state));
    } catch (e) {}
}

/**
 * Load Pomodoro state from localStorage
 */
function loadPomoState() {
    try {
        const raw = localStorage.getItem("AWRAD_POMO_STATE");
        if (!raw) return;
        const s = JSON.parse(raw);

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
                PomodoroTimer.isRunning = true;

                const btnStart = document.getElementById("btn-pomo-start");
                const btnPause = document.getElementById("btn-pomo-pause");
                if (btnStart) btnStart.classList.add("hidden");
                if (btnPause) btnPause.classList.remove("hidden");

                if (PomodoroTimer.intervalId) clearInterval(PomodoroTimer.intervalId);
                PomodoroTimer.intervalId = setInterval(syncPomoTimer, 250);
                syncPomoTimer();
            } else {
                // Timer expired while page was closed: reset safely
                resetPomoTimer();
            }
        } else {
            PomodoroTimer.totalSeconds = s.totalSeconds || (PomodoroTimer.mode === "work" ? PomodoroTimer.workMinutes * 60 : PomodoroTimer.restMinutes * 60);
            PomodoroTimer.remainingSeconds = typeof s.remainingSeconds === "number" ? s.remainingSeconds : PomodoroTimer.totalSeconds;
            updatePomoDisplay();
        }
    } catch (e) {
        console.warn("Failed to load pomo state", e);
    }
}

/**
 * Clear saved Pomodoro state
 */
function clearPomoState() {
    try {
        localStorage.removeItem("AWRAD_POMO_STATE");
    } catch (e) {}
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
    window.finishPomoSession = finishPomoSession;
    window.setPomoMode = setPomoMode;
}
