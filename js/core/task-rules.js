/**
 * Awrady Dashboard - Task Rules & Common Helpers
 * Single source of truth for task units, time checks, completion status, and control markup.
 */

import { APP_CONSTANTS } from '../config/constants.js';
import { getDayOfWeekAbbrev } from '../utils/date-utils.js';

/**
 * Resolves the unit of measurement for a task (from type or category/subcategory default)
 * @param {Object} task
 * @returns {string}
 */
function getTaskUnit(task) {
    if (!task) return "";
    if (task.type) return task.type;
    const allCategories = (typeof window !== "undefined" && window.appData?.categories?.length > 0)
        ? window.appData.categories
        : (APP_CONSTANTS.CATEGORIES || []);
    const cat = allCategories.find(c => c.name === task.category) || APP_CONSTANTS.CATEGORIES.find(c => c.name === task.category);
    if (cat) {
        if (task.subcategory && Array.isArray(cat.subcategories)) {
            const sub = cat.subcategories.find(s => s.name === task.subcategory);
            if (sub && sub.defaultUnit) return sub.defaultUnit;
        }
        if (cat.defaultUnit) return cat.defaultUnit;
    }
    return "";
}

/**
 * Determines if a task is time-based (hours, minutes, time)
 * @param {Object} task
 * @returns {boolean}
 */
function isTimeTask(task) {
    if (!task) return false;
    const unit = getTaskUnit(task);
    return APP_CONSTANTS.TIME_UNITS.includes(unit) || unit.includes("ساع") || unit.includes("دقيق") || unit.includes("وقت");
}

/**
 * Checks if a task schedule is 'Everyday' or 'specific days' (recurring weekly weekdays).
 * Returns false for 'Unscheduled', 'OneTime', 'WhiteDays', 'Ramadan', or other special schedules.
 * @param {string} schedule
 * @returns {boolean}
 */
function isEverydayOrSpecificDaysSchedule(schedule) {
    if (!schedule) return true;
    const s = schedule.trim();
    if (s === "Everyday" || s === "Daily" || s === "") return true;
    if (s === "Unscheduled" || s === "OneTime" || s === "WhiteDays" || s === "Ramadan") return false;
    return ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"].some(d => s.includes(d));
}

/**
 * Focuses positively on whether a task is an active daily scheduled task.
 * @param {Object} task
 * @returns {boolean}
 */
function isDailyScheduledTask(task) {
    if (!task || task.isArchived || task.schedule === "Unscheduled") return false;
    return isEverydayOrSpecificDaysSchedule(task.schedule);
}

/**
 * Resolves the effective target for a task on a specific day or date.
 * If the schedule is Everyday or specific days, it uses the dailyTargets dictionary.
 * Else (Unscheduled, OneTime, WhiteDays, Ramadan, etc.), it uses the scalar task.target column.
 * @param {Object} task
 * @param {string} dayOrDateKey Day abbreviation (e.g. "Sat") or Date string ("YYYY-MM-DD")
 * @returns {number} Target units
 */
function getTaskDayTarget(task, dayOrDateKey = null) {
    if (!task) return 0;
    const sched = task.schedule || "Everyday";

    // If schedule is Everyday or specific days, use dailyTargets dictionary
    if (isEverydayOrSpecificDaysSchedule(sched)) {
        const dayKey = (dayOrDateKey && dayOrDateKey.length > 3)
            ? (typeof getDayOfWeekAbbrev === "function" ? getDayOfWeekAbbrev(dayOrDateKey) : "")
            : (dayOrDateKey || "");

        if (dayKey && task.dailyTargets && task.dailyTargets[dayKey] !== undefined) {
            return Math.round((Number(task.dailyTargets[dayKey]) || 0) * 100) / 100;
        }

        let isScheduled = false;
        const s = sched.trim();
        if (s === "Everyday" || s === "") {
            isScheduled = true;
        } else if (dayKey) {
            isScheduled = s.includes(dayKey);
        } else {
            isScheduled = true;
        }
        return isScheduled ? Math.round((Number(task.target) || 1) * 100) / 100 : 0;
    }

    // Else (Unscheduled, OneTime, WhiteDays, Ramadan, etc.) -> use scalar task.target column
    return Math.round((Number(task.target) || 1) * 100) / 100;
}

