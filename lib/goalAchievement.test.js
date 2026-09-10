'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  predictGoalAchievement,
  calculateProgressPercentage,
  evaluateConfidence,
  THRESHOLDS,
  METHOD,
} = require('./goalAchievement');

describe('Capability 2: Goal Achievement Prediction Module', () => {

  // Helper to generate daily or spaced log points
  function generateLogs(startWeight, deltaPerDay, count, startDateStr = '2026-06-01', dayStep = 1, extras = {}) {
    const logs = [];
    const base = new Date(startDateStr);
    for (let i = 0; i < count; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i * dayStep);
      const ds = d.toISOString().slice(0, 10);
      logs.push({
        log_date: ds,
        weight: Number((startWeight + deltaPerDay * (i * dayStep)).toFixed(2)),
        steps_count: extras.steps != null ? extras.steps : 6000,
        workout_completed: extras.workouts != null ? extras.workouts : (i % 2 === 0),
        workout_duration_mins: 45,
        water_intake_ml: 2500,
        energy_level: 4,
      });
    }
    return logs;
  }

  // 1. Weight-loss on-track
  it('1. predicts on_track for healthy weight loss pace (e.g. -0.45 kg/week)', () => {
    // -0.065 kg/day * 7 ~= -0.455 kg/week over 14 days
    const logs = generateLogs(75.0, -0.065, 15, '2026-06-01', 1);
    const goal = {
      goal_type: 'weight_loss',
      start_weight: 75.0,
      target_weight: 68.0,
    };
    const res = predictGoalAchievement(logs, goal, '2026-06-15');

    assert.equal(res.status, 'ok');
    assert.equal(res.method, METHOD);
    assert.equal(res.outlook.status, 'on_track');
    assert.equal(res.outlook.severity, 'low');
    assert.ok(res.trend.slopeKgPerWeek < -0.2);
    assert.ok(res.forecast.estimatedWeeksRemaining > 0);
    assert.ok(res.forecast.estimatedDaysRemaining > 0);
    assert.match(res.forecast.estimatedCompletionDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(res.confidence.level === 'moderate' || res.confidence.level === 'high');
  });

  // 2. Weight-loss slow progress
  it('2. predicts slow_progress when loss rate is positive toward goal but very gentle (< 0.20 and >= 0.05 kg/week)', () => {
    // -0.015 kg/day * 7 ~= -0.105 kg/week
    const logs = generateLogs(75.0, -0.015, 14, '2026-06-01', 1);
    const goal = {
      goal_type: 'weight_loss',
      start_weight: 75.0,
      target_weight: 70.0,
    };
    const res = predictGoalAchievement(logs, goal, '2026-06-14');

    assert.equal(res.status, 'ok');
    assert.equal(res.outlook.status, 'slow_progress');
    assert.equal(res.outlook.severity, 'medium');
    assert.ok(res.forecast.estimatedWeeksRemaining > 0);
    assert.ok(res.forecast.estimatedCompletionDate != null);
  });

  // 3. Weight-loss moving away
  it('3. predicts moving_away when weight is trending upward on a weight loss goal', () => {
    // +0.05 kg/day * 7 = +0.35 kg/week
    const logs = generateLogs(75.0, 0.05, 14, '2026-06-01', 1);
    const goal = {
      goal_type: 'weight_loss',
      start_weight: 75.0,
      target_weight: 68.0,
    };
    const res = predictGoalAchievement(logs, goal, '2026-06-14');

    assert.equal(res.status, 'ok');
    assert.equal(res.outlook.status, 'moving_away');
    assert.equal(res.outlook.severity, 'high');
    // Does NOT manufacture a misleading completion date
    assert.equal(res.forecast.estimatedWeeksRemaining, null);
    assert.equal(res.forecast.estimatedCompletionDate, null);
  });

  // 4. Weight-loss achieved
  it('4. identifies achieved when current weight has reached or surpassed target weight', () => {
    const logs = generateLogs(72.0, -0.05, 14, '2026-06-01', 1);
    // last log weight will be 72.0 - 13*0.05 = 71.35
    const goal = {
      goal_type: 'weight_loss',
      start_weight: 75.0,
      target_weight: 71.5,
    };
    const res = predictGoalAchievement(logs, goal, '2026-06-14');

    assert.equal(res.status, 'ok');
    assert.equal(res.outlook.status, 'achieved');
    assert.equal(res.goal.remainingKg, 0);
    assert.equal(res.progress.percentage, 100);
    assert.equal(res.forecast.estimatedWeeksRemaining, 0);
    assert.equal(res.forecast.estimatedDaysRemaining, 0);
  });

  // 5. Muscle-gain on-track
  it('5. predicts on_track for muscle gain when weight is trending upward at >= 0.20 kg/week', () => {
    // +0.04 kg/day * 7 = +0.28 kg/week
    const logs = generateLogs(65.0, 0.04, 15, '2026-06-01', 1);
    const goal = {
      goal_type: 'muscle_gain',
      start_weight: 65.0,
      target_weight: 72.0,
    };
    const res = predictGoalAchievement(logs, goal, '2026-06-15');

    assert.equal(res.status, 'ok');
    assert.equal(res.outlook.status, 'on_track');
    assert.ok(res.trend.slopeKgPerWeek > 0.2);
    assert.ok(res.forecast.estimatedWeeksRemaining > 0);
    assert.match(res.forecast.estimatedCompletionDate, /^\d{4}-\d{2}-\d{2}$/);
  });

  // 6. Muscle-gain moving away
  it('6. predicts moving_away for muscle gain when weight is dropping', () => {
    // -0.05 kg/day * 7 = -0.35 kg/week
    const logs = generateLogs(68.0, -0.05, 15, '2026-06-01', 1);
    const goal = {
      goal_type: 'muscle_gain',
      start_weight: 68.0,
      target_weight: 75.0,
    };
    const res = predictGoalAchievement(logs, goal, '2026-06-15');

    assert.equal(res.status, 'ok');
    assert.equal(res.outlook.status, 'moving_away');
    assert.equal(res.forecast.estimatedCompletionDate, null);
  });

  // 7. Maintenance stable
  it('7. classifies stable within maintenance zone (±2 kg) with slope |m| <= 0.15 kg/week', () => {
    // weight stays around 70.0 kg
    const logs = [
      { log_date: '2026-06-01', weight: 70.1 },
      { log_date: '2026-06-04', weight: 70.0 },
      { log_date: '2026-06-07', weight: 69.9 },
      { log_date: '2026-06-11', weight: 70.0 },
      { log_date: '2026-06-15', weight: 70.1 },
    ];
    const goal = {
      goal_type: 'maintenance',
      start_weight: 70.0,
      target_weight: 70.0,
    };
    const res = predictGoalAchievement(logs, goal, '2026-06-15');

    assert.equal(res.status, 'ok');
    assert.equal(res.outlook.status, 'stable');
    assert.equal(res.forecast.estimatedCompletionDate, null); // Maintenance has no end date
    assert.ok(res.progress.percentage >= 90);
  });

  // 8. Maintenance drifting
  it('8. classifies drifting_up or drifting_down when weight is drifting while in maintenance', () => {
    // Drift up by +0.3 kg/week: from 70.0 to 70.6 over 14 days
    const logs = generateLogs(70.0, 0.045, 14, '2026-06-01', 1);
    const goal = {
      goal_type: 'maintenance',
      start_weight: 70.0,
      target_weight: 70.0,
    };
    const res = predictGoalAchievement(logs, goal, '2026-06-14');

    assert.equal(res.status, 'ok');
    assert.equal(res.outlook.status, 'drifting_up');
    assert.equal(res.forecast.estimatedCompletionDate, null);
  });

  // 9. Insufficient observations (< 5)
  it('9. returns insufficient_data safely when observations count is < 5', () => {
    const logs = [
      { log_date: '2026-06-01', weight: 80.0 },
      { log_date: '2026-06-05', weight: 79.5 },
      { log_date: '2026-06-10', weight: 79.0 },
      { log_date: '2026-06-15', weight: 78.5 },
    ];
    const goal = {
      goal_type: 'weight_loss',
      start_weight: 80.0,
      target_weight: 72.0,
    };
    const res = predictGoalAchievement(logs, goal, '2026-06-15');

    assert.equal(res.status, 'insufficient_data');
    assert.ok(res.message.includes('Not enough personal history yet'));
    assert.equal(res.trend, null);
    assert.equal(res.forecast.estimatedCompletionDate, null);
    assert.equal(res.evidence.observations, 4);
  });

  // 10. Insufficient calendar span (< 10 days)
  it('10. returns insufficient_data safely when calendar span is < 10 days despite 5 logs', () => {
    const logs = [
      { log_date: '2026-06-01', weight: 80.0 },
      { log_date: '2026-06-02', weight: 79.8 },
      { log_date: '2026-06-03', weight: 79.6 },
      { log_date: '2026-06-04', weight: 79.5 },
      { log_date: '2026-06-05', weight: 79.3 },
    ];
    const goal = {
      goal_type: 'weight_loss',
      start_weight: 80.0,
      target_weight: 72.0,
    };
    const res = predictGoalAchievement(logs, goal, '2026-06-05');

    assert.equal(res.status, 'insufficient_data');
    assert.equal(res.evidence.spanDays, 4);
    assert.equal(res.forecast.estimatedCompletionDate, null);
  });

  // 11. Irregular dates
  it('11. handles irregular logging dates correctly using calendar elapsed days', () => {
    const logs = [
      { log_date: '2026-06-01', weight: 80.0 },
      { log_date: '2026-06-03', weight: 79.8 },
      { log_date: '2026-06-08', weight: 79.3 },
      { log_date: '2026-06-14', weight: 78.8 },
      { log_date: '2026-06-21', weight: 78.2 },
    ];
    const goal = {
      goal_type: 'weight_loss',
      start_weight: 80.0,
      target_weight: 70.0,
    };
    const res = predictGoalAchievement(logs, goal, '2026-06-21');

    assert.equal(res.status, 'ok');
    assert.equal(res.evidence.observations, 5);
    assert.equal(res.evidence.spanDays, 20);
    assert.ok(res.trend.slopeKgPerWeek < 0);
    assert.equal(res.outlook.status, 'on_track');
  });

  // 12. Flat trend
  it('12. detects flat trend / plateau as at_risk when slope is virtually zero on a loss goal', () => {
    const logs = [
      { log_date: '2026-06-01', weight: 75.0 },
      { log_date: '2026-06-04', weight: 75.0 },
      { log_date: '2026-06-08', weight: 75.0 },
      { log_date: '2026-06-12', weight: 75.0 },
      { log_date: '2026-06-16', weight: 75.0 },
    ];
    const goal = {
      goal_type: 'weight_loss',
      start_weight: 78.0,
      target_weight: 68.0,
    };
    const res = predictGoalAchievement(logs, goal, '2026-06-16');

    assert.equal(res.status, 'ok');
    assert.equal(res.outlook.status, 'at_risk');
    assert.equal(res.forecast.estimatedCompletionDate, null);
  });

  // 13. Zero / near-zero slope
  it('13. does not divide by zero or create Infinity dates on near-zero slope', () => {
    const logs = [
      { log_date: '2026-06-01', weight: 80.0 },
      { log_date: '2026-06-04', weight: 80.01 },
      { log_date: '2026-06-08', weight: 79.99 },
      { log_date: '2026-06-12', weight: 80.0 },
      { log_date: '2026-06-15', weight: 80.0 },
    ];
    const goal = {
      goal_type: 'weight_loss',
      start_weight: 85.0,
      target_weight: 75.0,
    };
    const res = predictGoalAchievement(logs, goal, '2026-06-15');

    assert.equal(res.status, 'ok');
    assert.equal(res.outlook.status, 'at_risk');
    assert.equal(res.forecast.estimatedWeeksRemaining, null);
    assert.equal(res.forecast.estimatedCompletionDate, null);
  });

  // 14. Target already reached
  it('14. handles target already reached cleanly with 100% progress', () => {
    const logs = generateLogs(68.0, -0.05, 12, '2026-06-01', 1);
    const goal = {
      goal_type: 'weight_loss',
      start_weight: 70.0,
      target_weight: 68.5, // start was 70, target was 68.5, latest is ~67.45
    };
    const res = predictGoalAchievement(logs, goal, '2026-06-12');

    assert.equal(res.status, 'ok');
    assert.equal(res.outlook.status, 'achieved');
    assert.equal(res.progress.percentage, 100);
    assert.equal(res.forecast.estimatedWeeksRemaining, 0);
  });

  // 15. Invalid goal parameters
  it('15. handles invalid goal parameters safely without throwing', () => {
    const logs = generateLogs(70.0, -0.05, 10, '2026-06-01', 1);
    const invalidGoal = {
      goal_type: 'flying_goal',
      target_weight: null,
    };
    const res = predictGoalAchievement(logs, invalidGoal, '2026-06-10');

    assert.equal(res.status, 'invalid_goal');
    assert.equal(res.forecast.estimatedCompletionDate, null);
  });

  // 16. No active goal
  it('16. handles null/undefined goal safely without throwing', () => {
    const logs = generateLogs(70.0, -0.05, 10, '2026-06-01', 1);
    const res = predictGoalAchievement(logs, null, '2026-06-10');

    assert.equal(res.status, 'no_goal');
    assert.equal(res.forecast.estimatedCompletionDate, null);
  });

  // 17. User data isolation
  it('17. operates strictly on supplied logs and active goal with zero shared state', () => {
    const userALogs = generateLogs(80.0, -0.05, 12, '2026-06-01', 1);
    const userBLogs = generateLogs(60.0, 0.05, 12, '2026-06-01', 1);

    const goalA = { goal_type: 'weight_loss', start_weight: 80, target_weight: 70 };
    const goalB = { goal_type: 'muscle_gain', start_weight: 60, target_weight: 68 };

    const resA = predictGoalAchievement(userALogs, goalA, '2026-06-12');
    const resB = predictGoalAchievement(userBLogs, goalB, '2026-06-12');

    assert.equal(resA.goal.type, 'weight_loss');
    assert.equal(resB.goal.type, 'muscle_gain');
    assert.ok(resA.goal.currentWeight > 75);
    assert.ok(resB.goal.currentWeight < 65);
    assert.notEqual(resA.trend.slopeKgPerWeek, resB.trend.slopeKgPerWeek);
  });

  // 18. Completion-date calculation & calendar addition
  it('18. accurately calculates calendar completion date: latestDate + daysRemaining', () => {
    // 70 kg, losing exactly 0.5 kg/week (-0.071428 kg/day)
    // Target: 65 kg (5 kg remaining)
    // 5 kg / 0.5 kg/wk = 10 weeks = 70 calendar days
    // latestLogDate = '2026-06-15' -> +70 days -> '2026-08-24'
    const logs = [
      { log_date: '2026-06-01', weight: 71.0 },
      { log_date: '2026-06-04', weight: 70.786 },
      { log_date: '2026-06-08', weight: 70.5 },
      { log_date: '2026-06-11', weight: 70.286 },
      { log_date: '2026-06-15', weight: 70.0 },
    ];
    const goal = {
      goal_type: 'weight_loss',
      start_weight: 75.0,
      target_weight: 65.0,
    };
    const res = predictGoalAchievement(logs, goal, '2026-06-15');

    assert.equal(res.status, 'ok');
    assert.equal(res.goal.remainingKg, 5.0);
    assert.ok(res.forecast.estimatedWeeksRemaining >= 9.5 && res.forecast.estimatedWeeksRemaining <= 10.5);
    assert.ok(res.forecast.estimatedDaysRemaining >= 67 && res.forecast.estimatedDaysRemaining <= 73);
    assert.match(res.forecast.estimatedCompletionDate, /^2026-08-\d{2}$/);
  });

  // 19. Uncertainty & Confidence evaluation
  it('19. calculates qualitative confidence level (low, moderate, high) with clear reason string', () => {
    // High confidence: 20 logs over 25 days with low volatility
    const logsHigh = generateLogs(80.0, -0.04, 20, '2026-05-20', 1);
    const goal = { goal_type: 'weight_loss', start_weight: 80, target_weight: 72 };
    const resHigh = predictGoalAchievement(logsHigh, goal, '2026-06-08');

    assert.equal(resHigh.confidence.level, 'high');
    assert.ok(resHigh.confidence.reason.length > 10);
    assert.ok(typeof resHigh.confidence.reason === 'string');

    // Moderate confidence: 6 logs over 12 days
    const logsMod = generateLogs(80.0, -0.04, 6, '2026-06-01', 2);
    const resMod = predictGoalAchievement(logsMod, goal, '2026-06-11');
    assert.ok(['moderate', 'low'].includes(resMod.confidence.level));
  });

  // 20. Outlier robustness
  it('20. Theil-Sen slope remains robust when a single outlier spike is present', () => {
    // 7 clean points losing weight steadily, with 1 middle spike due to scale error
    const logs = [
      { log_date: '2026-06-01', weight: 80.0 },
      { log_date: '2026-06-03', weight: 79.8 },
      { log_date: '2026-06-06', weight: 79.5 },
      { log_date: '2026-06-09', weight: 88.0 }, // Outlier spike (+8.5kg typo)
      { log_date: '2026-06-12', weight: 79.0 },
      { log_date: '2026-06-15', weight: 78.8 },
      { log_date: '2026-06-18', weight: 78.5 },
    ];
    const goal = { goal_type: 'weight_loss', start_weight: 82.0, target_weight: 72.0 };
    const res = predictGoalAchievement(logs, goal, '2026-06-18');

    assert.equal(res.status, 'ok');
    // Theil-Sen median slope resists the spike and still detects downward trend!
    assert.ok(res.trend.slopeKgPerWeek < 0);
    assert.equal(res.outlook.status, 'on_track');
  });

  // Behavioral context check
  it('21. incorporates supportive non-causal behavioral context when steps and workouts exist', () => {
    const logs = generateLogs(75.0, -0.05, 12, '2026-06-01', 1, { steps: 8500, workouts: true });
    const goal = { goal_type: 'weight_loss', start_weight: 78.0, target_weight: 68.0 };
    const res = predictGoalAchievement(logs, goal, '2026-06-12');

    assert.ok(res.behavioralContext);
    assert.ok(res.behavioralContext.note.includes('coincides with'));
    assert.ok(res.behavioralContext.note.includes('workout'));
  });
});
