/**
 * Awrady Dashboard - Interactive Nawafel & Qiyam Toasts Component
 */

import { APP_CONSTANTS } from '../config/constants.js';
import { AppState } from '../core/state.js';
import { saveData } from '../core/store.js';

let currentPrayerTaskId = null;
let tempNawafelCount = 0;
let tempAzkarChecked = false;

let currentQiyamTaskId = null;
let tempQiyamWirdCount = 0;

const getTaskVal = (id) => (typeof window !== "undefined" && typeof window.getTaskVal === "function") ? window.getTaskVal(id) : 0;
const setTaskVal = (id, val) => { if (typeof window !== "undefined" && typeof window.setTaskVal === "function") window.setTaskVal(id, val); };
const renderDailyView = () => { if (typeof window !== "undefined" && typeof window.renderDailyView === "function") window.renderDailyView(); };

export function setupNawafelToast() {
    const btnPlus = document.getElementById("btn-nawafel-plus");
    const btnMinus = document.getElementById("btn-nawafel-minus");
    const toggleAzkar = document.getElementById("toggle-azkar-prayer");
    const btnClose = document.getElementById("btn-close-nawafel");
    const overlay = document.getElementById("nawafel-toast-overlay");

    const step = APP_CONSTANTS.LIMITS.NAWAFEL_STEP;
    if (btnPlus) {
        btnPlus.addEventListener("click", () => {
            tempNawafelCount += step;
            const counter = document.getElementById("nawafel-counter-val");
            if (counter) counter.textContent = tempNawafelCount;
            savePrayerExtras(false);
        });
    }

    if (btnMinus) {
        btnMinus.addEventListener("click", () => {
            if (tempNawafelCount >= step) tempNawafelCount -= step;
            const counter = document.getElementById("nawafel-counter-val");
            if (counter) counter.textContent = tempNawafelCount;
            savePrayerExtras(false);
        });
    }

    if (toggleAzkar) {
        toggleAzkar.addEventListener("change", (e) => {
            tempAzkarChecked = e.target.checked;
            savePrayerExtras(false);
        });
    }

    if (btnClose) {
        btnClose.addEventListener("click", hideNawafelPrompt);
    }

    if (overlay) {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) {
                hideNawafelPrompt();
            }
        });
    }

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            const toast = document.getElementById("nawafel-toast-overlay");
            if (toast && !toast.classList.contains("hidden")) {
                hideNawafelPrompt();
            }
        }
    });
}

export function checkAndShowNawafelPrompt(prayerTaskId) {
    currentPrayerTaskId = prayerTaskId;
    const curDateStr = AppState.getCurrentDate();
    const appData = AppState.getAppData();
    
    const log = appData?.logs?.[curDateStr] || null;
    const extras = log?.prayerExtras?.[prayerTaskId] || { nawafel: 0, azkar: false };
    
    tempNawafelCount = extras.nawafel;
    tempAzkarChecked = extras.azkar;

    const counter = document.getElementById("nawafel-counter-val");
    const toggleAzkar = document.getElementById("toggle-azkar-prayer");

    if (counter) counter.textContent = tempNawafelCount;
    if (toggleAzkar) toggleAzkar.checked = tempAzkarChecked;

    const toast = document.getElementById("nawafel-toast-overlay");
    if (toast && toast.classList.contains("hidden")) {
        toast.classList.remove("hidden");
    }
}

export function hideNawafelPrompt() {
    const toast = document.getElementById("nawafel-toast-overlay");
    if (toast) toast.classList.add("hidden");
}

export function savePrayerExtras(autoClose = false) {
    try {
        const appData = AppState.getAppData();
        if (appData && currentPrayerTaskId) {
            const curDateStr = AppState.getCurrentDate();
            const prayerId = currentPrayerTaskId;
            const curLog = appData?.logs?.[curDateStr] || null;
            const oldExtras = curLog?.prayerExtras?.[prayerId] || { nawafel: 0, azkar: false };

            const nawafelDiff = tempNawafelCount - oldExtras.nawafel;
            const azkarDiff = (tempAzkarChecked ? 1 : 0) - (oldExtras.azkar ? 1 : 0);

            if (nawafelDiff === 0 && azkarDiff === 0 && (!curLog || !curLog.prayerExtras?.[prayerId])) {
                return;
            }

            const log = AppState.ensureDayRecord(curDateStr);

            if (!log.prayerExtras) {
                log.prayerExtras = {};
            }

            log.prayerExtras[prayerId] = {
                nawafel: tempNawafelCount,
                azkar: tempAzkarChecked
            };

            log._dirty = true;

            const sunnahId = APP_CONSTANTS.TASK_IDS.SUNNAH;
            const azkarId = APP_CONSTANTS.TASK_IDS.PRAYER_AZKAR;

            if (nawafelDiff !== 0) {
                const nawafelTask = (appData.tasks || []).find(t => !t.isArchived && t.id === sunnahId);
                if (nawafelTask) {
                    const curVal = getTaskVal(nawafelTask.id);
                    setTaskVal(nawafelTask.id, Math.max(0, curVal + nawafelDiff));
                }
            }

            if (azkarDiff !== 0) {
                const azkarTask = (appData.tasks || []).find(t => !t.isArchived && t.id === azkarId);
                if (azkarTask) {
                    const curVal = getTaskVal(azkarTask.id);
                    setTaskVal(azkarTask.id, Math.max(0, curVal + azkarDiff));
                }
            }

            saveData();
            renderDailyView();
        }
    } catch (err) {
        console.error("Error saving prayer extras:", err);
    } finally {
        if (autoClose) {
            hideNawafelPrompt();
        }
    }
}

