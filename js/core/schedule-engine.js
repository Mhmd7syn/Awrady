/**
 * Awrady Dashboard - Schedule & Task Eligibility Engine
 * Pure logic for task history resolution, schedule matching, bonus task detection, and prayer categorization.
 */

class ScheduleEngine {
    /**
     * Resolves effective task properties for a specific historical date
     * Memoized per task and dateStr in task._effPropsCache
     * @param {Object} task 
     * @param {string} dateStr YYYY-MM-DD
     * @param {Object} [dateContext] Optional pre-resolved { dayAbbrev, hijriInfo }
     * @returns {Object} Effective properties object
     */
    static getTaskEffectiveProps(task, dateStr, dateContext = null) {
        if (!task) return null;

        if (dateStr && task._effPropsCache && task._effPropsCache[dateStr]) {
            return task._effPropsCache[dateStr];
        }

        const defaultProps = {
            name: task.name,
            target: task.target,
            type: task.type,
            schedule: task.schedule,
            multiplier: task.multiplier,
            category: task.category,
            subcategory: task.subcategory,
            isBonus: task.isBonus,
            comment: task.comment,
            isOneTime: !!(task.isOneTime || (task.schedule === "OneTime")),
            oneTimeDate: task.oneTimeDate || null,
            dayTargets: task.dayTargets || null
        };

        if (!dateStr || !task.history || !Array.isArray(task.history) || task.history.length === 0) {
            let effTarget = defaultProps.target;
            if (defaultProps.dayTargets && dateStr) {
                const dayAbbrev = (dateContext && dateContext.dayAbbrev) || (typeof getDayOfWeekAbbrev === "function" ? getDayOfWeekAbbrev(dateStr) : "");
                if (defaultProps.dayTargets[dayAbbrev] !== undefined) {
                    effTarget = defaultProps.dayTargets[dayAbbrev];
                }
            }
            const res = {
                ...defaultProps,
                target: effTarget
            };
            if (dateStr) {
                if (!task._effPropsCache) task._effPropsCache = {};
                task._effPropsCache[dateStr] = res;
            }
            return res;
        }

        if (!task._sortedHistory) {
            task._sortedHistory = [...task.history].sort((a, b) => (a.effectiveFrom || "").localeCompare(b.effectiveFrom || ""));
        }
        const sorted = task._sortedHistory;

        let match = null;
        for (let entry of sorted) {
            if (entry.effectiveFrom && entry.effectiveFrom <= dateStr) {
                match = entry;
            } else if (entry.effectiveFrom && entry.effectiveFrom > dateStr) {
                break;
            }
        }

        if (!match && sorted.length > 0) {
            match = sorted[0];
        }

        let effTarget = (match && match.target !== undefined) ? match.target : defaultProps.target;
        const dayTargets = match ? (match.dayTargets || null) : defaultProps.dayTargets;
        if (dayTargets && dateStr) {
            const dayAbbrev = (dateContext && dateContext.dayAbbrev) || (typeof getDayOfWeekAbbrev === "function" ? getDayOfWeekAbbrev(dateStr) : "");
            if (dayTargets[dayAbbrev] !== undefined) {
                effTarget = dayTargets[dayAbbrev];
            }
        }

        const isOneTime = match ? (match.isOneTime !== undefined ? match.isOneTime : (match.schedule === "OneTime")) : defaultProps.isOneTime;

        let res;
        if (match) {
            res = {
                name: match.name !== undefined ? match.name : defaultProps.name,
                target: effTarget,
                type: match.type !== undefined ? match.type : defaultProps.type,
                schedule: match.schedule !== undefined ? match.schedule : defaultProps.schedule,
                multiplier: match.multiplier !== undefined ? match.multiplier : defaultProps.multiplier,
                category: match.category !== undefined ? match.category : defaultProps.category,
                subcategory: match.subcategory !== undefined ? match.subcategory : defaultProps.subcategory,
                isBonus: match.isBonus !== undefined ? match.isBonus : defaultProps.isBonus,
                comment: match.comment !== undefined ? match.comment : defaultProps.comment,
                isOneTime: isOneTime,
                oneTimeDate: match.oneTimeDate !== undefined ? match.oneTimeDate : defaultProps.oneTimeDate,
                dayTargets: dayTargets
            };
        } else {
            res = {
                ...defaultProps,
                target: effTarget
            };
        }

        if (dateStr) {
            if (!task._effPropsCache) task._effPropsCache = {};
            task._effPropsCache[dateStr] = res;
        }
        return res;
    }

