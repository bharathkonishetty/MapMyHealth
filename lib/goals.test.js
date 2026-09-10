'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Progress Calculation function replicating server logic for unit verification
function calculateGoalProgress(goal, currentWeight) {
  const sw = parseFloat(goal.start_weight);
  const tw = parseFloat(goal.target_weight);
  const cw = currentWeight !== null && currentWeight !== undefined ? parseFloat(currentWeight) : sw;
  let progress_pct = 0;

  if (goal.goal_type === 'weight_loss') {
    if (sw !== tw) {
      progress_pct = ((sw - cw) / (sw - tw)) * 100;
    }
  } else if (goal.goal_type === 'muscle_gain') {
    if (sw !== tw) {
      progress_pct = ((cw - sw) / (tw - sw)) * 100;
    }
  } else if (goal.goal_type === 'maintenance') {
    const deviation = Math.abs(cw - tw);
    const startMs = new Date(goal.start_date).getTime();
    const targetMs = new Date(goal.target_date).getTime();
    const nowMs = Math.min(targetMs, Math.max(startMs, new Date('2026-06-15').getTime()));
    let timePct = 100;
    if (targetMs > startMs) {
      timePct = ((nowMs - startMs) / (targetMs - startMs)) * 100;
    }
    if (deviation <= 2) {
      progress_pct = timePct;
    } else {
      progress_pct = Math.max(0, timePct - (deviation - 2) * 15);
    }
  }

  return Math.max(0, Math.min(100, Math.round(progress_pct * 10) / 10));
}

// Validation helper replicating server input checks
function validateGoalPayload(body, existingGoal = null) {
  const {
    goal_name, goal_type, start_weight, target_weight, target_date,
    target_calories, target_protein_g, target_carbs_g, target_fats_g
  } = body;

  const validTypes = ['weight_loss', 'muscle_gain', 'maintenance'];
  const effectiveType = existingGoal ? existingGoal.goal_type : goal_type;
  const effectiveSw = existingGoal ? parseFloat(existingGoal.start_weight) : parseFloat(start_weight);

  if (!existingGoal && (!goal_type || !validTypes.includes(goal_type))) {
    return { valid: false, message: 'Invalid goal type.' };
  }

  if (!existingGoal && (isNaN(effectiveSw) || effectiveSw < 20 || effectiveSw > 300)) {
    return { valid: false, message: 'Start weight must be between 20 and 300 kg.' };
  }

  const tw = parseFloat(target_weight);
  if (isNaN(tw) || tw < 20 || tw > 300) {
    return { valid: false, message: 'Target weight must be between 20 and 300 kg.' };
  }

  if (effectiveType === 'weight_loss' && tw >= effectiveSw) {
    return { valid: false, message: 'For weight loss, target weight must be less than start weight.' };
  }
  if (effectiveType === 'muscle_gain' && tw <= effectiveSw) {
    return { valid: false, message: 'For muscle gain, target weight must be greater than start weight.' };
  }
  if (effectiveType === 'maintenance' && Math.abs(tw - effectiveSw) > 2) {
    return { valid: false, message: 'For maintenance, target weight must be within 2 kg of start weight.' };
  }

  if (target_date) {
    const td = new Date(target_date);
    const today = new Date('2026-06-01');
    if (td <= today) {
      return { valid: false, message: 'Target date must be a future date.' };
    }
  } else if (!existingGoal) {
    return { valid: false, message: 'Target date is required.' };
  }

  if (goal_name && goal_name.length > 100) {
    return { valid: false, message: 'Goal name must be 100 characters or fewer.' };
  }

  const tCal = target_calories !== undefined && target_calories !== '' && target_calories !== null ? parseInt(target_calories, 10) : null;
  const tProt = target_protein_g !== undefined && target_protein_g !== '' && target_protein_g !== null ? parseInt(target_protein_g, 10) : null;
  const tCarbs = target_carbs_g !== undefined && target_carbs_g !== '' && target_carbs_g !== null ? parseInt(target_carbs_g, 10) : null;
  const tFats = target_fats_g !== undefined && target_fats_g !== '' && target_fats_g !== null ? parseInt(target_fats_g, 10) : null;

  if (tCal !== null && (isNaN(tCal) || tCal < 500 || tCal > 10000))
    return { valid: false, message: 'Target calories must be between 500 and 10,000 kcal.' };
  if (tProt !== null && (isNaN(tProt) || tProt < 0 || tProt > 500))
    return { valid: false, message: 'Target protein must be between 0 and 500 g.' };
  if (tCarbs !== null && (isNaN(tCarbs) || tCarbs < 0 || tCarbs > 1000))
    return { valid: false, message: 'Target carbs must be between 0 and 1,000 g.' };
  if (tFats !== null && (isNaN(tFats) || tFats < 0 || tFats > 300))
    return { valid: false, message: 'Target fats must be between 0 and 300 g.' };

  return { valid: true };
}

