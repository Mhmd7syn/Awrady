/**
 * Awrady Dashboard - Application Constants
 */
var APP_CONSTANTS = {
    STORAGE_KEY: "AWRAD_APP_DATA_V1",
    STORAGE_KEYS: {
        SESSION_USER: "AWRAD_AUTH_USER",
        PIN_HASH: "AWRAD_PIN_HASH",
        PIN_SESSION: "AWRAD_AUTH_SESSION",
        POMODORO: "AWRAD_POMO_STATE"
    },
    HASH_SALTS: {
        PASSWORD: "awrady_salt_v1",
        PIN: "awrady_secure_salt_v1"
    },
    DB: {
        TABLES: {
            USERS: "users",
            TASKS: "tasks",
            PROGRESS: "daily_progress"
        },
        CHANNEL: "enjaz_live_sync"
    },
    GUEST_USER: "primary_user",
    SUPABASE: {
        URL: "https://krmatocnrjzivwpmbxgu.supabase.co",
        ANON_KEY: "sb_publishable_JGajulg_tl67UJBKLyJZrA_E2tdQoZQ",
        DEFAULT_USER_ID: "primary_user"
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
    TIME_UNITS: ["ساعة", "ساعات", "ساعات ودقايق", "وقت", "دقيقة"],
    PRAYER_VALUES: {
        CONGREGATION: 1,
        ALONE: 0.5,
        MISSED: 0
    },
    TASK_IDS: {
        FARD: ["task_fajr", "task_dhuhr", "task_asr", "task_maghrib", "task_isha"],
        SUNNAH: "task_sunnah",
        PRAYER_AZKAR: "task_azkar_prayer",
        QURAN_WIRD: "task_quran_read"
    },
    WEEKDAYS: [
        { key: "Sat", ar: "السبت" },
        { key: "Sun", ar: "الأحد" },
        { key: "Mon", ar: "الإثنين" },
        { key: "Tue", ar: "الثلاثاء" },
        { key: "Wed", ar: "الأربعاء" },
        { key: "Thu", ar: "الخميس" },
        { key: "Fri", ar: "الجمعة" }
    ],
    HIJRI_MONTHS: [
        "محرم", "صفر", "ربيع الأول", "ربيع الآخر",
        "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان",
        "رمضان", "شوال", "ذو القعدة", "ذو الحجة"
    ],
    WHITE_DAYS: [13, 14, 15],
    RAMADAN_MONTH: 9,
    LIMITS: {
        USERNAME_MIN: 3,
        PASSWORD_MIN: 4,
        PIN_MIN: 4,
        PIN_MAX: 6,
        POMO_WORK_MAX: 180,
        POMO_REST_MAX: 60,
        TIME_STEP_MIN: 15,
        NAWAFEL_STEP: 2
    },
    UI: {
        SAVE_DEBOUNCE_MS: 350,
        SCORE_RING_CIRCUMFERENCE: 314,
        SCORE_THRESHOLDS: { GOLD: 100, GREEN: 70, BLUE: 40 },
        CHART_MAX_POINTS: 30,
        CHART_MAX_POINTS_MOBILE: 15,
        MOBILE_BREAKPOINT: 500
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
