/**
 * Per-task consistency breakdown
 */

import { isTimeTask, getTaskNormalizedTarget, groupTasksByCategory, isUnscheduledTask } from '../core/task-rules.js';
import { getCategoryIconHtml } from './category-manager.js';
import { ScheduleEngine } from '../core/schedule-engine.js';
import { ScoringEngine } from '../core/scoring-engine.js';
import { AppState } from '../core/state.js';

let analyticsTaskStatusFilter = "all";
let _analyticsFiltersInitialized = false;

const TASK_STATUS_CONFIG = {
    scheduled: {
        key: "scheduled",
        label: "مجدولة",
        icon: "fa-calendar-check",
        badgeClass: "badge-status-scheduled"
    },
    unscheduled: {
        key: "unscheduled",
        label: "غير مجدولة",
        icon: "fa-clock-rotate-left",
        badgeClass: "badge-status-unscheduled"
    }
};

function getTaskStatusKey(task) {
    if (!task) return "scheduled";
    return isUnscheduledTask(task) ? "unscheduled" : "scheduled";
}

/**
 * Calculates commitment statistics for a task over a specific list of dates.
 * Returns activeTimes, scheduledDaysCount, effectiveTotalDays, consistencyPct, taskTotalHours, and formattedHours.
 */
function calculateTaskStatsForDates(task, allDates) {
    let activeTimes = 0;
    let sumRatio = 0;
    let scheduledDaysCount = 0;
    let taskTotalHours = 0;

    const statusKey = getTaskStatusKey(task);
    const data = (typeof appData !== "undefined" && appData) ? appData : AppState.getAppData();

    const computeTaskHours = (taskObj, val, date) => {
        if (val <= 0) return 0;
        const isTime = typeof isTimeTask === "function" && isTimeTask(taskObj);
        if (isTime) return val / 60;
        const tgt = getTaskNormalizedTarget(taskObj, date);
        const baseTgt = (taskObj.target && taskObj.target > 0) ? taskObj.target : 1;
        const effectiveTgt = tgt > 0 ? tgt : baseTgt;
        const weightMinutes = (typeof ScoringEngine !== "undefined" && typeof ScoringEngine.getTaskWeightMinutes === "function")
            ? ScoringEngine.getTaskWeightMinutes(taskObj, effectiveTgt)
            : 1;
        const ratio = val / effectiveTgt;
        return (ratio * weightMinutes) / 60;
    };

    (allDates || []).forEach(d => {
        const log = (data && data.logs && data.logs[d]) ? data.logs[d] : null;
        const val = Number(log?.taskProgress?.[task.id]?.achieved) || 0;
        const isDeactivated = (typeof ScheduleEngine !== "undefined") ? ScheduleEngine.isTaskDisabledForDate(task, log, data) : false;
        const isExplicitBonus = Boolean(task.isBonus);

        let isScheduled = false;
        if (statusKey === "scheduled" && !isExplicitBonus && !(isDeactivated && val === 0)) {
            isScheduled = (typeof ScheduleEngine !== "undefined")
                ? ScheduleEngine.isTaskScheduledForDate(task, d, data, val)
                : false;
        }

        if (isScheduled) {
            scheduledDaysCount++;
            if (val > 0) {
                activeTimes++;
                const tgt = getTaskNormalizedTarget(task, d);
                const baseTgt = (task.target && task.target > 0) ? (isTimeTask(task) ? task.target * 60 : task.target) : 1;
                const effectiveTgt = tgt > 0 ? tgt : baseTgt;
                sumRatio += val / effectiveTgt;
                taskTotalHours += computeTaskHours(task, val, d);
            }
        } else if (val > 0) {
            // Strictly additive bonus / unscheduled entry: never increments scheduledDaysCount
            activeTimes++;
            const tgt = getTaskNormalizedTarget(task, d);
            const baseTgt = (task.target && task.target > 0) ? (isTimeTask(task) ? task.target * 60 : task.target) : 1;
            const effectiveTgt = tgt > 0 ? tgt : baseTgt;
            sumRatio += val / effectiveTgt;
            taskTotalHours += computeTaskHours(task, val, d);
        }
    });

    const effectiveTotalDays = scheduledDaysCount > 0 ? scheduledDaysCount : (activeTimes > 0 ? activeTimes : 0);
    const consistencyPct = effectiveTotalDays > 0 ? Math.round((sumRatio / effectiveTotalDays) * 100) : 0;
    const formattedHours = Math.round(taskTotalHours * 10) / 10;

    return {
        activeTimes,
        scheduledDaysCount,
        effectiveTotalDays,
        consistencyPct,
        taskTotalHours,
        formattedHours
    };
}

