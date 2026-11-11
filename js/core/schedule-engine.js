/**
 * Awrady Dashboard - Schedule & Task Eligibility Engine
 * Pure logic for task scheduling, bonus task detection, and date visibility.
 */

class ScheduleEngine {
    /**
     * Checks if a task is deactivated / stopped for a given date or day log
     * @param {Object} task 
     * @param {string|Object} dateOrLog Date string (YYYY-MM-DD) or day log object
     * @param {Object} [appDataRef] 
     * @returns {boolean}
     */
    static isTaskDisabledForDate(task, dateOrLog, appDataRef = null) {
        if (!task) return false;
        const appData = appDataRef || (typeof window !== "undefined" ? window.appData : null);
        const log = typeof dateOrLog === "string" ? appData?.logs?.[dateOrLog] : dateOrLog;
        if (!log) return false;

        const tp = log.taskProgress?.[task.id];
        if (tp && typeof tp === "object" && tp.status !== undefined) {
            return tp.status === "disabled";
        }
        if (Array.isArray(log.disabledTaskIds) && log.disabledTaskIds.includes(task.id)) {
            return true;
        }
        if (tp && tp.status === undefined && Number(tp.target) === 0 && (Number(tp.achieved) || 0) === 0) {
            return true;
        }
        return false;
    }

    /**
     * Checks if a task is scheduled for a given date
     * @param {Object} task 
     * @param {string} dateStr 
     * @param {Object} [appDataRef] 
     * @param {number|null} [loggedVal=null] 
     * @param {Object|null} [dateContext=null] Optional pre-resolved { dayAbbrev, hijriInfo }
     * @param {boolean} [allowArchived=false] Allow checking schedule rules for archived tasks
     * @returns {boolean}
     */
    static isTaskScheduledForDate(task, dateStr, appDataRef = null, loggedVal = null, dateContext = null, allowArchived = false) {
        if (!task || task.isBonus || (!allowArchived && task.isArchived)) return false;
        const appData = appDataRef || (typeof window !== "undefined" ? window.appData : null);
        const log = appData?.logs?.[dateStr];
        const val = loggedVal !== null ? loggedVal : (Number(log?.taskProgress?.[task.id]?.achieved) || 0);

        // Database snapshot: explicit status is the single source of truth
        const tp = log?.taskProgress?.[task.id];
        if (tp && typeof tp === "object" && tp.status !== undefined) {
            return tp.status === "scheduled";
        }

        if (ScheduleEngine.isTaskDisabledForDate(task, log, appData)) {
            return false;
        }

        const sched = (task.schedule || "Everyday").trim();

        if (sched === "OneTime") {
            const taskDate = (task.oneTimeDate || task.createdAt || "").slice(0, 10);
            return taskDate === dateStr;
        }

        const taskCreated = (task.createdAt || "2000-01-01").slice(0, 10);
        if (dateStr < taskCreated && val === 0) return false;

        const hijriInfo = dateContext?.hijriInfo || getHijriDateDetails(dateStr);
        const dayAbbrev = dateContext?.dayAbbrev || getDayOfWeekAbbrev(dateStr);

        const isFasting = task.category === "صوم" || (task.name && (task.name.includes("صيام") || task.name.includes("صوم")));
        if (hijriInfo.isRamadan && isFasting) return true;

        if (sched.includes("WhiteDays")) return hijriInfo.isWhiteDay;
        if (sched === "Everyday" || sched === "") return true;
        if (sched === "Ramadan") return hijriInfo.isRamadan;

        return sched.includes(dayAbbrev);
    }

    /**
     * Checks if a task is classified as a bonus task on a specific date
     * @param {Object} task 
     * @param {string} dateStr 
     * @param {Object} [appDataRef] 
     * @param {number|null} [loggedVal=null] 
     * @param {Object|null} [dateContext=null] 
     * @returns {boolean}
     */
    static isBonusTaskForDate(task, dateStr, appDataRef = null, loggedVal = null, dateContext = null) {
        if (!task || task.isArchived) return false;
        const appData = appDataRef || (typeof window !== "undefined" ? window.appData : null);
        const log = appData?.logs?.[dateStr];

        // Database snapshot: explicit status is the single source of truth
        const tp = log?.taskProgress?.[task.id];
        if (tp && typeof tp === "object" && tp.status !== undefined) {
            return tp.status === "bonus";
        }

        if (tp?.status === "disabled") return false;
        if (task.isBonus) return true;

        const sched = (task.schedule || "").trim();
        if (sched === "OneTime") {
            const taskDate = (task.oneTimeDate || task.createdAt || "").slice(0, 10);
            return taskDate !== dateStr;
        }

        const val = loggedVal !== null ? loggedVal : (Number(log?.taskProgress?.[task.id]?.achieved) || 0);
        return !ScheduleEngine.isTaskScheduledForDate(task, dateStr, appData, val, dateContext);
    }

    /**
     * Determines whether a task should appear on a given date's view
     * @param {Object} task 
     * @param {string} dateStr 
     * @param {Object} [appDataRef] 
     * @returns {boolean}
     */
    static isVisibleOn(task, dateStr, appDataRef = null) {
        if (!task) return false;
        const appData = appDataRef || (typeof window !== "undefined" ? window.appData : null);
        const log = appData?.logs?.[dateStr];

        // 1. Saved Database Snapshot: taskProgress is the definitive source of truth
        if (log?._loadedFromDB && log.taskProgress) {
            const tp = log.taskProgress[task.id];
            if (!tp) return false;
            if (task.isArchived) {
                return tp.status === "bonus" || (Number(tp.achieved) || 0) > 0;
            }
            return true;
        }

        // 2. Unsaved / Live day checks
        const tp = log?.taskProgress?.[task.id];
        const val = Number(tp?.achieved) || 0;

        if (task.isArchived) {
            return tp?.status === "bonus" || val > 0;
        }

        if (tp?.status === "bonus" || ScheduleEngine.isTaskDisabledForDate(task, log, appData)) return true;

        if (val > 0) return true;

        return ScheduleEngine.isTaskScheduledForDate(task, dateStr, appData, val);
    }

    /**
     * Direct property accessor for backward compatibility
     */
    static getTaskEffectiveProps(task) {
        return task;
    }

    static invalidateTaskCache() {}
}

if (typeof window !== "undefined") {
    window.ScheduleEngine = ScheduleEngine;
}
