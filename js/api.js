/**
 * Awrady - Supabase Direct Client & Database Service API
 * Direct PostgREST queries with Row-Level Security (RLS) and Realtime sync.
 */

import { APP_CONSTANTS } from './config/constants.js';

class AwradyAPI {
    constructor() {
        this.client = null;
        this.currentUser = null;
        this.currentUserId = null;
        this.currentUserEmail = null;
        this._listeners = new Set();
        this._syncChannel = null;
    }

    init() {
        const url = APP_CONSTANTS.SUPABASE.URL;
        const key = APP_CONSTANTS.SUPABASE.ANON_KEY;

        if (!url || !key || !window.supabase?.createClient) {
            console.info("[AwradyAPI] Supabase client credentials missing; running in local/guest mode.");
            return false;
        }

        try {
            if (!this.client) {
                this.client = window.supabase.createClient(url, key);
                this.client.auth.getSession().then(({ data: { session } }) => {
                    if (session?.user) {
                        this.currentUserId = session.user.id;
                        this.currentUser = session.user.user_metadata?.username || session.user.email?.split("@")[0] || session.user.id;
                        this.currentUserEmail = session.user.email || null;
                        this._setupRealtimeSync();
                    }
                }).catch((err) => {
                    console.warn("[AwradyAPI] getSession error:", err);
                });
            }
            return true;
        } catch (e) {
            console.error("[AwradyAPI] Init failed:", e);
            return false;
        }
    }

    isGuest() {
        return !this.getEffectiveUserId();
    }

