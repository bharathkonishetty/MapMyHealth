'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  generatePersonalizedRecommendations,
  extractBehaviorSummary,
  METHOD,
} = require('./personalizedRecommendations');

describe('Capability 4: Personalized Recommendations Module', () => {

  // Helper to generate mock clean logs
  function makeLogs(startW, deltaPerDay, count, startDate = '2026-06-01', extras = {}) {
    const logs = [];
    const base = new Date(startDate);
    for (let i = 0; i < count; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      logs.push({
        log_date: d.toISOString().slice(0, 10),
        weight: Number((startW + deltaPerDay * i).toFixed(2)),
        steps_count: extras.steps !== undefined ? extras.steps : 6500,
        workout_completed: extras.workouts !== undefined ? extras.workouts : (i % 2 === 0),
        workout_duration_mins: 40,
        water_intake_ml: 2200,
        energy_level: 4,
      });
    }
    return logs;
  }

  // 1. Weight loss + on track
  it('1. recommends maintaining consistency when weight loss is on track', () => {
    const logs = makeLogs(80.0, -0.06, 14); // -0.42 kg/wk
    const goal = { goal_type: 'weight_loss', start_weight: 80, target_weight: 72 };
    const res = generatePersonalizedRecommendations({ activeGoal: goal, recentLogs: logs });

    assert.equal(res.status, 'ok');
    assert.equal(res.method, METHOD);
    assert.ok(res.primary.title.toLowerCase().includes('consistency') || res.primary.title.toLowerCase().includes('winning'));
    assert.equal(res.primary.priority, 'low');
    assert.ok(res.primary.reason.includes('healthy pace') || res.primary.reason.includes('steadily'));
    assert.equal(res.context.achievementStatus, 'on_track');
  });

  // 2. Weight loss + slow progress
  it('2. encourages small manageable enhancements when weight loss progress is slow', () => {
    const logs = makeLogs(80.0, -0.015, 14); // -0.105 kg/wk
    const goal = { goal_type: 'weight_loss', start_weight: 80, target_weight: 72 };
    const res = generatePersonalizedRecommendations({ activeGoal: goal, recentLogs: logs });

    assert.equal(res.status, 'ok');
    assert.equal(res.context.achievementStatus, 'slow_progress');
    assert.equal(res.primary.priority, 'medium');
    assert.ok(res.primary.title.toLowerCase().includes('gradual') || res.primary.title.toLowerCase().includes('momentum'));
  });

  // 3. Weight loss + plateau
  it('3. recommends patience and adherence when a plateau is detected', () => {
    const logs = makeLogs(80.0, 0.0, 14); // Flat line
    const goal = { goal_type: 'weight_loss', start_weight: 85, target_weight: 72 };
    const res = generatePersonalizedRecommendations({ activeGoal: goal, recentLogs: logs });

    assert.equal(res.status, 'ok');
    assert.ok(res.primary.title.toLowerCase().includes('plateau') || res.primary.title.toLowerCase().includes('patient'));
    assert.ok(res.primary.reason.includes('leveled off') || res.primary.reason.includes('plateau'));
  });

  // 4. Weight loss + reversal
  it('4. provides corrective actionable focus when weight loss trend is reversing', () => {
    const logs = makeLogs(75.0, 0.05, 14); // Gaining +0.35 kg/wk
    const goal = { goal_type: 'weight_loss', start_weight: 75, target_weight: 68 };
    const res = generatePersonalizedRecommendations({ activeGoal: goal, recentLogs: logs });

    assert.equal(res.status, 'ok');
    assert.equal(res.primary.priority, 'high');
    assert.ok(res.primary.title.toLowerCase().includes('re-align') || res.primary.title.toLowerCase().includes('activity'));
    assert.ok(res.primary.reason.includes('upward opposite'));
  });

  // 5. Weight loss + behavior drop
  it('5. prioritizes restoring activity baseline when behavior drop is detected', () => {
    // Normal weight, but capability 3 flags behavior drop
    const logs = makeLogs(80.0, -0.04, 14);
    const goal = { goal_type: 'weight_loss', start_weight: 80, target_weight: 72 };
    const cap3Mock = {
      primary: {
        type: 'behavior_drop',
        severity: 'medium',
        title: 'Activity Dip',
        explanation: 'Recent steps dropped by 50%.',
      },
      signals: [],
    };
    const res = generatePersonalizedRecommendations({
      activeGoal: goal,
      recentLogs: logs,
      progressSignals: cap3Mock,
    });

    assert.equal(res.status, 'ok');
    assert.ok(res.primary.title.toLowerCase().includes('restore') || res.primary.title.toLowerCase().includes('activity'));
    assert.ok(res.primary.reason.includes('lower than your established baseline'));
  });

  // 6. Muscle gain + on track
  it('6. reinforces training and progressive overload when muscle gain is on track', () => {
    const logs = makeLogs(65.0, 0.04, 14); // Gaining +0.28 kg/wk
    const goal = { goal_type: 'muscle_gain', start_weight: 65, target_weight: 72 };
    const res = generatePersonalizedRecommendations({ activeGoal: goal, recentLogs: logs });

    assert.equal(res.status, 'ok');
    assert.equal(res.context.achievementStatus, 'on_track');
    assert.ok(res.primary.title.toLowerCase().includes('strength') || res.primary.title.toLowerCase().includes('progressive'));
  });

  // 7. Muscle gain + slow progress
  it('7. reinforces training and recovery when muscle gain progress is slow', () => {
    const logs = makeLogs(65.0, 0.015, 14); // +0.105 kg/wk
    const goal = { goal_type: 'muscle_gain', start_weight: 65, target_weight: 72 };
    const res = generatePersonalizedRecommendations({ activeGoal: goal, recentLogs: logs });

    assert.equal(res.status, 'ok');
    assert.equal(res.context.achievementStatus, 'slow_progress');
    assert.ok(res.primary.title.toLowerCase().includes('training') || res.primary.title.toLowerCase().includes('consistency'));
  });

  // 8. Muscle gain + moving away
  it('8. highlights dropping weight on muscle gain goal and advises fueling consistency', () => {
    const logs = makeLogs(68.0, -0.05, 14); // -0.35 kg/wk
    const goal = { goal_type: 'muscle_gain', start_weight: 68, target_weight: 75 };
    const res = generatePersonalizedRecommendations({ activeGoal: goal, recentLogs: logs });

    assert.equal(res.status, 'ok');
    assert.equal(res.primary.priority, 'high');
    assert.ok(res.primary.title.toLowerCase().includes('fueling') || res.primary.title.toLowerCase().includes('workout'));
    assert.ok(res.primary.reason.includes('dropped opposite to your muscle gain goal'));
  });

  // 9. Maintenance + stable
  it('9. praises routine balance when maintenance weight is stable in zone', () => {
    const logs = [
      { log_date: '2026-06-01', weight: 70.0 },
      { log_date: '2026-06-04', weight: 70.1 },
      { log_date: '2026-06-08', weight: 69.9 },
      { log_date: '2026-06-11', weight: 70.0 },
      { log_date: '2026-06-15', weight: 70.0 },
    ];
    const goal = { goal_type: 'maintenance', start_weight: 70, target_weight: 70 };
    const res = generatePersonalizedRecommendations({ activeGoal: goal, recentLogs: logs });

    assert.equal(res.status, 'ok');
    assert.ok(res.primary.title.toLowerCase().includes('maintain') || res.primary.title.toLowerCase().includes('balanced'));
    assert.equal(res.primary.priority, 'low');
  });

  // 10. Maintenance + drift
  it('10. recommends gentle moderation when weight is drifting upward in maintenance', () => {
    const logs = makeLogs(70.0, 0.04, 14); // Drift +0.28 kg/wk
    const goal = { goal_type: 'maintenance', start_weight: 70, target_weight: 70 };
    const res = generatePersonalizedRecommendations({ activeGoal: goal, recentLogs: logs });

    assert.equal(res.status, 'ok');
    assert.ok(res.primary.title.toLowerCase().includes('drift') || res.primary.title.toLowerCase().includes('moderate'));
  });

  // 11. Achieved goal
  it('11. celebrates and guides transition when target weight is already reached', () => {
    const logs = makeLogs(72.0, -0.05, 12); // Reaches ~71.4
    const goal = { goal_type: 'weight_loss', start_weight: 75, target_weight: 72.0 };
    const res = generatePersonalizedRecommendations({ activeGoal: goal, recentLogs: logs });

    assert.equal(res.status, 'ok');
    assert.ok(res.primary.title.toLowerCase().includes('celebrate') || res.primary.title.toLowerCase().includes('maintenance'));
    assert.ok(res.primary.reason.includes('reached your target weight'));
  });

  // 12. Insufficient weight history (< 5 logs)
  it('12. recommends building baseline data safely when history has < 5 logs', () => {
    const logs = [
      { log_date: '2026-06-01', weight: 80.0 },
      { log_date: '2026-06-05', weight: 79.5 },
    ];
    const goal = { goal_type: 'weight_loss', start_weight: 80, target_weight: 70 };
    const res = generatePersonalizedRecommendations({ activeGoal: goal, recentLogs: logs });

    assert.equal(res.status, 'insufficient_data');
    assert.equal(res.dataQuality.status, 'insufficient');
    assert.ok(res.primary.title.includes('Baseline'));
    assert.ok(res.primary.reason.includes('At least 5 check-ins'));
  });

  // 13. No active goal
  it('13. prompts setting an active goal when activeGoal is null', () => {
    const logs = makeLogs(80.0, -0.05, 10);
    const res = generatePersonalizedRecommendations({ activeGoal: null, recentLogs: logs });

    assert.equal(res.status, 'no_goal');
    assert.equal(res.primary.title, 'Set Your Active Health Goal');
    assert.equal(res.dataQuality.status, 'insufficient');
  });

  // 14. Missing behavioral values
  it('14. handles missing/null behavioral values gracefully without crash or false penalties', () => {
    const logs = [
      { log_date: '2026-06-01', weight: 80.0, steps_count: null, workout_completed: null },
      { log_date: '2026-06-04', weight: 79.8, steps_count: null, workout_completed: null },
      { log_date: '2026-06-08', weight: 79.5, steps_count: null, workout_completed: null },
      { log_date: '2026-06-11', weight: 79.3, steps_count: null, workout_completed: null },
      { log_date: '2026-06-15', weight: 79.0, steps_count: null, workout_completed: null },
    ];
    const goal = { goal_type: 'weight_loss', start_weight: 80, target_weight: 72 };
    const res = generatePersonalizedRecommendations({ activeGoal: goal, recentLogs: logs });

    assert.equal(res.status, 'ok');
    assert.equal(res.context.behaviorSummary.validStepDays, 0);
    assert.equal(res.context.behaviorSummary.workoutDays, 0);
  });

  // 15. Zero / unentered behavioral values
  it('15. correctly distinguishes 0 steps entered vs unentered null steps', () => {
    const logs = [
      { log_date: '2026-06-01', weight: 80.0, steps_count: 0 },
      { log_date: '2026-06-04', weight: 79.8, steps_count: null },
      { log_date: '2026-06-08', weight: 79.5, steps_count: undefined },
    ];
    const summary = extractBehaviorSummary(logs);
    assert.equal(summary.validStepDays, 0); // 0 or null does not count as positive step day
  });

  // 16. High-priority anomaly overrides lower-priority context
  it('16. high-priority point_anomaly overrides lower priority general trend advice', () => {
    const logs = makeLogs(80.0, -0.05, 14);
    const goal = { goal_type: 'weight_loss', start_weight: 80, target_weight: 70 };
    const cap3Mock = {
      primary: {
        type: 'point_anomaly',
        severity: 'high',
        title: 'Unusual Weight Jump',
        explanation: 'Single day jump of 8kg flagged.',
      },
    };
    const res = generatePersonalizedRecommendations({
      activeGoal: goal,
      recentLogs: logs,
      progressSignals: cap3Mock,
    });

    assert.equal(res.status, 'ok');
    assert.ok(res.primary.title.toLowerCase().includes('fluctuation'));
    assert.ok(res.primary.reason.includes('differed notably from your baseline'));
  });

  // 17. Reversal takes precedence appropriately
  it('17. reversal signal takes precedence over plateau or minor behavior notes', () => {
    const logs = makeLogs(75.0, 0.06, 14);
    const goal = { goal_type: 'weight_loss', start_weight: 75, target_weight: 68 };
    const cap3Mock = {
      primary: {
        type: 'reversal',
        severity: 'high',
        title: 'Reversal Flagged',
        explanation: 'Trend has turned upward.',
      },
    };
    const res = generatePersonalizedRecommendations({
      activeGoal: goal,
      recentLogs: logs,
      progressSignals: cap3Mock,
    });

    assert.equal(res.status, 'ok');
    assert.equal(res.primary.priority, 'high');
    assert.ok(res.primary.title.includes('Re-align') || res.primary.title.includes('Activity'));
  });

  // 18. Structured response schema validation
  it('18. validates full schema structure of returned recommendation object', () => {
    const logs = makeLogs(80.0, -0.05, 12);
    const goal = { goal_type: 'weight_loss', start_weight: 80, target_weight: 70 };
    const res = generatePersonalizedRecommendations({ activeGoal: goal, recentLogs: logs });

    assert.equal(res.method, METHOD);
    assert.ok(res.primary);
    assert.equal(typeof res.primary.title, 'string');
    assert.equal(typeof res.primary.action, 'string');
    assert.equal(typeof res.primary.reason, 'string');
    assert.ok(['high', 'medium', 'low'].includes(res.primary.priority));

    assert.ok(Array.isArray(res.supporting));
    assert.ok(res.supporting.length <= 2);
    if (res.supporting.length > 0) {
      assert.equal(typeof res.supporting[0].title, 'string');
      assert.equal(typeof res.supporting[0].action, 'string');
      assert.equal(typeof res.supporting[0].reason, 'string');
    }

    assert.ok(res.context);
    assert.equal(res.context.goalType, 'weight_loss');
    assert.ok(res.dataQuality);
    assert.equal(res.dataQuality.status, 'ok');
  });

  // 19. Deterministic output
  it('19. produces identical recommendations on repeated calls with identical input', () => {
    const logs = makeLogs(80.0, -0.05, 12);
    const goal = { goal_type: 'weight_loss', start_weight: 80, target_weight: 70 };

    const run1 = generatePersonalizedRecommendations({ activeGoal: goal, recentLogs: logs });
    const run2 = generatePersonalizedRecommendations({ activeGoal: goal, recentLogs: logs });

    assert.deepEqual(run1, run2);
  });

  // 20. No shared/global state between user calls
  it('20. has zero shared state between calls for different users and goals', () => {
    const logsA = makeLogs(80.0, -0.05, 12);
    const goalA = { goal_type: 'weight_loss', start_weight: 80, target_weight: 70 };

    const logsB = makeLogs(60.0, 0.05, 12);
    const goalB = { goal_type: 'muscle_gain', start_weight: 60, target_weight: 70 };

    const resA = generatePersonalizedRecommendations({ activeGoal: goalA, recentLogs: logsA });
    const resB = generatePersonalizedRecommendations({ activeGoal: goalB, recentLogs: logsB });

    assert.notEqual(resA.context.goalType, resB.context.goalType);
    assert.notEqual(resA.primary.title, resB.primary.title);
  });

  // 21. Invalid input safety
  it('21. handles invalid and empty input objects safely without throwing', () => {
    const res = generatePersonalizedRecommendations({ activeGoal: {}, recentLogs: 'invalid_type' });
    assert.ok(res);
    assert.equal(res.status, 'insufficient_data');
  });

  // 22. Null input safety
  it('22. handles completely null/undefined arguments safely', () => {
    const res1 = generatePersonalizedRecommendations(null);
    assert.ok(res1);
    assert.equal(res1.status, 'no_goal');

    const res2 = generatePersonalizedRecommendations(undefined);
    assert.ok(res2);
    assert.equal(res2.status, 'no_goal');
  });
});
