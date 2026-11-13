/**
 * Day summary: score ring, badges, header score
 */

function updateDailyScoreSummary() {
    const score = calculateDayScore(currentDateStr);
    const scorePct = Math.round(score * 100);
    const clampedPct = Math.min(100, scorePct);

    // Update ring percentage text
    const ringPct = document.getElementById("daily-ring-percentage");
    if (ringPct) ringPct.textContent = `${scorePct}%`;

    // Update SVG ring
    const ringCircle = document.getElementById("daily-ring-circle");
    if (ringCircle) {
        const circumference = APP_CONSTANTS.UI.SCORE_RING_CIRCUMFERENCE;
        const offset = circumference - (clampedPct / 100) * circumference;
        ringCircle.style.strokeDashoffset = offset;
        const { GOLD, GREEN, BLUE } = APP_CONSTANTS.UI.SCORE_THRESHOLDS;
        ringCircle.style.stroke = scorePct >= GOLD ? "#f59e0b" : (scorePct >= GREEN ? "#10b981" : (scorePct >= BLUE ? "#3b82f6" : "#64748b"));
    }

    // Count completed tasks for the badge
    const allScheduled = (appData && appData.tasks) ? appData.tasks.filter(t => ScheduleEngine.isVisibleOn(t, currentDateStr, appData)) : [];
    const log = appData?.logs?.[currentDateStr];
    let completedCount = 0;
    let activeTotal = 0;
    allScheduled.forEach(t => {
        const tp = log?.taskProgress?.[t.id];
        if (tp && typeof tp === "object" && tp.status === "disabled") return;

        activeTotal++;
        const val = getTaskVal(t.id);
        if (isTaskCompleted(t, val, currentDateStr)) {
            completedCount++;
        }
    });

    const completedBadge = document.getElementById("daily-completed-badge");
    if (completedBadge) {
        const countText = activeTotal > 0 ? `${completedCount} / ${activeTotal} مكتمل` : `${completedCount} مكتمل`;
        completedBadge.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${countText}`;
    }

    // Calculate total completed time for today in minutes
    const completedHours = ScoringEngine.calculateDayScore(currentDateStr, appData, true);
    const completedMinutes = Math.round(completedHours * 60);
    const completedTimeBadge = document.getElementById("daily-completed-time-badge");
    if (completedTimeBadge) {
        const formattedCompleted = typeof formatTimeHM === "function" ? formatTimeHM(completedMinutes) : `${completedMinutes} دقيقة`;
        completedTimeBadge.innerHTML = `<i class="fa-solid fa-stopwatch"></i> المنجز: ${formattedCompleted}`;
    }
}

function updateHeaderTodayScore() {
    const todayStr = getLocalTodayString();
    const score = calculateDayScore(todayStr);
    const scorePct = Math.round(score * 100);
    const headerEl = document.getElementById("header-today-score");
    if (headerEl) headerEl.textContent = `${scorePct}%`;

    if (typeof renderAllTimeStats === "function") {
        renderAllTimeStats();
    }
}
