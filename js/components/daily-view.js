/**
 * Daily view: task grid rendering, controls, and per-task value updates
 */

import { APP_CONSTANTS } from '../config/constants.js';
import { getHijriDateDetails, getArabicDateFormatted, addDays, getDayOfWeekAbbrev } from '../utils/date-utils.js';
import {
    getTaskUnit,
    isTimeTask,
    getTaskDayTarget,
    getTaskNormalizedTarget,
    isTaskCompleted,
    isPrayerSelector,
    isObligatoryPrayerTask,
    getPrayerSortIndex
} from '../core/task-rules.js';
import { getCategoryIconHtml } from './category-manager.js';
import { ScheduleEngine } from '../core/schedule-engine.js';
import { ScoringEngine } from '../core/scoring-engine.js';
import { AppState } from '../core/state.js';
import { saveData } from '../core/store.js';
import { updateDailyScoreSummary, updateHeaderTodayScore } from './day-summary.js';
import { openPomodoroModal } from './pomodoro.js';
import { openTaskModal } from './task-modal.js';
import { checkAndShowNawafelPrompt, checkAndShowQiyamPrompt, removePrayerExtras } from './nawafel-toast.js';

/**
 * Action button HTML generator for daily task controls
 */
function getTaskActionBtn(task, compact = false) {
    const curDate = AppState.getCurrentDate();
    const appData = AppState.getAppData();
    const isBonus = (typeof ScheduleEngine !== "undefined" && curDate)
        ? ScheduleEngine.isBonusTaskForDate(task, curDate, appData)
        : Boolean(task?.isBonus);

    if (compact) {
        if (isBonus) {
            return `<button class="btn-action-sm btn-task-off" data-id="${task.id}" title="حذف من هذا اليوم" style="padding:2px 6px; color:#ef4444; font-size:0.75rem;"><i class="fa-solid fa-trash"></i></button>`;
        }
        return `<button class="btn-action-sm" data-edit-id="${task.id}" title="تعديل الورد" style="padding:2px 6px; color:var(--gold-primary); font-size:0.75rem;"><i class="fa-solid fa-pen"></i></button>`;
    }

    if (isBonus) {
        return `<button class="btn-action-sm btn-task-off" data-id="${task.id}" title="حذف من هذا اليوم" style="font-size:0.75rem; padding:4px 8px; opacity:0.8; color:#ef4444;"><i class="fa-solid fa-trash"></i></button>`;
    }

    return `<button class="btn-action-sm btn-task-off" data-id="${task.id}" title="إيقاف لهذا اليوم" style="font-size:0.75rem; padding:4px 8px; opacity:0.6;">⏸</button>`;
}

/**
 * Renders unified interactive controls HTML for prayer, time, or counter tasks
 */
