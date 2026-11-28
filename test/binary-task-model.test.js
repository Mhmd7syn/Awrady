import test from 'node:test';
import assert from 'node:assert/strict';
import { ScheduleEngine } from '../js/core/schedule-engine.js';
import { ScoringEngine } from '../js/core/scoring-engine.js';
import { isEverydayOrSpecificDaysSchedule, isDailyScheduledTask, isUnscheduledTask, getTaskDayTarget } from '../js/core/task-rules.js';
import { awradyAPI } from '../js/api.js';
import { getTaskStatusKey, calculateTaskStatsForDates } from '../js/components/analytics-breakdown.js';

test('ScheduleEngine: Unscheduled task is never scheduled on any date', () => {
    const task = { id: 'u1', schedule: 'Unscheduled', target: 10 };
    assert.equal(ScheduleEngine.isTaskScheduledForDate(task, '2026-11-24'), false);
    assert.equal(ScheduleEngine.isTaskScheduledForDate(task, '2026-11-25'), false);
    assert.equal(ScheduleEngine.isTaskScheduledForDate(task, '2026-01-01'), false);
});

test('ScheduleEngine: Unscheduled task with progress (val > 0) is classified as bonus task', () => {
    const task = { id: 'u1', schedule: 'Unscheduled', target: 5 };
    const appData = {
        tasks: [task],
        logs: {
            '2026-11-24': {
                taskProgress: {
                    u1: { achieved: 3 }
                }
            }
        }
    };
    assert.equal(ScheduleEngine.isBonusTaskForDate(task, '2026-11-24', appData, 3), true);
});

test('ScheduleEngine: Unscheduled task with zero progress is not classified as bonus task', () => {
    const task = { id: 'u1', schedule: 'Unscheduled', target: 5 };
    const appData = {
        tasks: [task],
        logs: {
            '2026-11-24': {
                taskProgress: {
                    u1: { achieved: 0 }
                }
            }
        }
    };
    assert.equal(ScheduleEngine.isBonusTaskForDate(task, '2026-11-24', appData, 0), false);
});

test('ScheduleEngine: Unscheduled task without progress is not visible on date view', () => {
    const task = { id: 'u1', schedule: 'Unscheduled', target: 5 };
    const appData = {
        tasks: [task],
        logs: {
            '2026-11-24': {
                taskProgress: {}
            }
        }
    };
    assert.equal(ScheduleEngine.isVisibleOn(task, '2026-11-24', appData), false);
});

test('ScheduleEngine: Unscheduled task with progress is visible on date view', () => {
    const task = { id: 'u1', schedule: 'Unscheduled', target: 5 };
    const appData = {
        tasks: [task],
        logs: {
            '2026-11-24': {
                taskProgress: {
                    u1: { achieved: 2 }
                }
            }
        }
    };
    assert.equal(ScheduleEngine.isVisibleOn(task, '2026-11-24', appData), true);
});

test('ScoringEngine: Unscheduled task without progress does not penalize daily completion score', () => {
    const scheduledTask = { id: 's1', schedule: 'Everyday', target: 10, type: 'صفحة' };
    const unscheduledTask = { id: 'u1', schedule: 'Unscheduled', target: 50, type: 'صفحة' };
    const tasks = [scheduledTask, unscheduledTask];

    const log = {
        taskProgress: {
            s1: { achieved: 10, target: 10, status: 'scheduled' },
            u1: { achieved: 0, target: 50 }
        }
    };

    const res = ScoringEngine.compute(tasks, log, '2026-11-24');
    // Scheduled task is 100% completed; unscheduled task with 0 achieved must NOT penalize score
    assert.equal(res.score, 1.0);
});