/**
 * Returns normalized target in comparable units (minutes for time tasks, raw count otherwise)
 * @param {Object} task
 * @param {string|null} [dateStr=null]
 * @returns {number}
 */
function getTaskNormalizedTarget(task, dateStr = null) {
    if (!task) return 0;
    if (dateStr && typeof ScheduleEngine !== "undefined" && ScheduleEngine.isBonusTaskForDate(task, dateStr)) {
        return 0;
    }

    const sched = task.schedule || "Everyday";
    let target = 0;

    if (isEverydayOrSpecificDaysSchedule(sched)) {
        target = dateStr ? getTaskDayTarget(task, dateStr) : (Number(task.target) || 1);
    } else {
        // Else: use scalar task.target column
        target = Number(task.target) || 1;
    }

    if (isTimeTask(task)) {
        return target * 60;
    }
    return target;
}

/**
 * Checks if a task's logged value meets or exceeds target
 * @param {Object} task
 * @param {number} val
 * @param {string|null} [dateStr=null]
 * @returns {boolean}
 */
function isTaskCompleted(task, val, dateStr = null) {
    if (isPrayerSelector(task)) {
        return val > 0;
    }
    if (dateStr && typeof ScheduleEngine !== "undefined" && ScheduleEngine.isBonusTaskForDate(task, dateStr)) {
        return val > 0;
    }
    const normTarget = getTaskNormalizedTarget(task, dateStr);
    if (normTarget > 0) {
        return val >= normTarget;
    }
    return val > 0;
}

/**
 * Checks whether task is an obligatory prayer selector
 * @param {Object} task
 * @returns {boolean}
 */
function isPrayerSelector(task) {
    if (!task) return false;
    if (task.type === "صلاة") return true;
    const cat = (task.category || "").trim();
    const sub = (task.subcategory || "").trim();
    return cat === "صلاة" && sub === "فرض";
}

/**
 * Checks whether a task ID corresponds to an obligatory prayer
 * @param {string} taskId
 * @param {Object|null} [appDataRef=null]
 * @returns {boolean}
 */
function isObligatoryPrayerTask(taskId, appDataRef = null) {
    const data = appDataRef || (typeof window !== "undefined" ? window.appData : null);
    const task = data?.tasks?.find(t => t.id === taskId);
    if (!task) return false;
    return isPrayerSelector(task);
}

/**
 * Chronological order of daily prayers
 */
const PRAYER_ORDER = (typeof APP_CONSTANTS !== "undefined" && APP_CONSTANTS.PRAYER_ORDER)
    ? APP_CONSTANTS.PRAYER_ORDER
    : ["الفجر", "الضحى", "الظهر", "العصر", "المغرب", "العشاء", "السنن الرواتب", "الوتر", "قيام ليل"];

/**
 * Returns a 0-based chronological sort index for a prayer task
 * @param {Object} task
 * @returns {number}
 */
function getPrayerSortIndex(task) {
    if (!task) return 999;
    const name = (task.name || "").trim();

    // 1. Exact match in canonical list
    const exactIdx = PRAYER_ORDER.indexOf(name);
    if (exactIdx !== -1) return exactIdx;

    // 2. ID-based matching for standard IDs
    const id = task.id || "";
    if (id === "task_fajr") return 0;
    if (id === "task_duha") return 1;
    if (id === "task_dhuhr") return 2;
    if (id === "task_asr") return 3;
    if (id === "task_maghrib") return 4;
    if (id === "task_isha") return 5;
    if (id === "task_sunnah") return 6;
    if (id === "task_witr") return 7;
    if (id === "task_qiyam") return 8;

    // 3. Keyword / partial matching
    if (name.includes("فجر")) return 0;
    if (name.includes("ضحى")) return 1;
    if (name.includes("ظهر")) return 2;
    if (name.includes("عصر")) return 3;
    if (name.includes("مغرب")) return 4;
    if (name.includes("عشاء")) return 5;
    if (name.includes("سنن") || name.includes("رواتب")) return 6;
    if (name.includes("وتر")) return 7;
    if (name.includes("قيام") || name.includes("تهجد") || name.includes("تراويح")) return 8;

    return 100;
}

