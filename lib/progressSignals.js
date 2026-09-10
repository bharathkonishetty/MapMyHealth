'use strict';

/**
 * Per-user statistical time-series signals (plateau, reversal, unusual entries).
 * NOT a trained model. Thresholds are v1 engineering hypotheses — not medical truths.
 *
 * Pure functions only. No Express, no SQL, no side effects.
 */

const METHOD = 'statistical_timeseries';

// ─── Centralized v1 Thresholds ────────────────────────────────────────────────
const THRESHOLDS = {
  lookbackDays: 30,

  // Burn-in: minimum data required for any progress signal
  minObservations: 4,
  minSpanDays: 7,

  // Plateau-specific burn-in (stricter than initial burn-in)
  plateauMinObservations: 5,
  plateauMinSpanDays: 10,

  // Trend evaluation windows
  window14Days: 14,
  window7Days: 7,
  lastPointsForRange: 4,

  // Plateau slope and range thresholds (kg/week)
  plateauSlope14dKgPerWeek: 0.15,
  plateauSlope7dKgPerWeek: 0.20,
  plateauRangeKg: 0.4,

  // Reversal threshold (kg/week moving away from goal)
  reversalSlopeKgPerWeek: 0.15,

  // Point anomaly thresholds
  robustZPointAnomaly: 3.5,
  extremeAbsJumpKg: 8,
  hopAbsDeltaKg: 2.5,

  // MAD scale floor (prevents division by zero when logs are identical)
  madFloorKg: 0.15,
  madFloorFrac: 0.002,

  // Maintenance target zone (±kg)
  maintenanceZoneKg: 2,

  // Behavioral break thresholds (steps)
  minPositiveBehaviorPoints: 4,
  behaviorDropFraction: 0.4,
  behaviorDropMinMedianSteps: 3000,
};

// Primary signal ranking — lower index has higher precedence
const PRIMARY_RANK = {
  point_anomaly: 0,
  reversal: 1,
  plateau: 2,
  drift: 2,
  stable: 2,
  behavior_drop: 3,
  none: 4,
  insufficient: 5,
};

// ─── Date Utilities ───────────────────────────────────────────────────────────