/**
 * Renders an individual ranking item row.
 */
function renderRankingItemHtml(entry, rank, type) {
    const { task, stats } = entry;
    const iconHtml = (typeof getCategoryIconHtml === "function") ? getCategoryIconHtml(task) : '<i class="fa-solid fa-check"></i>';
    const goldThreshold = (typeof APP_CONSTANTS !== "undefined" && APP_CONSTANTS?.UI?.SCORE_THRESHOLDS?.GOLD)
        ? APP_CONSTANTS.UI.SCORE_THRESHOLDS.GOLD
        : 90;

    let pctClass = "";
    if (stats.consistencyPct >= goldThreshold) {
        pctClass = "gold-text";
    } else if (stats.consistencyPct >= 65) {
        pctClass = "emerald-text";
    } else if (stats.consistencyPct >= 35) {
        pctClass = "amber-text";
    } else {
        pctClass = "rose-text";
    }

    const badgeClass = `${type}-${rank}`;

    return `
        <div class="ranking-item">
            <div class="ranking-item-start">
                <span class="ranking-badge ${badgeClass}">${rank}</span>
                <span class="ranking-task-icon">${iconHtml}</span>
                <span class="ranking-task-name" title="${task.name || ''}">${task.name || 'بدون اسم'}</span>
            </div>
            <div class="ranking-item-end">
                <span class="ranking-hours-val">${stats.formattedHours} س</span>
                <span class="ranking-pct ${pctClass}">${stats.consistencyPct}%</span>
            </div>
        </div>
    `;
}

/**
 * Renders Top 3 and Lowest 3 scheduled tasks based on progress percentage in the selected period.
 */
function renderTaskRankings(allDates) {
    const elTopContainer = document.getElementById("analytics-top-tasks");
    const elLowestContainer = document.getElementById("analytics-lowest-tasks");
    if (!elTopContainer && !elLowestContainer) return;

    const renderEmpty = () => `<div class="ranking-empty-state"><i class="fa-regular fa-calendar-xmark"></i> <span>لا توجد أوراد مجدولة كافية في هذه الفترة</span></div>`;

    if (!appData || !appData.tasks || !Array.isArray(appData.tasks)) {
        if (elTopContainer) elTopContainer.innerHTML = renderEmpty();
        if (elLowestContainer) elLowestContainer.innerHTML = renderEmpty();
        return;
    }

    // Only scheduled tasks ("not archived or onetime")
    const scheduledTasks = appData.tasks.filter(t => getTaskStatusKey(t) === "scheduled");

    // Filter rule: only include tasks with effectiveTotalDays > 0 in the period
    const taskEntries = [];
    scheduledTasks.forEach(task => {
        const stats = calculateTaskStatsForDates(task, allDates);
        if (stats.effectiveTotalDays > 0) {
            taskEntries.push({ task, stats });
        }
    });

    if (taskEntries.length === 0) {
        if (elTopContainer) elTopContainer.innerHTML = renderEmpty();
        if (elLowestContainer) elLowestContainer.innerHTML = renderEmpty();
        return;
    }

    // Top 3: sorted by consistencyPct descending, secondary by taskTotalHours descending, then name
    const topEntries = [...taskEntries].sort((a, b) => {
        if (b.stats.consistencyPct !== a.stats.consistencyPct) {
            return b.stats.consistencyPct - a.stats.consistencyPct;
        }
        if (b.stats.taskTotalHours !== a.stats.taskTotalHours) {
            return b.stats.taskTotalHours - a.stats.taskTotalHours;
        }
        return (a.task.name || "").localeCompare(b.task.name || "");
    }).slice(0, 3);

    // Lowest 3: sorted by consistencyPct ascending, secondary by taskTotalHours ascending, then name
    const lowestEntries = [...taskEntries].sort((a, b) => {
        if (a.stats.consistencyPct !== b.stats.consistencyPct) {
            return a.stats.consistencyPct - b.stats.consistencyPct;
        }
        if (a.stats.taskTotalHours !== b.stats.taskTotalHours) {
            return a.stats.taskTotalHours - b.stats.taskTotalHours;
        }
        return (a.task.name || "").localeCompare(b.task.name || "");
    }).slice(0, 3);

    if (elTopContainer) {
        elTopContainer.innerHTML = topEntries.map((entry, idx) => renderRankingItemHtml(entry, idx + 1, "top")).join("");
    }
    if (elLowestContainer) {
        elLowestContainer.innerHTML = lowestEntries.map((entry, idx) => renderRankingItemHtml(entry, idx + 1, "low")).join("");
    }
}

