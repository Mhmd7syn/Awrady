/**
 * Awrady Dashboard - Task Create/Edit Modal Component
 * Supports editing task details, base target, schedule choices (Daily, OneTime, WhiteDays, Ramadan),
 * and per-day target configuration via the dailyTargets dictionary for Daily schedule.
 */

import { APP_CONSTANTS } from '../config/constants.js';
import { getTaskNormalizedTarget, getTaskUnit } from '../core/task-rules.js';
import { ScoringEngine } from '../core/scoring-engine.js';
import { AppState } from '../core/state.js';
import { saveData } from '../core/store.js';
import { awradyAPI } from '../api.js';
import { showToast } from './toast.js';

let editingTaskId = null;
let _taskModalListenersBound = false;

const TASK_MODAL_WEEKDAYS = [
    { key: "Sat", ar: "السبت" },
    { key: "Sun", ar: "الأحد" },
    { key: "Mon", ar: "الإثنين" },
    { key: "Tue", ar: "الثلاثاء" },
    { key: "Wed", ar: "الأربعاء" },
    { key: "Thu", ar: "الخميس" },
    { key: "Fri", ar: "الجمعة" }
];

/**
 * Updates the active days counter badge and Check-All checkbox state
 */
export function updateDailyTargetsUIState() {
    const chks = Array.from(document.querySelectorAll("#daily-targets-list .chk-day-active"));
    const activeCount = chks.filter(c => c.checked).length;
    const chkAll = document.getElementById("chk-daily-targets-all");
    const badge = document.getElementById("daily-targets-active-badge");

    if (badge) {
        badge.textContent = `${activeCount} / 7 أيام نشطة`;
        badge.style.background = activeCount > 0 ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)";
        badge.style.color = activeCount > 0 ? "#34d399" : "#f87171";
        badge.style.borderColor = activeCount > 0 ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)";
    }

    if (chkAll) {
        if (activeCount === 7) {
            chkAll.checked = true;
            chkAll.indeterminate = false;
        } else if (activeCount === 0) {
            chkAll.checked = false;
            chkAll.indeterminate = false;
        } else {
            chkAll.checked = false;
            chkAll.indeterminate = true;
        }
    }
}

/**
 * Updates task edit modal UI elements according to the chosen schedule type
 * @param {string} schedType ("Everyday", "Daily", "WhiteDays", "Ramadan", "OneTime")
 */
export function updateTaskModalScheduleUI(schedType) {
    const dailyBox = document.getElementById("daily-targets-box");
    const otBox = document.getElementById("onetime-date-selector-box");
    const targetGroup = document.getElementById("task-target-group");
    const isDaily = (schedType === "Everyday" || schedType === "Daily" || !schedType);

    if (isDaily) {
        // Daily: Show per-day vertical collapsible targets; hide scalar target input
        if (dailyBox) dailyBox.classList.remove("hidden");
        if (targetGroup) targetGroup.classList.add("hidden");
        if (otBox) otBox.classList.add("hidden");
        updateDailyTargetsUIState();
    } else {
        // Non-Daily (WhiteDays, Ramadan, OneTime): Hide daily targets; show scalar target input
        if (dailyBox) dailyBox.classList.add("hidden");
        if (targetGroup) targetGroup.classList.remove("hidden");

        if (schedType === "OneTime") {
            if (otBox) otBox.classList.remove("hidden");
            const otDateInput = document.getElementById("task-onetime-date-input");
            if (otDateInput && !otDateInput.value) {
                otDateInput.value = AppState.getCurrentDate() || new Date().toISOString().slice(0, 10);
            }
        } else {
            if (otBox) otBox.classList.add("hidden");
        }
    }
}

/**
 * Updates the unit display across the task modal inputs, badges, and daily targets list
 */
