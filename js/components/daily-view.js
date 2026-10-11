/**
 * Awrady Dashboard - Daily View Component
 */

function getTaskVal(taskId) {
    if (typeof window !== "undefined" && window.getTaskVal && window.getTaskVal !== getTaskVal) {
        return window.getTaskVal(taskId);
    }
    const curDateStr = typeof currentDateStr !== "undefined" ? currentDateStr : getLocalTodayString();
    return (window.appData && window.appData.logs && window.appData.logs[curDateStr] && window.appData.logs[curDateStr].entries && window.appData.logs[curDateStr].entries[taskId]) || 0;
}

function setTaskVal(taskId, val) {
    if (typeof window !== "undefined" && window.setTaskVal && window.setTaskVal !== setTaskVal) {
        return window.setTaskVal(taskId, val);
    }
    const curDateStr = typeof currentDateStr !== "undefined" ? currentDateStr : getLocalTodayString();
    if (!window.appData.logs[curDateStr]) {
        window.appData.logs[curDateStr] = { entries: {} };
    }
    if (!window.appData.logs[curDateStr].entries) {
        window.appData.logs[curDateStr].entries = {};
    }
    const prevVal = (window.appData.logs[curDateStr].entries[taskId]) || 0;
    window.appData.logs[curDateStr].entries[taskId] = val;
    if (typeof saveData === "function") saveData();

    const task = (window.appData && window.appData.tasks) ? window.appData.tasks.find(t => t.id === taskId) : null;
    const wasDone = task && typeof isTaskCompleted === "function" ? isTaskCompleted(task, prevVal, curDateStr) : false;
    const nowDone = task && typeof isTaskCompleted === "function" ? isTaskCompleted(task, val, curDateStr) : false;

    if (task && wasDone === nowDone && typeof window !== "undefined" && typeof window.updateTaskCardInPlace === "function" && window.updateTaskCardInPlace(taskId, val, task)) {
        // Updated in place without full grid re-render!
    } else if (typeof renderDailyView === "function") {
        renderDailyView();
    }
}

function adjustTaskVal(taskId, delta) {
    if (typeof window !== "undefined" && window.adjustTaskVal && window.adjustTaskVal !== adjustTaskVal) {
        return window.adjustTaskVal(taskId, delta);
    }
    const current = getTaskVal(taskId);
    let newVal = Math.max(0, current + delta);
    setTaskVal(taskId, newVal);

    if (delta > 0 && typeof isObligatoryPrayerTask === "function" && isObligatoryPrayerTask(taskId)) {
        if (typeof checkAndShowNawafelPrompt === "function") checkAndShowNawafelPrompt(taskId);
    } else if (newVal === 0 && typeof isObligatoryPrayerTask === "function" && isObligatoryPrayerTask(taskId)) {
        if (typeof removePrayerExtras === "function") removePrayerExtras(taskId);
    }

    if (delta > 0 && typeof isQiyamTask === "function" && isQiyamTask(taskId)) {
        if (typeof checkAndShowQiyamPrompt === "function") checkAndShowQiyamPrompt();
    }
}

function isQiyamTask(taskId) {
    const task = window.appData && window.appData.tasks ? window.appData.tasks.find(t => t.id === taskId) : null;
    return task && (task.subcategory === "قيام ليل" || task.name.includes("قيام"));
}

function toggleDeactivateTaskForDate(taskId, dateStr) {
    if (!window.appData.logs[dateStr]) {
        window.appData.logs[dateStr] = { entries: {}, disabledTaskIds: [] };
    }
    const log = window.appData.logs[dateStr];
    if (!log.disabledTaskIds || !Array.isArray(log.disabledTaskIds)) {
        log.disabledTaskIds = [];
    }
    const idx = log.disabledTaskIds.indexOf(taskId);
    if (idx >= 0) {
        log.disabledTaskIds.splice(idx, 1);
    } else {
        log.disabledTaskIds.push(taskId);
    }
    if (typeof saveData === "function") saveData();
    if (typeof renderDailyView === "function") renderDailyView();
    if (typeof updateDailyScoreSummary === "function") updateDailyScoreSummary();
}

function removeBonusTaskFromDate(taskId, dateStr) {
    const task = window.appData && window.appData.tasks ? window.appData.tasks.find(t => t.id === taskId) : null;

    if (task && (task.isOneTime || task.schedule === "OneTime")) {
        if (!confirm("هل أنت متأكد من إلغاء وحذف هذه المهمة لمرة واحدة؟")) {
            return;
        }
        window.appData.tasks = window.appData.tasks.filter(t => t.id !== taskId);
        if (!window.appData.deletedTaskIds) window.appData.deletedTaskIds = [];
        if (!window.appData.deletedTaskIds.includes(taskId)) window.appData.deletedTaskIds.push(taskId);
    } else if (task && task.isBonus) {
        if (!confirm("هل أنت متأكد من إلغاء وحذف هذا الورد الإضافي؟")) {
            return;
        }
        window.appData.tasks = window.appData.tasks.filter(t => t.id !== taskId);
        if (!window.appData.deletedTaskIds) window.appData.deletedTaskIds = [];
        if (!window.appData.deletedTaskIds.includes(taskId)) window.appData.deletedTaskIds.push(taskId);
    }

    if (window.appData.logs[dateStr] && window.appData.logs[dateStr].bonusTaskIds) {
        window.appData.logs[dateStr].bonusTaskIds = window.appData.logs[dateStr].bonusTaskIds.filter(id => id !== taskId);
    }
    if (window.appData.logs[dateStr] && window.appData.logs[dateStr].entries) {
        delete window.appData.logs[dateStr].entries[taskId];
    }
    if (typeof saveData === "function") saveData();
    if (typeof renderDailyView === "function") renderDailyView();
}

