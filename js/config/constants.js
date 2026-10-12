/**
 * Awrady Dashboard - Application Constants
 */
var APP_CONSTANTS = {
    STORAGE_KEY: "AWRAD_APP_DATA_V1",
    SUPABASE: {
        URL: "https://krmatocnrjzivwpmbxgu.supabase.co",
        ANON_KEY: "sb_publishable_JGajulg_tl67UJBKLyJZrA_E2tdQoZQ",
        DEFAULT_USER_ID: "primary_user"
    },
    AUDIO: {
        ALARM_URL: "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3"
    },
    SCHEDULE_TYPES: {
        EVERYDAY: "Everyday",
        WEEKDAYS: "Weekdays",
        WHITE_DAYS: "WhiteDays",
        RAMADAN: "Ramadan",
        ONE_TIME: "OneTime",
        OPTIONAL: "Optional"
    },
    POMODORO_DEFAULTS: {
        WORK_MINUTES: 25,
        REST_MINUTES: 5
    },
    CATEGORIES: [
        { 
            name: "صلاة", 
            icon: "fa-person-praying", 
            label: "🕌 الصلاة", 
            defaultUnit: "ركعة",
            defaultEstimatedMinutes: 15,
            subcategories: [
                { name: "فرض", defaultUnit: "صلاة" },
                { name: "نوافل", defaultEstimatedMinutes: 5 },
                { name: "قيام ليل", defaultEstimatedMinutes: 10 }
            ]
        },
        { name: "أذكار وتسبيح", icon: "fa-hands-praying", label: "📿 أذكار وتسبيح", defaultUnit: "تكرار", defaultEstimatedMinutes: 0.5 },
        { name: "قرآن", icon: "fa-book-quran", label: "📖 القرآن", defaultUnit: "صفحة", defaultEstimatedMinutes: 5 },
        { name: "صوم", icon: "fa-sun", label: "☀️ صوم", defaultUnit: "يوم", defaultEstimatedMinutes: 5 },
        { name: "قراءة", icon: "fa-book-open", label: "📚 قراءة", defaultUnit: "صفحة", defaultEstimatedMinutes: 3 },
        { name: "استماع", icon: "fa-headphones", label: "🎧 استماع", defaultUnit: "ساعة", defaultEstimatedMinutes: 60 },
        { name: "شغل", icon: "fa-briefcase", label: "💼 شغل", defaultUnit: "ساعة", defaultEstimatedMinutes: 60 },
        { name: "مذاكرة", icon: "fa-graduation-cap", label: "💻 مذاكرة", defaultUnit: "ساعة", defaultEstimatedMinutes: 60 }
    ]
};

if (typeof window !== "undefined") {
    window.APP_CONSTANTS = APP_CONSTANTS;
}