function setupAnalyticsFilters() {
    if (_analyticsFiltersInitialized) return;
    const buttons = document.querySelectorAll(".analytics-task-filter-strip .btn-filter-status");
    if (!buttons || buttons.length === 0) return;
    buttons.forEach(btn => {
        btn.onclick = () => {
            buttons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            analyticsTaskStatusFilter = btn.getAttribute("data-status-filter") || "all";
            const selectedDates = (typeof getSelectedDates === "function")
                ? getSelectedDates()
                : (typeof window !== "undefined" && typeof window.getSelectedDates === "function" ? window.getSelectedDates() : []);
            renderTaskBreakdown(selectedDates);
        };
    });
    _analyticsFiltersInitialized = true;
}

function renderTaskBreakdown(allDates) {
    const container = document.getElementById("analytics-tasks-breakdown");
    if (!container) return;
    container.innerHTML = "";

    setupAnalyticsFilters();

    // 1. Collect all valid tasks: current active tasks + archived + onetime
    const allTasksList = [...(appData.tasks || [])];

    // 2. Update status filter badges count
    const counts = {
        all: allTasksList.length,
        scheduled: 0,
        unscheduled: 0
    };

    allTasksList.forEach(t => {
        const s = getTaskStatusKey(t);
        if (counts[s] !== undefined) counts[s]++;
    });

    const elCountAll = document.getElementById("filter-count-all");
    const elCountScheduled = document.getElementById("filter-count-scheduled");
    const elCountUnscheduled = document.getElementById("filter-count-unscheduled");

    if (elCountAll) elCountAll.textContent = counts.all;
    if (elCountScheduled) elCountScheduled.textContent = counts.scheduled;
    if (elCountUnscheduled) elCountUnscheduled.textContent = counts.unscheduled;

    // 3. Filter tasks based on active status filter
    const filteredTasks = (analyticsTaskStatusFilter === "all")
        ? allTasksList
        : allTasksList.filter(t => getTaskStatusKey(t) === analyticsTaskStatusFilter);

    if (filteredTasks.length === 0) {
        const emptyLabels = {
            all: "لا توجد أوراد أو مهام لعرض نسبة الالتزام",
            scheduled: "لا توجد مهام مجدولة حالياً",
            unscheduled: "لا توجد مهام غير مجدولة حالياً"
        };
        container.innerHTML = `<div class="empty-state"><h3>${emptyLabels[analyticsTaskStatusFilter] || 'لا توجد مهام لعرضها'}</h3></div>`;
        return;
    }

    const catMap = groupTasksByCategory(filteredTasks);

    catMap.forEach(catGroupData => {
        const catTasks = catGroupData.tasks;
        if (catTasks.length === 0) return;

        let catSumPct = 0;
        let catSumHours = 0;

        const catCard = document.createElement("div");
        catCard.className = "manager-cat-group";

        const catHeader = document.createElement("div");
        catHeader.className = "manager-cat-header";
        const rawIcon = catGroupData.icon || "fa-folder";
        const iconClass = rawIcon.startsWith("fa-") ? rawIcon : `fa-${rawIcon}`;

        const subMap = catGroupData.subMap;
        const generalTasks = catGroupData.generalTasks;
        const hasSubcategoriesWithTasks = Array.from(subMap.values()).some(arr => arr.length > 0);

        const createBreakdownCard = (task) => {
            const statusKey = getTaskStatusKey(task);
            const statusCfg = TASK_STATUS_CONFIG[statusKey] || TASK_STATUS_CONFIG.scheduled;

            const stats = calculateTaskStatsForDates(task, allDates);
            catSumPct += stats.consistencyPct;
            catSumHours += stats.taskTotalHours;

            const activeTimes = stats.activeTimes;
            const effectiveTotalDays = stats.effectiveTotalDays;
            const consistencyPct = stats.consistencyPct;
            const formattedHours = stats.formattedHours;
            const iconHtml = getCategoryIconHtml(task);
            const statusBadgeHtml = `<span class="breakdown-status-badge ${statusCfg.badgeClass}"><i class="fa-solid ${statusCfg.icon}"></i> ${statusCfg.label}</span>`;

            const card = document.createElement("div");
            card.className = "breakdown-card horizontal";
            card.innerHTML = `
                <div class="breakdown-info">
                    <div class="flex-center gap-sm flex-wrap">
                        <span class="breakdown-title">${iconHtml} <span>${task.name}</span></span>
                        ${statusBadgeHtml}
                    </div>
                    <div class="breakdown-meta">
                        <span>${activeTimes} من ${effectiveTotalDays} يوم</span>
                    </div>
                </div>
                <div class="breakdown-metrics-display">
                    <span class="breakdown-hours-val">${formattedHours} س</span>
                    <span class="breakdown-separator"></span>
                    <span class="breakdown-pct ${consistencyPct >= APP_CONSTANTS.UI.SCORE_THRESHOLDS.GOLD ? 'gold-text' : (consistencyPct >= 65 ? 'emerald-text' : (consistencyPct >= 35 ? 'gold-text' : ''))}">${consistencyPct}%</span>
                </div>
                <div class="breakdown-bottom-track">
                    <div class="breakdown-bottom-fill" style="width: ${Math.min(100, consistencyPct)}%;"></div>
                </div>
            `;
            return card;
        };

        const renderTaskGrid = (taskList) => {
            const grid = document.createElement("div");
            grid.className = "breakdown-grid";
            taskList.forEach(t => grid.appendChild(createBreakdownCard(t)));
            return grid;
        };

        const catBody = document.createElement("div");

        if (hasSubcategoriesWithTasks) {
            subMap.forEach((subTasks, subName) => {
                if (subTasks.length === 0) return;

                const subHeader = document.createElement("div");
                subHeader.className = "manager-subcat-header";
                subHeader.innerHTML = `<i class="fa-solid fa-layer-group"></i> <span>${subName}</span> <span class="text-xs font-normal opacity-80">(${subTasks.length})</span>`;
                catBody.appendChild(subHeader);

                catBody.appendChild(renderTaskGrid(subTasks));
            });

            if (generalTasks.length > 0) {
                const subHeader = document.createElement("div");
                subHeader.className = "manager-subcat-header";
                subHeader.innerHTML = `<i class="fa-solid fa-list-check"></i> <span>عام</span> <span class="text-xs font-normal opacity-80">(${generalTasks.length})</span>`;
                catBody.appendChild(subHeader);

                catBody.appendChild(renderTaskGrid(generalTasks));
            }
        } else {
            catBody.appendChild(renderTaskGrid(catTasks));
        }

        const catAvgPct = catTasks.length > 0 ? Math.round(catSumPct / catTasks.length) : 0;
        const catHoursFormatted = Math.round(catSumHours * 10) / 10;

        catHeader.innerHTML = `
            <div class="manager-cat-header-title">
                <i class="fa-solid ${iconClass}"></i>
                <span>${catGroupData.label || catGroupData.name}</span>
            </div>
            <div class="flex-center gap-sm">
                <span class="manager-cat-count-badge badge-blue">${catHoursFormatted > 0 ? `${catHoursFormatted} س • ` : ''}الالتزام: ${catAvgPct}%</span>
                <span class="manager-cat-count-badge">${catTasks.length} ${catTasks.length === 1 ? 'مهمة' : (catTasks.length <= 10 ? 'مهام' : 'مهمة')}</span>
            </div>
        `;

        catCard.appendChild(catHeader);
        catCard.appendChild(catBody);
        container.appendChild(catCard);
    });
}

if (typeof window !== "undefined") {
    window.renderTaskBreakdown = renderTaskBreakdown;
    window.renderTaskRankings = renderTaskRankings;
    window.calculateTaskStatsForDates = calculateTaskStatsForDates;
    window.getTaskStatusKey = getTaskStatusKey;
    window.setupAnalyticsFilters = setupAnalyticsFilters;
}

export {
    renderTaskBreakdown,
    renderTaskRankings,
    calculateTaskStatsForDates,
    getTaskStatusKey,
    setupAnalyticsFilters
};
