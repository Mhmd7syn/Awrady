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
    const allScheduled = appData.tasks.filter(t => ScheduleEngine.isVisibleOn(t, currentDateStr, appData));
    let completedCount = 0;
    let inProgressCount = 0;
    allScheduled.forEach(t => {
        const val = getTaskVal(t.id);
        const isDone = isTaskCompleted(t, val, currentDateStr);
        if (isDone) completedCount++;
        else if (val > 0) inProgressCount++;
    });

    const completedBadge = document.getElementById("daily-completed-badge");
    const inProgressBadge = document.getElementById("daily-in-progress-badge");
    if (completedBadge) completedBadge.textContent = `${completedCount} مكتمل`;
    if (inProgressBadge) inProgressBadge.textContent = `${inProgressCount} قيد الإنجاز`;

    // Calculate remaining estimated time in minutes for today's scheduled non-bonus tasks
    let totalRemainingMinutes = 0;
    allScheduled.forEach(t => {
        const isBonus = ScheduleEngine.isBonusTaskForDate(t, currentDateStr, appData);
        if (isBonus) return;

        const val = getTaskVal(t.id);
        const target = t.target || 0;

        if (isTimeTask(t)) {
            const normTarget = getTaskNormalizedTarget(t, currentDateStr);
            if (normTarget > 0 && val < normTarget) {
                totalRemainingMinutes += (normTarget - val);
            }
        } else {
            if (target > 0 && val < target) {
                const totalWeightMins = ScoringEngine.getTaskWeightMinutes(t, currentDateStr, appData);
                const unitWeightMins = totalWeightMins / (target || 1);
                const remUnits = target - val;
                totalRemainingMinutes += (remUnits * unitWeightMins);
            }
        }
    });

    const estTimeBadge = document.getElementById("daily-estimated-time-badge");
    if (estTimeBadge) {
        totalRemainingMinutes = Math.round(totalRemainingMinutes);
        if (totalRemainingMinutes <= 0) {
            estTimeBadge.innerHTML = `<i class="fa-solid fa-circle-check"></i> المتبقي: 0 دقيقة`;
            estTimeBadge.style.background = "rgba(16, 185, 129, 0.2)";
            estTimeBadge.style.color = "#10b981";
        } else if (totalRemainingMinutes >= 60) {
            const h = Math.floor(totalRemainingMinutes / 60);
            const m = totalRemainingMinutes % 60;
            const timeText = m > 0 ? `${h} ساعة و ${m} دقيقة` : `${h} ساعة`;
            estTimeBadge.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> المتبقي: ${timeText}`;
            estTimeBadge.style.background = "rgba(59, 130, 246, 0.2)";
            estTimeBadge.style.color = "#60a5fa";
        } else {
            estTimeBadge.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> المتبقي: ${totalRemainingMinutes} دقيقة`;
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
}
