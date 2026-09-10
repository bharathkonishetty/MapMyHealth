'use strict';

/**
 * Capability 1 — Personalized Progress Prediction Module
 *
 * Robust personal weight trajectory forecasting using Theil-Sen median slopes,
 * outlier rejection, short/long window analysis, and uncertainty bounds.
 */

const DEFAULTS = Object.freeze({
  minLogs: 5,
  minSpanDays: 10,
  maxStaleDays: 7,
  lookbackDays: 30,
  shortWindowDays: 7,
  longWindowDays: 14,
  minEffectiveMadKg: 0.15,
  maxSingleDayJumpKg: 8,
  outlierZ: 3.5,
  maxAbsSlopeKgPerWeek: 1.0,
  uncertaintyFloorKg: 0.25,
  uncertaintyMultiplier: 1.25,
  maxForecastDays: 90,
});

function median(values) {
  const a = values.filter(Number.isFinite).slice().sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function mad(values, med = median(values)) {
  if (med == null) return null;
  return median(values.map((v) => Math.abs(v - med)));
}

function theilSen(points) {
  const slopes = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const days = (points[j].date - points[i].date) / 86400000;
      if (days > 0) slopes.push(((points[j].weight - points[i].weight) / days) * 7);
    }
  }
  return median(slopes);
}

