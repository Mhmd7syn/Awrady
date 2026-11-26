import test from 'node:test';
import assert from 'node:assert/strict';
import { ScheduleEngine } from '../js/core/schedule-engine.js';

test('ScheduleEngine: Everyday schedule is scheduled for any date', () => {
    const task = { id: 't1', schedule: 'Everyday', target: 5 };
    assert.equal(ScheduleEngine.isTaskScheduledForDate(task, '2026-11-22'), true);
});

test('ScheduleEngine: OneTime schedule only active on specific date', () => {
    const task = { id: 't2', schedule: 'OneTime', oneTimeDate: '2026-11-22', target: 1 };
    assert.equal(ScheduleEngine.isTaskScheduledForDate(task, '2026-11-22'), true);
    assert.equal(ScheduleEngine.isTaskScheduledForDate(task, '2026-11-23'), false);
});

test('ScheduleEngine: dailyTargets dictates schedule per weekday abbreviation', () => {
    // 2026-11-21 is Sat, 2026-11-22 is Sun
    const task = {
        id: 't3',
        schedule: 'Everyday',
        target: 1,
        dailyTargets: { Sat: 2, Sun: 0, Mon: 1, Tue: 1, Wed: 1, Thu: 1, Fri: 1 }
    };
    assert.equal(ScheduleEngine.isTaskScheduledForDate(task, '2026-11-21'), true);
    assert.equal(ScheduleEngine.isTaskScheduledForDate(task, '2026-11-22'), false);
});

test('ScheduleEngine: disabled status in day log overrides schedule', () => {
    const task = { id: 't1', schedule: 'Everyday', target: 5 };
    const appData = {
        tasks: [task],
        logs: {
            '2026-11-22': {
                taskProgress: {
                    t1: { status: 'disabled', achieved: 0, target: 0 }
                }
            }
        }
    };
    assert.equal(ScheduleEngine.isTaskScheduledForDate(task, '2026-11-22', appData), false);
    assert.equal(ScheduleEngine.isTaskDisabledForDate(task, '2026-11-22', appData), true);
});

test('ScheduleEngine: bonus detection when achieved on non-scheduled day', () => {
    const task = { id: 't2', schedule: 'OneTime', oneTimeDate: '2026-11-20', target: 1 };
    const appData = {
        tasks: [task],
        logs: {
            '2026-11-22': {
                taskProgress: {
                    t2: { achieved: 1 }
                }
            }
        }
    };
    assert.equal(ScheduleEngine.isBonusTaskForDate(task, '2026-11-22', appData, 1), true);
});

test('ScheduleEngine: isVisibleOn returns true for scheduled, bonus with progress, and disabled tasks', () => {
    const taskScheduled = { id: 's1', schedule: 'Everyday', target: 1 };
    const taskDisabled = { id: 'd1', schedule: 'Everyday', target: 1 };
    const taskBonusWithProgress = { id: 'b1', schedule: 'OneTime', oneTimeDate: '2026-11-20', target: 1 };
    const taskBonusNoProgress = { id: 'b2', schedule: 'OneTime', oneTimeDate: '2026-11-20', target: 1 };

    const appData = {
        tasks: [taskScheduled, taskDisabled, taskBonusWithProgress, taskBonusNoProgress],
        logs: {
            '2026-11-22': {
                taskProgress: {
                    d1: { status: 'disabled', achieved: 0 },
                    b1: { achieved: 5 },
                    b2: { achieved: 0 }
                }
            }
        }
    };

    assert.equal(ScheduleEngine.isVisibleOn(taskScheduled, '2026-11-22', appData), true);
    assert.equal(ScheduleEngine.isVisibleOn(taskDisabled, '2026-11-22', appData), true);
    assert.equal(ScheduleEngine.isVisibleOn(taskBonusWithProgress, '2026-11-22', appData), true);
    assert.equal(ScheduleEngine.isVisibleOn(taskBonusNoProgress, '2026-11-22', appData), false);
});

test('ScheduleEngine: fasting task respects dailyTargets for Everyday and specific-day schedules', () => {
    const everydayFasting = {
        id: 'task_fasting_everyday',
        name: 'صيام تطوعي',
        category: 'صوم',
        schedule: 'Everyday',
        target: 1,
        dailyTargets: { Sat: 0, Sun: 0, Mon: 1, Tue: 0, Wed: 0, Thu: 1, Fri: 0 }
    };
    const nonSpecialContextSat = { dayAbbrev: 'Sat', hijriInfo: { isRamadan: false, isWhiteDay: false } };
    const nonSpecialContextMon = { dayAbbrev: 'Mon', hijriInfo: { isRamadan: false, isWhiteDay: false } };

    assert.equal(ScheduleEngine.isTaskScheduledForDate(everydayFasting, '2026-11-21', null, null, nonSpecialContextSat), false);
    assert.equal(ScheduleEngine.isTaskScheduledForDate(everydayFasting, '2026-11-23', null, null, nonSpecialContextMon), true);

    const specificDaysFasting = {
        id: 'task_fasting_specific',
        name: 'صيام الإثنين والخميس',
        category: 'صوم',
        schedule: 'Mon, Thu',
        target: 1,
        dailyTargets: { Mon: 0, Thu: 1 }
    };
    const nonSpecialContextThu = { dayAbbrev: 'Thu', hijriInfo: { isRamadan: false, isWhiteDay: false } };

    assert.equal(ScheduleEngine.isTaskScheduledForDate(specificDaysFasting, '2026-11-23', null, null, nonSpecialContextMon), false);
    assert.equal(ScheduleEngine.isTaskScheduledForDate(specificDaysFasting, '2026-11-26', null, null, nonSpecialContextThu), true);
});

test('ScheduleEngine: WhiteDays and Ramadan fasting schedules remain intact', () => {
    const whiteDaysTask = { id: 'wd1', name: 'صيام الأيام البيض', category: 'صوم', schedule: 'WhiteDays', target: 1 };
    const ramadanTask = { id: 'rm1', name: 'صيام رمضان', category: 'صوم', schedule: 'Ramadan', target: 1 };

    assert.equal(ScheduleEngine.isTaskScheduledForDate(whiteDaysTask, '2026-11-21', null, null, { dayAbbrev: 'Sat', hijriInfo: { isRamadan: false, isWhiteDay: true } }), true);
    assert.equal(ScheduleEngine.isTaskScheduledForDate(whiteDaysTask, '2026-11-21', null, null, { dayAbbrev: 'Sat', hijriInfo: { isRamadan: false, isWhiteDay: false } }), false);
    assert.equal(ScheduleEngine.isTaskScheduledForDate(ramadanTask, '2026-11-21', null, null, { dayAbbrev: 'Sat', hijriInfo: { isRamadan: true, isWhiteDay: false } }), true);
    assert.equal(ScheduleEngine.isTaskScheduledForDate(ramadanTask, '2026-11-21', null, null, { dayAbbrev: 'Sat', hijriInfo: { isRamadan: false, isWhiteDay: false } }), false);
});
