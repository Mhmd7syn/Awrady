/**
 * Awrady Dashboard - Weekly Schedule Sheet & Tasks Allocation Component
 * Interactive spreadsheet matrix view showing current task configuration across weekdays,
 * with editable day targets in native task category units, category combobox filtering (multi-check and check all),
 * everyday task exclusion, live row target totals, daily weighted hours, and persistence.
 */

const WEEKLY_WEEKDAYS = [
    { key: "Sat", ar: "السبت" },
    { key: "Sun", ar: "الأحد" },
    { key: "Mon", ar: "الإثنين" },
    { key: "Tue", ar: "الثلاثاء" },
    { key: "Wed", ar: "الأربعاء" },
    { key: "Thu", ar: "الخميس" },
    { key: "Fri", ar: "الجمعة" }
];

let weeklyModalOptions = {
    excludeDaily: false,
    selectedCategories: null
};

let weeklySheetPendingChanges = {};
let weeklySheetInitialValues = {};

/**
 * Returns estimated minutes per unit for a task
 * @param {Object} task
 * @returns {number}
 */
function getTaskMinutesPerUnit(task) {
    if (!task) return 60;
    if (typeof isTimeTask === "function" && isTimeTask(task)) return 60;
    const cat = APP_CONSTANTS.CATEGORIES.find(c => c.name === task.category);
    const sub = (cat && task.subcategory) ? cat.subcategories?.find(s => s.name === task.subcategory) : null;
    return sub?.defaultEstimatedMinutes || cat?.defaultEstimatedMinutes || 5;
}

/**
 * Resolves configured target for a task on a specific weekday in its normal category unit
 * @param {Object} task
 * @param {string} dayKey (Sat, Sun, Mon, Tue, Wed, Thu, Fri)
 * @returns {number} Target units
 */
function getTaskTargetForDay(task, dayKey) {
    if (!task || !dayKey) return 0;
    if (typeof getTaskDayTarget === "function") {
        return getTaskDayTarget(task, dayKey);
    }
    if (task.dailyTargets && task.dailyTargets[dayKey] !== undefined) {
        return Math.round((Number(task.dailyTargets[dayKey]) || 0) * 100) / 100;
    }
    const sched = (task.schedule || "Everyday").trim();
    const isScheduled = (sched === "Everyday" || sched === "" || sched === "Weekdays") ? true : sched.includes(dayKey);
    return isScheduled ? Math.round((Number(task.target) || 1) * 100) / 100 : 0;
}

/**
 * Calculates weighted hours for a task given a target value in its native unit
 * @param {Object} task
 * @param {number} targetVal
 * @returns {number} Weighted hours
 */
function getTaskWeightedHours(task, targetVal) {
    if (!task || targetVal <= 0) return 0;
    if (typeof ScoringEngine !== "undefined" && typeof ScoringEngine.getTaskWeightMinutes === "function") {
        return ScoringEngine.getTaskWeightMinutes(task, targetVal) / 60;
    }
    if (typeof isTimeTask === "function" && isTimeTask(task)) {
        return targetVal;
    }
    const minsPerUnit = getTaskMinutesPerUnit(task);
    const totalMins = targetVal > 30 ? minsPerUnit : (minsPerUnit * targetVal);
    return totalMins / 60;
}

/**
 * Formats a target number nicely (integers as integers, floats with up to 2 decimal places)
 * @param {number} val
 * @returns {string}
 */
function formatTargetValue(val) {
    const num = Number(val) || 0;
    return Number.isInteger(num) ? num.toString() : num.toFixed(2).replace(/\.?0+$/, "");
}

/**
 * Checks if a task is eligible to be shown in the weekly schedule sheet.
 * Focuses positively on showing only active daily scheduled tasks.
 * @param {Object} task
 * @returns {boolean}
 */
function isTaskEligibleForWeeklySheet(task) {
    return typeof isDailyScheduledTask === "function"
        ? isDailyScheduledTask(task)
        : Boolean(task && !task.isArchived && (task.schedule === "Everyday" || task.schedule === "Daily"));
}

/**
 * Returns all active daily scheduled tasks for the weekly sheet
 * @returns {Array<Object>}
 */
function getEligibleWeeklyTasks() {
    const dataStore = window.appData || { tasks: [], logs: {} };
    return (dataStore.tasks || []).filter(isTaskEligibleForWeeklySheet);
}

