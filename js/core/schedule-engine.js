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
        if (task.isArchived) return false;
        const appData = appDataRef || (typeof window !== "undefined" ? window.appData : null);
        const log = appData?.logs?.[dateStr];
        const val = loggedVal !== null ? loggedVal : (log?.entries?.[task.id] || 0);

        // Historical DB snapshot: preserve past scheduled status from recorded target
        if (log?._loadedFromDB && log.taskProgress && log.taskProgress[task.id] !== undefined) {
            const tp = log.taskProgress[task.id];
            if (typeof tp === "object" && tp !== null) {
                if (tp.status !== undefined) return tp.status === "scheduled";
                if (tp.isBonus) return false;
                const target = Number(tp.target);
                if (target === 0) return false;
                if (target > 0) return true;
            } else if (Number(tp) > 0) {
                return true;
            }
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

        const tp = log?.taskProgress?.[task.id];
        if (tp && typeof tp === "object") {
            if (tp.status !== undefined) return tp.status === "bonus";
            if (tp.isBonus !== undefined) return Boolean(tp.isBonus);
            const target = Number(tp.target);
            if (target > 0) return false;
        }

        if (log?.disabledTaskIds?.includes(task.id)) return false;

        if (task.isBonus) return true;

        if (task.isArchived) {
            return false;
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

        const val = (log?.entries && log.entries[task.id] !== undefined) ? (Number(log.entries[task.id]) || 0) : 0;
        const tp = log?.taskProgress?.[task.id];
        const recordedTarget = typeof tp === "object" && tp !== null ? Number(tp.target) : Number(tp);
        const status = typeof tp === "object" && tp !== null ? tp.status : null;
        const isExplicitBonus = status === "bonus" || Boolean(tp?.isBonus) || Boolean(log?.entries && log.entries[task.id] !== undefined && log?._dirtyTasks?.[task.id]);

        // Archived tasks are ONLY visible if they have actual achieved progress (val > 0) or are an explicit bonus
        if (task.isArchived) {
            return status === "bonus" || val > 0;
        }

        if (status === "bonus" || isExplicitBonus) return true;
        if (status === "disabled" || log?.disabledTaskIds?.includes(task.id)) return true;

        if (log?._loadedFromDB && log.taskProgress) {
            if (log.taskProgress[task.id] !== undefined) {
                if (status === "scheduled") return true;
                if (!status && recordedTarget > 0) return true;
                if (val > 0) return true;
                if (ScheduleEngine.isTaskScheduledForDate(task, dateStr, appData, val)) return true;
            }
            return false;
        }

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
