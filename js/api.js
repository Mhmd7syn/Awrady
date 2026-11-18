/**
 * Awrady - Supabase Direct Client & Database Service API
 * Direct PostgREST queries with Row-Level Security (RLS) and Realtime sync.
 */

class AwradyAPI {
    constructor() {
        this.client = null;
        this.currentUser = APP_CONSTANTS.GUEST_USER;
        this.currentUserId = null;
        this._listeners = new Set();
        this._syncChannel = null;
    }

    init() {
        const url = APP_CONSTANTS.SUPABASE.URL;
        const key = APP_CONSTANTS.SUPABASE.ANON_KEY;

        if (!url || !key || !window.supabase?.createClient) {
            console.error("[AwradyAPI] Supabase client credentials missing.");
            return false;
        }

        try {
            if (!this.client) {
                this.client = window.supabase.createClient(url, key);
                this.client.auth.getSession().then(({ data: { session } }) => {
                    if (session?.user) {
                        this.currentUserId = session.user.id;
                        this.currentUser = session.user.user_metadata?.username || session.user.email?.split("@")[0] || session.user.id;
                        this._setupRealtimeSync();
                    }
                }).catch(() => {});
            }
            return true;
        } catch (e) {
            console.error("[AwradyAPI] Init failed:", e);
            return false;
        }
    }

    isGuest() {
        return !this.currentUserId || this.currentUser === APP_CONSTANTS.GUEST_USER;
    }

    setCurrentUser(username, userId = null) {
        const cleanUser = (username || APP_CONSTANTS.GUEST_USER).toLowerCase().trim();
        this.currentUser = cleanUser;
        this.currentUserId = userId || (cleanUser === APP_CONSTANTS.GUEST_USER ? null : this.currentUserId);

        if (this.client) {
            if (this.isGuest()) {
                if (this._syncChannel) {
                    try { this.client.removeChannel(this._syncChannel); } catch (_) {}
                    this._syncChannel = null;
                }
            } else {
                this.ensureUserExists();
                this._setupRealtimeSync();
            }
        }
    }

    async ensureUserExists() {
        if (!this.client || this.isGuest() || !this.currentUserId) return;
        try {
            const tblUsers = APP_CONSTANTS.DB.TABLES.USERS;
            await this.client.from(tblUsers).upsert(
                { id: this.currentUserId, username: this.currentUser },
                { onConflict: "id", ignoreDuplicates: true }
            );
        } catch (_) {}
    }

