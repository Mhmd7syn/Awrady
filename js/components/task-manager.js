/**
 * ============================================================================
 * AWRAD PRO - TASK MANAGER COMPONENT
 * Manages Task CRUD operations, modals, grouping, bonus tasks, and archiving.
 * ============================================================================
 */

function setupTaskManager() {
    const subTabs = document.querySelectorAll(".sub-tab");
    const btnAddTask = document.getElementById("btn-open-add-task-modal");

    subTabs.forEach(btn => {
        btn.addEventListener("click", () => {
            subTabs.forEach(t => t.classList.remove("active"));
            btn.classList.add("active");
            const sec = btn.getAttribute("data-sub");
            document.querySelectorAll(".sub-tab-content").forEach(c => c.classList.remove("active"));
            
            if (sec === "active-tasks") {
                document.getElementById("manager-active-section")?.classList.add("active");
                if (btnAddTask) btnAddTask.style.display = "flex";
            } else if (sec === "onetime-tasks") {
                document.getElementById("manager-onetime-section")?.classList.add("active");
                if (btnAddTask) btnAddTask.style.display = "flex";
            } else if (sec === "archived-tasks") {
                document.getElementById("manager-archived-section")?.classList.add("active");
                if (btnAddTask) btnAddTask.style.display = "flex";
            } else if (sec === "categories") {
                document.getElementById("manager-categories-section")?.classList.add("active");
                if (btnAddTask) btnAddTask.style.display = "none";
                renderCategoriesManager();
            }
        });
    });

    // Add task modal
    const openAddBtn = document.getElementById("btn-open-add-task-modal");
    if (openAddBtn) {
        openAddBtn.addEventListener("click", () => {
            const activeSub = document.querySelector(".sub-tab.active")?.getAttribute("data-sub");
            if (activeSub === "onetime-tasks") {
                openTaskModal(null, { isOneTime: true });
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
            const box = document.getElementById("weekdays-selector-box");
            const otBox = document.getElementById("onetime-date-selector-box");
            if (box) {
                if (e.target.value === "Weekdays") {
                    box.classList.remove("hidden");
                } else {
                    box.classList.add("hidden");
                }
            }
            if (otBox) {
                if (e.target.value === "OneTime") {
                    otBox.classList.remove("hidden");
                    const otDateInput = document.getElementById("task-onetime-date-input");
                    if (otDateInput && !otDateInput.value) {
                        otDateInput.value = currentDateStr;
                    }
                } else {
                    otBox.classList.add("hidden");
                }
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

function renderGroupedTasks(containerEl, tasksList, isArchivedList = false, isOneTimeList = false) {
    containerEl.innerHTML = "";
    if (!tasksList || tasksList.length === 0) {
        if (isArchivedList) {
            containerEl.innerHTML = `<div class="empty-state"><i class="fa-solid fa-box-open icon-lg gold-text"></i><h3>قائمة الأرشيف فارغة</h3><p>عند الانتهاء الدائم من مهمة معينة، اضغط على زر "إتمام وأرشفة" لتخليد إنجازها وتخفيف جدولك.</p></div>`;
        } else if (isOneTimeList) {
            containerEl.innerHTML = `<div class="empty-state"><i class="fa-solid fa-bolt icon-lg gold-text"></i><h3>لا توجد مهام لمرة واحدة حالياً</h3><p>المهام المؤقتة أو المجدولة لمرة واحدة فقط تظهر هنا بشكل مستقل لتسهيل مراجعتها وتعديلها أو أرشفتها.</p></div>`;
        } else {
            containerEl.innerHTML = `<div class="empty-state"><h3>لا توجد أوراد نشطة حالياً</h3></div>`;
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
                subHeader.innerHTML = `<i class="fa-solid fa-layer-group"></i> <span>${subName}</span> <span style="font-size:0.8rem; font-weight:normal; opacity:0.8;">(${subTasks.length})</span>`;
                catCard.appendChild(subHeader);

                const tasksBox = document.createElement("div");
                tasksBox.className = "manager-subcat-tasks";
                subTasks.forEach(t => tasksBox.appendChild(createTaskRowElement(t, isArchivedList)));
                catCard.appendChild(tasksBox);
            });

            if (generalTasks.length > 0) {
                const subHeader = document.createElement("div");
                subHeader.className = "manager-subcat-header";
                subHeader.innerHTML = `<i class="fa-solid fa-list-check"></i> <span>عام</span> <span style="font-size:0.8rem; font-weight:normal; opacity:0.8;">(${generalTasks.length})</span>`;
                catCard.appendChild(subHeader);

                const tasksBox = document.createElement("div");
                tasksBox.className = "manager-subcat-tasks";
                generalTasks.forEach(t => tasksBox.appendChild(createTaskRowElement(t, isArchivedList)));
                catCard.appendChild(tasksBox);
            }
        } else {
            const tasksBox = document.createElement("div");
            tasksBox.className = "manager-subcat-tasks";
            catTasks.forEach(t => tasksBox.appendChild(createTaskRowElement(t, isArchivedList)));
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
    if (sched === "Optional") return "اختياري / عند التنفيذ";
    if (sched === "OneTime") return "لمرة واحدة فقط";

    const dayNameMap = Object.fromEntries(APP_CONSTANTS.WEEKDAYS.map(w => [w.key, w.ar]));

    const parts = sched.split(",").map(s => s.trim()).filter(Boolean);
    if (parts.length > 0) {
        const mapped = parts.map(p => dayNameMap[p] || (p === "WhiteDays" ? "الأيام البيض" : p));
        return mapped.join("، ");
    }
    return sched;
}

function createTaskRowElement(task, isArchived) {
    const row = document.createElement("div");
    row.className = `manager-row ${task.isArchived ? 'archived' : ''}`;
    const iconHtml = getCategoryIconHtml(task);

    const isOt = !!(task.isOneTime || task.schedule === "OneTime");
    let schedText;
    if (isOt) {
        const dStr = task.oneTimeDate;
        schedText = dStr ? `📅 التاريخ: ${dStr}` : `📅 لمرة واحدة فقط`;
    } else {
        const schedDisplay = formatScheduleDisplay(task.schedule);
        schedText = `📅 التكرار: ${schedDisplay}`;
    }

    let displayType = isPrayerSelector(task) ? 'صلاة فريضة' : task.type;
    const targetText = task.target ? `🎯 الهدف: ${task.target} ${displayType}` : `🏷️ وحدة: ${displayType}`;
    const multText = task.multiplier !== undefined && task.multiplier !== 1 ? `⚡ معامل النقاط: ${task.multiplier * 100}%` : '';

    const catBadgeText = task.subcategory ? `${task.category} - ${task.subcategory}` : (task.category || 'عام');
    const otBadge = isOt ? `<span class="badge" style="font-size:0.75rem; background:rgba(245,158,11,0.18); color:#f59e0b; border:1px solid rgba(245,158,11,0.35);"><i class="fa-solid fa-bolt"></i> لمرة واحدة</span>` : '';

    if (!isArchived) {
        row.innerHTML = `
            <div class="manager-info">
                <div class="manager-icon">${iconHtml}</div>
                <div class="manager-details">
                    <h4>${task.name} <span class="tag-badge" style="font-size:0.75rem">${catBadgeText}</span> ${otBadge}</h4>
                    <p>
                        <span>${targetText}</span>
                        <span>${schedText}</span>
                        ${multText ? `<span>${multText}</span>` : ''}
                    </p>
                </div>
            </div>
            <div class="manager-actions">
                <button class="btn-action-icon btn-edit" data-id="${task.id}" title="تعديل"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-action-icon btn-archive" data-id="${task.id}" title="أرشفة"><i class="fa-solid fa-box-archive"></i> أرشفة</button>
                <button class="btn-action-icon btn-del" data-id="${task.id}" title="حذف نهائي"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    } else {
        row.innerHTML = `
            <div class="manager-info">
                <div class="manager-icon">${iconHtml}</div>
                <div class="manager-details">
                    <h4>${task.name} <span class="tag-badge" style="font-size:0.75rem">${catBadgeText}</span> ${otBadge} <span class="badge badge-amber" style="font-size:0.75rem">✨ مؤرشف</span></h4>
                    <p>
                        <span>${targetText}</span>
                        ${isOt ? `<span>${schedText}</span>` : ''}
                    </p>
                </div>
            </div>
            <div class="manager-actions">
                <button class="btn-action-icon btn-unarchive" data-id="${task.id}" title="استعادة"><i class="fa-solid fa-box-open"></i> استعادة</button>
                <button class="btn-action-icon btn-edit" data-id="${task.id}" title="تعديل"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-action-icon btn-del" data-id="${task.id}" title="حذف نهائي"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    }

    return row;
}

function renderTaskManager() {
    const activeList = document.getElementById("manager-active-list");
    const onetimeList = document.getElementById("manager-onetime-list");
    const archivedList = document.getElementById("manager-archived-list");
    if (!activeList || !archivedList) return;

    const activeTasks = appData.tasks.filter(t => !t.isArchived && !t.isOneTime && t.schedule !== "OneTime");
    const onetimeTasks = appData.tasks.filter(t => !t.isArchived && (t.isOneTime || t.schedule === "OneTime"));
    const archivedTasks = appData.tasks.filter(t => t.isArchived);

    const activeCount = renderGroupedTasks(activeList, activeTasks, false, false);
    const onetimeCount = onetimeList ? renderGroupedTasks(onetimeList, onetimeTasks, false, true) : 0;
    const archivedCount = renderGroupedTasks(archivedList, archivedTasks, true, false);

    const elActive = document.getElementById("count-active-tasks");
    const elOnetime = document.getElementById("count-onetime-tasks");
    const elArchived = document.getElementById("count-archived-tasks");
    const elCats = document.getElementById("count-categories");

    if (elActive) elActive.textContent = activeCount;
    if (elOnetime) elOnetime.textContent = onetimeCount;
    if (elArchived) elArchived.textContent = archivedCount;
    if (elCats) elCats.textContent = appData.categories.length;

    document.querySelectorAll(".btn-edit").forEach(b => b.addEventListener("click", e => openTaskModal(e.currentTarget.getAttribute("data-id"))));
    document.querySelectorAll(".btn-archive").forEach(b => b.addEventListener("click", e => archiveTask(e.currentTarget.getAttribute("data-id"), true)));
    document.querySelectorAll(".btn-unarchive").forEach(b => b.addEventListener("click", e => archiveTask(e.currentTarget.getAttribute("data-id"), false)));
    document.querySelectorAll(".btn-del").forEach(b => b.addEventListener("click", e => deleteForever(e.currentTarget.getAttribute("data-id"))));

    if (typeof renderCategoriesManager === "function") {
        renderCategoriesManager();
    }
}

function archiveTask(id, isArchive) {
    const t = appData.tasks.find(x => x.id === id);
    if (t) {
        t.isArchived = isArchive;
        const curDate = currentDateStr;
        t.archivedAt = isArchive ? curDate : null;
        if (!isArchive) {
            if (t.schedule === "OneTime") {
                t.isOneTime = true;
                if (!t.oneTimeDate) {
                    t.oneTimeDate = curDate;
                }
            }
            if (!t.target || t.target === 0) {
                t.target = 1;
            }
        }
        saveData(true);
        if (window.enjazAPI?.client) {
            window.enjazAPI.saveTask(t).catch(e => console.warn("[EnjazAPI] archiveTask:", e.message));
        }
        renderDailyView();
        renderTaskManager();
    }
}

function deleteForever(id) {
    const t = appData.tasks.find(x => x.id === id);
    if (!t) return;
    if (confirm(`هل أنت متأكد من حذف مهمة (${t.name}) نهائياً؟\nسيتم إزالة المهمة وجميع بياناتها تماماً من النظام ولن يمكن استعادتها.`)) {
        // 1. Remove permanently from appData.tasks
        appData.tasks = appData.tasks.filter(x => x.id !== id);

        // 2. Purge all references and logs for this task
        if (appData.logs) {
            Object.keys(appData.logs).forEach(dateStr => {
                const log = appData.logs[dateStr];
                if (log) {
                    if (log.entries && log.entries[id] !== undefined) {
                        delete log.entries[id];
                    }
                    if (Array.isArray(log.bonusTaskIds)) {
                        log.bonusTaskIds = log.bonusTaskIds.filter(x => x !== id);
                    }
                    if (Array.isArray(log.disabledTaskIds)) {
                        log.disabledTaskIds = log.disabledTaskIds.filter(x => x !== id);
                    }
                    if (log.prayerExtras && log.prayerExtras[id]) {
                        delete log.prayerExtras[id];
                    }
                }
            });
        }

        saveData();
        if (window.enjazAPI?.client) {
            window.enjazAPI.purgeTask(id).catch(e => console.warn("[EnjazAPI] purgeTask:", e.message));
        }
        renderDailyView();
        renderTaskManager();
        renderAllTimeStats();
        updateChartAndAnalytics();
        updateHeaderTodayScore();
    }
}

function addBonusTaskToDate(taskId, dateStr) {
    if (!appData.logs[dateStr]) appData.logs[dateStr] = { entries: {}, bonusTaskIds: [] };
    if (!appData.logs[dateStr].bonusTaskIds) appData.logs[dateStr].bonusTaskIds = [];
    if (!appData.logs[dateStr].bonusTaskIds.includes(taskId)) {
        appData.logs[dateStr].bonusTaskIds.push(taskId);
    }
    if (appData.logs[dateStr].disabledTaskIds && appData.logs[dateStr].disabledTaskIds.includes(taskId)) {
        appData.logs[dateStr].disabledTaskIds = appData.logs[dateStr].disabledTaskIds.filter(id => id !== taskId);
    }
    saveData();
    renderDailyView();
    updateDailyScoreSummary();
    updateHeaderTodayScore();
}

