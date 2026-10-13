/**
 * Enjaz (Awrady) - Supabase Direct Client & Database Service API
 * Direct PostgREST queries with Row-Level Security (RLS) and Realtime sync.
 */

class EnjazAPI {
    constructor() {
        this.client = null;
        this.currentUser = APP_CONSTANTS.GUEST_USER;
        this._listeners = new Set();
    }

    init() {
        const url = APP_CONSTANTS.SUPABASE.URL;
        const key = APP_CONSTANTS.SUPABASE.ANON_KEY;
        this.currentUser = (window.authManager && window.authManager.getCurrentUser()) || APP_CONSTANTS.GUEST_USER;

        if (!url || !key || !window.supabase?.createClient) {
            console.error("[EnjazAPI] Supabase client credentials missing.");
            return false;
        }

        try {
            if (this.client) this.client.removeAllChannels();
            this.client = window.supabase.createClient(url, key);
            this._setupRealtimeSync();
            return true;
        } catch (e) {
            console.error("[EnjazAPI] Init failed:", e);
            return false;
        }
    }

    _setupRealtimeSync() {
        if (!this.client) return;
        const channelName = APP_CONSTANTS.DB.CHANNEL;
        const tblProgress = APP_CONSTANTS.DB.TABLES.PROGRESS;
        const tblTasks = APP_CONSTANTS.DB.TABLES.TASKS;
        const filter = `username=eq.${this.currentUser}`;
        this.client
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
        if (!this.client) throw new Error("Supabase client not initialized");
        const tblTasks = APP_CONSTANTS.DB.TABLES.TASKS;
        let query = this.client.from(tblTasks).select("*").eq("username", this.currentUser);
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
            createdAt: r.created_at
        }));
    }

    async saveTask(task) {
        if (!this.client) throw new Error("Supabase client not initialized");
        const tblTasks = APP_CONSTANTS.DB.TABLES.TASKS;
        const row = {
            username: this.currentUser,
            task_id: task.id,
            name: task.name,
            category: task.category,
            subcategory: task.subcategory || null,
            target: Number(task.target) || 1,
            schedule: task.schedule || "Everyday",
            is_archived: Boolean(task.isArchived)
        };
        const { data, error } = await this.client.from(tblTasks).upsert(row, { onConflict: "username, task_id" }).select();
        if (error) throw error;
        return data?.[0] || null;
    }

    async purgeTask(taskId) {
        if (!this.client) throw new Error("Supabase client not initialized");
        const tblTasks = APP_CONSTANTS.DB.TABLES.TASKS;
        const { error } = await this.client.from(tblTasks).delete().eq("username", this.currentUser).eq("task_id", taskId);
        if (error) throw error;
        return true;
    }

    async getDayProgress(dateStr) {
        if (!this.client) throw new Error("Supabase client not initialized");
        const tblProgress = APP_CONSTANTS.DB.TABLES.PROGRESS;
        const { data, error } = await this.client.from(tblProgress).select("*").eq("username", this.currentUser).eq("date", dateStr).maybeSingle();
        if (error) throw error;
        return data || null;
    }

    async getAllProgress() {
        if (!this.client) throw new Error("Supabase client not initialized");
        const tblProgress = APP_CONSTANTS.DB.TABLES.PROGRESS;
        const { data, error } = await this.client
            .from(tblProgress)
            .select("date, total_score, total_hours, task_progress, prayer_extras, updated_at")
            .eq("username", this.currentUser)
            .order("date", { ascending: true });
        if (error) throw error;
        return data || [];
    }

    async saveDayProgress(dateStr, taskProgress, prayerExtras = {}, totals = {}) {
        if (!this.client) throw new Error("Supabase client not initialized");
        const tblProgress = APP_CONSTANTS.DB.TABLES.PROGRESS;
        const row = {
            username: this.currentUser,
            date: dateStr,
            task_progress: taskProgress || {},
            prayer_extras: prayerExtras || {},
            total_score: Number(totals.totalScore ?? totals.total_score) || 0,
            total_hours: Number(totals.totalHours ?? totals.total_hours) || 0
        };
        const { data, error } = await this.client.from(tblProgress).upsert(row, { onConflict: "username, date" }).select();
        if (error) throw error;
        return data?.[0] || null;
    }

    async deleteDayProgress(dateStr) {
        if (!this.client) throw new Error("Supabase client not initialized");
        const tblProgress = APP_CONSTANTS.DB.TABLES.PROGRESS;
        const { error } = await this.client.from(tblProgress).delete().eq("username", this.currentUser).eq("date", dateStr);
        if (error) throw error;
        return true;
    }
}

if (typeof window !== "undefined") {
    window.enjazAPI = new EnjazAPI();
}
