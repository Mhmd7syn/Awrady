/**
 * Awrady Dashboard - Scoring Engine
 * Weighted-average equation system, daily score aggregation, and time estimation.
 */

class ScoringEngine {
    /**
     * Resolves the task time unit
     * @param {Object} task 
     * @returns {string}
     */
    static getTaskUnit(task) {
        if (typeof getTaskUnit === "function") return getTaskUnit(task);
        if (!task) return "تكرار";
        const cat = (typeof APP_CONSTANTS !== "undefined" ? APP_CONSTANTS.CATEGORIES : []).find(c => c.name === task.category);
        const sub = (cat && task.subcategory) ? cat.subcategories?.find(s => s.name === task.subcategory) : null;
        return sub?.defaultUnit || cat?.defaultUnit || task.type || "تكرار";
    }

    /**
     * Checks if a task is hour/time-based
     * @param {Object} task 
     * @returns {boolean}
     */
    static isTimeTask(task) {
        if (typeof isTimeTask === "function") return isTimeTask(task);
        const unit = ScoringEngine.getTaskUnit(task);
        return unit === "ساعة" || unit === "ساعات" || unit === "ساعات ودقايق" || unit === "وقت" || unit === "دقيقة";
    }

    /**
     * Returns the time weight (in minutes) for a task used in weighted-average scoring
     * @param {Object} task 
     * @returns {number} Weight in minutes
     */
    static getTaskWeightMinutes(task) {
        if (!task) return 1;
        const targetVal = (task.target && task.target > 0) ? task.target : 1;

        if (ScoringEngine.isTimeTask(task)) {
            return 60 * targetVal;
        }

        const cat = (typeof APP_CONSTANTS !== "undefined" ? APP_CONSTANTS.CATEGORIES : []).find(c => c.name === task.category);
        const sub = (cat && task.subcategory) ? cat.subcategories?.find(s => s.name === task.subcategory) : null;
        const estMins = sub?.defaultEstimatedMinutes || cat?.defaultEstimatedMinutes || 1;

        return estMins * targetVal;
    }

    /**
     * Calculates the overall completion score (0.0 to 1.0+) or total achieved hours for a given date.
     * @param {string} dateStr Format "YYYY-MM-DD"
     * @param {Object} [appDataRef] Optional data store reference
     * @param {boolean} [returnHours=false] If true, returns total achieved hours instead of score percentage ratio
     * @returns {number} Floating point score (e.g. 0.85 = 85%) or achieved hours if returnHours is true
     */
    static calculateDayScore(dateStr, appDataRef = null, returnHours = false) {
        const appData = appDataRef || (typeof window !== "undefined" ? window.appData : null);
        if (!appData || !appData.logs) return 0;

        const log = appData.logs[dateStr];
        if (!log) return 0;

        // If historical row has no task entries, return stored totals
        if (!log.entries || Object.keys(log.entries).length === 0) {
            if (returnHours) {
                return Number(log.total_hours ?? log.totalHours) || 0;
            }
            return Number(log.total_score ?? log.precomputedScore) || 0;
        }

        let reqWeightedScore = 0.0;
        let reqTotalWeight = 0.0;
        let bonusWeightedScore = 0.0;

        const disabledIds = log.disabledTaskIds || [];
        const dateContext = {
            dayAbbrev: getDayOfWeekAbbrev(dateStr),
            hijriInfo: getHijriDateDetails(dateStr)
        };

        (appData.tasks || []).forEach(task => {
            if (task.isArchived && (!log.entries || !log.entries[task.id])) return;
            if (disabledIds.includes(task.id)) return;

            const val = Number(log.entries?.[task.id]) || 0;
            const isBonus = ScheduleEngine.isBonusTaskForDate(task, dateStr, appData, val, dateContext);
            const isScheduled = ScheduleEngine.isTaskScheduledForDate(task, dateStr, appData, val, dateContext);

            if (isScheduled || (isBonus && val > 0)) {
                const target = (task.target && task.target > 0) ? task.target : 1;
                const isTime = ScoringEngine.isTimeTask(task);
                const normTarget = isTime ? target * 60 : target;
                const taskRatio = val / normTarget;
                const weight = ScoringEngine.getTaskWeightMinutes(task);

                if (isBonus) {
                    if (val > 0) bonusWeightedScore += taskRatio * weight;
                } else {
                    reqWeightedScore += taskRatio * weight;
                    reqTotalWeight += weight;
                }
            }
        });

        if (returnHours) {
            return (reqWeightedScore + bonusWeightedScore) / 60;
        }
        if (reqTotalWeight === 0) {
            return bonusWeightedScore > 0 ? 1.0 : (Number(log.total_score ?? log.precomputedScore) || 0);
        }
        return (reqWeightedScore + bonusWeightedScore) / reqTotalWeight;
    }

    // No-op cache invalidation kept for backward compatibility
    static invalidateScoreCache() {}
}

if (typeof window !== "undefined") {
    window.ScoringEngine = ScoringEngine;
}
