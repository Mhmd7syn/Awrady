/**
 * Task create/edit modal
 */

function autoDetectType(catName, subcatName) {
    const c = appData.categories.find(x => x.name === catName);
    if (c) {
        if (subcatName) {
            const sub = (c.subcategories || []).find(s => s.name === subcatName);
            if (sub && sub.defaultUnit) return sub.defaultUnit;
            if (catName === "صلاة" && subcatName === "فرض") return "صلاة";
        }
        if (c.defaultUnit) return c.defaultUnit;
    }
    return "مهمة";
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

            const isOt = task.schedule === "OneTime";
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

            const otBox = document.getElementById("onetime-date-selector-box");
            const otDateInput = document.getElementById("task-onetime-date-input");
            if (isOt) {
                if (otBox) otBox.classList.remove("hidden");
                if (otDateInput) {
                    otDateInput.value = (task.createdAt || "").slice(0, 10) || (currentDateStr);
                }
            } else {
                if (otBox) otBox.classList.add("hidden");
            }
        }
    } else {
        const otBox = document.getElementById("onetime-date-selector-box");
        const otDateInput = document.getElementById("task-onetime-date-input");
        const defaultDate = currentDateStr;

        if (options.isOneTime) {
            if (title) title.innerHTML = `<i class="fa-solid fa-bolt gold-text"></i> إضافة مهمة لمرة واحدة فقط`;
            const radio = document.querySelector(`input[name="schedule_type"][value="OneTime"]`);
            if (radio) radio.checked = true;
            if (otBox) otBox.classList.remove("hidden");
            if (otDateInput) otDateInput.value = defaultDate;
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
        if (weekdaysBox) weekdaysBox.classList.add("hidden");
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
    const subcat = document.getElementById("task-subcategory-input").value || null;
    const targetStr = document.getElementById("task-target-input").value;

    let schedType = document.querySelector('input[name="schedule_type"]:checked').value;
    let scheduleVal = schedType;
    if (schedType === "Weekdays") {
        const checkedDays = [];
        document.querySelectorAll('#weekdays-selector-box input[type=checkbox]:checked').forEach(c => checkedDays.push(c.value));
        scheduleVal = checkedDays.length > 0 ? checkedDays.join(", ") : "Everyday";
    }

    const parsedTarget = targetStr === "" ? 1 : Math.max(0.5, parseFloat(targetStr) || 1);
    const selectedDate = currentDateStr;
    const otDateInput = document.getElementById("task-onetime-date-input");
    const chosenOneTimeDate = (schedType === "OneTime" && otDateInput?.value) ? otDateInput.value : selectedDate;

    let savedTask = null;
    if (editingTaskId) {
        const idx = appData.tasks.findIndex(t => t.id === editingTaskId);
        if (idx >= 0) {
            const oldTask = appData.tasks[idx];
            oldTask.name = name;
            oldTask.category = cat;
            oldTask.subcategory = subcat;
            oldTask.target = parsedTarget;
            oldTask.schedule = scheduleVal;
            if (schedType === "OneTime") {
                oldTask.createdAt = chosenOneTimeDate;
            }
            savedTask = oldTask;
        }
    } else {
        const newTask = {
            id: id,
            name: name,
            category: cat,
            subcategory: subcat,
            target: parsedTarget,
            schedule: scheduleVal,
            isArchived: false,
            createdAt: (schedType === "OneTime") ? chosenOneTimeDate : selectedDate
        };
        appData.tasks.push(newTask);
        savedTask = newTask;
    }

    closeTaskModal();
    saveData(true);
    if (window.awradyAPI?.client && savedTask) {
        window.awradyAPI.saveTask(savedTask).catch(e => console.warn("[AwradyAPI] saveTask:", e.message));
    }
    renderDailyView();
    renderTaskManager();
    updateHeaderTodayScore();
    renderAllTimeStats();
    updateChartAndAnalytics();
}