/**
 * Groups an array of tasks or task items into a Map keyed by category name,
 * with pre-organized subcategory maps and generalTasks.
 * @param {Array} tasks
 * @returns {Map<string, Object>}
 */
function groupTasksByCategory(tasks) {
    const map = new Map();
    APP_CONSTANTS.CATEGORIES.forEach(c => {
        const subMap = new Map();
        if (Array.isArray(c.subcategories)) {
            c.subcategories.forEach(s => subMap.set(s.name, []));
        }
        map.set(c.name, {
            ...c,
            tasks: [],
            subMap,
            generalTasks: []
        });
    });

    (tasks || []).forEach(item => {
        const t = item.task || item;
        const catName = t.category || "أخرى";
        if (!map.has(catName)) {
            map.set(catName, {
                name: catName,
                label: catName,
                icon: "fa-folder",
                tasks: [],
                subMap: new Map(),
                generalTasks: []
            });
        }
        const group = map.get(catName);
        group.tasks.push(item);

        const subName = (t.subcategory || "").trim();
        if (subName) {
            if (!group.subMap.has(subName)) {
                group.subMap.set(subName, []);
            }
            group.subMap.get(subName).push(item);
        } else {
            group.generalTasks.push(item);
        }
    });

    const prayerGroup = map.get("صلاة");
    if (prayerGroup) {
        prayerGroup.tasks.sort((a, b) => getPrayerSortIndex(a.task || a) - getPrayerSortIndex(b.task || b));
        prayerGroup.subMap.forEach(subList => {
            subList.sort((a, b) => getPrayerSortIndex(a.task || a) - getPrayerSortIndex(b.task || b));
        });
        prayerGroup.generalTasks.sort((a, b) => getPrayerSortIndex(a.task || a) - getPrayerSortIndex(b.task || b));
    }

    return map;
}

/**
 * Converts a Supabase daily_progress row into an appData log entry object
 * @param {Object} row
 * @returns {Object}
 */
function rowToLog(row) {
    if (!row) return { taskProgress: {}, prayerExtras: {}, precomputedScore: 0, totalHours: 0, _loadedFromDB: false };
    const prayerExtras = { ...(row.prayer_extras || {}) };
    delete prayerExtras._meta;

    const taskProgress = {};
    for (const [tid, tp] of Object.entries(row.task_progress || {})) {
        if (!tp) continue;
        const { hours: _h, score: _s, ...cleanTp } = tp;
        taskProgress[tid] = cleanTp;
    }

    return {
        taskProgress,
        prayerExtras,
        precomputedScore: Number(row.total_score) || 0,
        totalHours: Number(row.total_hours) || 0,
        updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : 0,
        _loadedFromDB: true
    };
}

if (typeof window !== "undefined") {
    window.getTaskUnit = getTaskUnit;
    window.isTimeTask = isTimeTask;
    window.getTaskDayTarget = getTaskDayTarget;
    window.getTaskNormalizedTarget = getTaskNormalizedTarget;
    window.isTaskCompleted = isTaskCompleted;
    window.isPrayerSelector = isPrayerSelector;
    window.isObligatoryPrayerTask = isObligatoryPrayerTask;
    window.PRAYER_ORDER = PRAYER_ORDER;
    window.getPrayerSortIndex = getPrayerSortIndex;
    window.groupTasksByCategory = groupTasksByCategory;
    window.rowToLog = rowToLog;
    window.isEverydayOrSpecificDaysSchedule = isEverydayOrSpecificDaysSchedule;
    window.isDailyScheduledTask = isDailyScheduledTask;
}

export {
    getTaskUnit,
    isTimeTask,
    isEverydayOrSpecificDaysSchedule,
    isDailyScheduledTask,
    getTaskDayTarget,
    getTaskNormalizedTarget,
    isTaskCompleted,
    isPrayerSelector,
    isObligatoryPrayerTask,
    PRAYER_ORDER,
    getPrayerSortIndex,
    groupTasksByCategory,
    rowToLog
};