/**
 * Renders the category filter combobox with multi-select checkboxes and a "Check All" option
 */
function renderWeeklyCategoryCombobox() {
    const listContainer = document.getElementById("weekly-cat-options-list");
    const btnText = document.getElementById("weekly-cat-btn-text");
    const chkAll = document.getElementById("chk-weekly-cat-all");
    if (!listContainer || !btnText) return;

    const eligibleTasks = getEligibleWeeklyTasks();
    const availableCategories = Array.from(new Set(eligibleTasks.map(t => t.category).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, "ar"));

    if (!weeklyModalOptions.selectedCategories) {
        weeklyModalOptions.selectedCategories = new Set(availableCategories);
    }

    // Keep only valid categories
    const currentSelected = new Set(
        Array.from(weeklyModalOptions.selectedCategories).filter(c => availableCategories.includes(c))
    );
    if (weeklyModalOptions.selectedCategories.size > 0 && currentSelected.size === 0 && availableCategories.length > 0) {
        availableCategories.forEach(c => currentSelected.add(c));
    }
    weeklyModalOptions.selectedCategories = currentSelected;

    const allChecked = availableCategories.length > 0 && availableCategories.every(c => weeklyModalOptions.selectedCategories.has(c));
    if (chkAll) chkAll.checked = allChecked;

    // Update button text
    if (allChecked || weeklyModalOptions.selectedCategories.size === availableCategories.length) {
        btnText.textContent = "كل التصنيفات (All)";
    } else if (weeklyModalOptions.selectedCategories.size === 0) {
        btnText.textContent = "لا توجد تصنيفات محددة";
    } else if (weeklyModalOptions.selectedCategories.size === 1) {
        btnText.textContent = Array.from(weeklyModalOptions.selectedCategories)[0];
    } else {
        btnText.textContent = `${weeklyModalOptions.selectedCategories.size} تصنيفات محددة`;
    }

    // Render option items
    let optionsHtml = "";
    availableCategories.forEach(cat => {
        const isChecked = weeklyModalOptions.selectedCategories.has(cat);
        optionsHtml += `
            <label class="weekly-combobox-option">
                <input type="checkbox" class="chk-weekly-cat-item" data-category="${cat}" ${isChecked ? "checked" : ""}>
                <span>${cat}</span>
            </label>
        `;
    });
    listContainer.innerHTML = optionsHtml;

    // Attach listeners to items
    listContainer.querySelectorAll(".chk-weekly-cat-item").forEach(chk => {
        chk.addEventListener("change", (e) => {
            const cat = e.target.getAttribute("data-category");
            if (e.target.checked) {
                weeklyModalOptions.selectedCategories.add(cat);
            } else {
                weeklyModalOptions.selectedCategories.delete(cat);
            }
            const isAll = availableCategories.length > 0 && availableCategories.every(c => weeklyModalOptions.selectedCategories.has(c));
            if (chkAll) chkAll.checked = isAll;

            if (isAll) {
                btnText.textContent = "كل التصنيفات (All)";
            } else if (weeklyModalOptions.selectedCategories.size === 0) {
                btnText.textContent = "لا توجد تصنيفات محددة";
            } else if (weeklyModalOptions.selectedCategories.size === 1) {
                btnText.textContent = Array.from(weeklyModalOptions.selectedCategories)[0];
            } else {
                btnText.textContent = `${weeklyModalOptions.selectedCategories.size} تصنيفات محددة`;
            }

            renderWeeklyMatrixTable();
        });
    });
}

/**
 * Renders and displays the Weekly Schedule Matrix Modal
 */
function showWeeklyHoursModal() {
    const modal = document.getElementById("weekly-hours-modal");
    if (!modal) {
        console.warn("[WeeklyModal] #weekly-hours-modal not found in DOM");
        return;
    }

    // 1. Exclude daily checkbox
    const chkDaily = modal.querySelector("#chk-weekly-exclude-daily");
    if (chkDaily) {
        chkDaily.checked = Boolean(weeklyModalOptions.excludeDaily);
    }

    // 2. Render category combobox
    renderWeeklyCategoryCombobox();

    // 3. Build and render sheet table
    renderWeeklyMatrixTable();

    // 4. Bind static modal events once
    setupWeeklyModalEvents(modal);

    modal.classList.remove("hidden");
}

/**
 * Builds the interactive Matrix Spreadsheet HTML table
 */
