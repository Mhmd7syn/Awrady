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

const STORAGE_KEY = APP_CONSTANTS.STORAGE_KEY;

// Global Application State
var appData = {
    tasks: [],
    logs: {}
};
Object.defineProperty(appData, "categories", {
    get: () => APP_CONSTANTS.CATEGORIES,
    enumerable: false,
    configurable: true
});
window.appData = appData;

let currentDateStr = getLocalTodayString();
let chartTimeRange = "all";
let chartInstance = null;
let editingTaskId = null;

function getUserStorageKey() {
    const u = (window.enjazAPI?.currentUser || (window.authManager && window.authManager.getCurrentUser()) || APP_CONSTANTS.GUEST_USER).toLowerCase();
    return `${STORAGE_KEY}_${u}`;
}

// ============================================================================
// INITIALIZATION & STATE MANAGEMENT
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
    setupDataManagement();
    if (window.authManager) {
        window.authManager.init();
        if (window.authManager.isLoggedIn()) {
            window.startApp(window.authManager.getCurrentUser());
        }
    } else {
        window.startApp(APP_CONSTANTS.GUEST_USER);
    }
});

window.startApp = async function(username) {
    if (window.enjazAPI) {
        window.enjazAPI.currentUser = username;
    }
    if (window.securityLock) {
        window.securityLock.init();
    }
    await initData();
    if (!window._appControlsBound) {
        setupNavigation();
        setupDailyControls();
        setupTaskManager();
        setupNawafelToast();
        setupQiyamToast();
        setupPomodoroControls();
        window._appControlsBound = true;
    }
    renderDailyView();
    renderAllTimeStats();
    updateHeaderTodayScore();
};

window.logoutApp = function() {
    appData = {
        tasks: [],
        logs: {}
    };
    Object.defineProperty(appData, "categories", {
        get: () => APP_CONSTANTS.CATEGORIES,
        enumerable: false,
        configurable: true
    });
    window.appData = appData;
    const todayEl = document.getElementById("header-today-score");
    if (todayEl) todayEl.textContent = "0%";
    const container = document.getElementById("daily-tasks-container");
    if (container) container.innerHTML = "";
};

let _dbSaveTimer = null;

async function initData() {
    let loaded = false;

    // 1. Attempt initialization via direct Supabase API for tasks and daily progress
    if (window.enjazAPI && window.enjazAPI.init()) {
        try {
            const results = await Promise.allSettled([
                window.enjazAPI.getTasks(true),
                window.enjazAPI.getAllProgress()
            ]);

            const tasks = results[0].status === "fulfilled" ? results[0].value : null;
            const allProgress = results[1].status === "fulfilled" ? results[1].value : null;

            if (tasks && tasks.length > 0) {
                appData.tasks = tasks;
            }

            if (!appData.logs) appData.logs = {};

            if (allProgress && allProgress.length > 0) {
                allProgress.forEach(row => {
                    appData.logs[row.date] = rowToLog(row);
                });
            }

            // Seed default tasks to Supabase if database has 0 tasks (B12 fix)
            if ((!appData.tasks || appData.tasks.length === 0) && DEFAULT_TASKS.length > 0) {
                appData.tasks = JSON.parse(JSON.stringify(DEFAULT_TASKS));
                for (const t of appData.tasks) {
                    await window.enjazAPI.createTask(t).catch(e => console.warn("[initData] Seed task error:", e.message));
                }
            }

            // Realtime WebSocket subscription
            window.enjazAPI.onUpdate((table, payload) => {
                if (table === APP_CONSTANTS.DB.TABLES.PROGRESS && payload.new?.date === currentDateStr) {
                    const row = payload.new;
                    if (!appData.logs) appData.logs = {};
                    appData.logs[currentDateStr] = {
                        ...appData.logs[currentDateStr],
                        ...rowToLog(row)
                    };
                    renderDailyView();
                    updateHeaderTodayScore();
                } else if (table === APP_CONSTANTS.DB.TABLES.TASKS) {
                    if (payload.eventType === "DELETE") {
                        appData.tasks = appData.tasks.filter(t => t.id !== payload.old?.task_id);
                    } else if (payload.new?.task_id) {
                        const row = payload.new;
                        const fields = {
                            name: row.name,
                            category: row.category,
                            subcategory: row.subcategory || null,
                            target: Number(row.target) || 1,
                            schedule: row.schedule || "Everyday",
                            isArchived: Boolean(row.is_archived)
                        };
                        const task = appData.tasks.find(t => t.id === row.task_id);
                        if (task) {
                            Object.assign(task, fields);
                        } else {
                            appData.tasks.push({ id: row.task_id, ...fields, createdAt: row.created_at });
                        }
                    }
                    renderDailyView();
                }
            });

            loaded = true;
            if (typeof updateCloudSyncUI === "function") {
                updateCloudSyncUI({
                    state: navigator.onLine ? "synced" : "offline",
                    message: navigator.onLine ? "متزامن سحابياً مع Supabase 24/7" : "وضع عدم الاتصال"
                });
            }
        } catch (err) {
            console.warn("[initData] Supabase initialization fallback:", err.message);
            if (typeof updateCloudSyncUI === "function") {
                updateCloudSyncUI({
                    state: "offline",
                    message: "وضع عدم الاتصال (محفوظ محلياً)"
                });
            }
        }
    }

    // 2. Fallback to localStorage if Supabase is offline/unconfigured
    if (!loaded) {
        try {
            const localSaved = localStorage.getItem(getUserStorageKey()) || localStorage.getItem(STORAGE_KEY);
            if (localSaved) {
                const parsed = JSON.parse(localSaved);
                if (parsed) {
                    if (parsed.categories) appData.categories = parsed.categories;
                    if (parsed.tasks) appData.tasks = parsed.tasks;
                    if (parsed.logs) appData.logs = parsed.logs;
                }
            }
        } catch (e) {
            console.error("[initData] LocalStorage error:", e);
        }
    }

    // 3. Fallback defaults if still empty
    if (!appData.tasks || appData.tasks.length === 0) {
        appData.tasks = JSON.parse(JSON.stringify(DEFAULT_TASKS));
    }

    window.appData = appData;
}

