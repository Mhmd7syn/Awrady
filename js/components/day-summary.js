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

    // Count completed, in-progress, and unstarted tasks for the badges
    const allScheduled = appData.tasks.filter(t => ScheduleEngine.isVisibleOn(t, currentDateStr, appData));
    const log = appData.logs?.[currentDateStr];
    let completedCount = 0;
    let inProgressCount = 0;
    let unstartedCount = 0;
    allScheduled.forEach(t => {
        const tp = log?.taskProgress?.[t.id];
        if (tp && typeof tp === "object" && tp.status === "disabled") return;

        const val = getTaskVal(t.id);
        const isDone = isTaskCompleted(t, val, currentDateStr);
        if (isDone) completedCount++;
        else if (val > 0) inProgressCount++;
        else unstartedCount++;
    });

    const completedBadge = document.getElementById("daily-completed-badge");
    const inProgressBadge = document.getElementById("daily-in-progress-badge");
    const unstartedBadge = document.getElementById("daily-unstarted-badge");
    if (completedBadge) completedBadge.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${completedCount} مكتمل`;
    if (inProgressBadge) inProgressBadge.innerHTML = `<i class="fa-solid fa-spinner"></i> ${inProgressCount} قيد الإنجاز`;
    if (unstartedBadge) unstartedBadge.innerHTML = `<i class="fa-solid fa-clock"></i> ${unstartedCount} لم يبدأ`;

    // Calculate total completed time for today in minutes
    const completedHours = ScoringEngine.calculateDayScore(currentDateStr, appData, true);
    const completedMinutes = Math.round(completedHours * 60);
    const completedTimeBadge = document.getElementById("daily-completed-time-badge");
    if (completedTimeBadge) {
        const formattedCompleted = typeof formatTimeHM === "function" ? formatTimeHM(completedMinutes) : `${completedMinutes} دقيقة`;
        completedTimeBadge.innerHTML = `<i class="fa-solid fa-stopwatch"></i> المنجز: ${formattedCompleted}`;
    }

    // Calculate remaining estimated time in minutes for today's scheduled non-bonus tasks
    let totalRemainingMinutes = 0;
    allScheduled.forEach(t => {
        const tp = log?.taskProgress?.[t.id];
        if (tp && typeof tp === "object" && tp.status === "disabled") return;

        const isBonus = ScheduleEngine.isBonusTaskForDate(t, currentDateStr, appData);
        if (isBonus) return;

        const val = getTaskVal(t.id);
        const target = t.target || 0;

        if (isPrayerSelector(t)) {
            if (val === 0) {
                totalRemainingMinutes += ScoringEngine.getTaskWeightMinutes(t);
            }
        } else if (isTimeTask(t)) {
            const normTarget = getTaskNormalizedTarget(t, currentDateStr);
            if (normTarget > 0 && val < normTarget) {
                totalRemainingMinutes += (normTarget - val);
            }
        } else {
            if (target > 0 && val < target) {
                const totalWeightMins = ScoringEngine.getTaskWeightMinutes(t);
                const unitWeightMins = totalWeightMins / (target || 1);
                const remUnits = target - val;
                totalRemainingMinutes += (remUnits * unitWeightMins);
            }
        }
    });

    const estTimeBadge = document.getElementById("daily-estimated-time-badge");
    if (estTimeBadge) {
        totalRemainingMinutes = Math.round(totalRemainingMinutes);
        const formattedRemaining = typeof formatTimeHM === "function" ? formatTimeHM(totalRemainingMinutes) : `${totalRemainingMinutes} دقيقة`;
        if (totalRemainingMinutes <= 0) {
            estTimeBadge.innerHTML = `<i class="fa-solid fa-circle-check"></i> المتبقي: 0 دقيقة`;
            estTimeBadge.style.background = "rgba(16, 185, 129, 0.2)";
            estTimeBadge.style.color = "#10b981";
        } else {
            estTimeBadge.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> المتبقي: ${formattedRemaining}`;
            estTimeBadge.style.background = "rgba(59, 130, 246, 0.2)";
            estTimeBadge.style.color = "#60a5fa";
        }
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
