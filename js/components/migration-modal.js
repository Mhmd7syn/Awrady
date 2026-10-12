/**
 * Awrady Dashboard - 1-Click SQL Migration Component
 * Reads live loaded in-memory data (appData) and migrates users, tasks, and daily_progress
 * directly to new Supabase SQL tables for user 'mhmd7syn'.
 * 
 * Features:
 * - Deduplicates / merges tasks sharing the same name into a single canonical task
 * - Remaps all historical daily logs to canonical task IDs
 * - Computes combined lifetime totals across merged task occurrences
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

    /**
     * Group tasks by trimmed name and select the canonical task ID
     */
    function buildCanonicalTaskMap(tasks) {
        const nameGroups = new Map();

        tasks.forEach(t => {
            const normalizedName = (t.name || "").trim().toLowerCase();
            if (!nameGroups.has(normalizedName)) {
                nameGroups.set(normalizedName, []);
            }
            nameGroups.get(normalizedName).push(t);
        });

        const idToCanonicalMap = {};
        const canonicalTasks = [];

        nameGroups.forEach((groupTasks) => {
            // Sort to find base task: non-date-suffix first, shortest ID length, earliest created
            const sorted = [...groupTasks].sort((a, b) => {
                const aHasDate = /_\d{8}$/.test(a.id);
                const bHasDate = /_\d{8}$/.test(b.id);
                if (aHasDate !== bHasDate) return aHasDate ? 1 : -1;
                if (a.id.length !== b.id.length) return a.id.length - b.id.length;
                return (a.createdAt || "").localeCompare(b.createdAt || "");
            });

            const canonical = sorted[0];

            // If ANY task in this group is active (not deleted and not archived), the merged task is active
            const hasActiveInstance = groupTasks.some(t => !t.isArchived && !t.isDeleted);
            canonical.is_archived = !hasActiveInstance;

            canonicalTasks.push(canonical);

            // Remap all tasks in this group to the canonical ID
            groupTasks.forEach(t => {
                idToCanonicalMap[t.id] = canonical.id;
            });
        });

        return { idToCanonicalMap, canonicalTasks };
    }

    function refreshMigrationPreview() {
        const tasksCountEl = document.getElementById("mig-preview-tasks-count");
        const daysCountEl = document.getElementById("mig-preview-days-count");
        const activeCountEl = document.getElementById("mig-preview-active-count");

        const data = window.appData || {};
        const rawTasks = data.tasks || [];
        const logs = data.logs || {};
        const dates = Object.keys(logs);

        const { canonicalTasks } = buildCanonicalTaskMap(rawTasks);
        const activeCanonical = canonicalTasks.filter(t => !t.is_archived);

        if (tasksCountEl) {
            tasksCountEl.innerHTML = `${canonicalTasks.length} <small style="font-size: 0.75rem; color: #94a3b8;">(دُمجت من ${rawTasks.length})</small>`;
        }
        if (daysCountEl) daysCountEl.textContent = dates.length;
        if (activeCountEl) activeCountEl.textContent = activeCanonical.length;
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
            logStatus("بدء عملية الترحيل ودمج المهام المتشابهة...", "info");

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
            const rawTasks = data.tasks || [];
            const logs = data.logs || {};
            const dates = Object.keys(logs).sort();

            if (rawTasks.length === 0 && dates.length === 0) {
                throw new Error("لم يتم العثور على أي مهام أو سجلات مخزنة في الذاكرة الحالية.");
            }

            // Step 1: Deduplicate Tasks by Name
            const { idToCanonicalMap, canonicalTasks } = buildCanonicalTaskMap(rawTasks);
            const duplicatesMerged = rawTasks.length - canonicalTasks.length;
            logStatus(`تم فحص المهام: دُمجت ${duplicatesMerged} مهمة متكررة الاسم ليصبح الإجمالي ${canonicalTasks.length} مهمة فريدة.`, "warn");

            // Step 2: Upsert User
            setProgress(15, `إنشاء المستخدم ${targetUser}...`);
            logStatus(`حساب رمز التشفير للمستخدم: ${targetUser}...`);
            const pinHash = await hashPin(targetPin);

            const { error: userErr } = await client.from("users").upsert({
                username: targetUser,
                password_hash: pinHash
            }, { onConflict: "username" });

            if (userErr) {
                if (userErr.code === "42P01" || userErr.message?.includes("does not exist")) {
                    throw new Error("جدول users غير موجود! تأكد من تشغيل database/schema.sql في Supabase SQL Editor.");
                }
                throw userErr;
            }
            logStatus(`✓ تم تسجيل المستخدم '${targetUser}' بنجاح في جدول users`, "success");

            // Step 3: Compute Combined Lifetime Stats per Canonical Task
            setProgress(30, "حساب الإحصائيات التراكمية للمهام...");
            const taskStats = {};
            canonicalTasks.forEach(t => {
                taskStats[t.id] = { achieved: 0, hours: 0, score: 0 };
            });

            dates.forEach(d => {
                const log = logs[d];
                if (!log || !log.entries) return;
                Object.entries(log.entries).forEach(([rawId, val]) => {
                    const numVal = Number(val) || 0;
                    if (numVal <= 0) return;
                    const canonicalId = idToCanonicalMap[rawId] || rawId;
                    if (taskStats[canonicalId]) {
                        taskStats[canonicalId].achieved += numVal;
                        const originalTask = rawTasks.find(t => t.id === rawId) || canonicalTasks.find(t => t.id === canonicalId);
                        const isTime = originalTask ? (originalTask.type === "ساعة" || originalTask.type === "ساعات" || originalTask.type === "وقت" || originalTask.category === "خروج") : false;
                        if (isTime) {
                            taskStats[canonicalId].hours += (numVal / 60);
                        }
                        const target = originalTask?.target || 1;
                        const normTarget = isTime ? (target * 60) : target;
                        taskStats[canonicalId].score += (normTarget > 0 ? (numVal / normTarget) : 0);
                    }
                });
            });

            // Prepare Canonical Task Rows for SQL
            const transformedTasks = canonicalTasks.map(t => {
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
                    is_archived: Boolean(t.is_archived),
                    total_achieved: Math.round(stats.achieved * 100) / 100,
                    total_hours: Math.round(stats.hours * 100) / 100,
                    total_score: Math.round(stats.score * 100) / 100,
                    created_at: t.createdAt ? new Date(t.createdAt).toISOString() : new Date().toISOString()
                };
            });

            // Batch upsert tasks (chunks of 20)
            const taskChunkSize = 20;
            for (let i = 0; i < transformedTasks.length; i += taskChunkSize) {
                const chunk = transformedTasks.slice(i, i + taskChunkSize);
                const { error: taskErr } = await client.from("tasks").upsert(chunk, { onConflict: "username, task_id" });
                if (taskErr) throw taskErr;
                const pct = 30 + Math.round(((i + chunk.length) / transformedTasks.length) * 30);
                setProgress(pct, `ترحيل المهام (${Math.min(i + chunk.length, transformedTasks.length)} / ${transformedTasks.length})...`);
            }
            logStatus(`✓ تم ترحيل ${transformedTasks.length} مهمة فريدة مدمجة إلى جدول tasks`, "success");

            // Step 4: Transform and Remap Daily Progress Logs
            setProgress(60, "جارِ ترحيل السجلات اليومية بالمعرّفات الموحدة...");
            logStatus(`معالجة ${dates.length} يوم وترحيلها إلى daily_progress...`);

            const transformedDays = dates.map(d => {
                const log = logs[d] || { entries: {} };
                const taskProgress = {};

                // Map entries for all canonical tasks
                canonicalTasks.forEach(canonicalTask => {
                    const cid = canonicalTask.id;
                    const cat = CATEGORY_MAP[canonicalTask.category] || canonicalTask.category || "عام";
                    const isTime = (canonicalTask.type === "ساعة" || canonicalTask.type === "ساعات" || canonicalTask.type === "وقت" || cat === "خروج");
                    const normTarget = isTime ? ((canonicalTask.target || 1) * 60) : (canonicalTask.target || 1);

                    // Find all raw task entries for this date that map to this canonical task
                    let achievedSum = 0;
                    let wasDisabled = false;
                    let wasBonus = false;

                    if (log.entries) {
                        Object.entries(log.entries).forEach(([rawId, val]) => {
                            if ((idToCanonicalMap[rawId] || rawId) === cid) {
                                achievedSum += (Number(val) || 0);
                                if ((log.disabledTaskIds || []).includes(rawId)) wasDisabled = true;
                                if ((log.bonusTaskIds || []).includes(rawId)) wasBonus = true;
                            }
                        });
                    }

                    if ((log.disabledTaskIds || []).includes(cid)) wasDisabled = true;
                    if ((log.bonusTaskIds || []).includes(cid) || canonicalTask.isBonus) wasBonus = true;

                    const effTarget = (wasDisabled || wasBonus) ? 0 : normTarget;

                    taskProgress[cid] = {
                        target: effTarget,
                        achieved: achievedSum,
                        hours: isTime ? Math.round((achievedSum / 60) * 100) / 100 : 0,
                        score: effTarget > 0 ? Math.round((achievedSum / effTarget) * 1000) / 1000 : 0
                    };
                });

                // Calculate total day score and hours using native ScoringEngine if available
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
            logStatus(`✓ تم ترحيل ${transformedDays.length} يوم بنجاح مع ربط السجلات بالمهام الموحدة`, "success");

            setProgress(100, "اكتمل الترحيل بنجاح 100%!");
            logStatus(`🎉 تهانينا! اكتمل ترحيل كافة البيانات بنجاح:`, "success");
            logStatus(`- المستخدم: ${targetUser} (رمز المرور: ${targetPin})`);
            logStatus(`- المهام: دُمجت المهام المتشابهة لتصبح ${transformedTasks.length} مهمة نظيفة`);
            logStatus(`- السجلات: ${transformedDays.length} يوم تم حفظها بنجاح مع مطابقة المعرّفات`);

        } catch (err) {
            console.error("[Migration] Error:", err);
            logStatus(`❌ خطأ أثناء الترحيل: ${err.message || err}`, "error");
            setProgress(0, "فشلت العملية - راجع السجل أعلاه");
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
