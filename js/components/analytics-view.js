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
        const hasPrecomputed = log.precomputedScore !== undefined && log.precomputedScore !== null;
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
        sumScores += ScoringEngine.calculateDayScore(d, appData, false);
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
            sumScores += ScoringEngine.calculateDayScore(d, appData, false);
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
        const hours = ScoringEngine.calculateDayScore(dateStr, appData, true);
        const hoursFormatted = Math.round(hours * 10) / 10;

        const score = ScoringEngine.calculateDayScore(dateStr, appData, false);

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
    const maxPoints = window.innerWidth < APP_CONSTANTS.UI.MOBILE_BREAKPOINT ? APP_CONSTANTS.UI.CHART_MAX_POINTS_MOBILE : APP_CONSTANTS.UI.CHART_MAX_POINTS;
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

if (typeof window !== "undefined") {
    window.renderAllTimeStats = renderAllTimeStats;
    window.updateChartAndAnalytics = updateChartAndAnalytics;
    window.updateAnalyticsHeroMetrics = updateAnalyticsHeroMetrics;
    window.getSelectedDates = getSelectedDates;
    window.initChart = initChart;
}
