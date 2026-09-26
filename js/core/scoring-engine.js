/**
 * Awrady Dashboard - Scoring Engine
 * Weighted-average equation system, daily score aggregation, time estimation, and streak statistics.
 */

class ScoringEngine {
    /**
     * Returns the time weight (in minutes) for a task used in weighted-average scoring
     * @param {Object} task 
     * @param {string|null} [dateStr=null] 
     * @param {Object} [appDataRef] 
     * @returns {number} Weight in minutes
     */
    static getTaskWeightMinutes(task, dateStr = null, appDataRef = null) {
        if (!task) return 1;
        const appData = appDataRef || (typeof window !== "undefined" ? window.appData : null);
        const effProps = dateStr && typeof ScheduleEngine !== "undefined" 
            ? ScheduleEngine.getTaskEffectiveProps(task, dateStr) 
            : task;

        const targetVal = (effProps.target && effProps.target > 0) ? effProps.target : (task.target && task.target > 0 ? task.target : 1);
        const catName = effProps.category || task.category;
        const subcatName = effProps.subcategory || task.subcategory;
        const typeVal = effProps.type || task.type;

        if (typeVal === "ساعة" || typeVal === "ساعات" || typeVal === "ساعات ودقايق" || typeVal === "وقت" || catName === "خروج") {
            return 60 * targetVal;
        }

        const cat = appData && appData.categories ? appData.categories.find(c => c.name === catName) : null;
        const sub = (cat && subcatName && cat.subcategories) ? cat.subcategories.find(s => s.name === subcatName) : null;

        // Resolve estimated minutes per unit (Subcategory -> Category -> Hour/Unit Fallback -> 1)
        let estMins = (sub && sub.defaultEstimatedMinutes > 0) ? sub.defaultEstimatedMinutes
            : ((cat && cat.defaultEstimatedMinutes > 0) ? cat.defaultEstimatedMinutes : null);

        if (!estMins) {
            const unit = (sub && sub.defaultUnit) || (cat && cat.defaultUnit) || typeVal;
            if (unit === "ساعة" || unit === "ساعات" || unit === "ساعات ودقايق" || unit === "وقت") {
                estMins = 60;
            } else {
                estMins = 1;
            }
        }

        return estMins * targetVal;
    }

    /**
     * Calculates the overall completion score (0.0 to 1.0+) or total achieved hours for a given date.
     * Clean Mathematical Model:
     * - Required Tasks Weight (W_req) = Sum of (weight_i) for scheduled required tasks
     * - Required Tasks Score (S_req) = Sum of (ratio_i * weight_i) for scheduled required tasks
     * - Bonus Tasks Score (S_bonus) = Sum of (ratio_j * weight_j) for bonus tasks with logged progress (val > 0)
     * - Final Score = (S_req + S_bonus) / W_req
     * 
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

        let reqWeightedScore = 0.0;
        let reqTotalWeight = 0.0;
        let bonusWeightedScore = 0.0;

        const disabledIds = log.disabledTaskIds || log.deactivatedTaskIds || [];

        (appData.tasks || []).forEach(task => {
            if (task.parentTaskId || task.isArchived) return;
            if (disabledIds.includes(task.id)) return;

            const val = (log.entries && log.entries[task.id] !== undefined) ? log.entries[task.id] : 0;
            const isBonus = typeof ScheduleEngine !== "undefined" 
                ? ScheduleEngine.isBonusTaskForDate(task, dateStr, appData) 
                : !!task.isBonus;
            const isScheduled = typeof ScheduleEngine !== "undefined" 
                ? ScheduleEngine.isTaskScheduledForDate(task, dateStr, appData, val) 
                : true;

            if (isScheduled || (isBonus && val > 0)) {
                const effProps = typeof ScheduleEngine !== "undefined" 
                    ? ScheduleEngine.getTaskEffectiveProps(task, dateStr) 
                    : task;

                const target = (effProps.target && effProps.target > 0) ? effProps.target : 1;
                const multiplier = effProps.multiplier !== undefined ? effProps.multiplier : 1.0;
                const type = effProps.type || task.type;
                const cat = effProps.category || task.category;
                let normVal = Number(val) || 0;
                let normTarget = target;
                let isHourBased = (type === "ساعة" || type === "ساعات ودقايق" || type === "وقت" || type === "ساعات" || cat === "خروج");
                if (!isHourBased && normVal > 24 && (cat === "مذاكرة" || cat === "شغل" || cat === "استماع")) {
                    isHourBased = true;
                }
                if (isHourBased) {
                    normTarget = target * 60;
                }

                let taskRatio = 0.0;
                if (task.pairedTaskId) {
                    const pairedVal = (log.entries && log.entries[task.pairedTaskId]) || 0;
                    const pairedTask = appData.tasks.find(t => t.id === task.pairedTaskId);
                    const pairedEff = pairedTask && typeof ScheduleEngine !== "undefined" 
                        ? ScheduleEngine.getTaskEffectiveProps(pairedTask, dateStr) 
                        : null;
                    const pairedMult = pairedEff ? (pairedEff.multiplier || 0.5) : 0.5;
                    taskRatio = ((normVal * multiplier) + (pairedVal * pairedMult)) / normTarget;
                } else {
                    taskRatio = (normVal * multiplier) / normTarget;
                }

                const weight = ScoringEngine.getTaskWeightMinutes(task, dateStr, appData);

                if (isBonus) {
                    if (val > 0) {
                        bonusWeightedScore += taskRatio * weight;
                    }
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
            if (bonusWeightedScore > 0) return 1.0;
            if (log.precomputedScore !== undefined && log.precomputedScore !== null) {
                return log.precomputedScore;
            }
            if (log.legacyTotalScore !== undefined && log.legacyTotalScore !== null) {
                return log.legacyTotalScore;
            }
            return 0;
        }

        return (reqWeightedScore + bonusWeightedScore) / reqTotalWeight;
    }

    /**
     * Updates header today score display
     */
    static updateHeaderTodayScore() {
        if (typeof window === "undefined") return;
        const todayStr = typeof getLocalTodayString === "function" ? getLocalTodayString() : new Date().toISOString().split("T")[0];
        const todayScore = ScoringEngine.calculateDayScore(todayStr);
        const percentage = Math.round(todayScore * 100);
        const el = document.getElementById("header-today-score");
        if (el) {
            el.textContent = `${percentage}%`;
        }
    }
}

if (typeof window !== "undefined") {
    window.ScoringEngine = ScoringEngine;
    window.scoringEngine = ScoringEngine;
    window.calculateDayScore = (dateStr, appDataRef, returnHours) => ScoringEngine.calculateDayScore(dateStr, appDataRef, returnHours);
    window.getTaskWeightMinutes = (task, dateStr, appDataRef) => ScoringEngine.getTaskWeightMinutes(task, dateStr, appDataRef);
}
