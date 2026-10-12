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

function updateStorageUIStatus(status) {
    // Cloud-only mode (Supabase)
}

function setupDataManagement() {

    const btnExport = document.getElementById("btn-export-json");
    if (btnExport) {
        btnExport.addEventListener("click", () => {
            const dataToSave = (typeof appData !== "undefined" && appData) ? appData : window.appData;
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToSave, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            const dateStr = (typeof getLocalTodayString === "function") ? getLocalTodayString() : new Date().toISOString().split("T")[0];
            downloadAnchor.setAttribute("download", `awrady_backup_${dateStr}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
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
                            appData.categories = (typeof APP_CONSTANTS !== "undefined" && APP_CONSTANTS.CATEGORIES) ? APP_CONSTANTS.CATEGORIES : [];
                        }
                        window.appData = appData;
                        saveData(true);
                        
                        renderDailyView();
                        if (typeof renderAllTimeStats === "function") renderAllTimeStats();
                        if (typeof updateChartAndAnalytics === "function") updateChartAndAnalytics();
                        if (typeof updateHeaderTodayScore === "function") updateHeaderTodayScore();
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
                appData.logs = {};
                saveData(true);
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
                alert("🔄 تم إعادة ضبط التطبيق بنجاح على البيانات الافتراضية!");
                location.reload();
            }
        });
    }

    // ------------------------------------------------------------------------
    // 24/7 CLOUD SYNC (SUPABASE) CONTROLS & STATUS
    // ------------------------------------------------------------------------
    // Clean up obsolete manual configuration keys from previous sessions
    try {
        localStorage.removeItem("AWRAD_SUPABASE_URL");
        localStorage.removeItem("AWRAD_SUPABASE_KEY");
        localStorage.removeItem("AWRAD_ACTIVE_USER");
    } catch (_) {}

    const headerCloudPill = document.getElementById("header-cloud-pill");
    const btnDownloadCloudBackup = document.getElementById("btn-download-cloud-backup");

    const refreshCloudStatus = () => {
        if (window.enjazAPI && window.enjazAPI.client) {
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

    window.addEventListener("online", refreshCloudStatus);
    window.addEventListener("offline", refreshCloudStatus);

    if (headerCloudPill) {
        headerCloudPill.addEventListener("click", async () => {
            if (!navigator.onLine) {
                alert("أنت حالياً في وضع عدم الاتصال (Offline). بياناتك محفوظة محلياً في هذا المتصفح وستتم مزامنتها تلقائياً فور عودة الاتصال بالسحابة.");
                return;
            }
            updateCloudSyncUI({ state: "syncing", message: "جارِ التحقق من المزامنة السحابية..." });
            try {
                if (window.enjazAPI && window.enjazAPI.client) {
                    const { error } = await window.enjazAPI.client.from("tasks").select("task_id").limit(1);
                    if (error) throw error;
                    updateCloudSyncUI({ state: "synced", message: "متزامن سحابياً مع Supabase 24/7" });
                } else if (window.enjazAPI && window.enjazAPI.init()) {
                    updateCloudSyncUI({ state: "synced", message: "متزامن سحابياً مع Supabase 24/7" });
                }
            } catch (err) {
                updateCloudSyncUI({ state: "offline", message: "تعذر الاتصال بالسحابة: " + err.message });
            }
        });
    }

    if (btnDownloadCloudBackup) {
        btnDownloadCloudBackup.addEventListener("click", () => {
            const currentData = (typeof appData !== "undefined" && appData) ? appData : window.appData;
            const jsonStr = JSON.stringify(currentData, null, 2);
            const blob = new Blob([jsonStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `awrady_backup_${new Date().toISOString().split("T")[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    // Initialize Cloud Status indicator
    refreshCloudStatus();

    // ------------------------------------------------------------------------
    // PIN SECURITY & ACCESS CONTROLS
    // ------------------------------------------------------------------------
    const btnQuickLockHeader = document.getElementById("btn-header-quick-lock");
    const btnLockNow = document.getElementById("btn-lock-app-now");
    const btnOpenChangePin = document.getElementById("btn-open-change-pin");
    const btnCloseChangePin = document.getElementById("btn-close-change-pin");
    const btnCancelChangePin = document.getElementById("btn-cancel-change-pin");
    const btnSubmitChangePin = document.getElementById("btn-submit-change-pin");
    const btnDisablePin = document.getElementById("btn-disable-pin");
    const changePinModal = document.getElementById("change-pin-modal");
    const inputOldPin = document.getElementById("input-old-pin");
    const inputNewPin = document.getElementById("input-new-pin");
    const inputConfirmPin = document.getElementById("input-confirm-new-pin");
    const pinBadge = document.getElementById("pin-security-status-badge");
    const pinBadgeText = document.getElementById("pin-security-status-text");
    const groupCurrentPin = document.getElementById("group-current-pin");

    const updatePinUIStatus = () => {
        if (!pinBadge || !pinBadgeText) return;
        const isSet = window.securityLock && window.securityLock.isPinSet();
        if (isSet) {
            pinBadge.style.background = "rgba(168, 85, 247, 0.15)";
            pinBadge.style.color = "#c084fc";
            pinBadge.style.borderColor = "rgba(168, 85, 247, 0.3)";
            pinBadgeText.innerHTML = `<i class="fa-solid fa-lock"></i> حماية رمز المرور مفعلة`;
            if (btnDisablePin) btnDisablePin.style.display = "inline-flex";
            if (btnOpenChangePin && btnOpenChangePin.querySelector("span")) {
                btnOpenChangePin.querySelector("span").textContent = "تغيير رمز المرور (PIN)";
            }
            if (groupCurrentPin) groupCurrentPin.style.display = "block";
        } else {
            pinBadge.style.background = "rgba(245, 158, 11, 0.15)";
            pinBadge.style.color = "#f59e0b";
            pinBadge.style.borderColor = "rgba(245, 158, 11, 0.3)";
            pinBadgeText.innerHTML = `<i class="fa-solid fa-lock-open"></i> الحماية غير مفعلة`;
            if (btnDisablePin) btnDisablePin.style.display = "none";
            if (btnOpenChangePin && btnOpenChangePin.querySelector("span")) {
                btnOpenChangePin.querySelector("span").textContent = "تعيين رمز مرور جديد (PIN)";
            }
            if (groupCurrentPin) groupCurrentPin.style.display = "none";
        }
    };

    updatePinUIStatus();

    const doLock = () => {
        if (window.securityLock) {
            window.securityLock.lockNow();
        }
    };

    if (btnQuickLockHeader) btnQuickLockHeader.addEventListener("click", doLock);
    if (btnLockNow) btnLockNow.addEventListener("click", doLock);

    const openPinModal = () => {
        if (!changePinModal) return;
        if (inputOldPin) inputOldPin.value = "";
        if (inputNewPin) inputNewPin.value = "";
        if (inputConfirmPin) inputConfirmPin.value = "";
        updatePinUIStatus();
        changePinModal.classList.remove("hidden");
    };

    const closePinModal = () => {
        if (changePinModal) changePinModal.classList.add("hidden");
    };

    if (btnOpenChangePin) btnOpenChangePin.addEventListener("click", openPinModal);
    if (btnCloseChangePin) btnCloseChangePin.addEventListener("click", closePinModal);
    if (btnCancelChangePin) btnCancelChangePin.addEventListener("click", closePinModal);

    if (btnSubmitChangePin) {
        btnSubmitChangePin.addEventListener("click", async () => {
            const isSet = window.securityLock && window.securityLock.isPinSet();
            const oldPin = inputOldPin ? inputOldPin.value.trim() : "";
            const newPin = inputNewPin ? inputNewPin.value.trim() : "";
            const confirmPin = inputConfirmPin ? inputConfirmPin.value.trim() : "";

            if (isSet && !oldPin) {
                alert("يرجى إدخال رمز المرور الحالي.");
                return;
            }
            if (!newPin || newPin.length < 4) {
                alert("يجب أن يتكون رمز المرور الجديد من 4 أرقام على الأقل.");
                return;
            }
            if (newPin !== confirmPin) {
                alert("رمز المرور الجديد وتأكيده غير متطابقين.");
                return;
            }

            if (window.securityLock) {
                const res = await window.securityLock.changePin(oldPin, newPin);
                if (res.success) {
                    alert(res.message);
                    closePinModal();
                    updatePinUIStatus();
                } else {
                    alert("❌ " + res.message);
                }
            }
        });
    }

    if (btnDisablePin) {
        btnDisablePin.addEventListener("click", async () => {
            const currentPin = prompt("أدخل رمز المرور الحالي لإلغاء الحماية:");
            if (!currentPin) return;

            if (window.securityLock) {
                const res = await window.securityLock.removePinProtection(currentPin);
                if (res.success) {
                    alert("🔓 تم إلغاء حماية رمز المرور بنجاح.");
                    updatePinUIStatus();
                } else {
                    alert("❌ " + res.message);
                }
            }
        });
    }
}
