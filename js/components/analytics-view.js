/**
 * ============================================================================
 * AWRAD PRO - ANALYTICS VIEW COMPONENT
 * Handles Chart.js initialization, overall statistics, and task breakdown calculations.
 * ============================================================================
 */

let chartTimeRange = "all";
if (typeof window !== "undefined") {
    window.chartTimeRange = chartTimeRange;
}

function getRecordedDates() {
    if (!appData || !appData.logs) return [];
    const todayStr = typeof getLocalTodayString === "function" ? getLocalTodayString() : new Date().toISOString().slice(0, 10);
    return Object.keys(appData.logs).filter(d => {
        if (d > todayStr) return false;
        const log = appData.logs[d];
        if (!log) return false;
        const hasPositiveAchieved = log.taskProgress && Object.values(log.taskProgress).some(p => (Number(p?.achieved) || 0) > 0);
        const hasScore = (Number(log.total_score) || 0) > 0 || (Number(log.precomputedScore) || 0) > 0;
        const hasDisabled = Boolean(log.taskProgress && Object.values(log.taskProgress).some(p => p?.status === "disabled"));
        const hasBonus = Boolean(log.taskProgress && Object.values(log.taskProgress).some(p => p?.status === "bonus" && (Number(p?.achieved) || 0) > 0));
        const hasPrayerExtras = Boolean(
            log.prayerExtras &&
            Object.values(log.prayerExtras).some(v => (Number(v?.nawafel) || 0) > 0 || Boolean(v?.azkar))
        );
        return hasPositiveAchieved || hasScore || hasDisabled || hasBonus || hasPrayerExtras;
    }).sort();
}

function shiftDateDays(dateStr, days) {
    if (typeof addDays === "function") {
        return addDays(dateStr, days);
    }
    const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T12:00:00");
    d.setDate(d.getDate() + days);
    return (typeof getLocalTodayString === "function") ? getLocalTodayString(d) : d.toISOString().slice(0, 10);
}

function generateDateRange(startDate, endDate) {
    if (!startDate || !endDate || startDate > endDate) return [];
    const dates = [];
    let current = startDate;
    while (current <= endDate) {
        dates.push(current);
        current = shiftDateDays(current, 1);
    }
    return dates;
}

function getSelectedDates() {
    const recordedDates = getRecordedDates();
    if (!recordedDates || recordedDates.length === 0) return [];

    const todayStr = typeof getLocalTodayString === "function" ? getLocalTodayString() : new Date().toISOString().slice(0, 10);
    const earliestDate = recordedDates[0];

    const getBoundedStart = (daysLimit) => {
        const theoreticalStart = shiftDateDays(todayStr, -(daysLimit - 1));
        // Never start before the user's first recorded day
        return theoreticalStart < earliestDate ? earliestDate : theoreticalStart;
    };

    if (chartTimeRange === "7") {
        return generateDateRange(getBoundedStart(7), todayStr);
    }

    if (chartTimeRange === "30") {
        return generateDateRange(getBoundedStart(30), todayStr);
    }

    // "all": continuous calendar days from earliest record to today
    return generateDateRange(earliestDate, todayStr);
}

