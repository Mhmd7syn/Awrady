/**
 * ============================================================================
 * AWRAD PRO - TASK MANAGER COMPONENT
 * Manages Task CRUD operations, modals, grouping, bonus tasks, and archiving.
 * ============================================================================
 */

import { APP_CONSTANTS } from '../config/constants.js';
import { groupTasksByCategory, getTaskUnit, isTimeTask, isPrayerSelector, isUnscheduledTask } from '../core/task-rules.js';
import { getCategoryIconHtml } from './category-manager.js';
import { ScoringEngine } from '../core/scoring-engine.js';
import { AppState } from '../core/state.js';
import { saveData } from '../core/store.js';
import { awradyAPI } from '../api.js';
import { renderCategoriesManager } from './category-manager.js';
import { renderDailyView } from './daily-view.js';
import { showWeeklyHoursModal } from './weekly-modal.js';
import { openTaskModal, closeTaskModal, saveTaskFromModal, updateTaskModalScheduleUI } from './task-modal.js';

function setupTaskManager() {
    const subTabs = document.querySelectorAll(".sub-tab");
    const btnAddTask = document.getElementById("btn-open-add-task-modal");

    subTabs.forEach(btn => {
        btn.addEventListener("click", () => {
            subTabs.forEach(t => t.classList.remove("active"));
            btn.classList.add("active");
            const sec = btn.getAttribute("data-sub");
            document.querySelectorAll(".sub-tab-content").forEach(c => c.classList.remove("active"));
            
            if (sec === "scheduled-tasks") {
                document.getElementById("manager-scheduled-section")?.classList.add("active");
                if (btnAddTask) btnAddTask.style.display = "flex";
            } else if (sec === "unscheduled-tasks") {
                document.getElementById("manager-unscheduled-section")?.classList.add("active");
                if (btnAddTask) btnAddTask.style.display = "flex";
            } else if (sec === "categories") {
                document.getElementById("manager-categories-section")?.classList.add("active");
                if (btnAddTask) btnAddTask.style.display = "none";
                renderCategoriesManager();
            }
        });
    });

    // Weekly schedule sheet modal from manager toolbar
    const btnWeeklySheet = document.getElementById("btn-manager-weekly-schedule");
    if (btnWeeklySheet) {
        btnWeeklySheet.addEventListener("click", () => {
            if (typeof showWeeklyHoursModal === "function") {
                showWeeklyHoursModal();
            }
        });
    }

    // Add task modal
    const openAddBtn = document.getElementById("btn-open-add-task-modal");
    if (openAddBtn) {
        openAddBtn.addEventListener("click", () => {
            const activeSub = document.querySelector(".sub-tab.active")?.getAttribute("data-sub");
            if (activeSub === "unscheduled-tasks") {
                openTaskModal(null, { isUnscheduled: true });
            } else {
                openTaskModal(null);
            }
        });
    }
    
    const closeBtn = document.getElementById("btn-close-modal");
    if (closeBtn) closeBtn.addEventListener("click", closeTaskModal);
    
    const cancelBtn = document.getElementById("btn-cancel-modal");
    if (cancelBtn) cancelBtn.addEventListener("click", closeTaskModal);
    
    document.querySelectorAll('input[name="schedule_type"]').forEach(radio => {
        radio.addEventListener("change", (e) => {
            if (typeof updateTaskModalScheduleUI === "function") {
                updateTaskModalScheduleUI(e.target.value);
            }
        });
    });

    const taskForm = document.getElementById("form-task-editor");
    if (taskForm) {
        taskForm.addEventListener("submit", (e) => {
            e.preventDefault();
            saveTaskFromModal();
        });
    }
}