test('ScoringEngine: Unscheduled task with progress contributes as bonus task', () => {
    const scheduledTask = { id: 's1', schedule: 'Everyday', target: 10, type: 'صفحة' };
    const unscheduledTask = { id: 'u1', schedule: 'Unscheduled', target: 10, type: 'صفحة' };
    const tasks = [scheduledTask, unscheduledTask];

    // Scheduled task at 50% (5/10), unscheduled task logged 5/10 as bonus
    const log = {
        taskProgress: {
            s1: { achieved: 5, target: 10, status: 'scheduled' },
            u1: { achieved: 5, target: 10 }
        }
    };

    const resWithBonus = ScoringEngine.compute(tasks, log, '2026-11-24');
    // Without bonus, score would be 0.5. With bonus (5/10 = 0.5 bonus ratio added to required weight),
    // score increases beyond 0.5
    assert.ok(resWithBonus.score > 0.5, `Score should be > 0.5, got ${resWithBonus.score}`);
    assert.equal(resWithBonus.score, 1.0);
});

test('TaskRules: isEverydayOrSpecificDaysSchedule and isDailyScheduledTask return false for Unscheduled', () => {
    assert.equal(isEverydayOrSpecificDaysSchedule('Unscheduled'), false);
    assert.equal(isEverydayOrSpecificDaysSchedule('  Unscheduled  '), false);

    const unscheduledTask = { id: 'u1', schedule: 'Unscheduled', target: 5 };
    assert.equal(isDailyScheduledTask(unscheduledTask), false);

    const everydayTask = { id: 'e1', schedule: 'Everyday', target: 5 };
    assert.equal(isDailyScheduledTask(everydayTask), true);
});

test('TaskRules: getTaskDayTarget resolves scalar target for Unscheduled tasks', () => {
    const task = { id: 'u1', schedule: 'Unscheduled', target: 15, dailyTargets: { Sat: 20, Sun: 25 } };
    assert.equal(getTaskDayTarget(task, 'Sat'), 15);
    assert.equal(getTaskDayTarget(task, '2026-11-24'), 15);
});

test('TaskRules: isUnscheduledTask classifies Unscheduled, OneTime, and archived tasks accurately', () => {
    assert.equal(isUnscheduledTask({ id: 'u1', schedule: 'Unscheduled' }), true);
    assert.equal(isUnscheduledTask({ id: 'u2', schedule: 'OneTime' }), true);
    assert.equal(isUnscheduledTask({ id: 'u3', schedule: 'Everyday', isOneTime: true }), true);
    assert.equal(isUnscheduledTask({ id: 'u4', schedule: 'Everyday', isArchived: true }), true);
    assert.equal(isUnscheduledTask({ id: 's1', schedule: 'Everyday', isArchived: false }), false);
    assert.equal(isUnscheduledTask({ id: 's2', schedule: 'Mon, Thu' }), false);
    assert.equal(isUnscheduledTask({ id: 's3', schedule: 'Ramadan' }), false);
    assert.equal(isUnscheduledTask(null), false);
});

test('AwradyAPI: _taskToRow maps legacy OneTime, isArchived, Unscheduled, and numeric totals correctly', () => {
    const legacyArchived = {
        id: 't1',
        name: 'Archived Task',
        category: 'عام',
        target: 1,
        isArchived: true,
        schedule: 'Everyday',
        totalAchieved: 12,
        totalHours: 4.5,
        totalScore: 85
    };
    const rowArchived = awradyAPI._taskToRow(legacyArchived);
    assert.equal(rowArchived.schedule, 'Unscheduled');
    assert.equal(rowArchived.is_archived, false);
    assert.equal(rowArchived.one_time_date, undefined);
    assert.equal(rowArchived.total_achieved, 12);
    assert.equal(rowArchived.total_hours, 4.5);
    assert.equal(rowArchived.total_score, 85);
    assert.equal(rowArchived.totalScore, undefined);

    const legacyOneTime = {
        id: 't2',
        name: 'OneTime Task',
        category: 'عام',
        target: 1,
        isOneTime: true,
        schedule: 'OneTime',
        oneTimeDate: '2026-11-24',
        total_achieved: 3,
        total_hours: 1.5,
        total_score: 100
    };
    const rowOneTime = awradyAPI._taskToRow(legacyOneTime);
    assert.equal(rowOneTime.schedule, 'Unscheduled');
    assert.equal(rowOneTime.is_archived, false);
    assert.equal(rowOneTime.one_time_date, undefined);
    assert.equal(rowOneTime.total_achieved, 3);
    assert.equal(rowOneTime.total_hours, 1.5);
    assert.equal(rowOneTime.total_score, 100);
    assert.equal(rowOneTime.totalScore, undefined);

    const unscheduled = { id: 't3', name: 'Unscheduled Task', category: 'عام', target: 1, schedule: 'Unscheduled' };
    const rowUnscheduled = awradyAPI._taskToRow(unscheduled);
    assert.equal(rowUnscheduled.schedule, 'Unscheduled');
    assert.equal(rowUnscheduled.is_archived, false);
    assert.equal(rowUnscheduled.total_achieved, 0);
    assert.equal(rowUnscheduled.total_hours, 0);
    assert.equal(rowUnscheduled.total_score, 0);
});