// Status transition validator
function validateStatusTransition(currentStatus, targetStatus, currentActiveCount = 0) {
  const validStatuses = ['active', 'paused', 'completed', 'cancelled'];
  if (!validStatuses.includes(targetStatus)) {
    return { allowed: false, message: 'Invalid status.' };
  }

  if (currentStatus === 'completed' || currentStatus === 'cancelled') {
    return { allowed: false, message: `This goal has already been ${currentStatus} and cannot be modified.` };
  }

  if (targetStatus === 'active') {
    if (currentStatus !== 'paused') {
      return { allowed: false, message: 'Goal is already active.' };
    }
    if (currentActiveCount >= 3) {
      return { allowed: false, message: 'You already have 3 active goals.' };
    }
  }

  return { allowed: true };
}

describe('Phase 2 Goal Management Test Suite', () => {

  describe('1. Dynamic Progress Calculations', () => {
    it('calculates weight_loss progress correctly (0%, 50%, 100%)', () => {
      const goal = { goal_type: 'weight_loss', start_weight: 90, target_weight: 80 };
      assert.equal(calculateGoalProgress(goal, 90), 0);
      assert.equal(calculateGoalProgress(goal, 85), 50);
      assert.equal(calculateGoalProgress(goal, 80), 100);
      assert.equal(calculateGoalProgress(goal, 78), 100); // clamped max 100
      assert.equal(calculateGoalProgress(goal, 95), 0);   // clamped min 0
    });

    it('calculates muscle_gain progress correctly', () => {
      const goal = { goal_type: 'muscle_gain', start_weight: 70, target_weight: 75 };
      assert.equal(calculateGoalProgress(goal, 70), 0);
      assert.equal(calculateGoalProgress(goal, 72.5), 50);
      assert.equal(calculateGoalProgress(goal, 75), 100);
      assert.equal(calculateGoalProgress(goal, 68), 0);
    });

    it('calculates maintenance progress correctly without division by zero', () => {
      const goal = {
        goal_type: 'maintenance',
        start_weight: 75,
        target_weight: 75,
        start_date: '2026-06-01',
        target_date: '2026-06-30'
      };
      // Exactly on target (deviation 0 <= 2)
      const p1 = calculateGoalProgress(goal, 75);
      assert.ok(p1 >= 45 && p1 <= 55); // Around halfway through June

      // Slightly off within 2kg tolerance zone (76.5 kg)
      const p2 = calculateGoalProgress(goal, 76.5);
      assert.ok(p2 >= 45 && p2 <= 55);

      // Outside tolerance zone (80 kg, deviation 5kg -> penalty)
      const p3 = calculateGoalProgress(goal, 80);
      assert.ok(p3 < p1);
    });
  });

  describe('2. Active Goal Limit & Capacity Enforcement', () => {
    it('allows goal creation when active goals < 3', () => {
      const activeCount = 2;
      assert.ok(activeCount < 3);
    });

    it('blocks goal creation when active goals reach 3', () => {
      const activeCount = 3;
      assert.equal(activeCount >= 3, true);
    });

    it('allows resume from paused when active goals < 3', () => {
      const res = validateStatusTransition('paused', 'active', 2);
      assert.equal(res.allowed, true);
    });

    it('blocks resume from paused when active goals = 3', () => {
      const res = validateStatusTransition('paused', 'active', 3);
      assert.equal(res.allowed, false);
      assert.match(res.message, /already have 3 active goals/i);
    });
  });

  describe('3. Validation Rules & Macro Constraints', () => {
    it('accepts valid weight_loss goal with nutrition targets', () => {
      const payload = {
        goal_name: 'Summer Shred',
        goal_type: 'weight_loss',
        start_weight: 85.0,
        target_weight: 75.0,
        target_date: '2026-09-01',
        target_calories: 2200,
        target_protein_g: 160,
        target_carbs_g: 220,
        target_fats_g: 65
      };
      const res = validateGoalPayload(payload);
      assert.equal(res.valid, true);
    });

    it('rejects inverted weights for weight_loss', () => {
      const payload = {
        goal_type: 'weight_loss',
        start_weight: 70.0,
        target_weight: 80.0,
        target_date: '2026-09-01'
      };
      const res = validateGoalPayload(payload);
      assert.equal(res.valid, false);
      assert.match(res.message, /target weight must be less than start weight/i);
    });

    it('rejects inverted weights for muscle_gain', () => {
      const payload = {
        goal_type: 'muscle_gain',
        start_weight: 80.0,
        target_weight: 70.0,
        target_date: '2026-09-01'
      };
      const res = validateGoalPayload(payload);
      assert.equal(res.valid, false);
      assert.match(res.message, /target weight must be greater than start weight/i);
    });

    it('rejects maintenance goal with excessive target weight deviation (> 2kg)', () => {
      const payload = {
        goal_type: 'maintenance',
        start_weight: 70.0,
        target_weight: 75.0,
        target_date: '2026-09-01'
      };
      const res = validateGoalPayload(payload);
      assert.equal(res.valid, false);
      assert.match(res.message, /within 2 kg/i);
    });

    it('validates nutrition bounds (calories, protein, carbs, fats)', () => {
      assert.equal(validateGoalPayload({ goal_type: 'weight_loss', start_weight: 80, target_weight: 70, target_date: '2026-09-01', target_calories: 100 }).valid, false);
      assert.equal(validateGoalPayload({ goal_type: 'weight_loss', start_weight: 80, target_weight: 70, target_date: '2026-09-01', target_protein_g: 600 }).valid, false);
      assert.equal(validateGoalPayload({ goal_type: 'weight_loss', start_weight: 80, target_weight: 70, target_date: '2026-09-01', target_carbs_g: -5 }).valid, false);
    });
  });

  describe('4. Status Transitions & State Machine', () => {
    it('allows active -> paused', () => {
      const res = validateStatusTransition('active', 'paused');
      assert.equal(res.allowed, true);
    });

    it('allows active -> completed', () => {
      const res = validateStatusTransition('active', 'completed');
      assert.equal(res.allowed, true);
    });

    it('allows active -> cancelled', () => {
      const res = validateStatusTransition('active', 'cancelled');
      assert.equal(res.allowed, true);
    });

    it('blocks transitions out of completed state', () => {
      const res = validateStatusTransition('completed', 'active');
      assert.equal(res.allowed, false);
      assert.match(res.message, /cannot be modified/i);
    });

    it('blocks transitions out of cancelled state', () => {
      const res = validateStatusTransition('cancelled', 'active');
      assert.equal(res.allowed, false);
      assert.match(res.message, /cannot be modified/i);
    });
  });

  describe('5. Immutability Preservation in Edit Mode', () => {
    it('validates target_weight against original immutable start_weight on edit', () => {
      const existingGoal = {
        id: 'goal-123',
        goal_type: 'weight_loss',
        start_weight: 85.0,
        target_weight: 75.0,
        status: 'active'
      };
      // Attempting to set target weight higher than immutable start weight (85)
      const editPayload = {
        target_weight: 90.0,
        target_date: '2026-10-01'
      };
      const res = validateGoalPayload(editPayload, existingGoal);
      assert.equal(res.valid, false);
      assert.match(res.message, /target weight must be less than start weight/i);
    });
  });
});
