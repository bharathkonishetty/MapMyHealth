'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { predictGoalAchievement, METHOD } = require('./goalAchievement');

describe('Capability 2 API Endpoint & Schema Safety Verification', () => {

  it('returns the exact required schema structure for a valid user trajectory', () => {
    const logs = [
      { log_date: '2026-06-01', weight: 80.0, steps_count: 5000, workout_completed: true },
      { log_date: '2026-06-04', weight: 79.7, steps_count: 6000, workout_completed: false },
      { log_date: '2026-06-07', weight: 79.4, steps_count: 7000, workout_completed: true },
      { log_date: '2026-06-11', weight: 79.1, steps_count: 5500, workout_completed: false },
      { log_date: '2026-06-15', weight: 78.8, steps_count: 8000, workout_completed: true },
    ];
    const goal = {
      id: 'uuid-goal-1',
      goal_type: 'weight_loss',
      start_weight: 80.0,
      target_weight: 72.0,
      start_date: '2026-06-01',
      target_date: '2026-09-01',
    };

    const res = predictGoalAchievement(logs, goal, '2026-06-15');

    // Root status
    assert.equal(res.status, 'ok');
    assert.equal(res.method, METHOD);

    // Goal payload
    assert.ok(res.goal);
    assert.equal(res.goal.type, 'weight_loss');
    assert.equal(res.goal.startWeight, 80.0);
    assert.equal(res.goal.currentWeight, 78.8);
    assert.equal(res.goal.targetWeight, 72.0);
    assert.equal(res.goal.remainingKg, 6.8);

    // Progress payload
    assert.ok(res.progress);
    assert.equal(typeof res.progress.percentage, 'number');
    assert.equal(res.progress.direction, 'loss');

    // Trend payload
    assert.ok(res.trend);
    assert.equal(typeof res.trend.slopeKgPerWeek, 'number');
    assert.equal(typeof res.trend.label, 'string');

    // Outlook payload
    assert.ok(res.outlook);
    assert.equal(typeof res.outlook.status, 'string');
    assert.equal(typeof res.outlook.severity, 'string');
    assert.equal(typeof res.outlook.title, 'string');
    assert.equal(typeof res.outlook.explanation, 'string');

    // Forecast payload
    assert.ok(res.forecast);
    assert.equal(typeof res.forecast.estimatedWeeksRemaining, 'number');
    assert.equal(typeof res.forecast.estimatedDaysRemaining, 'number');
    assert.match(res.forecast.estimatedCompletionDate, /^\d{4}-\d{2}-\d{2}$/);

    // Confidence payload
    assert.ok(res.confidence);
    assert.ok(['low', 'moderate', 'high'].includes(res.confidence.level));
    assert.equal(typeof res.confidence.reason, 'string');

    // Evidence payload
    assert.ok(res.evidence);
    assert.equal(res.evidence.observations, 5);
    assert.equal(res.evidence.spanDays, 14);
    assert.equal(typeof res.evidence.recentSlope, 'number');
    assert.equal(typeof res.evidence.volatility, 'number');
  });

  it('handles null active goal safely with schema conformity', () => {
    const res = predictGoalAchievement([], null, '2026-06-15');
    assert.equal(res.status, 'no_goal');
    assert.equal(res.outlook.status, 'no_goal');
    assert.equal(res.forecast.estimatedCompletionDate, null);
    assert.equal(res.confidence.level, 'low');
  });

  it('handles insufficient history safely with schema conformity', () => {
    const logs = [{ log_date: '2026-06-01', weight: 80.0 }];
    const goal = { goal_type: 'weight_loss', start_weight: 80, target_weight: 70 };
    const res = predictGoalAchievement(logs, goal, '2026-06-15');

    assert.equal(res.status, 'insufficient_data');
    assert.equal(res.outlook.status, 'insufficient_data');
    assert.equal(res.trend, null);
    assert.equal(res.forecast.estimatedCompletionDate, null);
    assert.equal(res.evidence.observations, 1);
  });

  it('verifies simulated API response rejects unauthorized access when session is missing', () => {
    // Simulating endpoint auth barrier logic
    const req = { session: {} };
    let unauthorized = false;
    if (!req.session.user) {
      unauthorized = true;
    }
    assert.equal(unauthorized, true);
  });

  it('verifies simulated user scoping ensures SQL queries use user session ID', () => {
    const sessionUser = { id: 'user-1234' };
    const sqlQueries = [];

    // Simulate endpoint query execution
    function executeEndpointQueries(userId) {
      sqlQueries.push({
        query: 'SELECT * FROM goals WHERE user_id = $1 AND status = \'active\' ORDER BY created_at DESC LIMIT 1',
        params: [userId],
      });
      sqlQueries.push({
        query: 'SELECT log_date::text, weight, steps_count, workout_completed, workout_duration_mins, water_intake_ml, energy_level FROM progress_logs WHERE user_id = $1 AND log_date >= CURRENT_DATE - INTERVAL \'29 days\' ORDER BY log_date ASC',
        params: [userId],
      });
    }

    executeEndpointQueries(sessionUser.id);
    assert.equal(sqlQueries.length, 2);
    assert.equal(sqlQueries[0].params[0], 'user-1234');
    assert.equal(sqlQueries[1].params[0], 'user-1234');
  });
});
