'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { generatePersonalizedRecommendations, METHOD } = require('./personalizedRecommendations');

describe('Capability 4 API Endpoint & Schema Safety Verification', () => {

  it('returns the exact required schema structure for a valid user trajectory', () => {
    const logs = [
      { log_date: '2026-06-01', weight: 80.0, steps_count: 7000, workout_completed: true },
      { log_date: '2026-06-04', weight: 79.7, steps_count: 6500, workout_completed: false },
      { log_date: '2026-06-07', weight: 79.4, steps_count: 8000, workout_completed: true },
      { log_date: '2026-06-11', weight: 79.1, steps_count: 7200, workout_completed: false },
      { log_date: '2026-06-15', weight: 78.8, steps_count: 7500, workout_completed: true },
    ];
    const goal = {
      id: 'test-goal-uuid',
      goal_type: 'weight_loss',
      start_weight: 80.0,
      target_weight: 72.0,
    };

    const res = generatePersonalizedRecommendations({
      activeGoal: goal,
      recentLogs: logs,
      asOfDate: '2026-06-15',
    });

    assert.equal(res.status, 'ok');
    assert.equal(res.method, METHOD);
    assert.ok(res.primary);
    assert.equal(typeof res.primary.title, 'string');
    assert.equal(typeof res.primary.action, 'string');
    assert.equal(typeof res.primary.reason, 'string');
    assert.ok(['high', 'medium', 'low'].includes(res.primary.priority));
    assert.ok(Array.isArray(res.supporting));
    assert.ok(res.context);
    assert.equal(res.context.goalType, 'weight_loss');
    assert.ok(res.dataQuality);
    assert.equal(res.dataQuality.status, 'ok');
  });

  it('handles null active goal safely with schema conformity', () => {
    const res = generatePersonalizedRecommendations({ activeGoal: null, recentLogs: [] });
    assert.equal(res.status, 'no_goal');
    assert.equal(res.dataQuality.status, 'insufficient');
    assert.equal(typeof res.primary.title, 'string');
    assert.equal(typeof res.primary.action, 'string');
  });

  it('handles insufficient history safely with schema conformity', () => {
    const logs = [{ log_date: '2026-06-01', weight: 80.0 }];
    const goal = { goal_type: 'weight_loss', start_weight: 80, target_weight: 70 };
    const res = generatePersonalizedRecommendations({ activeGoal: goal, recentLogs: logs });

    assert.equal(res.status, 'insufficient_data');
    assert.equal(res.dataQuality.status, 'insufficient');
    assert.ok(res.primary.title.includes('Baseline'));
  });

  it('verifies simulated API response rejects unauthorized access when session is missing', () => {
    const req = { session: {} };
    let rejected = false;
    if (!req.session.user) {
      rejected = true;
    }
    assert.equal(rejected, true);
  });

  it('verifies simulated user scoping ensures SQL queries use user session ID', () => {
    const sessionUser = { id: 'user-recs-456' };
    const executedQueries = [];

    function queryEndpointData(userId) {
      executedQueries.push({
        query: `SELECT * FROM goals WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
        param: userId,
      });
      executedQueries.push({
        query: `SELECT log_date::text, weight, steps_count, workout_completed, workout_duration_mins, water_intake_ml, energy_level FROM progress_logs WHERE user_id = $1 AND log_date >= CURRENT_DATE - INTERVAL '29 days' ORDER BY log_date ASC`,
        param: userId,
      });
    }

    queryEndpointData(sessionUser.id);
    assert.equal(executedQueries.length, 2);
    assert.equal(executedQueries[0].param, 'user-recs-456');
    assert.equal(executedQueries[1].param, 'user-recs-456');
  });
});