/** Parse a date string (or Date object) to a local-midnight Date using yyyy-mm-dd only. */
function parseDateOnly(value) {
  const s = String(value).slice(0, 10);
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Format a Date to yyyy-mm-dd string. */
function toDateString(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Elapsed calendar days between two date strings (b - a). */
function daysBetween(a, b) {
  const t1 = parseDateOnly(a).getTime();
  const t2 = parseDateOnly(b).getTime();
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

// ─── Robust Statistical Calculations ──────────────────────────────────────────

function median(nums) {
  if (!nums || !nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function mad(nums, med) {
  if (!nums || !nums.length || med == null) return 0;
  return median(nums.map((n) => Math.abs(n - med))) || 0;
}

/** MAD with a sensible floor to avoid infinite/huge z-scores when all weights are identical. */
function effectiveMad(weights, med) {
  const raw = mad(weights, med);
  const floor = Math.max(THRESHOLDS.madFloorKg, THRESHOLDS.madFloorFrac * Math.abs(med || 0));
  return Math.max(raw, floor);
}

/** Robust z-score using MAD scaling (0.6745 normalizes MAD to standard deviation). */
function robustZ(value, med, scale) {
  if (scale <= 0) return 0;
  return (0.6745 * (value - med)) / scale;
}

/**
 * Theil–Sen slope estimator in kg/week.
 * Evaluates pairwise slopes across actual calendar elapsed days — does NOT assume equal spacing.
 */
function slopeKgPerWeek(points) {
  if (!points || points.length < 2) return null;
  const slopes = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = daysBetween(points[i].log_date, points[j].log_date);
      if (d <= 0) continue;
      slopes.push(((points[j].weight - points[i].weight) / d) * 7);
    }
  }
  if (!slopes.length) return null;
  return median(slopes);
}

// ─── Window Helpers ───────────────────────────────────────────────────────────

/** Extract points within [lastDate - calendarDays, lastDate]. */
function windowEndingAt(points, lastDate, calendarDays) {
  return points.filter((p) => {
    const gap = daysBetween(p.log_date, lastDate);
    return gap >= 0 && gap <= calendarDays;
  });
}

/** Weight range (max - min) in the last n points. */
function lastNRangeKg(points, n) {
  const slice = points.slice(-n);
  if (slice.length < 2) return null;
  const ws = slice.map((p) => p.weight);
  return Math.max(...ws) - Math.min(...ws);
}

// ─── Series Construction ──────────────────────────────────────────────────────

/**
 * Clean, sort, and deduplicate raw log rows.
 * - Deduplicates multiple entries on the same date (last-write-wins).
 * - Restricts to the specified lookback window.
 * - Filters out null/NaN weights.
 */
function buildWeightSeries(logs, asOfDate, lookbackDays = THRESHOLDS.lookbackDays) {
  const asOf = asOfDate ? parseDateOnly(asOfDate) : new Date();
  asOf.setHours(0, 0, 0, 0);
  const cutoff = new Date(asOf);
  cutoff.setDate(cutoff.getDate() - (lookbackDays - 1));

  const byDate = new Map();
  for (const row of logs || []) {
    if (row.weight == null || row.weight === '' || Number.isNaN(Number(row.weight))) continue;
    const ds = String(row.log_date).slice(0, 10);
    const d = parseDateOnly(ds);
    if (d < cutoff || d > asOf) continue;
    byDate.set(ds, {
      log_date: ds,
      weight: Number(row.weight),
      steps_count: row.steps_count == null ? null : Number(row.steps_count),
      workout_completed: !!row.workout_completed,
      workout_duration_mins: row.workout_duration_mins == null ? null : Number(row.workout_duration_mins),
      water_intake_ml: row.water_intake_ml == null ? null : Number(row.water_intake_ml),
      energy_level: row.energy_level == null ? null : Number(row.energy_level),
    });
  }

  return [...byDate.values()].sort(
    (a, b) => parseDateOnly(a.log_date) - parseDateOnly(b.log_date)
  );
}

// ─── Data Quality Assessment ──────────────────────────────────────────────────

function dataQuality(series) {
  if (!series || !series.length) {
    return { n: 0, spanDays: 0, status: 'insufficient' };
  }
  const spanDays = series.length >= 2
    ? Math.abs(daysBetween(series[0].log_date, series[series.length - 1].log_date))
    : 0;
  const ok = series.length >= THRESHOLDS.minObservations && spanDays >= THRESHOLDS.minSpanDays;
  return { n: series.length, spanDays, status: ok ? 'ok' : 'insufficient' };
}

// ─── Point Anomaly Detection ──────────────────────────────────────────────────

function detectPointAnomalies(series) {
  if (series.length < 2) return null;

  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  const baseline = series.slice(0, -1);
  const weights = baseline.map((p) => p.weight);
  const med = median(weights);
  const scale = effectiveMad(weights, med);
  const z = robustZ(last.weight, med, scale);
  const jump = last.weight - prev.weight;
  const absJump = Math.abs(jump);

  // Scale-hop pattern: alternating jumps in opposite directions across last 3 logs
  let hop = false;
  if (series.length >= 3) {
    const prev2 = series[series.length - 3];
    const d1 = last.weight - prev.weight;
    const d0 = prev.weight - prev2.weight;
    hop = Math.abs(d1) >= THRESHOLDS.hopAbsDeltaKg
      && Math.abs(d0) >= THRESHOLDS.hopAbsDeltaKg
      && d1 * d0 < 0;
  }

  const unusual = Math.abs(z) >= THRESHOLDS.robustZPointAnomaly
    || absJump >= THRESHOLDS.extremeAbsJumpKg
    || hop;

  if (!unusual) return null;

  return {
    type: 'point_anomaly',
    severity: absJump >= THRESHOLDS.extremeAbsJumpKg || Math.abs(z) >= 5 ? 'high' : 'medium',
    title: 'Unusual weight entry',
    explanation: 'Your latest logged weight is quite different from your recent pattern. '
      + 'If this reading looks right to you, you can ignore this note. '
      + 'If it might be a mix-up between scales or a typing slip, you can update today’s check-in.',
    evidence: {
      lastWeightKg: last.weight,
      previousWeightKg: prev.weight,
      dayJumpKg: Math.round(jump * 100) / 100,
      robustZLast: Math.round(z * 100) / 100,
      scaleHopPattern: hop,
    },
  };
}

// ─── Trend Signals (Plateau / Reversal / Maintenance) ──────────────────────────

function towardGoalSign(goalType) {
  if (goalType === 'weight_loss') return -1;
  if (goalType === 'muscle_gain') return 1;
  return 0;
}

function detectTrendSignals(series, goal) {
  const lastDate = series[series.length - 1].log_date;
  const pts14 = windowEndingAt(series, lastDate, THRESHOLDS.window14Days);
  const pts7 = windowEndingAt(series, lastDate, THRESHOLDS.window7Days);
  const slope14 = slopeKgPerWeek(pts14);
  const slope7 = slopeKgPerWeek(pts7);
  const rangeLast = lastNRangeKg(series, THRESHOLDS.lastPointsForRange);
  const span14 = pts14.length >= 2 ? daysBetween(pts14[0].log_date, pts14[pts14.length - 1].log_date) : 0;

  const evidence = {
    slope14dKgPerWeek: slope14 == null ? null : Math.round(slope14 * 100) / 100,
    slope7dKgPerWeek: slope7 == null ? null : Math.round(slope7 * 100) / 100,
    rangeLastKg: rangeLast == null ? null : Math.round(rangeLast * 100) / 100,
    n14: pts14.length,
    span14Days: span14,
  };

  const goalType = goal && goal.goal_type;
  const tw = goal && goal.target_weight != null ? Number(goal.target_weight) : null;
  const lastW = series[series.length - 1].weight;

  // 1. Maintenance Goal Path
  if (goalType === 'maintenance' && tw != null && slope14 != null) {
    const deviation = Math.abs(lastW - tw);
    const flat = Math.abs(slope14) < THRESHOLDS.plateauSlope14dKgPerWeek;
    if (deviation <= THRESHOLDS.maintenanceZoneKg && (flat || (rangeLast != null && rangeLast <= THRESHOLDS.plateauRangeKg + 0.6))) {
      return {
        type: 'stable',
        severity: 'low',
        title: 'Weight is holding near your target',
        explanation: `Your recent weight (${lastW.toFixed(1)} kg) is within about ${THRESHOLDS.maintenanceZoneKg} kg of your maintenance target (${tw} kg). Short-term wobble is normal.`,
        evidence,
      };
    }
    if (deviation > THRESHOLDS.maintenanceZoneKg) {
      return {
        type: 'drift',
        severity: deviation > 5 ? 'medium' : 'low',
        title: 'Weight has drifted from your maintenance target',
        explanation: `Your latest weight (${lastW.toFixed(1)} kg) is ${deviation.toFixed(1)} kg from your maintenance target of ${tw} kg (the usual comfort zone is about ±${THRESHOLDS.maintenanceZoneKg} kg).`,
        evidence,
      };
    }
  }

  // 2. Weight Loss & Muscle Gain Goals Path
  if (goalType !== 'weight_loss' && goalType !== 'muscle_gain') {
    return null;
  }

  const enoughForPlateau = series.length >= THRESHOLDS.plateauMinObservations
    && dataQuality(series).spanDays >= THRESHOLDS.plateauMinSpanDays
    && pts14.length >= THRESHOLDS.plateauMinObservations
    && span14 >= THRESHOLDS.plateauMinSpanDays;

  if (slope14 == null) return null;

  const dir = towardGoalSign(goalType);
  const slopeToward = slope14 * dir;
  const slopeAway = -slopeToward;

  // Reversal: trend is moving away from the goal
  if (slopeAway >= THRESHOLDS.reversalSlopeKgPerWeek) {
    const label = goalType === 'weight_loss' ? 'upward' : 'downward';
    return {
      type: 'reversal',
      severity: slopeAway >= 0.4 ? 'high' : 'medium',
      title: 'Weight is moving away from your goal',
      explanation: `Over the last two weeks your weight trend is ${label} (about ${Math.abs(slope14).toFixed(2)} kg/week), which is the opposite direction of your current goal. This uses the calendar days between your logs, not an assumed daily weigh-in.`,
      evidence,
    };
  }

  // Plateau: flat trend with sufficient data observations
  if (!enoughForPlateau) return null;

  const flat14 = Math.abs(slope14) < THRESHOLDS.plateauSlope14dKgPerWeek;
  const flat7 = slope7 == null || Math.abs(slope7) < THRESHOLDS.plateauSlope7dKgPerWeek;
  const tightRange = rangeLast != null && rangeLast < THRESHOLDS.plateauRangeKg;
  if (flat14 && (flat7 || tightRange)) {
    return {
      type: 'plateau',
      severity: 'medium',
      title: 'Weight has been stable recently',
      explanation: `Your 14-day weight slope is about ${slope14 >= 0 ? '+' : ''}${slope14.toFixed(2)} kg/week, which is flatter than the stall threshold (${THRESHOLDS.plateauSlope14dKgPerWeek} kg/week). That can be a true stall or just a quiet stretch of logs — it is a statistical note, not a diagnosis.`,
      evidence,
    };
  }

  return null;
}

// ─── Behavioral Break Detection ───────────────────────────────────────────────

function detectBehaviorBreaks(series) {
  // Only evaluate days with explicitly entered positive steps (zeros are treated as unentered)
  const positiveSteps = series.filter((p) => p.steps_count != null && p.steps_count > 0);
  if (positiveSteps.length < THRESHOLDS.minPositiveBehaviorPoints) return null;

  const last = series[series.length - 1];
  if (last.steps_count == null || last.steps_count <= 0) return null;

  const med = median(positiveSteps.map((p) => p.steps_count));
  if (med == null || med < THRESHOLDS.behaviorDropMinMedianSteps) return null;
  if (last.steps_count >= med * THRESHOLDS.behaviorDropFraction) return null;

  return {
    type: 'behavior_drop',
    severity: 'low',
    title: 'Today’s steps look lower than your usual',
    explanation: `You logged ${last.steps_count.toLocaleString()} steps, while your typical logged days (zeros excluded) sit around ${Math.round(med).toLocaleString()}. Quiet days happen; this is only compared with your own history.`,
    evidence: {
      lastSteps: last.steps_count,
      medianPositiveSteps: Math.round(med),
    },
  };
}

// ─── Primary Signal Ranking & Selection ───────────────────────────────────────

function selectPrimarySignal(candidates) {
  const present = (candidates || []).filter(Boolean);
  if (!present.length) return null;
  present.sort((a, b) => (PRIMARY_RANK[a.type] ?? 9) - (PRIMARY_RANK[b.type] ?? 9));
  return present[0];
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

function analyzeProgressSignals(logs, goal, asOfDate) {
  const series = buildWeightSeries(logs, asOfDate);
  const quality = dataQuality(series);
  const signals = [];

  if (quality.status === 'insufficient') {
    return {
      method: METHOD,
      dataQuality: quality,
      primary: {
        type: 'insufficient',
        severity: 'low',
        title: 'Not enough weigh-ins yet',
        explanation: `Progress notes need at least ${THRESHOLDS.minObservations} weight logs spanning ${THRESHOLDS.minSpanDays} calendar days. Keep checking in — short gaps are normal.`,
        evidence: { n: quality.n, spanDays: quality.spanDays },
      },
      signals,
    };
  }

  // 1. Point anomaly detection
  const point = detectPointAnomalies(series);
  if (point) signals.push(point);

  // 2. Trend detection (suppress anomalous last point when evaluating plateau/reversal)
  const seriesForTrend = point ? series.slice(0, -1) : series;
  const trendQuality = dataQuality(seriesForTrend);
  let trend = null;
  if (trendQuality.status === 'ok' && seriesForTrend.length >= 2) {
    trend = detectTrendSignals(seriesForTrend, goal);
    if (trend) signals.push(trend);
  } else if (!point) {
    trend = detectTrendSignals(series, goal);
    if (trend) signals.push(trend);
  }

  // 3. Behavioral break detection
  const behavior = detectBehaviorBreaks(series);
  if (behavior) signals.push(behavior);

  // 4. Primary signal selection
  let primary = selectPrimarySignal(signals);
  if (!primary) {
    primary = {
      type: 'none',
      severity: 'low',
      title: 'No stall or unusual entry flagged',
      explanation: 'Your recent weights are consistent enough that statistical checks did not flag a plateau, reversal, or unusual entry.',
      evidence: {},
    };
  }

  return {
    method: METHOD,
    dataQuality: quality,
    primary,
    signals,
  };
}

// ─── Module Exports ───────────────────────────────────────────────────────────

module.exports = {
  METHOD,
  THRESHOLDS,
  PRIMARY_RANK,
  parseDateOnly,
  toDateString,
  daysBetween,
  median,
  slopeKgPerWeek,
  buildWeightSeries,
  dataQuality,
  detectPointAnomalies,
  detectTrendSignals,
  detectBehaviorBreaks,
  selectPrimarySignal,
  analyzeProgressSignals,
};