function renderWeeklyMatrixTable() {
    const container = document.getElementById("weekly-sheet-table-container");
    if (!container) return;

    let tasks = getEligibleWeeklyTasks();

    // Apply exclude daily filter
    if (weeklyModalOptions.excludeDaily) {
        tasks = tasks.filter(t => {
            const sched = (t.schedule || "Everyday").trim();
            return sched !== "Everyday" && sched !== "";
        });
    }

    // Apply category filter
    if (weeklyModalOptions.selectedCategories && weeklyModalOptions.selectedCategories.size > 0) {
        tasks = tasks.filter(t => weeklyModalOptions.selectedCategories.has(t.category));
    } else if (weeklyModalOptions.selectedCategories && weeklyModalOptions.selectedCategories.size === 0) {
        tasks = [];
    }

    // Sort tasks logically by category then name
    tasks.sort((a, b) => {
        if (a.category !== b.category) {
            return (a.category || "").localeCompare(b.category || "", "ar");
        }
        return (a.name || "").localeCompare(b.name || "", "ar");
    });

    // Header HTML (No "اليوم" badge, No percentage column)
    let tableHtml = `
        <table class="weekly-matrix-table" id="weekly-matrix-table">
            <thead>
                <tr>
                    <th class="col-task">المهمة (Activity)</th>
                    <th class="col-cat">التصنيف</th>
    `;

    WEEKLY_WEEKDAYS.forEach(d => {
        tableHtml += `
            <th style="min-width:68px;">
                <div>${d.ar}</div>
                <div style="font-size:0.75rem; opacity:0.65; font-weight:normal;">${d.key}</div>
            </th>
        `;
    });

    tableHtml += `
                    <th class="col-total">المجموع</th>
                </tr>
            </thead>
            <tbody>
    `;

    if (tasks.length === 0) {
        tableHtml += `
            <tr>
                <td colspan="10" style="padding:24px; color:#94a3b8; text-align:center;">
                    لا توجد مهام تطابق معايير التصفية المحددة. جرب اختيار تصنيفات أخرى أو إلغاء استثناء المهام اليومية.
                </td>
            </tr>
        `;
    }

    const rowTargetTotals = {};
    const colWeightedHours = {};
    WEEKLY_WEEKDAYS.forEach(d => { colWeightedHours[d.key] = 0; });
    let grandTotalWeightedHours = 0;

    // First pass: compute all row target sums and column weighted hours
    tasks.forEach(t => {
        let taskTargetSum = 0;
        WEEKLY_WEEKDAYS.forEach(d => {
            const changeKey = `${t.id}:${d.key}`;
            let targetVal;
            if (weeklySheetPendingChanges[changeKey] !== undefined) {
                targetVal = Number(weeklySheetPendingChanges[changeKey]) || 0;
            } else {
                targetVal = getTaskTargetForDay(t, d.key);
                weeklySheetInitialValues[changeKey] = targetVal;
            }
            taskTargetSum += targetVal;

            const wHours = getTaskWeightedHours(t, targetVal);
            colWeightedHours[d.key] = (colWeightedHours[d.key] || 0) + wHours;
            grandTotalWeightedHours += wHours;
        });
        rowTargetTotals[t.id] = taskTargetSum;
    });

    // Second pass: render records/rows
    tasks.forEach(t => {
        const cat = t.category || "عام";
        const unit = typeof getTaskUnit === "function" ? getTaskUnit(t) : "مرة";
        const taskTargetTotal = rowTargetTotals[t.id] || 0;

        tableHtml += `
            <tr data-task-row="${t.id}">
                <td class="col-task" title="${t.name} (${unit})">
                    <span style="font-weight:700; color:#f8fafc;">${t.name}</span>
                    <span style="display:block; font-size:0.75rem; color:#94a3b8;">${unit}</span>
                </td>
                <td class="col-cat">
                    <span class="badge" style="background:rgba(255,255,255,0.06); font-size:0.75rem; padding:3px 8px; border-radius:6px; color:#cbd5e1;">${cat}</span>
                </td>
        `;

        WEEKLY_WEEKDAYS.forEach(d => {
            const changeKey = `${t.id}:${d.key}`;
            const currentTargetVal = (weeklySheetPendingChanges[changeKey] !== undefined)
                ? Number(weeklySheetPendingChanges[changeKey])
                : (weeklySheetInitialValues[changeKey] ?? getTaskTargetForDay(t, d.key));

            const isModified = weeklySheetPendingChanges[changeKey] !== undefined && weeklySheetPendingChanges[changeKey] !== weeklySheetInitialValues[changeKey];
            const zeroClass = currentTargetVal === 0 ? "zero-val" : "";
            const modClass = isModified ? "modified" : "";

            tableHtml += `
                <td>
                    <input type="number" 
                           step="any" 
                           min="0" 
                           class="weekly-sheet-cell-input ${zeroClass} ${modClass}" 
                           data-task-id="${t.id}" 
                           data-day="${d.key}" 
                           value="${currentTargetVal}" 
                           title="${t.name}: ${currentTargetVal} ${unit} يوم ${d.ar}">
                </td>
            `;
        });

        tableHtml += `
                <td class="col-total">
                    <span class="task-row-total" data-task-id="${t.id}">${formatTargetValue(taskTargetTotal)}</span>
                </td>
            </tr>
        `;
    });

    // Summary Row (Daily Total in Weighted Hours)
    tableHtml += `
            </tbody>
            <tfoot>
                <tr class="summary-row">
                    <td class="col-task" style="text-align:right;">إجمالي الساعات الموزونة (س)</td>
                    <td class="col-cat"></td>
    `;

    WEEKLY_WEEKDAYS.forEach(d => {
        const dWeightedSum = colWeightedHours[d.key] || 0;
        tableHtml += `
            <td>
                <span class="col-day-total" data-day="${d.key}">${dWeightedSum.toFixed(2)}</span>
            </td>
        `;
    });

    tableHtml += `
                    <td class="col-total">
                        <span id="weekly-grand-total">${grandTotalWeightedHours.toFixed(2)}</span>
                    </td>
                </tr>
            </tfoot>
        </table>
    `;

    container.innerHTML = tableHtml;

    // Attach dynamic input listeners for live spreadsheet recalculation
    container.querySelectorAll(".weekly-sheet-cell-input").forEach(input => {
        input.addEventListener("input", handleWeeklyCellChange);
    });
}

