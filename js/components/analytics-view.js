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

function renderAllTimeStats() {
    if (!appData || !appData.logs) return;
    const allDates = getRecordedDates();

    const elHeaderScore = document.getElementById("header-alltime-score");
    const elHeaderDays = document.getElementById("header-total-days");
    const elAnalyticsVal = document.getElementById("analytics-alltime-val");
    const elAnalyticsSub = document.getElementById("analytics-alltime-sub");

    if (allDates.length === 0) {
        if (elHeaderScore) elHeaderScore.textContent = "0%";
        if (elHeaderDays) elHeaderDays.textContent = "0";
        if (elAnalyticsVal) elAnalyticsVal.textContent = "0%";
        if (elAnalyticsSub) elAnalyticsSub.textContent = "لم يتم تسجيل أيام بعد";
        return;
    }

    let sumScores = 0;
    allDates.forEach(d => {
        sumScores += calculateDayScore(d);
    });

    const averageScore = sumScores / allDates.length;
    const avgPercent = Math.round(averageScore * 100);

    if (elHeaderScore) elHeaderScore.textContent = `${avgPercent}%`;
    if (elHeaderDays) elHeaderDays.textContent = allDates.length.toString();

    if (elAnalyticsVal) elAnalyticsVal.textContent = `${avgPercent}%`;
    if (elAnalyticsSub) elAnalyticsSub.textContent = `بناءً على ${allDates.length} يوماً مسجلاً في السجل التراكمي`;
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
    const allDates = getRecordedDates();
    let selectedDates = allDates;

    if (chartTimeRange !== "all") {
        const daysLimit = parseInt(chartTimeRange, 10);
        if (allDates.length > daysLimit) {
            selectedDates = allDates.slice(-daysLimit);
        }
    }

    const fullDataList = [];
    let periodSum = 0;
    let bestDayHours = 0;
    let bestDayLabel = "--";

    selectedDates.forEach((dateStr, idx) => {
        const hours = (typeof ScoringEngine !== "undefined")
            ? ScoringEngine.calculateDayScore(dateStr, (typeof appData !== "undefined" ? appData : null), true)
            : calculateDayScore(dateStr, null, true);
        const hoursFormatted = Math.round(hours * 10) / 10;

        const d = new Date(dateStr);
        const label = !isNaN(d) ? `${d.getDate()}/${d.getMonth() + 1}` : dateStr;

        fullDataList.push({
            index: idx,
            dateStr,
            label,
            hours: hoursFormatted
        });

        periodSum += hoursFormatted;

        if (hoursFormatted > bestDayHours) {
            bestDayHours = hoursFormatted;
            bestDayLabel = `${label} (${hoursFormatted} س)`;
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

function renderTaskBreakdown(allDates) {
    const container = document.getElementById("analytics-tasks-breakdown");
    if (!container) return;
    container.innerHTML = "";

    const activeTasks = (appData.tasks || []).filter(t => !t.isArchived && !t.isOneTime && t.schedule !== "OneTime");
    if (activeTasks.length === 0) {
        container.innerHTML = `<div class="empty-state"><h3>لا توجد أوراد لعرض نسبة الالتزام</h3></div>`;
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

    activeTasks.forEach(task => {
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
            let activeTimes = 0;
            let sumRatio = 0;
            let scheduledDaysCount = 0;

            (allDates || []).forEach(d => {
                const log = appData.logs[d];
                const val = (log && log.entries) ? (log.entries[task.id] || 0) : 0;
                const isScheduled = isTaskScheduledForDate(task, d, val);

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

            const effectiveTotalDays = scheduledDaysCount;
            const consistencyPct = effectiveTotalDays > 0 ? Math.round((sumRatio / effectiveTotalDays) * 100) : 0;
            catSumPct += consistencyPct;
            const iconHtml = getCategoryIconHtml(task);

            const card = document.createElement("div");
            card.className = "breakdown-card horizontal";
            card.innerHTML = `
                <div class="breakdown-info">
                    <span class="breakdown-title">${iconHtml} ${task.name}</span>
                    <div class="breakdown-meta">
                        <span>${activeTimes} / ${effectiveTotalDays} يوم</span>
                        <span>•</span>
                        <span>${task.type}</span>
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
                <span class="manager-cat-count-badge">${catTasks.length} ${catTasks.length === 1 ? 'ورد' : (catTasks.length <= 10 ? 'أوراد' : 'ورد')}</span>
            </div>
        `;

        catCard.appendChild(catHeader);
        catCard.appendChild(catBody);
        container.appendChild(catCard);
    });
}