export function updateTaskModalUnitDisplay() {
    const catInput = document.getElementById("task-category-input");
    const subcatInput = document.getElementById("task-subcategory-input");
    const unitText = document.getElementById("task-unit-text");
    const unitInput = document.getElementById("task-unit-input");
    const targetUnitInline = document.getElementById("task-target-unit-inline");
    const dailyUnitText = document.getElementById("daily-targets-unit-text");

    const category = catInput?.value || "";
    const subcategory = subcatInput?.value || "";

    const appData = AppState.getAppData();
    const editingTask = editingTaskId ? (appData?.tasks || []).find(t => t.id === editingTaskId) : null;

    let unit = "";
    if (editingTask && editingTask.category === category && (editingTask.subcategory || "") === subcategory && editingTask.type) {
        unit = editingTask.type;
    } else {
        unit = getTaskUnit({ category, subcategory }) || "مرة";
    }

    if (unitText) {
        unitText.textContent = unit;
    }

    if (unitInput) {
        unitInput.value = unit;
    }

    if (targetUnitInline) {
        targetUnitInline.textContent = `(${unit})`;
    }

    if (dailyUnitText) {
        dailyUnitText.textContent = unit;
    }

    document.querySelectorAll(".daily-target-row-unit").forEach(el => {
        el.textContent = unit;
    });

    const targetInput = document.getElementById("task-target-input");
    if (targetInput) {
        targetInput.placeholder = `الهدف (${unit})`;
    }
}

/**
 * Binds dynamic interactive events for task modal inputs
 */
function setupTaskModalDynamicEvents() {
    if (_taskModalListenersBound) return;
    _taskModalListenersBound = true;

    // Collapsible header toggle
    const toggleBtn = document.getElementById("btn-toggle-daily-targets");
    if (toggleBtn) {
        toggleBtn.addEventListener("click", (e) => {
            if (e.target.closest(".daily-targets-header-actions")) return;
            const box = document.getElementById("daily-targets-box");
            if (box) box.classList.toggle("collapsed");
        });
    }

    // Check-All checkbox toggle
    const chkAll = document.getElementById("chk-daily-targets-all");
    if (chkAll) {
        chkAll.addEventListener("change", (e) => {
            const isChecked = e.target.checked;
            document.querySelectorAll("#daily-targets-list .daily-target-row").forEach(row => {
                const chk = row.querySelector(".chk-day-active");
                const inp = row.querySelector(".input-day-target");
                if (chk) chk.checked = isChecked;
                if (inp) {
                    inp.disabled = !isChecked;
                    if (isChecked && (!inp.value || Number(inp.value) === 0)) {
                        inp.value = 1;
                    }
                }
                row.classList.toggle("disabled", !isChecked);
            });
            updateDailyTargetsUIState();
        });
    }

    // Checkbox toggling per day in daily targets list
    document.querySelectorAll("#daily-targets-list .chk-day-active").forEach(chk => {
        chk.addEventListener("change", (e) => {
            const row = e.target.closest(".daily-target-row");
            const inp = row?.querySelector(".input-day-target");
            if (inp && row) {
                inp.disabled = !e.target.checked;
                row.classList.toggle("disabled", !e.target.checked);
                if (e.target.checked && (!inp.value || Number(inp.value) === 0)) {
                    inp.value = 1;
                }
            }
            updateDailyTargetsUIState();
        });
    });

    // Auto-check day when positive value entered in day target input
    document.querySelectorAll("#daily-targets-list .input-day-target").forEach(inp => {
        inp.addEventListener("input", (e) => {
            const row = e.target.closest(".daily-target-row");
            const chk = row?.querySelector(".chk-day-active");
            const val = parseFloat(e.target.value);
            if (chk && row && !isNaN(val) && val > 0 && !chk.checked) {
                chk.checked = true;
                inp.disabled = false;
                row.classList.remove("disabled");
                updateDailyTargetsUIState();
            }
        });
    });
}

/**
 * Opens task modal to add or edit a task
 * @param {string|null} id Task ID to edit, or null to create
 * @param {Object} options Configuration flags (e.g. { isOneTime: true })
 */
