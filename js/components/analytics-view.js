/**
 * ============================================================================
 * AWRAD PRO - ANALYTICS VIEW COMPONENT
 * Handles Chart.js initialization, overall statistics, and task breakdown calculations.
 * ============================================================================
 */

function getRecordedDates() {
    if (!appData || !appData.logs) return [];
    return Object.keys(appData.logs).filter(d => {
        const log = appData.logs[d];
        if (!log) return false;
        const hasPositiveEntries = log.entries && Object.values(log.entries).some(v => v > 0);
        const hasPrecomputed = (log.precomputedScore !== undefined && log.precomputedScore !== null) || (log.legacyTotalScore !== undefined && log.legacyTotalScore !== null);
        const hasBonus = log.bonusTaskIds && log.bonusTaskIds.length > 0;
        const hasDisabled = log.disabledTaskIds && log.disabledTaskIds.length > 0;
        return hasPositiveEntries || hasPrecomputed || hasBonus || hasDisabled;
    }).sort();
}

function getSelectedDates() {
    const allDates = getRecordedDates();
    if (typeof chartTimeRange === "undefined" || chartTimeRange === "all") return allDates;
    const daysLimit = parseInt(chartTimeRange, 10);
    if (isNaN(daysLimit) || daysLimit <= 0) return allDates;
    return allDates.slice(-daysLimit);
}

function updateAnalyticsHeroMetrics(selectedDates = null) {
    const allDates = getRecordedDates();
    const activeDates = selectedDates || getSelectedDates();

    const elHeroTitle = document.getElementById("analytics-hero-title");
    const elAnalyticsVal = document.getElementById("analytics-alltime-val");
    const elAnalyticsSub = document.getElementById("analytics-alltime-sub");

    const currentRange = (typeof chartTimeRange !== "undefined") ? chartTimeRange : "all";

    if (elHeroTitle) {
        if (currentRange === "7") {
            elHeroTitle.textContent = "معدل الأسبوع";
        } else if (currentRange === "30") {
            elHeroTitle.textContent = "معدل الشهر";
        } else {
            elHeroTitle.textContent = "المعدل العام";
        }
    }

    if (activeDates.length === 0) {
        if (elAnalyticsVal) elAnalyticsVal.textContent = "0%";
        if (elAnalyticsSub) elAnalyticsSub.textContent = "لم يتم تسجيل أيام بعد";
        return;
    }

    let sumScores = 0;
    activeDates.forEach(d => {
        sumScores += (typeof ScoringEngine !== "undefined")
            ? ScoringEngine.calculateDayScore(d, (typeof appData !== "undefined" ? appData : null), false)
            : calculateDayScore(d, null, false);
    });

    const averageScore = sumScores / activeDates.length;
    const avgPercent = Math.round(averageScore * 100);

    if (elAnalyticsVal) elAnalyticsVal.textContent = `${avgPercent}%`;

    if (elAnalyticsSub) {
        if (currentRange === "all") {
            elAnalyticsSub.textContent = `السجل التراكمي لكافة الأيام (${allDates.length} يوماً)`;
        } else if (currentRange === "7") {
            elAnalyticsSub.textContent = `بناءً على ${activeDates.length} ${activeDates.length === 1 ? 'يوم' : (activeDates.length <= 10 ? 'أيام' : 'يوماً')} في آخر 7 أيام`;
        } else if (currentRange === "30") {
            elAnalyticsSub.textContent = `بناءً على ${activeDates.length} ${activeDates.length === 1 ? 'يوم' : (activeDates.length <= 10 ? 'أيام' : 'يوماً')} في آخر 30 يوماً`;
        } else {
            elAnalyticsSub.textContent = `بناءً على ${activeDates.length} يوماً مسجلاً في هذه الفترة`;
        }
    }
}

function renderAllTimeStats() {
    if (!appData || !appData.logs) return;
    const allDates = getRecordedDates();

    const elHeaderScore = document.getElementById("header-alltime-score");
    const elHeaderDays = document.getElementById("header-total-days");

    if (allDates.length === 0) {
        if (elHeaderScore) elHeaderScore.textContent = "0%";
        if (elHeaderDays) elHeaderDays.textContent = "0";
    } else {
        let sumScores = 0;
        allDates.forEach(d => {
            sumScores += (typeof ScoringEngine !== "undefined")
                ? ScoringEngine.calculateDayScore(d, (typeof appData !== "undefined" ? appData : null), false)
                : calculateDayScore(d, null, false);
        });

        const averageScore = sumScores / allDates.length;
        const avgPercent = Math.round(averageScore * 100);

        if (elHeaderScore) elHeaderScore.textContent = `${avgPercent}%`;
        if (elHeaderDays) elHeaderDays.textContent = allDates.length.toString();
    }

    // Keep hero metric card in sync with active period filter
    updateAnalyticsHeroMetrics();
}