/**
 * Live recalculation handler when any table cell input value changes
 * @param {Event} e
 */
function handleWeeklyCellChange(e) {
    const input = e.target;
    const taskId = input.getAttribute("data-task-id");
    const dayKey = input.getAttribute("data-day");
    const changeKey = `${taskId}:${dayKey}`;

    let val = parseFloat(input.value);
    if (isNaN(val) || val < 0) val = 0;

    weeklySheetPendingChanges[changeKey] = val;

    const initialVal = weeklySheetInitialValues[changeKey] ?? 0;
    if (Math.abs(val - initialVal) > 0.001) {
        input.classList.add("modified");
    } else {
        input.classList.remove("modified");
    }

    if (val === 0) {
        input.classList.add("zero-val");
    } else {
        input.classList.remove("zero-val");
    }

    // Live spreadsheet totals recalculation
    recalculateWeeklySheetTotals();
}

/**
 * Fast synchronous DOM recalculation of all row target totals and column weighted hours
 */
function recalculateWeeklySheetTotals() {
    const container = document.getElementById("weekly-sheet-table-container");
    if (!container) return;

    const taskRows = container.querySelectorAll("tbody tr[data-task-row]");
    const colTotalSpans = container.querySelectorAll(".col-day-total");
    const grandTotalSpan = document.getElementById("weekly-grand-total");
    const dataStore = window.appData || { tasks: [] };

    const dayWeightedSums = {};
    colTotalSpans.forEach(span => {
        const day = span.getAttribute("data-day");
        dayWeightedSums[day] = 0;
    });

    let overallGrandWeightedHours = 0;

    taskRows.forEach(row => {
        const taskId = row.getAttribute("data-task-row");
        const task = (dataStore.tasks || []).find(t => t.id === taskId);
        let taskRowTargetSum = 0;

        row.querySelectorAll(".weekly-sheet-cell-input").forEach(cellInput => {
            const day = cellInput.getAttribute("data-day");
            const val = parseFloat(cellInput.value) || 0;
            taskRowTargetSum += val;

            const wHours = getTaskWeightedHours(task, val);
            if (dayWeightedSums[day] !== undefined) {
                dayWeightedSums[day] += wHours;
            }
            overallGrandWeightedHours += wHours;
        });

        const rowTotalSpan = row.querySelector(".task-row-total");
        if (rowTotalSpan) {
            rowTotalSpan.textContent = formatTargetValue(taskRowTargetSum);
        }
    });

    // Update column totals (weighted hours)
    colTotalSpans.forEach(span => {
        const day = span.getAttribute("data-day");
        span.textContent = (dayWeightedSums[day] || 0).toFixed(2);
    });

    // Update grand total (weighted hours)
    if (grandTotalSpan) {
        grandTotalSpan.textContent = overallGrandWeightedHours.toFixed(2);
    }
}

