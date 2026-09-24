/**
 * Awrad & Enjaz Dashboard - Automatic Weekly Schedule Migration
 * Applies the 2026-09-21 weekly schedule re-organization in-memory across any storage mode.
 */

function applyWeeklyScheduleReorg(data) {
    if (!data || !data.tasks || !Array.isArray(data.tasks)) return data;

    // Check if migration has already been applied
    const hasVideosTask = data.tasks.some(t => t.id === "task_dw_videos");
    const hasJobAppsDayTargets = data.tasks.some(t => t.id === "task_1786416127846" && t.dayTargets && t.dayTargets["Sun"] === 2);
    const hasCorrectOutingType = !data.tasks.some(t => (t.category === "خروج" || t.id === "task_1786273589456") && t.history && t.history.some(h => h.type === "يوم"));
    if (hasVideosTask && hasJobAppsDayTargets && hasCorrectOutingType) {
        return data; // Already migrated
    }

    console.log("[ScheduleMigration] Applying 2026-09-21 Weekly Schedule Reorganization...");

    // Helper to add or replace snapshot
    function setSnapshot(task, snapshot) {
        if (!task.history || !Array.isArray(task.history)) {
            task.history = [];
        }
        const idx = task.history.findIndex(h => h.effectiveFrom === snapshot.effectiveFrom);
        if (idx >= 0) {
            task.history[idx] = snapshot;
        } else {
            task.history.push(snapshot);
        }
    }

    // 1. task_study_learn -> Study (Sun, Thu, 4h)
    const tStudy = data.tasks.find(t => t.id === "task_study_learn");
    if (tStudy) {
        tStudy.name = "Study";
        tStudy.target = 4;
        tStudy.type = "ساعة";
        tStudy.schedule = "Sun, Thu";
        setSnapshot(tStudy, {
            effectiveFrom: "2026-09-21",
            name: "Study",
            category: tStudy.category || "مذاكرة",
            subcategory: tStudy.subcategory || "",
            type: "ساعة",
            target: 4,
            multiplier: tStudy.multiplier !== undefined ? tStudy.multiplier : 1.0,
            schedule: "Sun, Thu",
            isBonus: false,
            comment: ""
        });
    }

    // 2. task_study_practice -> Practice (Tue, 4h)
    const tPractice = data.tasks.find(t => t.id === "task_study_practice");
    if (tPractice) {
        tPractice.name = "Practice";
        tPractice.target = 4;
        tPractice.type = "ساعة";
        tPractice.schedule = "Tue";
        setSnapshot(tPractice, {
            effectiveFrom: "2026-09-21",
            name: "Practice",
            category: tPractice.category || "مذاكرة",
            subcategory: tPractice.subcategory || "",
            type: "ساعة",
            target: 4,
            multiplier: tPractice.multiplier !== undefined ? tPractice.multiplier : 1.0,
            schedule: "Tue",
            isBonus: false,
            comment: ""
        });
    }

    // 3. task_study_project -> Projects (Wed, 4h)
    const tProj = data.tasks.find(t => t.id === "task_study_project");
    if (tProj) {
        tProj.name = "Projects";
        tProj.target = 4;
        tProj.type = "ساعة";
        tProj.schedule = "Wed";
        if (!tProj.history || tProj.history.length === 0) {
            tProj.history = [
                {
                    effectiveFrom: "2026-08-03",
                    name: "العمل على مشروع",
                    category: tProj.category || "مذاكرة",
                    subcategory: tProj.subcategory || "",
                    type: "ساعة",
                    target: 4,
                    multiplier: 1.0,
                    schedule: "Wed",
                    isBonus: false,
                    comment: ""
                }
            ];
        }
        setSnapshot(tProj, {
            effectiveFrom: "2026-09-21",
            name: "Projects",
            category: tProj.category || "مذاكرة",
            subcategory: tProj.subcategory || "",
            type: "ساعة",
            target: 4,
            multiplier: tProj.multiplier !== undefined ? tProj.multiplier : 1.0,
            schedule: "Wed",
            isBonus: false,
            comment: ""
        });
    }

    // 4. task_work -> Freelance/Work (Mon, Wed, 3h)
    const tWork = data.tasks.find(t => t.id === "task_work");
    if (tWork) {
        tWork.name = "Freelance/Work";
        tWork.target = 3;
        tWork.type = "ساعة";
        tWork.schedule = "Mon, Wed";
        setSnapshot(tWork, {
            effectiveFrom: "2026-09-21",
            name: "Freelance/Work",
            category: tWork.category || "شغل",
            subcategory: tWork.subcategory || "",
            type: "ساعة",
            target: 3,
            multiplier: tWork.multiplier !== undefined ? tWork.multiplier : 1.0,
            schedule: "Mon, Wed",
            isBonus: false,
            comment: ""
        });
    }

    // 5. task_1786416127846 -> Job & Scholarship Apps (Sun: 2h, Tue: 3h, Thu: 3h)
    const tJob = data.tasks.find(t => t.id === "task_1786416127846");
    if (tJob) {
        tJob.name = "Job & Scholarship Apps";
        tJob.target = 3;
        tJob.type = "ساعة";
        tJob.schedule = "Sun, Tue, Thu";
        tJob.dayTargets = { "Sun": 2, "Tue": 3, "Thu": 3 };
        setSnapshot(tJob, {
            effectiveFrom: "2026-09-21",
            name: "Job & Scholarship Apps",
            category: tJob.category || "شغل",
            subcategory: tJob.subcategory || "",
            type: "ساعة",
            target: 3,
            dayTargets: { "Sun": 2, "Tue": 3, "Thu": 3 },
            multiplier: tJob.multiplier !== undefined ? tJob.multiplier : 1.0,
            schedule: "Sun, Tue, Thu",
            isBonus: false,
            comment: ""
        });
    }

    // 6. task_1786141056616 -> English (Sun, Wed, 1h)
    const tEng = data.tasks.find(t => t.id === "task_1786141056616");
    if (tEng) {
        tEng.name = "English";
        tEng.target = 1;
        tEng.type = "ساعة";
        tEng.schedule = "Sun, Wed";
        setSnapshot(tEng, {
            effectiveFrom: "2026-09-21",
            name: "English",
            category: tEng.category || "مذاكرة",
            subcategory: tEng.subcategory || "",
            type: "ساعة",
            target: 1,
            multiplier: tEng.multiplier !== undefined ? tEng.multiplier : 1.0,
            schedule: "Sun, Wed",
            isBonus: false,
            comment: ""
        });
    }

    // 7. task_1786273589456 -> Outing / Workout (Fri, Sat, 2h)
    const tOuting = data.tasks.find(t => t.id === "task_1786273589456");
    if (tOuting) {
        tOuting.name = "Outing / Workout";
        tOuting.target = 2;
        tOuting.type = "ساعة";
        tOuting.schedule = "Fri, Sat";
        if (tOuting.history && Array.isArray(tOuting.history)) {
            tOuting.history.forEach(h => { h.type = "ساعة"; });
        }
        setSnapshot(tOuting, {
            effectiveFrom: "2026-09-21",
            name: "Outing / Workout",
            category: tOuting.category || "خروج",
            subcategory: tOuting.subcategory || "",
            type: "ساعة",
            target: 2,
            multiplier: tOuting.multiplier !== undefined ? tOuting.multiplier : 1.0,
            schedule: "Fri, Sat",
            isBonus: false,
            comment: ""
        });
    }

    // Fix legacy exemption task history type (task_1788287491266)
    const tExempt = data.tasks.find(t => t.id === "task_1788287491266");
    if (tExempt) {
        tExempt.type = "ساعة";
        if (tExempt.history && Array.isArray(tExempt.history)) {
            tExempt.history.forEach(h => { h.type = "ساعة"; });
        }
    }

    // Normalize any task in category 'خروج'
    data.tasks.forEach(t => {
        if (t.category === "خروج") {
            t.type = "ساعة";
            if (t.history && Array.isArray(t.history)) {
                t.history.forEach(h => { h.type = "ساعة"; });
            }
        }
    });

    // 8. task_quran_memorize -> حفظ قرآن (Fri, Sat, 1h)
    const tQuran = data.tasks.find(t => t.id === "task_quran_memorize");
    if (tQuran) {
        tQuran.name = "حفظ قرآن";
        tQuran.target = 1;
        tQuran.type = "ساعة";
        tQuran.schedule = "Fri, Sat";
        setSnapshot(tQuran, {
            effectiveFrom: "2026-09-21",
            name: "حفظ قرآن",
            category: tQuran.category || "قرآن",
            subcategory: tQuran.subcategory || "حفظ",
            type: "ساعة",
            target: 1,
            multiplier: tQuran.multiplier !== undefined ? tQuran.multiplier : 1.0,
            schedule: "Fri, Sat",
            isBonus: false,
            comment: ""
        });
    }

    // 9. task_listening (Retired One-Time Task)
    const tList = data.tasks.find(t => t.id === "task_listening");
    if (tList) {
        tList.isOneTime = true;
        tList.schedule = "OneTime";
        tList.oneTimeDate = null;
        tList.isDeleted = true;
        tList.deletedAt = "2026-09-21";
        tList.isArchived = false;
        if (tList.history && Array.isArray(tList.history)) {
            tList.history.forEach(h => { h.isOneTime = false; });
        }
        setSnapshot(tList, {
            effectiveFrom: "2026-09-21",
            name: tList.name || "استماع بودكاست/محاضرة",
            category: tList.category || "استماع",
            subcategory: tList.subcategory || "",
            type: tList.type || "ساعة",
            target: 0,
            multiplier: tList.multiplier !== undefined ? tList.multiplier : 1.0,
            schedule: "OneTime",
            isOneTime: true,
            isBonus: false,
            comment: ""
        });
    }

    // 10. task_1786416106882 (Homework - Retired One-Time Task)
    const tHw = data.tasks.find(t => t.id === "task_1786416106882");
    if (tHw) {
        tHw.isOneTime = true;
        tHw.schedule = "OneTime";
        tHw.oneTimeDate = null;
        tHw.isDeleted = true;
        tHw.deletedAt = "2026-09-21";
        tHw.isArchived = false;
        if (tHw.history && Array.isArray(tHw.history)) {
            tHw.history.forEach(h => { h.isOneTime = false; });
        }
        setSnapshot(tHw, {
            effectiveFrom: "2026-09-21",
            name: tHw.name || "Homework",
            category: tHw.category || "شغل",
            subcategory: tHw.subcategory || "",
            type: tHw.type || "ساعة",
            target: 0,
            multiplier: tHw.multiplier !== undefined ? tHw.multiplier : 1.0,
            schedule: "OneTime",
            isOneTime: true,
            isBonus: false,
            comment: ""
        });
    }

    // 11. Add 3 New Tasks
    if (!data.tasks.some(t => t.id === "task_dw_videos")) {
        data.tasks.push({
            id: "task_dw_videos",
            name: "Videos / Content Creation",
            category: "شغل",
            subcategory: "",
            type: "ساعة",
            target: 4,
            multiplier: 1.0,
            schedule: "Mon",
            isBonus: false,
            isArchived: false,
            createdAt: "2026-09-21",
            history: [
                {
                    effectiveFrom: "2026-09-21",
                    name: "Videos / Content Creation",
                    category: "شغل",
                    subcategory: "",
                    type: "ساعة",
                    target: 4,
                    multiplier: 1.0,
                    schedule: "Mon",
                    isBonus: false,
                    comment: ""
                }
            ]
        });
    }

    if (!data.tasks.some(t => t.id === "task_sec_spanish")) {
        data.tasks.push({
            id: "task_sec_spanish",
            name: "Spanish",
            category: "مذاكرة",
            subcategory: "",
            type: "ساعة",
            target: 1,
            multiplier: 1.0,
            schedule: "Mon, Thu",
            isBonus: false,
            isArchived: false,
            createdAt: "2026-09-21",
            history: [
                {
                    effectiveFrom: "2026-09-21",
                    name: "Spanish",
                    category: "مذاكرة",
                    subcategory: "",
                    type: "ساعة",
                    target: 1,
                    multiplier: 1.0,
                    schedule: "Mon, Thu",
                    isBonus: false,
                    comment: ""
                }
            ]
        });
    }

    if (!data.tasks.some(t => t.id === "task_sec_todo")) {
        data.tasks.push({
            id: "task_sec_todo",
            name: "To-do Tasks",
            category: "شغل",
            subcategory: "",
            type: "ساعة",
            target: 1,
            multiplier: 1.0,
            schedule: "Sun, Tue",
            isBonus: false,
            isArchived: false,
            createdAt: "2026-09-21",
            history: [
                {
                    effectiveFrom: "2026-09-21",
                    name: "To-do Tasks",
                    category: "شغل",
                    subcategory: "",
                    type: "ساعة",
                    target: 1,
                    multiplier: 1.0,
                    schedule: "Sun, Tue",
                    isBonus: false,
                    comment: ""
                }
            ]
        });
    }

    console.log("[ScheduleMigration] Weekly schedule reorganization successfully applied.");
    return data;
}

if (typeof window !== "undefined") {
    window.applyWeeklyScheduleReorg = applyWeeklyScheduleReorg;
}
