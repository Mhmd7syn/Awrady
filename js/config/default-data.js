/**
 * Awrady Dashboard - Unified Default Dataset & Configuration
 */

var DEFAULT_CATEGORIES = [
    { 
        id: "cat_1", 
        name: "صلاة", 
        icon: "fa-person-praying", 
        label: "🕌 الصلاة", 
        defaultEstimatedMinutes: 15,
        subcategories: [
            { id: "sub_1_1", name: "فرض", defaultUnit: "صلاة", defaultEstimatedMinutes: 15 },
            { id: "sub_1_2", name: "نوافل", defaultUnit: "ركعة", defaultEstimatedMinutes: 5 },
            { id: "sub_1_3", name: "قيام ليل", defaultUnit: "ركعة", defaultEstimatedMinutes: 10 }
        ], 
        defaultUnit: "ركعة" 
    },
    { id: "cat_2", name: "أذكار وتسبيح", icon: "fa-hands-praying", label: "📿 أذكار وتسبيح", defaultEstimatedMinutes: 0.5, subcategories: [], defaultUnit: "تكرار" },
    { id: "cat_3", name: "قرآن", icon: "fa-book-quran", label: "📖 القرآن", defaultEstimatedMinutes: 5, subcategories: [], defaultUnit: "صفحة" },
    { id: "cat_4", name: "صوم", icon: "fa-sun", label: "☀️ صوم", defaultEstimatedMinutes: 5, subcategories: [], defaultUnit: "يوم" },
    { id: "cat_5", name: "قراءة", icon: "fa-book-open", label: "📚 قراءة", defaultEstimatedMinutes: 3, subcategories: [], defaultUnit: "صفحة" },
    { id: "cat_6", name: "استماع", icon: "fa-headphones", label: "🎧 استماع", defaultEstimatedMinutes: 60, subcategories: [], defaultUnit: "ساعة" },
    { id: "cat_7", name: "شغل", icon: "fa-briefcase", label: "💼 شغل", defaultEstimatedMinutes: 60, subcategories: [], defaultUnit: "ساعة" },
    { id: "cat_8", name: "مذاكرة", icon: "fa-graduation-cap", label: "💻 مذاكرة", defaultEstimatedMinutes: 60, subcategories: [
        { id: "sub_8_1", name: "تعلم", defaultUnit: "ساعة", defaultEstimatedMinutes: 60 },
        { id: "sub_8_2", name: "حل وتمارين", defaultUnit: "تكرار", defaultEstimatedMinutes: 20 },
        { id: "sub_8_3", name: "بروجكتات", defaultUnit: "ساعة", defaultEstimatedMinutes: 60 }
    ], defaultUnit: "ساعة" }
];

