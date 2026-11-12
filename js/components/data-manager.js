/**
 * ============================================================================
 * AWRAD PRO - DATA MANAGER COMPONENT
 * Handles file storage connection, JSON export/import, backups, and data resets.
 * ============================================================================
 */

/**
 * Update 24/7 Cloud Sync UI status badge & header pill
 */
function updateCloudSyncUI(syncInfo) {
    if (!syncInfo) return;
    const headerPill = document.getElementById("header-cloud-pill");
    const headerIcon = document.getElementById("header-cloud-icon");
    const headerText = document.getElementById("header-cloud-text");
    const badge = document.getElementById("cloud-sync-status-badge");
    const badgeText = document.getElementById("cloud-sync-status-text");

    const state = syncInfo.state; // 'synced', 'syncing', 'offline', 'disconnected', 'idle'

    if (state === "synced") {
        if (headerPill) {
            headerPill.className = "stat-pill glass-card sync-status-pill sync-active";
            headerPill.title = syncInfo.message || "متزامن مع السحابة 24/7";
        }
        if (headerIcon) headerIcon.innerHTML = `<i class="fa-solid fa-cloud-bolt" style="color:#10b981;"></i>`;
        if (headerText) {
            headerText.textContent = "سحابي ⚡";
            headerText.style.color = "#10b981";
        }
        if (badge) {
            badge.style.background = "rgba(16, 185, 129, 0.15)";
            badge.style.color = "#10b981";
            badge.style.borderColor = "rgba(16, 185, 129, 0.3)";
        }
        if (badgeText) badgeText.innerHTML = `<i class="fa-solid fa-cloud-bolt"></i> متزامن سحابياً 24/7`;
    } else if (state === "syncing") {
        if (headerPill) {
            headerPill.className = "stat-pill glass-card sync-status-pill sync-pulse";
            headerPill.title = syncInfo.message || "جارِ مزامنة التغييرات...";
        }
        if (headerIcon) headerIcon.innerHTML = `<i class="fa-solid fa-arrows-rotate fa-spin" style="color:#f59e0b;"></i>`;
        if (headerText) {
            headerText.textContent = "مزامنة...";
            headerText.style.color = "#f59e0b";
        }
        if (badge) {
            badge.style.background = "rgba(245, 158, 11, 0.15)";
            badge.style.color = "#f59e0b";
            badge.style.borderColor = "rgba(245, 158, 11, 0.3)";
        }
        if (badgeText) badgeText.innerHTML = `<i class="fa-solid fa-arrows-rotate fa-spin"></i> جارِ رفع التحديثات...`;
    } else if (state === "offline") {
        if (headerPill) {
            headerPill.className = "stat-pill glass-card sync-status-pill sync-offline";
            headerPill.title = syncInfo.message || "وضع عدم الاتصال (محفوظ محلياً)";
        }
        if (headerIcon) headerIcon.innerHTML = `<i class="fa-solid fa-cloud-slash" style="color:#ef4444;"></i>`;
        if (headerText) {
            headerText.textContent = "أوفلاين";
            headerText.style.color = "#ef4444";
        }
        if (badge) {
            badge.style.background = "rgba(239, 68, 68, 0.15)";
            badge.style.color = "#ef4444";
            badge.style.borderColor = "rgba(239, 68, 68, 0.3)";
        }
        if (badgeText) badgeText.innerHTML = `<i class="fa-solid fa-cloud-slash"></i> غير متصل (تخزين محلي)`;
    } else {
        if (headerPill) {
            headerPill.className = "stat-pill glass-card sync-status-pill";
            headerPill.title = syncInfo.message || "تخزين محلي (غير مقترن بالسحابة)";
        }
        if (headerIcon) headerIcon.innerHTML = `<i class="fa-solid fa-cloud" style="color:#94a3b8;"></i>`;
        if (headerText) {
            headerText.textContent = "محلي";
            headerText.style.color = "#94a3b8";
        }
        if (badge) {
            badge.style.background = "rgba(255, 255, 255, 0.08)";
            badge.style.color = "#94a3b8";
            badge.style.borderColor = "rgba(255, 255, 255, 0.15)";
        }
        if (badgeText) badgeText.innerHTML = `<i class="fa-solid fa-cloud"></i> تخزين محلي (غير مقترن بالسحابة)`;
    }
}

