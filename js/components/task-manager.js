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
                document.getElementById("manager-active-section").classList.add("active");
                btnAddTask.style.display = "flex";
                btnAddCat.style.display = "none";
            } else if (sec === "archived-tasks") {
                document.getElementById("manager-archived-section").classList.add("active");
                btnAddTask.style.display = "flex";
                btnAddCat.style.display = "none";
            } else if (sec === "categories") {
                document.getElementById("manager-categories-section").classList.add("active");
                btnAddTask.style.display = "none";
                btnAddCat.style.display = "flex";
                renderCategoriesManager();
            }
        });
    });

    // Add task modal
    const openAddBtn = document.getElementById("btn-open-add-task-modal");
    if (openAddBtn) openAddBtn.addEventListener("click", () => openTaskModal(null));
    
    const closeBtn = document.getElementById("btn-close-modal");
    if (closeBtn) closeBtn.addEventListener("click", closeTaskModal);
    
    const cancelBtn = document.getElementById("btn-cancel-modal");
    if (cancelBtn) cancelBtn.addEventListener("click", closeTaskModal);
    
    document.querySelectorAll('input[name="schedule_type"]').forEach(radio => {
        radio.addEventListener("change", (e) => {
            const box = document.getElementById("weekdays-selector-box");
            const dtBox = document.getElementById("day-targets-box");
            if (box) {
                if (e.target.value === "Weekdays") {
                    box.classList.remove("hidden");
                    if (dtBox) dtBox.classList.remove("hidden");
                } else {
                    box.classList.add("hidden");
                    if (dtBox) dtBox.classList.add("hidden");
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

function renderGroupedTasks(containerEl, tasksList, isArchivedList = false) {
    containerEl.innerHTML = "";
    if (!tasksList || tasksList.length === 0) {
        if (!isArchivedList) {
            containerEl.innerHTML = `<div class="empty-state"><h3>لا توجد أوراد نشطة حالياً</h3></div>`;
        } else {
            containerEl.innerHTML = `<div class="empty-state"><i class="fa-solid fa-box-open icon-lg gold-text"></i><h3>قائمة الأرشيف فارغة</h3><p>عند الانتهاء الدائم من مهمة معينة، اضغط على زر "إتمام وأرشفة" لتخليد إنجازها وتخفيف جدولك.</p></div>`;
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

    const schedDisplay = formatScheduleDisplay(task.schedule);
    const schedText = `📅 التكرار: ${schedDisplay}`;
    let displayType = isPrayerSelector(task) ? 'صلاة فريضة' : task.type;
    const targetText = task.target ? `🎯 الهدف: ${task.target} ${displayType}` : `🏷️ وحدة: ${displayType}`;
    const multText = task.multiplier !== undefined && task.multiplier !== 1 ? `⚡ معامل النقاط: ${task.multiplier * 100}%` : '';

    const catBadgeText = task.subcategory ? `${task.category} - ${task.subcategory}` : (task.category || 'عام');

    if (!isArchived) {
        row.innerHTML = `
            <div class="manager-info">
                <div class="manager-icon">${iconHtml}</div>
                <div class="manager-details">
                    <h4>${task.name} <span class="tag-badge" style="font-size:0.75rem">${catBadgeText}</span></h4>
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
                    <h4>${task.name} <span class="tag-badge" style="font-size:0.75rem">${catBadgeText}</span> <span class="badge badge-amber" style="font-size:0.75rem">✨ مؤرشف</span></h4>
                    <p>
                        <span>${targetText}</span>
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
    const archivedList = document.getElementById("manager-archived-list");
    if (!activeList || !archivedList) return;

    const activeTasks = appData.tasks.filter(t => !t.isArchived && !t.isOneTime && t.schedule !== "OneTime");
    const archivedTasks = appData.tasks.filter(t => t.isArchived);

    const activeCount = renderGroupedTasks(activeList, activeTasks, false);
    const archivedCount = renderGroupedTasks(archivedList, archivedTasks, true);

    const elActive = document.getElementById("count-active-tasks");
    const elArchived = document.getElementById("count-archived-tasks");
    const elCats = document.getElementById("count-categories");

    if (elActive) elActive.textContent = activeCount;
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
            t.isOneTime = false;
            if (t.schedule === "OneTime" && !t.oneTimeDate) {
                t.schedule = "Everyday";
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

            const sched = task.schedule || "Everyday";
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
        if (options.isOneTime) {
            if (title) title.innerHTML = `<i class="fa-solid fa-bolt gold-text"></i> إضافة مهمة لمرة واحدة فقط (${currentDateStr})`;
            const radio = document.querySelector(`input[name="schedule_type"][value="OneTime"]`);
            if (radio) radio.checked = true;
        } else if (options.isBonus) {
            if (title) title.innerHTML = `<i class="fa-solid fa-gift gold-text"></i> إنشاء ورد إضافي (بونص)`;
            const radio = document.querySelector(`input[name="schedule_type"][value="Everyday"]`);
            if (radio) radio.checked = true;
        } else {
            if (title) title.innerHTML = `<i class="fa-solid fa-plus"></i> إضافة ورد أو مهمة مخصصة`;
            const radio = document.querySelector(`input[name="schedule_type"][value="Everyday"]`);
            if (radio) radio.checked = true;
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
    const effectiveDate = (selectedDate > localToday) ? localToday : selectedDate;

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
                oneTimeDate: (schedType === "OneTime") ? selectedDate : null
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
            oldTask.oneTimeDate = (schedType === "OneTime") ? selectedDate : null;
            if (schedType === "OneTime") {
                if (!Array.isArray(oldTask.oneTimeDates)) {
                    oldTask.oneTimeDates = oldTask.oneTimeDate ? [oldTask.oneTimeDate] : [];
                }
                if (!oldTask.oneTimeDates.includes(selectedDate)) {
                    oldTask.oneTimeDates.push(selectedDate);
                }
            }
        }
    } else {
        // If creating a OneTime task, check if a one-time task with the same name and category already exists to reuse it!
        let existingOnetimeTask = null;
        if (schedType === "OneTime" && Array.isArray(appData.tasks)) {
            existingOnetimeTask = appData.tasks.find(t => 
                (t.isOneTime || t.schedule === "OneTime") && 
                !t.isArchived && 
                t.name.trim().toLowerCase() === name.toLowerCase() &&
                t.category === cat
            );
        }

        if (existingOnetimeTask) {
            // Reuse existing one-time task instead of creating a duplicate!
            if (!Array.isArray(existingOnetimeTask.oneTimeDates)) {
                existingOnetimeTask.oneTimeDates = existingOnetimeTask.oneTimeDate ? [existingOnetimeTask.oneTimeDate] : [];
            }
            if (!existingOnetimeTask.oneTimeDates.includes(selectedDate)) {
                existingOnetimeTask.oneTimeDates.push(selectedDate);
            }
            existingOnetimeTask.oneTimeDate = selectedDate;
            if (parsedTarget !== null) existingOnetimeTask.target = parsedTarget;
            if (taskComment) existingOnetimeTask.comment = taskComment;
            if (subcat) existingOnetimeTask.subcategory = subcat;
            if (type) existingOnetimeTask.type = type;
            if (typeof ScheduleEngine !== "undefined" && typeof ScheduleEngine.invalidateTaskCache === "function") {
                ScheduleEngine.invalidateTaskCache(existingOnetimeTask);
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
                oneTimeDate: (schedType === "OneTime") ? selectedDate : null,
                oneTimeDates: (schedType === "OneTime") ? [selectedDate] : null,
                createdAt: selectedDate,
                history: [{
                    effectiveFrom: selectedDate,
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
                    oneTimeDate: (schedType === "OneTime") ? selectedDate : null,
                    oneTimeDates: (schedType === "OneTime") ? [selectedDate] : null
                }]
            };
            appData.tasks.push(newTask);
        }
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
    saveData();
    renderDailyView();
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
// QUICK ADD 2-STEP MODAL
// ============================================================================
function openQuickAddModal() {
    const modal = document.getElementById("quick-add-modal");
    if (!modal) return;

    // Reset to step 1
    document.getElementById("quick-add-step1").style.display = "block";
    document.getElementById("quick-add-step2-existing").style.display = "none";
    document.getElementById("quick-add-step2-new").style.display = "none";

    // Wire step 1 → existing
    const btnExisting = document.getElementById("btn-qa-existing");
    const newBtnExisting = btnExisting.cloneNode(true);
    btnExisting.parentNode.replaceChild(newBtnExisting, btnExisting);
    newBtnExisting.addEventListener("click", () => {
        document.getElementById("quick-add-step1").style.display = "none";
        const step2 = document.getElementById("quick-add-step2-existing");
        step2.style.display = "block";
        populateQuickAddExistingList();
    });

    // Wire step 1 → new
    const btnNew = document.getElementById("btn-qa-new");
    const newBtnNew = btnNew.cloneNode(true);
    btnNew.parentNode.replaceChild(newBtnNew, btnNew);
    newBtnNew.addEventListener("click", () => {
        document.getElementById("quick-add-step1").style.display = "none";
        document.getElementById("quick-add-step2-new").style.display = "block";
    });

    // Wire back buttons
    document.getElementById("btn-qa-back-from-existing")?.addEventListener("click", () => {
        document.getElementById("quick-add-step2-existing").style.display = "none";
        document.getElementById("quick-add-step1").style.display = "block";
    });
    document.getElementById("btn-qa-back-from-new")?.addEventListener("click", () => {
        document.getElementById("quick-add-step2-new").style.display = "none";
        document.getElementById("quick-add-step1").style.display = "block";
    });

    // Wire new task type buttons
    document.getElementById("btn-qa-new-regular")?.addEventListener("click", () => {
        modal.classList.add("hidden");
        openTaskModal(null, {});
    });
    document.getElementById("btn-qa-new-bonus")?.addEventListener("click", () => {
        modal.classList.add("hidden");
        openTaskModal(null, { isBonus: true });
    });
    document.getElementById("btn-qa-new-onetime")?.addEventListener("click", () => {
        modal.classList.add("hidden");
        openTaskModal(null, { isOneTime: true });
    });

    // Wire close button
    document.getElementById("btn-close-quick-add-modal")?.addEventListener("click", () => {
        modal.classList.add("hidden");
    });

    modal.classList.remove("hidden");
}

// State: which type is selected in the existing flow
let _qaSelectedType = "bonus";

function populateQuickAddExistingList() {
    _qaSelectedType = "bonus";

    // Highlight the default selected type
    document.querySelectorAll(".qa-type-btn").forEach(btn => {
        btn.style.background = btn.getAttribute("data-type") === _qaSelectedType
            ? "rgba(245,158,11,0.12)" : "";
        btn.style.borderColor = btn.getAttribute("data-type") === _qaSelectedType
            ? "rgba(245,158,11,0.5)" : "";
    });

    document.querySelectorAll(".qa-type-btn").forEach(btn => {
        const cloned = btn.cloneNode(true);
        btn.parentNode.replaceChild(cloned, btn);
        cloned.addEventListener("click", () => {
            _qaSelectedType = cloned.getAttribute("data-type");
            document.querySelectorAll(".qa-type-btn").forEach(b => {
                b.style.background = "";
                b.style.borderColor = "";
            });
            cloned.style.background = "rgba(245,158,11,0.12)";
            cloned.style.borderColor = "rgba(245,158,11,0.5)";
        });
    });

    const list = document.getElementById("quick-add-existing-list");
    if (!list) return;
    list.innerHTML = "";

    const curDate = typeof currentDateStr !== "undefined" ? currentDateStr : getLocalTodayString();
    const available = (appData.tasks || []).filter(t => {
        if (t.isArchived) return false;
        const isSched = (typeof ScheduleEngine !== "undefined")
            ? ScheduleEngine.isTaskScheduledForDate(t, curDate, appData)
            : false;
        return !isSched || t.isBonus;
    });

    if (available.length === 0) {
        list.innerHTML = `<p style="font-size:0.85rem; color:#64748b; text-align:center; padding:14px 0;">جميع أوردادك ومهامك النشطة مجدولة اليوم بالفعل.</p>`;
        return;
    }

    available.forEach(task => {
        const isOt = task.isOneTime || task.schedule === "OneTime";
        const tagText = isOt ? " (لمرة واحدة)" : (task.isBonus ? " (بونص)" : "");
        const row = document.createElement("div");
        row.style.cssText = "display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background:rgba(255,255,255,0.04); border-radius:10px; border:1px solid rgba(255,255,255,0.07);";
        row.innerHTML = `
            <span style="font-size:0.92rem;">${task.name}<span style="font-size:0.75rem; color:#f59e0b;">${tagText}</span> <span style="font-size:0.75rem; color:#64748b;">${task.category || ""}</span></span>
            <button class="btn-primary btn-sm" style="font-size:0.78rem; padding:5px 12px;" data-add-task-id="${task.id}"><i class="fa-solid fa-plus"></i> إضافة</button>
        `;
        list.appendChild(row);
    });

    list.querySelectorAll("[data-add-task-id]").forEach(btn => {
        btn.addEventListener("click", () => {
            const taskId = btn.getAttribute("data-add-task-id");
            const modal = document.getElementById("quick-add-modal");
            if (modal) modal.classList.add("hidden");

            const log = appData.logs[curDate] || { entries: {}, bonusTaskIds: [] };
            if (!log.bonusTaskIds) log.bonusTaskIds = [];
            appData.logs[curDate] = log;

            if (_qaSelectedType === "bonus") {
                if (!log.bonusTaskIds.includes(taskId)) log.bonusTaskIds.push(taskId);
                if (typeof saveData === "function") saveData();
                if (typeof renderDailyView === "function") renderDailyView();
            } else if (_qaSelectedType === "onetime") {
                const targetTask = appData.tasks.find(t => t.id === taskId);
                if (targetTask) {
                    if (targetTask.isOneTime || targetTask.schedule === "OneTime") {
                        // Already a one-time task: reuse it and add today to its dates!
                        if (!Array.isArray(targetTask.oneTimeDates)) {
                            targetTask.oneTimeDates = targetTask.oneTimeDate ? [targetTask.oneTimeDate] : [];
                        }
                        if (!targetTask.oneTimeDates.includes(curDate)) {
                            targetTask.oneTimeDates.push(curDate);
                        }
                        targetTask.oneTimeDate = curDate;
                        if (typeof ScheduleEngine !== "undefined" && typeof ScheduleEngine.invalidateTaskCache === "function") {
                            ScheduleEngine.invalidateTaskCache(targetTask);
                        }
                    } else {
                        // Check if a one-time counterpart already exists for this task name & category
                        let existingOt = appData.tasks.find(t => 
                            (t.isOneTime || t.schedule === "OneTime") && 
                            !t.isArchived && 
                            t.name.trim().toLowerCase() === targetTask.name.trim().toLowerCase() && 
                            t.category === targetTask.category
                        );
                        if (existingOt) {
                            if (!Array.isArray(existingOt.oneTimeDates)) {
                                existingOt.oneTimeDates = existingOt.oneTimeDate ? [existingOt.oneTimeDate] : [];
                            }
                            if (!existingOt.oneTimeDates.includes(curDate)) {
                                existingOt.oneTimeDates.push(curDate);
                            }
                            existingOt.oneTimeDate = curDate;
                            if (typeof ScheduleEngine !== "undefined" && typeof ScheduleEngine.invalidateTaskCache === "function") {
                                ScheduleEngine.invalidateTaskCache(existingOt);
                            }
                        } else {
                            // Create one-time task record once
                            const newOt = {
                                ...JSON.parse(JSON.stringify(targetTask)),
                                id: `task_ot_${Date.now()}`,
                                isOneTime: true,
                                schedule: "OneTime",
                                oneTimeDate: curDate,
                                oneTimeDates: [curDate],
                                isBonus: false
                            };
                            appData.tasks.push(newOt);
                        }
                    }
                    if (typeof saveData === "function") saveData();
                    if (typeof renderDailyView === "function") renderDailyView();
                }
            }
        });
    });
}