function renderTaskControls(task, val, { compact = false } = {}) {
    const actionBtn = getTaskActionBtn(task, compact);
    const curDate = AppState.getCurrentDate();
    const appData = AppState.getAppData();
    const isBonus = (typeof ScheduleEngine !== "undefined" && curDate)
        ? ScheduleEngine.isBonusTaskForDate(task, curDate, appData)
        : Boolean(task?.isBonus);

    if (isPrayerSelector(task)) {
        const pVals = APP_CONSTANTS.PRAYER_VALUES;
        const pad = compact ? "padding:3px 8px; font-size:0.75rem;" : "";
        const wrapStyle = compact ? "" : "margin-top:14px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.05);";
        return `
            <div class="prayer-toggles" data-id="${task.id}" style="${wrapStyle}">
                <button class="btn-prayer ${val === pVals.CONGREGATION ? 'active-mosque' : ''}" data-prayer-val="${pVals.CONGREGATION}" data-id="${task.id}" style="${pad}" title="صلاة جماعة / مسجد">🕌 جماعة</button>
                <button class="btn-prayer ${val === pVals.ALONE ? 'active-home' : ''}" data-prayer-val="${pVals.ALONE}" data-id="${task.id}" style="${pad}" title="صلاة منفرد">🏠 منفرد</button>
                <button class="btn-prayer ${val === pVals.MISSED ? 'active-none' : ''}" data-prayer-val="${pVals.MISSED}" data-id="${task.id}" style="${pad}" title="لم تُصلَّ بعد">❌ لم أصل</button>
                ${actionBtn}
            </div>
        `;
    }

    if (isTimeTask(task)) {
        const hours = Math.floor(val / 60);
        const minutes = val % 60;

        if (compact) {
            const timeColor = isBonus ? "#f59e0b" : "#10b981";
            const timeBorder = isBonus ? "rgba(245,158,11,0.35)" : "rgba(16,185,129,0.3)";
            const pomoBg = isBonus ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.12)";
            return `
                <div class="task-controls" data-id="${task.id}" style="display:flex; align-items:center; gap:6px;">
                    <div style="display:flex; align-items:center; background:rgba(0,0,0,0.3); border:1px solid ${timeBorder}; border-radius:6px; padding:1px 4px;">
                        <input type="number" class="input-time-hours" data-id="${task.id}" value="${hours}" min="0" max="24" style="width:28px; background:transparent; border:none; color:${timeColor}; font-weight:700; font-size:0.8rem; text-align:center;">
                        <span style="font-size:0.7rem; color:${timeColor};">س</span>
                    </div>
                    <div style="display:flex; align-items:center; background:rgba(0,0,0,0.3); border:1px solid ${timeBorder}; border-radius:6px; padding:1px 4px;">
                        <input type="number" class="input-time-minutes" data-id="${task.id}" value="${minutes}" min="0" max="59" step="5" style="width:28px; background:transparent; border:none; color:${timeColor}; font-weight:700; font-size:0.8rem; text-align:center;">
                        <span style="font-size:0.7rem; color:${timeColor};">د</span>
                    </div>
                    <button class="btn-step btn-pomo-trigger" data-id="${task.id}" data-name="${task.name}" style="padding:2px 6px; font-size:0.75rem; color:${timeColor}; border:1px solid ${timeBorder}; background:${pomoBg};" title="بدء مؤقت التركيز لهذه المهمة"><i class="fa-solid fa-stopwatch"></i></button>
                    <button class="btn-step btn-step-time" data-id="${task.id}" data-time-delta="15" style="padding:2px 6px; font-size:0.75rem;" title="زيادة 15 دقيقة كبونص">+15د</button>
                    <button class="btn-step btn-step-time" data-id="${task.id}" data-time-delta="-15" style="padding:2px 6px; font-size:0.75rem;" title="إنقاص 15 دقيقة">-15د</button>
                    ${actionBtn}
                </div>
            `;
        }

        return `
            <div class="task-controls-area time-controls-area" data-id="${task.id}" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                <div style="display:flex; align-items:center; gap:6px;">
                    <div style="display:flex; align-items:center; background:rgba(0,0,0,0.4); border:1px solid var(--glass-border); border-radius:8px; padding:2px 6px;">
                        <input type="number" class="input-time-hours" data-id="${task.id}" value="${hours}" min="0" max="24" style="width:38px; background:transparent; border:none; color:#fff; font-weight:700; font-size:0.95rem; text-align:center;">
                        <span style="font-size:0.75rem; color:var(--text-secondary);">ساعة</span>
                    </div>
                    <div style="display:flex; align-items:center; background:rgba(0,0,0,0.4); border:1px solid var(--glass-border); border-radius:8px; padding:2px 6px;">
                        <input type="number" class="input-time-minutes" data-id="${task.id}" value="${minutes}" min="0" max="59" step="5" style="width:38px; background:transparent; border:none; color:#fff; font-weight:700; font-size:0.95rem; text-align:center;">
                        <span style="font-size:0.75rem; color:var(--text-secondary);">دقيقة</span>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:4px;">
                    <button class="btn-step btn-pomo-trigger" data-id="${task.id}" data-name="${task.name}" style="font-size:0.8rem; padding:3px 8px; border-radius:6px; color:#10b981; border:1px solid rgba(16,185,129,0.3); background:rgba(16,185,129,0.12);" title="بدء مؤقت التركيز لهذه المهمة"><i class="fa-solid fa-stopwatch"></i></button>
                    <button class="btn-step btn-step-time" data-id="${task.id}" data-time-delta="15" style="font-size:0.8rem; padding:3px 8px; border-radius:6px;" title="زيادة 15 دقيقة">+15د</button>
                    <button class="btn-step btn-step-time" data-id="${task.id}" data-time-delta="-15" style="font-size:0.8rem; padding:3px 8px; border-radius:6px;" title="إنقاص 15 دقيقة">-15د</button>
                    ${actionBtn}
                </div>
            </div>
        `;
    }

    // Default: counter task
    if (compact) {
        return `
            <div class="task-controls" data-id="${task.id}" style="display:flex; align-items:center; gap:6px;">
                <button class="btn-val-minus btn-action-sm" data-id="${task.id}" style="padding:2px 8px; font-size:0.8rem;" title="تراجع / إنقاص">-</button>
                <input type="text" class="input-count" value="${val}" readonly style="width:40px; height:26px; font-size:0.8rem; padding:0;">
                <button class="btn-val-plus btn-action-sm" data-id="${task.id}" style="padding:2px 8px; font-size:0.8rem;" title="زيادة كبونص">+</button>
                ${actionBtn}
            </div>
        `;
    }

    return `
        <div class="task-controls-area" data-id="${task.id}">
            <div class="step-controls">
                <button class="btn-step btn-val-minus" data-id="${task.id}">-</button>
                <input type="text" class="input-count" value="${val}" readonly>
                <button class="btn-step btn-val-plus" data-id="${task.id}">+</button>
            </div>
            <div style="display:flex; gap:6px; align-items:center;">
                ${actionBtn}
            </div>
        </div>
    `;
}

