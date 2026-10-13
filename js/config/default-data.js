/**
 * Awrady Dashboard - Unified Default Dataset & Configuration
 */

var DEFAULT_CATEGORIES = APP_CONSTANTS.CATEGORIES;

var DEFAULT_TASKS = [
    // صلاة - فرض
    { id: "task_fajr", name: "الفجر", schedule: "Everyday", target: 1, isArchived: false, category: "صلاة", subcategory: "فرض", createdAt: "2000-01-01" },
    { id: "task_dhuhr", name: "الظهر", schedule: "Everyday", target: 1, isArchived: false, category: "صلاة", subcategory: "فرض", createdAt: "2000-01-01" },
    { id: "task_asr", name: "العصر", schedule: "Everyday", target: 1, isArchived: false, category: "صلاة", subcategory: "فرض", createdAt: "2000-01-01" },
    { id: "task_maghrib", name: "المغرب", schedule: "Everyday", target: 1, isArchived: false, category: "صلاة", subcategory: "فرض", createdAt: "2000-01-01" },
    { id: "task_isha", name: "العشاء", schedule: "Everyday", target: 1, isArchived: false, category: "صلاة", subcategory: "فرض", createdAt: "2000-01-01" },
    // صلاة - نوافل
    { id: "task_sunnah", name: "السنن الرواتب", schedule: "Everyday", target: 12, isArchived: false, category: "صلاة", subcategory: "نوافل", createdAt: "2000-01-01" },
    { id: "task_duha", name: "الضحى", schedule: "Everyday", target: 2, isArchived: false, category: "صلاة", subcategory: "نوافل", createdAt: "2000-01-01" },
    { id: "task_witr", name: "الوتر", schedule: "Everyday", target: 1, isArchived: false, category: "صلاة", subcategory: "نوافل", createdAt: "2000-01-01" },
    // صلاة - قيام ليل
    { id: "task_qiyam", name: "قيام ليل", schedule: "Everyday", target: 2, isArchived: false, category: "صلاة", subcategory: "قيام ليل", createdAt: "2000-01-01" },
    // أذكار وتسبيح
    { id: "task_azkar_m", name: "أذكار الصباح", schedule: "Everyday", target: 1, isArchived: false, category: "أذكار وتسبيح", subcategory: "", createdAt: "2000-01-01" },
    { id: "task_azkar_e", name: "أذكار المساء", schedule: "Everyday", target: 1, isArchived: false, category: "أذكار وتسبيح", subcategory: "", createdAt: "2000-01-01" },
    { id: "task_azkar_prayer", name: "أذكار بعد الصلاة", schedule: "Everyday", target: 5, isArchived: false, category: "أذكار وتسبيح", subcategory: "", createdAt: "2000-01-01" },
    { id: "task_tasbeeh", name: "استغفار وتسبيح", schedule: "Everyday", target: 100, isArchived: false, category: "أذكار وتسبيح", subcategory: "", createdAt: "2000-01-01" },
    // قرآن
    { id: "task_quran_read", name: "ورد التلاوة", schedule: "Everyday", target: 5, isArchived: false, category: "قرآن", subcategory: "", createdAt: "2000-01-01" },
    { id: "task_quran_memorize", name: "ورد الحفظ", schedule: "Everyday", target: 1, isArchived: false, category: "قرآن", subcategory: "", createdAt: "2000-01-01" },
    // صوم
    { id: "task_fasting", name: "صيام الإثنين والخميس", schedule: "Mon, Thu", target: 1, isArchived: false, category: "صوم", subcategory: "", createdAt: "2000-01-01" },
    { id: "task_fasting_white_days", name: "صيام الأيام البيض", schedule: "WhiteDays", target: 1, isArchived: false, category: "صوم", subcategory: "", createdAt: "2000-01-01" },
    { id: "task_fasting_voluntary", name: "صيام تطوع عام", schedule: "Optional", target: 1, isArchived: false, category: "صوم", subcategory: "", createdAt: "2000-01-01" },
    // قراءة
    { id: "task_reading", name: "قراءة كتاب", schedule: "Everyday", target: 10, isArchived: false, category: "قراءة", subcategory: "", createdAt: "2000-01-01" },
    // استماع
    { id: "task_listening", name: "استماع بودكاست/محاضرة", schedule: "Sun, Wed", target: 1, isArchived: false, category: "استماع", subcategory: "", createdAt: "2000-01-01" },
    // شغل
    { id: "task_work", name: "ساعات العمل", schedule: "Everyday", target: 8, isArchived: false, category: "شغل", subcategory: "", createdAt: "2000-01-01" },
    // مذاكرة
    { id: "task_study_learn", name: "تعلم مهارة/كورس", schedule: "Everyday", target: 1, isArchived: false, category: "مذاكرة", subcategory: "", createdAt: "2000-01-01" },
    { id: "task_study_practice", name: "حل مسائل وتمارين", schedule: "Everyday", target: 5, isArchived: false, category: "مذاكرة", subcategory: "", createdAt: "2000-01-01" },
    { id: "task_study_project", name: "العمل على مشروع", schedule: "Everyday", target: 2, isArchived: false, category: "مذاكرة", subcategory: "", createdAt: "2000-01-01" }
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