function renderGroupedTasks(containerEl, tasksList, isUnscheduledList = false) {
    containerEl.innerHTML = "";
    if (!tasksList || tasksList.length === 0) {
        if (isUnscheduledList) {
            containerEl.innerHTML = `<div class="empty-state"><i class="fa-solid fa-clock-rotate-left icon-lg gold-text"></i><h3>لا توجد أوراد غير مجدولة</h3><p>الأوراد غير المجدولة متاحة دائماً للإضافة اليومية السريعة كـ بونص دون أن تؤثر على تقييم التزامك اليومي.</p></div>`;
        } else {
            containerEl.innerHTML = `<div class="empty-state"><h3>لا توجد أوراد مجدولة حالياً</h3></div>`;
        }
        return 0;
    }

    const catMap = groupTasksByCategory(tasksList);
    let totalTaskCount = 0;

    catMap.forEach(catGroupData => {
        const catTasks = catGroupData.tasks;
        if (catTasks.length === 0) return;

        totalTaskCount += catTasks.length;

        const catCard = document.createElement("div");
        catCard.className = "manager-cat-group";

        const catHeader = document.createElement("div");
        catHeader.className = "manager-cat-header";
        const rawIcon = catGroupData.icon || "fa-folder";
        const iconClass = rawIcon.startsWith("fa-") ? rawIcon : `fa-${rawIcon}`;
        catHeader.innerHTML = `
            <div class="manager-cat-header-title">
                <i class="fa-solid ${iconClass}"></i>
                <span>${catGroupData.label || catGroupData.name}</span>
            </div>
            <span class="manager-cat-count-badge">${catTasks.length} ${catTasks.length === 1 ? 'ورد' : (catTasks.length <= 10 ? 'أوراد' : 'ورد')}</span>
        `;
        catCard.appendChild(catHeader);

        const subMap = catGroupData.subMap;
        const generalTasks = catGroupData.generalTasks;
        const hasSubcategoriesWithTasks = Array.from(subMap.values()).some(arr => arr.length > 0);

        if (hasSubcategoriesWithTasks) {
            subMap.forEach((subTasks, subName) => {
                if (subTasks.length === 0) return;

                const subHeader = document.createElement("div");
                subHeader.className = "manager-subcat-header";
                subHeader.innerHTML = `<i class="fa-solid fa-layer-group"></i> <span>${subName}</span> <span class="text-xs font-normal opacity-80">(${subTasks.length})</span>`;
                catCard.appendChild(subHeader);

                const tasksBox = document.createElement("div");
                tasksBox.className = "manager-subcat-tasks";
                subTasks.forEach(t => tasksBox.appendChild(createTaskRowElement(t, isUnscheduledList)));
                catCard.appendChild(tasksBox);
            });

            if (generalTasks.length > 0) {
                const subHeader = document.createElement("div");
                subHeader.className = "manager-subcat-header";
                subHeader.innerHTML = `<i class="fa-solid fa-list-check"></i> <span>عام</span> <span class="text-xs font-normal opacity-80">(${generalTasks.length})</span>`;
                catCard.appendChild(subHeader);

                const tasksBox = document.createElement("div");
                tasksBox.className = "manager-subcat-tasks";
                generalTasks.forEach(t => tasksBox.appendChild(createTaskRowElement(t, isUnscheduledList)));
                catCard.appendChild(tasksBox);
            }
        } else {
            const tasksBox = document.createElement("div");
            tasksBox.className = "manager-subcat-tasks";
            catTasks.forEach(t => tasksBox.appendChild(createTaskRowElement(t, isUnscheduledList)));
            catCard.appendChild(tasksBox);
        }

        containerEl.appendChild(catCard);
    });

    return totalTaskCount;
}

function formatScheduleDisplay(sched) {
    if (!sched || sched === "Everyday") return "يومياً";
    if (sched === "Ramadan") return "شهر رمضان";
    if (sched === "WhiteDays") return "الأيام البيض (13، 14، 15)";
    if (sched === "Unscheduled" || sched === "OneTime") return "غير مجدولة";

    const dayNameMap = Object.fromEntries(APP_CONSTANTS.WEEKDAYS.map(w => [w.key, w.ar]));

    const parts = sched.split(",").map(s => s.trim()).filter(Boolean);
    if (parts.length > 0) {
        const mapped = parts.map(p => dayNameMap[p] || (p === "WhiteDays" ? "الأيام البيض" : p));
        return mapped.join("، ");
    }
    return sched;
}