test('AnalyticsBreakdown: getTaskStatusKey returns binary scheduled vs unscheduled', () => {
    assert.equal(getTaskStatusKey({ id: 's1', schedule: 'Everyday' }), 'scheduled');
    assert.equal(getTaskStatusKey({ id: 'u1', schedule: 'Unscheduled' }), 'unscheduled');
    assert.equal(getTaskStatusKey({ id: 'u2', schedule: 'OneTime' }), 'unscheduled');
    assert.equal(getTaskStatusKey({ id: 'u3', schedule: 'Everyday', isArchived: true }), 'unscheduled');
});

test('AnalyticsBreakdown: calculateTaskStatsForDates reflects actual active days for unscheduled tasks without 1-day clamping', () => {
    const unscheduledTask = { id: 'u_stats', schedule: 'Unscheduled', target: 2, unit: 'عدد' };
    const prevAppData = globalThis.appData;
    globalThis.appData = {
        tasks: [unscheduledTask],
        logs: {
            '2026-11-20': { taskProgress: { u_stats: { achieved: 2 } } },
            '2026-11-21': { taskProgress: { u_stats: { achieved: 1 } } },
            '2026-11-22': { taskProgress: { u_stats: { achieved: 0 } } }
        }
    };
    try {
        const stats = calculateTaskStatsForDates(unscheduledTask, ['2026-11-20', '2026-11-21', '2026-11-22']);
        assert.equal(stats.scheduledDaysCount, 0);
        assert.equal(stats.activeTimes, 2);
        assert.equal(stats.effectiveTotalDays, 2);
        assert.equal(stats.consistencyPct, 75);

        const emptyStats = calculateTaskStatsForDates(unscheduledTask, ['2026-11-22']);
        assert.equal(emptyStats.activeTimes, 0);
        assert.equal(emptyStats.effectiveTotalDays, 0);
        assert.equal(emptyStats.consistencyPct, 0);
    } finally {
        if (prevAppData === undefined) {
            delete globalThis.appData;
        } else {
            globalThis.appData = prevAppData;
        }
    }
});

test('ScheduleEngine: transitioning task between Scheduled and Unscheduled updates schedule & visibility', () => {
    const task = { id: 'tr1', schedule: 'Everyday', target: 1 };
    const appData = { tasks: [task], logs: {} };
    assert.equal(ScheduleEngine.isTaskScheduledForDate(task, '2026-11-25', appData), true);
    assert.equal(ScheduleEngine.isVisibleOn(task, '2026-11-25', appData), true);

    task.schedule = 'Unscheduled';
    assert.equal(ScheduleEngine.isTaskScheduledForDate(task, '2026-11-25', appData), false);
    assert.equal(ScheduleEngine.isVisibleOn(task, '2026-11-25', appData), false);

    task.schedule = 'Everyday';
    assert.equal(ScheduleEngine.isTaskScheduledForDate(task, '2026-11-25', appData), true);
    assert.equal(ScheduleEngine.isVisibleOn(task, '2026-11-25', appData), true);
});
