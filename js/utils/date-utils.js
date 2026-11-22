/**
 * Awrady Dashboard - Date & Hijri Calculation Utilities
 */

import { APP_CONSTANTS } from '../config/constants.js';

/**
 * Returns today's date formatted as YYYY-MM-DD in local time
 * @param {Date} [dateObj] Optional Date object, defaults to current time
 * @returns {string} Date string in YYYY-MM-DD format
 */
function getLocalTodayString(dateObj = new Date()) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Safely parses a YYYY-MM-DD string into a local Date object at midday to prevent UTC timezone date shifting
 * @param {string|Date} dateStr 
 * @returns {Date}
 */
function parseLocalDate(dateStr) {
    if (!dateStr) return new Date();
    if (dateStr instanceof Date) return new Date(dateStr.getTime());
    const str = String(dateStr).trim();
    if (str.includes("T")) return new Date(str);
    const parts = str.split("-");
    if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
            return new Date(y, m, d, 12, 0, 0);
        }
    }
    return new Date(str + "T12:00:00");
}


/**
 * Formats minutes into human-readable Arabic hours & minutes
 * @param {number} minutes 
 * @returns {string}
 */
function formatTimeHM(minutes) {
    if (!minutes || minutes <= 0) return "0 دقيقة";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h} ساعة و ${m} دقيقة`;
    if (h > 0) return `${h} ساعة`;
    return `${m} دقيقة`;
}

const WEEKDAY_ABBREVS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ARABIC_WEEKDAYS = APP_CONSTANTS.WEEKDAYS.map(w => w.ar);
const ENGLISH_WEEKDAYS = APP_CONSTANTS.WEEKDAYS.map(w => w.key);

let _arabicDateFormatter = null;
let _hijriArFormatter = null;
let _hijriEnPartsFormatter = null;

function getArabicDateFormatter() {
    if (!_arabicDateFormatter) {
        _arabicDateFormatter = new Intl.DateTimeFormat('ar-EG', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
    return _arabicDateFormatter;
}

function getHijriArFormatter() {
    if (!_hijriArFormatter) {
        _hijriArFormatter = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }
    return _hijriArFormatter;
}

function getHijriEnPartsFormatter() {
    if (!_hijriEnPartsFormatter) {
        _hijriEnPartsFormatter = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
            day: 'numeric',
            month: 'numeric',
            year: 'numeric'
        });
    }
    return _hijriEnPartsFormatter;
}

const _hijriDetailsCache = new Map();

/**
 * Gets 3-letter English weekday abbreviation (e.g. Sun, Mon, Tue)
 * Fast static array lookup replaces heavy toLocaleDateString
 * @param {string} dateStr YYYY-MM-DD string
 * @returns {string}
 */
function getDayOfWeekAbbrev(dateStr) {
    if (!dateStr) return "";
    const date = parseLocalDate(dateStr);
    return WEEKDAY_ABBREVS[date.getDay()] || "";
}

/**
 * Formats YYYY-MM-DD into full Arabic date string using persistent Intl formatter
 * @param {string} dateStr 
 * @returns {string}
 */
function getArabicDateFormatted(dateStr) {
    if (!dateStr) return "";
    const date = parseLocalDate(dateStr);
    try {
        return getArabicDateFormatter().format(date);
    } catch (e) {
        return dateStr;
    }
}

/**
 * Smart Hijri Date & Lunar Calendar details calculation (Umm al-Qura)
 * Memoized per dateStr to eliminate redundant Intl formatter allocations
 * @param {string} dateStr 
 * @returns {{ hDay: number, hMonth: number, hYear: number, monthName: string, formatted: string, isWhiteDay: boolean, isRamadan: boolean }}
 */
function getHijriDateDetails(dateStr) {
    if (!dateStr) {
        return { hDay: 0, hMonth: 0, hYear: 0, monthName: "", formatted: "التقويم الهجري", isWhiteDay: false, isRamadan: false };
    }
    const cleanKey = typeof dateStr === "string" 
        ? (dateStr.includes("T") ? dateStr.split("T")[0] : dateStr)
        : (dateStr instanceof Date ? getLocalTodayString(dateStr) : String(dateStr));

    if (_hijriDetailsCache.has(cleanKey)) {
        return _hijriDetailsCache.get(cleanKey);
    }

    const date = parseLocalDate(cleanKey);
    try {
        const dateStringAr = getHijriArFormatter().format(date);
        const parts = getHijriEnPartsFormatter().formatToParts(date);

        let hDay = 0, hMonth = 0, hYear = 0;
        parts.forEach(p => {
            if (p.type === 'day') hDay = parseInt(p.value, 10);
            if (p.type === 'month') hMonth = parseInt(p.value, 10);
            if (p.type === 'year') hYear = parseInt(p.value, 10);
        });

        // White Days (13, 14, 15) - Exclude Tashreeq (Month 12 Day 13) and Ramadan (Month 9)
        const isWhiteDay = APP_CONSTANTS.WHITE_DAYS.includes(hDay) && (hMonth !== APP_CONSTANTS.RAMADAN_MONTH) && !(hMonth === 12 && hDay === 13);
        const isRamadan = (hMonth === APP_CONSTANTS.RAMADAN_MONTH);

        const monthName = (hMonth >= 1 && hMonth <= 12) ? (APP_CONSTANTS.HIJRI_MONTHS[hMonth - 1] || "") : "";

        const formatted = dateStringAr.includes("هـ") ? dateStringAr : dateStringAr + " هـ";
        const result = {
            hDay,
            hMonth,
            hYear,
            monthName,
            formatted,
            isWhiteDay,
            isRamadan
        };
        _hijriDetailsCache.set(cleanKey, result);
        return result;
    } catch (e) {
        const fallback = { hDay: 0, hMonth: 0, hYear: 0, monthName: "", formatted: "التقويم الهجري", isWhiteDay: false, isRamadan: false };
        _hijriDetailsCache.set(cleanKey, fallback);
        return fallback;
    }
}

/**
 * Returns an array of 7 date objects starting from Saturday of the current week
 * @param {string|Date} referenceDate 
 * @returns {Array<{ dateStr: string, dayNameAr: string, dayNameEn: string, isToday: boolean }>}
 */
function getDatesForCurrentWeek(referenceDate = new Date()) {
    const curr = parseLocalDate(referenceDate);
        
    const day = curr.getDay(); // 0 is Sun, 6 is Sat
    // Saturday is day 6. Calculate offset to previous Saturday
    const diffToSat = (day + 1) % 7; 
    const sat = new Date(curr);
    sat.setDate(curr.getDate() - diffToSat);

    const week = [];
    const todayStr = getLocalTodayString();

    for (let i = 0; i < 7; i++) {
        const d = new Date(sat);
        d.setDate(sat.getDate() + i);
        const dateStr = getLocalTodayString(d);
        week.push({
            dateStr,
            dateObj: d,
            dayNameAr: ARABIC_WEEKDAYS[i],
            dayNameEn: ENGLISH_WEEKDAYS[i],
            isToday: (dateStr === todayStr)
        });
    }
    return week;
}

/**
 * Adds N days to a YYYY-MM-DD string and returns the new date string
 * @param {string} dateStr YYYY-MM-DD
 * @param {number} days Number of days to add (negative to subtract)
 * @returns {string} New date in YYYY-MM-DD
 */
function addDays(dateStr, days) {
    const d = parseLocalDate(dateStr);
    d.setDate(d.getDate() + days);
    return getLocalTodayString(d);
}

if (typeof window !== "undefined") {
    window.getLocalTodayString = getLocalTodayString;
    window.parseLocalDate = parseLocalDate;
    window.formatTimeHM = formatTimeHM;
    window.getDayOfWeekAbbrev = getDayOfWeekAbbrev;
    window.getArabicDateFormatted = getArabicDateFormatted;
    window.getHijriDateDetails = getHijriDateDetails;
    window.getDatesForCurrentWeek = getDatesForCurrentWeek;
    window.addDays = addDays;
}

export {
    getLocalTodayString,
    parseLocalDate,
    formatTimeHM,
    getDayOfWeekAbbrev,
    getArabicDateFormatted,
    getHijriDateDetails,
    getDatesForCurrentWeek,
    addDays,
    WEEKDAY_ABBREVS,
    ARABIC_WEEKDAYS,
    ENGLISH_WEEKDAYS
};