function calculateScoreForDates(dates) {
    if (!dates || dates.length === 0) return { avgPercent: 0, count: 0 };
    const todayStr = typeof getLocalTodayString === "function" ? getLocalTodayString() : new Date().toISOString().slice(0, 10);
    let sumScores = 0;
    let count = 0;
    dates.forEach(d => {
        const score = ScoringEngine.calculateDayScore(d, appData, false);
        // Exclude in-progress ongoing day with 0 score so it does not pull down the average
        if (d === todayStr && score <= 0) {
            return;
        }
        sumScores += score;
        count++;
    });
    if (count === 0) return { avgPercent: 0, count: 0 };
    return { avgPercent: Math.round((sumScores / count) * 100), count };
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

    const { avgPercent } = calculateScoreForDates(activeDates);

    if (elAnalyticsVal) elAnalyticsVal.textContent = `${avgPercent}%`;

    if (elAnalyticsSub) {
        if (currentRange === "all") {
            elAnalyticsSub.textContent = `السجل التراكمي لكافة الأيام (${activeDates.length} يوماً)`;
        } else if (currentRange === "7") {
            elAnalyticsSub.textContent = activeDates.length >= 7
                ? `بناءً على آخر 7 أيام متتالية`
                : `بناءً على ${activeDates.length} أيام مسجلة منذ الانضمام`;
        } else if (currentRange === "30") {
            elAnalyticsSub.textContent = activeDates.length >= 30
                ? `بناءً على آخر 30 يوماً متتالياً`
                : `بناءً على ${activeDates.length} يوماً منذ بدء الاستخدام`;
        } else {
            elAnalyticsSub.textContent = `بناءً على ${activeDates.length} يوماً في هذه الفترة`;
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
        const { avgPercent } = calculateScoreForDates(allDates);
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
                    tension: 0.3,
                    cubicInterpolationMode: 'monotone',
                    pointBackgroundColor: "#f59e0b",
                    pointBorderColor: "#fff",
                    pointRadius: 4,
                    pointHoverRadius: 7,
                    pointHitRadius: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (event, elements, chart) => {
                    if (!elements || !elements.length) return;
                    const datasetIndex = elements[0].datasetIndex ?? 0;
                    const pointIndex = elements[0].index;
                    const targetDate = chart.data?.datasets?.[datasetIndex]?.rawDates?.[pointIndex];
                    if (!targetDate) return;

                    if (typeof switchActiveDate === "function") {
                        switchActiveDate(targetDate);
                    } else if (typeof window !== "undefined" && typeof window.switchActiveDate === "function") {
                        window.switchActiveDate(targetDate);
                    }

                    const dailyTab = document.querySelector('.nav-tab[data-tab="view-daily"]');
                    if (dailyTab) {
                        dailyTab.click();
                    }
                },
                onHover: (event, elements) => {
                    const canvas = event.native ? event.native.target : event.chart?.canvas;
                    if (canvas) {
                        canvas.style.cursor = elements && elements.length ? "pointer" : "default";
                    }
                },
                plugins: {
                    legend: { display: false },
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
                                const ds = context.dataset;
                                const rawVal = ds?.rawHours?.[context.dataIndex];
                                const val = context.parsed.y;
                                if (rawVal !== undefined && (chartTimeRange === "30" || chartTimeRange === "all") && rawVal !== val) {
                                    return [
                                        `المعدل السلس (7 أيام): ${val} ساعة`,
                                        `إنجاز اليوم الفعلي: ${rawVal} ساعة`
                                    ];
                                }
                                return `ساعات الإنجاز: ${val} ساعة`;
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
            if (typeof window !== "undefined") {
                window.chartTimeRange = chartTimeRange;
            }
            updateChartAndAnalytics();
        });
    });

    setupAnalyticsFilters();
}

/**
 * Smooths time-series daily data using a centered moving average with an adaptive boundary window.
 * Uses a centered window of [i - radius, i + radius] (e.g. radius=3 for a 7-day window).
 * At boundaries (such as today or the first recorded dates), it adaptively averages whatever
 * days are currently available within that radius to avoid cutting off recent data.
 * @param {Array<{dateStr: string, label: string, hours: number}>} data
 * @param {number} radius Window radius (default 3, for a 7-day window)
 * @returns {Array<{dateStr: string, label: string, hours: number, rawHours: number}>}
 */
function applyCenteredMovingAverage(data, radius = 3) {
    if (!data || data.length === 0) return [];
    if (radius <= 0 || data.length <= 1) {
        return data.map(item => ({ ...item, rawHours: item.hours }));
    }

    return data.map((item, idx) => {
        const start = Math.max(0, idx - radius);
        const end = Math.min(data.length - 1, idx + radius);
        let sum = 0;
        let count = 0;
        for (let j = start; j <= end; j++) {
            sum += data[j].hours;
            count++;
        }
        const smoothedHours = count > 0 ? Math.round((sum / count) * 10) / 10 : item.hours;
        return {
            ...item,
            hours: smoothedHours,
            rawHours: item.hours
        };
    });
}

/**
 * Downsamples time-series data using Largest Triangle Three Buckets (LTTB) algorithm.
 * Guarantees that first and last points are kept, and significant peaks/valleys are retained.
 * Retained for use with percentage / completion rate charts (Issue #21).
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

    // Ensure header all-time score and commitment days stay synchronized
    renderAllTimeStats();

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

    let chartData = fullDataList;

    if (chartTimeRange === "30" || chartTimeRange === "all") {
        chartData = applyCenteredMovingAverage(fullDataList, 3);
    }

    const labels = chartData.map(item => item.label);
    const dataPoints = chartData.map(item => item.hours);
    const rawDates = chartData.map(item => item.dateStr);
    const rawHours = chartData.map(item => item.rawHours !== undefined ? item.rawHours : item.hours);

    if (chartInstance) {
        chartInstance.data.labels = labels;
        chartInstance.data.datasets[0].data = dataPoints;
        chartInstance.data.datasets[0].rawDates = rawDates;
        chartInstance.data.datasets[0].rawHours = rawHours;
        chartInstance.data.datasets[0].pointRadius = chartData.length > 35 ? (window.innerWidth < 500 ? 0 : 2) : 4;
        chartInstance.data.datasets[0].pointHoverRadius = 7;
        chartInstance.data.datasets[0].pointHitRadius = 10;
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
    window.downsampleLTTB = downsampleLTTB;
    window.applyCenteredMovingAverage = applyCenteredMovingAverage;
}