function initChart() {
    const canvas = document.getElementById("progressChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, "rgba(16, 185, 129, 0.45)");
    gradient.addColorStop(1, "rgba(16, 185, 129, 0.0)");

    if (typeof Chart !== "undefined") {
        chartInstance = new Chart(ctx, {
            type: "line",
            data: {
                labels: [],
                datasets: [{
                    label: "ساعات الإنجاز اليومية (ساعة)",
                    data: [],
                    borderColor: "#10b981",
                    backgroundColor: gradient,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.35,
                    pointBackgroundColor: "#f59e0b",
                    pointBorderColor: "#fff",
                    pointRadius: 4,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    zoom: {
                        pan: { enabled: true, mode: 'x' },
                        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }
                    },
                    tooltip: {
                        backgroundColor: "rgba(6, 11, 9, 0.9)",
                        titleFont: { family: "Cairo", size: 14, weight: "bold" },
                        bodyFont: { family: "Outfit", size: 15 },
                        borderColor: "#10b981",
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            title: function (tooltipItems) {
                                if (!tooltipItems || !tooltipItems.length) return "";
                                const item = tooltipItems[0];
                                const rawDate = item.dataset?.rawDates?.[item.dataIndex];
                                return rawDate ? `${rawDate} (${item.label})` : item.label;
                            },
                            label: function (context) {
                                return `ساعات الإنجاز: ${context.parsed.y} ساعة`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        min: 0,
                        suggestedMax: 8,
                        ticks: { color: "#94a3b8", font: { family: "Outfit", weight: "600" }, callback: val => `${val} س` },
                        grid: { color: "rgba(255, 255, 255, 0.05)" }
                    },
                    x: {
                        ticks: { color: "#94a3b8", font: { family: "Cairo", size: 11 }, maxTicksLimit: 12 },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    document.querySelectorAll(".chart-range-buttons .btn-range").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".chart-range-buttons .btn-range").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            chartTimeRange = btn.getAttribute("data-range");
            updateChartAndAnalytics();
        });
    });

    setupAnalyticsFilters();
}

/**
 * Downsamples time-series data using Largest Triangle Three Buckets (LTTB) algorithm.
 * Guarantees that first and last points are kept, and significant peaks/valleys are retained.
 * @param {Array<{dateStr: string, label: string, hours: number}>} data
 * @param {number} threshold
 * @returns {Array<{dateStr: string, label: string, hours: number}>}
 */
function downsampleLTTB(data, threshold) {
    if (!data || data.length <= threshold || threshold <= 2) {
        return data;
    }

    const sampled = [];
    const dataLength = data.length;
    const bucketSize = (dataLength - 2) / (threshold - 2);

    let a = 0;
    sampled.push(data[a]);

    for (let i = 0; i < threshold - 2; i++) {
        let avgX = 0;
        let avgY = 0;
        let avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
        let avgRangeEnd = Math.floor((i + 2) * bucketSize) + 1;
        if (avgRangeEnd > dataLength) avgRangeEnd = dataLength;

        const avgRangeLength = avgRangeEnd - avgRangeStart;
        for (let j = avgRangeStart; j < avgRangeEnd; j++) {
            avgX += j;
            avgY += data[j].hours;
        }
        avgX /= (avgRangeLength || 1);
        avgY /= (avgRangeLength || 1);

        let rangeOffs = Math.floor(i * bucketSize) + 1;
        let rangeTo = Math.floor((i + 1) * bucketSize) + 1;
        if (rangeTo > dataLength) rangeTo = dataLength;

        const pointAX = a;
        const pointAY = data[a].hours;

        let maxArea = -1;
        let maxAreaIndex = rangeOffs;

        for (let j = rangeOffs; j < rangeTo; j++) {
            const area = Math.abs(
                (pointAX - avgX) * (data[j].hours - pointAY) -
                (pointAX - j) * (avgY - pointAY)
            ) * 0.5;

            if (area > maxArea) {
                maxArea = area;
                maxAreaIndex = j;
            }
        }

        sampled.push(data[maxAreaIndex]);
        a = maxAreaIndex;
    }

    sampled.push(data[dataLength - 1]);
    return sampled;
}

function updateChartAndAnalytics() {
    if (!chartInstance && typeof initChart === "function") {
        initChart();
    }
    const selectedDates = getSelectedDates();

    // Synchronize hero metric card (percentage, title, subtitle) with selected period
    updateAnalyticsHeroMetrics(selectedDates);

    const fullDataList = [];
    let periodSum = 0;
    let bestDayHours = 0;
    let bestDayScore = 0;
    let bestDayLabel = "--";

    selectedDates.forEach((dateStr, idx) => {
        const hours = (typeof ScoringEngine !== "undefined")
            ? ScoringEngine.calculateDayScore(dateStr, (typeof appData !== "undefined" ? appData : null), true)
            : calculateDayScore(dateStr, null, true);
        const hoursFormatted = Math.round(hours * 10) / 10;

        const score = (typeof ScoringEngine !== "undefined")
            ? ScoringEngine.calculateDayScore(dateStr, (typeof appData !== "undefined" ? appData : null), false)
            : calculateDayScore(dateStr, null, false);

        const dateParts = dateStr.split("-");
        const label = dateParts.length === 3 ? `${parseInt(dateParts[2], 10)}/${parseInt(dateParts[1], 10)}` : dateStr;

        fullDataList.push({
            index: idx,
            dateStr,
            label,
            hours: hoursFormatted
        });

        periodSum += hoursFormatted;

        if (hoursFormatted > bestDayHours || (hoursFormatted === bestDayHours && score > bestDayScore && hoursFormatted > 0)) {
            bestDayHours = hoursFormatted;
            bestDayScore = score;
            bestDayLabel = `${label} (${hoursFormatted} س)`;
        } else if (bestDayHours === 0 && score > bestDayScore && score > 0) {
            bestDayScore = score;
            bestDayLabel = `${label} (${Math.round(score * 100)}%)`;
        }
    });

    // Automatic undersampling: target 30 points (or 15 points on mobile screens < 500px)
    const maxPoints = (typeof window !== "undefined" && window.innerWidth < 500) ? 15 : 30;
    let chartData = fullDataList;

    if (fullDataList.length > maxPoints) {
        chartData = downsampleLTTB(fullDataList, maxPoints);
    }

    const labels = chartData.map(item => item.label);
    const dataPoints = chartData.map(item => item.hours);
    const rawDates = chartData.map(item => item.dateStr);

    if (chartInstance) {
        chartInstance.data.labels = labels;
        chartInstance.data.datasets[0].data = dataPoints;
        chartInstance.data.datasets[0].rawDates = rawDates;
        chartInstance.data.datasets[0].pointRadius = 4;
        chartInstance.data.datasets[0].pointHoverRadius = 7;
        chartInstance.update();
    }

    const periodAvg = selectedDates.length > 0 ? (periodSum / selectedDates.length).toFixed(1) : "0";
    const elPeriodAvg = document.getElementById("analytics-period-avg");
    const elBestDay = document.getElementById("analytics-best-day");

    if (elPeriodAvg) elPeriodAvg.textContent = `${periodAvg} س/يوم`;
    if (elBestDay) elBestDay.textContent = bestDayLabel;

    // Pass selectedDates so breakdown reflects the same period as the chart
    renderTaskBreakdown(selectedDates);
}

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
    },
    removed: {
        key: "removed",
        label: "محذوفة",
        icon: "fa-trash-can",
        badgeClass: "badge-status-removed"
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
    const allTasksList = [];
    const seenTaskIds = new Set();

    (appData.tasks || []).forEach(t => {
        seenTaskIds.add(t.id);
        allTasksList.push(t);
    });

    // 2. Update status filter badges count
    const counts = {
        all: allTasksList.length,
        scheduled: 0,
        onetime: 0,
        archived: 0,
        removed: 0
    };

    allTasksList.forEach(t => {
        const s = getTaskStatusKey(t);
        if (counts[s] !== undefined) counts[s]++;
    });

    const elCountAll = document.getElementById("filter-count-all");
    const elCountScheduled = document.getElementById("filter-count-scheduled");
    const elCountOnetime = document.getElementById("filter-count-onetime");
    const elCountArchived = document.getElementById("filter-count-archived");
    const elCountRemoved = document.getElementById("filter-count-removed");

    if (elCountAll) elCountAll.textContent = counts.all;
    if (elCountScheduled) elCountScheduled.textContent = counts.scheduled;
    if (elCountOnetime) elCountOnetime.textContent = counts.onetime;
    if (elCountArchived) elCountArchived.textContent = counts.archived;
    if (elCountRemoved) elCountRemoved.textContent = counts.removed;

    // 3. Filter tasks based on active status filter
    const filteredTasks = (analyticsTaskStatusFilter === "all")
        ? allTasksList
        : allTasksList.filter(t => getTaskStatusKey(t) === analyticsTaskStatusFilter);

    if (filteredTasks.length === 0) {
        const emptyLabels = {
            all: "لا توجد أوراد أو مهام لعرض نسبة الالتزام",
            scheduled: "لا توجد مهام مجدولة حالياً",
            onetime: "لا توجد مهام لمرة واحدة",
            archived: "قائمة المهام المؤرشفة فارغة",
            removed: "لا توجد مهام محذوفة"
        };
        container.innerHTML = `<div class="empty-state"><h3>${emptyLabels[analyticsTaskStatusFilter] || 'لا توجد مهام لعرضها'}</h3></div>`;
        return;
    }

    const catMap = new Map();
    (appData.categories || []).forEach(c => {
        catMap.set(c.name, {
            name: c.name,
            label: c.label || c.name,
            icon: c.icon || "fa-list-check",
            subcategories: c.subcategories || [],
            tasks: []
        });
    });

    filteredTasks.forEach(task => {
        const catName = task.category || "أخرى";
        if (!catMap.has(catName)) {
            catMap.set(catName, {
                name: catName,
                label: catName,
                icon: "fa-folder",
                subcategories: [],
                tasks: []
            });
        }
        catMap.get(catName).tasks.push(task);
    });

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

        const subMap = new Map();
        (catGroupData.subcategories || []).forEach(sub => {
            subMap.set(sub.name, []);
        });

        const generalTasks = [];
        catTasks.forEach(task => {
            const subName = (task.subcategory || "").trim();
            if (subName) {
                if (!subMap.has(subName)) {
                    subMap.set(subName, []);
                }
                subMap.get(subName).push(task);
            } else {
                generalTasks.push(task);
            }
        });

        const hasSubcategoriesWithTasks = Array.from(subMap.values()).some(arr => arr.length > 0);

        const createBreakdownCard = (task) => {
            const statusKey = getTaskStatusKey(task);
            const statusCfg = TASK_STATUS_CONFIG[statusKey] || TASK_STATUS_CONFIG.scheduled;

            let activeTimes = 0;
            let sumRatio = 0;
            let scheduledDaysCount = 0;

            const targetDate = task.oneTimeDate || (task.createdAt ? task.createdAt.slice(0, 10) : null);
            const archiveCutoff = task.archivedAt || null;
            const deletedCutoff = task.deletedAt || null;

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
                } else if (statusKey === "removed") {
                    if (deletedCutoff && d >= deletedCutoff) {
                        isScheduled = val > 0;
                    } else if (!deletedCutoff && lastLoggedDate && d > lastLoggedDate) {
                        isScheduled = val > 0;
                    } else {
                        isScheduled = isTaskScheduledForDate(task, d, val);
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
                        const effProps = getTaskEffectiveProps(task, d);
                        let tgt = (effProps.target && effProps.target > 0) ? effProps.target : (task.target && task.target > 0 ? task.target : 1);
                        const typeVal = effProps.type || task.type;
                        if (typeVal === "ساعة" || typeVal === "ساعات" || typeVal === "ساعات ودقايق" || typeVal === "وقت") {
                            tgt = tgt * 60;
                        }
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
                    let tgt = (task.target && task.target > 0) ? task.target : 1;
                    if (task.type === "ساعة" || task.type === "ساعات" || task.type === "ساعات ودقايق" || task.type === "وقت") {
                        tgt = tgt * 60;
                    }
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
            } else if (statusKey === "removed" && deletedCutoff) {
                metaExtra = `<span>•</span><span><i class="fa-solid fa-trash-can"></i> ${deletedCutoff}</span>`;
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
                    <span class="breakdown-pct ${consistencyPct >= 100 ? 'gold-text' : (consistencyPct >= 65 ? 'emerald-text' : (consistencyPct >= 35 ? 'gold-text' : ''))}">${consistencyPct}%</span>
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

if (typeof window !== "undefined") {
    window.renderAllTimeStats = renderAllTimeStats;
    window.updateChartAndAnalytics = updateChartAndAnalytics;
    window.updateAnalyticsHeroMetrics = updateAnalyticsHeroMetrics;
    window.getSelectedDates = getSelectedDates;
    window.renderTaskBreakdown = renderTaskBreakdown;
    window.initChart = initChart;
}