/**
 * Persists all modified cells back to appData.tasks (schedule & dailyTargets) and syncs
 */
async function saveWeeklyMatrix() {
    const keys = Object.keys(weeklySheetPendingChanges);
    const feedback = document.getElementById("weekly-save-feedback");

    if (keys.length === 0) {
        if (feedback) {
            feedback.textContent = "لا توجد تعديلات للحفظ";
            feedback.style.color = "#94a3b8";
            setTimeout(() => { if (feedback) feedback.textContent = ""; }, 2500);
        }
        return;
    }

    const dataStore = window.appData || { tasks: [], logs: {} };
    const modifiedTasks = new Set();

    keys.forEach(key => {
        const [taskId, dayKey] = key.split(":");
        const task = (dataStore.tasks || []).find(t => t.id === taskId);
        if (!task) return;
        modifiedTasks.add(task);
    });

    modifiedTasks.forEach(task => {
        if (!task.dailyTargets) {
            task.dailyTargets = {};
        }

        WEEKLY_WEEKDAYS.forEach(d => {
            const chgKey = `${task.id}:${d.key}`;
            const targetVal = weeklySheetPendingChanges[chgKey] !== undefined
                ? Number(weeklySheetPendingChanges[chgKey])
                : (task.dailyTargets[d.key] ?? getTaskTargetForDay(task, d.key));
            task.dailyTargets[d.key] = targetVal;
        });

        // Determine active days
        const activeDays = WEEKLY_WEEKDAYS.filter(d => (task.dailyTargets[d.key] || 0) > 0).map(d => d.key);
        if (activeDays.length === 7) {
            task.schedule = "Everyday";
        } else if (activeDays.length > 0) {
            task.schedule = activeDays.join(", ");
        } else {
            task.schedule = "Weekdays";
        }

        // Set base target to primary positive day target
        const positiveTargets = activeDays.map(k => task.dailyTargets[k]).filter(t => t > 0);
        if (positiveTargets.length > 0) {
            task.target = positiveTargets[0];
        }
    });

    // Dedicated offline/local persistence backup
    try {
        const backup = JSON.parse(localStorage.getItem("awrady_tasks_daily_targets") || "{}");
        modifiedTasks.forEach(t => {
            if (t.dailyTargets) backup[t.id] = t.dailyTargets;
        });
        localStorage.setItem("awrady_tasks_daily_targets", JSON.stringify(backup));
    } catch (_) {}

    // Update target snapshot in current date log so UI and scoring reflect the changes immediately
    const curDate = (typeof currentDateStr !== "undefined") ? currentDateStr : null;
    if (curDate && dataStore.logs?.[curDate]) {
        const curLog = dataStore.logs[curDate];
        if (curLog.taskProgress) {
            modifiedTasks.forEach(task => {
                if (curLog.taskProgress[task.id]) {
                    const newNorm = getTaskNormalizedTarget(task, curDate);
                    curLog.taskProgress[task.id].target = newNorm;
                    if (!curLog._dirtyTasks) curLog._dirtyTasks = {};
                    curLog._dirtyTasks[task.id] = Date.now();
                    curLog._dirty = true;
                }
            });
            if (typeof ScoringEngine !== "undefined" && ScoringEngine.invalidateScoreCache) {
                ScoringEngine.invalidateScoreCache(curDate, dataStore);
            }
        }
    }

    // 1. Save local state
    if (typeof saveData === "function") {
        saveData(true);
    }

    // 2. Persist to cloud database
    if (window.awradyAPI?.client && modifiedTasks.size > 0 && typeof window.awradyAPI.saveTasks === "function") {
        try {
            await window.awradyAPI.saveTasks(Array.from(modifiedTasks)).catch(e => console.warn("[WeeklyModal] saveTasks:", e.message));
        } catch (e) {
            console.warn("[WeeklyModal] Cloud sync:", e.message);
        }
    }

    // 3. Reset pending modifications
    weeklySheetPendingChanges = {};

    // 4. Re-render application UI
    if (typeof renderDailyView === "function") renderDailyView();
    if (typeof renderTaskManager === "function") renderTaskManager();
    if (typeof updateHeaderTodayScore === "function") updateHeaderTodayScore();
    if (typeof renderAllTimeStats === "function") renderAllTimeStats();
    if (typeof updateChartAndAnalytics === "function") updateChartAndAnalytics();

    // 5. Refresh matrix table and display success feedback
    renderWeeklyMatrixTable();

    if (feedback) {
        feedback.innerHTML = `<span style="color:#10b981;">✔ تم الحفظ وإعادة التحميل بنجاح</span>`;
        setTimeout(() => { if (feedback) feedback.textContent = ""; }, 3000);
    }
}

