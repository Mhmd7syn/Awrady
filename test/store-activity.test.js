import test from 'node:test';
import assert from 'node:assert/strict';
import { hasDayActivity } from '../js/core/store.js';

test('hasDayActivity: returns false for null or empty log', () => {
    assert.equal(hasDayActivity(null), false);
    assert.equal(hasDayActivity(undefined), false);
    assert.equal(hasDayActivity({}), false);
    assert.equal(hasDayActivity({ taskProgress: {}, prayerExtras: {} }), false);
});

test('hasDayActivity: returns true when log is marked dirty', () => {
    assert.equal(hasDayActivity({ _dirty: true }), true);
    assert.equal(hasDayActivity({ _dirtyTasks: { t1: Date.now() } }), true);
});

test('hasDayActivity: returns true when progress has positive achieved or status flag', () => {
    assert.equal(hasDayActivity({ taskProgress: { t1: { achieved: 1 } } }), true);
    assert.equal(hasDayActivity({ taskProgress: { t1: { achieved: 0 } } }), false);
    assert.equal(hasDayActivity({ taskProgress: { t1: { status: 'disabled' } } }), true);
    assert.equal(hasDayActivity({ taskProgress: { t1: { status: 'bonus' } } }), true);
    assert.equal(hasDayActivity({ taskProgress: { t1: { _explicit: true } } }), true);
});

test('hasDayActivity: returns true when prayerExtras has values', () => {
    assert.equal(hasDayActivity({ prayerExtras: { task_fajr: { nawafel: 2 } } }), true);
    assert.equal(hasDayActivity({ prayerExtras: { task_fajr: { azkar: true } } }), true);
    assert.equal(hasDayActivity({ prayerExtras: { task_fajr: { nawafel: 0, azkar: false } } }), false);
});

test('hasDayActivity: returns true when score or hours exist', () => {
    assert.equal(hasDayActivity({ total_score: 0.75 }), true);
    assert.equal(hasDayActivity({ precomputedScore: 0.5 }), true);
    assert.equal(hasDayActivity({ total_hours: 1.5 }), true);
    assert.equal(hasDayActivity({ totalHours: 2 }), true);
});
