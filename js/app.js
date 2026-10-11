/**
 * ============================================================================
 * AWRAD PRO - APPLICATION ENGINE & INTERACTIVE LOGIC
 * Features:
 *  - Smart Hijri Date Calculation & Automatic Ayyam Bidh (White Days 13,14,15) detection
 *  - Automatic Ramadan Season detection and fasting assignment
 *  - Interactive Smart Nawafel / Sunah Prompt upon completing prayers
 *  - Full Dynamic Category Management (Add, Edit icons/labels, Delete)
 *  - Task Customization & Permanent Archival (without losing historical points)
 *  - Parity with accurate scoring equations and Chart.js Analytics
 * ============================================================================
 */

const STORAGE_KEY = (typeof APP_CONSTANTS !== "undefined" && APP_CONSTANTS.STORAGE_KEY) ? APP_CONSTANTS.STORAGE_KEY : "AWRAD_APP_DATA_V1";

// Global Application State
var appData = {
    categories: [],
    tasks: [],
    logs: {}
};
window.appData = appData;

let currentDateStr = getLocalTodayString();
let currentTab = "view-daily";

// Nested navigation state
let currentViewCategory = null; 
let currentViewSubcategory = null;

let chartTimeRange = "all";
let chartInstance = null;
let editingTaskId = null;
let editingCategoryId = null;
let nawafelPromptTimeout = null;

// ============================================================================
// INITIALIZATION & STATE MANAGEMENT
// ============================================================================
document.addEventListener("DOMContentLoaded", async () => {
    if (window.securityLock) {
        window.securityLock.init();
    }
    if (typeof setupDataManagement === "function") setupDataManagement();
    if (window.storageEngine) {
        await window.storageEngine.init(updateStorageUIStatus);
    }
    await initData();
    setupNavigation();
    setupDailyControls();
    if (typeof setupTaskManager === "function") setupTaskManager();
    if (typeof setupCategoryManager === "function") setupCategoryManager();
    if (typeof setupNawafelToast === "function") setupNawafelToast();
    if (typeof setupQiyamToast === "function") setupQiyamToast();
    if (typeof setupPomodoroControls === "function") setupPomodoroControls();
    
    // Initial Render
    renderDailyView();
    if (typeof renderAllTimeStats === "function") renderAllTimeStats();
    updateHeaderTodayScore();
    // Chart and analytics are lazily loaded when opening the Analytics tab
});

async function initData() {
    let data = null;

    // Load from Storage Engine (Cloud if configured -> IndexedDB -> localStorage)
    if (window.storageEngine) {
        data = await window.storageEngine.loadData(STORAGE_KEY);
    }

    // Direct fallback to localStorage if storageEngine returned null
    if (!data) {
        try {
            const localSaved = localStorage.getItem(STORAGE_KEY);
            if (localSaved) {
                data = JSON.parse(localSaved);
            }
        } catch (e) {
            console.error("[initData] Error parsing localStorage data:", e);
        }
    }

    if (data && data.tasks && data.tasks.length > 0 && data.logs) {
        appData = data;
    } else if (data && data.logs) {
        appData = data;
        if (!appData.tasks || appData.tasks.length === 0) {
            appData.tasks = (typeof DEFAULT_TASKS !== "undefined") ? JSON.parse(JSON.stringify(DEFAULT_TASKS)) : [];
        }
    } else {
        loadDefaultAppData();
        // If Supabase is configured but has no record yet, upload the initial defaults
        if (window.cloudAdapter && window.cloudAdapter.isConfigured()) {
            window.cloudAdapter.saveDataImmediate(appData);
        }
    }

    // If dataset has 0 logs (e.g. fresh Vercel session or unpopulated cloud table),
    // automatically restore historical records from Data/awrady_backup.json
    const hasLogs = appData && appData.logs && Object.keys(appData.logs).length > 0;
    if (!hasLogs && typeof window !== "undefined" && window.location && window.location.protocol.startsWith("http")) {
        try {
            const resp = await fetch("Data/awrady_backup.json?v=" + Date.now());
            if (resp.ok) {
                const diskData = await resp.json();
                if (diskData && diskData.logs && Object.keys(diskData.logs).length > 0) {
                    console.log("[initData] Auto-restoring historical dataset from Data/awrady_backup.json...");
                    appData = diskData;
                    if (window.cloudAdapter && window.cloudAdapter.isConfigured()) {
                        window.cloudAdapter.saveDataImmediate(appData);
                    }
                }
            }
        } catch (e) {
            console.warn("[initData] Could not fetch Data/awrady_backup.json:", e);
        }
    }

    if (!appData.categories || appData.categories.length === 0) {
        appData.categories = (typeof DEFAULT_CATEGORIES !== "undefined") ? JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)) : [];
    }
    if (!appData.tasks || appData.tasks.length === 0) {
        appData.tasks = (typeof DEFAULT_TASKS !== "undefined") ? JSON.parse(JSON.stringify(DEFAULT_TASKS)) : [];
    }

    window.appData = appData;
    if (window.stateManager) {
        window.stateManager.data = appData;
        window.stateManager.ensureDataIntegrity();
        appData = window.stateManager.data;
        window.appData = appData;
    }
    if (window.storageEngine) {
        await window.storageEngine.saveDataImmediate(STORAGE_KEY, appData);
    } else {
        saveData(true);
    }
}

function loadDefaultAppData() {
    if (typeof DEFAULT_AWRAD_DATA !== "undefined") {
        appData = JSON.parse(JSON.stringify(DEFAULT_AWRAD_DATA));
    } else if (typeof INITIAL_APP_DATA !== "undefined") {
        appData = JSON.parse(JSON.stringify(INITIAL_APP_DATA));
    } else {
        appData = {
            categories: (typeof DEFAULT_CATEGORIES !== "undefined") ? JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)) : [],
            tasks: (typeof DEFAULT_TASKS !== "undefined") ? JSON.parse(JSON.stringify(DEFAULT_TASKS)) : [],
            logs: {}
        };
    }
}

function saveData(immediate = false) {
    if (window.stateManager) {
        window.stateManager.data = appData;
        window.stateManager.save(immediate);
    } else if (window.storageEngine) {
        if (immediate) {
            window.storageEngine.saveDataImmediate(STORAGE_KEY, appData);
        } else {
            window.storageEngine.saveData(STORAGE_KEY, appData);
        }
    }
}

// Helper: Get effective task properties for a date
function getTaskEffectiveProps(task, dateStr) {
    if (typeof window.getTaskEffectiveProps === "function" && window.getTaskEffectiveProps !== getTaskEffectiveProps) {
        return window.getTaskEffectiveProps(task, dateStr);
    }
    if (task.history && Array.isArray(task.history) && task.history.length > 0) {
        const sortedHistory = [...task.history].sort((a, b) => (a.effectiveFrom || "2000-01-01").localeCompare(b.effectiveFrom || "2000-01-01"));
        let effective = sortedHistory[0];
        for (let entry of sortedHistory) {
            if (entry.effectiveFrom <= dateStr) {
                effective = entry;
            } else {
                break;
            }
        }
        return effective;
    }
    return task;
}

function isBonusTaskForDate(task, dateStr, loggedVal = null) {
    if (typeof ScheduleEngine !== "undefined" && typeof ScheduleEngine.isBonusTaskForDate === "function") {
        return ScheduleEngine.isBonusTaskForDate(task, dateStr, appData, loggedVal);
    }
    if (!task) return false;
    const effProps = getTaskEffectiveProps(task, dateStr);
    const log = appData.logs && appData.logs[dateStr];
    const val = (loggedVal !== null) ? loggedVal : ((log && log.entries) ? (log.entries[task.id] || 0) : 0);

    if (log && log.bonusTaskIds && Array.isArray(log.bonusTaskIds) && log.bonusTaskIds.includes(task.id)) {
        return true;
    }

    if ((effProps && effProps.isBonus) || task.isBonus) return true;

    const sched = (effProps.schedule || task.schedule || "").trim();
    const isOneTime = task.isOneTime || sched === "OneTime";
    const targetDate = task.oneTimeDate || effProps.oneTimeDate;

    if (isOneTime && targetDate === dateStr) {
        return false;
    }

    const isEveryday = (sched === "Everyday" || sched === "" || sched.toLowerCase() === "everyday");
    const dayAbbrev = typeof getDayOfWeekAbbrev === "function" ? getDayOfWeekAbbrev(dateStr) : "";

    if (!isEveryday && !sched.includes(dayAbbrev) && sched !== "WhiteDays" && sched !== "Ramadan") {
        return val > 0;
    }
    return false;
}

