/**
 * Awrady Dashboard - 1-Click SQL Migration Component
 * Reads live loaded in-memory data (appData) and migrates users, tasks, and daily_progress
 * directly to new Supabase SQL tables for user 'mhmd7syn'.
 */

(function() {
    const DEFAULT_TARGET_USER = "mhmd7syn";
    const DEFAULT_TARGET_PIN = "1426";
    const PIN_SALT = "awrady_secure_salt_v1";

    const CATEGORY_MAP = {
        "cat_1": "صلاة",
        "cat_2": "أذكار وتسبيح",
        "cat_3": "قرآن",
        "cat_4": "صوم",
        "cat_5": "قراءة",
        "cat_6": "استماع",
        "cat_7": "شغل",
        "cat_8": "مذاكرة",
        "cat_1786272707667": "خروج"
    };

    function setupSqlMigration() {
        const btnOpen = document.getElementById("btn-open-sql-migration-modal");
        const modal = document.getElementById("modal-sql-migration");
        const btnClose = document.getElementById("btn-close-sql-migration");
        const btnCancel = document.getElementById("btn-cancel-sql-migration");
        const btnStart = document.getElementById("btn-start-sql-migration");

        if (btnOpen) {
            btnOpen.addEventListener("click", () => {
                refreshMigrationPreview();
                if (modal) modal.classList.remove("hidden");
            });
        }

        const closeModal = () => {
            if (modal) modal.classList.add("hidden");
        };

        if (btnClose) btnClose.addEventListener("click", closeModal);
        if (btnCancel) btnCancel.addEventListener("click", closeModal);

        if (btnStart) {
            btnStart.addEventListener("click", executeMigration);
        }
    }

    function refreshMigrationPreview() {
        const tasksCountEl = document.getElementById("mig-preview-tasks-count");
        const daysCountEl = document.getElementById("mig-preview-days-count");
        const activeCountEl = document.getElementById("mig-preview-active-count");

        const data = window.appData || {};
        const tasks = data.tasks || [];
        const logs = data.logs || {};
        const dates = Object.keys(logs);

        const activeTasks = tasks.filter(t => !t.isArchived && !t.isDeleted);

        if (tasksCountEl) tasksCountEl.textContent = tasks.length;
        if (daysCountEl) daysCountEl.textContent = dates.length;
        if (activeCountEl) activeCountEl.textContent = activeTasks.length;
    }

    async function hashPin(pin) {
        if (window.securityLock?.hashPin) {
            return await window.securityLock.hashPin(pin);
        }
        try {
            const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(PIN_SALT + pin));
            return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, "0")).join("");
        } catch (_) {
            return "2171c102bacd64a5f27e5d06d5e6469039af99f6c51eba1a6e2b8259e9d47ca6";
        }
    }

    function logStatus(msg, type = "info") {
        const logBox = document.getElementById("mig-status-log");
        if (!logBox) return;
        const line = document.createElement("div");
        line.style.marginBottom = "6px";
        line.style.fontSize = "0.85rem";
        if (type === "success") line.style.color = "#10b981";
        else if (type === "error") line.style.color = "#ef4444";
        else if (type === "warn") line.style.color = "#f59e0b";
        else line.style.color = "#94a3b8";
        line.textContent = `[${new Date().toLocaleTimeString('ar-EG')}] ${msg}`;
        logBox.appendChild(line);
        logBox.scrollTop = logBox.scrollHeight;
    }

    function setProgress(pct, statusText) {
        const bar = document.getElementById("mig-progress-bar");
        const txt = document.getElementById("mig-progress-text");
        if (bar) bar.style.width = `${pct}%`;
        if (txt) txt.textContent = statusText || `${pct}%`;
    }

    async function executeMigration() {
        const btnStart = document.getElementById("btn-start-sql-migration");
        const logBox = document.getElementById("mig-status-log");
        if (logBox) logBox.innerHTML = "";

        if (btnStart) {
            btnStart.disabled = true;
            btnStart.style.opacity = "0.6";
        }

        try {
            setProgress(5, "جارِ تهيئة الاتصال بـ Supabase...");
            logStatus("بدء عملية الترحيل إلى الجداول الجديدة...", "info");

            const inputUser = document.getElementById("mig-input-username");
            const inputPin = document.getElementById("mig-input-pin");
            const targetUser = (inputUser?.value || DEFAULT_TARGET_USER).trim();
            const targetPin = (inputPin?.value || DEFAULT_TARGET_PIN).trim();

            const url = (window.cloudAdapter?.config?.url || "https://krmatocnrjzivwpmbxgu.supabase.co").trim();
            const anonKey = (window.cloudAdapter?.config?.anonKey || "sb_publishable_JGajulg_tl67UJBKLyJZrA_E2tdQoZQ").trim();

            let client = window.cloudAdapter?.client;
            if (!client && window.supabase?.createClient) {
                client = window.supabase.createClient(url, anonKey);
            }

            if (!client) {
                throw new Error("تعذر الاتصال بـ Supabase. يرجى التأكد من ضبط مفاتيح السحابة أولاً.");
            }

            const data = window.appData || {};
            const tasks = data.tasks || [];
            const logs = data.logs || {};
            const dates = Object.keys(logs).sort();

            if (tasks.length === 0 && dates.length === 0) {
                throw new Error("لم يتم العثور على أي مهام أو سجلات مخزنة في الذاكرة الحالية.");
            }

            // Step 1: Upsert User mhmd7syn
            setProgress(15, `إنشاء المستخدم ${targetUser}...`);
            logStatus(`حساب رمز التشفير وإنشاء المستخدم: ${targetUser}...`);
            const pinHash = await hashPin(targetPin);

            const { error: userErr } = await client.from("users").upsert({
                username: targetUser,
                password_hash: pinHash
            }, { onConflict: "username" });

            if (userErr) {
                if (userErr.code === "42P01" || userErr.message?.includes("does not exist")) {
                    throw new Error("جدول users غير موجود في قاعدة البيانات! يرجى تنفيذ ملف database/schema.sql أولاً في Supabase SQL Editor.");
                }
                throw userErr;
            }
            logStatus(`✓ تم تسجيل المستخدم '${targetUser}' بنجاح في جدول users`, "success");

            // Step 2: Transform and Upsert Tasks
            setProgress(30, "جارِ تجهيز وترحيل المهام...");
            logStatus(`بدء معالجة وترحيل ${tasks.length} مهمة...`);

            // Compute lifetime stats per task
            const taskStats = {};
            tasks.forEach(t => {
                taskStats[t.id] = { achieved: 0, hours: 0, score: 0 };
            });

            dates.forEach(d => {
                const log = logs[d];
                if (!log || !log.entries) return;
                tasks.forEach(t => {
                    const val = log.entries[t.id] || 0;
                    if (val > 0) {
                        taskStats[t.id].achieved += val;
                        const isTime = (t.type === "ساعة" || t.type === "ساعات" || t.type === "وقت" || t.category === "خروج");
                        if (isTime) {
                            taskStats[t.id].hours += (val / 60);
                        }
                        const normTarget = isTime ? ((t.target || 1) * 60) : (t.target || 1);
                        taskStats[t.id].score += (normTarget > 0 ? (val / normTarget) : 0);
                    }
                });
            });

            const transformedTasks = tasks.map(t => {
                const cat = CATEGORY_MAP[t.category] || t.category || "عام";
                const isStudy = (cat === "مذاكرة");
                const stats = taskStats[t.id] || { achieved: 0, hours: 0, score: 0 };

                return {
                    username: targetUser,
                    task_id: t.id,
                    name: t.name,
                    category: cat,
                    subcategory: isStudy ? null : (t.subcategory || null),
                    target: Number(t.target) || 1,
                    schedule: t.schedule || "Everyday",
                    is_archived: Boolean(t.isArchived || t.isDeleted),
                    total_achieved: Math.round(stats.achieved * 100) / 100,
                    total_hours: Math.round(stats.hours * 100) / 100,
                    total_score: Math.round(stats.score * 100) / 100,
                    created_at: t.createdAt ? new Date(t.createdAt).toISOString() : new Date().toISOString()
                };
            });

            // Batch upsert tasks (chunks of 25)
            const taskChunkSize = 25;
            for (let i = 0; i < transformedTasks.length; i += taskChunkSize) {
                const chunk = transformedTasks.slice(i, i + taskChunkSize);
                const { error: taskErr } = await client.from("tasks").upsert(chunk, { onConflict: "username, task_id" });
                if (taskErr) throw taskErr;
                const pct = 30 + Math.round(((i + chunk.length) / transformedTasks.length) * 30);
                setProgress(pct, `ترحيل المهام (${Math.min(i + chunk.length, transformedTasks.length)} / ${transformedTasks.length})...`);
            }
            logStatus(`✓ تم ترحيل ${transformedTasks.length} مهمة بنجاح مع المجاميع التراكمية إلى جدول tasks`, "success");

            // Step 3: Transform and Upsert Daily Progress
            setProgress(60, "جارِ ترحيل السجلات اليومية...");
            logStatus(`بدء معالجة وترحيل ${dates.length} يوم من السجلات إلى daily_progress...`);

            const transformedDays = dates.map(d => {
                const log = logs[d] || { entries: {} };
                const taskProgress = {};

                tasks.forEach(t => {
                    const val = (log.entries && log.entries[t.id]) || 0;
                    const isTime = (t.type === "ساعة" || t.type === "ساعات" || t.type === "وقت" || t.category === "خروج");
                    const normTarget = isTime ? ((t.target || 1) * 60) : (t.target || 1);
                    const isDisabled = (log.disabledTaskIds || []).includes(t.id);
                    const isBonus = (log.bonusTaskIds || []).includes(t.id) || t.isBonus;
                    const effTarget = (isDisabled || isBonus) ? 0 : normTarget;

                    taskProgress[t.id] = {
                        target: effTarget,
                        achieved: val,
                        hours: isTime ? Math.round((val / 60) * 100) / 100 : 0,
                        score: effTarget > 0 ? Math.round((val / effTarget) * 1000) / 1000 : 0
                    };
                });

                let totalScore = 0;
                let totalHours = 0;
                if (typeof ScoringEngine !== "undefined" && ScoringEngine.calculateDayScore) {
                    totalScore = ScoringEngine.calculateDayScore(d, data, false);
                    totalHours = ScoringEngine.calculateDayScore(d, data, true);
                } else if (typeof calculateDayScore === "function") {
                    totalScore = calculateDayScore(d, data, false);
                    totalHours = calculateDayScore(d, data, true);
                }

                return {
                    username: targetUser,
                    date: d,
                    task_progress: taskProgress,
                    total_score: Math.round(totalScore * 1000) / 1000,
                    total_hours: Math.round(totalHours * 100) / 100,
                    prayer_extras: log.prayerExtras || {}
                };
            });

            // Batch upsert daily progress (chunks of 15)
            const dayChunkSize = 15;
            for (let i = 0; i < transformedDays.length; i += dayChunkSize) {
                const chunk = transformedDays.slice(i, i + dayChunkSize);
                const { error: dayErr } = await client.from("daily_progress").upsert(chunk, { onConflict: "username, date" });
                if (dayErr) throw dayErr;
                const pct = 60 + Math.round(((i + chunk.length) / transformedDays.length) * 40);
                setProgress(pct, `ترحيل الأيام (${Math.min(i + chunk.length, transformedDays.length)} / ${transformedDays.length})...`);
            }
            logStatus(`✓ تم ترحيل ${transformedDays.length} يوم بنجاح إلى جدول daily_progress`, "success");

            setProgress(100, "اكتمل الترحيل بنجاح 100%!");
            logStatus(`🎉 تهانينا! اكتملت عملية الترحيل بالكامل للمستخدم '${targetUser}'.`, "success");
            logStatus(`- المستخدم: ${targetUser} (رمز المرور: ${targetPin})`);
            logStatus(`- المهام: ${transformedTasks.length} مهمة مسجلة`);
            logStatus(`- السجلات: ${transformedDays.length} يوم محفوظ باللقطات الجاهزة`);

        } catch (err) {
            console.error("[Migration] Error:", err);
            logStatus(`❌ خطأ أثناء الترحيل: ${err.message || err}`, "error");
            setProgress(0, "فشلت العملية - راجع السجل");
        } finally {
            if (btnStart) {
                btnStart.disabled = false;
                btnStart.style.opacity = "1";
            }
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setupSqlMigration);
    } else {
        setupSqlMigration();
    }
})();