function renderDailyView() {
    const grid = document.getElementById("daily-tasks-grid");
    if (!grid) return;
    grid.innerHTML = "";
    grid.classList.remove("hidden"); // make sure grid is visible

    // Update date header
    const dateTitle = document.getElementById("display-date-title");
    const datePicker = document.getElementById("date-picker-input");
    const hijriPill = document.getElementById("display-hijri-title");
    const hijri = getHijriDateDetails(currentDateStr);
    if (dateTitle) dateTitle.textContent = getArabicDateFormatted(currentDateStr);
    if (datePicker && datePicker.value !== currentDateStr) datePicker.value = currentDateStr;
    if (hijriPill) {
        let tagsHtml = "";
        if (hijri.isRamadan) tagsHtml += ` <span class="badge badge-emerald" style="font-size:0.75rem;">🌙 رمضان</span>`;
        if (hijri.isWhiteDay) tagsHtml += ` <span class="badge badge-gold" style="font-size:0.75rem;">⭐ الأيام البيض</span>`;
        const hijriText = hijri.formatted || "";
        hijriPill.innerHTML = `<i class="fa-solid fa-calendar-alt gold-text"></i> ${hijriText}${tagsHtml}`;
    }

    // Update Tomorrow Fasting Reminder banner (triggered the day before: Sunday for Monday, Wednesday for Thursday, and before each White Day)
    const fastingBanner = document.getElementById("tomorrow-fasting-banner");
    if (fastingBanner) {
        const tomorrowStr = addDays(currentDateStr, 1);
        if (tomorrowStr) {
            const tomorrowDayAbbrev = getDayOfWeekAbbrev(tomorrowStr);
            const tomorrowHijri = getHijriDateDetails(tomorrowStr);

            const isTomorrowMonday = (tomorrowDayAbbrev === "Mon");
            const isTomorrowThursday = (tomorrowDayAbbrev === "Thu");
            const isTomorrowWhiteDay = !!tomorrowHijri.isWhiteDay;

            // In Ramadan, daily fasting is obligatory so voluntary reminders are disabled
            const isFastingTomorrow = !hijri.isRamadan && !tomorrowHijri.isRamadan && (isTomorrowMonday || isTomorrowThursday || isTomorrowWhiteDay);

            if (isFastingTomorrow) {
                fastingBanner.classList.remove("hidden");
                const fTitle = document.getElementById("tomorrow-fasting-title");
                const fDesc = document.getElementById("tomorrow-fasting-desc");
                const fBadge = document.getElementById("tomorrow-fasting-badge");

                let titleText = "تذكير: غداً يوم صيام مستحب 🌿";
                let descText = "يُستحب تبييت نية الصيام الليلة والسحور.";
                let badgeText = "تذكير بالصيام";

                if (isTomorrowMonday && isTomorrowWhiteDay) {
                    titleText = `✨ تذكير: غداً صيام الإثنين ومن الأيام البيض (${tomorrowHijri.hDay} ${tomorrowHijri.monthName})`;
                    descText = `اجتماع فضيلتين: غداً الإثنين ومن الأيام البيض — لا تنسَ تبييت نية الصيام والسحور.`;
                    badgeText = "سُنة مؤكدة";
                } else if (isTomorrowThursday && isTomorrowWhiteDay) {
                    titleText = `✨ تذكير: غداً صيام الخميس ومن الأيام البيض (${tomorrowHijri.hDay} ${tomorrowHijri.monthName})`;
                    descText = `اجتماع فضيلتين: غداً الخميس ومن الأيام البيض — لا تنسَ تبييت نية الصيام والسحور.`;
                    badgeText = "سُنة مؤكدة";
                } else if (isTomorrowMonday) {
                    titleText = "🌿 تذكير: غداً صيام الإثنين";
                    descText = `سُنّة مؤكدة: تُعرَض الأعمال يوم الإثنين — لا تنسَ تبييت نية الصيام والسحور.`;
                    badgeText = "سُنة الإثنين";
                } else if (isTomorrowThursday) {
                    titleText = "🌿 تذكير: غداً صيام الخميس";
                    descText = `سُنّة مؤكدة: تُعرَض الأعمال يوم الخميس — لا تنسَ تبييت نية الصيام والسحور.`;
                    badgeText = "سُنة الخميس";
                } else if (isTomorrowWhiteDay) {
                    const whiteDayIndex = (tomorrowHijri.hDay === 13) ? "أول" : ((tomorrowHijri.hDay === 14) ? "ثاني" : "ثالث");
                    titleText = `🌕 تذكير: غداً صيام ${whiteDayIndex} الأيام البيض (${tomorrowHijri.hDay} ${tomorrowHijri.monthName})`;
                    descText = `سُنّة صيام الأيام البيض (13 و 14 و 15) — لا تنسَ تبييت نية الصيام والسحور.`;
                    badgeText = "الأيام البيض";
                }

                if (fTitle) fTitle.textContent = titleText;
                if (fDesc) fDesc.textContent = descText;
                if (fBadge) fBadge.textContent = badgeText;
            } else {
                fastingBanner.classList.add("hidden");
            }
        } else {
            fastingBanner.classList.add("hidden");
        }
    }

    const log = appData.logs[currentDateStr] || { taskProgress: {} };
    const allScheduled = appData.tasks.filter(t => ScheduleEngine.isVisibleOn(t, currentDateStr, appData));

    // Group all active tasks (pending & completed) by Category
    const isTaskDisabled = (t) => {
        return log?.taskProgress?.[t.id]?.status === "disabled";
    };

    const disabledTasks = allScheduled.filter(isTaskDisabled);
    const activeTasks = allScheduled.filter(t => !isTaskDisabled(t));
    const activeItems = activeTasks.map(t => {
        const val = getTaskVal(t.id);
        const normTarget = getTaskNormalizedTarget(t, currentDateStr);
        const isDone = isTaskCompleted(t, val, currentDateStr);
        return { task: t, val, target: normTarget, isDone };
    });
    const categoryGroupMap = groupTasksByCategory(activeItems);

    if (activeTasks.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; width: 100%; text-align: center; padding: 30px 20px;">
                <i class="fa-solid fa-calendar-check icon-lg gold-text" style="font-size: 2.5rem; color: var(--gold-primary); margin-bottom: 12px;"></i>
                <h3>${disabledTasks.length > 0 ? 'جميع مهمات هذا اليوم موقوفة' : 'لا توجد أوراد مجدولة لهذا اليوم'}</h3>
                <p>${disabledTasks.length > 0 ? 'يمكنك إعادة تفعيل أي مهمة من القائمة أدناه أو تفعيلها جميعاً دفعة واحدة.' : 'يمكنك إضافة ورد جديد أو اختيار يوم آخر.'}</p>
                ${disabledTasks.length > 0 ? `
                    <button class="btn-action-primary" id="btn-reenable-all-today" style="margin-top:16px; padding:10px 24px; font-size:0.95rem; border-radius:8px; cursor:pointer; background:var(--gold-primary); color:#000; font-weight:700; border:none; box-shadow: 0 4px 12px rgba(245,158,11,0.3);">
                        <i class="fa-solid fa-play"></i> إعادة تفعيل جميع مهمات اليوم (${disabledTasks.length})
                    </button>
                ` : ''}
            </div>
        `;

        if (disabledTasks.length > 0) {
            renderDisabledSection(grid, disabledTasks);
        }

        attachTaskControlListeners(grid);
        updateDailyScoreSummary();
        updateHeaderTodayScore();
        return;
    }

    categoryGroupMap.forEach(cat => {
        if (!cat.tasks || cat.tasks.length === 0) return;

        const rawIcon = cat.icon || "fa-folder";
        const iconClass = rawIcon.startsWith("fa-") ? rawIcon : `fa-${rawIcon}`;
        
        const pendingInCat = cat.tasks.filter(item => !item.isDone);
        const completedInCat = cat.tasks.filter(item => item.isDone);

        const catCard = document.createElement("div");
        catCard.className = "category-card glass-card daily-cat-card";

        const catHeader = document.createElement("div");
        catHeader.className = "category-card-header daily-cat-header";
        catHeader.innerHTML = `
            <div class="flex-center gap-md">
                <div class="stat-icon gold-icon">
                    <i class="fa-solid ${iconClass}"></i>
                </div>
                <div>
                    <h3 class="text-primary font-bold">${cat.label || cat.name}</h3>
                </div>
            </div>
            <div class="flex-center gap-md">
                <span class="badge" style="font-size:0.75rem; background:${completedInCat.length === cat.tasks.length ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.08)'}; color:${completedInCat.length === cat.tasks.length ? '#10b981' : 'var(--text-secondary)'}; border:1px solid ${completedInCat.length === cat.tasks.length ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)'}; padding:4px 10px; border-radius:12px;">
                    ${completedInCat.length}/${cat.tasks.length} مكتمل
                </span>
                <i class="fa-solid fa-chevron-down toggle-chevron" style="color:var(--text-secondary); transition:transform 0.3s ease; transform: rotate(-90deg);"></i>
            </div>
        `;

        if (!window.expandedCategoryNames) window.expandedCategoryNames = new Set();
        const catName = cat.label || cat.name;
        const isExpanded = window.expandedCategoryNames.has(catName);

        const tasksBody = document.createElement("div");
        tasksBody.className = `category-tasks-body daily-cat-body${isExpanded ? "" : " hidden"}`;

        const chevronTransform = isExpanded ? "rotate(0deg)" : "rotate(-90deg)";
        catHeader.querySelector(".toggle-chevron").style.transform = chevronTransform;

        catHeader.addEventListener("click", () => {
            const isHidden = tasksBody.classList.contains("hidden");
            if (isHidden) {
                tasksBody.classList.remove("hidden");
                window.expandedCategoryNames.add(catName);
            } else {
                tasksBody.classList.add("hidden");
                window.expandedCategoryNames.delete(catName);
            }
            const chevron = catHeader.querySelector(".toggle-chevron");
            if (chevron) chevron.style.transform = isHidden ? "rotate(0deg)" : "rotate(-90deg)";
        });

        // 1) Render Pending Tasks as full .task-card elements inside pendingGrid
        if (pendingInCat.length > 0) {
            const pendingGrid = document.createElement("div");
            pendingGrid.className = "pending-tasks-grid daily-tasks-grid";
            
            pendingInCat.forEach(({ task, val, target }) => {
                const card = document.createElement("div");
                const tp = log?.taskProgress?.[task.id];
                const isBonus = (tp && typeof tp === "object" && tp.status !== undefined)
                    ? tp.status === "bonus"
                    : (typeof ScheduleEngine !== "undefined"
                        ? ScheduleEngine.isBonusTaskForDate(task, currentDateStr, appData, val)
                        : Boolean(task.isBonus));
                const progressPct = target > 0 ? Math.round((val / target) * 100) : (val > 0 ? 100 : 0);
                
                card.className = `task-card glass-card ${isBonus ? 'is-bonus-card' : ''}`;
                card.setAttribute("data-task-id", task.id);
                
                const iconHtml = getCategoryIconHtml(task);
                const bonusBadge = isBonus ? `<span class="tag-badge" style="font-size:0.7rem; background:rgba(245,158,11,0.2); color:#f59e0b; border:1px solid rgba(245,158,11,0.4);">بونص</span>` : "";
                const isFastingTask = task.category === "صوم" || (task.schedule || "").includes("WhiteDays") || (task.name && (task.name.includes("صيام") || task.name.includes("صوم")));
                const curDayAbbrev = getDayOfWeekAbbrev(currentDateStr);
                const curHijri = getHijriDateDetails(currentDateStr);
                const isCoincidence = isFastingTask && (task.schedule || "").includes("WhiteDays") && (curDayAbbrev === "Mon" || curDayAbbrev === "Thu") && curHijri.isWhiteDay && !curHijri.isRamadan;
                const coincidenceBadge = isCoincidence ? `<span class="tag-badge" style="font-size:0.7rem; background:rgba(16,185,129,0.2); color:#10b981; border:1px solid rgba(16,185,129,0.4); margin-right:4px;">اجتماع فضيلتين: ${curDayAbbrev === "Mon" ? "الإثنين" : "الخميس"} والبيض</span>` : "";
                const rawTarget = typeof getTaskDayTarget === "function" ? getTaskDayTarget(task, currentDateStr) : (task.target || 0);
                const unit = getTaskUnit(task);
                const targetDisplay = rawTarget > 0 ? `(${rawTarget} ${unit})` : '';
                const controlsHtml = renderTaskControls(task, val, { compact: false });

                card.innerHTML = `
                    <div class="task-header">
                        <div class="task-title-group cursor-pointer" data-edit-id="${task.id}" title="انقر لتعديل الورد">
                            <div class="task-icon">${iconHtml}</div>
                            <div>
                                <h4>${task.name} ${bonusBadge}${coincidenceBadge}</h4>
                                <span class="task-unit-label">${task.category}${task.subcategory ? ' - ' + task.subcategory : ''} ${targetDisplay}</span>
                            </div>
                        </div>
                    </div>

                    <div class="task-progress-bar-bg">
                        <div class="task-progress-bar-fill" style="width: ${Math.min(100, progressPct)}%"></div>
                    </div>

                    ${controlsHtml}
                `;

                pendingGrid.appendChild(card);
            });

            tasksBody.appendChild(pendingGrid);
        }

        // 2) Render Completed Tasks as minimal cards INSIDE THIS CATEGORY
        if (completedInCat.length > 0) {
            const completedSection = document.createElement("div");
            completedSection.className = "completed-tasks-in-cat daily-completed-section";
            
            const labelText = document.createElement("p");
            labelText.className = "daily-completed-label";
            labelText.innerHTML = `<i class="fa-solid fa-circle-check"></i> مكتملة (${completedInCat.length})`;
            completedSection.appendChild(labelText);

            completedInCat.forEach(({ task, val, target }) => {
                const pill = document.createElement("div");
                const tp = log?.taskProgress?.[task.id];
                const isBonus = (tp && typeof tp === "object" && tp.status !== undefined)
                    ? tp.status === "bonus"
                    : (typeof ScheduleEngine !== "undefined"
                        ? ScheduleEngine.isBonusTaskForDate(task, currentDateStr, appData, val)
                        : Boolean(task.isBonus));

                pill.className = `task-item-minimal glass-card daily-completed-pill ${isBonus ? 'is-bonus is-bonus-card' : ''}`;
                pill.setAttribute("data-task-id", task.id);
                
                const iconHtml = getCategoryIconHtml(task);
                const overTarget = !isBonus && target > 0 && val > target;
                const rawTarget = typeof getTaskDayTarget === "function" ? getTaskDayTarget(task, currentDateStr) : (task.target || 0);
                const isTime = isTimeTask(task);
                const isPrayer = isPrayerSelector(task);
                const unitLabel = isTime ? "دقيقة" : getTaskUnit(task);
                let targetStr;
                if (isPrayer) {
                    targetStr = val === APP_CONSTANTS.PRAYER_VALUES.CONGREGATION ? "جماعة (100%)" : "منفرد (50%)";
                } else {
                    targetStr = (!isBonus && target > 0) ? `${val}/${target} ${unitLabel}` : `${val} ${unitLabel}`.trim();
                }
                const progressPct = target > 0 ? Math.round((val / target) * 100) : (val > 0 ? 100 : 0);
                const barColor = (isBonus || overTarget) ? "#f59e0b" : "#10b981";
                const minControlsHtml = renderTaskControls(task, val, { compact: true });
                const isFastingTask = task.category === "صوم" || (task.schedule || "").includes("WhiteDays") || (task.name && (task.name.includes("صيام") || task.name.includes("صوم")));
                const curDayAbbrev = getDayOfWeekAbbrev(currentDateStr);
                const curHijri = getHijriDateDetails(currentDateStr);
                const isCoincidence = isFastingTask && (task.schedule || "").includes("WhiteDays") && (curDayAbbrev === "Mon" || curDayAbbrev === "Thu") && curHijri.isWhiteDay && !curHijri.isRamadan;
                const coincidenceBadge = isCoincidence ? `<span class="tag-badge" style="font-size:0.7rem; background:rgba(16,185,129,0.2); color:#10b981; border:1px solid rgba(16,185,129,0.4); margin-right:4px;">اجتماع فضيلتين</span>` : "";
                const bonusBadge = isBonus ? `<span class="tag-badge" style="font-size:0.7rem; background:rgba(245,158,11,0.2); color:#f59e0b; border:1px solid rgba(245,158,11,0.4); margin-right:4px;">بونص</span>` : "";

                pill.innerHTML = `
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
                        <div style="display:flex; align-items:center; gap:8px; cursor:pointer;" data-edit-id="${task.id}" title="انقر لتعديل الورد">
                            <span style="color:${isBonus ? '#f59e0b' : '#10b981'};">${iconHtml}</span>
                            <strong style="color:#fff; font-size:0.9rem;">${task.name}</strong> ${bonusBadge}${coincidenceBadge}
                            <span class="task-target-str" style="font-size:0.8rem; color:${isBonus ? '#f59e0b' : '#10b981'}; font-weight:700;">— ${targetStr}</span>
                            <span class="over-target-badge-container">${overTarget ? '<span style="font-size:0.75rem; color:#f59e0b; background:rgba(245,158,11,0.15); padding:2px 6px; border-radius:8px;">⭐ تجاوز الهدف</span>' : ''}</span>
                        </div>
                        ${minControlsHtml}
                    </div>
                    <div class="task-progress-bar-bg" style="height:4px; margin-top:4px; background:rgba(255,255,255,0.06); border-radius:4px; overflow:hidden;">
                        <div class="task-progress-bar-fill" style="width:${Math.min(100, progressPct)}%; height:100%; background:${barColor}; border-radius:4px; transition:width 0.3s ease;"></div>
                    </div>
                `;
                completedSection.appendChild(pill);
            });

            tasksBody.appendChild(completedSection);
        }

        catCard.appendChild(catHeader);
        catCard.appendChild(tasksBody);
        grid.appendChild(catCard);
    });

    renderDisabledSection(grid, disabledTasks);

    attachTaskControlListeners(grid);
    updateDailyScoreSummary();
    updateHeaderTodayScore();
}

function renderDisabledSection(grid, disabledTasks) {
    if (!disabledTasks || disabledTasks.length === 0) return;
    const sortedDisabled = [...disabledTasks].sort((a, b) => {
        if (a.category === "صلاة" && b.category === "صلاة") {
            return (typeof getPrayerSortIndex === "function" ? getPrayerSortIndex(a) : 0) - (typeof getPrayerSortIndex === "function" ? getPrayerSortIndex(b) : 0);
        }
        return 0;
    });

    const disabledSection = document.createElement("div");
    disabledSection.className = "disabled-tasks-section";
    disabledSection.className = "disabled-tasks-section daily-disabled-section";
    disabledSection.innerHTML = `<p style="font-size:0.85rem; color:#94a3b8; margin: 12px 0 10px; padding-right:4px; font-weight:600;"><i class="fa-solid fa-pause-circle"></i> مهمات موقوفة لهذا اليوم (${disabledTasks.length}):</p>`;

    const disabledGrid = document.createElement("div");
    disabledGrid.className = "disabled-tasks-grid daily-disabled-grid";

    sortedDisabled.forEach(task => {
        const pill = document.createElement("div");
        pill.className = "task-item-minimal glass-card";
        pill.className = "task-item-minimal daily-disabled-pill";
        const iconHtml = getCategoryIconHtml(task);
        pill.innerHTML = `
            <span style="opacity:0.85; font-size:0.9rem; color:#cbd5e1;">${iconHtml} ${task.name}</span>
            <button class="btn-action-sm" data-reenable-id="${task.id}" style="font-size:0.8rem; padding:4px 12px; background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3); border-radius:6px; cursor:pointer;">
                <i class="fa-solid fa-play"></i> إعادة تفعيل
            </button>
        `;
        disabledGrid.appendChild(pill);
    });
    disabledSection.appendChild(disabledGrid);
    grid.appendChild(disabledSection);
}

function attachTaskControlListeners(grid) {
    if (!grid) return;

    // 1. Regular minus button
    grid.querySelectorAll(".btn-val-minus").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const taskId = btn.getAttribute("data-id") || (btn.closest("[data-id]") && btn.closest("[data-id]").getAttribute("data-id"));
            if (taskId) adjustTaskVal(taskId, -1);
        });
    });

    // 2. Regular plus button
    grid.querySelectorAll(".btn-val-plus").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const taskId = btn.getAttribute("data-id") || (btn.closest("[data-id]") && btn.closest("[data-id]").getAttribute("data-id"));
            if (taskId) adjustTaskVal(taskId, 1);
        });
    });

    // 3. Time step buttons (-15d, +15d, +30d)
    grid.querySelectorAll(".btn-step-time").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const taskId = btn.getAttribute("data-id") || (btn.closest("[data-id]") && btn.closest("[data-id]").getAttribute("data-id"));
            const delta = parseInt(btn.getAttribute("data-time-delta"), 10) || 0;
            if (taskId && delta !== 0) adjustTaskVal(taskId, delta);
        });
    });

    // 4. Prayer selector buttons (Mosque, Home, Not Prayed)
    grid.querySelectorAll(".btn-prayer").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const taskId = btn.getAttribute("data-id");
            const valStr = btn.getAttribute("data-prayer-val");
            if (taskId && valStr !== null) {
                const targetVal = parseFloat(valStr);
                const curVal = getTaskVal(taskId);
                setTaskVal(taskId, targetVal);
                if (targetVal > 0 && curVal === targetVal && isObligatoryPrayerTask(taskId)) {
                    checkAndShowNawafelPrompt(taskId);
                }
            }
        });
    });

    // Helper for live time input updates
    const handleTimeInputChange = (input, isInputEvent) => {
        const taskId = input.getAttribute("data-id");
        if (!taskId) return;
        const card = input.closest(".task-card, .task-item-minimal");
        const hoursEl = card ? card.querySelector(".input-time-hours") : null;
        const minutesEl = card ? card.querySelector(".input-time-minutes") : null;
        const h = Math.max(0, parseInt(hoursEl ? hoursEl.value : input.value, 10) || 0);
        const m = Math.max(0, Math.min(59, parseInt(minutesEl ? minutesEl.value : input.value, 10) || 0));
        const newTotal = (h * 60) + m;

        const log = typeof ensureDayRecord === "function"
            ? ensureDayRecord(currentDateStr)
            : (appData.logs[currentDateStr] || (appData.logs[currentDateStr] = { taskProgress: {} }));
        if (!log._dirtyTasks) log._dirtyTasks = {};
        log._dirtyTasks[taskId] = Date.now();
        log._dirty = true;
        ScoringEngine.invalidateScoreCache(currentDateStr, appData);

        const task = (appData.tasks || []).find(t => t.id === taskId);
        const existingProgress = log.taskProgress[taskId];
        const prevTotal = Number(existingProgress?.achieved) || 0;
        const normTarget = task ? getTaskNormalizedTarget(task, currentDateStr) : 0;
        const status = existingProgress?.status || (task && ScheduleEngine.isTaskScheduledForDate(task, currentDateStr, appData, newTotal) ? "scheduled" : (newTotal > 0 ? "bonus" : "scheduled"));

        const { hours: _h, score: _s, ...cleanExisting } = existingProgress || {};
        appData.logs[currentDateStr].taskProgress[taskId] = {
            ...cleanExisting,
            target: normTarget,
            achieved: newTotal,
            status
        };

        saveData();

        // Update card progress bar in real time without destroying input focus
        if (card && task) {
            const target = getTaskNormalizedTarget(task, currentDateStr);
            const progressPct = target > 0 ? Math.round((newTotal / target) * 100) : (newTotal > 0 ? 100 : 0);
            const progressBar = card.querySelector(".task-progress-bar-fill");
            if (progressBar) {
                progressBar.style.width = `${Math.min(100, progressPct)}%`;
            }
        }
        updateDailyScoreSummary();
        updateHeaderTodayScore();

        if (!isInputEvent) {
            const wasDone = task ? isTaskCompleted(task, prevTotal, currentDateStr) : false;
            const nowDone = task ? isTaskCompleted(task, newTotal, currentDateStr) : false;
            if (wasDone !== nowDone) {
                renderDailyView();
            } else if (task) {
                updateTaskCardInPlace(taskId, newTotal, task);
            }
        }
    };

    // 5. Time Hours Input box
    grid.querySelectorAll(".input-time-hours").forEach(input => {
        input.addEventListener("input", () => handleTimeInputChange(input, true));
        input.addEventListener("change", () => handleTimeInputChange(input, false));
    });

    // 6. Time Minutes Input box
    grid.querySelectorAll(".input-time-minutes").forEach(input => {
        input.addEventListener("input", () => handleTimeInputChange(input, true));
        input.addEventListener("change", () => handleTimeInputChange(input, false));
    });

    // 7. Pause/disable task
    grid.querySelectorAll(".btn-task-off").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const taskId = btn.getAttribute("data-id");
            toggleDeactivateTaskForDate(taskId, currentDateStr);
        });
    });

    // 8. Re-enable task
    grid.querySelectorAll("[data-reenable-id]").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const taskId = btn.getAttribute("data-reenable-id");
            toggleDeactivateTaskForDate(taskId, currentDateStr);
        });
    });

    // 8b. Re-enable ALL tasks for today
    grid.querySelectorAll("#btn-reenable-all-today").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const log = appData.logs?.[currentDateStr];
            if (log?.taskProgress) {
                for (const [id, tp] of Object.entries(log.taskProgress)) {
                    if (tp?.status === "disabled") {
                        const t = (appData.tasks || []).find(x => x.id === id);
                        const val = Number(tp.achieved) || 0;
                        const normTarget = t ? getTaskNormalizedTarget(t, null) : 1;
                        const { hours: _h, score: _s, ...cleanTp } = tp || {};
                        log.taskProgress[id] = {
                            ...cleanTp,
                            target: normTarget,
                            achieved: val,
                            status: "scheduled"
                        };
                        if (!log._dirtyTasks) log._dirtyTasks = {};
                        log._dirtyTasks[id] = Date.now();
                    }
                }
                log._dirty = true;
                ScoringEngine.invalidateScoreCache(currentDateStr, appData);
                saveData(true);
                renderDailyView();
            }
        });
    });

    // 9. Direct Pomodoro trigger
    grid.querySelectorAll(".btn-pomo-trigger").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const taskId = btn.getAttribute("data-id");
            const taskName = btn.getAttribute("data-name") || "";
            openPomodoroModal(taskId, taskName);
        });
    });

    // 10. Task editor modal on click
    grid.querySelectorAll("[data-edit-id]").forEach(el => {
        el.addEventListener("click", (e) => {
            if (e.target.closest(".btn-task-off") || e.target.closest(".btn-step") || e.target.closest(".btn-prayer") || e.target.closest("input")) return;
            const taskId = el.getAttribute("data-edit-id");
            openTaskModal(taskId);
        });
    });
}

function toggleDeactivateTaskForDate(taskId, dateStr) {
    const log = typeof ensureDayRecord === "function"
        ? ensureDayRecord(dateStr)
        : (appData.logs[dateStr] || (appData.logs[dateStr] = { taskProgress: {} }));
    if (!log.taskProgress) log.taskProgress = {};
    const task = (appData.tasks || []).find(t => t.id === taskId);
    const tp = log.taskProgress[taskId];
    const isBonus = (tp && typeof tp === "object" && tp.status !== undefined)
        ? tp.status === "bonus"
        : (task ? ScheduleEngine.isBonusTaskForDate(task, dateStr, appData) : false);

    if (isBonus) {
        // Bonus tasks do not belong to this day's recurring schedule.
        // Removing / deactivating a bonus task completely removes it from this day's log and progress.
        if (log.taskProgress[taskId] !== undefined) {
            delete log.taskProgress[taskId];
        }
        if (log._dirtyTasks && log._dirtyTasks[taskId] !== undefined) {
            delete log._dirtyTasks[taskId];
        }
        log._dirty = true;
        ScoringEngine.invalidateScoreCache(dateStr, appData);
        saveData();
        renderDailyView();
        updateDailyScoreSummary();
        updateHeaderTodayScore();
        return;
    }

    const val = Number(tp?.achieved) || 0;
    const normTarget = task ? getTaskNormalizedTarget(task, null) : 1;
    const isCurrentlyDisabled = tp?.status === "disabled";

    const { hours: _h, score: _s, ...cleanTp } = tp || {};
    if (isCurrentlyDisabled) {
        // Re-enabling
        log.taskProgress[taskId] = {
            ...cleanTp,
            target: normTarget,
            achieved: val,
            status: "scheduled"
        };
    } else {
        // Pausing / Disabling
        log.taskProgress[taskId] = {
            ...cleanTp,
            target: 0,
            achieved: val,
            status: "disabled"
        };
    }

    if (!log._dirtyTasks) log._dirtyTasks = {};
    log._dirtyTasks[taskId] = Date.now();
    log._dirty = true;
    ScoringEngine.invalidateScoreCache(dateStr, appData);
    saveData();
    renderDailyView();
    updateDailyScoreSummary();
    updateHeaderTodayScore();
}

function getTaskVal(taskId) {
    const log = appData.logs?.[currentDateStr];
    return Number(log?.taskProgress?.[taskId]?.achieved) || 0;
}

function adjustTaskVal(taskId, delta) {
    const current = getTaskVal(taskId);
    setTaskVal(taskId, Math.max(0, current + delta));
}

function isQiyamTask(taskId) {
    const t = (appData.tasks || []).find(x => x.id === taskId);
    if (!t) return false;
    return (t.subcategory === "قيام ليل" || t.name.includes("قيام") || t.name.includes("تهجد"));
}

function updateTaskCardInPlace(taskId, val, task = null) {
    if (!task) {
        task = (appData && appData.tasks) ? appData.tasks.find(t => t.id === taskId) : null;
    }
    if (!task) return false;

    let card = document.querySelector(`.task-card[data-task-id="${taskId}"], .task-item-minimal[data-task-id="${taskId}"]`);
    if (!card) {
        const child = document.querySelector(`[data-id="${taskId}"]`);
        if (child) card = child.closest(".task-card, .task-item-minimal");
    }
    if (!card) return false;

    const curDate = currentDateStr;
    const target = getTaskNormalizedTarget(task, curDate);
    const progressPct = target > 0 ? Math.round((val / target) * 100) : (val > 0 ? 100 : 0);
    const log = (appData && appData.logs) ? appData.logs[curDate] : null;
    const tp = log?.taskProgress?.[taskId];
    const isBonus = card.classList.contains("is-bonus-card")
        || (tp && typeof tp === "object" && tp.status !== undefined ? tp.status === "bonus" : (typeof ScheduleEngine !== "undefined" ? ScheduleEngine.isBonusTaskForDate(task, curDate, appData, val) : Boolean(task.isBonus)));
    const overTarget = !isBonus && target > 0 && val > target;
    const barColor = (isBonus || overTarget) ? "#f59e0b" : "#10b981";

    // 1. Update progress bar fill
    const progressBar = card.querySelector(".task-progress-bar-fill");
    if (progressBar) {
        progressBar.style.width = `${Math.min(100, progressPct)}%`;
        if (card.classList.contains("task-item-minimal")) {
            progressBar.style.background = barColor;
        }
    }

    // 2. Update counter input
    const inputCount = card.querySelector(".input-count");
    if (inputCount) {
        inputCount.value = val;
    }

    // 3. Update time inputs if present
    const hoursInput = card.querySelector(".input-time-hours");
    const minsInput = card.querySelector(".input-time-minutes");
    if (hoursInput) hoursInput.value = Math.floor(val / 60);
    if (minsInput) minsInput.value = val % 60;

    // 4. Update prayer toggle buttons
    const prayerBtns = card.querySelectorAll(".btn-prayer");
    if (prayerBtns.length > 0) {
        prayerBtns.forEach(btn => {
            const btnVal = parseFloat(btn.getAttribute("data-prayer-val"));
            btn.classList.remove("active-mosque", "active-home", "active-none");
            if (btnVal === 1 && val === 1) btn.classList.add("active-mosque");
            else if (btnVal === 0.5 && val === 0.5) btn.classList.add("active-home");
            else if (btnVal === 0 && val === 0) btn.classList.add("active-none");
        });
    }

    // 5. Update completed minimal card labels if present
    const targetStrEl = card.querySelector(".task-target-str");
    if (targetStrEl) {
        const rawTarget = typeof getTaskDayTarget === "function" ? getTaskDayTarget(task, curDate) : (task.target || 0);
        const isTime = isTimeTask(task);
        const isPrayer = isPrayerSelector(task);
        const unitLabel = isTime ? "دقيقة" : getTaskUnit(task);
        let targetStr;
        if (isPrayer) {
            targetStr = val === APP_CONSTANTS.PRAYER_VALUES.CONGREGATION ? "جماعة (100%)" : "منفرد (50%)";
        } else {
            targetStr = (!isBonus && target > 0) ? `${val}/${target} ${unitLabel}` : `${val} ${unitLabel}`.trim();
        }
        targetStrEl.textContent = `— ${targetStr}`;
    }

    const overTargetEl = card.querySelector(".over-target-badge-container");
    if (overTargetEl) {
        overTargetEl.innerHTML = overTarget ? '<span style="font-size:0.75rem; color:#f59e0b; background:rgba(245,158,11,0.15); padding:2px 6px; border-radius:8px;">⭐ تجاوز الهدف</span>' : '';
    }

    // 6. Update summary scores in real time
    updateDailyScoreSummary();
    updateHeaderTodayScore();

    return true;
}

function setTaskVal(taskId, val) {
    const log = typeof ensureDayRecord === "function"
        ? ensureDayRecord(currentDateStr)
        : (appData.logs[currentDateStr] || (appData.logs[currentDateStr] = { taskProgress: {} }));
    if (!log._dirtyTasks) {
        log._dirtyTasks = {};
    }
    log._dirtyTasks[taskId] = Date.now();
    log._dirty = true;
    ScoringEngine.invalidateScoreCache(currentDateStr, appData);

    const task = (appData.tasks || []).find(t => t.id === taskId);
    const existingProgress = log.taskProgress[taskId];
    const prevVal = Number(existingProgress?.achieved) || 0;
    const normTarget = task ? getTaskNormalizedTarget(task, currentDateStr) : 0;
    const status = existingProgress?.status || (task && ScheduleEngine.isTaskScheduledForDate(task, currentDateStr, appData, val) ? "scheduled" : (val > 0 ? "bonus" : "scheduled"));

    const { hours: _h, score: _s, ...cleanExisting } = existingProgress || {};
    log.taskProgress[taskId] = {
        ...cleanExisting,
        target: normTarget,
        achieved: val,
        status
    };

    saveData();

    const wasDone = task ? isTaskCompleted(task, prevVal, currentDateStr) : false;
    const nowDone = task ? isTaskCompleted(task, val, currentDateStr) : false;

    // Fast path: In-place DOM update when task completion status has not flipped
    if (task && wasDone === nowDone && updateTaskCardInPlace(taskId, val, task)) {
        // Updated in place without full grid re-render!
    } else {
        renderDailyView();
    }

    if (isObligatoryPrayerTask(taskId) && val > 0 && val !== prevVal) {
        checkAndShowNawafelPrompt(taskId);
    } else if (prevVal === 0 && val > 0 && isQiyamTask(taskId)) {
        checkAndShowQiyamPrompt();
    } else if (val === 0 && isObligatoryPrayerTask(taskId)) {
        removePrayerExtras(taskId);
    }
}

if (typeof window !== "undefined") {
    window.renderDailyView = renderDailyView;
    window.renderTaskControls = renderTaskControls;
    window.getTaskVal = getTaskVal;
    window.setTaskVal = setTaskVal;
    window.adjustTaskVal = adjustTaskVal;
    window.isQiyamTask = isQiyamTask;
    window.updateTaskCardInPlace = updateTaskCardInPlace;
    window.toggleDeactivateTaskForDate = toggleDeactivateTaskForDate;
}

export {
    renderDailyView,
    renderTaskControls,
    getTaskVal,
    setTaskVal,
    adjustTaskVal,
    isQiyamTask,
    updateTaskCardInPlace,
    toggleDeactivateTaskForDate
};