function isTaskScheduledForDate(task, dateStr, loggedVal = null) {
    if (typeof ScheduleEngine !== "undefined" && typeof ScheduleEngine.isTaskScheduledForDate === "function") {
        return ScheduleEngine.isTaskScheduledForDate(task, dateStr, appData, loggedVal);
    }
    if (task.isArchived) {
        const cutoff = task.archivedAt || null;
        const val = (loggedVal !== null) ? loggedVal : getTaskVal(task.id);
        if (!cutoff || dateStr > cutoff) {
            return val > 0;
        }
    }
    const effProps = getTaskEffectiveProps(task, dateStr);
    const creationDate = (task.createdAt || (task.history && task.history[0]?.effectiveFrom) || "2000-01-01").slice(0, 10);
    
    // Strict OneTime Date check
    const isOneTime = task.isOneTime || effProps.schedule === "OneTime" || task.schedule === "OneTime";
    if (isOneTime) {
        const targetDate = task.oneTimeDate || effProps.oneTimeDate || creationDate;
        if (dateStr === targetDate) return true;
        if (loggedVal !== null && loggedVal > 0) return true;
        return false;
    }

    if (dateStr < creationDate) {
        if (loggedVal !== null && loggedVal > 0) return true;
        return false;
    }
    if (isBonusTaskForDate(task, dateStr)) return true;
    if (task.isOneTime || effProps.schedule === "OneTime") {
        const targetDate = task.oneTimeDate || creationDate;
        if (dateStr === targetDate) return true;
        if (loggedVal !== null && loggedVal > 0) return true;
        return false;
    }
    const sched = effProps.schedule || "Everyday";
    if (sched === "Everyday") return true;
    if (sched === "Optional") {
        if (loggedVal !== null && loggedVal > 0) return true;
        return false;
    }

    const hijri = getHijriDetails(dateStr);
    if (sched === "Ramadan") return hijri.isRamadan;
    if (sched === "WhiteDays") return hijri.isWhiteDay;

    const dayOfWeek = getDayOfWeekStr(dateStr);
    const allowedDays = sched.split(",").map(s => s.trim());
    if (allowedDays.includes(dayOfWeek)) return true;
    if (sched.includes("WhiteDays") && hijri.isWhiteDay) return true;
    return false;
}

function isPrayerSelector(task) {
    if (task.type === "صلاة") return true;
    const cat = (task.category || "").trim();
    const sub = (task.subcategory || "").trim();
    return (cat === "صلاة" || cat === "الصلاة") && (sub === "فرض" || sub === "فرائض");
}

function isObligatoryPrayerTask(taskId) {
    const task = appData.tasks.find(t => t.id === taskId);
    if (!task) return false;
    return isPrayerSelector(task);
}

// ============================================================================
// NAVIGATION & CONTROLS
// ============================================================================
function setupNavigation() {
    const navTabs = document.querySelectorAll(".nav-tab");
    navTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            navTabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            
            const targetViewId = tab.getAttribute("data-tab");
            currentTab = targetViewId;
            
            document.querySelectorAll(".tab-view").forEach(view => {
                view.classList.remove("active");
            });
            document.getElementById(targetViewId).classList.add("active");

            if (targetViewId === "view-analytics") {
                if (typeof initChart === "function" && (typeof chartInstance === "undefined" || !chartInstance)) {
                    initChart();
                }
                if (typeof updateChartAndAnalytics === "function") {
                    updateChartAndAnalytics();
                }
            } else if (targetViewId === "view-manager" && typeof renderTaskManager === "function") {
                renderTaskManager();
            }
        });
    });
}

function setupDailyControls() {
    const datePicker = document.getElementById("date-picker-input");
    if (datePicker) {
        datePicker.value = currentDateStr;
        datePicker.addEventListener("change", (e) => {
            currentDateStr = e.target.value;
            renderDailyView();
        });
    }

    const btnPrev = document.getElementById("btn-prev-day");
    if (btnPrev) btnPrev.addEventListener("click", () => {
        currentDateStr = addDays(currentDateStr, -1);
        if (datePicker) datePicker.value = currentDateStr;
        renderDailyView();
    });

    const btnNext = document.getElementById("btn-next-day");
    if (btnNext) btnNext.addEventListener("click", () => {
        currentDateStr = addDays(currentDateStr, 1);
        if (datePicker) datePicker.value = currentDateStr;
        renderDailyView();
    });

    const btnToday = document.getElementById("btn-jump-today");
    if (btnToday) btnToday.addEventListener("click", () => {
        currentDateStr = getLocalTodayString();
        if (datePicker) datePicker.value = currentDateStr;
        renderDailyView();
    });

    // Wire unified quick-add button
    const btnQuickAdd = document.getElementById("btn-open-quick-add");
    if (btnQuickAdd) btnQuickAdd.addEventListener("click", () => {
        if (typeof openQuickAddModal === "function") openQuickAddModal();
    });

    // Wire bonus/onetime modal close buttons (kept for backward compat)
    const btnCloseBonusModal = document.getElementById("btn-close-bonus-modal");
    if (btnCloseBonusModal) btnCloseBonusModal.addEventListener("click", () => {
        if (typeof closeBonusTaskModal === "function") closeBonusTaskModal();
    });
    const btnCancelBonusModal = document.getElementById("btn-cancel-bonus-modal");
    if (btnCancelBonusModal) btnCancelBonusModal.addEventListener("click", () => {
        if (typeof closeBonusTaskModal === "function") closeBonusTaskModal();
    });
}
function isTimeTask(task) {
    if (!task) return false;
    const type = task.type || "";
    return type === "ساعة" || type === "ساعات" || type === "ساعات ودقايق" || type === "وقت" || type === "دقيقة";
}

function getTaskNormalizedTarget(task, dateStr = null) {
    if (!task) return 0;
    const curDate = dateStr || (typeof currentDateStr !== "undefined" ? currentDateStr : getLocalTodayString());
    const effProps = (typeof ScheduleEngine !== "undefined") ? ScheduleEngine.getTaskEffectiveProps(task, curDate) : task;
    const target = (effProps && effProps.target !== undefined && effProps.target !== null) ? effProps.target : (task.target || 0);
    const taskType = (effProps && effProps.type) || task.type || "";
    if (taskType === "ساعة" || taskType === "ساعات" || taskType === "ساعات ودقايق" || taskType === "وقت") {
        return target * 60;
    }
    return target;
}

function isTaskCompleted(task, val, dateStr = null) {
    const normTarget = getTaskNormalizedTarget(task, dateStr);
    if (normTarget > 0) {
        return val >= normTarget;
    }
    return val > 0;
}

if (typeof window !== "undefined") {
    window.isTimeTask = isTimeTask;
    window.getTaskNormalizedTarget = getTaskNormalizedTarget;
    window.isTaskCompleted = isTaskCompleted;
}

