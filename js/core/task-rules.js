/**
 * Awrady Dashboard - Task Rules & Common Helpers
 * Single source of truth for task units, time checks, completion status, and control markup.
 */

/**
 * Resolves the unit of measurement for a task (from type or category/subcategory default)
 * @param {Object} task
 * @returns {string}
 */
function getTaskUnit(task) {
    if (!task) return "";
    if (task.type) return task.type;
    const categories = (typeof APP_CONSTANTS !== "undefined" && APP_CONSTANTS.CATEGORIES) ? APP_CONSTANTS.CATEGORIES : [];
    const cat = categories.find(c => c.name === task.category);
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
    const timeUnits = (typeof APP_CONSTANTS !== "undefined" && APP_CONSTANTS.TIME_UNITS) 
        ? APP_CONSTANTS.TIME_UNITS 
        : ["ساعة", "ساعات", "ساعات ودقايق", "وقت", "دقيقة"];
    return timeUnits.includes(unit) || unit.includes("ساع") || unit.includes("دقيق") || unit.includes("وقت");
}

/**
 * Returns normalized target in comparable units (minutes for time tasks, raw count otherwise)
 * @param {Object} task
 * @param {string|null} [dateStr=null]
 * @returns {number}
 */
function getTaskNormalizedTarget(task, dateStr = null) {
    if (!task) return 0;
    const target = task.target || 0;
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
 * Groups an array of tasks or task items into a Map keyed by category name,
 * with pre-organized subcategory maps and generalTasks.
 * @param {Array} tasks
 * @returns {Map<string, Object>}
 */
function groupTasksByCategory(tasks) {
    const map = new Map();
    const categories = (typeof APP_CONSTANTS !== "undefined" && APP_CONSTANTS.CATEGORIES) ? APP_CONSTANTS.CATEGORIES : [];
    categories.forEach(c => {
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

    return map;
}

/**
 * Converts a Supabase daily_progress row into an appData log entry object
 * @param {Object} row
 * @returns {Object}
 */
function rowToLog(row) {
    if (!row) return { entries: {}, prayerExtras: {}, precomputedScore: 0, totalHours: 0, _loadedFromDB: false };
    const entries = {};
    if (row.task_progress) {
        for (const [tid, info] of Object.entries(row.task_progress)) {
            entries[tid] = (typeof info === "object" && info !== null) ? (info.achieved ?? 0) : Number(info) || 0;
        }
    }
    return {
        entries,
        prayerExtras: row.prayer_extras || {},
        precomputedScore: Number(row.total_score) || 0,
        totalHours: Number(row.total_hours) || 0,
        _loadedFromDB: true
    };
}

/**
 * Renders unified interactive controls HTML for prayer, time, or counter tasks
 * @param {Object} task
 * @param {number} val
 * @param {{ compact?: boolean }} [options]
 * @returns {string}
 */
function renderTaskControls(task, val, { compact = false } = {}) {
    if (isPrayerSelector(task)) {
        const pVals = (typeof APP_CONSTANTS !== "undefined" && APP_CONSTANTS.PRAYER_VALUES)
            ? APP_CONSTANTS.PRAYER_VALUES
            : { CONGREGATION: 1, ALONE: 0.5, MISSED: 0 };
        const actionBtn = compact
            ? `<button class="btn-action-sm" data-edit-id="${task.id}" title="تعديل الورد" style="padding:2px 6px; color:var(--gold-primary); font-size:0.75rem;"><i class="fa-solid fa-pen"></i></button>`
            : `<button class="btn-action-sm btn-task-off" data-id="${task.id}" title="إيقاف لهذا اليوم" style="font-size:0.75rem; padding:4px 8px; opacity:0.6;">⏸</button>`;
        const pad = compact ? "padding:3px 8px; font-size:0.75rem;" : "";
        const wrapStyle = compact ? "" : "margin-top:14px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.05);";
        return `
            <div class="prayer-toggles" data-id="${task.id}" style="${wrapStyle}">
                <button class="btn-prayer ${val === pVals.CONGREGATION ? 'active-mosque' : ''}" data-prayer-val="${pVals.CONGREGATION}" data-id="${task.id}" style="${pad}" title="صلاة جماعة / مسجد">🕌 جماعة</button>
                <button class="btn-prayer ${val === pVals.ALONE ? 'active-home' : ''}" data-prayer-val="${pVals.ALONE}" data-id="${task.id}" style="${pad}" title="صلاة منفرد">🏠 منفرد</button>
                <button class="btn-prayer ${val === pVals.MISSED ? 'active-none' : ''}" data-prayer-val="${pVals.MISSED}" data-id="${task.id}" style="${pad}" title="لم تُصلَّ بعد">❌ لم أصل</button>
                ${actionBtn}
            </div>
        `;
    }

    if (isTimeTask(task)) {
        const hours = Math.floor(val / 60);
        const minutes = val % 60;
        const actionBtn = compact
            ? `<button class="btn-action-sm" data-edit-id="${task.id}" title="تعديل الورد" style="padding:2px 6px; color:var(--gold-primary); font-size:0.75rem;"><i class="fa-solid fa-pen"></i></button>`
            : `<button class="btn-action-sm btn-task-off" data-id="${task.id}" title="إيقاف لهذا اليوم" style="font-size:0.75rem; padding:4px 8px; opacity:0.6;">⏸</button>`;

        if (compact) {
            return `
                <div class="task-controls" data-id="${task.id}" style="display:flex; align-items:center; gap:6px;">
                    <div style="display:flex; align-items:center; background:rgba(0,0,0,0.3); border:1px solid rgba(16,185,129,0.3); border-radius:6px; padding:1px 4px;">
                        <input type="number" class="input-time-hours" data-id="${task.id}" value="${hours}" min="0" max="24" style="width:28px; background:transparent; border:none; color:#10b981; font-weight:700; font-size:0.8rem; text-align:center;">
                        <span style="font-size:0.7rem; color:#10b981;">س</span>
                    </div>
                    <div style="display:flex; align-items:center; background:rgba(0,0,0,0.3); border:1px solid rgba(16,185,129,0.3); border-radius:6px; padding:1px 4px;">
                        <input type="number" class="input-time-minutes" data-id="${task.id}" value="${minutes}" min="0" max="59" step="5" style="width:28px; background:transparent; border:none; color:#10b981; font-weight:700; font-size:0.8rem; text-align:center;">
                        <span style="font-size:0.7rem; color:#10b981;">د</span>
                    </div>
                    <button class="btn-step btn-pomo-trigger" data-id="${task.id}" data-name="${task.name}" style="padding:2px 6px; font-size:0.75rem; color:#10b981; border:1px solid rgba(16,185,129,0.3); background:rgba(16,185,129,0.12);" title="بدء مؤقت التركيز لهذه المهمة"><i class="fa-solid fa-stopwatch"></i></button>
                    <button class="btn-step btn-step-time" data-id="${task.id}" data-time-delta="15" style="padding:2px 6px; font-size:0.75rem;" title="زيادة 15 دقيقة كبونص">+15د</button>
                    <button class="btn-step btn-step-time" data-id="${task.id}" data-time-delta="-15" style="padding:2px 6px; font-size:0.75rem;" title="إنقاص 15 دقيقة">-15د</button>
                    ${actionBtn}
                </div>
            `;
        }

        return `
            <div class="task-controls-area time-controls-area" data-id="${task.id}" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                <div style="display:flex; align-items:center; gap:6px;">
                    <div style="display:flex; align-items:center; background:rgba(0,0,0,0.4); border:1px solid var(--glass-border); border-radius:8px; padding:2px 6px;">
                        <input type="number" class="input-time-hours" data-id="${task.id}" value="${hours}" min="0" max="24" style="width:38px; background:transparent; border:none; color:#fff; font-weight:700; font-size:0.95rem; text-align:center;">
                        <span style="font-size:0.75rem; color:var(--text-secondary);">ساعة</span>
                    </div>
                    <div style="display:flex; align-items:center; background:rgba(0,0,0,0.4); border:1px solid var(--glass-border); border-radius:8px; padding:2px 6px;">
                        <input type="number" class="input-time-minutes" data-id="${task.id}" value="${minutes}" min="0" max="59" step="5" style="width:38px; background:transparent; border:none; color:#fff; font-weight:700; font-size:0.95rem; text-align:center;">
                        <span style="font-size:0.75rem; color:var(--text-secondary);">دقيقة</span>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:4px;">
                    <button class="btn-step btn-pomo-trigger" data-id="${task.id}" data-name="${task.name}" style="font-size:0.8rem; padding:3px 8px; border-radius:6px; color:#10b981; border:1px solid rgba(16,185,129,0.3); background:rgba(16,185,129,0.12);" title="بدء مؤقت التركيز لهذه المهمة"><i class="fa-solid fa-stopwatch"></i></button>
                    <button class="btn-step btn-step-time" data-id="${task.id}" data-time-delta="15" style="font-size:0.8rem; padding:3px 8px; border-radius:6px;" title="زيادة 15 دقيقة">+15د</button>
                    <button class="btn-step btn-step-time" data-id="${task.id}" data-time-delta="-15" style="font-size:0.8rem; padding:3px 8px; border-radius:6px;" title="إنقاص 15 دقيقة">-15د</button>
                    ${actionBtn}
                </div>
            </div>
        `;
    }

    // Default: counter task
    const actionBtn = compact
        ? `<button class="btn-action-sm" data-edit-id="${task.id}" title="تعديل الورد" style="padding:2px 6px; color:var(--gold-primary); font-size:0.75rem;"><i class="fa-solid fa-pen"></i></button>`
        : `<button class="btn-action-sm btn-task-off" data-id="${task.id}" title="إيقاف لهذا اليوم" style="font-size:0.75rem; padding:4px 8px; opacity:0.6;">⏸</button>`;

    if (compact) {
        return `
            <div class="task-controls" data-id="${task.id}" style="display:flex; align-items:center; gap:6px;">
                <button class="btn-val-minus btn-action-sm" data-id="${task.id}" style="padding:2px 8px; font-size:0.8rem;" title="تراجع / إنقاص">-</button>
                <input type="text" class="input-count" value="${val}" readonly style="width:40px; height:26px; font-size:0.8rem; padding:0;">
                <button class="btn-val-plus btn-action-sm" data-id="${task.id}" style="padding:2px 8px; font-size:0.8rem;" title="زيادة كبونص">+</button>
                ${actionBtn}
            </div>
        `;
    }

    return `
        <div class="task-controls-area" data-id="${task.id}">
            <div class="step-controls">
                <button class="btn-step btn-val-minus" data-id="${task.id}">-</button>
                <input type="text" class="input-count" value="${val}" readonly>
                <button class="btn-step btn-val-plus" data-id="${task.id}">+</button>
            </div>
            <div style="display:flex; gap:6px; align-items:center;">
                ${actionBtn}
            </div>
        </div>
    `;
}

if (typeof window !== "undefined") {
    window.getTaskUnit = getTaskUnit;
    window.isTimeTask = isTimeTask;
    window.getTaskNormalizedTarget = getTaskNormalizedTarget;
    window.isTaskCompleted = isTaskCompleted;
    window.isPrayerSelector = isPrayerSelector;
    window.isObligatoryPrayerTask = isObligatoryPrayerTask;
    window.groupTasksByCategory = groupTasksByCategory;
    window.rowToLog = rowToLog;
    window.renderTaskControls = renderTaskControls;
}
