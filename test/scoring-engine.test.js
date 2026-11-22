import test from 'node:test';
import assert from 'node:assert/strict';
import { ScoringEngine } from '../js/core/scoring-engine.js';

test('ScoringEngine: getTaskWeightMinutes calculates minutes for time and counter tasks', () => {
    const timeTask = { category: 'استماع', type: 'ساعة', target: 2 };
    assert.equal(ScoringEngine.getTaskWeightMinutes(timeTask), 120);

    const prayerTask = { category: 'صلاة', subcategory: 'فرض', target: 1 };
    assert.equal(ScoringEngine.getTaskWeightMinutes(prayerTask), 20);

    // Large counter (> 30) uses session duration
    const tasbeehTask = { category: 'أذكار وتسبيح', target: 100 };
    assert.equal(ScoringEngine.getTaskWeightMinutes(tasbeehTask), 5);
});

test('ScoringEngine: compute evaluates day score and hours correctly', () => {
    const tasks = [
        { id: 't1', category: 'صلاة', subcategory: 'فرض', schedule: 'Everyday', target: 1 },
        { id: 't2', category: 'استماع', type: 'ساعة', schedule: 'Everyday', target: 1 }
    ];
    // t1 weight = 20m, t2 weight = 60m. Total weight = 80m.
    // If t1 achieved 1 (100% * 20 = 20) and t2 achieved 30m (50% of 60m = 30):
    // reqWeightedScore = 20 + 30 = 50.
    // expected score = 50 / 80 = 0.625 (63%)
    // expected hours = 50 / 60 = 0.833h
    const log = {
        taskProgress: {
            t1: { achieved: 1, target: 1, status: 'scheduled' },
            t2: { achieved: 30, target: 60, status: 'scheduled' }
        }
    };

    const res = ScoringEngine.compute(tasks, log, '2026-11-22');
    assert.equal(Math.round(res.score * 100), 63);
    assert.equal(Math.round(res.hours * 100) / 100, 0.83);
});

test('ScoringEngine: compute is pure and does not mutate log object', () => {
    const tasks = [
        { id: 't1', schedule: 'Everyday', target: 1 }
    ];
    const log = {
        taskProgress: {
            t1: { achieved: 1, target: 1 }
        }
    };

    const logCopyBefore = JSON.stringify(log);
    ScoringEngine.compute(tasks, log, '2026-11-22');
    const logCopyAfter = JSON.stringify(log);

    assert.equal(logCopyAfter, logCopyBefore, 'Input log object must not be mutated by ScoringEngine');
    assert.equal(log.precomputedScore, undefined, 'Must not attach precomputedScore side effect to log');
    assert.equal(log.totalHours, undefined, 'Must not attach totalHours side effect to log');
});

test('ScoringEngine: calculateDayScore returns score or hours based on returnHours parameter', () => {
    const tasks = [
        { id: 't1', schedule: 'Everyday', target: 1 }
    ];
    const appData = {
        tasks,
        logs: {
            '2026-11-22': {
                taskProgress: {
                    t1: { achieved: 1, target: 1 }
                }
            }
        }
    };

    const score = ScoringEngine.calculateDayScore('2026-11-22', appData, false);
    const hours = ScoringEngine.calculateDayScore('2026-11-22', appData, true);

    assert.equal(typeof score, 'number');
    assert.equal(typeof hours, 'number');
    assert.equal(score, 1.0);
    assert.ok(hours > 0);
});