function renderDailyView() {
    if (typeof window.renderDailyView === "function" && window.renderDailyView !== renderDailyView) {
        window.renderDailyView();
        return;
    }
    const grid = document.getElementById("daily-tasks-grid");
    if (!grid) return;
    grid.innerHTML = "";
    grid.classList.remove("hidden"); // make sure grid is visible

    // Hide nav grid since we render tasks directly
    const navGrid = document.getElementById("daily-nav-grid");
    if (navGrid) navGrid.style.display = "none";

    // Update date header
    const dateTitle = document.getElementById("display-date-title");
    const hijriPill = document.getElementById("display-hijri-title");
    const hijri = getHijriDetails(currentDateStr);
    if (dateTitle) dateTitle.textContent = formatDateArabic(currentDateStr);
    if (hijriPill) {
        let tagsHtml = "";
        if (hijri.isRamadan) tagsHtml += ` <span class="badge badge-emerald" style="font-size:0.75rem;">🌙 رمضان</span>`;
        if (hijri.isWhiteDay) tagsHtml += ` <span class="badge badge-gold" style="font-size:0.75rem;">⭐ الأيام البيض</span>`;
        const hijriText = hijri.hijriFormatted || hijri.formatted || hijri.dateStringAr || "";
        hijriPill.innerHTML = `<i class="fa-solid fa-calendar-alt gold-text"></i> ${hijriText}${tagsHtml}`;
    }


    // Update Tomorrow Fasting Reminder banner (triggered the day before: Sunday for Monday, Wednesday for Thursday, and before each White Day)
    const fastingBanner = document.getElementById("tomorrow-fasting-banner");
    if (fastingBanner) {
        const tomorrowStr = typeof addDays === "function" ? addDays(currentDateStr, 1) : null;
        if (tomorrowStr) {
            const tomorrowDayAbbrev = typeof getDayOfWeekAbbrev === "function" ? getDayOfWeekAbbrev(tomorrowStr) : "";
            const tomorrowHijri = typeof getHijriDateDetails === "function" ? getHijriDateDetails(tomorrowStr) : { isWhiteDay: false, isRamadan: false };

            const isTomorrowMonday = (tomorrowDayAbbrev === "Mon");
            const isTomorrowThursday = (tomorrowDayAbbrev === "Thu");
            const isTomorrowWhiteDay = !!tomorrowHijri.isWhiteDay;

            // In Ramadan, daily fasting is obligatory so voluntary reminders are disabled
            const isFastingTomorrow = !hijri.isRamadan && !tomorrowHijri.isRamadan && (isTomorrowMonday || isTomorrowThursday || isTomorrowWhiteDay);

            if (isFastingTomorrow) {
                fastingBanner.classList.remove("hidden");
                const fTitle = document.getElementById("tomorrow-fasting-title");
                const fDesc = document.getElementById("tomorrow-fasting-desc");
                const fBadge = document.getElementById("tomorrow-fasting-badge");

                let titleText = "تذكير: غداً يوم صيام مستحب 🌿";
                let descText = "يُستحب تبييت نية الصيام الليلة والسحور.";
                let badgeText = "تذكير بالصيام";

                if (isTomorrowMonday && isTomorrowWhiteDay) {
                    titleText = `✨ تذكير: غداً صيام الإثنين ومن الأيام البيض (${tomorrowHijri.day} ${tomorrowHijri.monthName})`;
                    descText = `اجتماع فضيلتين: غداً الإثنين ومن الأيام البيض — لا تنسَ تبييت نية الصيام والسحور.`;
                    badgeText = "سُنة مؤكدة";
                } else if (isTomorrowThursday && isTomorrowWhiteDay) {
                    titleText = `✨ تذكير: غداً صيام الخميس ومن الأيام البيض (${tomorrowHijri.day} ${tomorrowHijri.monthName})`;
                    descText = `اجتماع فضيلتين: غداً الخميس ومن الأيام البيض — لا تنسَ تبييت نية الصيام والسحور.`;
                    badgeText = "سُنة مؤكدة";
                } else if (isTomorrowMonday) {
                    titleText = "🌿 تذكير: غداً صيام الإثنين";
                    descText = `سُنّة مؤكدة: تُعرَض الأعمال يوم الإثنين — لا تنسَ تبييت نية الصيام والسحور.`;
                    badgeText = "سُنة الإثنين";
                } else if (isTomorrowThursday) {
                    titleText = "🌿 تذكير: غداً صيام الخميس";
                    descText = `سُنّة مؤكدة: تُعرَض الأعمال يوم الخميس — لا تنسَ تبييت نية الصيام والسحور.`;
                    badgeText = "سُنة الخميس";
                } else if (isTomorrowWhiteDay) {
                    const whiteDayIndex = (tomorrowHijri.day === 13) ? "أول" : ((tomorrowHijri.day === 14) ? "ثاني" : "ثالث");
                    titleText = `🌕 تذكير: غداً صيام ${whiteDayIndex} الأيام البيض (${tomorrowHijri.day} ${tomorrowHijri.monthName})`;
                    descText = `سُنّة صيام الأيام البيض (13 و 14 و 15) — لا تنسَ تبييت نية الصيام والسحور.`;
                    badgeText = "الأيام البيض";
                }

                if (fTitle) fTitle.textContent = titleText;
                if (fDesc) fDesc.textContent = descText;
                if (fBadge) fBadge.textContent = badgeText;
            } else {
                fastingBanner.classList.add("hidden");
            }
        } else {
            fastingBanner.classList.add("hidden");
        }
    }

    const log = appData.logs[currentDateStr] || { entries: {}, disabledTaskIds: [] };
    const disabledIds = log.disabledTaskIds || [];
    const bonusIds = log.bonusTaskIds || [];

    const allScheduled = appData.tasks.filter(t => {
        if (bonusIds.includes(t.id)) return true;
        if (t.isArchived) {
            const cutoff = t.archivedAt || null;
            if (!cutoff || currentDateStr > cutoff) {
                return getTaskVal(t.id) > 0;
            }
        }
        return isTaskScheduledForDate(t, currentDateStr, getTaskVal(t.id));
    });

    // Group all active tasks (pending & completed) by Category
    const categoryGroupMap = new Map();
    (appData.categories || []).forEach(c => {
        categoryGroupMap.set(c.name, { ...c, tasks: [] });
    });

    const disabledTasks = allScheduled.filter(t => disabledIds.includes(t.id));
    const activeTasks = allScheduled.filter(t => !disabledIds.includes(t.id));
    activeTasks.forEach(t => {
        const val = getTaskVal(t.id);
        const normTarget = getTaskNormalizedTarget(t, currentDateStr);
        const isDone = isTaskCompleted(t, val, currentDateStr);
        
        const catName = t.category || "أخرى";
        if (!categoryGroupMap.has(catName)) {
            categoryGroupMap.set(catName, { name: catName, label: catName, icon: "fa-folder", tasks: [] });
        }
        categoryGroupMap.get(catName).tasks.push({ task: t, val, target: normTarget, isDone });
    });

    if (activeTasks.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; width: 100%; text-align: center; padding: 30px 20px;">
                <i class="fa-solid fa-calendar-check icon-lg gold-text" style="font-size: 2.5rem; color: var(--gold-primary); margin-bottom: 12px;"></i>
                <h3>${disabledTasks.length > 0 ? 'جميع مهمات هذا اليوم موقوفة' : 'لا توجد أوراد مجدولة لهذا اليوم'}</h3>
                <p>${disabledTasks.length > 0 ? 'يمكنك إعادة تفعيل أي مهمة من القائمة أدناه أو تفعيلها جميعاً دفعة واحدة.' : 'يمكنك إضافة ورد جديد أو اختيار يوم آخر.'}</p>
                ${disabledTasks.length > 0 ? `
                    <button class="btn-action-primary" id="btn-reenable-all-today" style="margin-top:16px; padding:10px 24px; font-size:0.95rem; border-radius:8px; cursor:pointer; background:var(--gold-primary); color:#000; font-weight:700; border:none; box-shadow: 0 4px 12px rgba(245,158,11,0.3);">
                        <i class="fa-solid fa-play"></i> إعادة تفعيل جميع مهمات اليوم (${disabledTasks.length})
                    </button>
                ` : ''}
            </div>
        `;

        if (disabledTasks.length > 0) {
            renderDisabledSection(grid, disabledTasks);
        }

        attachTaskControlListeners(grid);
        updateDailyScoreSummary();
        updateHeaderTodayScore();
        return;
    }

    categoryGroupMap.forEach(cat => {
        if (!cat.tasks || cat.tasks.length === 0) return;

        const rawIcon = cat.icon || "fa-folder";
        const iconClass = rawIcon.startsWith("fa-") ? rawIcon : `fa-${rawIcon}`;
        
        const pendingInCat = cat.tasks.filter(item => !item.isDone);
        const completedInCat = cat.tasks.filter(item => item.isDone);

        const catCard = document.createElement("div");
        catCard.className = "category-card glass-card";
        catCard.style.cssText = "grid-column: 1 / -1; margin-bottom: 16px; overflow: hidden; border-radius: var(--radius-md); border: 1px solid var(--glass-border); background: rgba(13, 22, 18, 0.6);";

        const catHeader = document.createElement("div");
        catHeader.className = "category-card-header";
        catHeader.style.cssText = "display:flex; align-items:center; justify-content:space-between; padding: 14px 18px; cursor:pointer; user-select:none; background: rgba(255,255,255,0.02); transition: background 0.2s ease;";
        catHeader.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:36px; height:36px; border-radius:10px; background:rgba(245,158,11,0.12); color:var(--gold-primary); display:flex; align-items:center; justify-content:center; font-size:1.1rem;">
                    <i class="fa-solid ${iconClass}"></i>
                </div>
                <div>
                    <h3 style="font-size:1.1rem; font-weight:700; color:#fff; margin:0;">${cat.label || cat.name}</h3>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:12px;">
                <span class="badge" style="font-size:0.75rem; background:${completedInCat.length === cat.tasks.length ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.08)'}; color:${completedInCat.length === cat.tasks.length ? '#10b981' : 'var(--text-secondary)'}; border:1px solid ${completedInCat.length === cat.tasks.length ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)'}; padding:4px 10px; border-radius:12px;">
                    ${completedInCat.length}/${cat.tasks.length} مكتمل
                </span>
                <i class="fa-solid fa-chevron-down toggle-chevron" style="color:var(--text-secondary); transition:transform 0.3s ease; transform: rotate(-90deg);"></i>
            </div>
        `;

        if (!window.expandedCategoryNames) window.expandedCategoryNames = new Set();
        const catName = cat.label || cat.name;
        const isExpanded = window.expandedCategoryNames.has(catName);

        const tasksBody = document.createElement("div");
        tasksBody.className = "category-tasks-body";
        tasksBody.style.cssText = `padding: 16px; display: ${isExpanded ? 'block' : 'none'};`;

        const chevronTransform = isExpanded ? "rotate(0deg)" : "rotate(-90deg)";
        catHeader.querySelector(".toggle-chevron").style.transform = chevronTransform;

        catHeader.addEventListener("click", () => {
            const isHidden = tasksBody.style.display === "none";
            if (isHidden) {
                tasksBody.style.display = "block";
                window.expandedCategoryNames.add(catName);
            } else {
                tasksBody.style.display = "none";
                window.expandedCategoryNames.delete(catName);
            }
            const chevron = catHeader.querySelector(".toggle-chevron");
            if (chevron) chevron.style.transform = isHidden ? "rotate(0deg)" : "rotate(-90deg)";
        });

        // 1) Render Pending Tasks as full .task-card elements inside pendingGrid
        if (pendingInCat.length > 0) {
            const pendingGrid = document.createElement("div");
            pendingGrid.className = "pending-tasks-grid";
            pendingGrid.style.cssText = "display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; margin-bottom: 10px;";
            
            pendingInCat.forEach(({ task, val, target }) => {
                const card = document.createElement("div");
                const isBonus = task.isBonus || bonusIds.includes(task.id);
                const progressPct = target > 0 ? Math.min(100, Math.round((val / target) * 100)) : (val > 0 ? 100 : 0);
                
                card.className = `task-card glass-card ${isBonus ? 'is-bonus-card' : ''}`;
                card.setAttribute("data-task-id", task.id);
                
                const iconHtml = getCategoryIconHtml(task);
                const bonusBadge = isBonus ? `<span class="tag-badge" style="font-size:0.7rem; background:rgba(245,158,11,0.2); color:#f59e0b; border-color:rgba(245,158,11,0.4);">بونص</span>` : "";
                const commentHtml = task.comment ? `<p style="font-size:0.8rem; color:var(--text-secondary); margin:6px 0 0 0;">${task.comment}</p>` : "";

                const rawTarget = task.target || 0;
                const targetDisplay = rawTarget > 0 ? `(${rawTarget} ${task.type || ''})` : '';
                
                const isPrayer = isPrayerSelector(task);
                const isTime = isTimeTask(task);

                let controlsHtml = "";
                if (isPrayer) {
                    controlsHtml = `
                        <div class="prayer-toggles" data-id="${task.id}" style="margin-top:14px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.05);">
                            <button class="btn-prayer ${val === 1 ? 'active-mosque' : ''}" data-prayer-val="1" data-id="${task.id}" title="صلاة جماعة / مسجد">🕌 جماعة</button>
                            <button class="btn-prayer ${val === 0.5 ? 'active-home' : ''}" data-prayer-val="0.5" data-id="${task.id}" title="صلاة منفرد">🏠 منفرد</button>
                            <button class="btn-prayer ${val === 0 ? 'active-none' : ''}" data-prayer-val="0" data-id="${task.id}" title="لم تُصلَّ بعد">❌ لم أصل</button>
                            <button class="btn-action-sm btn-task-off" data-id="${task.id}" title="إيقاف لهذا اليوم" style="font-size:0.75rem; padding:4px 8px; opacity:0.6;">⏸</button>
                        </div>
                    `;
                } else if (isTime) {
                    const hours = Math.floor(val / 60);
                    const minutes = val % 60;
                    controlsHtml = `
                        <div class="task-controls-area time-controls-area" data-id="${task.id}" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                            <div style="display:flex; align-items:center; gap:6px;">
                                <div style="display:flex; align-items:center; background:rgba(0,0,0,0.4); border:1px solid var(--glass-border); border-radius:8px; padding:2px 6px;">
                                    <input type="number" class="input-time-hours" data-id="${task.id}" value="${hours}" min="0" max="24" style="width:38px; background:transparent; border:none; color:#fff; font-weight:700; font-size:0.95rem; text-align:center;">
                                    <span style="font-size:0.75rem; color:var(--text-secondary);">ساعة</span>
                                </div>
                                <div style="display:flex; align-items:center; background:rgba(0,0,0,0.4); border:1px solid var(--glass-border); border-radius:8px; padding:2px 6px;">
                                    <input type="number" class="input-time-minutes" data-id="${task.id}" value="${minutes}" min="0" max="59" step="5" style="width:38px; background:transparent; border:none; color:#fff; font-weight:700; font-size:0.95rem; text-align:center;">
                                    <span style="font-size:0.75rem; color:var(--text-secondary);">دقيقة</span>
                                </div>
                            </div>

                            <div style="display:flex; align-items:center; gap:4px;">
                                <button class="btn-step btn-pomo-trigger" data-id="${task.id}" data-name="${task.name}" style="font-size:0.8rem; padding:3px 8px; border-radius:6px; color:#10b981; border:1px solid rgba(16,185,129,0.3); background:rgba(16,185,129,0.12);" title="بدء مؤقت التركيز لهذه المهمة"><i class="fa-solid fa-stopwatch"></i></button>
                                <button class="btn-step btn-step-time" data-id="${task.id}" data-time-delta="15" style="font-size:0.8rem; padding:3px 8px; border-radius:6px;" title="زيادة 15 دقيقة">+15د</button>
                                <button class="btn-step btn-step-time" data-id="${task.id}" data-time-delta="-15" style="font-size:0.8rem; padding:3px 8px; border-radius:6px;" title="إنقاص 15 دقيقة">-15د</button>
                                <button class="btn-action-sm btn-task-off" data-id="${task.id}" title="إيقاف لهذا اليوم" style="font-size:0.75rem; padding:4px 8px; opacity:0.6;">⏸</button>
                            </div>
                        </div>
                    `;
                } else {
                    controlsHtml = `
                        <div class="task-controls-area" data-id="${task.id}">
                            <div class="step-controls">
                                <button class="btn-step btn-val-minus" data-id="${task.id}">-</button>
                                <input type="text" class="input-count" value="${val}" readonly>
                                <button class="btn-step btn-val-plus" data-id="${task.id}">+</button>
                            </div>
                            <div style="display:flex; gap:6px; align-items:center;">
                                <button class="btn-action-sm btn-task-off" data-id="${task.id}" title="إيقاف لهذا اليوم" style="font-size:0.75rem; padding:4px 8px; opacity:0.6;">⏸</button>
                            </div>
                        </div>
                    `;
                }

                card.innerHTML = `
                    <div class="task-header">
                        <div class="task-title-group" style="cursor:pointer;" data-edit-id="${task.id}" title="انقر لتعديل الورد">
                            <div class="task-icon">${iconHtml}</div>
                            <div>
                                <h4>${task.name} ${bonusBadge}</h4>
                                <span class="task-unit-label">${task.category}${task.subcategory ? ' - ' + task.subcategory : ''} ${targetDisplay}</span>
                            </div>
                        </div>
                    </div>

                    ${commentHtml}

                    <div class="task-progress-bar-bg">
                        <div class="task-progress-bar-fill" style="width: ${progressPct}%"></div>
                    </div>

                    ${controlsHtml}
                `;

                pendingGrid.appendChild(card);
            });

            tasksBody.appendChild(pendingGrid);
        }

        // 2) Render Completed Tasks as minimal cards INSIDE THIS CATEGORY
        if (completedInCat.length > 0) {
            const completedSection = document.createElement("div");
            completedSection.className = "completed-tasks-in-cat";
            completedSection.style.cssText = "margin-top: 10px; padding-top: 10px; border-top: 1px dashed rgba(255,255,255,0.08);";
            
            const labelText = document.createElement("p");
            labelText.style.cssText = "font-size: 0.8rem; font-weight: 700; color: #10b981; margin: 0 0 8px 4px;";
            labelText.innerHTML = `<i class="fa-solid fa-circle-check"></i> مكتملة (${completedInCat.length})`;
            completedSection.appendChild(labelText);

            completedInCat.forEach(({ task, val, target }) => {
                const pill = document.createElement("div");
                pill.className = "task-item-minimal glass-card";
                pill.setAttribute("data-task-id", task.id);
                pill.style.cssText = "display:flex; flex-direction:column; padding:10px 14px; margin-bottom:8px; border-radius:10px; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.25); gap:6px;";
                
                const iconHtml = getCategoryIconHtml(task);
                const overTarget = target > 0 && val > target;
                const rawTarget = task.target || 0;
                const unitLabel = task.type === "ساعة" || task.type === "وقت" ? "دقيقة" : (task.type || "");
                const targetStr = rawTarget > 0 ? `${val}/${target} ${unitLabel}` : `${val}`;
                const progressPct = target > 0 ? Math.min(100, Math.round((val / target) * 100)) : (val > 0 ? 100 : 0);
                const barColor = overTarget ? "#f59e0b" : "#10b981";

                const isPrayer = isPrayerSelector(task);
                const isTime = isTimeTask(task);

                let minControlsHtml = "";
                if (isPrayer) {
                    minControlsHtml = `
                        <div class="prayer-toggles" data-id="${task.id}">
                            <button class="btn-prayer ${val === 1 ? 'active-mosque' : ''}" data-prayer-val="1" data-id="${task.id}" style="padding:3px 8px; font-size:0.75rem;" title="جماعة">🕌 جماعة</button>
                            <button class="btn-prayer ${val === 0.5 ? 'active-home' : ''}" data-prayer-val="0.5" data-id="${task.id}" style="padding:3px 8px; font-size:0.75rem;" title="منفرد">🏠 منفرد</button>
                            <button class="btn-prayer ${val === 0 ? 'active-none' : ''}" data-prayer-val="0" data-id="${task.id}" style="padding:3px 8px; font-size:0.75rem;" title="لم تصلي">❌ لم أصل</button>
                            <button class="btn-action-sm" data-edit-id="${task.id}" title="تعديل الورد" style="padding:2px 6px; color:var(--gold-primary); font-size:0.75rem;"><i class="fa-solid fa-pen"></i></button>
                        </div>
                    `;
                } else if (isTime) {
                    const hours = Math.floor(val / 60);
                    const minutes = val % 60;
                    minControlsHtml = `
                        <div class="task-controls" data-id="${task.id}" style="display:flex; align-items:center; gap:6px;">
                            <div style="display:flex; align-items:center; background:rgba(0,0,0,0.3); border:1px solid rgba(16,185,129,0.3); border-radius:6px; padding:1px 4px;">
                                <input type="number" class="input-time-hours" data-id="${task.id}" value="${hours}" min="0" max="24" style="width:28px; background:transparent; border:none; color:#10b981; font-weight:700; font-size:0.8rem; text-align:center;">
                                <span style="font-size:0.7rem; color:#10b981;">س</span>
                            </div>
                            <div style="display:flex; align-items:center; background:rgba(0,0,0,0.3); border:1px solid rgba(16,185,129,0.3); border-radius:6px; padding:1px 4px;">
                                <input type="number" class="input-time-minutes" data-id="${task.id}" value="${minutes}" min="0" max="59" step="5" style="width:28px; background:transparent; border:none; color:#10b981; font-weight:700; font-size:0.8rem; text-align:center;">
                                <span style="font-size:0.7rem; color:#10b981;">د</span>
                            </div>
                            <button class="btn-step btn-pomo-trigger" data-id="${task.id}" data-name="${task.name}" style="padding:2px 6px; font-size:0.75rem; color:#10b981; border:1px solid rgba(16,185,129,0.3); background:rgba(16,185,129,0.12);" title="بدء مؤقت التركيز لهذه المهمة"><i class="fa-solid fa-stopwatch"></i></button>
                            <button class="btn-step btn-step-time" data-id="${task.id}" data-time-delta="15" style="padding:2px 6px; font-size:0.75rem;" title="زيادة 15 دقيقة كبونص">+15د</button>
                            <button class="btn-step btn-step-time" data-id="${task.id}" data-time-delta="-15" style="padding:2px 6px; font-size:0.75rem;" title="إنقاص 15 دقيقة">-15د</button>
                            <button class="btn-action-sm" data-edit-id="${task.id}" title="تعديل الورد" style="padding:2px 6px; color:var(--gold-primary); font-size:0.75rem;"><i class="fa-solid fa-pen"></i></button>
                        </div>
                    `;
                } else {
                    minControlsHtml = `
                        <div class="task-controls" data-id="${task.id}" style="display:flex; align-items:center; gap:6px;">
                            <button class="btn-val-minus btn-action-sm" data-id="${task.id}" style="padding:2px 8px; font-size:0.8rem;" title="تراجع / إنقاص">-</button>
                            <input type="text" class="input-count" value="${val}" readonly style="width:40px; height:26px; font-size:0.8rem; padding:0;">
                            <button class="btn-val-plus btn-action-sm" data-id="${task.id}" style="padding:2px 8px; font-size:0.8rem;" title="زيادة كبونص">+</button>
                            <button class="btn-action-sm" data-edit-id="${task.id}" title="تعديل الورد" style="padding:2px 6px; color:var(--gold-primary); font-size:0.75rem;"><i class="fa-solid fa-pen"></i></button>
                        </div>
                    `;
                }

                pill.innerHTML = `
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="color:#10b981;">${iconHtml}</span>
                            <strong style="color:#fff; font-size:0.9rem;">${task.name}</strong>
                            <span class="task-target-str" style="font-size:0.8rem; color:#10b981; font-weight:700;">— ${targetStr}</span>
                            <span class="over-target-badge-container">${overTarget ? '<span style="font-size:0.75rem; color:#f59e0b; background:rgba(245,158,11,0.15); padding:2px 6px; border-radius:8px;">⭐ تجاوز الهدف</span>' : ''}</span>
                        </div>
                        ${minControlsHtml}
                    </div>
                    <div class="task-progress-bar-bg" style="height:4px; margin-top:4px; background:rgba(255,255,255,0.06); border-radius:4px; overflow:hidden;">
                        <div class="task-progress-bar-fill" style="width:${progressPct}%; height:100%; background:${barColor}; border-radius:4px; transition:width 0.3s ease;"></div>
                    </div>
                `;
                completedSection.appendChild(pill);
            });

            tasksBody.appendChild(completedSection);
        }

        catCard.appendChild(catHeader);
        catCard.appendChild(tasksBody);
        grid.appendChild(catCard);
    });

    renderDisabledSection(grid, disabledTasks);

    attachTaskControlListeners(grid);
    updateDailyScoreSummary();
    updateHeaderTodayScore();
}

