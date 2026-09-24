/**
 * ============================================================================
 * AWRAD PRO - DATA MANAGER COMPONENT
 * Handles file storage connection, JSON export/import, backups, and data resets.
 * ============================================================================
 */

function updateStorageUIStatus(status) {
    const pillText = document.getElementById("header-storage-text");
    const pillIcon = document.getElementById("header-storage-icon");
    const syncBadge = document.getElementById("file-sync-status-badge");
    const syncText = document.getElementById("file-sync-status-text");
    const fileInfoBox = document.getElementById("connected-file-info");
    const fileNameText = document.getElementById("connected-filename-text");
    const btnConnect = document.getElementById("btn-connect-local-file");
    const btnDisconnect = document.getElementById("btn-disconnect-local-file");
    const promptBanner = document.getElementById("disk-storage-prompt-banner");

    const lockModal = document.getElementById("file-permission-lock-modal");
    const lockModalFileName = document.getElementById("lock-modal-file-name");

    if (lockModal) {
        if (status.mode === "file_pending_permission") {
            lockModal.classList.remove("hidden");
            if (lockModalFileName) lockModalFileName.textContent = `اسم الملف: "${status.fileName || 'ملف محلي'}"`;
        } else {
            lockModal.classList.add("hidden");
        }
    }

    if (status.mode === "file") {
        if (promptBanner) promptBanner.style.display = "none";
        if (pillText) pillText.textContent = "ملف محلي 💾";
        if (pillIcon) pillIcon.innerHTML = `<i class="fa-solid fa-hard-drive" style="color:#10b981;"></i>`;
        
        if (syncBadge) {
            syncBadge.style.background = "rgba(16, 185, 129, 0.15)";
            syncBadge.style.color = "#10b981";
            syncBadge.style.borderColor = "rgba(16, 185, 129, 0.3)";
        }
        if (syncText) syncText.innerHTML = `<i class="fa-solid fa-circle-check"></i> مرتبط بملف الهارد ديسك`;
        if (fileInfoBox) fileInfoBox.style.display = "block";
        if (fileNameText) fileNameText.textContent = status.fileName || "ملف محلي (.json)";
        if (btnConnect && btnConnect.querySelector("span")) {
            btnConnect.querySelector("span").textContent = "تغيير ملف الحفظ المحلي";
        }
        if (btnDisconnect) btnDisconnect.style.display = "inline-flex";
    } else if (status.mode === "file_pending_permission") {
        if (promptBanner) {
            promptBanner.style.display = "flex";
            const bannerTitle = promptBanner.querySelector("h4");
            const bannerDesc = promptBanner.querySelector("p");
            const bannerBtnSpan = promptBanner.querySelector("#btn-banner-connect-disk span");
            const bannerBtnIcon = promptBanner.querySelector("#btn-banner-connect-disk i");
            if (bannerTitle) bannerTitle.textContent = `ملف البيانات المقترن بحاجة لإذنك: "${status.fileName || 'ملف محلي'}" 🔑`;
            if (bannerDesc) bannerDesc.textContent = `انقر على الزر لتأكيد السماح وقراءة البيانات المحدثة مباشرة من الملف على جهازك.`;
            if (bannerBtnSpan) bannerBtnSpan.textContent = "تأكيد الإذن وقراءة بيانات الملف الآن";
            if (bannerBtnIcon) bannerBtnIcon.className = "fa-solid fa-key";
        }
        if (pillText) pillText.textContent = "تأكيد الملف 🔑";
        if (pillIcon) pillIcon.innerHTML = `<i class="fa-solid fa-key" style="color:#f59e0b;"></i>`;
        
        if (syncBadge) {
            syncBadge.style.background = "rgba(245, 158, 11, 0.15)";
            syncBadge.style.color = "#f59e0b";
            syncBadge.style.borderColor = "rgba(245, 158, 11, 0.3)";
        }
        if (syncText) syncText.innerHTML = `<i class="fa-solid fa-key"></i> بانتظار تأكيد إذن الملف`;
        if (fileInfoBox) fileInfoBox.style.display = "block";
        if (fileNameText) fileNameText.textContent = (status.fileName || "ملف محلي (.json)") + " (بانتظار التأكيد)";
        if (btnConnect && btnConnect.querySelector("span")) {
            btnConnect.querySelector("span").textContent = "تأكيد إذن الملف المرتبط";
        }
        if (btnDisconnect) btnDisconnect.style.display = "inline-flex";
    } else if (status.mode === "server") {
        if (promptBanner) promptBanner.style.display = "none";
        if (pillText) pillText.textContent = "سيرفر محلي 🖥️";
        if (pillIcon) pillIcon.innerHTML = `<i class="fa-solid fa-server" style="color:#3b82f6;"></i>`;
        
        if (syncBadge) {
            syncBadge.style.background = "rgba(59, 130, 246, 0.15)";
            syncBadge.style.color = "#3b82f6";
            syncBadge.style.borderColor = "rgba(59, 130, 246, 0.3)";
        }
        if (syncText) syncText.innerHTML = `<i class="fa-solid fa-server"></i> مرتبط بسيرفر Node.js محلي`;
        if (fileInfoBox) fileInfoBox.style.display = "none";
        if (btnDisconnect) btnDisconnect.style.display = "none";
    } else {
        if (promptBanner) {
            promptBanner.style.display = "flex";
            const bannerTitle = promptBanner.querySelector("h4");
            const bannerDesc = promptBanner.querySelector("p");
            const bannerBtnSpan = promptBanner.querySelector("#btn-banner-connect-disk span");
            const bannerBtnIcon = promptBanner.querySelector("#btn-banner-connect-disk i");
            if (bannerTitle) bannerTitle.textContent = "احمِ بياناتك من مسح المتصفح نهائياً!";
            if (bannerDesc) bannerDesc.textContent = "قم بربط التخزين المباشر بملف على جهازك لتعمل البيانات وتُحفظ كملف حقيقي على الهارد ديسك.";
            if (bannerBtnSpan) bannerBtnSpan.textContent = "ربط ملف التخزين على الجهاز الآن";
            if (bannerBtnIcon) bannerBtnIcon.className = "fa-solid fa-hard-drive";
        }
        if (pillText) pillText.textContent = "متصفح 🔒";
        if (pillIcon) pillIcon.innerHTML = `<i class="fa-solid fa-shield-halved" style="color:#f59e0b;"></i>`;
        
        if (syncBadge) {
            syncBadge.style.background = "rgba(245, 158, 11, 0.15)";
            syncBadge.style.color = "#f59e0b";
            syncBadge.style.borderColor = "rgba(245, 158, 11, 0.3)";
        }
        if (syncText) syncText.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> تخزين المتصفح المؤقت`;
        if (fileInfoBox) fileInfoBox.style.display = "none";
        if (btnConnect && btnConnect.querySelector("span")) {
            btnConnect.querySelector("span").textContent = "ربط / إنشاء ملف حفظ على الكمبيوتر";
        }
        if (btnDisconnect) btnDisconnect.style.display = "none";
    }
}

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
    const btnConnectFile = document.getElementById("btn-connect-local-file");
    const btnBannerConnect = document.getElementById("btn-banner-connect-disk");
    const btnDisconnectFile = document.getElementById("btn-disconnect-local-file");
    const headerStoragePill = document.getElementById("header-storage-pill");

    const triggerConnectFlow = async () => {
        if (window.storageEngine && window.storageEngine.storageMode === "file_pending_permission") {
            const confirmed = await window.storageEngine.confirmFilePermission();
            if (confirmed) {
                const loaded = await window.storageEngine.loadData(STORAGE_KEY);
                if (loaded) {
                    appData = loaded;
                    window.appData = appData;
                    if (window.stateManager) window.stateManager.data = loaded;
                }
                renderDailyView();
                renderAllTimeStats();
                updateHeaderTodayScore();
                alert("🎉 تم تأكيد وتفعيل إذن الملف المحلي وقراءة البيانات المحدثة بنجاح من الهارد ديسك!");
                return;
            }
        }
        
        if (window.storageEngine) {
            const res = await window.storageEngine.connectLocalFile();
            if (res && res.success) {
                if (!res.isNew) {
                    const loaded = await window.storageEngine.loadData(STORAGE_KEY);
                    if (loaded) {
                        appData = loaded;
                        window.appData = appData;
                        if (window.stateManager) window.stateManager.data = loaded;
                    }
                } else {
                    saveData();
                }
                renderDailyView();
                renderAllTimeStats();
                updateHeaderTodayScore();
                alert("🎉 تم ربط التطبيق بملف الحفظ على جهازك بنجاح وقراءة البيانات من الملف!");
            }
        }
    };

    const btnLockConfirm = document.getElementById("btn-lock-confirm-perm");
    const btnLockDisconnect = document.getElementById("btn-lock-disconnect-file");

    if (btnConnectFile) {
        btnConnectFile.addEventListener("click", triggerConnectFlow);
    }
    if (btnBannerConnect) {
        btnBannerConnect.addEventListener("click", triggerConnectFlow);
    }
    if (btnLockConfirm) {
        btnLockConfirm.addEventListener("click", triggerConnectFlow);
    }
    const lockModalEl = document.getElementById("file-permission-lock-modal");
    if (lockModalEl) {
        lockModalEl.addEventListener("click", (e) => {
            if (e.target.id === "btn-lock-disconnect-file" || e.target.closest("#btn-lock-disconnect-file")) return;
            triggerConnectFlow();
        });
    }
    if (btnLockDisconnect) {
        btnLockDisconnect.addEventListener("click", async () => {
            if (confirm("هل تريد إلغاء ربط ملف الكمبيوتر والاعتماد على تخزين المتصفح فقط؟")) {
                if (window.storageEngine) await window.storageEngine.clearFileHandle();
                const lockModal = document.getElementById("file-permission-lock-modal");
                if (lockModal) lockModal.classList.add("hidden");
                saveData(true);
                renderDailyView();
                alert("تم إلغاء ربط الملف المحفوظ وتفعيل تخزين المتصفح.");
            }
        });
    }

    if (btnDisconnectFile) {
        btnDisconnectFile.addEventListener("click", async () => {
            if (confirm("هل أنت متأكد من إلغاء ربط الملف المحلي الحالي والعودة للتخزين داخل المتصفح؟")) {
                if (window.storageEngine) await window.storageEngine.clearFileHandle();
                alert("تم إلغاء ربط الملف المحلي.");
            }
        });
    }

    if (headerStoragePill) {
        headerStoragePill.addEventListener("click", () => {
            document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
            document.querySelectorAll(".tab-view").forEach(v => v.classList.remove("active"));
            const dataTabBtn = document.querySelector('.nav-tab[data-tab="view-data"]');
            const dataViewSec = document.getElementById("view-data");
            if (dataTabBtn) dataTabBtn.classList.add("active");
            if (dataViewSec) dataViewSec.classList.add("active");
        });
    }

    const btnExport = document.getElementById("btn-export-json");
    if (btnExport) {
        btnExport.addEventListener("click", () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `awrad_backup_${getLocalTodayString()}.json`);
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
            reader.onload = function(event) {
                try {
                    const imported = JSON.parse(event.target.result);
                    if (imported && imported.tasks && imported.logs) {
                        appData = imported;
                        if (!appData.categories || appData.categories.length === 0) {
                            appData.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
                        }
                        window.appData = appData;
                        saveData();
                        renderDailyView();
                        if (typeof renderAllTimeStats === "function") renderAllTimeStats();
                        if (typeof updateChartAndAnalytics === "function") updateChartAndAnalytics();
                        if (typeof updateHeaderTodayScore === "function") updateHeaderTodayScore();
                        alert("✅ تم استعادة النسخة الاحتياطية بنجاح وتحديث جداولك!");
                    } else {
                        alert("❌ ملف JSON غير صحيح أو مفقود للبنية.");
                    }
                } catch (err) {
                    alert("❌ حدث خطأ أثناء قراءة ملف JSON.");
                }
            };
            reader.readAsText(file);
        });
    }

    const btnResetProgress = document.getElementById("btn-reset-progress");
    if (btnResetProgress) {
        btnResetProgress.addEventListener("click", () => {
            if (confirm("هل أنت متأكد من مسح جميع السجلات ونقاط الإنجاز التاريخية؟ (ستبقى المهام والتصنيفات كما هي)")) {
                appData.logs = {};
                saveData();
                alert("🧹 تم مسح سجلات الإنجاز بنجاح!");
                location.reload();
            }
        });
    }

    const btnResetData = document.getElementById("btn-reset-data");
    if (btnResetData) {
        btnResetData.addEventListener("click", () => {
            if (confirm("هل أنت متأكد من إعادة ضبط التعديلات واستعادة البيانات والمهام الافتراضية الملحقة بالنظام؟")) {
                localStorage.removeItem(STORAGE_KEY);
                alert("🔄 تم إعادة ضبط التطبيق بنجاح على السجلات والبيانات الافتراضية!");
                location.reload();
            }
        });
    }

    // ------------------------------------------------------------------------
    // 24/7 CLOUD SYNC (SUPABASE) CONTROLS & MODAL
    // ------------------------------------------------------------------------
    const cloudModal = document.getElementById("cloud-config-modal");
    const btnOpenCloudModal = document.getElementById("btn-open-cloud-config");
    const btnCloseCloudModal = document.getElementById("btn-close-cloud-config");
    const headerCloudPill = document.getElementById("header-cloud-pill");
    const inputSupabaseUrl = document.getElementById("input-supabase-url");
    const inputSupabaseKey = document.getElementById("input-supabase-key");
    const inputSupabaseUser = document.getElementById("input-supabase-userid");
    const btnTestCloud = document.getElementById("btn-test-cloud-conn");
    const btnSaveCloud = document.getElementById("btn-save-cloud-config");
    const btnClearCloud = document.getElementById("btn-clear-cloud-config");
    const cloudTestResult = document.getElementById("cloud-test-result");
    const btnUploadLocalToCloud = document.getElementById("btn-upload-local-to-cloud");
    const btnDownloadCloudBackup = document.getElementById("btn-download-cloud-backup");

    const openCloudModal = () => {
        if (!cloudModal) return;
        if (window.cloudAdapter) {
            const cfg = window.cloudAdapter.config;
            if (inputSupabaseUrl) inputSupabaseUrl.value = cfg.url || "";
            if (inputSupabaseKey) inputSupabaseKey.value = cfg.anonKey || "";
            if (inputSupabaseUser) inputSupabaseUser.value = cfg.userId || "primary_user";
        }
        if (cloudTestResult) {
            cloudTestResult.style.display = "none";
            cloudTestResult.innerHTML = "";
        }
        cloudModal.classList.remove("hidden");
    };

    const closeCloudModal = () => {
        if (cloudModal) cloudModal.classList.add("hidden");
    };

    if (headerCloudPill) {
        headerCloudPill.addEventListener("click", openCloudModal);
    }
    if (btnOpenCloudModal) {
        btnOpenCloudModal.addEventListener("click", openCloudModal);
    }
    if (btnCloseCloudModal) {
        btnCloseCloudModal.addEventListener("click", closeCloudModal);
    }

    if (btnTestCloud) {
        btnTestCloud.addEventListener("click", async () => {
            const url = inputSupabaseUrl ? inputSupabaseUrl.value.trim() : "";
            const key = inputSupabaseKey ? inputSupabaseKey.value.trim() : "";
            const user = inputSupabaseUser ? inputSupabaseUser.value.trim() : "primary_user";

            if (!url || !key) {
                alert("يرجى إدخال رابط المشروع والمفتاح أولاً.");
                return;
            }

            btnTestCloud.disabled = true;
            btnTestCloud.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> جارِ الفحص...`;
            if (cloudTestResult) {
                cloudTestResult.style.display = "block";
                cloudTestResult.style.background = "rgba(59, 130, 246, 0.15)";
                cloudTestResult.style.color = "#60a5fa";
                cloudTestResult.textContent = "جارِ اختبار الاتصال بـ Supabase...";
            }

            const origConfig = window.cloudAdapter ? { ...window.cloudAdapter.config } : null;
            if (window.cloudAdapter) {
                window.cloudAdapter.config = { url, anonKey: key, userId: user };
                window.cloudAdapter.initClient();
                const res = await window.cloudAdapter.testConnection();
                if (res.success) {
                    if (cloudTestResult) {
                        cloudTestResult.style.background = "rgba(16, 185, 129, 0.15)";
                        cloudTestResult.style.color = "#10b981";
                        cloudTestResult.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${res.message}`;
                    }
                } else {
                    if (cloudTestResult) {
                        cloudTestResult.style.background = "rgba(239, 68, 68, 0.15)";
                        cloudTestResult.style.color = "#ef4444";
                        cloudTestResult.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> ${res.message}`;
                    }
                    if (origConfig) window.cloudAdapter.config = origConfig;
                }
            }

            btnTestCloud.disabled = false;
            btnTestCloud.innerHTML = `<i class="fa-solid fa-plug"></i> فحص الاتصال`;
        });
    }

    if (btnSaveCloud) {
        btnSaveCloud.addEventListener("click", async () => {
            const url = inputSupabaseUrl ? inputSupabaseUrl.value.trim() : "";
            const key = inputSupabaseKey ? inputSupabaseKey.value.trim() : "";
            const user = inputSupabaseUser ? inputSupabaseUser.value.trim() : "primary_user";

            if (!url || !key) {
                alert("يرجى إدخال رابط المشروع ومفتاح anon صالحين.");
                return;
            }

            btnSaveCloud.disabled = true;
            btnSaveCloud.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> جارِ الحفظ والتحقق...`;

            if (window.cloudAdapter) {
                window.cloudAdapter.saveCredentials(url, key, user);
                const test = await window.cloudAdapter.testConnection();
                if (!test.success && test.needsSchema) {
                    alert("⚠️ تحذير: تم حفظ المفاتيح ولكن جدول enjaz_sync غير موجود في Supabase بعد.\n\nيرجى فتح SQL Editor في Supabase وتشغيل كود Data/supabase_schema.sql.");
                } else if (!test.success) {
                    alert("⚠️ تم حفظ المفاتيح، ولكن فحص الاتصال أظهر:\n" + test.message);
                } else {
                    alert("🎉 تم ربط وتفعيل المزامنة السحابية 24/7 بنجاح! ⚡");
                    
                    if (confirm("هل تريد رفع بياناتك الحالية الآن إلى السحابة لتكون متاحة فوراً على هاتفك؟")) {
                        const currentData = (window.stateManager && window.stateManager.data) ? window.stateManager.data : window.appData;
                        await window.cloudAdapter.saveDataImmediate(currentData);
                        alert("☁️ تم رفع وتحديث البيانات في السحابة بنجاح!");
                    }
                }
            }

            btnSaveCloud.disabled = false;
            btnSaveCloud.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> حفظ وتفعيل السحابة`;
            closeCloudModal();
        });
    }

    if (btnClearCloud) {
        btnClearCloud.addEventListener("click", () => {
            if (confirm("هل أنت متأكد من فصل المزامنة السحابية وإزالة المفاتيح من هذا المتصفح؟\n(بياناتك المحلية لن تتأثر)")) {
                if (window.cloudAdapter) {
                    window.cloudAdapter.clearCredentials();
                }
                closeCloudModal();
                alert("تم فصل السحابة بنجاح والرجوع للتخزين المحلي.");
            }
        });
    }

    if (btnUploadLocalToCloud) {
        btnUploadLocalToCloud.addEventListener("click", async () => {
            if (!window.cloudAdapter || !window.cloudAdapter.isConfigured()) {
                alert("يرجى ضبط وتفعيل إعدادات السحابة أولاً.");
                openCloudModal();
                return;
            }
            if (confirm("هل تريد رفع كامل بياناتك المحلية الحالية لتحديث السحابة بها؟")) {
                btnUploadLocalToCloud.disabled = true;
                btnUploadLocalToCloud.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> جارِ الرفع...`;
                const currentData = (window.stateManager && window.stateManager.data) ? window.stateManager.data : window.appData;
                const ok = await window.cloudAdapter.saveDataImmediate(currentData);
                btnUploadLocalToCloud.disabled = false;
                btnUploadLocalToCloud.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> <span>رفع بيانات الهاردسك للسحابة الآن</span>`;
                if (ok) {
                    alert("🎉 تم رفع بياناتك وتحديث قاعدة البيانات السحابية بنجاح!");
                } else {
                    alert("❌ تعذر الرفع إلى السحابة. تأكد من اتصال الإنترنت وصلاحية المفاتيح.");
                }
            }
        });
    }

    if (btnDownloadCloudBackup) {
        btnDownloadCloudBackup.addEventListener("click", () => {
            const currentData = (window.stateManager && window.stateManager.data) ? window.stateManager.data : window.appData;
            if (window.storageEngine && typeof window.storageEngine.downloadBackupFile === "function") {
                window.storageEngine.downloadBackupFile(currentData);
            } else {
                const jsonStr = JSON.stringify(currentData, null, 2);
                const blob = new Blob([jsonStr], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `awrad_enjaz_backup_${new Date().toISOString().split("T")[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
            }
        });
    }

    // Register Cloud Status listener
    if (window.cloudAdapter) {
        window.cloudAdapter.onStatusChange(updateCloudSyncUI);
        if (window.cloudAdapter.isConfigured()) {
            updateCloudSyncUI({
                state: window.cloudAdapter.isOnline ? "synced" : "offline",
                message: window.cloudAdapter.isOnline ? "متزامن مع السحابة 24/7" : "وضع عدم الاتصال"
            });
        }
    }

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
