/**
 * ============================================================================
 * AWRAD PRO - APPLICATION UI COORDINATOR
 * Manages UI navigation, daily controls, view transitions, and app lifecycle.
 * State & persistence are decoupled into AppState (state.js) & AppStore (store.js).
 * ============================================================================
 */

import { APP_CONSTANTS } from './config/constants.js';
import { DEFAULT_TASKS, DEFAULT_CATEGORIES, DEFAULT_AWRAD_DATA } from './config/default-data.js';
import { getLocalTodayString, addDays } from './utils/date-utils.js';
import { AppState } from './core/state.js';
import { AppStore, initData, syncAllDirtyDays } from './core/store.js';
import { awradyAPI } from './api.js';
import { ScoringEngine } from './core/scoring-engine.js';
import { showToast } from './components/toast.js';
import { authManager } from './components/auth-manager.js';
import { setupDataManagement } from './components/data-manager.js';
import { renderDailyView } from './components/daily-view.js';
import { updateDailyScoreSummary, updateHeaderTodayScore } from './components/day-summary.js';
import { setupTaskManager, renderTaskManager } from './components/task-manager.js';
import { setupNawafelToast, setupQiyamToast } from './components/nawafel-toast.js';
import { setupPomodoroControls, openPomodoroModal } from './components/pomodoro.js';
import { openQuickAddModal } from './components/quick-add-modal.js';
import { initChart, updateChartAndAnalytics, renderAllTimeStats, chartInstance } from './components/analytics-view.js';

// ============================================================================
// APPLICATION LIFECYCLE
// ============================================================================
export async function startApp(username) {
    if (AppState && typeof AppState.resetState === "function") {
        AppState.resetState();
    } else if (typeof window !== "undefined") {
        window.appData = {
            tasks: [],
            logs: {}
        };
    }

    if (awradyAPI) {
        const uid = authManager?.getCurrentUserId?.() || (typeof localStorage !== "undefined" ? localStorage.getItem("AWRAD_AUTH_UID") : null);
        awradyAPI.setCurrentUser(username, uid);
    }
    if (AppStore) {
        await AppStore.initData();
    } else if (typeof initData === "function") {
        await initData();
    }

    if (typeof window !== "undefined" && !window._appControlsBound) {
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
}

export function logoutApp() {
    if (AppState) {
        AppState.resetState();
    } else if (typeof window !== "undefined") {
        window.appData = {
            tasks: [],
            logs: {}
        };
    }
    const todayEl = document.getElementById("header-today-score");
    if (todayEl) todayEl.textContent = "0%";
    const container = document.getElementById("daily-tasks-grid");
    if (container) container.innerHTML = "";
}

// ============================================================================
// NAVIGATION & CONTROLS
// ============================================================================
export function setupNavigation() {
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

export async function switchActiveDate(newDate) {
    const activeDate = AppState ? AppState.getCurrentDate() : (typeof window !== "undefined" ? window.currentDateStr : null);
    if (!newDate || newDate === activeDate) return;

    if (AppState) {
        AppState.setCurrentDate(newDate);
    } else if (typeof window !== "undefined") {
        window.currentDateStr = newDate;
    }

    const datePicker = document.getElementById("date-picker-input");
    if (datePicker) datePicker.value = newDate;

    // 1. Instant optimistic render (0ms response)
    if (typeof renderDailyView === "function") {
        renderDailyView();
    }

    // 2. Non-blocking cloud fetch in background via AppStore
    if (AppStore?.fetchDayProgress) {
        AppStore.fetchDayProgress(newDate, () => {
            const current = AppState ? AppState.getCurrentDate() : (typeof window !== "undefined" ? window.currentDateStr : null);
            if (current === newDate && typeof renderDailyView === "function") {
                renderDailyView();
            }
        });
    }
}

export function setupDailyControls() {
    const datePicker = document.getElementById("date-picker-input");
    const dateDisplay = document.getElementById("current-date-display");
    const curDate = AppState ? AppState.getCurrentDate() : (typeof window !== "undefined" ? window.currentDateStr : null);

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
                datePicker.value = AppState ? AppState.getCurrentDate() : (typeof window !== "undefined" ? window.currentDateStr : null);
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
            const current = AppState ? AppState.getCurrentDate() : (typeof window !== "undefined" ? window.currentDateStr : null);
            switchActiveDate(addDays(current, -1));
        });
    }

    const btnNext = document.getElementById("btn-next-day");
    if (btnNext) {
        btnNext.addEventListener("click", () => {
            const current = AppState ? AppState.getCurrentDate() : (typeof window !== "undefined" ? window.currentDateStr : null);
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
export function calculateDayScore(dateStr, appDataRef = null, returnHours = false) {
    const data = appDataRef || (AppState ? AppState.getAppData() : (typeof window !== "undefined" ? window.appData : null));
    return ScoringEngine.calculateDayScore(dateStr, data, returnHours);
}

// Global attachments
if (typeof window !== "undefined") {
    window.startApp = startApp;
    window.logoutApp = logoutApp;
    window.setupNavigation = setupNavigation;
    window.switchActiveDate = switchActiveDate;
    window.setupDailyControls = setupDailyControls;
    window.calculateDayScore = calculateDayScore;

    window.addEventListener("online", () => {
        if (AppStore) {
            AppStore.syncAllDirtyDays();
        } else if (typeof syncAllDirtyDays === "function") {
            syncAllDirtyDays();
        }
    });

    window.addEventListener("beforeunload", () => {
        if (AppStore) {
            AppStore.flush();
        }
    });

    window.addEventListener("pagehide", () => {
        if (AppStore) {
            AppStore.flush();
        }
    });
}

// Bootstrapping on DOM ready
async function init() {
    if (typeof setupDataManagement === "function") {
        setupDataManagement();
    }
    if (authManager) {
        await authManager.init();
        if (authManager.isLoggedIn()) {
            await startApp(authManager.getCurrentUser());
        } else {
            authManager.show();
        }
    } else {
        console.warn("[App] AuthManager missing");
    }
}

if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
}