function renderDisabledSection(grid, disabledTasks) {
    if (!disabledTasks || disabledTasks.length === 0) return;
    const disabledSection = document.createElement("div");
    disabledSection.className = "disabled-tasks-section";
    disabledSection.style.cssText = "grid-column: 1 / -1; margin-top: 20px; width: 100%;";
    disabledSection.innerHTML = `<p style="font-size:0.85rem; color:#94a3b8; margin: 12px 0 10px; padding-right:4px; font-weight:600;"><i class="fa-solid fa-pause-circle"></i> مهمات موقوفة لهذا اليوم (${disabledTasks.length}):</p>`;

    const disabledGrid = document.createElement("div");
    disabledGrid.style.cssText = "display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px;";

    disabledTasks.forEach(task => {
        const pill = document.createElement("div");
        pill.className = "task-item-minimal glass-card";
        pill.style.cssText = "display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-radius:8px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06);";
        const iconHtml = getCategoryIconHtml(task);
        pill.innerHTML = `
            <span style="opacity:0.85; font-size:0.9rem; color:#cbd5e1;">${iconHtml} ${task.name}</span>
            <button class="btn-action-sm" data-reenable-id="${task.id}" style="font-size:0.8rem; padding:4px 12px; background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3); border-radius:6px; cursor:pointer;">
                <i class="fa-solid fa-play"></i> إعادة تفعيل
            </button>
        `;
        disabledGrid.appendChild(pill);
    });
    disabledSection.appendChild(disabledGrid);
    grid.appendChild(disabledSection);
}