function removeOneTimeTask(taskId, dateStr) {
    if (confirm("هل أنت متأكد من إلغاء وحذف هذه المهمة لمرة واحدة؟")) {
        window.appData.tasks = window.appData.tasks.filter(t => t.id !== taskId);
        if (!window.appData.deletedTaskIds) window.appData.deletedTaskIds = [];
        if (!window.appData.deletedTaskIds.includes(taskId)) window.appData.deletedTaskIds.push(taskId);
        if (window.appData.logs[dateStr] && window.appData.logs[dateStr].entries) {
            delete window.appData.logs[dateStr].entries[taskId];
        }
        if (window.appData.logs[dateStr] && window.appData.logs[dateStr].bonusTaskIds) {
            window.appData.logs[dateStr].bonusTaskIds = window.appData.logs[dateStr].bonusTaskIds.filter(id => id !== taskId);
        }
        if (typeof saveData === "function") saveData();
        if (typeof renderDailyView === "function") renderDailyView();
    }
}

function getCategoryIconHtml(task) {
    if (!task) return '<i class="fa-solid fa-list-check"></i>';
    if (task.icon) {
        if (task.icon.startsWith("fa-")) {
            return `<i class="fa-solid ${task.icon}"></i>`;
        }
        return `<i class="fa-solid fa-${task.icon}"></i>`;
    }
    const catObj = (window.appData && window.appData.categories) ? window.appData.categories.find(c => c.name === task.category) : null;
    if (catObj && catObj.icon) {
        return `<i class="fa-solid ${catObj.icon.startsWith('fa-') ? catObj.icon : 'fa-' + catObj.icon}"></i>`;
    }
    return '<i class="fa-solid fa-list-check"></i>';
}

function openBonusTaskModal() {
    const modal = document.getElementById("bonus-task-modal");
    if (!modal) return;
    const listEl = document.getElementById("bonus-tasks-list");
    if (!listEl) return;

    listEl.innerHTML = "";

    const curDateStr = typeof currentDateStr !== "undefined" ? currentDateStr : getLocalTodayString();
    const availableTasks = (window.appData.tasks || []).filter(t => {
        if (t.isArchived || t.isOneTime || t.schedule === "OneTime") return false;
        const isSchedToday = typeof ScheduleEngine !== "undefined" ? ScheduleEngine.isTaskScheduledForDate(t, curDateStr, window.appData) : false;
        return !isSchedToday;
    });

    if (availableTasks.length === 0) {
        listEl.innerHTML = `<div class="empty-state" style="padding: 20px;"><p style="color: #94a3b8;">جميع الأوراد والمهام مجدولة بالفعل ليوم اليوم! لا توجد أوراد غير مجدولة لإضافتها كبونص.</p></div>`;
    } else {
        availableTasks.forEach(task => {
            const item = document.createElement("div");
            item.className = "bonus-item-row";
            item.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 12px; background: rgba(255, 255, 255, 0.05); border-radius: 10px; margin-bottom: 8px;";
            
            const iconHtml = getCategoryIconHtml(task);
            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="font-size: 1.2rem; color: #f59e0b;">${iconHtml}</div>
                    <div>
                        <h4 style="margin: 0; font-size: 1rem; color: #f8fafc;">${task.name}</h4>
                        <span style="font-size: 0.75rem; color: #94a3b8;">${task.category}${task.subcategory ? ' - ' + task.subcategory : ''}</span>
                    </div>
                </div>
                <button class="btn-primary btn-add-as-bonus" data-task-id="${task.id}" style="padding: 6px 14px; font-size: 0.85rem;"><i class="fa-solid fa-plus"></i> إضافة بونص</button>
            `;
            listEl.appendChild(item);
        });

        listEl.querySelectorAll(".btn-add-as-bonus").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const tid = e.currentTarget.getAttribute("data-task-id");
                addBonusTaskToDate(tid, curDateStr);
                closeBonusTaskModal();
            });
        });
    }

    modal.classList.remove("hidden");
}

function closeBonusTaskModal() {
    const modal = document.getElementById("bonus-task-modal");
    if (modal) modal.classList.add("hidden");
}

function addBonusTaskToDate(taskId, dateStr) {
    if (!window.appData.logs[dateStr]) {
        window.appData.logs[dateStr] = { entries: {}, bonusTaskIds: [] };
    }
    const log = window.appData.logs[dateStr];
    if (!log.bonusTaskIds || !Array.isArray(log.bonusTaskIds)) {
        log.bonusTaskIds = [];
    }
    if (!log.bonusTaskIds.includes(taskId)) {
        log.bonusTaskIds.push(taskId);
    }
    if (typeof saveData === "function") saveData();
    if (typeof renderDailyView === "function") renderDailyView();
}

if (typeof window !== "undefined") {
    window.getTaskVal = getTaskVal;
    window.setTaskVal = setTaskVal;
    window.adjustTaskVal = adjustTaskVal;
    window.toggleDeactivateTaskForDate = toggleDeactivateTaskForDate;
    window.removeBonusTaskFromDate = removeBonusTaskFromDate;
    window.removeOneTimeTask = removeOneTimeTask;
    window.getCategoryIconHtml = getCategoryIconHtml;
    window.openBonusTaskModal = openBonusTaskModal;
    window.closeBonusTaskModal = closeBonusTaskModal;
}