function setupDataManagement() {

    const btnExport = document.getElementById("btn-export-json");
    if (btnExport) {
        btnExport.addEventListener("click", () => {
            const blob = new Blob([JSON.stringify(appData, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `awrady_backup_${getLocalTodayString()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    const inputImport = document.getElementById("input-import-json");
    if (inputImport) {
        inputImport.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = async function(event) {
                try {
                    const imported = JSON.parse(event.target.result);
                    if (imported && imported.tasks && imported.logs) {
                        appData = imported;
                        if (!appData.categories || appData.categories.length === 0) {
                            appData.categories = APP_CONSTANTS.CATEGORIES;
                        }
                        window.appData = appData;
                        saveData(true);
                        if (window.awradyAPI?.client) {
                            try {
                                await window.awradyAPI.saveTasks(appData.tasks || []);
                            } catch (e) {
                                console.warn("[AwradyAPI] Import tasks sync error:", e);
                            }
                        }
                        
                        renderDailyView();
                        renderAllTimeStats();
                        updateChartAndAnalytics();
                        updateHeaderTodayScore();
                        alert("✅ تم استعادة النسخة الاحتياطية بنجاح ومزامنتها مع قاعدة البيانات!");
                    } else {
                        alert("❌ ملف JSON غير صحيح أو مفقود للبنية.");
                    }
                } catch (err) {
                    alert("❌ حدث خطأ أثناء قراءة ملف JSON: " + err.message);
                }
            };
            reader.readAsText(file);
        });
    }

    const btnResetProgress = document.getElementById("btn-reset-progress");
    if (btnResetProgress) {
        btnResetProgress.addEventListener("click", async () => {
            if (confirm("هل أنت متأكد من مسح جميع السجلات ونقاط الإنجاز التاريخية؟ (ستبقى المهام والتصنيفات كما هي)")) {
                if (typeof _dbSaveTimer !== "undefined" && _dbSaveTimer) {
                    clearTimeout(_dbSaveTimer);
                }
                appData.logs = {};
                try {
                    localStorage.setItem(getUserStorageKey(), JSON.stringify(appData));
                } catch (_) {}
                if (window.awradyAPI?.client) {
                    try {
                        await window.awradyAPI.client.from(APP_CONSTANTS.DB.TABLES.PROGRESS).delete().eq("username", window.awradyAPI.currentUser);
                    } catch (e) {
                        console.warn("[AwradyAPI] Reset progress sync error:", e);
                    }
                }
                alert("🧹 تم مسح سجلات الإنجاز بنجاح!");
                location.reload();
            }
        });
    }

    const btnResetData = document.getElementById("btn-reset-data");
    if (btnResetData) {
        btnResetData.addEventListener("click", async () => {
            if (confirm("هل أنت متأكد من إعادة ضبط التعديلات واستعادة البيانات والمهام الافتراضية للنظام؟")) {
                loadDefaultAppData();
                saveData(true);
                if (window.awradyAPI?.client) {
                    try {
                        await window.awradyAPI.saveTasks(appData.tasks || []);
                    } catch (e) {
                        console.warn("[AwradyAPI] Reset tasks sync error:", e);
                    }
                }
                alert("🔄 تم إعادة ضبط التطبيق بنجاح على البيانات الافتراضية!");
                location.reload();
            }
        });
    }

    // ------------------------------------------------------------------------
    // 24/7 CLOUD SYNC (SUPABASE) CONTROLS & STATUS
    // ------------------------------------------------------------------------
    const headerCloudPill = document.getElementById("header-cloud-pill");

    const refreshCloudStatus = () => {
        if (window.awradyAPI && window.awradyAPI.client) {
            updateCloudSyncUI({
                state: navigator.onLine ? "synced" : "offline",
                message: navigator.onLine ? "متزامن سحابياً مع Supabase 24/7" : "وضع عدم الاتصال (محفوظ محلياً)"
            });
        } else {
            updateCloudSyncUI({
                state: "idle",
                message: "وضع عدم الاتصال (محفوظ محلياً)"
            });
        }
    };

    window.addEventListener("online", () => {
        refreshCloudStatus();
        if (typeof pushDayToCloud === "function" && typeof currentDateStr !== "undefined") {
            pushDayToCloud(currentDateStr);
        }
    });
    window.addEventListener("offline", refreshCloudStatus);

    if (headerCloudPill) {
        headerCloudPill.addEventListener("click", async () => {
            if (!navigator.onLine) {
                alert("أنت حالياً في وضع عدم الاتصال (Offline). بياناتك محفوظة محلياً في هذا المتصفح وستتم مزامنتها تلقائياً فور عودة الاتصال بالسحابة.");
                return;
            }
            updateCloudSyncUI({ state: "syncing", message: "جارِ التحقق من المزامنة السحابية..." });
            try {
                if (window.awradyAPI && window.awradyAPI.client) {
                    const { error } = await window.awradyAPI.client.from(APP_CONSTANTS.DB.TABLES.TASKS).select("task_id").limit(1);
                    if (error) throw error;
                    updateCloudSyncUI({ state: "synced", message: "متزامن سحابياً مع Supabase 24/7" });
                } else if (window.awradyAPI && window.awradyAPI.init()) {
                    updateCloudSyncUI({ state: "synced", message: "متزامن سحابياً مع Supabase 24/7" });
                }
            } catch (err) {
                updateCloudSyncUI({ state: "offline", message: "تعذر الاتصال بالسحابة: " + err.message });
            }
        });
    }

    // Initialize Cloud Status indicator
    refreshCloudStatus();
}
