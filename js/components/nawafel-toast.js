/**
 * Awrady Dashboard - Interactive Nawafel & Qiyam Toasts Component
 */

let currentPrayerTaskId = null;
let tempNawafelCount = 0;
let tempAzkarChecked = false;

let currentQiyamTaskId = null;
let tempQiyamWirdCount = 0;

function setupNawafelToast() {
    const btnPlus = document.getElementById("btn-nawafel-plus");
    const btnMinus = document.getElementById("btn-nawafel-minus");
    const toggleAzkar = document.getElementById("toggle-azkar-prayer");
    const btnSave = document.getElementById("btn-nawafel-save");
    const btnCancel = document.getElementById("btn-nawafel-cancel");

    if (btnPlus) {
        btnPlus.addEventListener("click", () => {
            tempNawafelCount += 2;
            const counter = document.getElementById("nawafel-counter-val");
            if (counter) counter.textContent = tempNawafelCount;
        });
    }

    if (btnMinus) {
        btnMinus.addEventListener("click", () => {
            if (tempNawafelCount >= 2) tempNawafelCount -= 2;
            const counter = document.getElementById("nawafel-counter-val");
            if (counter) counter.textContent = tempNawafelCount;
        });
    }

    if (toggleAzkar) {
        toggleAzkar.addEventListener("change", (e) => {
            tempAzkarChecked = e.target.checked;
        });
    }

    if (btnSave) btnSave.addEventListener("click", savePrayerExtras);
    if (btnCancel) btnCancel.addEventListener("click", hideNawafelPrompt);
}

function checkAndShowNawafelPrompt(prayerTaskId) {
    currentPrayerTaskId = prayerTaskId;
    const curDateStr = typeof currentDateStr !== "undefined" ? currentDateStr : getLocalTodayString();
    
    if (window.appData && !window.appData.logs[curDateStr]) {
        window.appData.logs[curDateStr] = { entries: {} };
    }
    
    if (window.appData && !window.appData.logs[curDateStr].prayerExtras) {
        window.appData.logs[curDateStr].prayerExtras = {};
    }

    const log = window.appData ? window.appData.logs[curDateStr] : null;
    const extras = (log && log.prayerExtras && log.prayerExtras[prayerTaskId]) || { nawafel: 0, azkar: false };
    
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

function hideNawafelPrompt() {
    const toast = document.getElementById("nawafel-toast-overlay");
    if (toast) toast.classList.add("hidden");
}

function savePrayerExtras() {
    try {
        if (window.appData) {
            const curDateStr = typeof currentDateStr !== "undefined" ? currentDateStr : getLocalTodayString();

            if (!window.appData.logs[curDateStr]) {
                window.appData.logs[curDateStr] = { entries: {} };
            }
            if (!window.appData.logs[curDateStr].prayerExtras) {
                window.appData.logs[curDateStr].prayerExtras = {};
            }

            const prayerId = currentPrayerTaskId;
            const oldExtras = window.appData.logs[curDateStr].prayerExtras[prayerId] || { nawafel: 0, azkar: false };

            const nawafelDiff = tempNawafelCount - oldExtras.nawafel;
            const azkarDiff = (tempAzkarChecked ? 1 : 0) - (oldExtras.azkar ? 1 : 0);

            window.appData.logs[curDateStr].prayerExtras[prayerId] = {
                nawafel: tempNawafelCount,
                azkar: tempAzkarChecked
            };

            if (nawafelDiff !== 0) {
                const nawafelTask = window.appData.tasks.find(t => !t.isArchived && t.id === "task_sunnah");
                if (nawafelTask) {
                    const curVal = getTaskVal(nawafelTask.id);
                    setTaskVal(nawafelTask.id, Math.max(0, curVal + nawafelDiff));
                }
            }

            if (azkarDiff !== 0) {
                const azkarTask = window.appData.tasks.find(t => !t.isArchived && t.id === "task_azkar_prayer");
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
        hideNawafelPrompt();
    }
}

function removePrayerExtras(prayerTaskId) {
    const curDateStr = typeof currentDateStr !== "undefined" ? currentDateStr : getLocalTodayString();
    const log = window.appData?.logs?.[curDateStr];
    if (!log?.prayerExtras?.[prayerTaskId]) return;
    const extras = log.prayerExtras[prayerTaskId];
    if (extras.nawafel > 0) {
        const nawafelTask = window.appData.tasks.find(t => !t.isArchived && t.id === "task_sunnah");
        if (nawafelTask) {
            setTaskVal(nawafelTask.id, Math.max(0, getTaskVal(nawafelTask.id) - extras.nawafel));
        }
    }
    if (extras.azkar) {
        const azkarTask = window.appData.tasks.find(t => !t.isArchived && t.id === "task_azkar_prayer");
        if (azkarTask) {
            setTaskVal(azkarTask.id, Math.max(0, getTaskVal(azkarTask.id) - 1));
        }
    }
    delete log.prayerExtras[prayerTaskId];
    saveData();
    renderDailyView();
}

function setupQiyamToast() {
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

function checkAndShowQiyamPrompt() {
    tempQiyamWirdCount = 0;
    const counter = document.getElementById("qiyam-wird-counter-val");
    if (counter) counter.textContent = tempQiyamWirdCount;

    const toast = document.getElementById("qiyam-toast-overlay");
    if (toast && toast.classList.contains("hidden")) {
        toast.classList.remove("hidden");
    }
}

function hideQiyamPrompt() {
    const toast = document.getElementById("qiyam-toast-overlay");
    if (toast) toast.classList.add("hidden");
}

function saveQiyamExtras() {
    try {
        if (tempQiyamWirdCount > 0 && window.appData) {
            const wirdTask = window.appData.tasks.find(t => !t.isArchived && t.id === "task_quran_read");
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
