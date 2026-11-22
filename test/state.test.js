import test from 'node:test';
import assert from 'node:assert/strict';
import { AppState } from '../js/core/state.js';

test('AppState: active date management and subscription', () => {
    let notifiedDate = null;
    const unsubscribe = AppState.onDateChange((d) => {
        notifiedDate = d;
    });

    AppState.setCurrentDate('2026-11-25');
    assert.equal(AppState.getCurrentDate(), '2026-11-25');
    assert.equal(notifiedDate, '2026-11-25');

    unsubscribe();
    AppState.setCurrentDate('2026-11-26');
    assert.equal(notifiedDate, '2026-11-25', 'Unsubscribed listener must not be called');
});

test('AppState: task list management and state change subscription', () => {
    let changeEvent = null;
    const unsubscribe = AppState.onStateChange((type, payload) => {
        changeEvent = { type, payload };
    });

    const tasks = [
        { id: 't1', name: 'قراءة القرآن' },
        { id: 't2', name: 'أذكار الصباح' }
    ];

    AppState.setTasks(tasks);
    assert.equal(AppState.getTasks().length, 2);
    assert.equal(changeEvent?.type, 'tasks');
    assert.equal(changeEvent?.payload.length, 2);

    unsubscribe();
});

test('AppState: dirty task tracking per date', () => {
    AppState.resetState();
    const date = '2026-11-22';

    assert.equal(AppState.isDayDirty(date), false);

    AppState.markTaskDirty(date, 't1');
    assert.equal(AppState.isDayDirty(date), true);

    const log = AppState.getDayLog(date);
    assert.ok(log._dirtyTasks?.t1);

    AppState.clearTaskDirty(date, 't1');
    assert.equal(AppState.isDayDirty(date), false);
});

test('AppState: ensureDayRecord creates log structure with scheduled tasks', () => {
    AppState.resetState([
        { id: 't1', schedule: 'Everyday', target: 5 }
    ]);
    const date = '2026-11-22';
    const log = AppState.ensureDayRecord(date);

    assert.ok(log);
    assert.ok(log.taskProgress);
    assert.ok(log.prayerExtras);
    assert.equal(log.taskProgress.t1?.status, 'scheduled');
});
