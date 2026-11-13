/**
 * Awrady Dashboard - Scoring Engine
 * Weighted-average equation system, daily score aggregation, and time estimation.
 */

class ScoringEngine {
    /**
     * Returns the time weight (in minutes) for a task used in weighted-average scoring
     * @param {Object} task 
     * @param {number|null} [customTarget=null] Optional target override (e.g. daily target)
     * @returns {number} Weight in minutes
     */
    static getTaskWeightMinutes(task, customTarget = null) {
        if (!task) return 1;
        const targetVal = customTarget !== null 
            ? Number(customTarget) || 0 
            : ((task.target && task.target > 0) ? task.target : 1);
        if (targetVal <= 0) return 0;

        if (isTimeTask(task)) {
            return 60 * targetVal;
        }

        const cat = APP_CONSTANTS.CATEGORIES.find(c => c.name === task.category);
        const sub = (cat && task.subcategory) ? cat.subcategories?.find(s => s.name === task.subcategory) : null;
        const estMins = sub?.defaultEstimatedMinutes || cat?.defaultEstimatedMinutes || 1;

        // For large-count counter tasks (e.g. tasbeeh with target=100 repetitions),
        // defaultEstimatedMinutes represents the session duration, not minutes per repetition.
        if (targetVal > 30) {
            return estMins;
        }

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

        const isDirty = Boolean(log._dirty ||
            (log._dirtyTasks && Object.keys(log._dirtyTasks).length > 0));

        const todayStr = typeof getLocalTodayString === "function" ? getLocalTodayString() : new Date().toISOString().slice(0, 10);
        const isHistorical = dateStr < todayStr;

        // Freeze historical days: if clean and loaded from DB (or stored totals exist), return in O(1)
        if (isHistorical && !isDirty && log._loadedFromDB) {
            const storedScore = log.total_score ?? log.precomputedScore;
            const storedHours = log.total_hours ?? log.totalHours;
            if (storedScore !== undefined && storedScore !== null) {
                return returnHours ? (Number(storedHours) || 0) : (Number(storedScore) || 0);
            }
        }

        let reqWeightedScore = 0.0;
        let reqTotalWeight = 0.0;
        let bonusWeightedScore = 0.0;

        const dateContext = {
            dayAbbrev: getDayOfWeekAbbrev(dateStr),
            hijriInfo: getHijriDateDetails(dateStr)
        };

        (appData.tasks || []).forEach(task => {
            const tp = log.taskProgress?.[task.id];
            const val = Number(tp?.achieved) || 0;
            if (task.isArchived && val <= 0 && tp?.status !== "bonus") return;
            if (ScheduleEngine.isTaskDisabledForDate(task, log, appData)) return;

            const isBonus = tp?.status === "bonus" || Boolean(task.isBonus) || ScheduleEngine.isBonusTaskForDate(task, dateStr, appData, val, dateContext);
            const isScheduled = tp?.status === "scheduled" || (!isBonus && ScheduleEngine.isTaskScheduledForDate(task, dateStr, appData, val, dateContext));

            if (isScheduled || (isBonus && val > 0)) {
                const isTime = isTimeTask(task);
                const rawTarget = (typeof getTaskDayTarget === "function")
                    ? getTaskDayTarget(task, dateStr)
                    : ((task.target && task.target > 0) ? task.target : 1);
                const normTarget = isTime ? rawTarget * 60 : rawTarget;
                const taskRatio = normTarget > 0 ? (val / normTarget) : 0;
                const weight = ScoringEngine.getTaskWeightMinutes(task, rawTarget);

                if (isBonus) {
                    if (val > 0) bonusWeightedScore += taskRatio * weight;
                } else {
                    reqWeightedScore += taskRatio * weight;
                    reqTotalWeight += weight;
                }
            }
        });

        const calculatedScore = reqTotalWeight === 0
            ? (bonusWeightedScore > 0 ? 1.0 : (Number(log.total_score ?? log.precomputedScore) || 0))
            : (reqWeightedScore + bonusWeightedScore) / reqTotalWeight;
        const calculatedHours = (reqWeightedScore + bonusWeightedScore) / 60;

        // Cache precalculated values onto the log object
        log.precomputedScore = calculatedScore;
        log.totalHours = calculatedHours;

        return returnHours ? calculatedHours : calculatedScore;
    }

    /**
     * Invalidate cached day score and hours when task values change
     * @param {string} dateStr 
     * @param {Object} [appDataRef] 
     */
    static invalidateScoreCache(dateStr, appDataRef = null) {
        const appData = appDataRef || (typeof window !== "undefined" ? window.appData : null);
        if (appData?.logs?.[dateStr]) {
            delete appData.logs[dateStr].precomputedScore;
            delete appData.logs[dateStr].totalHours;
        }
    }
}

if (typeof window !== "undefined") {
    window.ScoringEngine = ScoringEngine;
    window.calculateDayScore = ScoringEngine.calculateDayScore.bind(ScoringEngine);
}
