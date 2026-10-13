/**
 * Per-task consistency breakdown
 */

let analyticsTaskStatusFilter = "all";

const TASK_STATUS_CONFIG = {
    scheduled: {
        key: "scheduled",
        label: "مجدولة",
        icon: "fa-calendar-check",
        badgeClass: "badge-status-scheduled"
    },
    onetime: {
        key: "onetime",
        label: "لمرة واحدة",
        icon: "fa-bolt",
        badgeClass: "badge-status-onetime"
    },
    archived: {
        key: "archived",
        label: "مؤرشفة",
        icon: "fa-box-archive",
        badgeClass: "badge-status-archived"
    }
};

function getTaskStatusKey(task) {
    if (!task) return "scheduled";
    if (task.isArchived) return "archived";
    if (task.isOneTime || task.schedule === "OneTime") return "onetime";
    return "scheduled";
}

function setupAnalyticsFilters() {
    const buttons = document.querySelectorAll(".analytics-task-filter-strip .btn-filter-status");
    if (!buttons || buttons.length === 0) return;
    buttons.forEach(btn => {
        btn.onclick = () => {
            buttons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            analyticsTaskStatusFilter = btn.getAttribute("data-status-filter") || "all";
            const selectedDates = getSelectedDates();
            renderTaskBreakdown(selectedDates);
        };
    });
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
        onetime: 0,
        archived: 0
    };

    allTasksList.forEach(t => {
        const s = getTaskStatusKey(t);
        if (counts[s] !== undefined) counts[s]++;
    });

    const elCountAll = document.getElementById("filter-count-all");
    const elCountScheduled = document.getElementById("filter-count-scheduled");
    const elCountOnetime = document.getElementById("filter-count-onetime");
    const elCountArchived = document.getElementById("filter-count-archived");

    if (elCountAll) elCountAll.textContent = counts.all;
    if (elCountScheduled) elCountScheduled.textContent = counts.scheduled;
    if (elCountOnetime) elCountOnetime.textContent = counts.onetime;
    if (elCountArchived) elCountArchived.textContent = counts.archived;

    // 3. Filter tasks based on active status filter
    const filteredTasks = (analyticsTaskStatusFilter === "all")
        ? allTasksList
        : allTasksList.filter(t => getTaskStatusKey(t) === analyticsTaskStatusFilter);

    if (filteredTasks.length === 0) {
        const emptyLabels = {
            all: "لا توجد أوراد أو مهام لعرض نسبة الالتزام",
            scheduled: "لا توجد مهام مجدولة حالياً",
            onetime: "لا توجد مهام لمرة واحدة",
            archived: "قائمة المهام المؤرشفة فارغة"
        };
        container.innerHTML = `<div class="empty-state"><h3>${emptyLabels[analyticsTaskStatusFilter] || 'لا توجد مهام لعرضها'}</h3></div>`;
        return;
    }

    const catMap = groupTasksByCategory(filteredTasks);

    catMap.forEach(catGroupData => {
        const catTasks = catGroupData.tasks;
        if (catTasks.length === 0) return;

        let catSumPct = 0;

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

            let activeTimes = 0;
            let sumRatio = 0;
            let scheduledDaysCount = 0;

            const targetDate = task.oneTimeDate || (task.createdAt ? task.createdAt.slice(0, 10) : null);
            const archiveCutoff = task.archivedAt || null;

            // Check if task has any past logged entries (for legacy tasks without explicit cutoff dates)
            let taskHasAnyLogs = false;
            let lastLoggedDate = null;
            if (appData.logs) {
                for (const dKey in appData.logs) {
                    if (appData.logs[dKey]?.entries?.[task.id] > 0) {
                        taskHasAnyLogs = true;
                        if (!lastLoggedDate || dKey > lastLoggedDate) {
                            lastLoggedDate = dKey;
                        }
                    }
                }
            }

            (allDates || []).forEach(d => {
                const log = (appData.logs && appData.logs[d]) ? appData.logs[d] : null;
                const val = (log && log.entries) ? (log.entries[task.id] || 0) : 0;

                let isScheduled = false;

                if (statusKey === "onetime") {
                    if ((targetDate && d === targetDate) || val > 0) {
                        isScheduled = true;
                    }
                } else if (statusKey === "archived") {
                    if (archiveCutoff && d > archiveCutoff) {
                        isScheduled = val > 0;
                    } else if (!archiveCutoff && !taskHasAnyLogs) {
                        isScheduled = false;
                    } else if (!archiveCutoff && lastLoggedDate && d > lastLoggedDate) {
                        isScheduled = val > 0;
                    } else {
                        isScheduled = isTaskScheduledForDate(task, d, val);
                    }
                } else {
                    isScheduled = isTaskScheduledForDate(task, d, val);
                }

                if (isScheduled) {
                    scheduledDaysCount++;
                    if (val > 0) {
                        activeTimes++;
                        const tgt = getTaskNormalizedTarget(task);
                        const ratio = val / tgt;
                        sumRatio += ratio;
                    }
                }
            });

            // Special fallback for one-time task if target date wasn't inside allDates range
            if (statusKey === "onetime" && scheduledDaysCount === 0 && targetDate) {
                scheduledDaysCount = 1;
                const log = (appData.logs && appData.logs[targetDate]) ? appData.logs[targetDate] : null;
                const val = (log && log.entries) ? (log.entries[task.id] || 0) : 0;
                if (val > 0) {
                    activeTimes = 1;
                    const tgt = getTaskNormalizedTarget(task);
                    sumRatio = (val / tgt);
                }
            }

            const effectiveTotalDays = scheduledDaysCount;
            const consistencyPct = effectiveTotalDays > 0 ? Math.round((sumRatio / effectiveTotalDays) * 100) : 0;
            catSumPct += consistencyPct;
            const iconHtml = getCategoryIconHtml(task);
            const statusBadgeHtml = `<span class="breakdown-status-badge ${statusCfg.badgeClass}"><i class="fa-solid ${statusCfg.icon}"></i> ${statusCfg.label}</span>`;

            let metaExtra = "";
            if (statusKey === "onetime" && targetDate) {
                metaExtra = `<span>•</span><span><i class="fa-regular fa-calendar"></i> ${targetDate}</span>`;
            } else if (statusKey === "archived" && archiveCutoff) {
                metaExtra = `<span>•</span><span><i class="fa-solid fa-box-archive"></i> ${archiveCutoff}</span>`;
            }

            const card = document.createElement("div");
            card.className = "breakdown-card horizontal";
            card.innerHTML = `
                <div class="breakdown-info">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <span class="breakdown-title">${iconHtml} <span>${task.name}</span></span>
                        ${statusBadgeHtml}
                    </div>
                    <div class="breakdown-meta">
                        <span>${activeTimes} / ${effectiveTotalDays} يوم</span>
                        <span>•</span>
                        <span>${task.type || "مهمة"}</span>
                        ${metaExtra}
                    </div>
                </div>
                <div class="breakdown-bar-section">
                    <div class="task-progress-bar-bg" style="height:6px; flex:1;">
                        <div class="task-progress-bar-fill" style="width: ${Math.min(100, consistencyPct)}%;"></div>
                    </div>
                    <span class="breakdown-pct ${consistencyPct >= APP_CONSTANTS.UI.SCORE_THRESHOLDS.GOLD ? 'gold-text' : (consistencyPct >= 65 ? 'emerald-text' : (consistencyPct >= 35 ? 'gold-text' : ''))}">${consistencyPct}%</span>
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
                subHeader.innerHTML = `<i class="fa-solid fa-layer-group"></i> <span>${subName}</span> <span style="font-size:0.8rem; font-weight:normal; opacity:0.8;">(${subTasks.length})</span>`;
                catBody.appendChild(subHeader);

                catBody.appendChild(renderTaskGrid(subTasks));
            });

            if (generalTasks.length > 0) {
                const subHeader = document.createElement("div");
                subHeader.className = "manager-subcat-header";
                subHeader.innerHTML = `<i class="fa-solid fa-list-check"></i> <span>عام</span> <span style="font-size:0.8rem; font-weight:normal; opacity:0.8;">(${generalTasks.length})</span>`;
                catBody.appendChild(subHeader);

                catBody.appendChild(renderTaskGrid(generalTasks));
            }
        } else {
            catBody.appendChild(renderTaskGrid(catTasks));
        }

        const catAvgPct = catTasks.length > 0 ? Math.round(catSumPct / catTasks.length) : 0;

        catHeader.innerHTML = `
            <div class="manager-cat-header-title">
                <i class="fa-solid ${iconClass}"></i>
                <span>${catGroupData.label}</span>
            </div>
            <div style="display:flex; gap:10px; align-items:center;">
                <span class="manager-cat-count-badge" style="background:rgba(59,130,246,0.15); color:#60a5fa; border-color:rgba(59,130,246,0.3);">الالتزام: ${catAvgPct}%</span>
                <span class="manager-cat-count-badge">${catTasks.length} ${catTasks.length === 1 ? 'مهمة' : (catTasks.length <= 10 ? 'مهام' : 'مهمة')}</span>
            </div>
        `;

        catCard.appendChild(catHeader);
        catCard.appendChild(catBody);
        container.appendChild(catCard);
    });
}
