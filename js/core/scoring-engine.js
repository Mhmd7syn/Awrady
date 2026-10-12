/**
 * Awrady Dashboard - Scoring Engine
 * Weighted-average equation system, daily score aggregation, time estimation, and streak statistics.
 */

class ScoringEngine {
    static _scoreCache = new Map();

    /**
     * Invalidate cached day scores
     * @param {string|null} [dateStr=null] Specific date to invalidate, or null to clear all
     */
    static invalidateScoreCache(dateStr = null) {
        if (dateStr) {
            ScoringEngine._scoreCache.delete(dateStr + "_s");
            ScoringEngine._scoreCache.delete(dateStr + "_h");
        } else {
            ScoringEngine._scoreCache.clear();
        }
    }

    static clearScoreCache() {
        ScoringEngine._scoreCache.clear();
    }

    /**
     * Returns the time weight (in minutes) for a task used in weighted-average scoring
     * @param {Object} task 
     * @param {string|null} [dateStr=null] 
     * @param {Object} [appDataRef] 
     * @param {Object|null} [dateContext=null] Optional pre-resolved { dayAbbrev, hijriInfo }
     * @returns {number} Weight in minutes
     */
    static getTaskWeightMinutes(task, dateStr = null, appDataRef = null, dateContext = null) {
        if (!task) return 1;
        const appData = appDataRef || (typeof window !== "undefined" ? window.appData : null);
        const effProps = dateStr && typeof ScheduleEngine !== "undefined" 
            ? ScheduleEngine.getTaskEffectiveProps(task, dateStr, dateContext) 
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

        const cacheKey = dateStr + (returnHours ? "_h" : "_s");
        const isDefaultAppData = !appDataRef || (typeof window !== "undefined" && appDataRef === window.appData);
        if (isDefaultAppData && ScoringEngine._scoreCache.has(cacheKey)) {
            return ScoringEngine._scoreCache.get(cacheKey);
        }

        const log = appData.logs[dateStr];
        if (!log) {
            if (isDefaultAppData) ScoringEngine._scoreCache.set(cacheKey, 0);
            return 0;
        }

        if (!returnHours && log.precomputedScore !== undefined && log.precomputedScore !== null && (!log.entries || Object.keys(log.entries).length === 0)) {
            const score = Number(log.precomputedScore) || 0;
            if (isDefaultAppData) ScoringEngine._scoreCache.set(cacheKey, score);
            return score;
        }
        if (returnHours && log.totalHours !== undefined && log.totalHours !== null && (!log.entries || Object.keys(log.entries).length === 0)) {
            const hours = Number(log.totalHours) || 0;
            if (isDefaultAppData) ScoringEngine._scoreCache.set(cacheKey, hours);
            return hours;
        }

        let reqWeightedScore = 0.0;
        let reqTotalWeight = 0.0;
        let bonusWeightedScore = 0.0;

        const disabledIds = log.disabledTaskIds || log.deactivatedTaskIds || [];

        // Pre-resolve date context once per day evaluation loop
        const dateContext = {
            dayAbbrev: typeof getDayOfWeekAbbrev === "function" ? getDayOfWeekAbbrev(dateStr) : "",
            hijriInfo: typeof getHijriDateDetails === "function" ? getHijriDateDetails(dateStr) : { isWhiteDay: false, isRamadan: false }
        };

        (appData.tasks || []).forEach(task => {
            if (task.parentTaskId) return;
            if (task.isArchived) {
                const archiveCutoff = task.archivedAt || null;
                const val = (log.entries && log.entries[task.id] !== undefined) ? log.entries[task.id] : 0;
                if (!archiveCutoff || dateStr > archiveCutoff) {
                    if (val === 0) return;
                }
            }
            if (disabledIds.includes(task.id)) return;

            const val = (log.entries && log.entries[task.id] !== undefined) ? log.entries[task.id] : 0;
            const isBonus = typeof ScheduleEngine !== "undefined" 
                ? ScheduleEngine.isBonusTaskForDate(task, dateStr, appData, val, dateContext) 
                : !!task.isBonus;
            const isScheduled = typeof ScheduleEngine !== "undefined" 
                ? ScheduleEngine.isTaskScheduledForDate(task, dateStr, appData, val, dateContext) 
                : true;

            if (isScheduled || (isBonus && val > 0)) {
                const effProps = typeof ScheduleEngine !== "undefined" 
                    ? ScheduleEngine.getTaskEffectiveProps(task, dateStr, dateContext) 
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
                        ? ScheduleEngine.getTaskEffectiveProps(pairedTask, dateStr, dateContext) 
                        : null;
                    const pairedMult = pairedEff ? (pairedEff.multiplier || 0.5) : 0.5;
                    taskRatio = ((normVal * multiplier) + (pairedVal * pairedMult)) / normTarget;
                } else {
                    taskRatio = (normVal * multiplier) / normTarget;
                }

                const weight = ScoringEngine.getTaskWeightMinutes(task, dateStr, appData, dateContext);

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

        let finalResult = 0;
        if (returnHours) {
            finalResult = (reqWeightedScore + bonusWeightedScore) / 60;
        } else if (reqTotalWeight === 0) {
            if (bonusWeightedScore > 0) {
                finalResult = 1.0;
            } else if (log.precomputedScore !== undefined && log.precomputedScore !== null) {
                finalResult = log.precomputedScore;
            } else if (log.legacyTotalScore !== undefined && log.legacyTotalScore !== null) {
                finalResult = log.legacyTotalScore;
            } else {
                finalResult = 0;
            }
        } else {
            finalResult = (reqWeightedScore + bonusWeightedScore) / reqTotalWeight;
        }

        if (isDefaultAppData) {
            ScoringEngine._scoreCache.set(cacheKey, finalResult);
        }

        return finalResult;
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

// Automatically wire cache invalidation to StateManager & StorageEngine
if (typeof window !== "undefined") {
    if (window.stateManager && typeof window.stateManager.save === "function") {
        const origStateSave = window.stateManager.save.bind(window.stateManager);
        window.stateManager.save = function(immediate = false) {
            ScoringEngine.invalidateScoreCache();
            return origStateSave(immediate);
        };
    }
    if (window.storageEngine && typeof window.storageEngine.saveData === "function") {
        const origStorageSave = window.storageEngine.saveData.bind(window.storageEngine);
        window.storageEngine.saveData = function(key, data) {
            ScoringEngine.invalidateScoreCache();
            return origStorageSave(key, data);
        };
    }

    window.ScoringEngine = ScoringEngine;
    window.scoringEngine = ScoringEngine;
    window.calculateDayScore = (dateStr, appDataRef, returnHours) => ScoringEngine.calculateDayScore(dateStr, appDataRef, returnHours);
    window.getTaskWeightMinutes = (task, dateStr, appDataRef, dateContext) => ScoringEngine.getTaskWeightMinutes(task, dateStr, appDataRef, dateContext);
    window.invalidateScoreCache = (dateStr) => ScoringEngine.invalidateScoreCache(dateStr);
}