function getCategoryIconHtml(task) {
    const cat = (appData.categories || []).find(c => c.name === task.category);
    const rawIcon = cat ? (cat.icon || "fa-tag") : "fa-tag";
    const iconClass = rawIcon.startsWith("fa-") ? rawIcon : `fa-${rawIcon}`;
    return `<i class="fa-solid ${iconClass}"></i>`;
}

function attachTaskControlListeners(grid) {
    if (!grid) return;

    // 1. Regular minus button
    grid.querySelectorAll(".btn-val-minus").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const taskId = btn.getAttribute("data-id") || (btn.closest("[data-id]") && btn.closest("[data-id]").getAttribute("data-id"));
            if (taskId) adjustTaskVal(taskId, -1);
        });
    });

    // 2. Regular plus button
    grid.querySelectorAll(".btn-val-plus").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const taskId = btn.getAttribute("data-id") || (btn.closest("[data-id]") && btn.closest("[data-id]").getAttribute("data-id"));
            if (taskId) adjustTaskVal(taskId, 1);
        });
    });

    // 3. Time step buttons (-15d, +15d, +30d)
    grid.querySelectorAll(".btn-step-time").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const taskId = btn.getAttribute("data-id") || (btn.closest("[data-id]") && btn.closest("[data-id]").getAttribute("data-id"));
            const delta = parseInt(btn.getAttribute("data-time-delta"), 10) || 0;
            if (taskId && delta !== 0) adjustTaskVal(taskId, delta);
        });
    });

    // 4. Prayer selector buttons (Mosque, Home, Not Prayed)
    grid.querySelectorAll(".btn-prayer").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const taskId = btn.getAttribute("data-id");
            const valStr = btn.getAttribute("data-prayer-val");
            if (taskId && valStr !== null) {
                const newVal = parseFloat(valStr);
                setTaskVal(taskId, newVal);
                if (newVal > 0 && typeof isObligatoryPrayerTask === "function" && isObligatoryPrayerTask(taskId)) {
                    if (typeof checkAndShowNawafelPrompt === "function") checkAndShowNawafelPrompt(taskId);
                } else if (newVal === 0 && typeof isObligatoryPrayerTask === "function" && isObligatoryPrayerTask(taskId)) {
                    if (typeof removePrayerExtras === "function") removePrayerExtras(taskId);
                }
            }
        });
    });

    // Helper for live time input updates
    const handleTimeInputChange = (input, isInputEvent) => {
        const taskId = input.getAttribute("data-id");
        if (!taskId) return;
        const card = input.closest(".task-card, .task-item-minimal");
        const hoursEl = card ? card.querySelector(".input-time-hours") : null;
        const minutesEl = card ? card.querySelector(".input-time-minutes") : null;
        const h = Math.max(0, parseInt(hoursEl ? hoursEl.value : input.value, 10) || 0);
        const m = Math.max(0, Math.min(59, parseInt(minutesEl ? minutesEl.value : input.value, 10) || 0));
        const newTotal = (h * 60) + m;

        const prevTotal = (appData.logs[currentDateStr] && appData.logs[currentDateStr].entries) ? (appData.logs[currentDateStr].entries[taskId] || 0) : 0;
        if (!appData.logs[currentDateStr]) appData.logs[currentDateStr] = { entries: {} };
        if (!appData.logs[currentDateStr].entries) appData.logs[currentDateStr].entries = {};
        appData.logs[currentDateStr].entries[taskId] = newTotal;

        saveData();

        // Update card progress bar in real time without destroying input focus
        if (card) {
            const task = (appData.tasks || []).find(t => t.id === taskId);
            if (task) {
                const target = getTaskNormalizedTarget(task, currentDateStr);
                const progressPct = target > 0 ? Math.min(100, Math.round((newTotal / target) * 100)) : (newTotal > 0 ? 100 : 0);
                const progressBar = card.querySelector(".task-progress-bar-fill");
                if (progressBar) {
                    progressBar.style.width = `${progressPct}%`;
                }
            }
        }
        updateDailyScoreSummary();
        updateHeaderTodayScore();

        if (!isInputEvent) {
            const task = (appData.tasks || []).find(t => t.id === taskId);
            const wasDone = task ? isTaskCompleted(task, prevTotal, currentDateStr) : false;
            const nowDone = task ? isTaskCompleted(task, newTotal, currentDateStr) : false;
            if (wasDone !== nowDone) {
                renderDailyView();
            }
        }
    };

    // 5. Time Hours Input box
    grid.querySelectorAll(".input-time-hours").forEach(input => {
        input.addEventListener("input", () => handleTimeInputChange(input, true));
        input.addEventListener("change", () => handleTimeInputChange(input, false));
    });

    // 6. Time Minutes Input box
    grid.querySelectorAll(".input-time-minutes").forEach(input => {
        input.addEventListener("input", () => handleTimeInputChange(input, true));
        input.addEventListener("change", () => handleTimeInputChange(input, false));
    });

    // 7. Pause/disable task
    grid.querySelectorAll(".btn-task-off").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const taskId = btn.getAttribute("data-id");
            if (typeof toggleDeactivateTaskForDate === "function") toggleDeactivateTaskForDate(taskId, currentDateStr);
        });
    });

    // 8. Re-enable task
    grid.querySelectorAll("[data-reenable-id]").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const taskId = btn.getAttribute("data-reenable-id");
            if (typeof toggleDeactivateTaskForDate === "function") toggleDeactivateTaskForDate(taskId, currentDateStr);
        });
    });

    // 8b. Re-enable ALL tasks for today
    grid.querySelectorAll("#btn-reenable-all-today").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (appData.logs && appData.logs[currentDateStr]) {
                appData.logs[currentDateStr].disabledTaskIds = [];
                saveData(true);
                renderDailyView();
            }
        });
    });

    // 9. Direct Pomodoro trigger
    grid.querySelectorAll(".btn-pomo-trigger").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const taskId = btn.getAttribute("data-id");
            const taskName = btn.getAttribute("data-name") || "";
            if (typeof openPomodoroModal === "function") {
                openPomodoroModal(taskId, taskName);
            }
        });
    });

    // 10. Task editor modal on click
    grid.querySelectorAll("[data-edit-id]").forEach(el => {
        el.addEventListener("click", (e) => {
            if (e.target.closest(".btn-task-off") || e.target.closest(".btn-step") || e.target.closest(".btn-prayer") || e.target.closest("input")) return;
            const taskId = el.getAttribute("data-edit-id");
            if (typeof openTaskModal === "function") openTaskModal(taskId);
        });
    });
}

