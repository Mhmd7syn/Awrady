/**
 * ============================================================================
 * AWRAD PRO - CATEGORY MANAGER COMPONENT
 * Handles Category and Subcategory CRUD operations and management UI.
 * ============================================================================
 */

let tempSubcategories = [];

function setupCategoryManager() {
    const openAddBtn = document.getElementById("btn-open-add-cat-modal");
    if (openAddBtn) openAddBtn.addEventListener("click", () => openCategoryModal(null));
    
    const closeBtn = document.getElementById("btn-close-cat-modal");
    if (closeBtn) closeBtn.addEventListener("click", closeCategoryModal);
    
    const cancelBtn = document.getElementById("btn-cancel-cat-modal");
    if (cancelBtn) cancelBtn.addEventListener("click", closeCategoryModal);
    
    const catUnitInp = document.getElementById("cat-unit-input");
    const catEstInp = document.getElementById("cat-estimated-minutes-input");
    if (catUnitInp && catEstInp) {
        catUnitInp.addEventListener("input", () => syncUnitEstMinsState(catUnitInp.value, catEstInp));
        catUnitInp.addEventListener("change", () => syncUnitEstMinsState(catUnitInp.value, catEstInp));
    }

    const subUnitInp = document.getElementById("new-subcat-unit-input");
    const subEstInp = document.getElementById("new-subcat-est-mins-input");
    if (subUnitInp && subEstInp) {
        subUnitInp.addEventListener("input", () => syncUnitEstMinsState(subUnitInp.value, subEstInp));
        subUnitInp.addEventListener("change", () => syncUnitEstMinsState(subUnitInp.value, subEstInp));
    }

    const catForm = document.getElementById("form-cat-editor");
    if (catForm) {
        catForm.addEventListener("submit", (e) => {
            e.preventDefault();
            saveCategoryFromModal();
        });
    }

    const btnAddSubcat = document.getElementById("btn-add-subcat");
    if (btnAddSubcat) {
        btnAddSubcat.addEventListener("click", () => {
            const inp = document.getElementById("new-subcat-input");
            const val = inp ? inp.value.trim() : "";
            const unitInp = document.getElementById("new-subcat-unit-input");
            const unitVal = unitInp ? unitInp.value.trim() : "";
            const estMinsInp = document.getElementById("new-subcat-est-mins-input");
            const estMinsVal = estMinsInp && estMinsInp.value !== "" ? parseFloat(estMinsInp.value) || null : null;
            if (val) {
                tempSubcategories.push({ id: `sub_${Date.now()}`, name: val, defaultUnit: unitVal, defaultEstimatedMinutes: estMinsVal });
                if (inp) inp.value = "";
                if (unitInp) unitInp.value = "";
                if (estMinsInp) estMinsInp.value = "";
                renderSubcategoriesList();
            }
        });
    }
}

function renderSubcategoriesList() {
    const list = document.getElementById("cat-subcategories-list");
    if (!list) return;
    list.innerHTML = "";
    tempSubcategories.forEach((sub, idx) => {
        const pill = document.createElement("div");
        pill.className = "subcat-pill";
        pill.title = "اضغط لتعديل هذا التصنيف الفرعي";
        pill.onclick = (e) => {
            if (e.target.closest('.btn-del-subcat')) return;
            editTempSubcat(idx);
        };

        const unitText = sub.defaultUnit ? `<span class="subcat-unit">(${sub.defaultUnit})</span>` : '';
        const estText = sub.defaultEstimatedMinutes ? `<span class="subcat-est">⏱${sub.defaultEstimatedMinutes}د</span>` : '';

        pill.innerHTML = `
            <span class="subcat-name-group">${sub.name} ${unitText} ${estText}</span>
            <button type="button" class="btn-edit-subcat" onclick="event.stopPropagation(); editTempSubcat(${idx})" title="تعديل"><i class="fa-solid fa-pen"></i></button>
            <button type="button" class="btn-del-subcat" onclick="event.stopPropagation(); removeTempSubcat(${idx})" title="حذف"><i class="fa-solid fa-xmark"></i></button>
        `;
        list.appendChild(pill);
    });
}

window.removeTempSubcat = function(idx) {
    tempSubcategories.splice(idx, 1);
    renderSubcategoriesList();
};

window.editTempSubcat = function(idx) {
    const sub = tempSubcategories[idx];
    if (!sub) return;
    const nameInp = document.getElementById("new-subcat-input");
    const unitInp = document.getElementById("new-subcat-unit-input");
    const estMinsInp = document.getElementById("new-subcat-est-mins-input");
    if (nameInp) nameInp.value = sub.name;
    if (unitInp) unitInp.value = sub.defaultUnit || "";
    if (estMinsInp) {
        estMinsInp.value = sub.defaultEstimatedMinutes || "";
        syncUnitEstMinsState(unitInp ? unitInp.value : "", estMinsInp);
    }
    tempSubcategories.splice(idx, 1);
    renderSubcategoriesList();
    if (nameInp) nameInp.focus();
};

