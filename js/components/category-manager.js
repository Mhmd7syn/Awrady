/**
 * Awrady Dashboard - Constant Categories Viewer
 * Displays constant reference categories, subcategories, units, and time estimates.
 */

function renderCategoriesManager() {
    const list = document.getElementById("manager-categories-list");
    if (!list) return;
    list.innerHTML = "";

    const categories = APP_CONSTANTS.CATEGORIES;

    categories.forEach(cat => {
        const taskCount = (window.appData && window.appData.tasks || []).filter(t => t.category === cat.name).length;
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
                    <h4>${cat.label || cat.name} <span class="tag-badge" style="font-size:0.75rem">${cat.name}</span></h4>
                    <p style="margin: 4px 0; color: #94a3b8; font-size: 0.85rem;">
                        <span>عدد المهام: <strong>${taskCount}</strong></span>
                        ${cat.defaultUnit ? ` | <span>الوحدة الافتراضية: <strong>${cat.defaultUnit}</strong></span>` : ''}
                        ${cat.defaultEstimatedMinutes ? ` | <span>الوقت التقديري: <strong>${cat.defaultEstimatedMinutes} دقيقة</strong></span>` : ''}
                    </p>
                    ${subList ? `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">${subList}</div>` : ''}
                </div>
            </div>
        `;
        list.appendChild(row);
    });

    const countEl = document.getElementById("count-categories");
    if (countEl) countEl.textContent = categories.length;
}
