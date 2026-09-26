/**
 * Awrady Dashboard - Date & Hijri Calculation Utilities
 */

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
 * Formats a Date object into YYYY-MM-DD string
 * @param {Date} dateObj 
 * @returns {string}
 */
function formatDateStr(dateObj) {
    return getLocalTodayString(dateObj);
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

/**
 * Gets 3-letter English weekday abbreviation (e.g. Sun, Mon, Tue)
 * @param {string} dateStr YYYY-MM-DD string
 * @returns {string}
 */
function getDayOfWeekAbbrev(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr.includes("T") ? dateStr : dateStr + "T12:00:00");
    return date.toLocaleDateString('en-US', { weekday: 'short' });
}

/**
 * Formats YYYY-MM-DD into full Arabic date string
 * @param {string} dateStr 
 * @returns {string}
 */
function getArabicDateFormatted(dateStr) {
    const date = new Date(dateStr.includes("T") ? dateStr : dateStr + "T12:00:00");
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    try {
        return date.toLocaleDateString('ar-EG', options);
    } catch (e) {
        return dateStr;
    }
}

/**
 * Smart Hijri Date & Lunar Calendar details calculation (Umm al-Qura)
 * @param {string} dateStr 
 * @returns {{ hDay: number, hMonth: number, hYear: number, dateStringAr: string, isWhiteDay: boolean, isRamadan: boolean }}
 */
function getHijriDateDetails(dateStr) {
    const date = new Date(dateStr.includes("T") ? dateStr : dateStr + "T12:00:00");
    try {
        const dateStringAr = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(date);

        const parts = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
            day: 'numeric',
            month: 'numeric',
            year: 'numeric'
        }).formatToParts(date);

        let hDay = 0, hMonth = 0, hYear = 0;
        parts.forEach(p => {
            if (p.type === 'day') hDay = parseInt(p.value, 10);
            if (p.type === 'month') hMonth = parseInt(p.value, 10);
            if (p.type === 'year') hYear = parseInt(p.value, 10);
        });

        // White Days (13, 14, 15) - Exclude Tashreeq (Month 12 Day 13) and Ramadan (Month 9)
        const isWhiteDay = (hDay === 13 || hDay === 14 || hDay === 15) && (hMonth !== 9) && !(hMonth === 12 && hDay === 13);
        const isRamadan = (hMonth === 9);

        const hijriMonthNames = ["", "محرم", "صفر", "ربيع الأول", "ربيع الثاني", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"];
        const monthName = hijriMonthNames[hMonth] || "";

        const formattedHijri = dateStringAr.includes("هـ") ? dateStringAr : dateStringAr + " هـ";
        return {
            hDay, hMonth, hYear,
            day: hDay,
            monthName,
            dateStringAr: formattedHijri,
            formatted: formattedHijri,
            hijriFormatted: formattedHijri,
            isWhiteDay,
            isRamadan
        };
    } catch (e) {
        return { hDay: 0, hMonth: 0, hYear: 0, day: 0, monthName: "", dateStringAr: "التقويم الهجري", formatted: "التقويم الهجري", hijriFormatted: "التقويم الهجري", isWhiteDay: false, isRamadan: false };
    }
}

/**
 * Returns an array of 7 date objects starting from Saturday of the current week
 * @param {string|Date} referenceDate 
 * @returns {Array<{ dateStr: string, dayNameAr: string, dayNameEn: string, isToday: boolean }>}
 */
function getDatesForCurrentWeek(referenceDate = new Date()) {
    const curr = typeof referenceDate === 'string' 
        ? new Date(referenceDate.includes("T") ? referenceDate : referenceDate + "T12:00:00")
        : new Date(referenceDate);
        
    const day = curr.getDay(); // 0 is Sun, 6 is Sat
    // Saturday is day 6. Calculate offset to previous Saturday
    const diffToSat = (day + 1) % 7; 
    const sat = new Date(curr);
    sat.setDate(curr.getDate() - diffToSat);

    const week = [];
    const todayStr = getLocalTodayString();

    const arabicDays = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
    const englishDays = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

    for (let i = 0; i < 7; i++) {
        const d = new Date(sat);
        d.setDate(sat.getDate() + i);
        const dateStr = getLocalTodayString(d);
        week.push({
            dateStr,
            dateObj: d,
            dayNameAr: arabicDays[i],
            dayNameEn: englishDays[i],
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
    const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T12:00:00");
    d.setDate(d.getDate() + days);
    return getLocalTodayString(d);
}

if (typeof window !== "undefined") {
    window.getLocalTodayString = getLocalTodayString;
    window.formatDateStr = formatDateStr;
    window.formatTimeHM = formatTimeHM;
    window.getDayOfWeekAbbrev = getDayOfWeekAbbrev;
    window.getArabicDateFormatted = getArabicDateFormatted;
    window.getHijriDateDetails = getHijriDateDetails;
    window.getDatesForCurrentWeek = getDatesForCurrentWeek;
    window.addDays = addDays;

    // Aliases for backward compatibility with app.js
    window.getHijriDetails = getHijriDateDetails;
    window.formatDateArabic = getArabicDateFormatted;
    window.getDayOfWeekStr = getDayOfWeekAbbrev;
}
