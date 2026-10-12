/**
 * ============================================================================
 * AWRAD PRO - TASK MANAGER COMPONENT
 * Manages Task CRUD operations, modals, grouping, bonus tasks, and archiving.
 * ============================================================================
 */

function setupTaskManager() {
    const subTabs = document.querySelectorAll(".sub-tab");
    const btnAddTask = document.getElementById("btn-open-add-task-modal");
    const btnAddCat = document.getElementById("btn-open-add-cat-modal");

    subTabs.forEach(btn => {
        btn.addEventListener("click", () => {
            subTabs.forEach(t => t.classList.remove("active"));
            btn.classList.add("active");
            const sec = btn.getAttribute("data-sub");
            document.querySelectorAll(".sub-tab-content").forEach(c => c.classList.remove("active"));
            
            if (sec === "active-tasks") {
                document.getElementById("manager-active-section")?.classList.add("active");
                btnAddTask.style.display = "flex";
                btnAddCat.style.display = "none";
            } else if (sec === "onetime-tasks") {
                document.getElementById("manager-onetime-section")?.classList.add("active");
                btnAddTask.style.display = "flex";
                btnAddCat.style.display = "none";
            } else if (sec === "archived-tasks") {
                document.getElementById("manager-archived-section")?.classList.add("active");
                btnAddTask.style.display = "flex";
                btnAddCat.style.display = "none";
            } else if (sec === "categories") {
                document.getElementById("manager-categories-section")?.classList.add("active");
                btnAddTask.style.display = "none";
                btnAddCat.style.display = "flex";
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
            const dtBox = document.getElementById("day-targets-box");
            const otBox = document.getElementById("onetime-date-selector-box");
            if (box) {
                if (e.target.value === "Weekdays") {
                    box.classList.remove("hidden");
                    if (dtBox) dtBox.classList.remove("hidden");
                } else {
                    box.classList.add("hidden");
                    if (dtBox) dtBox.classList.add("hidden");
                }
            }
            if (otBox) {
                if (e.target.value === "OneTime") {
                    otBox.classList.remove("hidden");
                    const otDateInput = document.getElementById("task-onetime-date-input");
                    if (otDateInput && !otDateInput.value) {
                        const cur = (typeof currentDateStr !== "undefined" && currentDateStr) ? currentDateStr : (typeof getLocalTodayString === "function" ? getLocalTodayString() : new Date().toISOString().split("T")[0]);
                        otDateInput.value = cur;
                    }
                } else {
                    otBox.classList.add("hidden");
                }
            }
        });
    });

    const enableDayTargetsCheck = document.getElementById("task-enable-day-targets");
    if (enableDayTargetsCheck) {
        enableDayTargetsCheck.addEventListener("change", (e) => {
            const grid = document.getElementById("day-targets-inputs-grid");
            if (grid) {
                if (e.target.checked) {
                    grid.classList.remove("hidden");
                    renderDayTargetsInputs();
                } else {
                    grid.classList.add("hidden");
                }
            }
        });
    }

    document.querySelectorAll('#weekdays-selector-box input[type=checkbox]').forEach(chk => {
        chk.addEventListener("change", () => {
            if (document.getElementById("task-enable-day-targets")?.checked) {
                renderDayTargetsInputs();
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

function renderDayTargetsInputs(taskDayTargets = null) {
    const grid = document.getElementById("day-targets-inputs-grid");
    if (!grid) return;
    grid.innerHTML = "";

    const dayLabels = {
        "Sat": "السبت (Sat)",
        "Sun": "الأحد (Sun)",
        "Mon": "الإثنين (Mon)",
        "Tue": "الثلاثاء (Tue)",
        "Wed": "الأربعاء (Wed)",
        "Thu": "الخميس (Thu)",
        "Fri": "الجمعة (Fri)"
    };

    const checkedDays = [];
    document.querySelectorAll('#weekdays-selector-box input[type=checkbox]:checked').forEach(c => checkedDays.push(c.value));

    if (checkedDays.length === 0) {
        grid.innerHTML = `<span style="grid-column: 1 / -1; font-size: 0.8rem; color: #94a3b8;">يرجى اختيار الأيام أولاً من القائمة أعلاه</span>`;
        return;
    }

    const defaultTarget = document.getElementById("task-target-input")?.value || "1";

    checkedDays.forEach(day => {
        const item = document.createElement("div");
        item.style.cssText = "display:flex; flex-direction:column; gap:4px; background:rgba(0,0,0,0.25); padding:6px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.08);";
        const val = (taskDayTargets && taskDayTargets[day] !== undefined) ? taskDayTargets[day] : defaultTarget;
        item.innerHTML = `
            <label style="font-size:0.75rem; color:#f8fafc; font-weight:600;">${dayLabels[day] || day}</label>
            <input type="number" step="0.5" min="0.5" class="day-target-input" data-day="${day}" value="${val}" style="padding:4px 8px; border-radius:6px; border:1px solid rgba(16,185,129,0.4); background:#0f172a; color:#fff; font-size:0.85rem; font-weight:bold; width:100%;">
        `;
        grid.appendChild(item);
    });
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

    const catMap = new Map();
    (appData.categories || []).forEach(c => {
        catMap.set(c.name, {
            name: c.name,
            label: c.label || c.name,
            icon: c.icon || "fa-list-check",
            subcategories: c.subcategories || [],
            tasks: []
        });
    });

    tasksList.forEach(task => {
        const catName = task.category || "أخرى";
        if (!catMap.has(catName)) {
            catMap.set(catName, {
                name: catName,
                label: catName,
                icon: "fa-folder",
                subcategories: [],
                tasks: []
            });
        }
        catMap.get(catName).tasks.push(task);
    });

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
                <span>${catGroupData.label}</span>
            </div>
            <span class="manager-cat-count-badge">${catTasks.length} ${catTasks.length === 1 ? 'ورد' : (catTasks.length <= 10 ? 'أوراد' : 'ورد')}</span>
        `;
        catCard.appendChild(catHeader);

        const subMap = new Map();
        (catGroupData.subcategories || []).forEach(sub => {
            subMap.set(sub.name, []);
        });

        const generalTasks = [];
        catTasks.forEach(task => {
            const subName = (task.subcategory || "").trim();
            if (subName) {
                if (!subMap.has(subName)) {
                    subMap.set(subName, []);
                }
                subMap.get(subName).push(task);
            } else {
                generalTasks.push(task);
            }
        });

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

    const dayNameMap = {
        "Sat": "السبت",
        "Sun": "الأحد",
        "Mon": "الإثنين",
        "Tue": "الثلاثاء",
        "Wed": "الأربعاء",
        "Thu": "الخميس",
        "Fri": "الجمعة"
    };

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
        const dStr = task.oneTimeDate || (Array.isArray(task.oneTimeDates) ? task.oneTimeDates[0] : null);
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
        const curDate = (typeof currentDateStr !== "undefined" && currentDateStr) ? currentDateStr : getLocalTodayString();
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
        if (typeof ScheduleEngine !== "undefined" && typeof ScheduleEngine.invalidateTaskCache === "function") {
            ScheduleEngine.invalidateTaskCache(t);
        }
        saveData(true);
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

        // 2. Track deleted ID in tombstones for multi-device & cloud sync
        if (!appData.deletedTaskIds) {
            appData.deletedTaskIds = [];
        }
        if (!appData.deletedTaskIds.includes(id)) {
            appData.deletedTaskIds.push(id);
        }

        // 3. Purge all references and logs for this task
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

        if (typeof ScheduleEngine !== "undefined" && typeof ScheduleEngine.invalidateTaskCache === "function") {
            ScheduleEngine.invalidateTaskCache(t);
        }

        saveData();
        renderDailyView();
        renderTaskManager();
        if (typeof renderAllTimeStats === "function") renderAllTimeStats();
        if (typeof updateChartAndAnalytics === "function") updateChartAndAnalytics();
        if (typeof updateHeaderTodayScore === "function") updateHeaderTodayScore();
    }
}

function autoDetectType(catName, subcatName) {
    const c = appData.categories.find(x => x.name === catName);
    if (c) {
        if (subcatName) {
            const sub = (c.subcategories || []).find(s => s.name === subcatName);
            if (sub && sub.defaultUnit) return sub.defaultUnit;
            if ((catName === "صلاة" || catName === "الصلاة") && (subcatName === "فرض" || subcatName === "فرائض")) return "صلاة";
        }
        if (c.defaultUnit) return c.defaultUnit;
    }
    return "مهمة";
}

function isTimeBasedType(type) {
    return type === "ساعة" || type === "ساعات ودقايق" || type === "وقت" || type === "دقيقة";
}

function openTaskModal(id, options = {}) {
    editingTaskId = id;
    const modal = document.getElementById("task-modal");
    const title = document.getElementById("modal-task-title");
    const idInput = document.getElementById("task-id-input");
    const nameInput = document.getElementById("task-name-input");
    const catInput = document.getElementById("task-category-input");
    const subcatInput = document.getElementById("task-subcategory-input");
    const targetInput = document.getElementById("task-target-input");
    const weekdaysBox = document.getElementById("weekdays-selector-box");
    const commentInput = document.getElementById("task-comment-input");
    const bonusCheck = document.getElementById("task-is-bonus-input");

    if (!modal) return;

    function updateSubcats(categoryName, selectedSubcat = "") {
        if (!subcatInput) return;
        subcatInput.innerHTML = '<option value="">-- لا يوجد --</option>';
        const c = appData.categories.find(x => x.name === categoryName);
        if (c && c.subcategories) {
            c.subcategories.forEach(sub => {
                const opt = document.createElement("option");
                opt.value = sub.name;
                opt.textContent = sub.name;
                subcatInput.appendChild(opt);
            });
        }
        subcatInput.value = selectedSubcat;
    }
    
    if (catInput) {
        catInput.onchange = () => {
            updateSubcats(catInput.value);
        };

        // Populate categories select
        catInput.innerHTML = "";
        appData.categories.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.name;
            opt.textContent = c.label || c.name;
            catInput.appendChild(opt);
        });
    }

    if (weekdaysBox) {
        weekdaysBox.querySelectorAll("input[type=checkbox]").forEach(chk => chk.checked = false);
    }

    if (id) {
        const task = appData.tasks.find(t => t.id === id);
        if (task) {
            if (title) title.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> تعديل (${task.name})`;
            if (idInput) idInput.value = task.id;
            if (nameInput) nameInput.value = task.name;
            if (catInput) catInput.value = task.category || (appData.categories[0]?.name || "صلاة");
            updateSubcats(catInput?.value, task.subcategory || "");
            if (targetInput) targetInput.value = task.target !== null ? task.target : "";
            if (commentInput) commentInput.value = task.comment || "";
            if (bonusCheck) bonusCheck.checked = task.isBonus || false;

            const isOt = !!(task.isOneTime || task.schedule === "OneTime");
            const sched = isOt ? "OneTime" : (task.schedule || "Everyday");
            if (sched === "Everyday" || sched === "Ramadan" || sched === "WhiteDays" || sched === "Optional" || sched === "OneTime") {
                const radio = document.querySelector(`input[name="schedule_type"][value="${sched}"]`);
                if (radio) radio.checked = true;
                if (weekdaysBox) weekdaysBox.classList.add("hidden");
            } else {
                const radio = document.querySelector(`input[name="schedule_type"][value="Weekdays"]`);
                if (radio) radio.checked = true;
                if (weekdaysBox) weekdaysBox.classList.remove("hidden");
                sched.split(",").map(s => s.trim()).forEach(day => {
                    const chk = weekdaysBox ? weekdaysBox.querySelector(`input[value="${day}"]`) : null;
                    if (chk) chk.checked = true;
                });
            }

            const otBox = document.getElementById("onetime-date-selector-box");
            const otDateInput = document.getElementById("task-onetime-date-input");
            if (isOt) {
                if (otBox) otBox.classList.remove("hidden");
                if (otDateInput) {
                    const existingDate = task.oneTimeDate || "";
                    otDateInput.value = existingDate || ((typeof currentDateStr !== "undefined" && currentDateStr) ? currentDateStr : (typeof getLocalTodayString === "function" ? getLocalTodayString() : new Date().toISOString().split("T")[0]));
                }
            } else {
                if (otBox) otBox.classList.add("hidden");
            }

            const dtBox = document.getElementById("day-targets-box");
            const dtCheck = document.getElementById("task-enable-day-targets");
            const dtGrid = document.getElementById("day-targets-inputs-grid");

            if (task.dayTargets && Object.keys(task.dayTargets).length > 0) {
                if (dtBox) dtBox.classList.remove("hidden");
                if (dtCheck) dtCheck.checked = true;
                if (dtGrid) dtGrid.classList.remove("hidden");
                renderDayTargetsInputs(task.dayTargets);
            } else {
                if (dtCheck) dtCheck.checked = false;
                if (dtGrid) dtGrid.classList.add("hidden");
                if (sched !== "Everyday" && sched !== "Ramadan" && sched !== "WhiteDays" && sched !== "Optional" && sched !== "OneTime") {
                    if (dtBox) dtBox.classList.remove("hidden");
                } else {
                    if (dtBox) dtBox.classList.add("hidden");
                }
            }
        }
    } else {
        const otBox = document.getElementById("onetime-date-selector-box");
        const otDateInput = document.getElementById("task-onetime-date-input");
        const defaultDate = (typeof currentDateStr !== "undefined" && currentDateStr) ? currentDateStr : (typeof getLocalTodayString === "function" ? getLocalTodayString() : new Date().toISOString().split("T")[0]);

        if (options.isOneTime) {
            if (title) title.innerHTML = `<i class="fa-solid fa-bolt gold-text"></i> إضافة مهمة لمرة واحدة فقط`;
            const radio = document.querySelector(`input[name="schedule_type"][value="OneTime"]`);
            if (radio) radio.checked = true;
            if (otBox) otBox.classList.remove("hidden");
            if (otDateInput) otDateInput.value = defaultDate;
        } else if (options.isBonus) {
            if (title) title.innerHTML = `<i class="fa-solid fa-gift gold-text"></i> إنشاء ورد إضافي (بونص)`;
            const radio = document.querySelector(`input[name="schedule_type"][value="Everyday"]`);
            if (radio) radio.checked = true;
            if (otBox) otBox.classList.add("hidden");
        } else {
            if (title) title.innerHTML = `<i class="fa-solid fa-plus"></i> إضافة ورد أو مهمة مخصصة`;
            const radio = document.querySelector(`input[name="schedule_type"][value="Everyday"]`);
            if (radio) radio.checked = true;
            if (otBox) otBox.classList.add("hidden");
        }
        
        if (idInput) idInput.value = "";
        if (nameInput) nameInput.value = "";
        if (appData.categories.length > 0 && catInput) {
            catInput.value = appData.categories[0].name;
            updateSubcats(catInput.value, "");
        }
        if (targetInput) targetInput.value = "1";
        if (commentInput) commentInput.value = "";
        if (bonusCheck) bonusCheck.checked = options.isBonus || false;
        if (weekdaysBox) weekdaysBox.classList.add("hidden");

        const dtBox = document.getElementById("day-targets-box");
        const dtCheck = document.getElementById("task-enable-day-targets");
        const dtGrid = document.getElementById("day-targets-inputs-grid");
        if (dtBox) dtBox.classList.add("hidden");
        if (dtCheck) dtCheck.checked = false;
        if (dtGrid) dtGrid.classList.add("hidden");
    }

    modal.classList.remove("hidden");
}

function closeTaskModal() {
    const modal = document.getElementById("task-modal");
    if (modal) modal.classList.add("hidden");
    editingTaskId = null;
}

function saveTaskFromModal() {
    const id = document.getElementById("task-id-input").value || `task_${Date.now()}`;
    const name = document.getElementById("task-name-input").value.trim();
    const cat = document.getElementById("task-category-input").value;
    const subcat = document.getElementById("task-subcategory-input").value;
    const type = autoDetectType(cat, subcat);
    const targetStr = document.getElementById("task-target-input").value;
    const taskComment = document.getElementById("task-comment-input").value.trim();
    const isBonus = document.getElementById("task-is-bonus-input")?.checked || false;

    let schedType = document.querySelector('input[name="schedule_type"]:checked').value;
    let scheduleVal = schedType;
    if (schedType === "Weekdays") {
        const checkedDays = [];
        document.querySelectorAll('#weekdays-selector-box input[type=checkbox]:checked').forEach(c => checkedDays.push(c.value));
        scheduleVal = checkedDays.length > 0 ? checkedDays.join(", ") : "Everyday";
    }

    let dayTargets = null;
    const isDayTargetsEnabled = document.getElementById("task-enable-day-targets")?.checked;
    if (schedType === "Weekdays" && isDayTargetsEnabled) {
        dayTargets = {};
        document.querySelectorAll('.day-target-input').forEach(inp => {
            const d = inp.getAttribute("data-day");
            const v = parseFloat(inp.value);
            if (d && !isNaN(v) && v > 0) {
                dayTargets[d] = v;
            }
        });
        if (Object.keys(dayTargets).length === 0) dayTargets = null;
    }

    const parsedTarget = targetStr === "" ? null : parseFloat(targetStr);
    const localToday = typeof getLocalTodayString === "function" ? getLocalTodayString() : new Date().toISOString().split("T")[0];
    const selectedDate = (typeof currentDateStr !== "undefined" && currentDateStr) ? currentDateStr : localToday;
    const otDateInput = document.getElementById("task-onetime-date-input");
    const chosenOneTimeDate = (schedType === "OneTime" && otDateInput && otDateInput.value) ? otDateInput.value : selectedDate;
    const effectiveDate = (schedType === "OneTime" && chosenOneTimeDate > localToday) ? localToday : ((selectedDate > localToday) ? localToday : selectedDate);

    if (editingTaskId) {
        const idx = appData.tasks.findIndex(t => t.id === editingTaskId);
        if (idx >= 0) {
            const oldTask = appData.tasks[idx];
            const creationDate = oldTask.createdAt || "2000-01-01";
            oldTask.createdAt = creationDate;

            if (!oldTask.history || !Array.isArray(oldTask.history) || oldTask.history.length === 0) {
                oldTask.history = [{
                    effectiveFrom: creationDate,
                    name: oldTask.name,
                    category: oldTask.category,
                    subcategory: oldTask.subcategory,
                    type: oldTask.type,
                    target: oldTask.target,
                    dayTargets: oldTask.dayTargets || null,
                    multiplier: oldTask.multiplier !== undefined ? oldTask.multiplier : 1.0,
                    schedule: oldTask.schedule,
                    isBonus: oldTask.isBonus || false,
                    comment: oldTask.comment || ""
                }];
            }

            if (oldTask.history && Array.isArray(oldTask.history)) {
                oldTask.history.forEach(h => {
                    h.name = name;
                    h.category = cat;
                    h.subcategory = subcat;
                    h.type = type;
                    h.isBonus = isBonus;
                    h.comment = taskComment;
                });
            }

            const snapshot = {
                effectiveFrom: effectiveDate,
                name: name,
                category: cat,
                subcategory: subcat,
                type: type,
                target: parsedTarget,
                dayTargets: dayTargets,
                multiplier: oldTask.multiplier !== undefined ? oldTask.multiplier : 1.0,
                schedule: scheduleVal,
                isBonus: isBonus,
                comment: taskComment,
                isOneTime: (schedType === "OneTime"),
                oneTimeDate: (schedType === "OneTime") ? chosenOneTimeDate : null
            };

            // Remove any snapshot from effectiveDate onwards so stale migration/historical snapshots never override this new edit forward
            oldTask.history = oldTask.history.filter(h => h.effectiveFrom && h.effectiveFrom < effectiveDate);
            oldTask.history.push(snapshot);

            // Ensure baseline history snapshot date is not later than creation date if it's the only one
            if (oldTask.history.length === 1 && oldTask.history[0].effectiveFrom > creationDate) {
                oldTask.history[0].effectiveFrom = creationDate;
            }

            oldTask.name = name;
            oldTask.category = cat;
            oldTask.subcategory = subcat;
            oldTask.type = type;
            oldTask.target = parsedTarget;
            oldTask.dayTargets = dayTargets;
            oldTask.schedule = scheduleVal;
            oldTask.comment = taskComment;
            oldTask.isBonus = isBonus;
            oldTask.isOneTime = (schedType === "OneTime");
            oldTask.oneTimeDate = (schedType === "OneTime") ? chosenOneTimeDate : null;
            if (schedType === "OneTime") {
                if (oldTask.oneTimeDates) delete oldTask.oneTimeDates;
            }
        }
    } else {
        const newTask = {
            id: id,
            name: name,
            category: cat,
            subcategory: subcat,
            type: type,
            target: parsedTarget,
            dayTargets: dayTargets,
            multiplier: 1.0, 
            schedule: scheduleVal,
            isArchived: false,
            comment: taskComment,
            isBonus: isBonus,
            isOneTime: (schedType === "OneTime"),
            oneTimeDate: (schedType === "OneTime") ? chosenOneTimeDate : null,
            createdAt: (schedType === "OneTime") ? chosenOneTimeDate : selectedDate,
            history: [{
                effectiveFrom: (schedType === "OneTime") ? chosenOneTimeDate : selectedDate,
                name: name,
                category: cat,
                subcategory: subcat,
                type: type,
                target: parsedTarget,
                dayTargets: dayTargets,
                multiplier: 1.0,
                schedule: scheduleVal,
                isBonus: isBonus,
                comment: taskComment,
                isOneTime: (schedType === "OneTime"),
                oneTimeDate: (schedType === "OneTime") ? chosenOneTimeDate : null
            }]
        };
        appData.tasks.push(newTask);
    }

    closeTaskModal();
    saveData(true);
    if (typeof renderDailyView === "function") renderDailyView();
    if (typeof renderTaskManager === "function") renderTaskManager();
    if (typeof updateHeaderTodayScore === "function") updateHeaderTodayScore();
    if (typeof renderAllTimeStats === "function") renderAllTimeStats();
    if (typeof updateChartAndAnalytics === "function") updateChartAndAnalytics();
}

function openBonusTaskModal() {
    const modal = document.getElementById("bonus-task-modal");
    const container = document.getElementById("bonus-tasks-picker-list");
    if (!modal || !container) return;

    container.innerHTML = "";

    const log = appData.logs[currentDateStr] || { entries: {}, bonusTaskIds: [] };
    const todayBonusIds = log.bonusTaskIds || [];

    const availableBonusTasks = appData.tasks.filter(t => {
        if (t.isArchived || t.isOneTime) return false;
        if (todayBonusIds.includes(t.id)) return false;
        const isSched = isTaskScheduledForDate(t, currentDateStr, 0);
        return !isSched || t.isBonus;
    });

    if (availableBonusTasks.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 20px 10px;">
                <p style="color: #a0aec0; margin: 0;">جميع الأوراد النشطة مجدولة اليوم بالفعل أو مضافة كـ بونص!</p>
                <button class="btn-primary btn-sm" id="btn-create-new-bonus-task" style="margin-top: 12px; font-size: 0.85rem;"><i class="fa-solid fa-plus"></i> إنشـاء ورد إضافي جديد</button>
            </div>
        `;
        const createBtn = document.getElementById("btn-create-new-bonus-task");
        if (createBtn) {
            createBtn.addEventListener("click", () => {
                closeBonusTaskModal();
                openTaskModal(null, { isBonus: true });
            });
        }
    } else {
        availableBonusTasks.forEach(task => {
            const row = document.createElement("div");
            row.style.cssText = "display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 10px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08);";
            
            const iconHtml = getCategoryIconHtml(task);
            row.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="font-size: 1.2rem; color: #f59e0b;">${iconHtml}</div>
                    <div>
                        <h5 style="margin: 0; color: #f8fafc; font-size: 0.95rem;">${task.name}</h5>
                        <span style="font-size: 0.8rem; color: #94a3b8;">${task.category}${task.subcategory ? ' - ' + task.subcategory : ''} | ${task.type}</span>
                    </div>
                </div>
                <button class="btn-action-pill btn-bonus-pill btn-add-as-bonus" data-task-id="${task.id}">
                    <i class="fa-solid fa-plus"></i> إضافة كـ بونص
                </button>
            `;
            container.appendChild(row);
        });

        container.querySelectorAll(".btn-add-as-bonus").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const tid = e.currentTarget.getAttribute("data-task-id");
                addBonusTaskToDate(tid, currentDateStr);
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
    if (typeof updateDailyScoreSummary === "function") updateDailyScoreSummary();
    if (typeof updateHeaderTodayScore === "function") updateHeaderTodayScore();
}

function syncUnitEstMinsState(unitVal, estInput) {
    if (!estInput) return;
    const u = (unitVal || "").trim().toLowerCase();
    if (u === "ساعة" || u === "ساعات ودقايق" || u === "وقت" || u === "ساعات") {
        estInput.value = "60";
        estInput.disabled = true;
        estInput.title = "محسوب تلقائياً للساعات (60 دقيقة)";
    } else if (u === "دقيقة" || u === "دقائق") {
        estInput.value = "1";
        estInput.disabled = true;
        estInput.title = "محسوب تلقائياً للدقائق (1 دقيقة)";
    } else {
        estInput.disabled = false;
        estInput.title = "";
    }
}

// ============================================================================
// QUICK ADD MODAL (EXISTING BONUS TASK vs NEW TASK)
// ============================================================================
let _qaCurrentFilter = "all";

function openQuickAddModal() {
    const modal = document.getElementById("quick-add-modal");
    if (!modal) return;

    // Reset to step 1
    const step1 = document.getElementById("quick-add-step1");
    const step2 = document.getElementById("quick-add-step2-existing");
    if (step1) step1.style.display = "block";
    if (step2) step2.style.display = "none";

    // Wire step 1 → existing task picker
    const btnExisting = document.getElementById("btn-qa-existing");
    if (btnExisting) {
        const newBtnExisting = btnExisting.cloneNode(true);
        btnExisting.parentNode.replaceChild(newBtnExisting, btnExisting);
        newBtnExisting.addEventListener("click", () => {
            if (step1) step1.style.display = "none";
            if (step2) step2.style.display = "block";
            populateQuickAddExistingList();
        });
    }

    // Wire step 1 → new task dialog (opens create task dialog immediately)
    const btnNew = document.getElementById("btn-qa-new");
    if (btnNew) {
        const newBtnNew = btnNew.cloneNode(true);
        btnNew.parentNode.replaceChild(newBtnNew, btnNew);
        newBtnNew.addEventListener("click", () => {
            modal.classList.add("hidden");
            openTaskModal(null);
        });
    }

    // Wire back button
    const backBtn = document.getElementById("btn-qa-back-from-existing");
    if (backBtn) {
        const newBackBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBackBtn, backBtn);
        newBackBtn.addEventListener("click", () => {
            if (step2) step2.style.display = "none";
            if (step1) step1.style.display = "block";
        });
    }

    // Wire close button
    const closeBtn = document.getElementById("btn-close-quick-add-modal");
    if (closeBtn) {
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.addEventListener("click", () => {
            modal.classList.add("hidden");
        });
    }

    modal.classList.remove("hidden");
}

function populateQuickAddExistingList() {
    const list = document.getElementById("quick-add-existing-list");
    const searchInput = document.getElementById("quick-add-search-input");
    if (!list) return;

    if (searchInput) searchInput.value = "";
    _qaCurrentFilter = "all";

    // Setup filter chips
    const filterChips = document.querySelectorAll("#quick-add-filter-chips .qa-chip");
    filterChips.forEach(chip => {
        chip.classList.toggle("active", chip.getAttribute("data-filter") === "all");
        const cloned = chip.cloneNode(true);
        chip.parentNode.replaceChild(cloned, chip);
        cloned.addEventListener("click", () => {
            document.querySelectorAll("#quick-add-filter-chips .qa-chip").forEach(c => c.classList.remove("active"));
            cloned.classList.add("active");
            _qaCurrentFilter = cloned.getAttribute("data-filter") || "all";
            renderList();
        });
    });

    // Setup search input
    if (searchInput) {
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);
        newSearchInput.addEventListener("input", () => {
            renderList();
        });
        setTimeout(() => newSearchInput.focus(), 50);
    }

    function renderList() {
        const curDate = typeof currentDateStr !== "undefined" ? currentDateStr : getLocalTodayString();
        const log = (appData.logs && appData.logs[curDate]) || { entries: {}, bonusTaskIds: [] };
        const todayBonusIds = Array.isArray(log.bonusTaskIds) ? log.bonusTaskIds : [];
        const term = (document.getElementById("quick-add-search-input")?.value || "").trim().toLowerCase();

        list.innerHTML = "";

        const allTasks = appData.tasks || [];
        const filtered = allTasks.filter(task => {
            const isArchived = !!task.isArchived;
            const isOneTime = !isArchived && (task.isOneTime || task.schedule === "OneTime");
            const isScheduled = !isArchived && !isOneTime;

            if (_qaCurrentFilter === "archived" && !isArchived) return false;
            if (_qaCurrentFilter === "onetime" && !isOneTime) return false;
            if (_qaCurrentFilter === "scheduled" && !isScheduled) return false;

            if (term) {
                const nameMatch = (task.name || "").toLowerCase().includes(term);
                const catMatch = (task.category || "").toLowerCase().includes(term);
                const subMatch = (task.subcategory || "").toLowerCase().includes(term);
                if (!nameMatch && !catMatch && !subMatch) return false;
            }
            return true;
        });

        if (filtered.length === 0) {
            list.innerHTML = `<div style="text-align:center; padding:24px 0; color:#94a3b8; font-size:0.88rem;"><i class="fa-solid fa-magnifying-glass" style="margin-left:6px; opacity:0.6;"></i> لا توجد مهام مطابقة</div>`;
            return;
        }

        filtered.forEach(task => {
            const isArchived = !!task.isArchived;
            const isOneTime = !isArchived && (task.isOneTime || task.schedule === "OneTime");

            let typeBadgeHtml = `<span style="font-size:0.72rem; padding:2px 8px; border-radius:10px; background:rgba(16,185,129,0.15); color:#34d399; border:1px solid rgba(16,185,129,0.3);">مجدول</span>`;
            if (isArchived) {
                typeBadgeHtml = `<span style="font-size:0.72rem; padding:2px 8px; border-radius:10px; background:rgba(239,68,68,0.15); color:#f87171; border:1px solid rgba(239,68,68,0.3);">مؤرشف</span>`;
            } else if (isOneTime) {
                typeBadgeHtml = `<span style="font-size:0.72rem; padding:2px 8px; border-radius:10px; background:rgba(59,130,246,0.15); color:#60a5fa; border:1px solid rgba(59,130,246,0.3);">مرة واحدة</span>`;
            }

            const isAlreadyBonus = todayBonusIds.includes(task.id);
            const iconHtml = typeof getCategoryIconHtml === "function" ? getCategoryIconHtml(task) : '<i class="fa-solid fa-list-check"></i>';
            const catInfo = `${task.category || 'عام'}${task.subcategory ? ' - ' + task.subcategory : ''}`;

            const row = document.createElement("div");
            row.style.cssText = `display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background:rgba(255,255,255,0.04); border-radius:10px; border:1px solid rgba(255,255,255,0.08); transition:all 0.2s ease; ${isAlreadyBonus ? 'opacity:0.6;' : ''}`;

            row.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">
                    <div style="font-size:1.15rem; color:#f59e0b; width:26px; text-align:center; flex-shrink:0;">${iconHtml}</div>
                    <div style="min-width:0; overflow:hidden;">
                        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                            <span style="font-size:0.92rem; font-weight:600; color:#f8fafc; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${task.name}</span>
                            ${typeBadgeHtml}
                        </div>
                        <span style="font-size:0.75rem; color:#94a3b8;">${catInfo}</span>
                    </div>
                </div>
                <div style="flex-shrink:0; margin-right:8px;">
                    ${isAlreadyBonus 
                        ? `<button class="btn-sm" disabled style="background:rgba(16,185,129,0.12); color:#10b981; border:1px solid rgba(16,185,129,0.25); font-size:0.78rem; padding:5px 10px; border-radius:8px; cursor:default;"><i class="fa-solid fa-check"></i> مضاف كـ بونص</button>`
                        : `<button class="btn-primary btn-sm btn-qa-pick" data-task-id="${task.id}" style="font-size:0.78rem; padding:5px 12px; border-radius:8px;"><i class="fa-solid fa-plus"></i> إضافة كـ بونص</button>`
                    }
                </div>
            `;

            list.appendChild(row);
        });

        list.querySelectorAll(".btn-qa-pick").forEach(btn => {
            btn.addEventListener("click", () => {
                const taskId = btn.getAttribute("data-task-id");
                addBonusTaskToDate(taskId, curDate);
                const modal = document.getElementById("quick-add-modal");
                if (modal) modal.classList.add("hidden");
            });
        });
    }

    renderList();
}