function daysBetween(a, b) {
  return (b - a) / 86400000;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function prepareLogs(rawLogs, now = new Date()) {
  const cutoff = new Date(now.getTime() - DEFAULTS.lookbackDays * 86400000);
  const seen = new Map();
  for (const row of rawLogs || []) {
    const d = new Date(row.log_date);
    const w = Number(row.weight);
    if (!Number.isFinite(w) || w <= 0 || Number.isNaN(d.getTime()) || d < cutoff || d > now) continue;
    const key = d.toISOString().slice(0, 10);
    seen.set(key, {
      date: d,
      weight: w,
      steps: Number(row.steps_count) || 0,
      workoutCompleted: row.workout_completed === true,
      workoutDuration: Number(row.workout_duration_mins) || 0,
      water: Number(row.water_intake_ml) || 0,
      calories: Number(row.calories_consumed) || 0,
      protein: Number(row.protein_consumed_g) || 0,
      energy: Number(row.energy_level) || 0,
    });
  }
  return [...seen.values()].sort((a, b) => a.date - b.date);
}

function detectPointOutliers(points) {
  if (points.length < 4) return points.map(() => false);
  const weights = points.map((p) => p.weight);
  const med = median(weights);
  const m = mad(weights, med);
  const scale = Math.max(DEFAULTS.minEffectiveMadKg, 0.002 * med, m || 0);
  return points.map((p, i) => {
    const robustZ = Math.abs((0.6745 * (p.weight - med)) / scale);
    const jump = i > 0 ? Math.abs(p.weight - points[i - 1].weight) : 0;
    return robustZ >= DEFAULTS.outlierZ || jump >= DEFAULTS.maxSingleDayJumpKg;
  });
}

function summarizeBehavior(points) {
  if (!points.length) return null;
  const recent = points.slice(-Math.min(points.length, 14));
  const steps = recent.map((p) => p.steps).filter((v) => v > 0);
  const workouts = recent.filter((p) => p.workoutCompleted).length;
  return {
    medianSteps: median(steps),
    positiveStepDays: steps.length,
    workoutDays: workouts,
    avgWorkoutMinutes: recent.length
      ? recent.reduce((s, p) => s + p.workoutDuration, 0) / recent.length
      : 0,
  };
}

function predictProgress(rawLogs, goal, now = new Date(), options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const logs = prepareLogs(rawLogs, now);
  const quality = {
    logCount: logs.length,
    spanDays: logs.length > 1 ? Math.round(daysBetween(logs[0].date, logs[logs.length - 1].date)) : 0,
    latestLogDate: logs.length ? logs.at(-1).date.toISOString().slice(0, 10) : null,
    lookbackDays: cfg.lookbackDays,
  };

  if (!goal) return { status: 'insufficient', reason: 'no_active_goal', dataQuality: quality };
  if (logs.length < cfg.minLogs || quality.spanDays < cfg.minSpanDays) {
    return { status: 'insufficient', reason: 'insufficient_history', dataQuality: quality };
  }

  const latest = logs.at(-1);
  const stale = daysBetween(latest.date, now) > cfg.maxStaleDays;
  if (stale) return { status: 'insufficient', reason: 'stale_history', dataQuality: { ...quality, stale: true } };

  const flags = detectPointOutliers(logs);
  const clean = logs.filter((_, i) => !flags[i]);
  if (clean.length < cfg.minLogs || clean.length < 2) {
    return {
      status: 'insufficient',
      reason: 'insufficient_clean_history',
      dataQuality: { ...quality, outliersRemoved: logs.length - clean.length },
    };
  }

  const last7 = clean.filter((p) => daysBetween(p.date, latest.date) <= cfg.shortWindowDays);
  const last14 = clean.filter((p) => daysBetween(p.date, latest.date) <= cfg.longWindowDays);
  const slope7 = last7.length >= 3 ? theilSen(last7) : null;
  const slope14 = last14.length >= 3 ? theilSen(last14) : theilSen(clean);
  const trend = slope14 == null ? 0 : clamp(slope14, -cfg.maxAbsSlopeKgPerWeek, cfg.maxAbsSlopeKgPerWeek);
  const recentWeights = last14.map((p) => p.weight);
  const volatility =
    recentWeights.length > 1
      ? Math.sqrt(
          recentWeights.reduce((s, w) => s + Math.pow(w - median(recentWeights), 2), 0) /
            recentWeights.length
        )
      : 0;
  const target = Number(goal.target_weight);
  const current = latest.weight;
  const direction = goal.goal_type === 'weight_loss' ? -1 : goal.goal_type === 'muscle_gain' ? 1 : 0;
  const goalAligned = direction === 0 ? Math.abs(trend) < 0.15 : trend * direction > 0;
  const projected7 = current + trend;
  const projected14 = current + trend * 2;
  const uncertainty = Math.max(
    cfg.uncertaintyFloorKg,
    volatility * cfg.uncertaintyMultiplier,
    Math.abs((slope7 ?? trend) - (slope14 ?? trend)) * 0.5
  );

  let estimatedDays = null;
  let estimatedDate = null;
  if (direction !== 0 && Number.isFinite(target) && trend * direction > 0) {
    const distance = Math.abs(target - current);
    const rate = Math.abs(trend) / 7;
    if (rate > 0.01) {
      estimatedDays = clamp(Math.ceil(distance / rate), 1, cfg.maxForecastDays);
      const d = new Date(latest.date.getTime() + estimatedDays * 86400000);
      estimatedDate = d.toISOString().slice(0, 10);
    }
  } else if (direction === 0) {
    estimatedDate = 'Stable';
  }

  let status = 'on_track';
  if (direction !== 0 && trend * direction < -0.05) status = 'moving_away';
  else if (Math.abs(trend) < 0.15) status = 'stable';

  const behavior = summarizeBehavior(clean);
  return {
    status,
    currentWeight: current,
    slopeKgPerWeek: trend,
    slope7KgPerWeek: slope7,
    slope14KgPerWeek: slope14,
    projected7d: projected7,
    projected14d: projected14,
    uncertaintyKg: Number(uncertainty.toFixed(2)),
    goalAligned,
    estimatedDays,
    estimatedDate,
    behavior,
    dataQuality: {
      ...quality,
      cleanLogCount: clean.length,
      outliersRemoved: logs.length - clean.length,
      stale: false,
    },
    method: 'robust_personal_trajectory',
  };
}

module.exports = { predictProgress, prepareLogs, theilSen, median, mad, DEFAULTS };
