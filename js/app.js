/**
 * ============================================================================
 * AWRAD PRO - APPLICATION UI COORDINATOR
 * Manages UI navigation, daily controls, view transitions, and app lifecycle.
 * State & persistence are decoupled into AppState (state.js) & AppStore (store.js).
 * ============================================================================
 */

let chartInstance = null;

// ============================================================================
// APPLICATION LIFECYCLE
// ============================================================================
document.addEventListener("DOMContentLoaded", async () => {
    if (typeof setupDataManagement === "function") {
        setupDataManagement();
    }
    if (window.authManager) {
        await window.authManager.init();
        if (window.authManager.isLoggedIn()) {
            await window.startApp(window.authManager.getCurrentUser());
        } else {
            await window.startApp(APP_CONSTANTS.GUEST_USER);
        }
    } else {
        await window.startApp(APP_CONSTANTS.GUEST_USER);
    }
});

window.startApp = async function(username) {
    if (window.awradyAPI) {
        const uid = window.authManager?.getCurrentUserId?.() || localStorage.getItem("AWRAD_AUTH_UID") || null;
        window.awradyAPI.setCurrentUser(username, uid);
    }
    if (window.AppStore) {
        await window.AppStore.initData();
    } else if (typeof initData === "function") {
        await initData();
    }

    if (!window._appControlsBound) {
        setupNavigation();
        setupDailyControls();
        if (typeof setupTaskManager === "function") setupTaskManager();
        if (typeof setupNawafelToast === "function") setupNawafelToast();
        if (typeof setupQiyamToast === "function") setupQiyamToast();
        if (typeof setupPomodoroControls === "function") setupPomodoroControls();
        window._appControlsBound = true;
    }

    if (typeof renderDailyView === "function") renderDailyView();
    if (typeof renderAllTimeStats === "function") renderAllTimeStats();
    if (typeof updateHeaderTodayScore === "function") updateHeaderTodayScore();
};

window.logoutApp = function() {
    if (window.AppState) {
        window.AppState.resetState();
    } else {
        window.appData = {
            tasks: [],
            logs: {}
        };
    }
    const todayEl = document.getElementById("header-today-score");
    if (todayEl) todayEl.textContent = "0%";
    const container = document.getElementById("daily-tasks-grid");
    if (container) container.innerHTML = "";
};

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
            const targetEl = document.getElementById(targetViewId);
            if (targetEl) targetEl.classList.add("active");

            if (targetViewId === "view-analytics") {
                if (!chartInstance && typeof initChart === "function") {
                    initChart();
                }
                if (typeof updateChartAndAnalytics === "function") {
                    updateChartAndAnalytics();
                }
            } else if (targetViewId === "view-manager") {
                if (typeof renderTaskManager === "function") {
                    renderTaskManager();
                }
            }
        });
    });

    const btnHeaderPomo = document.getElementById("btn-open-header-pomo");
    if (btnHeaderPomo) {
        btnHeaderPomo.addEventListener("click", () => {
            if (typeof openPomodoroModal === "function") {
                openPomodoroModal();
            }
        });
    }
}

async function switchActiveDate(newDate) {
    const activeDate = window.AppState ? window.AppState.getCurrentDate() : window.currentDateStr;
    if (!newDate || newDate === activeDate) return;

    if (window.AppState) {
        window.AppState.setCurrentDate(newDate);
    } else {
        window.currentDateStr = newDate;
    }

    const datePicker = document.getElementById("date-picker-input");
    if (datePicker) datePicker.value = newDate;

    // 1. Instant optimistic render (0ms response)
    if (typeof renderDailyView === "function") {
        renderDailyView();
    }

    // 2. Non-blocking cloud fetch in background via AppStore
    if (window.AppStore?.fetchDayProgress) {
        window.AppStore.fetchDayProgress(newDate, () => {
            const current = window.AppState ? window.AppState.getCurrentDate() : window.currentDateStr;
            if (current === newDate && typeof renderDailyView === "function") {
                renderDailyView();
            }
        });
    }
}

function setupDailyControls() {
    const datePicker = document.getElementById("date-picker-input");
    const dateDisplay = document.getElementById("current-date-display");
    const curDate = window.AppState ? window.AppState.getCurrentDate() : window.currentDateStr;

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
        datePicker.value = curDate;
        datePicker.addEventListener("change", (e) => {
            if (e.target.value) {
                switchActiveDate(e.target.value);
            } else {
                datePicker.value = window.AppState ? window.AppState.getCurrentDate() : window.currentDateStr;
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
    if (btnPrev) {
        btnPrev.addEventListener("click", () => {
            const current = window.AppState ? window.AppState.getCurrentDate() : window.currentDateStr;
            switchActiveDate(addDays(current, -1));
        });
    }

    const btnNext = document.getElementById("btn-next-day");
    if (btnNext) {
        btnNext.addEventListener("click", () => {
            const current = window.AppState ? window.AppState.getCurrentDate() : window.currentDateStr;
            switchActiveDate(addDays(current, 1));
        });
    }

    const btnToday = document.getElementById("btn-jump-today");
    if (btnToday) {
        btnToday.addEventListener("click", () => {
            switchActiveDate(getLocalTodayString());
        });
    }

    const btnQuickAdd = document.getElementById("btn-open-quick-add");
    if (btnQuickAdd) {
        btnQuickAdd.addEventListener("click", () => {
            if (typeof openQuickAddModal === "function") {
                openQuickAddModal();
            }
        });
    }
}

// ============================================================================
// SCORING ENGINE INTEGRATION & HELPERS
// ============================================================================
function calculateDayScore(dateStr, appDataRef = null, returnHours = false) {
    const data = appDataRef || (window.AppState ? window.AppState.getAppData() : window.appData);
    return ScoringEngine.calculateDayScore(dateStr, data, returnHours);
}

if (typeof window !== "undefined") {
    window.renderDailyView = typeof renderDailyView !== "undefined" ? renderDailyView : window.renderDailyView;
    window.switchActiveDate = switchActiveDate;
    window.calculateDayScore = calculateDayScore;

    window.addEventListener("online", () => {
        if (window.AppStore) {
            window.AppStore.syncAllDirtyDays();
        } else if (typeof syncAllDirtyDays === "function") {
            syncAllDirtyDays();
        }
    });

    window.addEventListener("beforeunload", () => {
        if (window.AppStore) {
            window.AppStore.flush();
        }
    });

    window.addEventListener("pagehide", () => {
        if (window.AppStore) {
            window.AppStore.flush();
        }
    });
}
