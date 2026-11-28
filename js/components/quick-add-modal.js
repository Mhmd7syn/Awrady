/**
 * Quick-add modal
 */

import { AppState } from '../core/state.js';
import { ScheduleEngine } from '../core/schedule-engine.js';
import { isUnscheduledTask } from '../core/task-rules.js';
import { getCategoryIconHtml } from './category-manager.js';
import { openTaskModal } from './task-modal.js';

let _qaCurrentFilter = "all";
let _quickAddInitialized = false;

const addBonusTaskToDate = (taskId, dateStr) => {
    if (typeof window !== "undefined" && typeof window.addBonusTaskToDate === "function") {
        window.addBonusTaskToDate(taskId, dateStr);
    }
};

export function initQuickAddModal() {
    if (_quickAddInitialized) return;
    const modal = document.getElementById("quick-add-modal");
    if (!modal) return;

    const step1 = document.getElementById("quick-add-step1");
    const step2 = document.getElementById("quick-add-step2-existing");

    // Wire step 1 → existing task picker
    const btnExisting = document.getElementById("btn-qa-existing");
    if (btnExisting) {
        btnExisting.addEventListener("click", () => {
            if (step1) step1.style.display = "none";
            if (step2) step2.style.display = "block";
            populateQuickAddExistingList();
        });
    }

    // Wire step 1 → new task dialog (opens create task dialog immediately)
    const btnNew = document.getElementById("btn-qa-new");
    if (btnNew) {
        btnNew.addEventListener("click", () => {
            modal.classList.add("hidden");
            openTaskModal(null);
        });
    }

    // Wire back button
    const backBtn = document.getElementById("btn-qa-back-from-existing");
    if (backBtn) {
        backBtn.addEventListener("click", () => {
            if (step2) step2.style.display = "none";
            if (step1) step1.style.display = "block";
        });
    }

    // Wire close button
    const closeBtn = document.getElementById("btn-close-quick-add-modal");
    if (closeBtn) {
        closeBtn.addEventListener("click", () => {
            modal.classList.add("hidden");
        });
    }

    // Filter chips
    const filterChips = document.querySelectorAll("#quick-add-filter-chips .qa-chip");
    filterChips.forEach(chip => {
        chip.addEventListener("click", () => {
            document.querySelectorAll("#quick-add-filter-chips .qa-chip").forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            _qaCurrentFilter = chip.getAttribute("data-filter") || "all";
            renderQuickAddExistingList();
        });
    });

    // Search input
    const searchInput = document.getElementById("quick-add-search-input");
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            renderQuickAddExistingList();
        });
    }

    // Delegate pick button clicks on existing list
    const list = document.getElementById("quick-add-existing-list");
    if (list) {
        list.addEventListener("click", (e) => {
            const btn = e.target.closest(".btn-qa-pick");
            if (btn) {
                const taskId = btn.getAttribute("data-task-id");
                if (taskId) {
                    const currentDateStr = AppState.getCurrentDate();
                    addBonusTaskToDate(taskId, currentDateStr);
                    modal.classList.add("hidden");
                }
            }
        });
    }

    _quickAddInitialized = true;
}

export function openQuickAddModal() {
    initQuickAddModal();
    const modal = document.getElementById("quick-add-modal");
    if (!modal) return;

    // Reset to step 1
    const step1 = document.getElementById("quick-add-step1");
    const step2 = document.getElementById("quick-add-step2-existing");
    if (step1) step1.style.display = "block";
    if (step2) step2.style.display = "none";

    _qaCurrentFilter = "all";
    const searchInput = document.getElementById("quick-add-search-input");
    if (searchInput) searchInput.value = "";
    document.querySelectorAll("#quick-add-filter-chips .qa-chip").forEach(chip => {
        chip.classList.toggle("active", chip.getAttribute("data-filter") === "all");
    });

    modal.classList.remove("hidden");
}

export function populateQuickAddExistingList() {
    initQuickAddModal();
    const searchInput = document.getElementById("quick-add-search-input");
    if (searchInput) {
        searchInput.value = "";
        setTimeout(() => searchInput.focus(), 50);
    }
    _qaCurrentFilter = "all";
    document.querySelectorAll("#quick-add-filter-chips .qa-chip").forEach(chip => {
        chip.classList.toggle("active", chip.getAttribute("data-filter") === "all");
    });
    renderQuickAddExistingList();
}

export function renderQuickAddExistingList() {
    const list = document.getElementById("quick-add-existing-list");
    if (!list) return;

    const curDate = AppState.getCurrentDate();
    const appData = AppState.getAppData();
    const term = (document.getElementById("quick-add-search-input")?.value || "").trim().toLowerCase();

    list.innerHTML = "";

    const allTasks = appData.tasks || [];
    const filtered = allTasks.filter(task => {
        const isUnscheduled = isUnscheduledTask(task);

        if (_qaCurrentFilter === "scheduled" && isUnscheduled) return false;
        if (_qaCurrentFilter === "unscheduled" && !isUnscheduled) return false;

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
        const isUnscheduled = isUnscheduledTask(task);

        const typeBadgeHtml = isUnscheduled
            ? `<span style="font-size:0.72rem; padding:2px 8px; border-radius:10px; background:rgba(245,158,11,0.15); color:#fbbf24; border:1px solid rgba(245,158,11,0.3);">غير مجدول</span>`
            : `<span style="font-size:0.72rem; padding:2px 8px; border-radius:10px; background:rgba(16,185,129,0.15); color:#34d399; border:1px solid rgba(16,185,129,0.3);">مجدول</span>`;

        const isAlreadyActive = ScheduleEngine.isVisibleOn(task, curDate, appData);
        const iconHtml = getCategoryIconHtml(task);
        const catInfo = `${task.category || 'عام'}${task.subcategory ? ' - ' + task.subcategory : ''}`;

        const row = document.createElement("div");
        row.className = `qa-task-item qa-task-row${isAlreadyActive ? " is-active" : ""}`;
        row.setAttribute("role", "listitem");
        row.setAttribute("data-task-id", task.id);

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
                ${isAlreadyActive 
                    ? `<button class="btn-sm" disabled style="background:rgba(16,185,129,0.12); color:#10b981; border:1px solid rgba(16,185,129,0.25); font-size:0.78rem; padding:5px 10px; border-radius:8px; cursor:default;"><i class="fa-solid fa-check"></i> مضاف لليوم</button>`
                    : `<button class="btn-primary btn-sm btn-qa-pick" data-task-id="${task.id}" style="font-size:0.78rem; padding:5px 12px; border-radius:8px;"><i class="fa-solid fa-plus"></i> إضافة لليوم</button>`
                }
            </div>
        `;

        list.appendChild(row);
    });
}

if (typeof window !== "undefined") {
    window.initQuickAddModal = initQuickAddModal;
    window.openQuickAddModal = openQuickAddModal;
    window.populateQuickAddExistingList = populateQuickAddExistingList;
    window.renderQuickAddExistingList = renderQuickAddExistingList;
}