    getEffectiveUserId() {
        return this.currentUserId || (typeof localStorage !== "undefined" ? localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.SESSION_UID) : null);
    }

    setCurrentUser(username, userId = null, userEmail = null) {
        if (!username) {
            this.currentUser = null;
            this.currentUserId = null;
            this.currentUserEmail = null;
            if (this._syncChannel) {
                try { this.client.removeChannel(this._syncChannel); } catch (_) {}
                this._syncChannel = null;
            }
            return;
        }

        const cleanUser = username.toLowerCase().trim();
        this.currentUser = cleanUser;
        if (userId) {
            this.currentUserId = userId;
        } else if (!this.currentUserId) {
            this.currentUserId = (typeof localStorage !== "undefined" ? localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.SESSION_UID) : null) || 
                                 (window.authManager && window.authManager.getCurrentUserId?.()) || 
                                 null;
        }

        if (userEmail) {
            this.currentUserEmail = userEmail;
        } else if (!this.currentUserEmail) {
            this.currentUserEmail = (typeof localStorage !== "undefined" ? localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.SESSION_EMAIL) : null) ||
                                    (window.authManager && window.authManager.currentUserEmail) ||
                                    null;
        }

        if (this.client && this.currentUserId) {
            this.ensureUserExists();
            this._setupRealtimeSync();
        }
    }

    async ensureUserExists() {
        const uid = this.getEffectiveUserId();
        if (!this.client || this.isGuest() || !uid) return;
        try {
            const tblUsers = APP_CONSTANTS.DB.TABLES.USERS;
            await this.client.from(tblUsers).upsert(
                { id: uid, username: this.currentUser },
                { onConflict: "id", ignoreDuplicates: true }
            );
        } catch (_) {}
    }

    _setupRealtimeSync() {
        const uid = this.getEffectiveUserId();
        if (!this.client || this.isGuest() || !uid) return;
        if (this._syncChannel) {
            try {
                this.client.removeChannel(this._syncChannel);
            } catch (_) {}
            this._syncChannel = null;
        }

        const channelName = `${APP_CONSTANTS.DB.CHANNEL}_${uid}_${Date.now()}`;
        const tblProgress = APP_CONSTANTS.DB.TABLES.PROGRESS;
        const tblTasks = APP_CONSTANTS.DB.TABLES.TASKS;
        const filter = `user_id=eq.${uid}`;

        this._syncChannel = this.client
            .channel(channelName)
            .on("postgres_changes", { event: "*", schema: "public", table: tblProgress, filter }, payload => this._notify(tblProgress, payload))
            .on("postgres_changes", { event: "*", schema: "public", table: tblTasks, filter }, payload => this._notify(tblTasks, payload))
            .subscribe();
    }

    onUpdate(callback) {
        this._listeners.add(callback);
        return () => this._listeners.delete(callback);
    }

    _notify(event, payload) {
        this._listeners.forEach(cb => cb(event, payload));
    }

    async getTasks(includeArchived = true) {
        if (!this.client || this.isGuest()) return [];
        const uid = this.getEffectiveUserId();
        if (!uid) return [];
        const tblTasks = APP_CONSTANTS.DB.TABLES.TASKS;
        let query = this.client.from(tblTasks).select("*").eq("user_id", uid);
        if (!includeArchived) query = query.eq("is_archived", false);
        const { data, error } = await query.order("created_at", { ascending: true });
        if (error) throw error;
        return (data || []).map(r => {
            const isLegacyArchived = Boolean(r.is_archived);
            const isLegacyOneTime = r.schedule === "OneTime";
            const schedule = (isLegacyArchived || isLegacyOneTime || r.schedule === "Unscheduled")
                ? "Unscheduled"
                : (r.schedule || "Everyday");
            return {
                id: r.task_id,
                name: r.name,
                category: r.category,
                subcategory: r.subcategory || null,
                target: Number(r.target) || 1,
                schedule,
                isArchived: false,
                totalAchieved: Number(r.total_achieved) || 0,
                totalHours: Number(r.total_hours) || 0,
                totalScore: Number(r.total_score) || 0,
                createdAt: r.created_at,
                oneTimeDate: null,
                dailyTargets: r.daily_targets || null
            };
        });
    }

    _taskToRow(task) {
        const uid = this.getEffectiveUserId();
        const isLegacyArchived = Boolean(task.isArchived);
        const isLegacyOneTime = task.schedule === "OneTime" || Boolean(task.isOneTime);
        const sched = (isLegacyArchived || isLegacyOneTime || task.schedule === "Unscheduled")
            ? "Unscheduled"
            : (task.schedule || "Everyday");
        const row = {
            user_id: uid,
            username: this.currentUser,
            task_id: task.id,
            name: task.name,
            category: task.category,
            subcategory: task.subcategory || null,
            target: Number(task.target) || 1,
            schedule: sched,
            is_archived: false,
            total_achieved: Number(task.totalAchieved ?? task.total_achieved) || 0,
            total_hours: Number(task.totalHours ?? task.total_hours) || 0,
            totalScore: Number(task.totalScore ?? task.total_score) || 0
        };
        if (task.createdAt) {
            row.created_at = task.createdAt;
        }
        if (task.dailyTargets && typeof task.dailyTargets === "object") {
            row.daily_targets = task.dailyTargets;
        }
        return row;
    }

    async saveTask(task) {
        if (!this.client || this.isGuest()) return null;
        const tblTasks = APP_CONSTANTS.DB.TABLES.TASKS;
        const row = this._taskToRow(task);
        const { data, error } = await this.client.from(tblTasks).upsert(row, { onConflict: "user_id, task_id" }).select();
        if (error) throw error;
        return data?.[0] || null;
    }

    async saveTasks(tasks) {
        if (!this.client || this.isGuest()) return [];
        if (!Array.isArray(tasks) || tasks.length === 0) return [];
        const tblTasks = APP_CONSTANTS.DB.TABLES.TASKS;
        const rows = tasks.map(t => this._taskToRow(t));
        const { data, error } = await this.client.from(tblTasks).upsert(rows, { onConflict: "user_id, task_id" }).select();
        if (error) throw error;
        return data || [];
    }

    async purgeTask(taskId) {
        if (!this.client || this.isGuest()) return true;
        const uid = this.getEffectiveUserId();
        if (!uid) return true;
        const tblTasks = APP_CONSTANTS.DB.TABLES.TASKS;
        const { error } = await this.client.from(tblTasks).delete().eq("user_id", uid).eq("task_id", taskId);
        if (error) throw error;
        return true;
    }

    async clearAllTasks() {
        if (!this.client || this.isGuest()) return true;
        const uid = this.getEffectiveUserId();
        if (!uid) return true;
        const tblTasks = APP_CONSTANTS.DB.TABLES.TASKS;
        const { error } = await this.client.from(tblTasks).delete().eq("user_id", uid);
        if (error) throw error;
        return true;
    }

    async getDayProgress(dateStr) {
        if (!this.client || this.isGuest()) return null;
        const uid = this.getEffectiveUserId();
        if (!uid) return null;
        const tblProgress = APP_CONSTANTS.DB.TABLES.PROGRESS;
        const { data, error } = await this.client.from(tblProgress).select("*").eq("user_id", uid).eq("date", dateStr).maybeSingle();
        if (error) throw error;
        return data || null;
    }

    async getAllProgress() {
        if (!this.client || this.isGuest()) return [];
        const uid = this.getEffectiveUserId();
        if (!uid) return [];
        const tblProgress = APP_CONSTANTS.DB.TABLES.PROGRESS;
        const { data, error } = await this.client
            .from(tblProgress)
            .select("date, total_score, total_hours, task_progress, prayer_extras, updated_at")
            .eq("user_id", uid)
            .order("date", { ascending: true });
        if (error) throw error;
        return data || [];
    }

    async saveDayProgress(dateStr, taskProgress, prayerExtras = {}, totals = {}) {
        if (!this.client || this.isGuest()) return null;
        const uid = this.getEffectiveUserId();
        const tblProgress = APP_CONSTANTS.DB.TABLES.PROGRESS;
        const row = {
            user_id: uid,
            username: this.currentUser,
            date: dateStr,
            task_progress: taskProgress || {},
            prayer_extras: prayerExtras || {},
            total_score: Number(totals.totalScore ?? totals.total_score) || 0,
            total_hours: Number(totals.totalHours ?? totals.total_hours) || 0
        };
        const { data, error } = await this.client.from(tblProgress).upsert(row, { onConflict: "user_id, date" }).select();
        if (error) throw error;
        return data?.[0] || null;
    }

    async deleteDayProgress(dateStr) {
        if (!this.client || this.isGuest()) return true;
        const uid = this.getEffectiveUserId();
        if (!uid) return true;
        const tblProgress = APP_CONSTANTS.DB.TABLES.PROGRESS;
        const { error } = await this.client.from(tblProgress).delete().eq("user_id", uid).eq("date", dateStr);
        if (error) throw error;
        return true;
    }

    async clearAllProgress() {
        if (!this.client || this.isGuest()) return true;
        const uid = this.getEffectiveUserId();
        if (!uid) return true;
        const tblProgress = APP_CONSTANTS.DB.TABLES.PROGRESS;
        const { error } = await this.client.from(tblProgress).delete().eq("user_id", uid);
        if (error) throw error;
        return true;
    }

    async resetToDefaults(defaultTasks = []) {
        if (!this.client || this.isGuest()) return [];
        await this.clearAllProgress();
        await this.clearAllTasks();
        if (Array.isArray(defaultTasks) && defaultTasks.length > 0) {
            return await this.saveTasks(defaultTasks);
        }
        return [];
    }

    async updateDisplayName(displayName) {
        if (!this.client || this.isGuest()) {
            throw new Error("يجب تسجيل الدخول لتحديث الاسم المعروض.");
        }
        const uid = this.getEffectiveUserId();
        if (!uid) {
            throw new Error("تعذر تحديد هوية المستخدم.");
        }
        const cleanName = (displayName || "").trim().toLowerCase();
        const minLen = (typeof APP_CONSTANTS !== "undefined" && APP_CONSTANTS.LIMITS?.USERNAME_MIN) || 3;
        if (!cleanName || cleanName.length < minLen) {
            throw new Error(`اسم المستخدم يجب أن يكون ${minLen} أحرف على الأقل.`);
        }

        // 1. Update Supabase Auth user metadata
        try {
            const { error: authError } = await this.client.auth.updateUser({
                data: { username: cleanName }
            });
            if (authError) {
                if (authError.message && (authError.message.includes("unique") || authError.message.includes("already registered") || authError.message.includes("already exists"))) {
                    throw new Error("اسم المستخدم مستخدم بالفعل، يرجى اختيار اسم آخر.");
                }
                if (authError.message && (authError.message.includes("@awrady.internal") || authError.message.includes(".internal") || authError.message.includes("is invalid"))) {
                    console.warn("[AwradyAPI] auth.updateUser metadata note (synthetic email):", authError.message);
                } else {
                    throw authError;
                }
            }
        } catch (err) {
            if (err.message && err.message.includes("مستخدم بالفعل")) throw err;
            console.warn("[AwradyAPI] auth.updateUser exception:", err.message);
        }

        // 2. Sync public.users table directly to safeguard against trigger latency
        try {
            const tblUsers = APP_CONSTANTS.DB.TABLES.USERS;
            const { error: dbError } = await this.client
                .from(tblUsers)
                .update({ username: cleanName, updated_at: new Date().toISOString() })
                .eq("id", uid);

            if (dbError) {
                if (dbError.message && (dbError.message.includes("unique") || dbError.code === "23505")) {
                    throw new Error("اسم المستخدم مستخدم بالفعل، يرجى اختيار اسم آخر.");
                }
                console.warn("[AwradyAPI] Direct public.users update note:", dbError);
            }
        } catch (dbErr) {
            if (dbErr.message && dbErr.message.includes("مستخدم بالفعل")) throw dbErr;
            console.warn("[AwradyAPI] Failed to update public.users directly:", dbErr);
        }

        this.currentUser = cleanName;
        return { success: true, username: cleanName };
    }

    async updateEmail(newEmail) {
        if (!this.client || this.isGuest()) {
            throw new Error("يجب تسجيل الدخول لتحديث البريد الإلكتروني.");
        }
        const uid = this.getEffectiveUserId();
        if (!uid) {
            throw new Error("تعذر تحديد هوية المستخدم.");
        }
        const cleanEmail = (newEmail || "").trim().toLowerCase();

        // If email is empty, remove email and revert to username-only authentication
        if (!cleanEmail) {
            let rpcSuccess = false;
            try {
                const { error: rpcErr } = await this.client.rpc("remove_user_email");
                if (!rpcErr) {
                    rpcSuccess = true;
                } else {
                    console.warn("[AwradyAPI] remove_user_email RPC note:", rpcErr);
                }
            } catch (e) {
                console.warn("[AwradyAPI] remove_user_email RPC call failed:", e);
            }

            if (!rpcSuccess) {
                const username = (this.currentUser || "").trim().toLowerCase();
                const safeUsername = username.replace(/[^a-z0-9._-]/g, "") || "user";
                const syntheticEmail = `${safeUsername}@awrady.internal`;

                try {
                    await this.client.auth.updateUser({ email: syntheticEmail });
                } catch (authErr) {
                    console.warn("[AwradyAPI] Reverting auth email to synthetic note:", authErr);
                }

                const tblUsers = APP_CONSTANTS.DB.TABLES.USERS;
                const { error: dbError } = await this.client
                    .from(tblUsers)
                    .update({ email: null, updated_at: new Date().toISOString() })
                    .eq("id", uid);

                if (dbError) {
                    console.warn("[AwradyAPI] Direct public.users email clear note:", dbError);
                    throw dbError;
                }
            }

            this.currentUserEmail = null;
            return { removed: true };
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
            throw new Error("يرجى إدخال عنوان بريد إلكتروني صالح.");
        }

        // 1. For username-only accounts (synthetic email), link directly to bypass fake domain validation
        const currentEmail = (this.currentUserEmail || "").toLowerCase();
        const isSynthetic = !currentEmail || currentEmail.endsWith("@awrady.internal") || currentEmail.endsWith(".awrady@gmail.com");

        if (isSynthetic) {
            try {
                const { data: rpcRes, error: rpcErr } = await this.client.rpc("set_user_email", {
                    p_email: cleanEmail
                });
                if (!rpcErr && rpcRes && rpcRes.success) {
                    try { await this.client.auth.refreshSession(); } catch (_) {}
                    this.currentUserEmail = cleanEmail;
                    return { directUpdate: true, user: { email: cleanEmail } };
                }
                if (rpcErr && rpcErr.message && (rpcErr.message.includes("مسجل بالفعل") || rpcErr.message.includes("already registered"))) {
                    throw new Error("البريد الإلكتروني مسجل بالفعل لحساب آخر.");
                }
            } catch (rpcEx) {
                if (rpcEx.message && rpcEx.message.includes("مسجل بالفعل")) throw rpcEx;
            }
        }

        // 2. Standard GoTrue auth.updateUser for accounts with existing real emails (notifies and confirms both emails)
        const isWeb = typeof window !== "undefined" && window.location.origin && !window.location.origin.startsWith("file:");
        const redirectTo = isWeb ? (window.location.origin + window.location.pathname) : "https://awrady.vercel.app/";
        const options = { emailRedirectTo: redirectTo };

        const { data, error: authError } = await this.client.auth.updateUser({
            email: cleanEmail
        }, options);
        if (authError) {
            if (authError.message && (authError.message.includes("already registered") || authError.message.includes("unique") || authError.message.includes("already exists"))) {
                throw new Error("البريد الإلكتروني مسجل بالفعل لحساب آخر.");
            }
            if (authError.message && (authError.message.includes("rate limit") || authError.message.includes("rate_limit"))) {
                throw new Error("تم تجاوز عدد محاولات إرسال البريد. يرجى الانتظار قليلاً والمحاولة لاحقاً.");
            }
            // If GoTrue dispatched confirmation to cleanEmail but errored because old synthetic address (.internal) is rejected by its validator
            if (authError.message && (authError.message.includes("@awrady.internal") || authError.message.includes(".internal") || authError.message.includes("is invalid"))) {
                try {
                    const tblUsers = APP_CONSTANTS.DB.TABLES.USERS;
                    await this.client
                        .from(tblUsers)
                        .update({ email: cleanEmail, updated_at: new Date().toISOString() })
                        .eq("id", uid);
                } catch (_) {}

                return {
                    user: { new_email: cleanEmail },
                    sentConfirmation: true
                };
            }
            throw authError;
        }

        // 3. Direct sync to public.users table
        try {
            const tblUsers = APP_CONSTANTS.DB.TABLES.USERS;
            await this.client
                .from(tblUsers)
                .update({ email: cleanEmail, updated_at: new Date().toISOString() })
                .eq("id", uid);
        } catch (dbErr) {
            console.warn("[AwradyAPI] Direct public.users email update note:", dbErr);
        }

        this.currentUserEmail = cleanEmail;
        return data;
    }

    async updatePassword(newPassword) {
        if (!this.client || this.isGuest()) {
            throw new Error("يجب تسجيل الدخول لتغيير كلمة المرور.");
        }
        const minLen = (typeof APP_CONSTANTS !== "undefined" && APP_CONSTANTS.LIMITS?.PASSWORD_MIN) || 6;
        if (!newPassword || newPassword.length < minLen) {
            throw new Error(`كلمة المرور يجب أن تكون ${minLen} أحرف على الأقل.`);
        }

        const { data, error } = await this.client.auth.updateUser({
            password: newPassword
        });
        if (error) {
            if (error.message && (error.message.includes("same_password") || error.message.includes("should be different"))) {
                throw new Error("كلمة المرور الجديدة مطابقة للقديمة. يرجى اختيار كلمة مرور مختلفة.");
            }
            throw error;
        }
        return data;
    }

    async deleteAccount() {
        if (!this.client || this.isGuest()) return true;
        const uid = this.getEffectiveUserId();
        if (!uid) return true;

        let rpcSuccess = false;
        try {
            const { error: rpcError } = await this.client.rpc("delete_user_account");
            if (!rpcError) {
                rpcSuccess = true;
            } else {
                console.warn("[AwradyAPI] RPC delete_user_account note:", rpcError);
            }
        } catch (e) {
            console.warn("[AwradyAPI] RPC delete_user_account failed:", e);
        }

        // Fallback cleanup in case RPC is not configured on remote database
        if (!rpcSuccess) {
            try {
                await this.clearAllProgress();
                await this.clearAllTasks();
                const tblUsers = APP_CONSTANTS.DB.TABLES.USERS;
                await this.client.from(tblUsers).delete().eq("id", uid);
            } catch (err) {
                console.warn("[AwradyAPI] Fallback user data deletion note:", err);
            }
        }

        // Tear down realtime sync subscription
        if (this._syncChannel) {
            try { this.client.removeChannel(this._syncChannel); } catch (_) {}
            this._syncChannel = null;
        }

        // Sign out from Supabase Auth
        try {
            await this.client.auth.signOut();
        } catch (_) {}

        return true;
    }
}

const awradyAPI = (typeof window !== "undefined" && window.awradyAPI) ? window.awradyAPI : new AwradyAPI();

if (typeof window !== "undefined") {
    window.AwradyAPI = AwradyAPI;
    window.awradyAPI = awradyAPI;
}

export { AwradyAPI, awradyAPI };