function loadDefaultAppData() {
    appData = {
        tasks: JSON.parse(JSON.stringify(DEFAULT_TASKS)),
        logs: {}
    };
    Object.defineProperty(appData, "categories", {
        get: () => APP_CONSTANTS.CATEGORIES,
        enumerable: false,
        configurable: true
    });
}

function saveData(immediate = false) {
    // 1. Offline resilient local backup
    try {
        localStorage.setItem(getUserStorageKey(), JSON.stringify(appData));
        if ((window.enjazAPI?.currentUser || "").toLowerCase() === APP_CONSTANTS.GUEST_USER) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
        }
    } catch (_) {}

    // 2. Direct database persistence via EnjazAPI
    if (window.enjazAPI?.client) {
        const curDate = currentDateStr;
        const log = (appData.logs && appData.logs[curDate]) || { entries: {} };
        const prayerExtras = log.prayerExtras || {};

        const totalScore = calculateDayScore(curDate, appData, false);
        const totalHours = calculateDayScore(curDate, appData, true);

        const taskProgress = {};
        (appData.tasks || []).forEach(t => {
            const val = (log.entries && log.entries[t.id]) || 0;
            const target = getTaskNormalizedTarget(t, curDate);
            taskProgress[t.id] = {
                target,
                achieved: val,
                hours: t.type === "ساعة" ? (val / 60) : 0,
                score: target > 0 ? (val / target) : 0
            };
        });

        const executeDbSave = () => {
            window.enjazAPI.saveDayProgress(curDate, taskProgress, prayerExtras, { totalScore, totalHours })
                .catch(e => console.warn("[EnjazAPI] Save progress error:", e.message));
        };

        if (immediate) {
            if (_dbSaveTimer) clearTimeout(_dbSaveTimer);
            executeDbSave();
        } else {
            if (_dbSaveTimer) clearTimeout(_dbSaveTimer);
            _dbSaveTimer = setTimeout(executeDbSave, APP_CONSTANTS.UI.SAVE_DEBOUNCE_MS);
        }
    }
}

const isTaskScheduledForDate = (task, dateStr, loggedVal = null) => ScheduleEngine.isTaskScheduledForDate(task, dateStr, appData, loggedVal);
const isBonusTaskForDate = (task, dateStr, loggedVal = null) => ScheduleEngine.isBonusTaskForDate(task, dateStr, appData, loggedVal);


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

    const btnHeaderPomo = document.getElementById("btn-open-header-pomo");
    if (btnHeaderPomo) {
        btnHeaderPomo.addEventListener("click", () => {
            openPomodoroModal();
        });
    }

    const btnHeaderWeekly = document.getElementById("btn-open-weekly-calc");
    if (btnHeaderWeekly) {
        btnHeaderWeekly.addEventListener("click", () => {
            showWeeklyHoursModal(true);
        });
    }
}

