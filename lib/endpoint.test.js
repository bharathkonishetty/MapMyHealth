'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { analyzeProgressSignals } = require('./progressSignals');

describe('Capability 3 API Integration & Schema Safety Verification', () => {

  it('analyzeProgressSignals returns the exact required schema structure', () => {
    const logs = [
      { log_date: '2026-06-01', weight: 80.0, steps_count: 5000, workout_completed: true },
      { log_date: '2026-06-03', weight: 79.8, steps_count: 6000, workout_completed: false },
      { log_date: '2026-06-06', weight: 79.5, steps_count: 7000, workout_completed: true },
      { log_date: '2026-06-10', weight: 79.2, steps_count: 5500, workout_completed: false },
      { log_date: '2026-06-15', weight: 79.0, steps_count: 8000, workout_completed: true },
    ];
    const goal = { id: 'test-goal-uuid', goal_type: 'weight_loss', target_weight: 72.0 };
    const res = analyzeProgressSignals(logs, goal, '2026-06-15');

    // Validate required fields
    assert.equal(res.method, 'statistical_timeseries');
    assert.ok(res.dataQuality);
    assert.equal(typeof res.dataQuality.n, 'number');
    assert.equal(typeof res.dataQuality.spanDays, 'number');
    assert.equal(res.dataQuality.status, 'ok');

    assert.ok(res.primary);
    assert.equal(typeof res.primary.type, 'string');
    assert.equal(typeof res.primary.severity, 'string');
    assert.equal(typeof res.primary.title, 'string');
    assert.equal(typeof res.primary.explanation, 'string');
    assert.ok(res.primary.evidence);

    assert.ok(Array.isArray(res.signals));
  });

  it('handles null/empty logs gracefully', () => {
    const res = analyzeProgressSignals([], null, '2026-06-15');
    assert.equal(res.method, 'statistical_timeseries');
    assert.equal(res.dataQuality.status, 'insufficient');
    assert.equal(res.primary.type, 'insufficient');
    assert.equal(res.signals.length, 0);
  });
});