    /**
     * Checks if a task is classified as a bonus task on a specific date
     * @param {Object} task 
     * @param {string} dateStr 
     * @param {Object} [appDataRef] Optional state object reference
     * @param {number|null} [loggedVal=null] 
     * @param {Object|null} [dateContext=null] Optional pre-resolved { dayAbbrev, hijriInfo }
     * @returns {boolean}
     */
    static isBonusTaskForDate(task, dateStr, appDataRef = null, loggedVal = null, dateContext = null) {
        if (!task) return false;
        const appData = appDataRef || (typeof window !== "undefined" ? window.appData : null);
        const effProps = ScheduleEngine.getTaskEffectiveProps(task, dateStr, dateContext);

        const log = (appData && appData.logs) ? appData.logs[dateStr] : null;
        if (log && log.bonusTaskIds && Array.isArray(log.bonusTaskIds)) {
            if (log.bonusTaskIds.some(id => String(id) === String(task.id))) {
                return true;
            }
        }

        if ((effProps && effProps.isBonus) || task.isBonus) return true;

        const sched = (effProps.schedule || task.schedule || "").trim();
        const isOneTime = (effProps && effProps.isOneTime !== undefined) ? effProps.isOneTime : (task.isOneTime || sched === "OneTime");
        const targetDate = task.oneTimeDate || (effProps && effProps.oneTimeDate);

        if (isOneTime) {
            if (targetDate === dateStr) {
                return false;
            }
            const val = (loggedVal !== null) ? loggedVal : ((log && log.entries) ? (log.entries[task.id] || 0) : 0);
            return val > 0;
        }

        const val = (loggedVal !== null) ? loggedVal : ((log && log.entries) ? (log.entries[task.id] || 0) : 0);
        const isEveryday = (sched === "Everyday" || sched === "" || sched.toLowerCase() === "everyday");
        const dayAbbrev = (dateContext && dateContext.dayAbbrev) || (typeof getDayOfWeekAbbrev === "function" ? getDayOfWeekAbbrev(dateStr) : "");

        if (!isEveryday && !sched.includes(dayAbbrev) && sched !== "WhiteDays" && sched !== "Ramadan") {
            return val > 0;
        }
        return false;
    }