async function switchActiveDate(newDate) {
    currentDateStr = newDate;
    const datePicker = document.getElementById("date-picker-input");
    if (datePicker) datePicker.value = currentDateStr;

    if (window.enjazAPI?.client && (!appData.logs[currentDateStr] || !appData.logs[currentDateStr]._loadedFromDB)) {
        try {
            const dayProgress = await window.enjazAPI.getDayProgress(currentDateStr);
            if (dayProgress) {
                if (!appData.logs) appData.logs = {};
                appData.logs[currentDateStr] = rowToLog(dayProgress);
            }
        } catch (_) {}
    }
    renderDailyView();
}

function setupDailyControls() {
    const datePicker = document.getElementById("date-picker-input");
    if (datePicker) {
        datePicker.value = currentDateStr;
        datePicker.addEventListener("change", (e) => switchActiveDate(e.target.value));
    }

    const btnPrev = document.getElementById("btn-prev-day");
    if (btnPrev) btnPrev.addEventListener("click", () => switchActiveDate(addDays(currentDateStr, -1)));

    const btnNext = document.getElementById("btn-next-day");
    if (btnNext) btnNext.addEventListener("click", () => switchActiveDate(addDays(currentDateStr, 1)));

    const btnToday = document.getElementById("btn-jump-today");
    if (btnToday) btnToday.addEventListener("click", () => switchActiveDate(getLocalTodayString()));

    // Wire unified quick-add button
    const btnQuickAdd = document.getElementById("btn-open-quick-add");
    if (btnQuickAdd) btnQuickAdd.addEventListener("click", () => {
        openQuickAddModal();
    });
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

    // Update date header
    const dateTitle = document.getElementById("display-date-title");
    const hijriPill = document.getElementById("display-hijri-title");
    const hijri = getHijriDateDetails(currentDateStr);
    if (dateTitle) dateTitle.textContent = getArabicDateFormatted(currentDateStr);
    if (hijriPill) {
        let tagsHtml = "";
        if (hijri.isRamadan) tagsHtml += ` <span class="badge badge-emerald" style="font-size:0.75rem;">🌙 رمضان</span>`;
        if (hijri.isWhiteDay) tagsHtml += ` <span class="badge badge-gold" style="font-size:0.75rem;">⭐ الأيام البيض</span>`;
        const hijriText = hijri.formatted || "";
        hijriPill.innerHTML = `<i class="fa-solid fa-calendar-alt gold-text"></i> ${hijriText}${tagsHtml}`;
    }

    // Update Tomorrow Fasting Reminder banner (triggered the day before: Sunday for Monday, Wednesday for Thursday, and before each White Day)
    const fastingBanner = document.getElementById("tomorrow-fasting-banner");
    if (fastingBanner) {
        const tomorrowStr = addDays(currentDateStr, 1);
        if (tomorrowStr) {
            const tomorrowDayAbbrev = getDayOfWeekAbbrev(tomorrowStr);
            const tomorrowHijri = getHijriDateDetails(tomorrowStr);

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
                    titleText = `✨ تذكير: غداً صيام الإثنين ومن الأيام البيض (${tomorrowHijri.hDay} ${tomorrowHijri.monthName})`;
                    descText = `اجتماع فضيلتين: غداً الإثنين ومن الأيام البيض — لا تنسَ تبييت نية الصيام والسحور.`;
                    badgeText = "سُنة مؤكدة";
                } else if (isTomorrowThursday && isTomorrowWhiteDay) {
                    titleText = `✨ تذكير: غداً صيام الخميس ومن الأيام البيض (${tomorrowHijri.hDay} ${tomorrowHijri.monthName})`;
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
                    const whiteDayIndex = (tomorrowHijri.hDay === 13) ? "أول" : ((tomorrowHijri.hDay === 14) ? "ثاني" : "ثالث");
                    titleText = `🌕 تذكير: غداً صيام ${whiteDayIndex} الأيام البيض (${tomorrowHijri.hDay} ${tomorrowHijri.monthName})`;
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

    const allScheduled = appData.tasks.filter(t => ScheduleEngine.isVisibleOn(t, currentDateStr, appData));

    // Group all active tasks (pending & completed) by Category
    const disabledTasks = allScheduled.filter(t => disabledIds.includes(t.id));
    const activeTasks = allScheduled.filter(t => !disabledIds.includes(t.id));
    const activeItems = activeTasks.map(t => {
        const val = getTaskVal(t.id);
        const normTarget = getTaskNormalizedTarget(t, currentDateStr);
        const isDone = isTaskCompleted(t, val, currentDateStr);
        return { task: t, val, target: normTarget, isDone };
    });
    const categoryGroupMap = groupTasksByCategory(activeItems);

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
                const rawTarget = task.target || 0;
                const unit = getTaskUnit(task);
                const targetDisplay = rawTarget > 0 ? `(${rawTarget} ${unit})` : '';
                const controlsHtml = renderTaskControls(task, val, { compact: false });

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
                const unitLabel = isTimeTask(task) ? "دقيقة" : getTaskUnit(task);
                const targetStr = rawTarget > 0 ? `${val}/${target} ${unitLabel}` : `${val}`;
                const progressPct = target > 0 ? Math.min(100, Math.round((val / target) * 100)) : (val > 0 ? 100 : 0);
                const barColor = overTarget ? "#f59e0b" : "#10b981";
                const minControlsHtml = renderTaskControls(task, val, { compact: true });

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
                setTaskVal(taskId, parseFloat(valStr));
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
            toggleDeactivateTaskForDate(taskId, currentDateStr);
        });
    });

    // 8. Re-enable task
    grid.querySelectorAll("[data-reenable-id]").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const taskId = btn.getAttribute("data-reenable-id");
            toggleDeactivateTaskForDate(taskId, currentDateStr);
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
            openTaskModal(taskId);
        });
    });
}

