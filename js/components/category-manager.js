/**
 * Awrady Dashboard - Constant Categories Viewer
 * Displays constant reference categories, subcategories, units, and time estimates.
 */

import { APP_CONSTANTS } from '../config/constants.js';
import { AppState } from '../core/state.js';

export function renderCategoriesManager() {
    const list = document.getElementById("manager-categories-list");
    if (!list) return;
    list.innerHTML = "";

    const categories = APP_CONSTANTS.CATEGORIES;
    const tasks = AppState.getTasks();

    categories.forEach(cat => {
        const taskCount = tasks.filter(t => t.category === cat.name).length;
        const subList = (cat.subcategories || []).map(s => {
            const unit = (s.defaultUnit || cat.defaultUnit) ? ` (${s.defaultUnit || cat.defaultUnit})` : "";
            const mins = (s.defaultEstimatedMinutes || cat.defaultEstimatedMinutes) ? ` ⏱${s.defaultEstimatedMinutes || cat.defaultEstimatedMinutes}د` : "";
            return `<span class="subcat-pill">${s.name}${unit}${mins}</span>`;
        }).join(" ");

        const row = document.createElement("div");
        row.className = "manager-row";
        row.innerHTML = `
            <div class="manager-info">
                <div class="manager-icon"><i class="fa-solid ${cat.icon || 'fa-tag'}"></i></div>
                <div class="manager-details">
                    <h4>${cat.label || cat.name} <span class="tag-badge text-xs">${cat.name}</span></h4>
                    <p class="text-secondary text-sm">
                        <span>عدد المهام: <strong>${taskCount}</strong></span>
                        ${cat.defaultUnit ? ` | <span>الوحدة الافتراضية: <strong>${cat.defaultUnit}</strong></span>` : ''}
                        ${cat.defaultEstimatedMinutes ? ` | <span>الوقت التقديري: <strong>${cat.defaultEstimatedMinutes} دقيقة</strong></span>` : ''}
                    </p>
                    ${subList ? `<div class="flex-wrap gap-xs">${subList}</div>` : ''}
                </div>
            </div>
        `;
        list.appendChild(row);
    });

    const countEl = document.getElementById("count-categories");
    if (countEl) countEl.textContent = categories.length;
}

/**
 * Resolves category icon HTML from appData or APP_CONSTANTS
 * @param {Object} task
 * @returns {string}
 */
export function getCategoryIconHtml(task) {
    const appData = (typeof AppState !== "undefined" && AppState.getAppData)
        ? AppState.getAppData()
        : (typeof window !== "undefined" && window.appData ? window.appData : null);
    const categories = appData?.categories?.length > 0 ? appData.categories : (APP_CONSTANTS.CATEGORIES || []);
    const cat = categories.find(c => c.name === task?.category);
    const rawIcon = cat ? (cat.icon || "fa-tag") : "fa-tag";
    const iconClass = rawIcon.startsWith("fa-") ? rawIcon : `fa-${rawIcon}`;
    return `<i class="fa-solid ${iconClass}"></i>`;
}

if (typeof window !== "undefined") {
    window.renderCategoriesManager = renderCategoriesManager;
    window.getCategoryIconHtml = getCategoryIconHtml;
}