function toggleDeactivateTaskForDate(taskId, dateStr) {
    if (!appData.logs[dateStr]) appData.logs[dateStr] = { entries: {}, disabledTaskIds: [] };
    const log = appData.logs[dateStr];
    // Normalize legacy field name
    if (log.deactivatedTaskIds && !log.disabledTaskIds) {
        log.disabledTaskIds = log.deactivatedTaskIds;
        delete log.deactivatedTaskIds;
    }
    if (!log.disabledTaskIds) log.disabledTaskIds = [];
    const idx = log.disabledTaskIds.indexOf(taskId);
    if (idx >= 0) log.disabledTaskIds.splice(idx, 1);
    else log.disabledTaskIds.push(taskId);
    saveData();
    renderDailyView();
    if (typeof updateDailyScoreSummary === "function") updateDailyScoreSummary();
}

function removeBonusTaskFromDate(taskId, dateStr) {
    if (appData.logs[dateStr] && appData.logs[dateStr].bonusTaskIds) {
        appData.logs[dateStr].bonusTaskIds = appData.logs[dateStr].bonusTaskIds.filter(id => id !== taskId);
    }
    if (appData.logs[dateStr] && appData.logs[dateStr].entries) {
        delete appData.logs[dateStr].entries[taskId];
    }
    saveData();
    renderDailyView();
}