function createTaskRowElement(task, isUnscheduled) {
    const row = document.createElement("div");
    row.className = `manager-row ${isUnscheduled ? 'unscheduled' : ''}`;
    const iconHtml = getCategoryIconHtml(task);

    const schedDisplay = formatScheduleDisplay(task.schedule);
    const schedText = `📅 التكرار: ${schedDisplay}`;

    const displayType = isPrayerSelector(task) ? 'صلاة فريضة' : getTaskUnit(task);
    const hasDailyTargets = Boolean(task.dailyTargets && Object.keys(task.dailyTargets).length > 0);
    const uniqueTargets = hasDailyTargets ? Array.from(new Set(Object.values(task.dailyTargets).map(Number))) : [];
    const targetText = !isUnscheduled && hasDailyTargets && uniqueTargets.length > 1
        ? `🎯 الهدف: مخصص أسبوعياً (${displayType})`
        : (task.target ? `🎯 الهدف: ${task.target} ${displayType}` : `🏷️ وحدة: ${displayType}`);

    const catBadgeText = task.subcategory ? `${task.category} - ${task.subcategory}` : (task.category || 'عام');

    if (!isUnscheduled) {
        row.innerHTML = `
            <div class="manager-info">
                <div class="manager-icon">${iconHtml}</div>
                <div class="manager-details">
                    <h4>${task.name} <span class="tag-badge text-xs">${catBadgeText}</span></h4>
                    <p>
                        <span>${targetText}</span>
                        <span>${schedText}</span>
                    </p>
                </div>
            </div>
            <div class="manager-actions">
                <button class="btn-action-icon btn-edit" data-id="${task.id}" title="تعديل"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-action-icon btn-unschedule" data-id="${task.id}" title="إلغاء الجدولة"><i class="fa-solid fa-calendar-minus"></i> إلغاء الجدولة</button>
                <button class="btn-action-icon btn-del" data-id="${task.id}" title="حذف نهائي"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    } else {
        row.innerHTML = `
            <div class="manager-info">
                <div class="manager-icon">${iconHtml}</div>
                <div class="manager-details">
                    <h4>${task.name} <span class="tag-badge text-xs">${catBadgeText}</span> <span class="badge badge-amber text-xs">غير مجدولة</span></h4>
                    <p>
                        <span>${targetText}</span>
                    </p>
                </div>
            </div>
            <div class="manager-actions">
                <button class="btn-action-icon btn-schedule" data-id="${task.id}" title="جدولة"><i class="fa-solid fa-calendar-plus"></i> جدولة</button>
                <button class="btn-action-icon btn-edit" data-id="${task.id}" title="تعديل"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-action-icon btn-del" data-id="${task.id}" title="حذف نهائي"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    }

    return row;
}

function renderTaskManager() {
    const scheduledList = document.getElementById("manager-scheduled-list");
    const unscheduledList = document.getElementById("manager-unscheduled-list");
    if (!scheduledList || !unscheduledList) return;

    const appData = AppState.getAppData();
    const tasks = AppState.getTasks();
    const scheduledTasks = tasks.filter(t => t && !isUnscheduledTask(t));
    const unscheduledTasks = tasks.filter(t => isUnscheduledTask(t));

    const scheduledCount = renderGroupedTasks(scheduledList, scheduledTasks, false);
    const unscheduledCount = renderGroupedTasks(unscheduledList, unscheduledTasks, true);

    const elScheduled = document.getElementById("count-scheduled-tasks");
    const elUnscheduled = document.getElementById("count-unscheduled-tasks");
    const elCats = document.getElementById("count-categories");

    if (elScheduled) elScheduled.textContent = scheduledCount;
    if (elUnscheduled) elUnscheduled.textContent = unscheduledCount;
    if (elCats) elCats.textContent = (appData?.categories || APP_CONSTANTS.CATEGORIES || []).length;

    document.querySelectorAll(".btn-edit").forEach(b => b.addEventListener("click", e => openTaskModal(e.currentTarget.getAttribute("data-id"))));
    document.querySelectorAll(".btn-unschedule").forEach(b => b.addEventListener("click", e => toggleTaskSchedule(e.currentTarget.getAttribute("data-id"), false)));
    document.querySelectorAll(".btn-schedule").forEach(b => b.addEventListener("click", e => toggleTaskSchedule(e.currentTarget.getAttribute("data-id"), true)));
    document.querySelectorAll(".btn-del").forEach(b => b.addEventListener("click", e => deleteForever(e.currentTarget.getAttribute("data-id"))));

    if (typeof renderCategoriesManager === "function") {
        renderCategoriesManager();
    }
}

function resolveRestoredSchedule(task) {
    if (task.dailyTargets && typeof task.dailyTargets === "object") {
        const activeDays = APP_CONSTANTS.WEEKDAYS
            .map(w => w.key)
            .filter(dayKey => Number(task.dailyTargets[dayKey]) > 0);
        if (activeDays.length === 7) return APP_CONSTANTS.SCHEDULE_TYPES.EVERYDAY;
        if (activeDays.length > 0) return activeDays.join(", ");
    }
    return APP_CONSTANTS.SCHEDULE_TYPES.EVERYDAY;
}

function toggleTaskSchedule(id, shouldSchedule) {
    const appData = AppState.getAppData();
    const tasks = AppState.getTasks();
    const t = tasks.find(x => x.id === id);
    if (!t) return;

    const curDate = AppState.getCurrentDate();
    t.isArchived = false;
    t.isOneTime = false;
    t.oneTimeDate = null;
    t.archivedAt = null;
    t._pendingSync = true;

    if (!shouldSchedule) {
        t.schedule = APP_CONSTANTS.SCHEDULE_TYPES.UNSCHEDULED;
        const log = appData.logs?.[curDate];
        if (log) {
            const tp = log.taskProgress?.[id];
            const val = Number(tp?.achieved) || 0;
            if (val <= 0 && tp?.status !== "bonus") {
                if (log.taskProgress) delete log.taskProgress[id];
                if (log._dirtyTasks) delete log._dirtyTasks[id];
                log._dirty = true;
            }
        }
    } else {
        t.schedule = resolveRestoredSchedule(t);
        if (!t.target || t.target <= 0) {
            t.target = 1;
        }
    }

    if (curDate && typeof ScoringEngine !== "undefined" && ScoringEngine.invalidateScoreCache) {
        ScoringEngine.invalidateScoreCache(curDate, appData);
    }

    saveData(true);
    if (awradyAPI?.client) {
        awradyAPI.saveTask(t).then(() => {
            if (t._pendingSync) {
                delete t._pendingSync;
                saveData(true);
            }
        }).catch(e => console.warn("[AwradyAPI] toggleTaskSchedule:", e.message));
    }

    if (typeof window !== "undefined") {
        if (typeof window.renderDailyView === "function") window.renderDailyView();
        renderTaskManager();
        if (typeof window.updateHeaderTodayScore === "function") window.updateHeaderTodayScore();
        if (typeof window.renderAllTimeStats === "function") window.renderAllTimeStats();
        if (typeof window.updateChartAndAnalytics === "function") window.updateChartAndAnalytics();
    } else {
        renderTaskManager();
    }
}

function deleteForever(id) {
    const appData = AppState.getAppData();
    const tasks = AppState.getTasks();
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    if (confirm(`هل أنت متأكد من حذف مهمة (${t.name}) نهائياً؟\nسيتم إزالة المهمة وجميع بياناتها تماماً من النظام ولن يمكن استعادتها.`)) {
        // 1. Remove permanently from AppState tasks
        AppState.setTasks(tasks.filter(x => x.id !== id));

        // 2. Purge all references and logs for this task
        if (appData.logs) {
            Object.keys(appData.logs).forEach(dateStr => {
                const log = appData.logs[dateStr];
                if (log) {
                    if (log.taskProgress && log.taskProgress[id] !== undefined) {
                        delete log.taskProgress[id];
                    }
                    if (log._dirtyTasks && log._dirtyTasks[id] !== undefined) {
                        delete log._dirtyTasks[id];
                    }
                    if (log.prayerExtras && log.prayerExtras[id]) {
                        delete log.prayerExtras[id];
                    }
                }
            });
        }

        saveData();
        if (window.awradyAPI?.client) {
            window.awradyAPI.purgeTask(id).catch(e => console.warn("[AwradyAPI] purgeTask:", e.message));
        }
        if (typeof window !== "undefined") {
            if (typeof window.renderDailyView === "function") window.renderDailyView();
            renderTaskManager();
            if (typeof window.renderAllTimeStats === "function") window.renderAllTimeStats();
            if (typeof window.updateChartAndAnalytics === "function") window.updateChartAndAnalytics();
            if (typeof window.updateHeaderTodayScore === "function") window.updateHeaderTodayScore();
        } else {
            renderTaskManager();
        }
    }
}

function addBonusTaskToDate(taskId, dateStr) {
    const appData = AppState.getAppData();
    const log = AppState.ensureDayRecord(dateStr);

    log.taskProgress[taskId] = {
        target: 0,
        achieved: 0,
        status: "bonus",
        _explicit: true
    };

    if (!log._dirtyTasks) log._dirtyTasks = {};
    log._dirtyTasks[taskId] = Date.now();
    log._dirty = true;
    if (typeof ScoringEngine !== "undefined") {
        ScoringEngine.invalidateScoreCache(dateStr, appData);
    }
    saveData(true, dateStr);
    if (typeof window !== "undefined") {
        if (typeof window.renderDailyView === "function") window.renderDailyView();
        if (typeof window.updateDailyScoreSummary === "function") window.updateDailyScoreSummary();
        if (typeof window.updateHeaderTodayScore === "function") window.updateHeaderTodayScore();
    }
}

if (typeof window !== "undefined") {
    window.setupTaskManager = setupTaskManager;
    window.renderGroupedTasks = renderGroupedTasks;
    window.renderTaskManager = renderTaskManager;
    window.toggleTaskSchedule = toggleTaskSchedule;
    window.deleteForever = deleteForever;
    window.addBonusTaskToDate = addBonusTaskToDate;
}

export {
    setupTaskManager,
    renderGroupedTasks,
    renderTaskManager,
    toggleTaskSchedule,
    deleteForever,
    addBonusTaskToDate
};

