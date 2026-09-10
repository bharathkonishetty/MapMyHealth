'use strict';

/**
 * Capability 4 — Personalized Recommendations Engine
 *
 * Pure intelligence module. No Express, no SQL, no database access, no side effects.
 * Translates multi-capability intelligence (Goal, Trajectory, Goal Achievement, Signals, Behavior)
 * into a focused set of explainable, deterministic, non-medical next actions.
 *
 * Pipeline:
 * USER DATA → CAPABILITY 1 (Trajectory) → CAPABILITY 2 (Achievement) → CAPABILITY 3 (Signals)
 *           → CAPABILITY 4 (Personalized Recommendations) → USER / AI COACH
 */

const { predictProgress } = require('./progressPrediction');
const { predictGoalAchievement } = require('./goalAchievement');
const { analyzeProgressSignals } = require('./progressSignals');

const METHOD = 'multi_signal_personalized_recommendations';

// ─── Behavioral Helpers ────────────────────────────────────────────────────────

function extractBehaviorSummary(recentLogs) {
  if (!recentLogs || !recentLogs.length) {
    return {
      hasData: false,
      validStepDays: 0,
      medianSteps: null,
      workoutDays: 0,
      avgWorkoutMins: 0,
      avgWaterMl: null,
      avgEnergy: null,
    };
  }

  const validSteps = [];
  const validWaters = [];
  const validEnergies = [];
  let workoutDays = 0;
  let totalWorkoutMins = 0;

  for (const log of recentLogs) {
    if (log.steps_count != null && !Number.isNaN(Number(log.steps_count)) && Number(log.steps_count) > 0) {
      validSteps.push(Number(log.steps_count));
    }
    if (log.workout_completed === true) {
      workoutDays++;
      if (log.workout_duration_mins != null && Number(log.workout_duration_mins) > 0) {
        totalWorkoutMins += Number(log.workout_duration_mins);
      }
    }
    if (log.water_intake_ml != null && Number(log.water_intake_ml) > 0) {
      validWaters.push(Number(log.water_intake_ml));
    }
    if (log.energy_level != null && Number(log.energy_level) >= 1 && Number(log.energy_level) <= 5) {
      validEnergies.push(Number(log.energy_level));
    }
  }

  // Median steps
  let medianSteps = null;
  if (validSteps.length > 0) {
    const sorted = [...validSteps].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    medianSteps = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  const avgWaterMl = validWaters.length
    ? Math.round(validWaters.reduce((a, b) => a + b, 0) / validWaters.length)
    : null;

  const avgEnergy = validEnergies.length
    ? Math.round((validEnergies.reduce((a, b) => a + b, 0) / validEnergies.length) * 10) / 10
    : null;

  return {
    hasData: true,
    totalLogs: recentLogs.length,
    validStepDays: validSteps.length,
    medianSteps,
    workoutDays,
    avgWorkoutMins: workoutDays > 0 ? Math.round(totalWorkoutMins / workoutDays) : 0,
    avgWaterMl,
    avgEnergy,
  };
}

// ─── Main Decision Engine ──────────────────────────────────────────────────────

/**
 * Generate personalized, explainable next actions based on unified progress intelligence.
 *
 * @param {Object} context - Multi-signal context
 * @param {Object} [context.activeGoal] - User's active goal
 * @param {Array<Object>} [context.recentLogs] - User's progress check-in logs (last 30 days)
 * @param {Object} [context.progressPrediction] - Capability 1 result (optional, derived if missing)
 * @param {Object} [context.goalAchievement] - Capability 2 result (optional, derived if missing)
 * @param {Object} [context.progressSignals] - Capability 3 result (optional, derived if missing)
 * @param {string|Date} [context.asOfDate] - Reference evaluation date
 * @returns {Object} Structured recommendation result
 */
function generatePersonalizedRecommendations(context = {}) {
  const ctx = context || {};
  const {
    activeGoal = null,
    recentLogs = [],
    asOfDate = null,
  } = ctx;

  // Safe fallback if raw logs is not an array
  const logs = Array.isArray(recentLogs) ? recentLogs : [];
  const behavior = extractBehaviorSummary(logs);

  // 1. Check for Active Goal
  if (!activeGoal || typeof activeGoal !== 'object' || Array.isArray(activeGoal)) {
    return {
      status: 'no_goal',
      method: METHOD,
      primary: {
        title: 'Set Your Active Health Goal',
        action: 'Choose a primary fitness target (weight loss, muscle gain, or maintenance) to activate tailored guidance.',
        reason: 'Personalized recommendations require an active goal to evaluate direction, velocity, and habits.',
        priority: 'high',
        category: 'goal_progress',
      },
      supporting: [
        {
          title: 'Establish Your Starting Baseline',
          action: 'Record your starting weight and target timeframe in the Goals tab.',
          reason: 'A clear starting baseline allows the system to calculate schedule projections and momentum.',
          category: 'consistency',
        },
      ],
      context: {
        goalType: null,
        achievementStatus: 'no_goal',
        progressSignal: 'none',
        predictionStatus: 'no_goal',
        behaviorSummary: behavior,
      },
      dataQuality: {
        status: 'insufficient',
        reason: 'No active goal configured.',
      },
    };
  }

  // Determine effective reference date
  const lastLogDate = logs.length && logs[logs.length - 1].log_date ? logs[logs.length - 1].log_date : null;
  const effectiveAsOf = asOfDate || lastLogDate || new Date();

  // 2. Resolve or compute Sub-capabilities if not pre-supplied
  const cap1 =
    ctx.progressPrediction ||
    predictProgress(logs, activeGoal, typeof effectiveAsOf === 'string' ? new Date(effectiveAsOf + 'T12:00:00Z') : effectiveAsOf);

  const cap2 =
    ctx.goalAchievement ||
    predictGoalAchievement(logs, activeGoal, effectiveAsOf);

  const cap3 =
    ctx.progressSignals ||
    analyzeProgressSignals(logs, activeGoal, effectiveAsOf);

  // Extract signals and statuses safely
  const goalType = activeGoal.goal_type || 'weight_loss';
  const achieveOutlook = cap2 && cap2.outlook ? cap2.outlook.status : (cap2 && cap2.status ? cap2.status : 'insufficient_data');
  const signalPrimary = cap3 && cap3.primary ? cap3.primary : { type: 'none', severity: 'low' };
  const predictionStatus = cap1 ? cap1.status : 'insufficient';

  const baseContext = {
    goalType,
    achievementStatus: achieveOutlook,
    progressSignal: signalPrimary.type,
    predictionStatus,
    behaviorSummary: behavior,
  };

  // 3. Handle Insufficient Data (< 5 logs or < 10 days or invalid logs/goal)
  if (
    logs.length < 5 ||
    achieveOutlook === 'insufficient_data' ||
    achieveOutlook === 'invalid_goal' ||
    !activeGoal.goal_type
  ) {
    const obsCount = cap2 && cap2.evidence ? cap2.evidence.observations : logs.length;
    const spanDays = cap2 && cap2.evidence ? cap2.evidence.spanDays : 0;

    return {
      status: 'insufficient_data',
      method: METHOD,
      primary: {
        title: 'Build Your Check-In Baseline',
        action: 'Log your weight and daily activity regularly over the next few days.',
        reason: `MapMyHealth has recorded ${obsCount} check-in${obsCount === 1 ? '' : 's'} over ${spanDays} day${spanDays === 1 ? '' : 's'}. At least 5 check-ins across 10 calendar days are needed to establish your personal trajectory.`,
        priority: 'high',
        category: 'consistency',
      },
      supporting: [
        {
          title: 'Track Daily Movement & Habits',
          action: 'Log your daily step counts and workout sessions during check-in.',
          reason: 'Logging activity alongside weight helps the engine understand your lifestyle patterns as history grows.',
          category: 'activity',
        },
      ],
      context: baseContext,
      dataQuality: {
        status: 'insufficient',
        reason: 'At least 5 check-ins over 10 calendar days are required for reliable trajectory analysis.',
      },
    };
  }

  // 4. Handle Target Already Achieved
  if (achieveOutlook === 'achieved') {
    return {
      status: 'ok',
      method: METHOD,
      primary: {
        title: 'Celebrate & Transition to Maintenance',
        action: 'Maintain your current lifestyle consistency or transition to a maintenance goal to lock in your results.',
        reason: `You have reached your target weight of ${Number(activeGoal.target_weight).toFixed(1)} kg! Great job staying dedicated.`,
        priority: 'high',
        category: 'goal_progress',
      },
      supporting: [
        {
          title: 'Preserve Daily Routine Stability',
          action: 'Keep checking in 2-3 times per week to ensure weight remains stable within your target range.',
          reason: 'Consistent check-ins help detect unexpected drift before it compounds.',
          category: 'consistency',
        },
      ],
      context: baseContext,
      dataQuality: {
        status: 'ok',
        reason: 'Goal target reached with verified trajectory logs.',
      },
    };
  }

  // ─── 5. Decision Hierarchy ──────────────────────────────────────────────────
  let primary = null;
  const supporting = [];

  // ─── Priority 1: Point Anomaly / Scale Jump ───
  if (signalPrimary.type === 'point_anomaly') {
    primary = {
      title: 'Disregard Short-Term Fluctuation',
      action: 'Continue your normal nutrition and activity plan without making sudden adjustments.',
      reason: 'A recent weight entry differed notably from your baseline trajectory. Daily weight naturally fluctuates due to hydration, sodium, and scale calibration.',
      priority: 'high',
      category: 'consistency',
    };
    supporting.push({
      title: 'Maintain Regular Check-Ins',
      action: 'Weigh in under consistent morning conditions over the next few days.',
      reason: 'Consistent conditions help statistical smoothing filter out isolated measurement noise.',
      category: 'consistency',
    });
  }

  // ─── Priority 1b: Reversal Signal ───
  else if (signalPrimary.type === 'reversal' || achieveOutlook === 'moving_away') {
    if (goalType === 'weight_loss') {
      primary = {
        title: 'Re-align Daily Energy & Activity',
        action: 'Focus on your daily movement baseline and consistent portion awareness for the next 7 days.',
        reason: 'Your recent weight trend has moved upward opposite to your weight-loss target. Re-focusing on small, consistent habits will help re-establish momentum.',
        priority: 'high',
        category: 'goal_progress',
      };
      if (behavior.medianSteps && behavior.medianSteps < 6000) {
        supporting.push({
          title: 'Aim for 7,000+ Daily Steps',
          action: 'Add a 15-minute brisk walk to increase daily non-exercise physical activity.',
          reason: `Your recent median step count (~${Math.round(behavior.medianSteps).toLocaleString()}) leaves room for gentle activity increases.`,
          category: 'activity',
        });
      } else {
        supporting.push({
          title: 'Review Nutrition & Hydration Logging',
          action: 'Log your meals and water intake consistently over the next week.',
          reason: 'Accurate check-in logging reveals subtle habits that may be contributing to recent trajectory shifts.',
          category: 'nutrition',
        });
      }
    } else if (goalType === 'muscle_gain') {
      primary = {
        title: 'Protect Workout & Fueling Consistency',
        action: 'Ensure you are meeting your daily nutrition targets and completing planned strength workouts.',
        reason: 'Your recent weight trend has dropped opposite to your muscle gain goal. Consistent calorie and protein support is necessary to sustain growth.',
        priority: 'high',
        category: 'goal_progress',
      };
      supporting.push({
        title: 'Prioritize Post-Workout Nutrition',
        action: 'Include a quality protein and carbohydrate source after each training session.',
        reason: 'Adequate post-exercise fueling supports muscle recovery and healthy weight accretion.',
        category: 'nutrition',
      });
    } else {
      // Maintenance moving away
      primary = {
        title: 'Steer Back Toward Maintenance Zone',
        action: 'Evaluate recent routine shifts and restore your baseline activity and portion patterns.',
        reason: `Your weight has trended outside your ±${THRESHOLDS_OR_DEFAULT(2.0)} kg maintenance window.`,
        priority: 'high',
        category: 'goal_progress',
      };
    }
  }

  // ─── Priority 3: Behavior Drop Detected ───
  else if (signalPrimary.type === 'behavior_drop') {
    primary = {
      title: 'Restore Normal Activity Habits',
      action: 'Aim to return to your customary daily step count and workout frequency.',
      reason: 'Your recent activity logging is noticeably lower than your established baseline. Regaining your usual pace will support your overall trajectory.',
      priority: 'medium',
      category: 'activity',
    };
    supporting.push({
      title: 'Prioritize Restful Sleep & Hydration',
      action: 'Drink at least 2 liters of water daily and aim for 7-8 hours of sleep.',
      reason: 'Rest and hydration help overcome fatigue and restore natural motivation.',
      category: 'recovery',
    });
  }

  // ─── Priority 4: Slow Progress (Steady advance, gentle pace) ───
  else if (achieveOutlook === 'slow_progress') {
    if (goalType === 'weight_loss') {
      primary = {
        title: 'Sustain Your Gradual Momentum',
        action: 'Keep up your current habits while seeking 1 small consistency enhancement this week.',
        reason: 'You are moving toward your target, but at a gradual velocity (~0.1 kg/week). Slower progress is often more sustainable long-term.',
        priority: 'medium',
        category: 'goal_progress',
      };
      if (behavior.medianSteps && behavior.medianSteps < 8000) {
        supporting.push({
          title: 'Add 1,000 Daily Steps',
          action: 'Take a short 10-minute walk after lunch or dinner.',
          reason: 'A slight bump in daily steps gently increases energy expenditure without added fatigue.',
          category: 'activity',
        });
      } else {
        supporting.push({
          title: 'Keep Logging Daily Check-Ins',
          action: 'Complete your check-in every morning to build an accurate velocity profile.',
          reason: 'Regular data points allow the forecasting engine to provide clearer timeline estimates.',
          category: 'consistency',
        });
      }
    } else {
      primary = {
        title: 'Reinforce Training & Nutrition Consistency',
        action: 'Keep training consistently and ensure adequate rest days between hard sessions.',
        reason: 'Your muscle gain progress is advancing gradually. Consistent training stimulus over time yields steady results.',
        priority: 'medium',
        category: 'goal_progress',
      };
    }
  }

  // ─── Priority 5: Plateau / Stall / At-Risk ───
  else if (signalPrimary.type === 'plateau' || achieveOutlook === 'at_risk') {
    if (goalType === 'weight_loss') {
      primary = {
        title: 'Stay Patient Through the Plateau',
        action: 'Maintain your current routine for another week before considering any adjustments.',
        reason: 'Your weight has leveled off over the past 10-14 days. Temporary stalls are a normal part of physiological adaptation and often resolve with sustained consistency.',
        priority: 'medium',
        category: 'consistency',
      };
      supporting.push({
        title: 'Focus on Non-Scale Victories',
        action: 'Notice how your energy levels, workout strength, and endurance have improved.',
        reason: 'Body recomposition can occur even when the scale shows minimal movement.',
        category: 'recovery',
      });
      if (behavior.workoutDays < 3) {
        supporting.push({
          title: 'Maintain 3+ Weekly Workouts',
          action: 'Schedule 3 structured resistance or cardio sessions this week.',
          reason: 'Regular workouts stimulate metabolic activity during plateau periods.',
          category: 'activity',
        });
      }
    } else if (goalType === 'muscle_gain') {
      primary = {
        title: 'Evaluate Training Progression',
        action: 'Review your exercise weights and ensure you are applying progressive overload in workouts.',
        reason: 'Your muscle gain trajectory has leveled off. Incremental challenge in training prompts renewed adaptation.',
        priority: 'medium',
        category: 'activity',
      };
      supporting.push({
        title: 'Check Daily Protein Intake',
        action: 'Ensure each main meal contains a solid protein source.',
        reason: 'Sustained protein intake provides the building blocks for strength gains.',
        category: 'nutrition',
      });
    } else {
      // Maintenance stall
      primary = {
        title: 'Maintain Current Stability',
        action: 'Keep following your daily routine; your weight is holding stable.',
        reason: 'Holding steady weight is the primary objective of a maintenance goal.',
        priority: 'low',
        category: 'consistency',
      };
    }
  }

  // ─── Priority 4: Behavior Drop Detected ───
  else if (signalPrimary.type === 'behavior_drop') {
    primary = {
      title: 'Restore Normal Activity Habits',
      action: 'Aim to return to your customary daily step count and workout frequency.',
      reason: 'Your recent activity logging is noticeably lower than your established baseline. Regaining your usual pace will support your overall trajectory.',
      priority: 'medium',
      category: 'activity',
    };
    supporting.push({
      title: 'Prioritize Restful Sleep & Hydration',
      action: 'Drink at least 2 liters of water daily and aim for 7-8 hours of sleep.',
      reason: 'Rest and hydration help overcome fatigue and restore natural motivation.',
      category: 'recovery',
    });
  }

  // ─── Priority 5: Slow Progress ───
  else if (achieveOutlook === 'slow_progress') {
    if (goalType === 'weight_loss') {
      primary = {
        title: 'Sustain Your Gradual Momentum',
        action: 'Keep up your current habits while seeking 1 small consistency enhancement this week.',
        reason: 'You are moving toward your target, but at a gradual velocity (~0.1 kg/week). Slower progress is often more sustainable long-term.',
        priority: 'medium',
        category: 'goal_progress',
      };
      if (behavior.medianSteps && behavior.medianSteps < 8000) {
        supporting.push({
          title: 'Add 1,000 Daily Steps',
          action: 'Take a short 10-minute walk after lunch or dinner.',
          reason: 'A slight bump in daily steps gently increases energy expenditure without added fatigue.',
          category: 'activity',
        });
      } else {
        supporting.push({
          title: 'Keep Logging Daily Check-Ins',
          action: 'Complete your check-in every morning to build an accurate velocity profile.',
          reason: 'Regular data points allow the forecasting engine to provide clearer timeline estimates.',
          category: 'consistency',
        });
      }
    } else {
      primary = {
        title: 'Reinforce Training & Nutrition Consistency',
        action: 'Keep training consistently and ensure adequate rest days between hard sessions.',
        reason: 'Your muscle gain progress is advancing gradually. Consistent training stimulus over time yields steady results.',
        priority: 'medium',
        category: 'goal_progress',
      };
    }
  }

  // ─── Priority 6: Maintenance Goal Specifics ───
  else if (goalType === 'maintenance') {
    if (achieveOutlook === 'drifting_up') {
      primary = {
        title: 'Gently Moderate Upward Drift',
        action: 'Be mindful of extra snacks and maintain your regular workout sessions this week.',
        reason: 'Your weight remains near your target zone but shows a gentle upward drift. Small proactive tweaks prevent larger shifts.',
        priority: 'medium',
        category: 'goal_progress',
      };
    } else if (achieveOutlook === 'drifting_down') {
      primary = {
        title: 'Ensure Adequate Daily Fueling',
        action: 'Ensure your daily meals are satisfying and include healthy fats and complex carbs.',
        reason: 'Your weight is drifting slightly below your target zone. Ensure you are eating enough to sustain your activity.',
        priority: 'medium',
        category: 'nutrition',
      };
    } else {
      // Stable in maintenance
      primary = {
        title: 'Maintain Your Balanced Routine',
        action: 'Continue your current balance of physical activity, hydration, and nutrition.',
        reason: 'Your weight is stable within your ±2.0 kg maintenance zone. Your current lifestyle habits are working well.',
        priority: 'low',
        category: 'consistency',
      };
    }
    supporting.push({
      title: 'Keep Up Weekly Check-Ins',
      action: 'Check in at least 2-3 times per week to track ongoing weight equilibrium.',
      reason: 'Routine check-ins provide early visibility into any seasonal or lifestyle shifts.',
      category: 'consistency',
    });
  }

  // ─── Priority 7: On Track (Weight Loss or Muscle Gain) ───
  else {
    // on_track
    if (goalType === 'weight_loss') {
      primary = {
        title: 'Keep Up Your Winning Consistency',
        action: 'Continue your current workout and meal routine without making drastic changes.',
        reason: 'Your recent trend is moving steadily toward your target at a healthy pace. Consistency is your biggest competitive advantage right now.',
        priority: 'low',
        category: 'goal_progress',
      };
      supporting.push({
        title: 'Protect Your Recovery & Sleep',
        action: 'Prioritize 7-8 hours of quality sleep to support muscle recovery and steady energy.',
        reason: 'Restful sleep helps regulate appetite and keeps your workout performance high.',
        category: 'recovery',
      });
      if (behavior.avgWaterMl != null && behavior.avgWaterMl < 2000) {
        supporting.push({
          title: 'Keep Hydration High',
          action: 'Aim for 2.5 liters of water daily to support metabolic processes and energy.',
          reason: 'Optimal hydration supports workout endurance and reduces false fatigue.',
          category: 'hydration',
        });
      }
    } else {
      // muscle_gain on_track
      primary = {
        title: 'Maintain Progressive Strength Workouts',
        action: 'Continue training with good form and fueling your workouts consistently.',
        reason: 'Your weight trend is steadily progressing upward in line with your muscle gain target.',
        priority: 'low',
        category: 'activity',
      };
      supporting.push({
        title: 'Optimize Post-Workout Protein',
        action: 'Consume 25-35g of protein following each resistance training workout.',
        reason: 'Consistent protein distribution maximizes muscle protein synthesis.',
        category: 'nutrition',
      });
    }
  }

  // Limit supporting recommendations to 1-2 items maximum
  const trimmedSupporting = supporting.slice(0, 2);

  return {
    status: 'ok',
    method: METHOD,
    primary,
    supporting: trimmedSupporting,
    context: baseContext,
    dataQuality: {
      status: 'ok',
      reason: 'Personalized recommendations generated from active goal, trajectory forecasting, and progress signals.',
    },
  };
}

function THRESHOLDS_OR_DEFAULT(val) {
  return val.toFixed(1);
}

module.exports = {
  METHOD,
  extractBehaviorSummary,
  generatePersonalizedRecommendations,
};