function toggleDeactivateTaskForDate(taskId, dateStr) {
    if (!appData.logs[dateStr]) appData.logs[dateStr] = { entries: {}, disabledTaskIds: [] };
    const log = appData.logs[dateStr];
    if (!log.disabledTaskIds) log.disabledTaskIds = [];
    const idx = log.disabledTaskIds.indexOf(taskId);
    if (idx >= 0) log.disabledTaskIds.splice(idx, 1);
    else log.disabledTaskIds.push(taskId);
    saveData();
    renderDailyView();
    updateDailyScoreSummary();
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
    setTaskVal(taskId, Math.max(0, current + delta));
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

    const curDate = currentDateStr;
    const target = getTaskNormalizedTarget(task, curDate);
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
        const isTime = typeof isTimeTask === "function" ? isTimeTask(task) : false;
        const catObj = APP_CONSTANTS.CATEGORIES.find(c => c.name === task.category);
        const unitLabel = isTime ? "دقيقة" : (task.type || (catObj && catObj.defaultUnit) || "");
        const targetStr = rawTarget > 0 ? `${val}/${target} ${unitLabel}` : `${val}`;
        targetStrEl.textContent = `— ${targetStr}`;
    }

    const overTargetEl = card.querySelector(".over-target-badge-container");
    if (overTargetEl) {
        overTargetEl.innerHTML = overTarget ? '<span style="font-size:0.75rem; color:#f59e0b; background:rgba(245,158,11,0.15); padding:2px 6px; border-radius:8px;">⭐ تجاوز الهدف</span>' : '';
    }

    // 6. Update summary scores in real time
    updateDailyScoreSummary();
    updateHeaderTodayScore();

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

    if (isObligatoryPrayerTask(taskId) && val > 0) {
        checkAndShowNawafelPrompt(taskId);
    } else if (val > prevVal && isQiyamTask(taskId)) {
        checkAndShowQiyamPrompt();
    } else if (val === 0 && isObligatoryPrayerTask(taskId)) {
        removePrayerExtras(taskId);
    }
}

// ============================================================================
// SCORING ENGINE INTEGRATION & HELPERS
// ============================================================================
function getTaskWeightMinutes(task, dateStr = null) {
    return ScoringEngine.getTaskWeightMinutes(task, dateStr, appData);
}

function calculateDayScore(dateStr, appDataRef = null, returnHours = false) {
    return ScoringEngine.calculateDayScore(dateStr, appDataRef || appData, returnHours);
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
        const circumference = APP_CONSTANTS.UI.SCORE_RING_CIRCUMFERENCE;
        const offset = circumference - (clampedPct / 100) * circumference;
        ringCircle.style.strokeDashoffset = offset;
        const { GOLD, GREEN, BLUE } = APP_CONSTANTS.UI.SCORE_THRESHOLDS;
        ringCircle.style.stroke = scorePct >= GOLD ? "#f59e0b" : (scorePct >= GREEN ? "#10b981" : (scorePct >= BLUE ? "#3b82f6" : "#64748b"));
    }

    // Count completed tasks for the badge
    const allScheduled = appData.tasks.filter(t => ScheduleEngine.isVisibleOn(t, currentDateStr, appData));
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
        const isBonus = ScheduleEngine.isBonusTaskForDate(t, currentDateStr, appData);
        if (isBonus) return;

        const val = getTaskVal(t.id);
        const target = t.target || 0;

        if (isTimeTask(t)) {
            const normTarget = getTaskNormalizedTarget(t, currentDateStr);
            if (normTarget > 0 && val < normTarget) {
                totalRemainingMinutes += (normTarget - val);
            }
        } else {
            if (target > 0 && val < target) {
                const totalWeightMins = ScoringEngine.getTaskWeightMinutes(t, currentDateStr, appData);
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