function renderCategoriesManager() {
    const list = document.getElementById("manager-categories-list");
    if (!list) return;
    list.innerHTML = "";

    (appData.categories || []).forEach(cat => {
        const taskCount = (appData.tasks || []).filter(t => t.category === cat.name).length;

        const row = document.createElement("div");
        row.className = "manager-row";
        row.innerHTML = `
            <div class="manager-info">
                <div class="manager-icon"><i class="fa-solid ${cat.icon || 'fa-tag'}"></i></div>
                <div class="manager-details">
                    <h4>${cat.label || cat.name} <span class="tag-badge" style="font-size:0.75rem">${cat.name}</span></h4>
                    <p>
                        <span>عدد المهام المربوطة بهذا التصنيف: <strong>${taskCount}</strong> مهمة</span>
                    </p>
                </div>
            </div>
            <div class="manager-actions">
                <button class="btn-action-icon btn-edit-cat" data-id="${cat.id}"><i class="fa-solid fa-pen"></i> تعديل</button>
                ${appData.categories.length > 1 ? `<button class="btn-action-icon btn-del-cat" data-id="${cat.id}" title="حذف التصنيف"><i class="fa-solid fa-trash"></i></button>` : ''}
            </div>
        `;
        list.appendChild(row);
    });

    document.querySelectorAll(".btn-edit-cat").forEach(b => b.addEventListener("click", e => openCategoryModal(e.currentTarget.getAttribute("data-id"))));
    document.querySelectorAll(".btn-del-cat").forEach(b => b.addEventListener("click", e => deleteCategory(e.currentTarget.getAttribute("data-id"))));
}

function openCategoryModal(id) {
    editingCategoryId = id;
    const modal = document.getElementById("category-modal");
    const title = document.getElementById("modal-cat-title");
    const idInput = document.getElementById("cat-id-input");
    const nameInput = document.getElementById("cat-name-input");
    const oldNameInput = document.getElementById("cat-old-name");
    const unitInput = document.getElementById("cat-unit-input");

    if (!modal) return;
    
    if (id) {
        const cat = appData.categories.find(c => c.id === id);
        if (cat) {
            if (title) title.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> تعديل تصنيف (${cat.label || cat.name})`;
            if (idInput) idInput.value = cat.id;
            if (nameInput) nameInput.value = cat.name;
            if (oldNameInput) oldNameInput.value = cat.name;
            if (unitInput) unitInput.value = cat.defaultUnit || "";
            const estMinsInput = document.getElementById("cat-estimated-minutes-input");
            if (estMinsInput) {
                estMinsInput.value = cat.defaultEstimatedMinutes != null ? cat.defaultEstimatedMinutes : "";
                syncUnitEstMinsState(unitInput.value, estMinsInput);
            }
            tempSubcategories = JSON.parse(JSON.stringify(cat.subcategories || []));

            const iconRadio = document.querySelector(`input[name="cat_icon"][value="${cat.icon}"]`);
            if (iconRadio) iconRadio.checked = true;
        }
    } else {
        if (title) title.innerHTML = `<i class="fa-solid fa-tag"></i> إضافة تصنيف جديد`;
        if (idInput) idInput.value = `cat_${Date.now()}`;
        if (nameInput) nameInput.value = "";
        if (oldNameInput) oldNameInput.value = "";
        if (unitInput) unitInput.value = "";
        const estMinsInput = document.getElementById("cat-estimated-minutes-input");
        if (estMinsInput) {
            estMinsInput.value = "";
            syncUnitEstMinsState(unitInput.value, estMinsInput);
        }
        tempSubcategories = [];
        const defaultRadio = document.querySelector('input[name="cat_icon"][value="fa-heart"]');
        if (defaultRadio) defaultRadio.checked = true;
    }
    
    renderSubcategoriesList();
    modal.classList.remove("hidden");
}

function closeCategoryModal() {
    const modal = document.getElementById("category-modal");
    if (modal) modal.classList.add("hidden");
    editingCategoryId = null;
}

function saveCategoryFromModal() {
    const id = document.getElementById("cat-id-input").value || `cat_${Date.now()}`;
    const name = document.getElementById("cat-name-input").value.trim();
    const label = name;
    const defaultUnit = document.getElementById("cat-unit-input").value.trim();
    const estMinsInput = document.getElementById("cat-estimated-minutes-input");
    const defaultEstimatedMinutes = estMinsInput && estMinsInput.value !== "" ? parseInt(estMinsInput.value, 10) || null : null;
    const oldName = document.getElementById("cat-old-name").value;
    const icon = document.querySelector('input[name="cat_icon"]:checked')?.value || "fa-tag";

    if (!name) {
        alert("يرجى إدخال اسم التصنيف");
        return;
    }

    const catObj = { id, name, label, icon, defaultUnit, defaultEstimatedMinutes, subcategories: tempSubcategories };

    if (editingCategoryId) {
        const idx = appData.categories.findIndex(c => c.id === editingCategoryId);
        if (idx >= 0) {
            appData.categories[idx] = catObj;
            appData.tasks.forEach(t => {
                if (oldName && oldName !== name && t.category === oldName) {
                    t.category = name;
                }
                if (t.category === name) {
                    t.type = autoDetectType(t.category, t.subcategory);
                }
            });
        }
    } else {
        if (appData.categories.some(c => c.name === name)) {
            alert("هذا التصنيف موجود بالفعل!");
            return;
        }
        appData.categories.push(catObj);
    }

    closeCategoryModal();
    saveData();
    renderCategoriesManager();
    if (typeof renderTaskManager === "function") renderTaskManager();
    renderDailyView();
}

function deleteCategory(id) {
    const cat = appData.categories.find(c => c.id === id);
    if (!cat) return;
    if (appData.categories.length <= 1) {
        alert("لا يمكن حذف التصنيف الأخير.");
        return;
    }
    if (confirm(`هل أنت متأكد من حذف تصنيف (${cat.label || cat.name})؟ سيتم نقل كافة المهام المرتبطة به إلى التصنيف الافتراضي الأول.`)) {
        const fallbackName = appData.categories.find(c => c.id !== id)?.name || "عام";
        appData.tasks.forEach(t => {
            if (t.category === cat.name) t.category = fallbackName;
        });
        appData.categories = appData.categories.filter(c => c.id !== id);
        saveData();
        renderCategoriesManager();
        renderDailyView();
    }
}
