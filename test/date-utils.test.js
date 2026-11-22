import test from 'node:test';
import assert from 'node:assert/strict';
import {
    parseLocalDate,
    getLocalTodayString,
    getDayOfWeekAbbrev,
    addDays,
    getDatesForCurrentWeek,
    getHijriDateDetails
} from '../js/utils/date-utils.js';

test('DateUtils: parseLocalDate parses YYYY-MM-DD at midday local time', () => {
    const d = parseLocalDate('2026-11-22');
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 10); // 0-indexed: 10 is November
    assert.equal(d.getDate(), 22);
    assert.equal(d.getHours(), 12);
});

test('DateUtils: getLocalTodayString formats date as YYYY-MM-DD', () => {
    const date = new Date(2026, 4, 15, 10, 0, 0); // May 15, 2026
    const str = getLocalTodayString(date);
    assert.equal(str, '2026-05-15');
});

test('DateUtils: getDayOfWeekAbbrev returns correct 3-letter weekday abbreviation', () => {
    // 2026-11-21 is Saturday, 2026-11-22 is Sunday
    assert.equal(getDayOfWeekAbbrev('2026-11-21'), 'Sat');
    assert.equal(getDayOfWeekAbbrev('2026-11-22'), 'Sun');
    assert.equal(getDayOfWeekAbbrev('2026-11-23'), 'Mon');
    assert.equal(getDayOfWeekAbbrev('2026-11-24'), 'Tue');
    assert.equal(getDayOfWeekAbbrev('2026-11-25'), 'Wed');
    assert.equal(getDayOfWeekAbbrev('2026-11-26'), 'Thu');
    assert.equal(getDayOfWeekAbbrev('2026-11-27'), 'Fri');
});

test('DateUtils: addDays adds and subtracts days without timezone drift', () => {
    assert.equal(addDays('2026-11-22', 1), '2026-11-23');
    assert.equal(addDays('2026-11-22', -1), '2026-11-21');
    assert.equal(addDays('2026-11-30', 1), '2026-12-01');
});

test('DateUtils: getDatesForCurrentWeek returns 7 days starting from Saturday', () => {
    const week = getDatesForCurrentWeek('2026-11-22'); // Sunday
    assert.equal(week.length, 7);
    assert.equal(week[0].dayNameEn, 'Sat');
    assert.equal(week[0].dateStr, '2026-11-21');
    assert.equal(week[1].dayNameEn, 'Sun');
    assert.equal(week[1].dateStr, '2026-11-22');
    assert.equal(week[6].dayNameEn, 'Fri');
    assert.equal(week[6].dateStr, '2026-11-27');
});

test('DateUtils: getHijriDateDetails calculates Hijri date details', () => {
    const hijri = getHijriDateDetails('2026-11-22');
    assert.ok(hijri.hYear > 1440);
    assert.ok(hijri.hMonth >= 1 && hijri.hMonth <= 12);
    assert.ok(hijri.hDay >= 1 && hijri.hDay <= 30);
    assert.ok(typeof hijri.isWhiteDay === 'boolean');
    assert.ok(typeof hijri.isRamadan === 'boolean');
});