let _weeklyEventsInitialized = false;

/**
 * Binds persistent events to modal controls
 * @param {HTMLElement} modal
 */
function setupWeeklyModalEvents(modal) {
    if (_weeklyEventsInitialized) return;
    _weeklyEventsInitialized = true;

    // Close button (Issue #46)
    const closeBtn = modal.querySelector("#btn-close-weekly-modal");
    if (closeBtn) {
        closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
    }

    // Exclude daily filter
    const chkDaily = modal.querySelector("#chk-weekly-exclude-daily");
    if (chkDaily) {
        chkDaily.addEventListener("change", (e) => {
            weeklyModalOptions.excludeDaily = e.target.checked;
            renderWeeklyMatrixTable();
        });
    }

    // Category Combobox Toggle
    const toggleBtn = modal.querySelector("#btn-weekly-cat-toggle");
    const dropdown = modal.querySelector("#weekly-cat-dropdown");
    if (toggleBtn && dropdown) {
        toggleBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const isHidden = dropdown.classList.toggle("hidden");
            toggleBtn.setAttribute("aria-expanded", String(!isHidden));
            toggleBtn.classList.toggle("active", !isHidden);
        });
    }

    // Category Check All
    const chkAll = modal.querySelector("#chk-weekly-cat-all");
    if (chkAll) {
        chkAll.addEventListener("change", (e) => {
            const isChecked = e.target.checked;
            const eligibleTasks = getEligibleWeeklyTasks();
            const availableCategories = Array.from(new Set(eligibleTasks.map(t => t.category).filter(Boolean)));

            if (isChecked) {
                availableCategories.forEach(c => weeklyModalOptions.selectedCategories.add(c));
            } else {
                weeklyModalOptions.selectedCategories.clear();
            }

            const listContainer = modal.querySelector("#weekly-cat-options-list");
            if (listContainer) {
                listContainer.querySelectorAll(".chk-weekly-cat-item").forEach(c => {
                    c.checked = isChecked;
                });
            }

            const btnText = modal.querySelector("#weekly-cat-btn-text");
            if (btnText) {
                btnText.textContent = isChecked ? "كل التصنيفات (All)" : "لا توجد تصنيفات محددة";
            }

            renderWeeklyMatrixTable();
        });
    }

    // Close combobox when clicking outside
    document.addEventListener("click", (e) => {
        if (dropdown && !dropdown.classList.contains("hidden")) {
            const comboboxEl = modal.querySelector("#weekly-category-combobox");
            if (comboboxEl && !comboboxEl.contains(e.target)) {
                dropdown.classList.add("hidden");
                toggleBtn?.setAttribute("aria-expanded", "false");
                toggleBtn?.classList.remove("active");
            }
        }
    });

    // Save & reload button
    modal.querySelector("#btn-weekly-save")?.addEventListener("click", saveWeeklyMatrix);

    // Backdrop click dismiss
    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            modal.classList.add("hidden");
        }
    });

    // Escape key dismiss
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !modal.classList.contains("hidden")) {
            modal.classList.add("hidden");
        }
    });
}

if (typeof window !== "undefined") {
    window.weeklyModalOptions = weeklyModalOptions;
    window.showWeeklyHoursModal = showWeeklyHoursModal;
    window.saveWeeklyMatrix = saveWeeklyMatrix;
    window.getEligibleWeeklyTasks = getEligibleWeeklyTasks;
    window.getTaskTargetForDay = getTaskTargetForDay;
    window.getTaskWeightedHours = getTaskWeightedHours;
}