    _setupRealtimeSync() {
        if (!this.client || this.isGuest() || !this.currentUserId) return;
        if (this._syncChannel) {
            try {
                this.client.removeChannel(this._syncChannel);
            } catch (_) {}
            this._syncChannel = null;
        }

        const channelName = `${APP_CONSTANTS.DB.CHANNEL}_${this.currentUserId}_${Date.now()}`;
        const tblProgress = APP_CONSTANTS.DB.TABLES.PROGRESS;
        const tblTasks = APP_CONSTANTS.DB.TABLES.TASKS;
        const filter = `user_id=eq.${this.currentUserId}`;

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

    async getTasks(includeArchived = false) {
        if (!this.client || this.isGuest()) return [];
        const tblTasks = APP_CONSTANTS.DB.TABLES.TASKS;
        let query = this.client.from(tblTasks).select("*").eq("user_id", this.currentUserId);
        if (!includeArchived) query = query.eq("is_archived", false);
        const { data, error } = await query.order("created_at", { ascending: true });
        if (error) throw error;
        return (data || []).map(r => ({
            id: r.task_id,
            name: r.name,
            category: r.category,
            subcategory: r.subcategory || null,
            target: Number(r.target) || 1,
            schedule: r.schedule || "Everyday",
            isArchived: Boolean(r.is_archived),
            totalAchieved: Number(r.total_achieved) || 0,
            totalHours: Number(r.total_hours) || 0,
            totalScore: Number(r.total_score) || 0,
            createdAt: r.created_at,
            oneTimeDate: r.one_time_date || (r.schedule === "OneTime" ? (r.created_at ? r.created_at.slice(0, 10) : null) : null),
            dailyTargets: r.daily_targets || null
        }));
    }

    _taskToRow(task) {
        const row = {
            user_id: this.currentUserId,
            username: this.currentUser,
            task_id: task.id,
            name: task.name,
            category: task.category,
            subcategory: task.subcategory || null,
            target: Number(task.target) || 1,
            schedule: task.schedule || "Everyday",
            is_archived: Boolean(task.isArchived),
            total_achieved: Number(task.totalAchieved ?? task.total_achieved) || 0,
            total_hours: Number(task.totalHours ?? task.total_hours) || 0,
            total_score: Number(task.totalScore ?? task.total_score) || 0
        };
        if (task.createdAt) {
            row.created_at = task.createdAt;
        }
        const otDate = task.oneTimeDate || (task.schedule === "OneTime" ? (task.createdAt ? task.createdAt.slice(0, 10) : null) : null);
        if (otDate) {
            row.one_time_date = otDate;
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
        let { data, error } = await this.client.from(tblTasks).upsert(row, { onConflict: "user_id, task_id" }).select();
        if (error && error.message && (error.message.includes("daily_targets") || error.message.includes("column"))) {
            const fallbackRow = { ...row };
            delete fallbackRow.daily_targets;
            const res = await this.client.from(tblTasks).upsert(fallbackRow, { onConflict: "user_id, task_id" }).select();
            if (res.error) throw res.error;
            return res.data?.[0] || null;
        }
        if (error) throw error;
        return data?.[0] || null;
    }

    async saveTasks(tasks) {
        if (!this.client || this.isGuest()) return [];
        if (!Array.isArray(tasks) || tasks.length === 0) return [];
        const tblTasks = APP_CONSTANTS.DB.TABLES.TASKS;
        const rows = tasks.map(t => this._taskToRow(t));
        let { data, error } = await this.client.from(tblTasks).upsert(rows, { onConflict: "user_id, task_id" }).select();
        if (error && error.message && (error.message.includes("daily_targets") || error.message.includes("column"))) {
            const fallbackRows = rows.map(r => {
                const copy = { ...r };
                delete copy.daily_targets;
                return copy;
            });
            const res = await this.client.from(tblTasks).upsert(fallbackRows, { onConflict: "user_id, task_id" }).select();
            if (res.error) throw res.error;
            return res.data || [];
        }
        if (error) throw error;
        return data || [];
    }

    async purgeTask(taskId) {
        if (!this.client || this.isGuest()) return true;
        const tblTasks = APP_CONSTANTS.DB.TABLES.TASKS;
        const { error } = await this.client.from(tblTasks).delete().eq("user_id", this.currentUserId).eq("task_id", taskId);
        if (error) throw error;
        return true;
    }

    async getDayProgress(dateStr) {
        if (!this.client || this.isGuest()) return null;
        const tblProgress = APP_CONSTANTS.DB.TABLES.PROGRESS;
        const { data, error } = await this.client.from(tblProgress).select("*").eq("user_id", this.currentUserId).eq("date", dateStr).maybeSingle();
        if (error) throw error;
        return data || null;
    }

    async getAllProgress() {
        if (!this.client || this.isGuest()) return [];
        const tblProgress = APP_CONSTANTS.DB.TABLES.PROGRESS;
        const { data, error } = await this.client
            .from(tblProgress)
            .select("date, total_score, total_hours, task_progress, prayer_extras, updated_at")
            .eq("user_id", this.currentUserId)
            .order("date", { ascending: true });
        if (error) throw error;
        return data || [];
    }

    async saveDayProgress(dateStr, taskProgress, prayerExtras = {}, totals = {}) {
        if (!this.client || this.isGuest()) return null;
        const tblProgress = APP_CONSTANTS.DB.TABLES.PROGRESS;
        const row = {
            user_id: this.currentUserId,
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
        const tblProgress = APP_CONSTANTS.DB.TABLES.PROGRESS;
        const { error } = await this.client.from(tblProgress).delete().eq("user_id", this.currentUserId).eq("date", dateStr);
        if (error) throw error;
        return true;
    }
}

if (typeof window !== "undefined") {
    window.awradyAPI = new AwradyAPI();
}
