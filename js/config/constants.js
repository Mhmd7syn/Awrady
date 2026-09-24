/**
 * Awrad & Enjaz Dashboard - Application Constants
 */
var APP_CONSTANTS = {
    STORAGE_KEY: "AWRAD_APP_DATA_V1",
    SERVERS: {
        LOCAL_NODE_URL: "http://localhost:3000/api/storage"
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
    }
};

if (typeof window !== "undefined") {
    window.APP_CONSTANTS = APP_CONSTANTS;
}