var DEFAULT_TASKS = [
    // صلاة - فرض
    { id: "task_fajr", name: "الفجر", type: "صلاة", schedule: "Everyday", target: 1, multiplier: 1.0, isArchived: false, icon: "mosque", category: "صلاة", subcategory: "فرض", createdAt: "2000-01-01" },
    { id: "task_dhuhr", name: "الظهر", type: "صلاة", schedule: "Everyday", target: 1, multiplier: 1.0, isArchived: false, icon: "sun", category: "صلاة", subcategory: "فرض", createdAt: "2000-01-01" },
    { id: "task_asr", name: "العصر", type: "صلاة", schedule: "Everyday", target: 1, multiplier: 1.0, isArchived: false, icon: "sun", category: "صلاة", subcategory: "فرض", createdAt: "2000-01-01" },
    { id: "task_maghrib", name: "المغرب", type: "صلاة", schedule: "Everyday", target: 1, multiplier: 1.0, isArchived: false, icon: "moon", category: "صلاة", subcategory: "فرض", createdAt: "2000-01-01" },
    { id: "task_isha", name: "العشاء", type: "صلاة", schedule: "Everyday", target: 1, multiplier: 1.0, isArchived: false, icon: "moon", category: "صلاة", subcategory: "فرض", createdAt: "2000-01-01" },
    // صلاة - نوافل
    { id: "task_sunnah", name: "السنن الرواتب", type: "ركعة", schedule: "Everyday", target: 12, multiplier: 1.0, isArchived: false, icon: "sparkles", category: "صلاة", subcategory: "نوافل", createdAt: "2000-01-01" },
    { id: "task_duha", name: "الضحى", type: "ركعة", schedule: "Everyday", target: 2, multiplier: 1.0, isArchived: false, icon: "sun", category: "صلاة", subcategory: "نوافل", createdAt: "2000-01-01" },
    { id: "task_witr", name: "الوتر", type: "ركعة", schedule: "Everyday", target: 1, multiplier: 1.0, isArchived: false, icon: "moon", category: "صلاة", subcategory: "نوافل", createdAt: "2000-01-01" },
    // صلاة - قيام ليل
    { id: "task_qiyam", name: "قيام ليل", type: "ركعة", schedule: "Everyday", target: 2, multiplier: 1.0, isArchived: false, icon: "moon", category: "صلاة", subcategory: "قيام ليل", createdAt: "2000-01-01" },
    // أذكار وتسبيح
    { id: "task_azkar_m", name: "أذكار الصباح", type: "تكرار", schedule: "Everyday", target: 1, multiplier: 1.0, isArchived: false, icon: "sun", category: "أذكار وتسبيح", subcategory: "", createdAt: "2000-01-01" },
    { id: "task_azkar_e", name: "أذكار المساء", type: "تكرار", schedule: "Everyday", target: 1, multiplier: 1.0, isArchived: false, icon: "moon", category: "أذكار وتسبيح", subcategory: "", createdAt: "2000-01-01" },
    { id: "task_azkar_prayer", name: "أذكار بعد الصلاة", type: "تكرار", schedule: "Everyday", target: 5, multiplier: 1.0, isArchived: false, icon: "hands-praying", category: "أذكار وتسبيح", subcategory: "", createdAt: "2000-01-01" },
    { id: "task_tasbeeh", name: "استغفار وتسبيح", type: "تكرار", schedule: "Everyday", target: 100, multiplier: 1.0, isArchived: false, icon: "ring", category: "أذكار وتسبيح", subcategory: "", createdAt: "2000-01-01" },
    // قرآن
    { id: "task_quran_read", name: "ورد التلاوة", type: "صفحة", schedule: "Everyday", target: 5, multiplier: 1.0, isArchived: false, icon: "book-open", category: "قرآن", subcategory: "", createdAt: "2000-01-01" },
    { id: "task_quran_memorize", name: "ورد الحفظ", type: "صفحة", schedule: "Everyday", target: 1, multiplier: 1.0, isArchived: false, icon: "bookmark", category: "قرآن", subcategory: "", createdAt: "2000-01-01" },
    // صوم
    { id: "task_fasting", name: "صيام الإثنين والخميس", type: "يوم", schedule: "Mon, Thu", target: 1, multiplier: 1.0, isArchived: false, icon: "sun", category: "صوم", subcategory: "", allowNotes: false, createdAt: "2000-01-01" },
    { id: "task_fasting_white_days", name: "صيام الأيام البيض", type: "يوم", schedule: "WhiteDays", target: 1, multiplier: 1.0, isArchived: false, icon: "sun", category: "صوم", subcategory: "", allowNotes: false, createdAt: "2000-01-01" },
    { id: "task_fasting_voluntary", name: "صيام تطوع عام", type: "يوم", schedule: "Optional", target: 1, multiplier: 1.0, isArchived: false, icon: "sun", category: "صوم", subcategory: "", allowNotes: false, createdAt: "2000-01-01" },
    // قراءة
    { id: "task_reading", name: "قراءة كتاب", type: "صفحة", schedule: "Everyday", target: 10, multiplier: 1.0, isArchived: false, icon: "book", category: "قراءة", subcategory: "", createdAt: "2000-01-01" },
    // استماع
    { id: "task_listening", name: "استماع بودكاست/محاضرة", type: "ساعة", schedule: "Sun, Wed", target: 1, multiplier: 1.0, isArchived: false, icon: "headphones", category: "استماع", subcategory: "", createdAt: "2000-01-01" },
    // شغل
    { id: "task_work", name: "ساعات العمل", type: "ساعة", schedule: "Everyday", target: 8, multiplier: 1.0, isArchived: false, icon: "briefcase", category: "شغل", subcategory: "", createdAt: "2000-01-01" },
    // مذاكرة
    { id: "task_study_learn", name: "تعلم مهارة/كورس", type: "ساعة", schedule: "Everyday", target: 1, multiplier: 1.0, isArchived: false, icon: "laptop-code", category: "مذاكرة", subcategory: "تعلم", createdAt: "2000-01-01" },
    { id: "task_study_practice", name: "حل مسائل وتمارين", type: "تكرار", schedule: "Everyday", target: 5, multiplier: 1.0, isArchived: false, icon: "pen-to-square", category: "مذاكرة", subcategory: "حل وتمارين", createdAt: "2000-01-01" },
    { id: "task_study_project", name: "العمل على مشروع", type: "ساعة", schedule: "Everyday", target: 2, multiplier: 1.0, isArchived: false, icon: "diagram-project", category: "مذاكرة", subcategory: "بروجكتات", createdAt: "2000-01-01" }
];

var DEFAULT_AWRAD_DATA = {
    categories: DEFAULT_CATEGORIES,
    tasks: DEFAULT_TASKS,
    logs: {}
};

if (typeof window !== "undefined") {
    window.DEFAULT_CATEGORIES = DEFAULT_CATEGORIES;
    window.DEFAULT_TASKS = DEFAULT_TASKS;
    window.DEFAULT_AWRAD_DATA = DEFAULT_AWRAD_DATA;
}
