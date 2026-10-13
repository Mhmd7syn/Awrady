/**
 * Awrady Dashboard - Weekly Schedule & Hours Breakdown Modal Component
 */

let weeklyModalOptions = {
    includeEveryday: false,
    includeBonusAndOneTime: true
};

let weeklyModalRefDateStr = null;

function toggleWeeklyOption(optKey) {
    weeklyModalOptions[optKey] = !weeklyModalOptions[optKey];
    showWeeklyHoursModal();
}

function navigateWeeklyModal(daysShift) {
    const curDateStr = typeof currentDateStr !== "undefined" ? currentDateStr : getLocalTodayString();
    const currentRef = weeklyModalRefDateStr || curDateStr || getLocalTodayString();
    weeklyModalRefDateStr = addDays(currentRef, daysShift);
    showWeeklyHoursModal();
}

function resetWeeklyModalToToday() {
    weeklyModalRefDateStr = getLocalTodayString();
    showWeeklyHoursModal();
}

function getTasksSummaryByDay(options = null) {
    const opts = options || weeklyModalOptions;
    const curDateStr = typeof currentDateStr !== "undefined" ? currentDateStr : getLocalTodayString();
    const refDateStr = weeklyModalRefDateStr || curDateStr || getLocalTodayString();
    const days = getDatesForCurrentWeek(refDateStr);

    const result = {};

    days.forEach(day => {
        let totalMins = 0;
        const taskList = [];
        const dateStr = day.dateStr;
        const dataStore = window.appData || { tasks: [] };

        (dataStore.tasks || []).forEach(t => {
            if (t.isArchived) return;

            const logEntry = dataStore.logs?.[dateStr];
            const val = logEntry?.entries?.[t.id] || 0;
            const isExplicitBonus = logEntry?.bonusTaskIds?.includes(t.id);

            const cat = t.category || "";
            const sched = (t.schedule || "").trim();
            const isOneTime = sched === "OneTime";
            const isEveryday = sched === "Everyday" || sched === "";
            const isBonus = Boolean(isExplicitBonus);

            const isScheduled = ScheduleEngine.isTaskScheduledForDate(t, dateStr, dataStore, val);

            if (isBonus) {
                if (!(val > 0) && !isExplicitBonus) return;
                if (!opts.includeBonusAndOneTime) return;
            } else if (isOneTime) {
                if (!isScheduled && !(val > 0)) return;
                if (!opts.includeBonusAndOneTime) return;
            } else {
                if (!isScheduled && !(val > 0)) return;
                if (isEveryday && !opts.includeEveryday) return;
            }

            const weightMins = ScoringEngine.getTaskWeightMinutes(t);
            totalMins += weightMins;
            const target = t.target || 1;
            const unit = ScoringEngine.getTaskUnit(t);

            taskList.push({
                name: t.name,
                category: cat,
                subcategory: t.subcategory,
                target: target,
                unit: unit,
                schedule: sched,
                isEveryday: isEveryday,
                isOneTime: isOneTime,
                isBonus: isBonus,
                minutes: weightMins,
                hours: (weightMins / 60).toFixed(2)
            });
        });

        const dayDisplayName = day.dayNameAr;
        result[dayDisplayName] = {
            dayName: dayDisplayName,
            dayKey: day.dayNameEn,
            totalMinutes: totalMins,
            totalHours: (totalMins / 60).toFixed(2),
            formattedTime: formatTimeHM(totalMins),
            tasks: taskList
        };
    });

    return result;
}

