/**
 * Awrady Dashboard - Schedule & Task Eligibility Engine
 * Pure logic for task scheduling, bonus task detection, and date visibility.
 */

class ScheduleEngine {
    /**
     * Checks if a task is scheduled for a given date
     * @param {Object} task 
     * @param {string} dateStr 
     * @param {Object} [appDataRef] 
     * @param {number|null} [loggedVal=null] 
     * @param {Object|null} [dateContext=null] Optional pre-resolved { dayAbbrev, hijriInfo }
     * @returns {boolean}
     */
    static isTaskScheduledForDate(task, dateStr, appDataRef = null, loggedVal = null, dateContext = null) {
        if (!task) return false;
        if (task.isBonus) return false;
        const appData = appDataRef || (typeof window !== "undefined" ? window.appData : null);
        const log = appData?.logs?.[dateStr];
        if (log?.bonusTaskIds?.includes(task.id)) return false;
        const val = loggedVal !== null ? loggedVal : (log?.entries?.[task.id] || 0);

        // Historical DB snapshot: preserve past scheduled status from recorded target
        if (log?._loadedFromDB && log.taskProgress && log.taskProgress[task.id] !== undefined) {
            const tp = log.taskProgress[task.id];
            const target = typeof tp === "object" && tp !== null ? Number(tp.target) : Number(tp);
            if (target === 0) return false;
            if (target > 0) return true;
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
        if (!task) return false;
        const appData = appDataRef || (typeof window !== "undefined" ? window.appData : null);
        const log = appData?.logs?.[dateStr];
        const val = loggedVal !== null ? loggedVal : (log?.entries?.[task.id] || 0);

        // Historical DB snapshot: preserve past bonus status from recorded target & achievement
        if (log?._loadedFromDB && log.taskProgress && log.taskProgress[task.id] !== undefined) {
            const tp = log.taskProgress[task.id];
            const target = typeof tp === "object" && tp !== null ? Number(tp.target) : Number(tp);
            if (target === 0) return true;
            if (target > 0) return false;
        }

        if (task.isBonus || log?.bonusTaskIds?.includes(task.id)) {
            return true;
        }

        const sched = (task.schedule || "").trim();
        if (sched === "OneTime") {
            const taskDate = (task.oneTimeDate || task.createdAt || "").slice(0, 10);
            return taskDate !== dateStr;
        }

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
        const hasEntry = log?.entries && log.entries[task.id] !== undefined;
        const val = (hasEntry ? log.entries[task.id] : 0) || 0;

        if (task.isArchived) return val > 0;
        if (log?.disabledTaskIds?.includes(task.id)) return true;
        if (hasEntry) return true;

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
