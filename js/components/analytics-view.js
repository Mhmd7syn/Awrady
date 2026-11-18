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

    const totalDays = Math.round((new Date(todayStr + "T12:00:00") - new Date(earliestDate + "T12:00:00")) / 86400000) + 1;

    let effectiveRange = chartTimeRange;
    if (totalDays <= 7) {
        effectiveRange = "7";
    } else if (totalDays <= 30 && chartTimeRange === "all") {
        effectiveRange = "30";
    }

    if (effectiveRange === "7") {
        return generateDateRange(getBoundedStart(7), todayStr);
    }

    if (effectiveRange === "30") {
        return generateDateRange(getBoundedStart(30), todayStr);
    }

    // "all": continuous calendar days from earliest record to today
    return generateDateRange(earliestDate, todayStr);
}

function calculateScoreForDates(dates) {
    if (!dates || dates.length === 0) return { avgPercent: 0, count: 0 };
    let sumScores = 0;
    let count = 0;
    dates.forEach(d => {
        const score = ScoringEngine.calculateDayScore(d, appData, false);
        sumScores += score;
        count++;
    });
    if (count === 0) return { avgPercent: 0, count: 0 };
    return { avgPercent: Math.round((sumScores / count) * 100), count };
}

function updateAnalyticsHeroMetrics(selectedDates = null) {
    const allDates = getRecordedDates();
    const currentRange = (typeof chartTimeRange !== "undefined") ? chartTimeRange : "all";
    const targetDates = (currentRange === "all") ? allDates : (selectedDates || getSelectedDates());

    const elHeroTitle = document.getElementById("analytics-hero-title");
    const elAnalyticsVal = document.getElementById("analytics-alltime-val");
    const elAnalyticsSub = document.getElementById("analytics-alltime-sub");

    if (elHeroTitle) {
        if (currentRange === "7") {
            elHeroTitle.textContent = "معدل الأسبوع";
        } else if (currentRange === "30") {
            elHeroTitle.textContent = "معدل الشهر";
        } else {
            elHeroTitle.textContent = "المعدل العام";
        }
    }

    if (targetDates.length === 0) {
        if (elAnalyticsVal) elAnalyticsVal.textContent = "0%";
        if (elAnalyticsSub) elAnalyticsSub.textContent = "لم يتم تسجيل أيام بعد";
        return;
    }

    const { avgPercent } = calculateScoreForDates(targetDates);

    if (elAnalyticsVal) elAnalyticsVal.textContent = `${avgPercent}%`;

    if (elAnalyticsSub) {
        if (currentRange === "all") {
            elAnalyticsSub.textContent = "السجل التراكمي لكافة الأيام";
        } else if (currentRange === "7") {
            elAnalyticsSub.textContent = targetDates.length >= 7
                ? `بناءً على آخر 7 أيام متتالية`
                : `بناءً على ${targetDates.length} أيام مسجلة منذ الانضمام`;
        } else if (currentRange === "30") {
            elAnalyticsSub.textContent = targetDates.length >= 30
                ? `بناءً على آخر 30 يوماً متتالياً`
                : `بناءً على ${targetDates.length} يوماً منذ بدء الاستخدام`;
        } else {
            elAnalyticsSub.textContent = `بناءً على ${targetDates.length} يوماً في هذه الفترة`;
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
                interaction: {
                    mode: "index",
                    intersect: false
                },
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
                                if (rawVal !== undefined && (ds?.smoothingDays > 1) && rawVal !== val) {
                                    const windowDays = ds?.smoothingDays;
                                    const windowLabel = windowDays <= 10 ? `${windowDays} أيام` : `${windowDays} يوماً`;
                                    return [
                                        `المعدل السلس (${windowLabel}): ${val} ساعة`,
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
 * Computes per-point radii so that only local minima, local maxima, and series boundaries
 * display visible markers. Eliminates cluttered continuous dots along slopes on long smoothed series
 * while keeping all days hoverable and clickable.
 * @param {number[]} values Array of data values (e.g. smoothed daily hours)
 * @param {number} [activeRadius=4] Radius for local extrema points
 * @returns {number[]} Array of radii corresponding to each data point
 */
function getExtremaPointRadii(values, activeRadius = 4) {
    if (!Array.isArray(values) || values.length === 0) return [];
    const n = values.length;
    if (n <= 7) {
        return new Array(n).fill(activeRadius);
    }

    const radii = new Array(n).fill(0);

    // 1. Group consecutive equal or near-equal values into plateaus
    const segments = [];
    let idx = 0;
    while (idx < n) {
        const start = idx;
        const val = values[idx];
        while (idx + 1 < n && Math.abs(values[idx + 1] - val) < 0.05) {
            idx++;
        }
        const end = idx;
        const mid = Math.floor((start + end) / 2);
        segments.push({ start, end, mid, val });
        idx++;
    }

    const numSegs = segments.length;
    const winRadius = n > 60 ? 3 : (n > 25 ? 2 : 1);
    const candidates = [];

    for (let s = 0; s < numSegs; s++) {
        const cur = segments[s];

        // Boundary: first point of series
        if (s === 0) {
            if (numSegs > 1) {
                const nextVal = segments[1].val;
                if (cur.val > nextVal + 0.1) {
                    candidates.push({ index: cur.start, val: cur.val, type: "MAX" });
                } else if (cur.val < nextVal - 0.1) {
                    candidates.push({ index: cur.start, val: cur.val, type: "MIN" });
                }
            }
            continue;
        }

        // Boundary: last point of series (today)
        if (s === numSegs - 1) {
            const prevVal = segments[s - 1].val;
            if (cur.val > prevVal + 0.1) {
                candidates.push({ index: cur.end, val: cur.val, type: "MAX" });
            } else if (cur.val < prevVal - 0.1) {
                candidates.push({ index: cur.end, val: cur.val, type: "MIN" });
            }
            continue;
        }

        const prevVal = segments[s - 1].val;
        const nextVal = segments[s + 1].val;

        const isMax = cur.val > prevVal && cur.val > nextVal;
        const isMin = cur.val < prevVal && cur.val < nextVal;

        if (isMax || isMin) {
            const winStart = Math.max(0, cur.mid - winRadius);
            const winEnd = Math.min(n - 1, cur.mid + winRadius);

            let isExtremumInWindow = true;
            for (let j = winStart; j <= winEnd; j++) {
                if (isMax && values[j] > cur.val) {
                    isExtremumInWindow = false;
                    break;
                }
                if (isMin && values[j] < cur.val) {
                    isExtremumInWindow = false;
                    break;
                }
            }

            if (isExtremumInWindow) {
                candidates.push({
                    index: cur.mid,
                    val: cur.val,
                    type: isMax ? "MAX" : "MIN"
                });
            }
        }
    }

    // Post-filter: prevent adjacent clustered points (< 2 indices apart)
    const filtered = [];
    for (const cand of candidates) {
        if (filtered.length === 0) {
            filtered.push(cand);
        } else {
            const last = filtered[filtered.length - 1];
            if (cand.index - last.index < 2) {
                if (cand.type === "MAX" && last.type === "MAX") {
                    if (cand.val > last.val) filtered[filtered.length - 1] = cand;
                } else if (cand.type === "MIN" && last.type === "MIN") {
                    if (cand.val < last.val) filtered[filtered.length - 1] = cand;
                }
            } else {
                filtered.push(cand);
            }
        }
    }

    for (const item of filtered) {
        radii[item.index] = activeRadius;
    }

    return radii;
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

    const dynamicRadius = Math.min(10, Math.round(fullDataList.length * (1 / 30)));
    const smoothingDays = (dynamicRadius * 2) + 1;
    const chartData = applyCenteredMovingAverage(fullDataList, dynamicRadius);

    const labels = chartData.map(item => item.label);
    const dataPoints = chartData.map(item => item.hours);
    const rawDates = chartData.map(item => item.dateStr);
    const rawHours = chartData.map(item => item.rawHours !== undefined ? item.rawHours : item.hours);

    if (chartInstance) {
        chartInstance.data.labels = labels;
        chartInstance.data.datasets[0].data = dataPoints;
        chartInstance.data.datasets[0].rawDates = rawDates;
        chartInstance.data.datasets[0].rawHours = rawHours;
        chartInstance.data.datasets[0].smoothingDays = smoothingDays;
        const activeRadius = (typeof window !== "undefined" && window.innerWidth < 500) ? 3 : 4;
        chartInstance.data.datasets[0].pointRadius = getExtremaPointRadii(dataPoints, activeRadius);
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
    window.getExtremaPointRadii = getExtremaPointRadii;
}