function removeOneTimeTask(taskId, dateStr) {
    if (confirm("هل أنت متأكد من حذف هذه المهمة المؤقتة؟")) {
        appData.tasks = appData.tasks.filter(t => t.id !== taskId);
        if (!appData.deletedTaskIds) appData.deletedTaskIds = [];
        if (!appData.deletedTaskIds.includes(taskId)) appData.deletedTaskIds.push(taskId);
        if (appData.logs[dateStr] && appData.logs[dateStr].entries) {
            delete appData.logs[dateStr].entries[taskId];
        }
        if (appData.logs[dateStr] && appData.logs[dateStr].bonusTaskIds) {
            appData.logs[dateStr].bonusTaskIds = appData.logs[dateStr].bonusTaskIds.filter(id => id !== taskId);
        }
        saveData();
        renderDailyView();
    }
}

function getTaskVal(taskId) {
    const log = appData.logs[currentDateStr];
    if (log && log.entries && log.entries[taskId] !== undefined) {
        return log.entries[taskId];
    }
    return 0;
}

function adjustTaskVal(taskId, delta) {
    const current = getTaskVal(taskId);
    const newVal = Math.max(0, current + delta);
    setTaskVal(taskId, newVal);

    if (delta > 0 && typeof isObligatoryPrayerTask === "function" && isObligatoryPrayerTask(taskId)) {
        if (typeof checkAndShowNawafelPrompt === "function") checkAndShowNawafelPrompt(taskId);
        else if (typeof triggerNawafelPrompt === "function") triggerNawafelPrompt(taskId);
    } else if (newVal === 0 && typeof isObligatoryPrayerTask === "function" && isObligatoryPrayerTask(taskId)) {
        if (typeof removePrayerExtras === "function") removePrayerExtras(taskId);
    }

    if (delta > 0 && typeof isQiyamTask === "function" && isQiyamTask(taskId)) {
        if (typeof checkAndShowQiyamPrompt === "function") checkAndShowQiyamPrompt();
    }
}

function isQiyamTask(taskId) {
    const t = (appData.tasks || []).find(x => x.id === taskId);
    if (!t) return false;
    return (t.subcategory === "قيام ليل" || t.name.includes("قيام") || t.name.includes("تهجد"));
}

function updateTaskCardInPlace(taskId, val, task = null) {
    if (!task) {
        task = (appData && appData.tasks) ? appData.tasks.find(t => t.id === taskId) : null;
    }
    if (!task) return false;

    let card = document.querySelector(`.task-card[data-task-id="${taskId}"], .task-item-minimal[data-task-id="${taskId}"]`);
    if (!card) {
        const child = document.querySelector(`[data-id="${taskId}"]`);
        if (child) card = child.closest(".task-card, .task-item-minimal");
    }
    if (!card) return false;

    const curDate = (typeof currentDateStr !== "undefined") ? currentDateStr : getLocalTodayString();
    const target = (typeof getTaskNormalizedTarget === "function") ? getTaskNormalizedTarget(task, curDate) : (task.target || 0);
    const progressPct = target > 0 ? Math.min(100, Math.round((val / target) * 100)) : (val > 0 ? 100 : 0);
    const overTarget = target > 0 && val > target;
    const barColor = overTarget ? "#f59e0b" : "#10b981";

    // 1. Update progress bar fill
    const progressBar = card.querySelector(".task-progress-bar-fill");
    if (progressBar) {
        progressBar.style.width = `${progressPct}%`;
        if (card.classList.contains("task-item-minimal")) {
            progressBar.style.background = barColor;
        }
    }

    // 2. Update counter input
    const inputCount = card.querySelector(".input-count");
    if (inputCount) {
        inputCount.value = val;
    }

    // 3. Update time inputs if present
    const hoursInput = card.querySelector(".input-time-hours");
    const minsInput = card.querySelector(".input-time-minutes");
    if (hoursInput) hoursInput.value = Math.floor(val / 60);
    if (minsInput) minsInput.value = val % 60;

    // 4. Update prayer toggle buttons
    const prayerBtns = card.querySelectorAll(".btn-prayer");
    if (prayerBtns.length > 0) {
        prayerBtns.forEach(btn => {
            const btnVal = parseFloat(btn.getAttribute("data-prayer-val"));
            btn.classList.remove("active-mosque", "active-home", "active-none");
            if (btnVal === 1 && val === 1) btn.classList.add("active-mosque");
            else if (btnVal === 0.5 && val === 0.5) btn.classList.add("active-home");
            else if (btnVal === 0 && val === 0) btn.classList.add("active-none");
        });
    }

    // 5. Update completed minimal card labels if present
    const targetStrEl = card.querySelector(".task-target-str");
    if (targetStrEl) {
        const rawTarget = task.target || 0;
        const unitLabel = (task.type === "ساعة" || task.type === "وقت") ? "دقيقة" : (task.type || "");
        const targetStr = rawTarget > 0 ? `${val}/${target} ${unitLabel}` : `${val}`;
        targetStrEl.textContent = `— ${targetStr}`;
    }

    const overTargetEl = card.querySelector(".over-target-badge-container");
    if (overTargetEl) {
        overTargetEl.innerHTML = overTarget ? '<span style="font-size:0.75rem; color:#f59e0b; background:rgba(245,158,11,0.15); padding:2px 6px; border-radius:8px;">⭐ تجاوز الهدف</span>' : '';
    }

    // 6. Update summary scores in real time
    if (typeof updateDailyScoreSummary === "function") updateDailyScoreSummary();
    if (typeof updateHeaderTodayScore === "function") updateHeaderTodayScore();

    return true;
}

