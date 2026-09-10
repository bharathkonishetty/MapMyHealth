<p align="center">
  <img src="screenshots/banner.png" alt="MapMyHealth Banner" width="900">
</p>

<h1 align="center">🏥 MapMyHealth</h1>

<p align="center">
Full-Stack Health Tracking & Analytics Platform
</p>

# Features

-  User Authentication
-  Goal Management
-  Health Journey Map
-  Analytics & Forecasting
-  Progress Notes (statistical time-series stall / unusual-entry checks — not a trained model)
-  Daily Check-In System
-  Health Score System
-  Recommendation Engine
-  AI Coach
-  Responsive Dashboard
---

## 📸 Application Screenshots

### 🏠 Dashboard
![Dashboard](screenshots/dashboard.png)

### 🎯 Goals
![Goals](screenshots/goals.png)

### 🗺️ Journey Map
![Journey Map](screenshots/journey-map.png)

### 📊 Analytics
![Analytics](screenshots/analytics.png)

### 📝 Daily Check-In
![Daily Check-In](screenshots/checkin.png)

### ❤️ Health Score
![Health Score](screenshots/health-score.png)

### 💡 Recommendations
![Recommendations](screenshots/recommendations.png)

### 🤖 AI Coach
![AI Coach](screenshots/ai-coach.png)

# Tech Stack

### Frontend
- HTML5
- CSS3
- JavaScript

### Backend
- Node.js
- Express.js

### Database
- PostgreSQL

### Tools
- Git
- GitHub

---

# Project Structure

MapMyHealth
├── public
│   ├── css
│   ├── js
│   └── index.html
├── lib
│   ├── progressSignals.js
│   └── progressSignals.test.js
├── db
├── data
├── server.js
├── package.json
└── README.md

---

# Progress Notes (Capability 3)

`GET /api/progress/signals` runs a **statistical time-series** check on the user's own recent weight logs (`method: statistical_timeseries`). It is not a trained ML or AI model. Cutoffs live in `lib/progressSignals.js` (`THRESHOLDS`) and are v1 engineering hypotheses. Run `npm test` for the detector fixture tests.

---

# Capability 2 — Goal Achievement Prediction

`GET /api/goals/achievement` (alias: `GET /api/goal-achievement`) evaluates:
> *"Based on the user's actual recent progress and current goal, how likely are they to reach their target, and approximately when?"*

### Overview & Data Principles
- **No external datasets or fake supervised ML**: Driven entirely by the logged-in user's real progress check-in history.
- **Pure Statistical Engine**: Implemented in `lib/goalAchievement.js` using pure, deterministic functions without Express, SQL, or side effects.
- **Goal Types Supported**:
  1. `weight_loss`: Tracks downward velocity, remaining kg, and estimates completion date.
  2. `muscle_gain`: Tracks upward velocity, remaining kg, and estimates completion date.
  3. `maintenance`: Evaluates stability within a ±2.0 kg zone and monitors drift.

### Minimum Data Requirements
- At least **5 valid weight observations**.
- At least **10 calendar days** of historical span.
- When history is insufficient, returns a safe structured response (`status: "insufficient_data"`) with clear guidance rather than manufacturing an unfounded prediction.

### Prediction Methodology
- **Theil-Sen Robust Slope**: Calculates pairwise median slopes over actual calendar days (`slopeKgPerWeek`), resisting single-day spikes and irregular intervals.
- **Goal Velocity & Outlooks**:
  - `achieved`: Target weight reached or passed in goal direction.
  - `on_track`: Steady trajectory toward goal (`effectiveVelocity >= 0.20 kg/week`).
  - `slow_progress`: Moving toward goal at a gradual pace (`0.05 <= effectiveVelocity < 0.20 kg/week`).
  - `at_risk`: Stalled or flat trajectory (`-0.05 < effectiveVelocity < 0.05 kg/week`).
  - `moving_away`: Trajectory moving away from goal parameters (`effectiveVelocity <= -0.05 kg/week`).
- **Completion Estimation**:
  - `weeksRemaining = remainingKg / effectiveVelocity`
  - `estimatedCompletionDate = latestLogDate + daysRemaining`
  - Disabled (`null`) when moving away, stalled, or in maintenance to prevent misleading projections.
- **Qualitative Confidence**: Evaluated as `low`, `moderate`, or `high` based on observation count, span, logging frequency, and volatility.
- **Non-Causal Behavioral Context**: Correlates recent step counts and workout logs using supportive language (*"coincides with"*, *"has been accompanied by"*).

### Limitations & Disclaimer
> [!NOTE]
> **This is a personalized trajectory-based prediction engine, not a clinically validated medical prediction model.** Trajectories reflect recent self-reported check-in history and may vary based on physiological, behavioral, and lifestyle factors.

---

# Capability 4 — Personalized Recommendations

`GET /api/recommendations/personalized` answers:
> *"What should this user focus on next based on their actual goal, progress, behavior, and detected progress signals?"*

### The MapMyHealth Intelligence Pipeline

```text
USER DATA (Check-ins, Weights, Steps, Workouts)
   ↓
CAPABILITY 1 — Personalized Progress Prediction
   "What is my likely short-term trajectory?"
   ↓
CAPABILITY 2 — Goal Achievement Prediction
   "Am I likely to achieve my goal?"
   ↓
CAPABILITY 3 — Progress & Behavioral Signals
   "Is something unusual happening?" (anomaly, reversal, plateau, behavior drop)
   ↓
CAPABILITY 4 — Personalized Recommendations
   "What should I focus on next?" (1 primary focus + 1-2 supporting actions)
   ↓
USER / AI COACH
   "Explain it to me."
```

### Core Architecture & Implementation
- **Pure Intelligence Engine (`lib/personalizedRecommendations.js`)**:
  - No database queries, Express requests/responses, session state, or global variables.
  - Receives structured inputs: `{ activeGoal, progressPrediction, goalAchievement, progressSignals, recentLogs, asOfDate }`.
  - Deterministic and reproducible: identical inputs yield identical structured recommendations.
  - Automatically runs Capabilities 1, 2, and 3 internally if precomputed outputs are not supplied.
- **Explainable Decision Hierarchy**:
  1. *High-priority point anomaly*: Filters out one-off scale noise (water retention, post-meal fluctuations) without overreacting.
  2. *Trend reversal or moving away*: Directs attention to halting divergence and re-establishing goal alignment.
  3. *Behavior drop*: Suggests restoring activity/workout baseline before making aggressive dietary changes.
  4. *Slow progress or plateau*: Suggests consistency, routine review, and continued tracking.
  5. *Maintenance drift*: Guides user to keep weight within the target range.
  6. *On-track / achieved*: Reinforces consistency, celebrates milestones, and suggests long-term sustainability.
  7. *Insufficient data or missing goal*: Provides clear guidance on logging requirements rather than fabricating recommendations.
- **Safety & Non-Medical Boundaries**:
  - General wellness suggestions only.
  - Zero medical claims, disease diagnostics, medication advice, or extreme calorie prescriptions.
  - Uses supportive, non-causal language (*"focus on"*, *"consider"*, *"maintain consistency"*).


