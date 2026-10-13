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
        const sched = (task.schedule || "Everyday").trim();
        const appData = appDataRef || (typeof window !== "undefined" ? window.appData : null);
        const val = loggedVal !== null ? loggedVal : (appData?.logs?.[dateStr]?.entries?.[task.id] || 0);

        if (sched === "OneTime") {
            const taskDate = (task.createdAt || "").slice(0, 10);
            return taskDate === dateStr || val > 0;
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
        if (sched === "Optional") return val > 0;

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
        if (log?.bonusTaskIds?.some(id => String(id) === String(task.id))) return true;

        const sched = (task.schedule || "").trim();
        if (sched === "Optional") return false;

        const val = loggedVal !== null ? loggedVal : (log?.entries?.[task.id] || 0);
        if (val <= 0) return false;

        if (sched === "OneTime") {
            const taskDate = (task.createdAt || "").slice(0, 10);
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
        const val = log?.entries?.[task.id] || 0;

        if (task.isArchived) return val > 0;
        if (log?.disabledTaskIds?.includes(task.id)) return true;
        if (log?.bonusTaskIds?.includes(task.id)) return true;
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
