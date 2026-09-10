'use strict';

/**
 * Capability 2 — Goal Achievement Prediction Engine
 *
 * Pure functions only. No Express, no SQL, no database access, no side effects.
 * A data-driven goal-achievement prediction engine based on the user's real progress history.
 *
 * NOT a clinically validated medical prediction model.
 * Thresholds are centralized engineering heuristics.
 */

const {
  parseDateOnly,
  toDateString,
  daysBetween,
  median,
  slopeKgPerWeek,
  buildWeightSeries,
} = require('./progressSignals');

const METHOD = 'personalized_trajectory_forecasting';

// ─── Centralized Engineering Thresholds ────────────────────────────────────────
const THRESHOLDS = {
  lookbackDays: 30,

  // Minimum data requirements for trajectory prediction
  minObservations: 5,
  minSpanDays: 10,

  // Velocity thresholds (kg/week) in the direction of the goal
  onTrackMinVelocity: 0.20,       // >= 0.20 kg/wk steady pace toward goal
  slowProgressMinVelocity: 0.05,  // 0.05 to < 0.20 kg/wk moving toward goal
  stallMaxVelocity: 0.05,         // -0.05 to < 0.05 kg/wk considered flat/stalled
  movingAwayMaxVelocity: -0.05,   // <= -0.05 kg/wk moving opposite of goal

  // Maintenance target zone (±kg around target) and drift threshold
  maintenanceZoneKg: 2.0,
  maintenanceMaxDriftSlope: 0.15,

  // Volatility evaluation (MAD / StdDev)
  volatilityLowKg: 0.5,
  volatilityHighKg: 1.2,
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

/** Calculate standard deviation of weights to measure series volatility. */
function calculateVolatility(points) {
  if (!points || points.length < 2) return 0;
  const weights = points.map((p) => p.weight);
  const avg = weights.reduce((sum, w) => sum + w, 0) / weights.length;
  const variance =
    weights.reduce((sum, w) => sum + Math.pow(w - avg, 2), 0) / (weights.length - 1);
  return Math.sqrt(variance);
}

/** Calculate progress percentage clamped safely to [0, 100]. */
function calculateProgressPercentage(goalType, startWeight, currentWeight, targetWeight) {
  if (startWeight == null || targetWeight == null || currentWeight == null) return 0;

  if (goalType === 'weight_loss') {
    const totalToLose = startWeight - targetWeight;
    if (totalToLose <= 0) return currentWeight <= targetWeight ? 100 : 0;
    const lost = startWeight - currentWeight;
    const pct = (lost / totalToLose) * 100;
    return Math.max(0, Math.min(100, Math.round(pct * 10) / 10));
  }

  if (goalType === 'muscle_gain') {
    const totalToGain = targetWeight - startWeight;
    if (totalToGain <= 0) return currentWeight >= targetWeight ? 100 : 0;
    const gained = currentWeight - startWeight;
    const pct = (gained / totalToGain) * 100;
    return Math.max(0, Math.min(100, Math.round(pct * 10) / 10));
  }

  if (goalType === 'maintenance') {
    const deviation = Math.abs(currentWeight - targetWeight);
    if (deviation <= THRESHOLDS.maintenanceZoneKg) {
      // 100% at exact target, smoothly tapering to 90% at the boundary of ±2kg
      const pct = 100 - (deviation / THRESHOLDS.maintenanceZoneKg) * 10;
      return Math.round(pct * 10) / 10;
    }
    // Beyond 2kg deviation, drops by 15% per additional kg
    const penalty = (deviation - THRESHOLDS.maintenanceZoneKg) * 15;
    return Math.max(0, Math.min(100, Math.round((90 - penalty) * 10) / 10));
  }

  return 0;
}

/** Evaluate qualitative confidence level based on observations, span, frequency, and volatility. */
function evaluateConfidence(observationCount, spanDays, volatility, hasClearTrend) {
  let score = 0;

  // Observations count
  if (observationCount >= 12) score += 2;
  else if (observationCount >= 7) score += 1;

  // History span
  if (spanDays >= 21) score += 2;
  else if (spanDays >= 14) score += 1;

  // Logging consistency (average gap between entries)
  const avgGapDays = observationCount > 1 ? spanDays / (observationCount - 1) : 10;
  if (avgGapDays <= 2.5) score += 1;

  // Volatility
  if (volatility <= THRESHOLDS.volatilityLowKg) score += 1;
  else if (volatility > THRESHOLDS.volatilityHighKg) score -= 1;

  // Trend clarity
  if (hasClearTrend) score += 1;

  let level = 'moderate';
  if (score >= 4) level = 'high';
  else if (score < 2) level = 'low';

  const consistencyWord =
    volatility <= THRESHOLDS.volatilityLowKg ? 'steady' : 'variable';
  const reason = `Based on ${observationCount} check-ins over ${spanDays} days with ${consistencyWord} weight readings.`;

  return { level, score, reason };
}

/** Summarize non-causal behavioral context (steps, workouts) from recent history. */
function generateBehavioralContext(series, outlookStatus) {
  if (!series || !series.length) return null;

  const validSteps = series
    .map((p) => p.steps_count)
    .filter((s) => s != null && s > 0);
  const workoutDays = series.filter((p) => p.workout_completed === true).length;
  const medSteps = median(validSteps);

  if (!validSteps.length && workoutDays === 0) return null;

  const parts = [];
  if (workoutDays > 0) {
    parts.push(`${workoutDays} workout session${workoutDays > 1 ? 's' : ''} logged`);
  }
  if (medSteps != null && medSteps > 0) {
    parts.push(`median daily step count of ~${Math.round(medSteps).toLocaleString()}`);
  }

  const detail = parts.join(' and ');
  if (!detail) return null;

  if (outlookStatus === 'on_track') {
    return {
      note: `Your steady progress coincides with recent active habits, including ${detail}.`,
      workoutDays,
      medianSteps: medSteps,
    };
  }
  if (outlookStatus === 'slow_progress' || outlookStatus === 'at_risk') {
    return {
      note: `Recent trajectory coincides with ${detail}. Logging regular activity and nutrition helps maintain momentum toward your goal.`,
      workoutDays,
      medianSteps: medSteps,
    };
  }
  if (outlookStatus === 'moving_away') {
    return {
      note: `Recent weight movement has been accompanied by ${detail}. Evaluating routine consistency may help steer trajectory back to target.`,
      workoutDays,
      medianSteps: medSteps,
    };
  }

  return {
    note: `Recent history includes ${detail}.`,
    workoutDays,
    medianSteps: medSteps,
  };
}

// ─── Main Prediction Engine ───────────────────────────────────────────────────

/**
 * Predict goal achievement outlook and completion timeline based on personal trajectory.
 *
 * @param {Array<Object>} rawLogs - Array of raw progress log records
 * @param {Object} activeGoal - The user's active goal record
 * @param {string|Date} [asOfDate=null] - Date of evaluation (defaults to today)
 * @param {Object} [options={}] - Optional overrides for thresholds
 * @returns {Object} Structured prediction result
 */
function predictGoalAchievement(rawLogs, activeGoal, asOfDate = null, options = {}) {
  const cfg = { ...THRESHOLDS, ...options };

  // 1. Validate active goal
  if (!activeGoal) {
    return {
      status: 'no_goal',
      method: METHOD,
      message: 'No active goal found. Create an active goal to track your achievement outlook.',
      goal: null,
      progress: null,
      trend: null,
      outlook: {
        status: 'no_goal',
        severity: 'low',
        title: 'No Active Goal',
        explanation: 'Create an active goal in the Goals section to activate trajectory predictions.',
      },
      forecast: {
        estimatedWeeksRemaining: null,
        estimatedDaysRemaining: null,
        estimatedCompletionDate: null,
      },
      confidence: {
        level: 'low',
        reason: 'No active goal configured.',
      },
      evidence: null,
      behavioralContext: null,
    };
  }

  const validTypes = ['weight_loss', 'muscle_gain', 'maintenance'];
  const goalType = activeGoal.goal_type;
  const targetWeight = Number(activeGoal.target_weight);

  if (!validTypes.includes(goalType) || !Number.isFinite(targetWeight) || targetWeight <= 0) {
    return {
      status: 'invalid_goal',
      method: METHOD,
      message: 'Active goal has invalid goal type or target weight parameters.',
      goal: null,
      progress: null,
      trend: null,
      outlook: {
        status: 'invalid_goal',
        severity: 'medium',
        title: 'Invalid Goal Parameters',
        explanation: 'Please update your goal with a valid target weight and goal type.',
      },
      forecast: {
        estimatedWeeksRemaining: null,
        estimatedDaysRemaining: null,
        estimatedCompletionDate: null,
      },
      confidence: {
        level: 'low',
        reason: 'Goal parameters are invalid.',
      },
      evidence: null,
      behavioralContext: null,
    };
  }

  // 2. Clean, deduplicate, and sort weight series
  const series = buildWeightSeries(rawLogs, asOfDate, cfg.lookbackDays);
  const observations = series.length;
  const spanDays =
    observations >= 2
      ? Math.abs(daysBetween(series[0].log_date, series[observations - 1].log_date))
      : 0;

  const currentWeight = observations > 0 ? series[observations - 1].weight : null;
  const startWeight =
    activeGoal.start_weight != null && !Number.isNaN(Number(activeGoal.start_weight))
      ? Number(activeGoal.start_weight)
      : currentWeight;

  // Helper to construct goal metadata block
  const buildGoalMeta = (remainingKg) => ({
    type: goalType,
    startWeight,
    currentWeight,
    targetWeight,
    remainingKg: remainingKg != null ? Math.round(remainingKg * 100) / 100 : null,
  });

  // 3. Minimum Data Check
  if (observations < cfg.minObservations || spanDays < cfg.minSpanDays) {
    const missing = [];
    if (observations < cfg.minObservations) {
      missing.push(`${cfg.minObservations - observations} more check-in${cfg.minObservations - observations > 1 ? 's' : ''}`);
    }
    if (spanDays < cfg.minSpanDays) {
      missing.push(`${cfg.minSpanDays - spanDays} more calendar day${cfg.minSpanDays - spanDays > 1 ? 's' : ''} of history`);
    }

    let remainingDistance = null;
    if (currentWeight != null) {
      if (goalType === 'weight_loss') remainingDistance = Math.max(0, currentWeight - targetWeight);
      else if (goalType === 'muscle_gain') remainingDistance = Math.max(0, targetWeight - currentWeight);
      else remainingDistance = Math.abs(currentWeight - targetWeight);
    }

    const progressPct =
      currentWeight != null
        ? calculateProgressPercentage(goalType, startWeight, currentWeight, targetWeight)
        : 0;

    return {
      status: 'insufficient_data',
      method: METHOD,
      message: 'Not enough personal history yet. Keep logging your weight so MapMyHealth can estimate your goal trajectory.',
      goal: buildGoalMeta(remainingDistance),
      progress: {
        percentage: progressPct,
        direction: goalType === 'weight_loss' ? 'loss' : (goalType === 'muscle_gain' ? 'gain' : 'stability'),
      },
      trend: null,
      outlook: {
        status: 'insufficient_data',
        severity: 'low',
        title: 'Insufficient Data',
        explanation: `Not enough personal history yet. Keep logging your weight so MapMyHealth can estimate your goal trajectory. We need at least ${cfg.minObservations} logs over ${cfg.minSpanDays} days (currently ${observations} logs over ${spanDays} days; missing ${missing.join(' and ')}).`,
      },
      forecast: {
        estimatedWeeksRemaining: null,
        estimatedDaysRemaining: null,
        estimatedCompletionDate: null,
      },
      confidence: {
        level: 'low',
        reason: `Requires at least ${cfg.minObservations} check-ins across at least ${cfg.minSpanDays} calendar days.`,
      },
      evidence: {
        observations,
        spanDays,
        recentSlope: null,
        volatility: null,
      },
      behavioralContext: null,
    };
  }

  // 4. Calculate statistical metrics on cleaned series
  const slope = slopeKgPerWeek(series);
  const volatility = calculateVolatility(series);
  const latestLogDate = series[observations - 1].log_date;

  // 5. Evaluate Target Achievement First
  let isAchieved = false;
  if (goalType === 'weight_loss' && currentWeight <= targetWeight) {
    isAchieved = true;
  } else if (goalType === 'muscle_gain' && currentWeight >= targetWeight) {
    isAchieved = true;
  }

  const progressPct = calculateProgressPercentage(goalType, startWeight, currentWeight, targetWeight);

  // ─── A. Target Already Achieved ─────────────────────────────────────────────
  if (isAchieved) {
    const conf = evaluateConfidence(observations, spanDays, volatility, true);
    const trendLabel =
      slope == null
        ? 'Stable'
        : `${slope > 0 ? '+' : ''}${slope.toFixed(2)} kg/week`;

    return {
      status: 'ok',
      method: METHOD,
      goal: buildGoalMeta(0),
      progress: {
        percentage: 100,
        direction: goalType === 'weight_loss' ? 'loss' : 'gain',
      },
      trend: {
        slopeKgPerWeek: slope != null ? Math.round(slope * 100) / 100 : 0,
        label: trendLabel,
      },
      outlook: {
        status: 'achieved',
        severity: 'low',
        title: 'Goal Achieved',
        explanation: `Congratulations! You have reached your target weight of ${targetWeight.toFixed(1)} kg. Focus on consistent lifestyle routines to maintain your achievement.`,
      },
      forecast: {
        estimatedWeeksRemaining: 0,
        estimatedDaysRemaining: 0,
        estimatedCompletionDate: latestLogDate,
      },
      confidence: {
        level: conf.level,
        reason: conf.reason,
      },
      evidence: {
        observations,
        spanDays,
        recentSlope: slope != null ? Math.round(slope * 100) / 100 : 0,
        volatility: Math.round(volatility * 100) / 100,
      },
      behavioralContext: generateBehavioralContext(series, 'on_track'),
    };
  }

  // ─── B. Maintenance Goal Handling ───────────────────────────────────────────
  if (goalType === 'maintenance') {
    const deviation = Math.abs(currentWeight - targetWeight);
    const inZone = deviation <= cfg.maintenanceZoneKg;
    const slopeVal = slope != null ? slope : 0;
    const conf = evaluateConfidence(observations, spanDays, volatility, Math.abs(slopeVal) <= 0.15);

    let outlookStatus = 'stable';
    let severity = 'low';
    let title = 'Stable & In Zone';
    let explanation = `Your weight is currently within your ±${cfg.maintenanceZoneKg.toFixed(1)} kg maintenance zone and trending stably.`;

    if (inZone) {
      if (slopeVal > cfg.maintenanceMaxDriftSlope) {
        outlookStatus = 'drifting_up';
        severity = 'medium';
        title = 'Drifting Upward';
        explanation = `Your weight is within your maintenance zone, but has an upward drift of +${slopeVal.toFixed(2)} kg/week.`;
      } else if (slopeVal < -cfg.maintenanceMaxDriftSlope) {
        outlookStatus = 'drifting_down';
        severity = 'medium';
        title = 'Drifting Downward';
        explanation = `Your weight is within your maintenance zone, but has a downward drift of ${slopeVal.toFixed(2)} kg/week.`;
      }
    } else {
      if (currentWeight > targetWeight + cfg.maintenanceZoneKg) {
        outlookStatus = 'above_zone';
        severity = 'high';
        title = 'Above Maintenance Zone';
        explanation = `Current weight (${currentWeight.toFixed(1)} kg) is ${deviation.toFixed(1)} kg above your maintenance target (${targetWeight.toFixed(1)} kg).`;
      } else {
        outlookStatus = 'below_zone';
        severity = 'high';
        title = 'Below Maintenance Zone';
        explanation = `Current weight (${currentWeight.toFixed(1)} kg) is ${deviation.toFixed(1)} kg below your maintenance target (${targetWeight.toFixed(1)} kg).`;
      }
    }

    const trendLabel =
      Math.abs(slopeVal) <= 0.05
        ? 'Stable (~0.00 kg/week)'
        : `${slopeVal > 0 ? '+' : ''}${slopeVal.toFixed(2)} kg/week`;

    return {
      status: 'ok',
      method: METHOD,
      goal: buildGoalMeta(deviation),
      progress: {
        percentage: progressPct,
        direction: 'stability',
      },
      trend: {
        slopeKgPerWeek: Math.round(slopeVal * 100) / 100,
        label: trendLabel,
      },
      outlook: {
        status: outlookStatus,
        severity,
        title,
        explanation,
      },
      forecast: {
        estimatedWeeksRemaining: null,
        estimatedDaysRemaining: null,
        estimatedCompletionDate: null,
      },
      confidence: {
        level: conf.level,
        reason: conf.reason,
      },
      evidence: {
        observations,
        spanDays,
        recentSlope: Math.round(slopeVal * 100) / 100,
        volatility: Math.round(volatility * 100) / 100,
      },
      behavioralContext: generateBehavioralContext(series, outlookStatus),
    };
  }

  // ─── C. Weight Loss & Muscle Gain Goals ──────────────────────────────────────
  let remainingKg = 0;
  let effectiveVelocity = 0; // Positive when moving toward goal
  let trendLabel = '';

  const slopeVal = slope != null ? slope : 0;

  if (goalType === 'weight_loss') {
    remainingKg = Math.max(0, currentWeight - targetWeight);
    effectiveVelocity = -slopeVal; // weight loss wants negative slope
    trendLabel =
      slopeVal < 0
        ? `Losing ~${Math.abs(slopeVal).toFixed(2)} kg/week`
        : `Gaining ~${Math.abs(slopeVal).toFixed(2)} kg/week`;
  } else {
    // muscle_gain
    remainingKg = Math.max(0, targetWeight - currentWeight);
    effectiveVelocity = slopeVal; // muscle gain wants positive slope
    trendLabel =
      slopeVal > 0
        ? `Gaining ~${Math.abs(slopeVal).toFixed(2)} kg/week`
        : `Losing ~${Math.abs(slopeVal).toFixed(2)} kg/week`;
  }

  let outlookStatus = 'on_track';
  let severity = 'low';
  let title = 'On Track';
  let explanation = '';

  let estimatedWeeksRemaining = null;
  let estimatedDaysRemaining = null;
  let estimatedCompletionDate = null;

  if (effectiveVelocity >= cfg.onTrackMinVelocity) {
    outlookStatus = 'on_track';
    severity = 'low';
    title = 'On Track';
    explanation = `Your recent trend is moving steadily toward your target at about ${Math.abs(slopeVal).toFixed(2)} kg/week.`;

    const weeks = remainingKg / effectiveVelocity;
    const days = Math.round(weeks * 7);
    estimatedWeeksRemaining = Math.round(weeks * 10) / 10;
    estimatedDaysRemaining = days;

    const compDate = parseDateOnly(latestLogDate);
    compDate.setDate(compDate.getDate() + days);
    estimatedCompletionDate = toDateString(compDate);

  } else if (effectiveVelocity >= cfg.slowProgressMinVelocity) {
    outlookStatus = 'slow_progress';
    severity = 'medium';
    title = 'Slow Progress';
    explanation = `Your recent trend is moving toward your target at about ${Math.abs(slopeVal).toFixed(2)} kg/week, which is progress but at a gradual pace.`;

    const weeks = remainingKg / effectiveVelocity;
    const days = Math.round(weeks * 7);
    estimatedWeeksRemaining = Math.round(weeks * 10) / 10;
    estimatedDaysRemaining = days;

    const compDate = parseDateOnly(latestLogDate);
    compDate.setDate(compDate.getDate() + days);
    estimatedCompletionDate = toDateString(compDate);

  } else if (effectiveVelocity > cfg.movingAwayMaxVelocity) {
    // Flat / stall
    outlookStatus = 'at_risk';
    severity = 'medium';
    title = 'At Risk (Stall / Plateau)';
    explanation = `Your weight trajectory is currently flat or stalled (current rate: ${slopeVal > 0 ? '+' : ''}${slopeVal.toFixed(2)} kg/week). Progress toward your target has leveled off.`;
    // Completion date cannot be reliably computed
    estimatedWeeksRemaining = null;
    estimatedDaysRemaining = null;
    estimatedCompletionDate = null;

  } else {
    // Moving away from goal
    outlookStatus = 'moving_away';
    severity = 'high';
    title = 'Moving Away';
    explanation = `Your recent trend is moving away from your goal parameters (current rate: ${slopeVal > 0 ? '+' : ''}${slopeVal.toFixed(2)} kg/week). Check-in consistently and align daily habits to return to path.`;
    // Completion date cannot be computed
    estimatedWeeksRemaining = null;
    estimatedDaysRemaining = null;
    estimatedCompletionDate = null;
  }

  const conf = evaluateConfidence(
    observations,
    spanDays,
    volatility,
    effectiveVelocity >= cfg.slowProgressMinVelocity
  );

  return {
    status: 'ok',
    method: METHOD,
    goal: buildGoalMeta(remainingKg),
    progress: {
      percentage: progressPct,
      direction: goalType === 'weight_loss' ? 'loss' : 'gain',
    },
    trend: {
      slopeKgPerWeek: Math.round(slopeVal * 100) / 100,
      label: trendLabel,
    },
    outlook: {
      status: outlookStatus,
      severity,
      title,
      explanation,
    },
    forecast: {
      estimatedWeeksRemaining,
      estimatedDaysRemaining,
      estimatedCompletionDate,
    },
    confidence: {
      level: conf.level,
      reason: conf.reason,
    },
    evidence: {
      observations,
      spanDays,
      recentSlope: Math.round(slopeVal * 100) / 100,
      volatility: Math.round(volatility * 100) / 100,
    },
    behavioralContext: generateBehavioralContext(series, outlookStatus),
  };
}

module.exports = {
  METHOD,
  THRESHOLDS,
  calculateVolatility,
  calculateProgressPercentage,
  evaluateConfidence,
  generateBehavioralContext,
  predictGoalAchievement,
};
