import test from 'node:test';
import assert from 'node:assert/strict';
import {
    isTimeTask,
    getTaskUnit,
    isPrayerSelector,
    isObligatoryPrayerTask,
    getPrayerSortIndex,
    getTaskDayTarget,
    getTaskNormalizedTarget,
    isTaskCompleted,
    rowToLog
} from '../js/core/task-rules.js';

test('TaskRules: isTimeTask correctly identifies time-based units', () => {
    assert.equal(isTimeTask({ type: 'ساعة' }), true);
    assert.equal(isTimeTask({ type: 'دقيقة' }), true);
    assert.equal(isTimeTask({ type: 'صفحة' }), false);
    assert.equal(isTimeTask({ category: 'استماع' }), true);
});

test('TaskRules: getTaskUnit resolves unit from task type or category defaults', () => {
    assert.equal(getTaskUnit({ type: 'ركعة' }), 'ركعة');
    assert.equal(getTaskUnit({ category: 'قرآن', subcategory: 'تلاوة' }), 'صفحة');
});

test('TaskRules: isPrayerSelector identifies obligatory prayer tasks', () => {
    assert.equal(isPrayerSelector({ type: 'صلاة' }), true);
    assert.equal(isPrayerSelector({ category: 'صلاة', subcategory: 'فرض' }), true);
    assert.equal(isPrayerSelector({ category: 'صلاة', subcategory: 'نافلة' }), false);
});

test('TaskRules: getPrayerSortIndex preserves canonical chronological order', () => {
    const fajr = { name: 'الفجر', id: 'task_fajr' };
    const dhuhr = { name: 'الظهر', id: 'task_dhuhr' };
    const asr = { name: 'العصر', id: 'task_asr' };
    const maghrib = { name: 'المغرب', id: 'task_maghrib' };
    const isha = { name: 'العشاء', id: 'task_isha' };

    assert.ok(getPrayerSortIndex(fajr) < getPrayerSortIndex(dhuhr));
    assert.ok(getPrayerSortIndex(dhuhr) < getPrayerSortIndex(asr));
    assert.ok(getPrayerSortIndex(asr) < getPrayerSortIndex(maghrib));
    assert.ok(getPrayerSortIndex(maghrib) < getPrayerSortIndex(isha));
});

test('TaskRules: getTaskDayTarget resolves from dailyTargets dictionary', () => {
    const task = {
        schedule: 'Everyday',
        target: 1,
        dailyTargets: { Sat: 3, Sun: 0, Mon: 2 }
    };
    // 2026-11-21 is Sat, 2026-11-22 is Sun
    assert.equal(getTaskDayTarget(task, '2026-11-21'), 3);
    assert.equal(getTaskDayTarget(task, '2026-11-22'), 0);
    assert.equal(getTaskDayTarget(task, 'Mon'), 2);
});

test('TaskRules: getTaskNormalizedTarget converts time units to minutes', () => {
    const timeTask = { type: 'ساعة', target: 1.5 };
    assert.equal(getTaskNormalizedTarget(timeTask), 90);

    const countTask = { type: 'صفحة', target: 10 };
    assert.equal(getTaskNormalizedTarget(countTask), 10);
});

test('TaskRules: isTaskCompleted checks if value meets target', () => {
    const task = { type: 'صفحة', target: 5 };
    assert.equal(isTaskCompleted(task, 4), false);
    assert.equal(isTaskCompleted(task, 5), true);
    assert.equal(isTaskCompleted(task, 6), true);

    const prayerTask = { category: 'صلاة', subcategory: 'فرض', target: 1 };
    assert.equal(isTaskCompleted(prayerTask, 0), false);
    assert.equal(isTaskCompleted(prayerTask, 0.5), true); // partial prayer counts as completed
    assert.equal(isTaskCompleted(prayerTask, 1), true);
});

test('TaskRules: rowToLog safely transforms Supabase progress row into clean log', () => {
    const row = {
        total_score: 0.85,
        total_hours: 2.5,
        updated_at: '2026-11-22T12:00:00Z',
        task_progress: {
            t1: { achieved: 5, target: 5, hours: 0.5, score: 0.2 }
        },
        prayer_extras: {
            task_fajr: { nawafel: 2, azkar: true },
            _meta: { source: 'sync' }
        }
    };

    const log = rowToLog(row);
    assert.equal(log.precomputedScore, 0.85);
    assert.equal(log.totalHours, 2.5);
    assert.equal(log._loadedFromDB, true);
    assert.equal(log.prayerExtras._meta, undefined, '_meta must be stripped');
    assert.equal(log.taskProgress.t1.hours, undefined, 'legacy hours field must be stripped');
    assert.equal(log.taskProgress.t1.score, undefined, 'legacy score field must be stripped');
    assert.equal(log.taskProgress.t1.achieved, 5);
});
