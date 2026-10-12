/**
 * Enjaz (Awrady) - Supabase Direct Client & Database Service API
 * Direct PostgREST queries with Row-Level Security (RLS) and Realtime sync.
 */

class EnjazAPI {
    constructor() {
        this.client = null;
        this.currentUser = "primary_user";
        this._listeners = new Set();
    }

    init() {
        const url = window.APP_CONSTANTS?.SUPABASE?.URL;
        const key = window.APP_CONSTANTS?.SUPABASE?.ANON_KEY;
        this.currentUser = (window.authManager && window.authManager.getCurrentUser()) || window.APP_CONSTANTS?.SUPABASE?.DEFAULT_USER_ID || "primary_user";

        if (!url || !key || !window.supabase?.createClient) {
            return false;
        }

        try {
            this.client = window.supabase.createClient(url, key);
            this._setupRealtimeSync();
            return true;
        } catch (e) {
            console.warn("[EnjazAPI] Init failed:", e.message);
            return false;
        }
    }

    _setupRealtimeSync() {
        if (!this.client) return;
        this.client
            .channel("enjaz_live_sync")
            .on("postgres_changes", { event: "*", schema: "public", table: "daily_progress" }, payload => this._notify("daily_progress", payload))
            .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, payload => this._notify("tasks", payload))
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
        if (!this.client) return [];
        let query = this.client.from("tasks").select("*").eq("username", this.currentUser);
        if (!includeArchived) query = query.eq("is_archived", false);
        const { data, error } = await query.order("created_at", { ascending: true });
        if (error) throw error;
        return (data || []).map(r => ({
            id: r.task_id,
            task_id: r.task_id,
            name: r.name,
            category: r.category,
            subcategory: r.subcategory || null,
            target: Number(r.target) || 1,
            schedule: r.schedule || "Everyday",
            isArchived: Boolean(r.is_archived),
            is_archived: Boolean(r.is_archived),
            totalAchieved: Number(r.total_achieved) || 0,
            totalHours: Number(r.total_hours) || 0,
            totalScore: Number(r.total_score) || 0,
            createdAt: r.created_at,
            updatedAt: r.updated_at
        }));
    }

    async saveTask(task) {
        if (!this.client) return null;
        const row = {
            username: this.currentUser,
            task_id: task.task_id || task.id,
            name: task.name,
            category: task.category,
            subcategory: task.subcategory || null,
            target: Number(task.target) || 1,
            schedule: task.schedule || "Everyday",
            is_archived: Boolean(task.is_archived || task.isArchived)
        };
        const { data, error } = await this.client.from("tasks").upsert(row, { onConflict: "username, task_id" }).select();
        if (error) throw error;
        return data?.[0] || null;
    }

    async deleteTask(taskId) {
        if (!this.client) return false;
        const { error } = await this.client.from("tasks").update({ is_archived: true }).eq("username", this.currentUser).eq("task_id", taskId);
        if (error) throw error;
        return true;
    }

    async purgeTask(taskId) {
        if (!this.client) return false;
        const { error } = await this.client.from("tasks").delete().eq("username", this.currentUser).eq("task_id", taskId);
        if (error) throw error;
        return true;
    }

    async getDayProgress(dateStr) {
        if (!this.client) return null;
        const { data, error } = await this.client.from("daily_progress").select("*").eq("username", this.currentUser).eq("date", dateStr).maybeSingle();
        if (error) throw error;
        return data || null;
    }

    async saveDayProgress(dateStr, taskProgress, prayerExtras = {}, totals = {}) {
        if (!this.client) return null;
        const row = {
            username: this.currentUser,
            date: dateStr,
            task_progress: taskProgress || {},
            prayer_extras: prayerExtras || {},
            total_score: Number(totals.totalScore || totals.total_score) || 0,
            total_hours: Number(totals.totalHours || totals.total_hours) || 0
        };
        const { data, error } = await this.client.from("daily_progress").upsert(row, { onConflict: "username, date" }).select();
        if (error) throw error;
        return data?.[0] || null;
    }

    async getProgressRange(startDateStr, endDateStr) {
        if (!this.client) return [];
        const { data, error } = await this.client
            .from("daily_progress")
            .select("date, total_score, total_hours, task_progress, prayer_extras, updated_at")
            .eq("username", this.currentUser)
            .gte("date", startDateStr)
            .lte("date", endDateStr)
            .order("date", { ascending: true });
        if (error) throw error;
        return data || [];
    }
}

if (typeof window !== "undefined") {
    window.enjazAPI = new EnjazAPI();
}