export function removePrayerExtras(prayerTaskId) {
    const curDateStr = AppState.getCurrentDate();
    const appData = AppState.getAppData();
    const log = appData?.logs?.[curDateStr];
    if (!log?.prayerExtras?.[prayerTaskId]) return;
    const extras = log.prayerExtras[prayerTaskId];
    const sunnahId = APP_CONSTANTS.TASK_IDS.SUNNAH;
    const azkarId = APP_CONSTANTS.TASK_IDS.PRAYER_AZKAR;

    if (extras.nawafel > 0) {
        const nawafelTask = (appData.tasks || []).find(t => !t.isArchived && t.id === sunnahId);
        if (nawafelTask) {
            setTaskVal(nawafelTask.id, Math.max(0, getTaskVal(nawafelTask.id) - extras.nawafel));
        }
    }
    if (extras.azkar) {
        const azkarTask = (appData.tasks || []).find(t => !t.isArchived && t.id === azkarId);
        if (azkarTask) {
            setTaskVal(azkarTask.id, Math.max(0, getTaskVal(azkarTask.id) - 1));
        }
    }
    delete log.prayerExtras[prayerTaskId];
    log._dirty = true;
    saveData();
    renderDailyView();
}

export function setupQiyamToast() {
    const btnPlus = document.getElementById("btn-qiyam-wird-plus");
    const btnMinus = document.getElementById("btn-qiyam-wird-minus");
    const btnSave = document.getElementById("btn-qiyam-save");
    const btnCancel = document.getElementById("btn-qiyam-cancel");

    if (btnPlus) {
        btnPlus.addEventListener("click", () => {
            tempQiyamWirdCount += 1;
            const counter = document.getElementById("qiyam-wird-counter-val");
            if (counter) counter.textContent = tempQiyamWirdCount;
        });
    }

    if (btnMinus) {
        btnMinus.addEventListener("click", () => {
            if (tempQiyamWirdCount >= 1) tempQiyamWirdCount -= 1;
            const counter = document.getElementById("qiyam-wird-counter-val");
            if (counter) counter.textContent = tempQiyamWirdCount;
        });
    }

    if (btnSave) btnSave.addEventListener("click", saveQiyamExtras);
    if (btnCancel) btnCancel.addEventListener("click", hideQiyamPrompt);
}

export function checkAndShowQiyamPrompt() {
    tempQiyamWirdCount = 0;
    const counter = document.getElementById("qiyam-wird-counter-val");
    if (counter) counter.textContent = tempQiyamWirdCount;

    const toast = document.getElementById("qiyam-toast-overlay");
    if (toast && toast.classList.contains("hidden")) {
        toast.classList.remove("hidden");
    }
}

export function hideQiyamPrompt() {
    const toast = document.getElementById("qiyam-toast-overlay");
    if (toast) toast.classList.add("hidden");
}

export function saveQiyamExtras() {
    try {
        const appData = AppState.getAppData();
        if (tempQiyamWirdCount > 0 && appData) {
            const wirdTask = (appData.tasks || []).find(t => !t.isArchived && t.id === APP_CONSTANTS.TASK_IDS.QURAN_WIRD);
            if (wirdTask) {
                const curVal = getTaskVal(wirdTask.id);
                setTaskVal(wirdTask.id, curVal + tempQiyamWirdCount);
                saveData();
                renderDailyView();
            }
        }
    } catch (err) {
        console.error("Error saving qiyam extras:", err);
    } finally {
        hideQiyamPrompt();
    }
}

if (typeof window !== "undefined") {
    window.setupNawafelToast = setupNawafelToast;
    window.checkAndShowNawafelPrompt = checkAndShowNawafelPrompt;
    window.hideNawafelPrompt = hideNawafelPrompt;
    window.savePrayerExtras = savePrayerExtras;
    window.removePrayerExtras = removePrayerExtras;
    window.setupQiyamToast = setupQiyamToast;
    window.checkAndShowQiyamPrompt = checkAndShowQiyamPrompt;
    window.hideQiyamPrompt = hideQiyamPrompt;
    window.saveQiyamExtras = saveQiyamExtras;
}
