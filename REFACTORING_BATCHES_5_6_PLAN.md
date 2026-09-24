# Implementation Plan: Batches 5 & 6 (Remaining Component Extraction & Aesthetic Polish)

This standalone implementation plan documents the remaining refactoring phases (Batch 5 and Batch 6) for the Awrad & Enjaz Dashboard project.

---

## 📌 Status Summary of Completed Work (Batches 1 – 4)
- 🟢 **Batch 1 (Core Utilities & Config)**: Extracted `constants.js`, `default-data.js`, `date-utils.js`, `debounce.js`.
- 🟢 **Batch 2 (State Manager & Storage Engine)**: Created `state-manager.js` with debounced disk save queue and decoupled `storage-engine.js`.
- 🟢 **Batch 3 (Schedule & Scoring Engines)**: Created `schedule-engine.js` and `scoring-engine.js`.
- 🟢 **Batch 4 (Primary UI Components & Focus Timer)**: Extracted `pomodoro.js`, `nawafel-toast.js`, `weekly-modal.js`, and `daily-view.js`.

---

## 🚀 Batch 5: Remaining Tab Components Extraction

### Goal
Extract all remaining monolithic tab logic from `js/app.js` into dedicated component files under `js/components/`, further modularizing the app and making each tab independent and lightweight.

### Files to Create & Modify:

1. **`[NEW] js/components/task-manager.js`**
   - **Responsibility**: Task CRUD Management Modal & Tab.
   - **Functions to Extract**:
     - `setupTaskManager()`
     - `renderTaskManager()`, `renderGroupedTasks()`, `createTaskRowElement()`
     - `archiveTask()`, `deleteForever()`, `autoDetectType()`, `isTimeBasedType()`
     - `openTaskModal()`, `updateSubcats()`, `closeTaskModal()`, `saveTaskFromModal()`
     - `openBonusTaskModal()`, `closeBonusTaskModal()`, `addBonusTaskToDate()`, `syncUnitEstMinsState()`

2. **`[NEW] js/components/category-manager.js`**
   - **Responsibility**: Category & Subcategory CRUD Management.
   - **Functions to Extract**:
     - `setupCategoryManager()`
     - `renderCategoriesManager()`, `renderSubcategoriesList()`
     - `openCategoryModal()`, `closeCategoryModal()`, `saveCategoryFromModal()`, `deleteCategory()`

3. **`[NEW] js/components/analytics-view.js`**
   - **Responsibility**: Statistics, Charts, Completion Heatmaps, and Habit Streaks.
   - **Functions to Extract**:
     - `initChart()`, `updateChartAndAnalytics()`
     - `renderTaskBreakdown()`, `renderAllTimeStats()`

4. **`[NEW] js/components/data-manager.js`**
   - **Responsibility**: Storage Engine status, JSON Import/Export, Backup Download, File Access API & Data Reset.
   - **Functions to Extract**:
     - `updateStorageUIStatus()`, `setupDataManagement()`
     - Export JSON backup download handlers
     - Import JSON file loader & schema validation
     - Data & logs reset confirmation listeners

5. **`[MODIFY] index.html`**
   - Include script tags for the new Batch 5 components before `js/app.js`:
     ```html
     <script src="js/components/task-manager.js"></script>
     <script src="js/components/category-manager.js"></script>
     <script src="js/components/analytics-view.js"></script>
     <script src="js/components/data-manager.js"></script>
     ```

6. **`[MODIFY] js/app.js`**
   - Remove extracted component logic and maintain clean delegate calls to the newly created component modules.

---

## 🎨 Batch 6: HTML & CSS Polish & Asset Optimization

### Goal
Final UI polish, cleaning up legacy inline styles, organizing `style.css` into logical modular sections, and optimizing CSS variables and dark mode glassmorphism effects.

### Proposed Changes:

1. **`[MODIFY] style.css`**
   - Organize CSS rules into modular sections: Core Design Tokens, Layout Grid, Component Cards, Glassmorphism Overlays, Modal Overlays, and Mobile Responsive Breakpoints.
   - Eliminate duplicated CSS declarations and clean up legacy selectors.

2. **`[MODIFY] index.html`**
   - Clean up remaining inline style attributes where feasible.
   - Ensure standard HTML5 semantic elements and accessibility attributes.

---

## Verification Plan

### Automated Tests
- Run Node/Python JS syntax validator across all JS files to ensure zero syntax errors:
  ```powershell
  python -c "import glob, subprocess, sys; files = glob.glob('js/**/*.js', recursive=True); errors = [f for f in files if subprocess.run(['node', '--check', f], capture_output=True).returncode != 0]; print('JS Syntax Check passed!' if not errors else f'Errors in {errors}'); sys.exit(len(errors))"
  ```

### Manual Verification Checklist for Batch 5 & 6
- **Task Management**: Create, edit, archive, restore, and delete tasks.
- **Category Management**: Add, edit, and delete categories and subcategories.
- **Analytics Tab**: Verify weekly/monthly charts render smoothly without errors.
- **Data Tab**: Export JSON backup, import JSON data, and verify default data reset.
