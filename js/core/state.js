/**
 * ============================================================================
 * AWRAD PRO - STATE MANAGEMENT (AppState)
 * Manages active date, in-memory day logs, task selections, and reactive state.
 * ============================================================================
 */

import { APP_CONSTANTS } from '../config/constants.js';
import { getLocalTodayString, getDayOfWeekAbbrev, getHijriDateDetails } from '../utils/date-utils.js';
import { ScheduleEngine } from './schedule-engine.js';
import { getTaskNormalizedTarget } from './task-rules.js';
import { ScoringEngine } from './scoring-engine.js';

// Internal reactive state container
let _currentDateStr = typeof getLocalTodayString === "function"
    ? getLocalTodayString()
    : new Date().toISOString().slice(0, 10);

let _appData = {
    tasks: [],
    logs: {}
};

export function ensureCategoriesProperty(target) {
    if (!target) return;
    try {
        Object.defineProperty(target, "categories", {
            get: () => (typeof APP_CONSTANTS !== "undefined" ? APP_CONSTANTS.CATEGORIES : []),
            enumerable: false,
            configurable: true
        });
    } catch (_) {}
}

ensureCategoriesProperty(_appData);

const _dateListeners = new Set();
const _stateListeners = new Set();

export const AppState = {
    /**
     * Get current active date string (YYYY-MM-DD)
     */
    getCurrentDate() {
        return _currentDateStr;
    },

    /**
     * Set current active date string (YYYY-MM-DD)
     */
    setCurrentDate(dateStr) {
        if (!dateStr || dateStr === _currentDateStr) return _currentDateStr;
        _currentDateStr = dateStr;
        this._notifyDateChange(dateStr);
        return _currentDateStr;
    },

    /**
     * Get in-memory appData object
     */
    getAppData() {
        return _appData;
    },

    /**
     * Replace in-memory appData object
     */
    setAppData(newData) {
        if (!newData || typeof newData !== "object") return;
        _appData = newData;
        if (!_appData.tasks) _appData.tasks = [];
        if (!_appData.logs) _appData.logs = {};
        ensureCategoriesProperty(_appData);
        this._notifyStateChange("appData", _appData);
    },

    /**
     * Get all tasks array
     */
    getTasks() {
        return _appData.tasks || [];
    },

    /**
     * Set tasks array
     */
    setTasks(tasks) {
        _appData.tasks = Array.isArray(tasks) ? tasks : [];
        this._notifyStateChange("tasks", _appData.tasks);
    },

    /**
     * Get all day logs
     */
    getLogs() {
        return _appData.logs || {};
    },

    /**
     * Get day log for a specific date
     */
    getDayLog(dateStr) {
        const curDate = dateStr || _currentDateStr;
        return _appData.logs?.[curDate] || null;
    },

    /**
     * Set or update a day log
     */
    setDayLog(dateStr, log) {
        if (!dateStr) return;
        if (!_appData.logs) _appData.logs = {};
        _appData.logs[dateStr] = log;
        this._notifyStateChange("log", { date: dateStr, log });
    },

    /**
     * Remove day log for a specific date
     */
    removeDayLog(dateStr) {
        if (!dateStr || !_appData.logs) return;
        delete _appData.logs[dateStr];
        this._notifyStateChange("logRemoved", dateStr);
    },

    /**
     * Ensure a day log record exists, with scheduled tasks populated.
     */
    ensureDayRecord(dateStr) {
        const targetDate = dateStr || _currentDateStr;
        if (!_appData) return null;
        if (!_appData.logs) _appData.logs = {};

        if (!_appData.logs[targetDate]) {
            _appData.logs[targetDate] = {
                taskProgress: {},
                prayerExtras: {}
            };
            const dateContext = {
                dayAbbrev: typeof getDayOfWeekAbbrev === "function" ? getDayOfWeekAbbrev(targetDate) : "",
                hijriInfo: typeof getHijriDateDetails === "function" ? getHijriDateDetails(targetDate) : null
            };
            (_appData.tasks || []).forEach(t => {
                if (t.isArchived) return;
                if (typeof ScheduleEngine !== "undefined" && ScheduleEngine.isTaskScheduledForDate(t, targetDate, _appData, 0, dateContext)) {
                    const normTarget = typeof getTaskNormalizedTarget === "function"
                        ? getTaskNormalizedTarget(t, targetDate)
                        : (Number(t.target) || 1);
                    _appData.logs[targetDate].taskProgress[t.id] = {
                        target: normTarget,
                        achieved: 0,
                        status: "scheduled"
                    };
                }
            });
        }

        if (!_appData.logs[targetDate].taskProgress) _appData.logs[targetDate].taskProgress = {};
        if (!_appData.logs[targetDate].prayerExtras) _appData.logs[targetDate].prayerExtras = {};

        return _appData.logs[targetDate];
    },

    /**
     * Mark a task as modified (dirty) on a given date
     */
    markTaskDirty(dateStr, taskId, timestamp = Date.now()) {
        const log = this.ensureDayRecord(dateStr);
        if (!log) return;
        if (!log._dirtyTasks) log._dirtyTasks = {};
        log._dirtyTasks[taskId] = timestamp;
        log._dirty = true;
        if (typeof ScoringEngine !== "undefined" && ScoringEngine.invalidateScoreCache) {
            ScoringEngine.invalidateScoreCache(dateStr, _appData);
        }
    },

    /**
     * Clear dirty state for a task on a given date
     */
    clearTaskDirty(dateStr, taskId) {
        const log = _appData.logs?.[dateStr];
        if (!log || !log._dirtyTasks) return;
        delete log._dirtyTasks[taskId];
        log._dirty = Object.keys(log._dirtyTasks).length > 0;
    },

    /**
     * Check if a day has pending unsaved local mutations
     */
    isDayDirty(dateStr) {
        const log = _appData.logs?.[dateStr];
        if (!log) return false;
        return Boolean(log._dirty || (log._dirtyTasks && Object.keys(log._dirtyTasks).length > 0));
    },

    /**
     * Reset in-memory state to clean tasks and empty logs
     */
    resetState(tasks = []) {
        _appData = {
            tasks: Array.isArray(tasks) ? tasks : [],
            logs: {}
        };
        ensureCategoriesProperty(_appData);
        this._notifyStateChange("reset", _appData);
    },

    /**
     * Subscribe to active date changes
     */
    onDateChange(callback) {
        if (typeof callback === "function") {
            _dateListeners.add(callback);
            return () => _dateListeners.delete(callback);
        }
    },

    /**
     * Subscribe to state changes
     */
    onStateChange(callback) {
        if (typeof callback === "function") {
            _stateListeners.add(callback);
            return () => _stateListeners.delete(callback);
        }
    },

    _notifyDateChange(dateStr) {
        _dateListeners.forEach(cb => {
            try { cb(dateStr); } catch (e) { console.error("[AppState] Date listener error:", e); }
        });
    },

    _notifyStateChange(type, payload) {
        _stateListeners.forEach(cb => {
            try { cb(type, payload); } catch (e) { console.error("[AppState] State listener error:", e); }
        });
    }
};

// Maintain backwards-compatible global bindings
if (typeof window !== "undefined") {
    try {
        Object.defineProperty(window, "currentDateStr", {
            get: () => _currentDateStr,
            set: (v) => { AppState.setCurrentDate(v); },
            configurable: true
        });

        Object.defineProperty(window, "appData", {
            get: () => _appData,
            set: (v) => { AppState.setAppData(v); },
            configurable: true
        });
    } catch (_) {
        window.currentDateStr = _currentDateStr;
        window.appData = _appData;
    }

    window.ensureDayRecord = (dateStr) => AppState.ensureDayRecord(dateStr);
    window.AppState = AppState;
}
