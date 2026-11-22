/**
 * Pomodoro alerts: keep-alive audio, chime, notification, title blink
 */

let _audioContext = null;
let _keepAliveNode = null;
let _originalDocTitle = (typeof document !== "undefined" ? document.title : "");
let _titleBlinkInterval = null;
let _titleBlinkFocusHandler = null;

/**
 * Unlock Web Audio Context upon user interaction
 */
function ensureAudioUnlocked() {
    try {
        if (!_audioContext || _audioContext.state === "closed") {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                _audioContext = new AudioCtx({ latencyHint: "playback" });
            }
        }
        if (_audioContext && _audioContext.state === "suspended") {
            _audioContext.resume();
        }
    } catch (e) {
        console.warn("[Pomodoro] Audio unlock warning:", e);
    }
}

/**
 * Start inaudible audio stream to exempt tab from background throttling & sleep
 * Chromium & Firefox exempt tabs actively playing audio from aggressive power saving.
 */
function startAudioKeepalive() {
    ensureAudioUnlocked();
    stopAudioKeepalive();
    try {
        const ctx = _audioContext;
        if (!ctx) return;
        if (ctx.state === "suspended") {
            ctx.resume();
        }

        // Sub-audible oscillator at 1Hz with microscopic gain (0.00005)
        // Completely silent to humans, but registers with the browser as active media playback.
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(1, ctx.currentTime);
        gain.gain.setValueAtTime(0.00005, ctx.currentTime);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();

        _keepAliveNode = { osc, gain };
    } catch (e) {
        console.warn("[Pomodoro] Keepalive error:", e);
    }
}

/**
 * Stop inaudible background audio stream
 */
function stopAudioKeepalive() {
    try {
        if (_keepAliveNode) {
            const { osc, gain } = _keepAliveNode;
            if (osc) {
                try { osc.stop(); } catch (e) {}
                try { osc.disconnect(); } catch (e) {}
            }
            if (gain) {
                try { gain.disconnect(); } catch (e) {}
            }
            _keepAliveNode = null;
        }
    } catch (e) {}
}

/**
 * Request notification permission smoothly
 */
function requestPomoNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
        try {
            Notification.requestPermission().catch(() => {});
        } catch (e) {}
    }
}

/**
 * Restore default document title
 */
function restoreDocumentTitle() {
    if (_originalDocTitle) {
        document.title = _originalDocTitle;
    } else {
        document.title = "أورادي | Awrady Dashboard";
    }
}

/**
 * Dispatch desktop / OS level notification using Service Worker or Notification API
 * @param {Object} [options]
 * @param {string} [options.mode="work"] 'work' | 'rest'
 */
function dispatchSystemNotification(options = {}) {
    const mode = (typeof options === "string" ? options : options?.mode) || (typeof window !== "undefined" && window.PomodoroTimer?.mode) || "work";
    const isWork = mode === "work";
    const notifTitle = isWork ? "انتهى وقت التركيز! 🎯" : "انتهت فترة الاستراحة! ☕";
    const notifBody = isWork ? "أحسنت! تم حفظ وقت العمل تلقائياً." : "هل ترغب في بدء جلسة تركيز جديدة؟";

    if (!("Notification" in window) || Notification.permission !== "granted") {
        return;
    }

    try {
        if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then((reg) => {
                if (reg && reg.showNotification) {
                    reg.showNotification(notifTitle, {
                        body: notifBody,
                        icon: "app-icon.ico",
                        badge: "app-icon.ico",
                        tag: "pomodoro-alarm",
                        requireInteraction: true,
                        silent: false,
                        vibrate: [300, 150, 300, 150, 300]
                    });
                    return;
                }
                new Notification(notifTitle, { body: notifBody, icon: "app-icon.ico", requireInteraction: true });
            }).catch(() => {
                new Notification(notifTitle, { body: notifBody, icon: "app-icon.ico", requireInteraction: true });
            });
        } else {
            new Notification(notifTitle, { body: notifBody, icon: "app-icon.ico", requireInteraction: true });
        }
    } catch (e) {
        console.warn("[Pomodoro] Notification dispatch warning:", e);
    }
}

/**
 * Start tab title flashing when alarm fires
 * @param {Object} [options]
 * @param {string} [options.mode="work"]
 */
function startTitleBlinking(options = {}) {
    stopTitleBlinking();
    const mode = (typeof options === "string" ? options : options?.mode) || (typeof window !== "undefined" && window.PomodoroTimer?.mode) || "work";
    const isWork = mode === "work";
    const alertTitle = isWork ? "🔔 انتهى وقت التركيز! ⏰" : "☕ انتهت فترة الاستراحة! ⏰";
    let state = false;

    _titleBlinkInterval = setInterval(() => {
        document.title = state ? alertTitle : (_originalDocTitle || "أورادي");
        state = !state;
    }, 600);

    _titleBlinkFocusHandler = () => {
        stopTitleBlinking();
    };
    window.addEventListener("focus", _titleBlinkFocusHandler);
    document.addEventListener("click", _titleBlinkFocusHandler);
}

/**
 * Stop tab title flashing and restore normal title
 */
function stopTitleBlinking() {
    if (_titleBlinkInterval) {
        clearInterval(_titleBlinkInterval);
        _titleBlinkInterval = null;
    }
    if (_titleBlinkFocusHandler) {
        window.removeEventListener("focus", _titleBlinkFocusHandler);
        document.removeEventListener("click", _titleBlinkFocusHandler);
        _titleBlinkFocusHandler = null;
    }
    restoreDocumentTitle();
}

/**
 * Play alarm chime (Web Audio API synthesis, works offline)
 */
function playPomoAlarm() {
    ensureAudioUnlocked();
    playWebAudioChime();
}