    /**
     * Universal schedule check for a task on a specific date
     * @param {Object} task 
     * @param {string} dateStr 
     * @param {Object} [appDataRef] 
     * @param {number|null} [loggedVal=null] 
     * @param {Object|null} [dateContext=null] Optional pre-resolved { dayAbbrev, hijriInfo }
     * @returns {boolean}
     */
    static isTaskScheduledForDate(task, dateStr, appDataRef = null, loggedVal = null, dateContext = null) {
        if (!task) return false;
        let actualAppData = appDataRef;
        let actualVal = loggedVal;
        let actualDateContext = dateContext;

        if (typeof appDataRef === "number" && loggedVal === null) {
            actualVal = appDataRef;
            actualAppData = null;
        } else if (typeof loggedVal === "object" && loggedVal !== null && dateContext === null && (loggedVal.dayAbbrev !== undefined || loggedVal.hijriInfo !== undefined)) {
            actualDateContext = loggedVal;
            actualVal = null;
        }

        const appData = actualAppData || (typeof window !== "undefined" ? window.appData : null);
        const log = (appData && appData.logs) ? appData.logs[dateStr] : null;
        const val = (actualVal !== null) ? actualVal : ((log && log.entries) ? (log.entries[task.id] || 0) : 0);

        const effProps = ScheduleEngine.getTaskEffectiveProps(task, dateStr, actualDateContext);
        const sched = ((effProps && effProps.schedule) || task.schedule || "Everyday").trim();

        // Explicit bonus task check for this date or logged progress
        if (log && log.bonusTaskIds && Array.isArray(log.bonusTaskIds) && log.bonusTaskIds.some(id => String(id) === String(task.id))) {
            return true;
        }
        if (val > 0) {
            return true;
        }

        // OneTime task check: if target date matches dateStr, it's valid regardless of creation date
        const isOneTime = (effProps && effProps.isOneTime !== undefined) ? effProps.isOneTime : (task.isOneTime || sched === "OneTime");
        if (isOneTime || sched === "OneTime") {
            const isTargetDate = (task.oneTimeDate || (effProps && effProps.oneTimeDate)) === dateStr;
            if (isTargetDate) return true;
            return false;
        }

        const taskCreatedDateStr = (task.createdAt || "2000-01-01").slice(0, 10);
        if (taskCreatedDateStr && dateStr < taskCreatedDateStr && val === 0) {
            return false;
        }

        const dayAbbrev = (actualDateContext && actualDateContext.dayAbbrev) || (typeof getDayOfWeekAbbrev === "function" ? getDayOfWeekAbbrev(dateStr) : "");
        const hijriInfo = (actualDateContext && actualDateContext.hijriInfo) || (typeof getHijriDateDetails === "function" ? getHijriDateDetails(dateStr) : { isWhiteDay: false, isRamadan: false });

        const taskCat = effProps.category || task.category;
        const taskType = effProps.type || task.type;
        const taskName = effProps.name || task.name;

        const isFastingCategory = (taskCat === "صيام" || taskCat === "صوم" || taskType === "صوم" || (taskName && (taskName.includes("صيام") || taskName.includes("صوم"))));

        if (hijriInfo.isRamadan && isFastingCategory) {
            return true;
        }

        if (sched === "WhiteDays" || sched.includes("WhiteDays") || sched.includes("البيض")) {
            return hijriInfo.isWhiteDay;
        }

        if (sched === "Everyday" || sched === "") return true;
        if (sched === "Ramadan") return hijriInfo.isRamadan;
        if (sched === "Optional") return false;

        if (sched.includes(dayAbbrev)) return true;

        return false;
    }

    /**
     * Clears cached properties and sorted history on a task or all tasks
     * @param {Object} [task] 
     */
    static invalidateTaskCache(task) {
        if (!task) return;
        task._effPropsCache = null;
        task._sortedHistory = null;
    }

    static clearAllCaches(tasks) {
        if (Array.isArray(tasks)) {
            tasks.forEach(t => ScheduleEngine.invalidateTaskCache(t));
        } else if (typeof window !== "undefined" && window.appData && Array.isArray(window.appData.tasks)) {
            window.appData.tasks.forEach(t => ScheduleEngine.invalidateTaskCache(t));
        }
    }

    /**
     * Check if a task uses the prayer selector control (Fard prayers or custom prayer selectors)
     * @param {Object} task 
     * @returns {boolean}
     */
    static isPrayerSelector(task) {
        if (!task) return false;
        if (task.type === "صلاة" || task.type === "prayer_selector") return true;
        if (task.category === "صلاة" && (task.subcategory === "فرض" || task.type === "صلاة")) return true;
        return false;
    }

    /**
     * Check if task ID corresponds to one of the 5 obligatory Fard prayers
     * @param {string} taskId 
     * @returns {boolean}
     */
    static isObligatoryPrayerTask(taskId) {
        return ["task_fajr", "task_dhuhr", "task_asr", "task_maghrib", "task_isha"].includes(taskId);
    }
}

if (typeof window !== "undefined") {
    window.ScheduleEngine = ScheduleEngine;
}
