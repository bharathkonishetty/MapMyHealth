'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  METHOD,
  THRESHOLDS,
  PRIMARY_RANK,
  daysBetween,
  slopeKgPerWeek,
  buildWeightSeries,
  analyzeProgressSignals,
  selectPrimarySignal,
} = require('./progressSignals');

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function d(offset, from = '2026-06-01') {
  const [y, m, day] = from.split('-').map(Number);
  const dt = new Date(y, m - 1, day);
  dt.setDate(dt.getDate() + offset);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function weights(pairs, extra = {}) {
  return pairs.map(([offset, weight]) => ({
    log_date: d(offset),
    weight,
    steps_count: 0,
    workout_completed: false,
    ...extra,
  }));
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Capability 3: progressSignals statistical module', () => {

  it('1. exports statistical_timeseries method constant', () => {
    assert.equal(METHOD, 'statistical_timeseries');
    assert.equal(typeof THRESHOLDS.plateauSlope14dKgPerWeek, 'number');
  });

  it('2. uses calendar elapsed days, not measurement count, for slope', () => {
    const points = [
      { log_date: d(0), weight: 80 },
      { log_date: d(10), weight: 79.2 },
      { log_date: d(20), weight: 78.4 },
    ];
    const weekly = slopeKgPerWeek(points);
    const expected = ((78.4 - 80) / 20) * 7;
    assert.ok(Math.abs(weekly - expected) < 0.05, `got ${weekly}, expected ~${expected}`);
    assert.notEqual(daysBetween(d(0), d(20)), 2);
  });

  it('3. insufficient data: too few points (< 4)', () => {
    const logs = weights([[0, 80], [2, 79.8], [4, 79.6]]);
    const out = analyzeProgressSignals(logs, { goal_type: 'weight_loss', target_weight: 75 }, d(4));
    assert.equal(out.method, METHOD);
    assert.equal(out.dataQuality.status, 'insufficient');
    assert.equal(out.primary.type, 'insufficient');
  });

  it('4. insufficient data: insufficient calendar span (< 7 days)', () => {
    const logs = weights([[0, 80], [1, 79.8], [2, 79.6], [3, 79.4]]);
    const out = analyzeProgressSignals(logs, { goal_type: 'weight_loss', target_weight: 75 }, d(3));
    assert.equal(out.dataQuality.status, 'insufficient');
    assert.equal(out.primary.type, 'insufficient');
  });

  it('5. does not classify sparse two-point flat periods as plateaus', () => {
    const logs = weights([[0, 80], [14, 80]]);
    const out = analyzeProgressSignals(logs, { goal_type: 'weight_loss', target_weight: 70 }, d(14));
    assert.notEqual(out.primary.type, 'plateau');
    assert.ok(out.primary.type === 'insufficient' || out.primary.type === 'none');
  });

  it('6. stable identical weights on a loss goal → plateau', () => {
    const logs = [];
    for (let i = 0; i <= 14; i += 1) logs.push({ log_date: d(i), weight: 70.0, steps_count: 0 });
    const out = analyzeProgressSignals(logs, { goal_type: 'weight_loss', target_weight: 65 }, d(14));
    assert.equal(out.dataQuality.status, 'ok');
    assert.equal(out.primary.type, 'plateau');
    assert.match(out.primary.title, /stable/i);
    assert.doesNotMatch(JSON.stringify(out), /Isolation Forest|trained model|AI model|ML model/i);
  });

  it('7. genuine plateau: tiny slope over 14 calendar days', () => {
    const logs = [70.0, 70.05, 69.98, 70.02, 70.01, 69.99, 70.03, 70.0].map((w, i) => ({
      log_date: d(i * 2),
      weight: w,
      steps_count: 0,
    }));
    const out = analyzeProgressSignals(logs, { goal_type: 'weight_loss', target_weight: 64 }, d(14));
    assert.equal(out.primary.type, 'plateau');
  });

  it('8. normal fluctuation around a loss trend is not a plateau', () => {
    const logs = [];
    for (let i = 0; i <= 14; i += 1) {
      const trend = 80 - (0.4 / 7) * i;
      const wobble = (i % 2 === 0 ? 0.15 : -0.15);
      logs.push({ log_date: d(i), weight: Math.round((trend + wobble) * 100) / 100, steps_count: 0 });
    }
    const out = analyzeProgressSignals(logs, { goal_type: 'weight_loss', target_weight: 70 }, d(14));
    assert.notEqual(out.primary.type, 'plateau');
    assert.notEqual(out.primary.type, 'reversal');
    assert.equal(out.primary.type, 'none');
  });

  it('9. progressing weight-loss trend is not a plateau or reversal', () => {
    const logs = [];
    for (let i = 0; i <= 14; i += 1) {
      logs.push({ log_date: d(i), weight: 82 - i * 0.08, steps_count: 0 });
    }
    const out = analyzeProgressSignals(logs, { goal_type: 'weight_loss', target_weight: 75 }, d(14));
    assert.equal(out.primary.type, 'none');
  });

  it('10. progressing weight-gain trend is not a plateau or reversal', () => {
    const logs = [];
    for (let i = 0; i <= 14; i += 1) {
      logs.push({ log_date: d(i), weight: 60 + i * 0.08, steps_count: 0 });
    }
    const out = analyzeProgressSignals(logs, { goal_type: 'muscle_gain', target_weight: 68 }, d(14));
    assert.equal(out.primary.type, 'none');
  });

  it('11. reversal: loss goal with a clear upward trend', () => {
    const logs = [];
    for (let i = 0; i <= 14; i += 1) {
      logs.push({ log_date: d(i), weight: 70 + i * 0.08, steps_count: 0 });
    }
    const out = analyzeProgressSignals(logs, { goal_type: 'weight_loss', target_weight: 65 }, d(14));
    assert.equal(out.primary.type, 'reversal');
  });

  it('12. reversal: muscle_gain goal with a clear downward trend', () => {
    const logs = [];
    for (let i = 0; i <= 14; i += 1) {
      logs.push({ log_date: d(i), weight: 70 - i * 0.08, steps_count: 0 });
    }
    const out = analyzeProgressSignals(logs, { goal_type: 'muscle_gain', target_weight: 80 }, d(14));
    assert.equal(out.primary.type, 'reversal');
  });

  it('13. extreme spike is an unusual weight entry, not claimed incorrect', () => {
    const logs = [];
    for (let i = 0; i <= 12; i += 1) {
      logs.push({ log_date: d(i), weight: 72 - i * 0.05, steps_count: 0 });
    }
    logs.push({ log_date: d(13), weight: 91, steps_count: 0 });
    const out = analyzeProgressSignals(logs, { goal_type: 'weight_loss', target_weight: 68 }, d(13));
    assert.equal(out.primary.type, 'point_anomaly');
    assert.match(out.primary.title, /unusual weight entry/i);
    assert.doesNotMatch(out.primary.explanation.toLowerCase(), /incorrect|error|invalid|wrong/);
  });

  it('14. irregular dates still compute a calendar slope correctly', () => {
    const logs = [
      { log_date: d(0), weight: 80, steps_count: 0 },
      { log_date: d(3), weight: 79.7, steps_count: 0 },
      { log_date: d(11), weight: 79.1, steps_count: 0 },
      { log_date: d(18), weight: 78.6, steps_count: 0 },
      { log_date: d(25), weight: 78.1, steps_count: 0 },
    ];
    const out = analyzeProgressSignals(logs, { goal_type: 'weight_loss', target_weight: 74 }, d(25));
    assert.equal(out.dataQuality.spanDays, 25);
    assert.equal(out.primary.type, 'none');
  });

  it('15. maintenance near target → stable, not plateau', () => {
    const logs = [];
    for (let i = 0; i <= 14; i += 1) {
      logs.push({ log_date: d(i), weight: 70 + (i % 3 === 0 ? 0.1 : -0.05), steps_count: 0 });
    }
    const out = analyzeProgressSignals(logs, { goal_type: 'maintenance', target_weight: 70 }, d(14));
    assert.equal(out.primary.type, 'stable');
    assert.notEqual(out.primary.type, 'plateau');
  });

  it('16. maintenance away from target → drift, not plateau', () => {
    const logs = [];
    for (let i = 0; i <= 14; i += 1) {
      logs.push({ log_date: d(i), weight: 75.5, steps_count: 0 });
    }
    const out = analyzeProgressSignals(logs, { goal_type: 'maintenance', target_weight: 70 }, d(14));
    assert.equal(out.primary.type, 'drift');
    assert.notEqual(out.primary.type, 'plateau');
  });

  it('17. excludes zero/unentered behavioral values from behavior_drop', () => {
    const logs = [];
    for (let i = 0; i <= 14; i += 1) {
      logs.push({
        log_date: d(i),
        weight: 80 - i * 0.08,
        steps_count: 0,
        workout_completed: false,
        water_intake_ml: 0,
      });
    }
    const out = analyzeProgressSignals(logs, { goal_type: 'weight_loss', target_weight: 72 }, d(14));
    assert.equal(out.signals.some((s) => s.type === 'behavior_drop'), false);
    assert.equal(out.primary.type, 'none');
  });

  it('18. behavior_drop only vs that user\'s positive step days', () => {
    const logs = [];
    for (let i = 0; i <= 12; i += 1) {
      logs.push({
        log_date: d(i),
        weight: 80 - i * 0.05,
        steps_count: i === 5 ? 0 : 9000,
        workout_completed: false,
      });
    }
    // Drop on day 13
    logs.push({ log_date: d(13), weight: 79.3, steps_count: 1200, workout_completed: false });
    const out = analyzeProgressSignals(logs, { goal_type: 'weight_loss', target_weight: 72 }, d(13));
    assert.equal(out.primary.type, 'behavior_drop');
  });

  it('19. scale hopping flags unusual entry', () => {
    const logs = [
      { log_date: d(0), weight: 70.0, steps_count: 0 },
      { log_date: d(2), weight: 70.2, steps_count: 0 },
      { log_date: d(4), weight: 70.1, steps_count: 0 },
      { log_date: d(6), weight: 78.4, steps_count: 0 },
      { log_date: d(8), weight: 70.3, steps_count: 0 },
      { log_date: d(10), weight: 78.8, steps_count: 0 },
    ];
    const out = analyzeProgressSignals(logs, { goal_type: 'weight_loss', target_weight: 66 }, d(10));
    assert.equal(out.primary.type, 'point_anomaly');
    assert.equal(out.primary.evidence.scaleHopPattern, true);
  });

  it('20. contaminated series: spike wins over a would-be plateau', () => {
    const logs = [];
    for (let i = 0; i <= 12; i += 1) {
      logs.push({ log_date: d(i), weight: 70.0, steps_count: 0 });
    }
    logs.push({ log_date: d(13), weight: 640, steps_count: 0 });
    const out = analyzeProgressSignals(logs, { goal_type: 'weight_loss', target_weight: 65 }, d(13));
    assert.equal(out.primary.type, 'point_anomaly');
  });

  it('21. primary priority: point_anomaly beats reversal, reversal beats plateau', () => {
    const picked1 = selectPrimarySignal([
      { type: 'behavior_drop' },
      { type: 'plateau' },
      { type: 'reversal' },
      { type: 'point_anomaly' },
    ]);
    assert.equal(picked1.type, 'point_anomaly');

    const picked2 = selectPrimarySignal([
      { type: 'behavior_drop' },
      { type: 'reversal' },
      { type: 'plateau' }
    ]);
    assert.equal(picked2.type, 'reversal');
  });

  it('22. does not pool users: series isolated to supplied logs', () => {
    const a = weights([[0, 90], [3, 89], [6, 88], [9, 87], [12, 86], [15, 85]]);
    const b = [];
    for (let i = 0; i <= 14; i += 1) b.push({ log_date: d(i), weight: 55, steps_count: 0 });
    const outA = analyzeProgressSignals(a, { goal_type: 'weight_loss', target_weight: 80 }, d(15));
    const outB = analyzeProgressSignals(b, { goal_type: 'weight_loss', target_weight: 50 }, d(14));
    assert.equal(outA.primary.type, 'none');
    assert.equal(outB.primary.type, 'plateau');
  });

  it('23. lookback drops old points outside 30 days', () => {
    const logs = [
      { log_date: d(-40), weight: 100, steps_count: 0 },
      ...weights([[0, 80], [5, 79.5], [10, 79], [15, 78.5], [20, 78]]),
    ];
    const series = buildWeightSeries(logs, d(20));
    assert.equal(series.some((p) => p.weight === 100), false);
  });

  it('24. no active goal returns none instead of plateau', () => {
    const logs = [];
    for (let i = 0; i <= 14; i += 1) logs.push({ log_date: d(i), weight: 70.0, steps_count: 0 });
    const out = analyzeProgressSignals(logs, null, d(14));
    assert.equal(out.primary.type, 'none');
  });
});