/**
 * Synthesize rich harmonious multi-burst chime using Web Audio API
 * Fully offline, instant response, 3 pleasant chime bursts lasting ~3.5s
 */
function playWebAudioChime() {
    try {
        ensureAudioUnlocked();
        const ctx = _audioContext;
        if (!ctx) return;

        if (ctx.state === "suspended") {
            ctx.resume();
        }

        const now = ctx.currentTime;

        // 3 successive melodic chime bursts spaced 1.1s apart
        const bursts = [0, 1.1, 2.2];
        const notes = [
            { freq: 659.25, time: 0.00, dur: 0.45 }, // E5
            { freq: 830.61, time: 0.14, dur: 0.45 }, // G#5
            { freq: 987.77, time: 0.28, dur: 0.45 }, // B5
            { freq: 1318.51, time: 0.44, dur: 0.65 } // E6
        ];

        bursts.forEach((burstOffset) => {
            const burstStart = now + burstOffset;

            notes.forEach((note) => {
                const startTime = burstStart + note.time;
                const endTime = startTime + note.dur;

                // Primary melodic chime note
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "sine";
                osc.frequency.setValueAtTime(note.freq, startTime);

                // Quick attack and bell-like decay
                gain.gain.setValueAtTime(0.0001, startTime);
                gain.gain.exponentialRampToValueAtTime(0.45, startTime + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(startTime);
                osc.stop(endTime);

                // Harmonic shimmer overtone
                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.type = "triangle";
                osc2.frequency.setValueAtTime(note.freq * 2, startTime);

                gain2.gain.setValueAtTime(0.0001, startTime);
                gain2.gain.exponentialRampToValueAtTime(0.15, startTime + 0.015);
                gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + (note.dur * 0.7));

                osc2.connect(gain2);
                gain2.connect(ctx.destination);

                osc2.start(startTime);
                osc2.stop(startTime + (note.dur * 0.75));
            });
        });
    } catch (e) {
        console.warn("[Pomodoro] playWebAudioChime error:", e);
    }
}

/**
 * Synthesizes a gentle dual-tone advance warning chime (880Hz -> 1174Hz)
 */
function playFiveMinuteChime() {
    try {
        ensureAudioUnlocked();
        const ctx = _audioContext;
        if (!ctx) return;
        if (ctx.state === "suspended") ctx.resume();

        const now = ctx.currentTime;
        const notes = [
            { freq: 880, delay: 0, dur: 0.5 },
            { freq: 1174.66, delay: 0.22, dur: 0.65 }
        ];

        notes.forEach(note => {
            const startTime = now + note.delay;
            const endTime = startTime + note.dur;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(note.freq, startTime);

            gain.gain.setValueAtTime(0.0001, startTime);
            gain.gain.exponentialRampToValueAtTime(0.25, startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(startTime);
            osc.stop(endTime);
        });
    } catch (e) {
        console.warn("[Pomodoro] playFiveMinuteChime warning:", e);
    }
}

/**
 * Dispatches audio chime and notification when 5 minutes remain in session
 * @param {Object} [options]
 * @param {string} [options.taskName=""]
 */
function dispatchFiveMinuteWarning(options = {}) {
    ensureAudioUnlocked();
    playFiveMinuteChime();

    const taskName = (typeof options === "string" ? options : options?.taskName) || (typeof window !== "undefined" && window.PomodoroTimer?.taskName) || "";
    const taskLabel = taskName ? ` (${taskName})` : "";
    const notifTitle = "⏳ باقي 5 دقائق على نهاية وقت التركيز!";
    const notifBody = `شارفت جلسة التركيز${taskLabel} على الانتهاء. استعد لإنهاء مهامك الحالية.`;

    if (!("Notification" in window) || Notification.permission !== "granted") {
        return;
    }

    try {
        if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then(reg => {
                if (reg && reg.showNotification) {
                    reg.showNotification(notifTitle, {
                        body: notifBody,
                        icon: "app-icon.ico",
                        badge: "app-icon.ico",
                        tag: "pomodoro-5min-warning",
                        silent: false,
                        vibrate: [200, 100, 200]
                    });
                    return;
                }
                new Notification(notifTitle, { body: notifBody, icon: "app-icon.ico" });
            }).catch(() => {
                new Notification(notifTitle, { body: notifBody, icon: "app-icon.ico" });
            });
        } else {
            new Notification(notifTitle, { body: notifBody, icon: "app-icon.ico" });
        }
    } catch (e) {
        console.warn("[Pomodoro] 5-min warning notification failed:", e);
    }
}

if (typeof window !== "undefined") {
    window.ensureAudioUnlocked = ensureAudioUnlocked;
    window.startAudioKeepalive = startAudioKeepalive;
    window.stopAudioKeepalive = stopAudioKeepalive;
    window.requestPomoNotificationPermission = requestPomoNotificationPermission;
    window.restoreDocumentTitle = restoreDocumentTitle;
    window.dispatchSystemNotification = dispatchSystemNotification;
    window.dispatchFiveMinuteWarning = dispatchFiveMinuteWarning;
    window.startTitleBlinking = startTitleBlinking;
    window.stopTitleBlinking = stopTitleBlinking;
    window.playPomoAlarm = playPomoAlarm;
    window.playWebAudioChime = playWebAudioChime;
    window.playFiveMinuteChime = playFiveMinuteChime;
}

export {
    ensureAudioUnlocked,
    startAudioKeepalive,
    stopAudioKeepalive,
    requestPomoNotificationPermission,
    restoreDocumentTitle,
    dispatchSystemNotification,
    dispatchFiveMinuteWarning,
    startTitleBlinking,
    stopTitleBlinking,
    playPomoAlarm,
    playWebAudioChime,
    playFiveMinuteChime
};