function setTaskVal(taskId, val) {
    if (!appData.logs[currentDateStr]) {
        appData.logs[currentDateStr] = { entries: {} };
    }
    if (!appData.logs[currentDateStr].entries) {
        appData.logs[currentDateStr].entries = {};
    }

    const prevVal = appData.logs[currentDateStr].entries[taskId] || 0;
    appData.logs[currentDateStr].entries[taskId] = val;

    saveData();

    const task = (appData.tasks || []).find(t => t.id === taskId);
    const wasDone = task ? isTaskCompleted(task, prevVal, currentDateStr) : false;
    const nowDone = task ? isTaskCompleted(task, val, currentDateStr) : false;

    // Fast path: In-place DOM update when task completion status has not flipped
    if (task && wasDone === nowDone && updateTaskCardInPlace(taskId, val, task)) {
        // Updated in place without full grid re-render!
    } else {
        renderDailyView();
    }

    if (val > prevVal) {
        if (isObligatoryPrayerTask(taskId)) {
            if (typeof checkAndShowNawafelPrompt === "function") checkAndShowNawafelPrompt(taskId);
            else if (typeof triggerNawafelPrompt === "function") triggerNawafelPrompt(taskId);
        }
        if (isQiyamTask(taskId) && typeof checkAndShowQiyamPrompt === "function") {
            checkAndShowQiyamPrompt();
        }
    } else if (val === 0 && isObligatoryPrayerTask(taskId)) {
        if (typeof removePrayerExtras === "function") removePrayerExtras(taskId);
    }
}

// ============================================================================
// SCORING ENGINE INTEGRATION & HELPERS
// ============================================================================
function getTaskWeightMinutes(task, dateStr = null) {
    if (typeof ScoringEngine !== "undefined") {
        return ScoringEngine.getTaskWeightMinutes(task, dateStr, appData);
    }
    const engine = window.ScoringEngine || window.scoringEngine;
    if (engine) {
        return engine.getTaskWeightMinutes(task, dateStr, appData);
    }
    return 15;
}

function calculateDayScore(dateStr, appDataRef = null, returnHours = false) {
    const data = appDataRef || (typeof appData !== "undefined" ? appData : null);
    if (typeof ScoringEngine !== "undefined") {
        return ScoringEngine.calculateDayScore(dateStr, data, returnHours);
    }
    const engine = window.ScoringEngine || window.scoringEngine;
    if (engine) {
        return engine.calculateDayScore(dateStr, data, returnHours);
    }
    return 0;
}

function updateDailyScoreSummary() {
    const score = calculateDayScore(currentDateStr);
    const scorePct = Math.round(score * 100);
    const clampedPct = Math.min(100, scorePct);

    // Update ring percentage text
    const ringPct = document.getElementById("daily-ring-percentage");
    if (ringPct) ringPct.textContent = `${scorePct}%`;

    // Update SVG ring
    const ringCircle = document.getElementById("daily-ring-circle");
    if (ringCircle) {
        const circumference = 314;
        const offset = circumference - (clampedPct / 100) * circumference;
        ringCircle.style.strokeDashoffset = offset;
        ringCircle.style.stroke = scorePct >= 100 ? "#f59e0b" : (scorePct >= 70 ? "#10b981" : (scorePct >= 40 ? "#3b82f6" : "#64748b"));
    }

    // Count completed tasks for the badge
    const bonusIds = (appData.logs[currentDateStr] && appData.logs[currentDateStr].bonusTaskIds) || [];
    const allScheduled = appData.tasks.filter(t => {
        if (bonusIds.includes(t.id)) return true;
        if (t.isArchived) {
            const cutoff = t.archivedAt || null;
            if (!cutoff || currentDateStr > cutoff) {
                return getTaskVal(t.id) > 0;
            }
        }
        return isTaskScheduledForDate(t, currentDateStr, getTaskVal(t.id));
    });
    let completedCount = 0;
    let inProgressCount = 0;
    allScheduled.forEach(t => {
        const val = getTaskVal(t.id);
        const isDone = isTaskCompleted(t, val, currentDateStr);
        if (isDone) completedCount++;
        else if (val > 0) inProgressCount++;
    });

    const completedBadge = document.getElementById("daily-completed-badge");
    const inProgressBadge = document.getElementById("daily-in-progress-badge");
    if (completedBadge) completedBadge.textContent = `${completedCount} مكتمل`;
    if (inProgressBadge) inProgressBadge.textContent = `${inProgressCount} قيد الإنجاز`;

    // Calculate remaining estimated time in minutes for today's scheduled non-bonus tasks
    let totalRemainingMinutes = 0;
    allScheduled.forEach(t => {
        const isBonus = typeof ScheduleEngine !== "undefined" ? ScheduleEngine.isBonusTaskForDate(t, currentDateStr, appData) : !!t.isBonus;
        if (isBonus) return;

        const val = getTaskVal(t.id);
        const effProps = (typeof ScheduleEngine !== "undefined") ? ScheduleEngine.getTaskEffectiveProps(t, currentDateStr) : t;
        const target = (effProps && effProps.target != null) ? effProps.target : (t.target || 0);

        if (isTimeTask(t) || isTimeTask(effProps)) {
            const normTarget = getTaskNormalizedTarget(t, currentDateStr);
            if (normTarget > 0 && val < normTarget) {
                totalRemainingMinutes += (normTarget - val);
            }
        } else {
            if (target > 0 && val < target) {
                const totalWeightMins = (typeof ScoringEngine !== "undefined") ? ScoringEngine.getTaskWeightMinutes(t, currentDateStr, appData) : (target * 5);
                const unitWeightMins = totalWeightMins / (target || 1);
                const remUnits = target - val;
                totalRemainingMinutes += (remUnits * unitWeightMins);
            }
        }
    });

    const estTimeBadge = document.getElementById("daily-estimated-time-badge");
    if (estTimeBadge) {
        totalRemainingMinutes = Math.round(totalRemainingMinutes);
        if (totalRemainingMinutes <= 0) {
            estTimeBadge.innerHTML = `<i class="fa-solid fa-circle-check"></i> المتبقي: 0 دقيقة`;
            estTimeBadge.style.background = "rgba(16, 185, 129, 0.2)";
            estTimeBadge.style.color = "#10b981";
        } else if (totalRemainingMinutes >= 60) {
            const h = Math.floor(totalRemainingMinutes / 60);
            const m = totalRemainingMinutes % 60;
            const timeText = m > 0 ? `${h} ساعة و ${m} دقيقة` : `${h} ساعة`;
            estTimeBadge.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> المتبقي: ${timeText}`;
            estTimeBadge.style.background = "rgba(59, 130, 246, 0.2)";
            estTimeBadge.style.color = "#60a5fa";
        } else {
            estTimeBadge.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> المتبقي: ${totalRemainingMinutes} دقيقة`;
            estTimeBadge.style.background = "rgba(59, 130, 246, 0.2)";
            estTimeBadge.style.color = "#60a5fa";
        }
    }
}

function updateHeaderTodayScore() {
    const todayStr = getLocalTodayString();
    const score = calculateDayScore(todayStr);
    const scorePct = Math.round(score * 100);
    const headerEl = document.getElementById("header-today-score");
    if (headerEl) headerEl.textContent = `${scorePct}%`;
}

if (typeof window !== "undefined") {
    window.renderDailyView = renderDailyView;
    window.setTaskVal = setTaskVal;
    window.adjustTaskVal = adjustTaskVal;
    window.getTaskVal = getTaskVal;
    window.updateDailyScoreSummary = updateDailyScoreSummary;
    window.updateHeaderTodayScore = updateHeaderTodayScore;
    window.updateTaskCardInPlace = updateTaskCardInPlace;
}