function showWeeklyHoursModal(forceCurrentDate = false) {
    const realTodayStr = getLocalTodayString();
    const curDateStr = typeof currentDateStr !== "undefined" ? currentDateStr : realTodayStr;
    
    if (forceCurrentDate || !weeklyModalRefDateStr) {
        weeklyModalRefDateStr = curDateStr;
    }

    const summary = getTasksSummaryByDay(weeklyModalOptions);
    const days = getDatesForCurrentWeek(weeklyModalRefDateStr);
    const startDateFormatted = days[0]?.dateStr || "";
    const endDateFormatted = days[6]?.dateStr || "";

    const realTodayDays = getDatesForCurrentWeek(realTodayStr);
    const realTodayStart = realTodayDays[0]?.dateStr || "";
    const isDifferentWeekFromRealToday = startDateFormatted !== realTodayStart;

    let modal = document.getElementById("weekly-hours-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "weekly-hours-modal";
        modal.className = "modal-overlay";
        document.body.appendChild(modal);
    }

    let cardsHtml = "";
    Object.keys(summary).forEach(dayName => {
        const dayData = summary[dayName];
        let tasksListHtml = "";
        dayData.tasks.forEach(t => {
            let tagHtml = "";
            if (t.isBonus) tagHtml += `<span title="Bonus" style="font-size:0.85rem; margin-right:4px;">🎁</span>`;
            if (t.isOneTime) tagHtml += `<span title="OneTime" style="font-size:0.85rem; margin-right:4px;">⚡</span>`;
            if (t.isEveryday) tagHtml += `<span title="Everyday" style="font-size:0.85rem; margin-right:4px;">🔄</span>`;

            tasksListHtml += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:6px; margin-bottom:6px; font-size:0.9rem;">
                    <span>📌 <strong>${t.name}</strong> ${tagHtml}</span>
                    <span style="color:#10b981; font-weight:700;">${t.target} ${t.unit} (${t.hours} ساعة)</span>
                </div>
            `;
        });

        if (dayData.tasks.length === 0) {
            tasksListHtml = `<div style="color:#94a3b8; font-size:0.85rem; padding:6px 0;">لا توجد تاسكات مجدولة لهذا اليوم بالتصفية الحالية</div>`;
        }

        cardsHtml += `
            <div class="glass-card" style="padding:14px 18px; margin-bottom:14px; border-right:5px solid #10b981;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <h4 style="margin:0; font-size:1.15rem; color:#f8fafc;">📅 ${dayData.dayName}</h4>
                    <span class="badge badge-emerald" style="font-size:0.95rem; padding:5px 12px; font-weight:700;">⏱ المجموع: ${dayData.formattedTime} (${dayData.totalHours} ساعة)</span>
                </div>
                <div>${tasksListHtml}</div>
            </div>
        `;
    });

    const returnBtnHtml = isDifferentWeekFromRealToday ? `
        <button onclick="window.resetWeeklyModalToToday()" style="background:none; border:none; color:#10b981; font-size:0.75rem; cursor:pointer; text-decoration:underline; padding:0; margin-top:2px;">العودة للأسبوع الحالي</button>
    ` : "";

    modal.innerHTML = `
        <div class="modal-container glass-card" style="max-width: 720px; max-height: 85vh; overflow-y: auto;">
            <div class="modal-header" style="position:sticky; top:0; background:rgba(15,23,42,0.98); z-index:10; padding-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.1);">
                <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                    <h3 style="margin:0;"><i class="fa-solid fa-calendar-week gold-text"></i> عرض الجدول الأسبوعي</h3>
                    <button class="btn-close" onclick="document.getElementById('weekly-hours-modal').classList.add('hidden')"><i class="fa-solid fa-xmark"></i></button>
                </div>
            </div>
            <div class="modal-body" style="padding:15px 0;">
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:8px; margin-bottom:12px; border:1px solid rgba(255,255,255,0.08);">
                    <button onclick="window.navigateWeeklyModal(-7)" class="btn-secondary" style="font-size:0.8rem; padding:4px 10px; cursor:pointer;" title="الأسبوع السابق">
                        <i class="fa-solid fa-chevron-right"></i> الأسبوع السابق
                    </button>
                    <div style="text-align:center;">
                        <span style="font-weight:700; color:#f59e0b; font-size:0.9rem; display:block;">📅 الأسبوع من ${startDateFormatted} إلى ${endDateFormatted}</span>
                        ${returnBtnHtml}
                    </div>
                    <button onclick="window.navigateWeeklyModal(7)" class="btn-secondary" style="font-size:0.8rem; padding:4px 10px; cursor:pointer;" title="الأسبوع التالي">
                        الأسبوع التالي <i class="fa-solid fa-chevron-left"></i>
                    </button>
                </div>
                <div style="display:flex; gap:8px; margin-bottom:14px; align-items:center;">
                    <button onclick="window.toggleWeeklyOption('includeEveryday')" class="btn-secondary" style="font-size:0.8rem; padding:6px 12px; cursor:pointer; ${weeklyModalOptions.includeEveryday ? 'background:#10b981; color:#fff; border-color:#10b981;' : 'opacity:0.6;'}">
                        <i class="fa-solid ${weeklyModalOptions.includeEveryday ? 'fa-square-check' : 'fa-square'}"></i> 🔄 Everyday Tasks
                    </button>
                    <button onclick="window.toggleWeeklyOption('includeBonusAndOneTime')" class="btn-secondary" style="font-size:0.8rem; padding:6px 12px; cursor:pointer; ${weeklyModalOptions.includeBonusAndOneTime ? 'background:#f59e0b; color:#fff; border-color:#f59e0b;' : 'opacity:0.6;'}">
                        <i class="fa-solid ${weeklyModalOptions.includeBonusAndOneTime ? 'fa-square-check' : 'fa-square'}"></i> 🎁⚡ Bonus & OneTime
                    </button>
                </div>
                ${cardsHtml}
            </div>
        </div>
    `;

    modal.classList.remove("hidden");
}

if (typeof window !== "undefined") {
    window.toggleWeeklyOption = toggleWeeklyOption;
    window.navigateWeeklyModal = navigateWeeklyModal;
    window.resetWeeklyModalToToday = resetWeeklyModalToToday;
    window.getTasksSummaryByDay = getTasksSummaryByDay;
    window.showWeeklyHoursModal = showWeeklyHoursModal;
}