export function openTaskModal(id, options = {}) {
    editingTaskId = id;
    const modal = document.getElementById("task-modal");
    const title = document.getElementById("modal-task-title");
    const idInput = document.getElementById("task-id-input");
    const nameInput = document.getElementById("task-name-input");
    const catInput = document.getElementById("task-category-input");
    const subcatInput = document.getElementById("task-subcategory-input");
    const targetInput = document.getElementById("task-target-input");

    if (!modal) return;
    setupTaskModalDynamicEvents();

    const appData = AppState.getAppData();
    const currentDateStr = AppState.getCurrentDate();

    const allCats = (appData.categories && appData.categories.length > 0) ? appData.categories : (APP_CONSTANTS.CATEGORIES || []);

    function updateSubcats(categoryName, selectedSubcat = "") {
        if (!subcatInput) return;
        const c = allCats.find(x => x.name === categoryName);
        const defaultCatUnit = c?.defaultUnit ? ` (${c.defaultUnit})` : "";
        subcatInput.innerHTML = `<option value="">-- لا يوجد${defaultCatUnit} --</option>`;
        if (c && c.subcategories) {
            c.subcategories.forEach(sub => {
                const opt = document.createElement("option");
                opt.value = sub.name;
                const subUnit = sub.defaultUnit || c?.defaultUnit;
                opt.textContent = subUnit ? `${sub.name} (${subUnit})` : sub.name;
                subcatInput.appendChild(opt);
            });
        }
        subcatInput.value = selectedSubcat;
        updateTaskModalUnitDisplay();
    }
    
    if (catInput) {
        catInput.onchange = () => {
            updateSubcats(catInput.value);
            updateTaskModalUnitDisplay();
        };

        catInput.innerHTML = "";
        allCats.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.name;
            const unitSuffix = c.defaultUnit ? ` (${c.defaultUnit})` : "";
            opt.textContent = `${c.label || c.name}${unitSuffix}`;
            catInput.appendChild(opt);
        });
    }

    if (subcatInput) {
        subcatInput.onchange = () => {
            updateTaskModalUnitDisplay();
        };
    }

    if (id) {
        const task = (appData.tasks || []).find(t => t.id === id);
        if (task) {
            if (title) title.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> تعديل (${task.name})`;
            if (idInput) idInput.value = task.id;
            if (nameInput) nameInput.value = task.name;
            if (catInput) catInput.value = task.category || (allCats[0]?.name || "عام");
            updateSubcats(catInput?.value, task.subcategory || "");
            if (targetInput) targetInput.value = (task.target !== null && task.target !== undefined) ? task.target : 1;

            const sched = (task.schedule || "Everyday").trim();
            let schedType = "Everyday";

            if (sched === "WhiteDays") {
                schedType = "WhiteDays";
            } else if (sched === "Ramadan") {
                schedType = "Ramadan";
            } else if (sched === "OneTime") {
                schedType = "OneTime";
            } else {
                schedType = "Everyday";
            }

            const radio = document.querySelector(`input[name="schedule_type"][value="${schedType}"]`);
            if (radio) radio.checked = true;

            // Ensure daily targets section starts expanded
            const dailyBox = document.getElementById("daily-targets-box");
            if (dailyBox) dailyBox.classList.remove("collapsed");

            // Populate per-day targets vertical list
            TASK_MODAL_WEEKDAYS.forEach(d => {
                const row = document.querySelector(`.daily-target-row[data-day="${d.key}"]`);
                const chk = row?.querySelector(".chk-day-active");
                const inp = row?.querySelector(".input-day-target");
                if (!chk || !inp || !row) return;

                if (schedType === "Everyday") {
                    let isDayActive = true;
                    let dayVal = Number(task.target) || 1;

                    if (task.dailyTargets && Object.keys(task.dailyTargets).length > 0) {
                        if (task.dailyTargets[d.key] !== undefined) {
                            dayVal = Number(task.dailyTargets[d.key]);
                            isDayActive = dayVal > 0;
                        }
                    } else if (sched !== "Everyday" && sched !== "") {
                        isDayActive = sched.includes(d.key);
                        dayVal = isDayActive ? (Number(task.target) || 1) : 0;
                    }

                    chk.checked = isDayActive;
                    inp.disabled = !isDayActive;
                    row.classList.toggle("disabled", !isDayActive);
                    inp.value = dayVal > 0 ? dayVal : (Number(task.target) || 1);
                } else {
                    chk.checked = true;
                    inp.disabled = false;
                    row.classList.remove("disabled");
                    inp.value = Number(task.target) || 1;
                }
            });

            // Date picker for one-time tasks
            if (schedType === "OneTime") {
                const otDateInput = document.getElementById("task-onetime-date-input");
                if (otDateInput) {
                    otDateInput.value = (task.oneTimeDate || task.createdAt || "").slice(0, 10) || currentDateStr;
                }
            }

            updateDailyTargetsUIState();
            updateTaskModalScheduleUI(schedType);
        }
    } else {
        const defaultDate = currentDateStr || new Date().toISOString().slice(0, 10);
        const schedType = options.isOneTime ? "OneTime" : "Everyday";

        if (title) {
            title.innerHTML = options.isOneTime
                ? `<i class="fa-solid fa-bolt gold-text"></i> إضافة مهمة لمرة واحدة فقط`
                : `<i class="fa-solid fa-plus"></i> إضافة ورد أو مهمة مخصصة`;
        }

        const radio = document.querySelector(`input[name="schedule_type"][value="${schedType}"]`);
        if (radio) radio.checked = true;

        if (idInput) idInput.value = "";
        if (nameInput) nameInput.value = "";
        if (allCats && allCats.length > 0 && catInput) {
            catInput.value = allCats[0].name;
            updateSubcats(catInput.value, "");
        }
        if (targetInput) targetInput.value = "1";

        // Ensure daily targets section starts expanded
        const dailyBox = document.getElementById("daily-targets-box");
        if (dailyBox) dailyBox.classList.remove("collapsed");

        // Reset per-day target rows to default 1 and active
        TASK_MODAL_WEEKDAYS.forEach(d => {
            const row = document.querySelector(`.daily-target-row[data-day="${d.key}"]`);
            const chk = row?.querySelector(".chk-day-active");
            const inp = row?.querySelector(".input-day-target");
            if (chk) chk.checked = true;
            if (inp) {
                inp.disabled = false;
                inp.value = 1;
            }
            if (row) row.classList.remove("disabled");
        });

        const otDateInput = document.getElementById("task-onetime-date-input");
        if (otDateInput) otDateInput.value = defaultDate;

        updateDailyTargetsUIState();
        updateTaskModalScheduleUI(schedType);
    }

    modal.classList.remove("hidden");
}

export function closeTaskModal() {
    const modal = document.getElementById("task-modal");
    if (modal) modal.classList.add("hidden");
    editingTaskId = null;
}

/**
 * Saves task configuration from the modal
 */
export function saveTaskFromModal() {
    const id = document.getElementById("task-id-input").value || `task_${Date.now()}`;
    const name = document.getElementById("task-name-input").value.trim();
    if (!name) {
        showToast("يرجى إدخال اسم المهمة", "warning");
        return;
    }
    const cat = document.getElementById("task-category-input").value;
    const subcat = document.getElementById("task-subcategory-input").value || null;

    const schedType = document.querySelector('input[name="schedule_type"]:checked')?.value || "Everyday";
    let scheduleVal = schedType;
    let dailyTargets = null;
    let effectiveTarget = 1;

    if (schedType === "Everyday") {
        dailyTargets = {};
        const activeDays = [];
        TASK_MODAL_WEEKDAYS.forEach(d => {
            const chk = document.querySelector(`.chk-day-active[data-day="${d.key}"]`);
            const inp = document.querySelector(`.input-day-target[data-day="${d.key}"]`);
            const val = parseFloat(inp?.value);
            if (chk && chk.checked) {
                const targetVal = (!isNaN(val) && val > 0) ? val : 1;
                dailyTargets[d.key] = targetVal;
                activeDays.push(d.key);
            } else {
                dailyTargets[d.key] = 0;
            }
        });

        if (activeDays.length === 7) {
            scheduleVal = "Everyday";
        } else if (activeDays.length > 0) {
            scheduleVal = activeDays.join(", ");
        } else {
            scheduleVal = "Everyday";
        }

        const pos = Object.values(dailyTargets).filter(v => Number(v) > 0);
        effectiveTarget = pos.length > 0 ? pos[0] : 1;
    } else {
        // OneTime, WhiteDays, Ramadan, etc. -> Uses scalar target column!
        scheduleVal = schedType;
        dailyTargets = null;
        const targetStr = document.getElementById("task-target-input")?.value;
        effectiveTarget = targetStr === "" ? 1 : Math.max(0.25, parseFloat(targetStr) || 1);
    }

    const appData = AppState.getAppData();
    const selectedDate = AppState.getCurrentDate() || new Date().toISOString().slice(0, 10);
    const otDateInput = document.getElementById("task-onetime-date-input");
    const chosenOneTimeDate = (schedType === "OneTime" && otDateInput?.value) ? otDateInput.value : selectedDate;

    let savedTask = null;
    if (editingTaskId) {
        const idx = (appData.tasks || []).findIndex(t => t.id === editingTaskId);
        if (idx >= 0) {
            const oldTask = appData.tasks[idx];
            oldTask.name = name;
            oldTask.category = cat;
            oldTask.subcategory = subcat;
            oldTask.target = effectiveTarget;
            oldTask.schedule = scheduleVal;
            if (dailyTargets) {
                oldTask.dailyTargets = dailyTargets;
            } else {
                delete oldTask.dailyTargets;
            }
            if (schedType === "OneTime") {
                oldTask.oneTimeDate = chosenOneTimeDate;
                oldTask.createdAt = chosenOneTimeDate;
            } else {
                oldTask.oneTimeDate = null;
            }
            savedTask = oldTask;
        }
    } else {
        const newTask = {
            id: id,
            name: name,
            category: cat,
            subcategory: subcat,
            target: effectiveTarget,
            schedule: scheduleVal,
            isArchived: false,
            createdAt: (schedType === "OneTime") ? chosenOneTimeDate : (new Date().toISOString()),
            oneTimeDate: (schedType === "OneTime") ? chosenOneTimeDate : null
        };
        if (dailyTargets) {
            newTask.dailyTargets = dailyTargets;
        }
        if (!appData.tasks) appData.tasks = [];
        appData.tasks.push(newTask);
        savedTask = newTask;
    }

    // Save dedicated dailyTargets local backup
    if (savedTask && savedTask.dailyTargets) {
        try {
            const backupKey = APP_CONSTANTS.STORAGE_KEYS.DAILY_TARGETS_BACKUP;
            const backup = JSON.parse(localStorage.getItem(backupKey) || "{}");
            backup[savedTask.id] = savedTask.dailyTargets;
            localStorage.setItem(backupKey, JSON.stringify(backup));
        } catch (_) {}
    }

    // Update target snapshot in current date log
    if (savedTask && appData.logs?.[selectedDate]?.taskProgress?.[savedTask.id]) {
        const newNorm = (typeof getTaskNormalizedTarget === "function")
            ? getTaskNormalizedTarget(savedTask, selectedDate)
            : effectiveTarget;
        appData.logs[selectedDate].taskProgress[savedTask.id].target = newNorm;
        if (!appData.logs[selectedDate]._dirtyTasks) appData.logs[selectedDate]._dirtyTasks = {};
        appData.logs[selectedDate]._dirtyTasks[savedTask.id] = Date.now();
        appData.logs[selectedDate]._dirty = true;
        if (typeof ScoringEngine !== "undefined" && ScoringEngine.invalidateScoreCache) {
            ScoringEngine.invalidateScoreCache(selectedDate, appData);
        }
    }

    closeTaskModal();

    // Persist local state
    saveData(true);

    // Persist to cloud
    if (awradyAPI?.client && savedTask) {
        awradyAPI.saveTask(savedTask).catch(e => console.warn("[AwradyAPI] saveTask:", e.message));
    }

    // Refresh UI
    if (typeof window !== "undefined") {
        if (typeof window.renderDailyView === "function") window.renderDailyView();
        if (typeof window.renderTaskManager === "function") window.renderTaskManager();
        if (typeof window.updateHeaderTodayScore === "function") window.updateHeaderTodayScore();
        if (typeof window.renderAllTimeStats === "function") window.renderAllTimeStats();
        if (typeof window.updateChartAndAnalytics === "function") window.updateChartAndAnalytics();
    }
}

if (typeof window !== "undefined") {
    window.openTaskModal = openTaskModal;
    window.closeTaskModal = closeTaskModal;
    window.saveTaskFromModal = saveTaskFromModal;
    window.updateTaskModalScheduleUI = updateTaskModalScheduleUI;
    window.updateDailyTargetsUIState = updateDailyTargetsUIState;
    window.updateTaskModalUnitDisplay = updateTaskModalUnitDisplay;
}
