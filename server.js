require('./db/env')();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db/index');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── PostgreSQL Connection ────────────────────────────────────────
const pool = db.pool;

// ─── Database Migration: Daily Check-In (Phase 5) ──────────────────
(async () => {
  try {
    await pool.query(`
      ALTER TABLE progress_logs 
      ADD COLUMN IF NOT EXISTS energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 5)
    `);
    console.log('✅ Daily Check-in database migrations completed.');
  } catch (err) {
    console.error('❌ Daily Check-in database migration error:', err);
  }
})();

// ─── Middleware ───────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || '***REMOVED***',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 }
}));

// ─── Validation ───────────────────────────────────────────────────
function validateEmail(email) {
  return /^[^\s@]+@gmail\.com$/.test(email);
}

function validateUsername(username) {
  return /^[a-zA-Z]+$/.test(username) && /[A-Z]/.test(username);
}

function validatePassword(p) {
  const hasUpper = /[A-Z]/.test(p);
  const hasLower = /[a-z]/.test(p);
  const hasDigit = /[0-9]/.test(p);
  const specials = (p.match(/[^A-Za-z0-9]/g) || []).length;
  return hasUpper && hasLower && hasDigit && specials === 1 && p.length >= 6;
}

function validateMobile(mobile) {
  if (!/^[6789][0-9]{9}$/.test(mobile)) return false;
  if (/^(\d)\1{9}$/.test(mobile)) return false;
  return true;
}

// ─── Register ─────────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  const { name, email, mobile, password } = req.body;

  if (!name || !validateUsername(name))
    return res.json({ success: false, message: 'Username must contain only alphabets with at least one uppercase letter.' });
  if (!email || !validateEmail(email))
    return res.json({ success: false, message: 'Please provide a valid Gmail address (example@gmail.com).' });
  if (!mobile || !validateMobile(mobile))
    return res.json({ success: false, message: 'Please enter a valid Indian mobile number (10 digits, starting with 6-9).' });
  if (!password || !validatePassword(password))
    return res.json({ success: false, message: 'Password must be 6+ chars with uppercase, lowercase, digit, and exactly one special character.' });

  try {
    // Check duplicate username
    const nameCheck = await pool.query('SELECT id FROM users WHERE LOWER(username) = $1', [name.toLowerCase()]);
    if (nameCheck.rows.length > 0)
      return res.json({ success: false, message: 'Username already registered.' });

    // Check duplicate email
    const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (emailCheck.rows.length > 0)
      return res.json({ success: false, message: 'Email already registered.' });

    const hashedPass = await bcrypt.hash(password, 10);

    // Create user and profile in transaction/sequence
    const userRes = await pool.query(
      'INSERT INTO users (username, email, mobile, password_hash) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, email.toLowerCase(), mobile, hashedPass]
    );
    const userId = userRes.rows[0].id;
    await pool.query('INSERT INTO user_profiles (user_id) VALUES ($1)', [userId]);

    res.json({ success: true, message: 'Registered successfully! Please login.' });

  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ─── Login ────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password)
    return res.json({ success: false, message: 'Please fill in both fields.' });

  try {
    const id = identifier.trim().toLowerCase();

    const result = await pool.query(
      `SELECT u.id, u.username, u.email, u.mobile, u.password_hash, 
              p.age, p.height_cm,
              (SELECT weight FROM progress_logs WHERE user_id = u.id ORDER BY log_date DESC, created_at DESC LIMIT 1) as weight
       FROM users u
       LEFT JOIN user_profiles p ON u.id = p.user_id
       WHERE LOWER(u.username) = $1 OR u.email = $1`,
      [id]
    );

    if (result.rows.length === 0)
      return res.json({ success: false, message: 'Invalid username/email or password.' });

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match)
      return res.json({ success: false, message: 'Invalid username/email or password.' });

    req.session.user = {
      id: user.id,
      name: user.username,
      email: user.email,
      mobile: user.mobile,
      age: user.age !== null && user.age !== undefined ? user.age : '',
      height: user.height_cm !== null && user.height_cm !== undefined ? user.height_cm : '',
      weight: user.weight !== null && user.weight !== undefined ? user.weight : ''
    };

    res.json({ success: true, user: req.session.user });

  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ─── Logout ───────────────────────────────────────────────────────
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ─── Session ──────────────────────────────────────────────────────
app.get('/api/session', (req, res) => {
  if (req.session.user) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
});

// ─── Update Profile ───────────────────────────────────────────────
app.post('/api/profile', async (req, res) => {
  if (!req.session.user)
    return res.json({ success: false, message: 'Not logged in.' });

  const { age, height, weight } = req.body;

  try {
    const userCheck = await pool.query('SELECT id FROM users WHERE LOWER(username) = $1', [req.session.user.name.toLowerCase()]);
    if (userCheck.rows.length === 0)
      return res.json({ success: false, message: 'User not found.' });

    const userId = userCheck.rows[0].id;
    const parsedAge = age && age.toString().trim() !== '' ? parseInt(age, 10) : null;
    const parsedHeight = height && height.toString().trim() !== '' ? parseFloat(height) : null;
    const parsedWeight = weight && weight.toString().trim() !== '' ? parseFloat(weight) : null;

    // Update profiles table
    await pool.query(
      `INSERT INTO user_profiles (user_id, age, height_cm) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (user_id) 
       DO UPDATE SET age = EXCLUDED.age, height_cm = EXCLUDED.height_cm`,
      [userId, parsedAge, parsedHeight]
    );

    // Insert new weight log if provided
    if (parsedWeight !== null) {
      const today = new Date().toISOString().split('T')[0];
      await pool.query(
        `INSERT INTO progress_logs (user_id, log_date, weight) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (user_id, log_date) 
         DO UPDATE SET weight = EXCLUDED.weight`,
        [userId, today, parsedWeight]
      );
    }

    req.session.user.age = parsedAge !== null ? parsedAge : '';
    req.session.user.height = parsedHeight !== null ? parsedHeight : '';
    req.session.user.weight = parsedWeight !== null ? parsedWeight : '';

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ─── Goals: Create ────────────────────────────────────────────────
app.post('/api/goals', async (req, res) => {
  if (!req.session.user)
    return res.json({ success: false, message: 'Not logged in.' });

  const { goal_name, goal_type, start_weight, target_weight, target_date } = req.body;

  const validTypes = ['weight_loss', 'muscle_gain', 'maintenance'];
  if (!goal_type || !validTypes.includes(goal_type))
    return res.json({ success: false, message: 'Invalid goal type.' });

  const sw = parseFloat(start_weight);
  const tw = parseFloat(target_weight);

  if (isNaN(sw) || sw < 20 || sw > 300)
    return res.json({ success: false, message: 'Start weight must be between 20 and 300 kg.' });
  if (isNaN(tw) || tw < 20 || tw > 300)
    return res.json({ success: false, message: 'Target weight must be between 20 and 300 kg.' });
  if (goal_type === 'weight_loss' && tw >= sw)
    return res.json({ success: false, message: 'For weight loss, target weight must be less than start weight.' });
  if (goal_type === 'muscle_gain' && tw <= sw)
    return res.json({ success: false, message: 'For muscle gain, target weight must be greater than start weight.' });
  if (goal_type === 'maintenance' && Math.abs(tw - sw) > 2)
    return res.json({ success: false, message: 'For maintenance, target weight must be within 2 kg of start weight.' });
  if (!target_date)
    return res.json({ success: false, message: 'Target date is required.' });

  const td = new Date(target_date);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (td <= today)
    return res.json({ success: false, message: 'Target date must be a future date.' });
  if (goal_name && goal_name.length > 100)
    return res.json({ success: false, message: 'Goal name must be 100 characters or fewer.' });

  try {
    const userId = req.session.user.id;
    const activeCheck = await pool.query(
      'SELECT id FROM goals WHERE user_id = $1 AND status = $2',
      [userId, 'active']
    );
    if (activeCheck.rows.length >= 1)
      return res.json({ success: false, message: 'You already have an active goal. Complete or cancel it before creating a new one.' });

    const result = await pool.query(
      `INSERT INTO goals (user_id, goal_name, goal_type, start_weight, target_weight, start_date, target_date)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6) RETURNING *`,
      [userId, goal_name || null, goal_type, sw, tw, target_date]
    );
    res.json({ success: true, goal: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ─── Goals: Fetch All ─────────────────────────────────────────────
app.get('/api/goals', async (req, res) => {
  if (!req.session.user)
    return res.json({ success: false, message: 'Not logged in.' });

  try {
    const userId = req.session.user.id;
    const result = await pool.query(
      `SELECT g.*,
              (SELECT weight FROM progress_logs
               WHERE user_id = g.user_id
               ORDER BY log_date DESC, created_at DESC LIMIT 1) AS current_weight
       FROM goals g
       WHERE g.user_id = $1
       ORDER BY g.created_at DESC`,
      [userId]
    );
    const goals = result.rows.map(g => {
      const sw = parseFloat(g.start_weight);
      const tw = parseFloat(g.target_weight);
      const cw = g.current_weight !== null ? parseFloat(g.current_weight) : sw;
      let progress_pct = 0;
      if (sw !== tw) {
        progress_pct = ((sw - cw) / (sw - tw)) * 100;
        progress_pct = Math.max(0, Math.min(100, Math.round(progress_pct * 10) / 10));
      }
      return { ...g, current_weight: cw, progress_pct };
    });
    res.json({ success: true, goals });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ─── Goals: Edit ──────────────────────────────────────────────────
app.put('/api/goals/:id', async (req, res) => {
  if (!req.session.user)
    return res.json({ success: false, message: 'Not logged in.' });

  const { id } = req.params;
  const { goal_name, target_weight, target_date } = req.body;

  try {
    const userId = req.session.user.id;
    const existing = await pool.query(
      'SELECT * FROM goals WHERE id = $1 AND user_id = $2', [id, userId]
    );
    if (existing.rows.length === 0)
      return res.json({ success: false, message: 'Goal not found.' });

    const goal = existing.rows[0];
    if (goal.status !== 'active')
      return res.json({ success: false, message: 'Only active goals can be edited.' });

    if (target_weight !== undefined && target_weight !== '') {
      const tw = parseFloat(target_weight);
      const sw = parseFloat(goal.start_weight);
      if (isNaN(tw) || tw < 20 || tw > 300)
        return res.json({ success: false, message: 'Target weight must be between 20 and 300 kg.' });
      if (goal.goal_type === 'weight_loss' && tw >= sw)
        return res.json({ success: false, message: 'For weight loss, target weight must be less than start weight.' });
      if (goal.goal_type === 'muscle_gain' && tw <= sw)
        return res.json({ success: false, message: 'For muscle gain, target weight must be greater than start weight.' });
      if (goal.goal_type === 'maintenance' && Math.abs(tw - sw) > 2)
        return res.json({ success: false, message: 'For maintenance, target weight must be within 2 kg of start weight.' });
    }
    if (target_date) {
      const td = new Date(target_date);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (td <= today)
        return res.json({ success: false, message: 'Target date must be a future date.' });
    }

    const tw = target_weight && target_weight !== '' ? parseFloat(target_weight) : null;
    const result = await pool.query(
      `UPDATE goals
       SET goal_name = COALESCE($1, goal_name),
           target_weight = COALESCE($2, target_weight),
           target_date = COALESCE($3, target_date),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND user_id = $5 AND status = 'active'
       RETURNING *`,
      [goal_name || null, tw, target_date || null, id, userId]
    );
    res.json({ success: true, goal: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ─── Goals: Update Status ─────────────────────────────────────────
app.patch('/api/goals/:id/status', async (req, res) => {
  if (!req.session.user)
    return res.json({ success: false, message: 'Not logged in.' });

  const { id } = req.params;
  const { status } = req.body;

  if (!['completed', 'cancelled'].includes(status))
    return res.json({ success: false, message: 'Invalid status. Must be "completed" or "cancelled".' });

  try {
    const userId = req.session.user.id;
    const result = await pool.query(
      `UPDATE goals SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3 AND status = 'active'
       RETURNING *`,
      [status, id, userId]
    );
    if (result.rows.length === 0)
      return res.json({ success: false, message: 'Goal not found or is not active.' });
    res.json({ success: true, goal: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ─── Journey Map: Dynamic Fetch (Phase 3) ──────────────────────────
app.get('/api/journey/map', async (req, res) => {
  if (!req.session.user)
    return res.json({ success: false, message: 'Not logged in.' });

  try {
    const userId = req.session.user.id;

    // 1. Fetch active goal
    const goalRes = await pool.query(
      `SELECT * FROM goals WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [userId]
    );

    if (goalRes.rows.length === 0) {
      return res.json({ success: true, activeGoal: null, message: 'No active goal found.' });
    }

    const activeGoal = goalRes.rows[0];

    // 2. Fetch latest weight from progress logs
    const weightRes = await pool.query(
      `SELECT weight FROM progress_logs
       WHERE user_id = $1
       ORDER BY log_date DESC, created_at DESC LIMIT 1`,
      [userId]
    );

    const sw = parseFloat(activeGoal.start_weight);
    const tw = parseFloat(activeGoal.target_weight);
    const currentWeight = weightRes.rows.length > 0 && weightRes.rows[0].weight !== null
      ? parseFloat(weightRes.rows[0].weight)
      : sw;

    let progressPct = 0;
    const goalType = activeGoal.goal_type;

    if (goalType === 'weight_loss') {
      if (sw !== tw) {
        progressPct = ((sw - currentWeight) / (sw - tw)) * 100;
      }
    } else if (goalType === 'muscle_gain') {
      if (sw !== tw) {
        progressPct = ((currentWeight - sw) / (tw - sw)) * 100;
      }
    } else if (goalType === 'maintenance') {
      const startMs = new Date(activeGoal.start_date).getTime();
      const targetMs = new Date(activeGoal.target_date).getTime();
      const nowMs = Math.min(targetMs, Math.max(startMs, Date.now()));
      if (targetMs !== startMs) {
        progressPct = ((nowMs - startMs) / (targetMs - startMs)) * 100;
      } else {
        progressPct = 100;
      }
    }

    progressPct = Math.max(0, Math.min(100, Math.round(progressPct * 10) / 10));

    // 3. Dynamically construct the 5 named milestones in-memory
    const checkpoints = [];

    if (goalType === 'weight_loss' || goalType === 'muscle_gain') {
      const diff = tw - sw;
      const step = diff / 4;

      const milestonesInfo = [
        { title: 'Starting Point', pct: 0, label: `Start Weight: ${sw} kg`, val: sw },
        { title: 'First Step', pct: 25, label: `Target Weight: ${(sw + step).toFixed(1)} kg`, val: sw + step },
        { title: 'Halfway Hero', pct: 50, label: `Target Weight: ${(sw + 2 * step).toFixed(1)} kg`, val: sw + 2 * step },
        { title: 'Momentum', pct: 75, label: `Target Weight: ${(sw + 3 * step).toFixed(1)} kg`, val: sw + 3 * step },
        { title: 'Destination', pct: 100, label: `Goal Weight: ${tw} kg`, val: tw }
      ];

      for (let i = 0; i < milestonesInfo.length; i++) {
        const m = milestonesInfo[i];
        const isCompleted = progressPct >= m.pct;
        checkpoints.push({
          title: m.title,
          description: m.label,
          checkpoint_type: i === 0 ? 'start' : (i === 4 ? 'destination' : 'milestone'),
          sequence_order: i,
          target_value: Math.round(m.val * 100) / 100,
          is_completed: isCompleted
        });
      }
    } else if (goalType === 'maintenance') {
      const start = new Date(activeGoal.start_date);
      const target = new Date(activeGoal.target_date);
      const diffMs = target.getTime() - start.getTime();

      const getCheckDate = (ratio) => {
        const checkMs = start.getTime() + diffMs * ratio;
        return new Date(checkMs).toISOString().split('T')[0];
      };

      const formatCheckDate = (dStr) => {
        return new Date(dStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      };

      const milestonesInfo = [
        { title: 'Starting Point', pct: 0, label: `Maintain weight at ${tw} kg`, date: activeGoal.start_date },
        { title: 'First Step', pct: 25, label: `Maintain until ${formatCheckDate(getCheckDate(0.25))}`, date: getCheckDate(0.25) },
        { title: 'Halfway Hero', pct: 50, label: `Maintain until ${formatCheckDate(getCheckDate(0.50))}`, date: getCheckDate(0.50) },
        { title: 'Momentum', pct: 75, label: `Maintain until ${formatCheckDate(getCheckDate(0.75))}`, date: getCheckDate(0.75) },
        { title: 'Destination', pct: 100, label: `Successfully maintain until ${formatCheckDate(activeGoal.target_date)}`, date: activeGoal.target_date }
      ];

      const isWeightStable = Math.abs(currentWeight - tw) <= 2;

      for (let i = 0; i < milestonesInfo.length; i++) {
        const m = milestonesInfo[i];
        const isCompleted = progressPct >= m.pct && isWeightStable;
        checkpoints.push({
          title: m.title,
          description: m.label,
          checkpoint_type: i === 0 ? 'start' : (i === 4 ? 'destination' : 'milestone'),
          sequence_order: i,
          target_value: tw,
          is_completed: isCompleted
        });
      }
    }

    res.json({
      success: true,
      activeGoal,
      currentWeight,
      progressPct,
      checkpoints
    });

  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ─── Progress Analytics & Projections (Phase 4) ────────────────────
app.get('/api/progress/analytics', async (req, res) => {
  if (!req.session.user)
    return res.json({ success: false, message: 'Not logged in.' });

  try {
    const userId = req.session.user.id;

    // 1. Fetch active goal
    const goalRes = await pool.query(
      `SELECT * FROM goals WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [userId]
    );

    if (goalRes.rows.length === 0) {
      return res.json({ success: true, activeGoal: null, message: 'No active goal found.' });
    }

    const activeGoal = goalRes.rows[0];

    // 2. Fetch past 30 days of weight logs (excluding nulls)
    const logsRes = await pool.query(
      `SELECT log_date::text, weight FROM progress_logs
       WHERE user_id = $1 AND log_date >= CURRENT_DATE - INTERVAL '29 days'
       AND weight IS NOT NULL
       ORDER BY log_date ASC`,
      [userId]
    );

    const weightHistory = logsRes.rows.map(row => ({
      log_date: row.log_date,
      weight: parseFloat(row.weight)
    }));

    // 3. Fetch latest weight log
    const latestWeightRes = await pool.query(
      `SELECT weight FROM progress_logs
       WHERE user_id = $1 AND weight IS NOT NULL
       ORDER BY log_date DESC, created_at DESC LIMIT 1`,
      [userId]
    );

    const sw = parseFloat(activeGoal.start_weight);
    const tw = parseFloat(activeGoal.target_weight);
    const currentWeight = latestWeightRes.rows.length > 0
      ? parseFloat(latestWeightRes.rows[0].weight)
      : sw;

    // 4. Calculate progress percentage
    let progressPct = 0;
    const goalType = activeGoal.goal_type;

    if (goalType === 'weight_loss') {
      if (sw !== tw) {
        progressPct = ((sw - currentWeight) / (sw - tw)) * 100;
      }
    } else if (goalType === 'muscle_gain') {
      if (sw !== tw) {
        progressPct = ((currentWeight - sw) / (tw - sw)) * 100;
      }
    } else if (goalType === 'maintenance') {
      const startMs = new Date(activeGoal.start_date).getTime();
      const targetMs = new Date(activeGoal.target_date).getTime();
      const nowMs = Math.min(targetMs, Math.max(startMs, Date.now()));
      if (targetMs !== startMs) {
        progressPct = ((nowMs - startMs) / (targetMs - startMs)) * 100;
      } else {
        progressPct = 100;
      }
    }
    progressPct = Math.max(0, Math.min(100, Math.round(progressPct * 10) / 10));

    // 5. Calculate Timeline & Calendar Days Remaining
    const startDate = new Date(activeGoal.start_date);
    const targetDate = new Date(activeGoal.target_date);
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const totalDays = Math.max(1, Math.round((targetDate - startDate) / (1000 * 60 * 60 * 24)));
    const daysElapsed = Math.max(0, Math.round((today - startDate) / (1000 * 60 * 60 * 24)));
    const daysRemaining = Math.max(0, Math.round((targetDate - today) / (1000 * 60 * 60 * 24)));
    const timePct = Math.min(100, Math.round((daysElapsed / totalDays) * 1000) / 10);

    // 6. Calculate Velocity & Forecast Projections
    let weeklyRate = 0;
    let requiredRate = 0;
    let onTrack = false;
    
    let forecastStatus = 'insufficient'; // 'ahead' | 'ontrack' | 'behind' | 'insufficient'
    let forecastLabel = 'Insufficient Data';
    let estimatedDate = 'N/A';
    let daysDifference = null;
    let confidence = 'Low';
    let forecastInsights = 'Please log your weight at least twice over a 3-day span to activate weekly rate trends and completion forecasts.';

    const weightLogsCount = weightHistory.length;

    if (weightLogsCount >= 2) {
      const earliest = weightHistory[0];
      const latest = weightHistory[weightLogsCount - 1];
      const dateDiffDays = Math.round((new Date(latest.log_date) - new Date(earliest.log_date)) / (1000 * 60 * 60 * 24));

      // Calculate confidence rating based on log counts
      if (weightLogsCount >= 10) {
        confidence = 'High';
      } else if (weightLogsCount >= 3) {
        confidence = 'Medium';
      } else {
        confidence = 'Low';
      }

      if (dateDiffDays >= 3) {
        const weightDiff = latest.weight - earliest.weight;
        weeklyRate = Math.round((weightDiff / dateDiffDays * 7) * 100) / 100;

        const weightRemaining = Math.abs(currentWeight - tw);
        
        if (daysRemaining > 0) {
          requiredRate = Math.round((weightRemaining / daysRemaining * 7) * 100) / 100;
        }

        // Validate direction of progression
        let isMovingTowardsGoal = false;
        let rateTowardsGoal = 0;

        if (goalType === 'weight_loss' && weeklyRate < 0) {
          isMovingTowardsGoal = true;
          rateTowardsGoal = -weeklyRate;
        } else if (goalType === 'muscle_gain' && weeklyRate > 0) {
          isMovingTowardsGoal = true;
          rateTowardsGoal = weeklyRate;
        } else if (goalType === 'maintenance') {
          isMovingTowardsGoal = Math.abs(currentWeight - tw) <= 2;
          rateTowardsGoal = 1; // dummy velocity value for stability evaluation
        }

        if (isMovingTowardsGoal && rateTowardsGoal > 0) {
          let estDaysRemaining = 0;
          if (goalType === 'maintenance') {
            estDaysRemaining = daysRemaining;
          } else {
            estDaysRemaining = Math.ceil(weightRemaining / (rateTowardsGoal / 7));
          }

          const estDate = new Date();
          estDate.setDate(estDate.getDate() + estDaysRemaining);
          estimatedDate = estDate.toISOString().split('T')[0];

          daysDifference = daysRemaining - estDaysRemaining;

          if (daysDifference > 3) {
            forecastStatus = 'ahead';
            forecastLabel = 'Ahead of Schedule';
            forecastInsights = `At your current velocity (${weeklyRate} kg/week) with ${confidence} Confidence (${weightLogsCount} logs), you are projected to reach your goal on ${estDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}, which is ${Math.round(daysDifference)} days ahead of schedule!`;
            onTrack = true;
          } else if (daysDifference < -3) {
            forecastStatus = 'behind';
            forecastLabel = 'Behind Schedule';
            const extra = Math.round(Math.abs(daysDifference));
            forecastInsights = `At your current velocity (${weeklyRate} kg/week) with ${confidence} Confidence (${weightLogsCount} logs), you are projected to reach your goal on ${estDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}, which is ${extra} days behind schedule. Adjust caloric/activity thresholds to regain momentum.`;
            onTrack = false;
          } else {
            forecastStatus = 'ontrack';
            forecastLabel = 'On Track';
            forecastInsights = `At your current velocity (${weeklyRate} kg/week) with ${confidence} Confidence (${weightLogsCount} logs), you are projected to reach your goal on ${estDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}, perfectly matching your target schedule!`;
            onTrack = true;
          }
        } else {
          forecastStatus = 'behind';
          forecastLabel = 'Behind Schedule';
          estimatedDate = 'Infinite';
          onTrack = false;
          forecastInsights = `Your weight trend is moving away from your goal parameters (current rate: ${weeklyRate} kg/week). Adjust daily consistency to return to path.`;
        }
      }
    }

    res.json({
      success: true,
      activeGoal,
      currentWeight,
      progressPct,
      timeline: {
        totalDays,
        daysElapsed,
        daysRemaining,
        timePct
      },
      velocity: {
        weeklyRate,
        requiredRate,
        onTrack
      },
      forecast: {
        status: forecastStatus,
        statusLabel: forecastLabel,
        estimatedDate,
        daysDifference,
        confidence,
        insights: forecastInsights
      },
      weightHistory
    });

  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ─── Local Date String Helper ──────────────────────────────────────
function getLocalDateString(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ─── Streaks Calculator (Phase 5) ──────────────────────────────────
function calculateStreaks(dates) {
  if (!dates || dates.length === 0) {
    return { currentStreak: 0, bestStreak: 0 };
  }

  const parseLocalDate = (dateStr) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const sortedDates = dates.map(parseLocalDate).sort((a, b) => a - b);

  let bestStreak = 1;
  let currentStreak = 0;
  let tempStreak = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const diffTime = sortedDates[i] - sortedDates[i - 1];
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      tempStreak++;
    } else if (diffDays > 1) {
      bestStreak = Math.max(bestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  bestStreak = Math.max(bestStreak, tempStreak);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateStrings = dates.map(d => d.trim());
  const todayStr = getLocalDateString(today);
  const yesterdayStr = getLocalDateString(yesterday);

  const hasToday = dateStrings.includes(todayStr);
  const hasYesterday = dateStrings.includes(yesterdayStr);

  if (hasToday || hasYesterday) {
    currentStreak = 1;
    let refDate = hasToday ? today : yesterday;

    while (true) {
      const prevDate = new Date(refDate);
      prevDate.setDate(prevDate.getDate() - 1);
      const prevDateStr = getLocalDateString(prevDate);

      if (dateStrings.includes(prevDateStr)) {
        currentStreak++;
        refDate = prevDate;
      } else {
        break;
      }
    }
  } else {
    currentStreak = 0;
  }

  return { currentStreak, bestStreak };
}

// ─── Daily Check-In: Fetch Today's Log & Streaks (Phase 5) ───────────
app.get('/api/checkin/today', async (req, res) => {
  if (!req.session.user)
    return res.json({ success: false, message: 'Not logged in.' });

  try {
    const userId = req.session.user.id;
    const todayStr = getLocalDateString(new Date());

    // 1. Fetch today's check-in
    const checkinRes = await pool.query(
      `SELECT * FROM progress_logs
       WHERE user_id = $1 AND log_date = $2 LIMIT 1`,
      [userId, todayStr]
    );

    // 2. Fetch all log dates for streaks
    const datesRes = await pool.query(
      `SELECT DISTINCT log_date::text FROM progress_logs
       WHERE user_id = $1
       ORDER BY log_date::text ASC`,
      [userId]
    );

    const dates = datesRes.rows.map(row => row.log_date);
    const streak = calculateStreaks(dates);

    if (checkinRes.rows.length === 0) {
      return res.json({ success: true, logged: false, streak });
    }

    const row = checkinRes.rows[0];
    res.json({
      success: true,
      logged: true,
      streak,
      data: {
        weight: row.weight ? parseFloat(row.weight) : null,
        water_intake_l: row.water_intake_ml ? parseFloat((row.water_intake_ml / 1000).toFixed(2)) : null,
        steps_count: row.steps_count !== null ? parseInt(row.steps_count, 10) : null,
        workout_completed: row.workout_completed || false,
        workout_duration_mins: row.workout_duration_mins !== null ? parseInt(row.workout_duration_mins, 10) : null,
        energy_level: row.energy_level ? parseInt(row.energy_level, 10) : null,
        notes: row.notes || ''
      }
    });

  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ─── Daily Check-In: Save Log (Phase 5) ──────────────────────────────
app.post('/api/checkin', async (req, res) => {
  if (!req.session.user)
    return res.json({ success: false, message: 'Not logged in.' });

  try {
    const userId = req.session.user.id;
    const {
      weight,
      water_intake_l,
      steps_count,
      workout_completed,
      workout_duration_mins,
      energy_level,
      notes
    } = req.body;

    // Server-side Validation
    if (weight !== undefined && weight !== null && weight !== '') {
      const wVal = parseFloat(weight);
      if (isNaN(wVal) || wVal <= 0 || wVal > 500) {
        return res.json({ success: false, message: 'Invalid weight (must be between 0 and 500 kg).' });
      }
    }

    if (water_intake_l !== undefined && water_intake_l !== null && water_intake_l !== '') {
      const waterVal = parseFloat(water_intake_l);
      if (isNaN(waterVal) || waterVal < 0 || waterVal > 20) {
        return res.json({ success: false, message: 'Invalid water intake (must be between 0 and 20 L).' });
      }
    }

    if (steps_count !== undefined && steps_count !== null && steps_count !== '') {
      const stepsVal = parseInt(steps_count, 10);
      if (isNaN(stepsVal) || stepsVal < 0 || stepsVal > 100000) {
        return res.json({ success: false, message: 'Invalid steps count (must be between 0 and 100,000).' });
      }
    }

    if (workout_duration_mins !== undefined && workout_duration_mins !== null && workout_duration_mins !== '') {
      const durVal = parseInt(workout_duration_mins, 10);
      if (isNaN(durVal) || durVal < 0 || durVal > 1440) {
        return res.json({ success: false, message: 'Invalid workout duration (must be between 0 and 1440 minutes).' });
      }
    }

    if (energy_level !== undefined && energy_level !== null && energy_level !== '') {
      const elVal = parseInt(energy_level, 10);
      if (isNaN(elVal) || elVal < 1 || elVal > 5) {
        return res.json({ success: false, message: 'Invalid energy level (must be between 1 and 5).' });
      }
    } else {
      return res.json({ success: false, message: 'Energy level is required.' });
    }

    if (notes && notes.length > 500) {
      return res.json({ success: false, message: 'Notes must be less than 500 characters.' });
    }

    const water_ml = (water_intake_l !== undefined && water_intake_l !== null && water_intake_l !== '')
      ? Math.round(parseFloat(water_intake_l) * 1000)
      : null;
    const parsedWeight = (weight !== undefined && weight !== null && weight !== '') ? parseFloat(weight) : null;
    const parsedSteps = (steps_count !== undefined && steps_count !== null && steps_count !== '') ? parseInt(steps_count, 10) : null;
    const isWorkoutDone = !!workout_completed;
    const parsedDuration = (isWorkoutDone && workout_duration_mins !== undefined && workout_duration_mins !== null && workout_duration_mins !== '')
      ? parseInt(workout_duration_mins, 10)
      : 0;
    const parsedEnergy = parseInt(energy_level, 10);
    const sanitizedNotes = notes ? notes.trim() : '';

    const todayStr = getLocalDateString(new Date());

    await pool.query(
      `INSERT INTO progress_logs 
       (user_id, log_date, weight, water_intake_ml, steps_count, workout_completed, workout_duration_mins, energy_level, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id, log_date)
       DO UPDATE SET 
         weight = COALESCE(EXCLUDED.weight, progress_logs.weight),
         water_intake_ml = EXCLUDED.water_intake_ml,
         steps_count = EXCLUDED.steps_count,
         workout_completed = EXCLUDED.workout_completed,
         workout_duration_mins = EXCLUDED.workout_duration_mins,
         energy_level = EXCLUDED.energy_level,
         notes = EXCLUDED.notes`,
      [userId, todayStr, parsedWeight, water_ml, parsedSteps, isWorkoutDone, parsedDuration, parsedEnergy, sanitizedNotes]
    );

    if (parsedWeight !== null) {
      await pool.query(
        `INSERT INTO user_profiles (user_id, age, height_cm) 
         VALUES ($1, NULL, NULL)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );
      req.session.user.weight = parsedWeight;
    }

    res.json({ success: true, message: 'Daily check-in logged successfully.' });

  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ─── Health Score: Deterministic Dynamic Calculations (Phase 6) ──────
app.get('/api/healthscore', async (req, res) => {
  if (!req.session.user)
    return res.json({ success: false, message: 'Not logged in.' });

  try {
    const userId = req.session.user.id;
    const todayStr = getLocalDateString(new Date());

    // 1. Fetch active goal
    const goalRes = await pool.query(
      `SELECT * FROM goals WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [userId]
    );
    const activeGoal = goalRes.rows.length > 0 ? goalRes.rows[0] : null;

    // 2. Fetch today's check-in
    const todayLogRes = await pool.query(
      `SELECT * FROM progress_logs
       WHERE user_id = $1 AND log_date = $2 LIMIT 1`,
      [userId, todayStr]
    );
    const todayLog = todayLogRes.rows.length > 0 ? todayLogRes.rows[0] : null;

    // 3. Fetch all check-in dates for streak calculations
    const datesRes = await pool.query(
      `SELECT DISTINCT log_date::text FROM progress_logs
       WHERE user_id = $1
       ORDER BY log_date::text ASC`,
      [userId]
    );
    const logDates = datesRes.rows.map(row => row.log_date);
    const { currentStreak } = calculateStreaks(logDates);

    // 4. Fetch past 7 days logs for consistency calculations
    const last7DaysRes = await pool.query(
      `SELECT workout_completed FROM progress_logs
       WHERE user_id = $1 AND log_date >= CURRENT_DATE - INTERVAL '6 days'
       AND workout_completed = TRUE`,
      [userId]
    );
    const completedWorkoutsThisWeek = last7DaysRes.rows.length;

    // 5. Fetch 30-day energy levels average as a fallback
    const energyAvgRes = await pool.query(
      `SELECT AVG(energy_level) as avg_energy FROM progress_logs
       WHERE user_id = $1 AND log_date >= CURRENT_DATE - INTERVAL '29 days'
       AND energy_level IS NOT NULL`,
      [userId]
    );
    const avgEnergy = energyAvgRes.rows.length > 0 && energyAvgRes.rows[0].avg_energy !== null
      ? parseFloat(energyAvgRes.rows[0].avg_energy)
      : 3.0; // default to neutral (3) if no logs exist

    // 6. Fetch 30-day logs (needed to calculate velocity/schedule variance for Goal Progress)
    const logsRes = await pool.query(
      `SELECT log_date::text, weight FROM progress_logs
       WHERE user_id = $1 AND log_date >= CURRENT_DATE - INTERVAL '29 days'
       AND weight IS NOT NULL
       ORDER BY log_date ASC`,
      [userId]
    );
    const weightHistory = logsRes.rows.map(row => ({
      log_date: row.log_date,
      weight: parseFloat(row.weight)
    }));

    // 7. Fetch latest weight
    const latestWeightRes = await pool.query(
      `SELECT weight FROM progress_logs
       WHERE user_id = $1 AND weight IS NOT NULL
       ORDER BY log_date DESC, created_at DESC LIMIT 1`,
      [userId]
    );
    const sw = activeGoal ? parseFloat(activeGoal.start_weight) : null;
    const tw = activeGoal ? parseFloat(activeGoal.target_weight) : null;
    const currentWeight = latestWeightRes.rows.length > 0
      ? parseFloat(latestWeightRes.rows[0].weight)
      : (sw || null);

    // ─────────────────────────────────────────────────────────────────
    // COMPONENT A: GOAL PROGRESS (25% weight)
    // ─────────────────────────────────────────────────────────────────
    let goalScore = 60;
    let goalValueText = 'No active goal';
    let goalTargetText = 'Set an active goal';
    let goalExplanation = 'Setting an active goal parameters provides a clear endpoint for your health journey and structures your score roadmap.';

    if (activeGoal) {
      goalTargetText = `${activeGoal.target_weight} kg`;
      
      if (activeGoal.goal_type === 'maintenance') {
        const deviation = Math.abs(currentWeight - tw);
        goalValueText = `${currentWeight.toFixed(1)} kg`;
        
        if (deviation <= 2) {
          goalScore = 100;
          goalExplanation = `Your current weight (${currentWeight.toFixed(1)} kg) is within your stability target zone (+/- 2 kg of ${tw} kg). Excellent maintenance control!`;
        } else {
          goalScore = Math.max(0, Math.round(100 - (deviation - 2) * 10));
          goalExplanation = `Your current weight (${currentWeight.toFixed(1)} kg) is outside your stability zone (+/- 2 kg of ${tw} kg). Work on alignment to regain score points.`;
        }
      } else {
        // weight_loss or muscle_gain
        // Retrieve schedule variance from velocity calculation logic
        const startDate = new Date(activeGoal.start_date);
        const targetDate = new Date(activeGoal.target_date);
        const today = new Date(); today.setHours(0,0,0,0);
        
        const daysRemaining = Math.max(0, Math.round((targetDate - today) / (1000 * 60 * 60 * 24)));
        const weightLogsCount = weightHistory.length;
        
        let weeklyRate = 0;
        let isMovingTowardsGoal = false;
        let rateTowardsGoal = 0;
        
        if (weightLogsCount >= 2) {
          const earliest = weightHistory[0];
          const latest = weightHistory[weightLogsCount - 1];
          const dateDiffDays = Math.round((new Date(latest.log_date) - new Date(earliest.log_date)) / (1000 * 60 * 60 * 24));
          
          if (dateDiffDays >= 3) {
            const weightDiff = latest.weight - earliest.weight;
            weeklyRate = Math.round((weightDiff / dateDiffDays * 7) * 100) / 100;
            
            if (activeGoal.goal_type === 'weight_loss' && weeklyRate < 0) {
              isMovingTowardsGoal = true;
              rateTowardsGoal = -weeklyRate;
            } else if (activeGoal.goal_type === 'muscle_gain' && weeklyRate > 0) {
              isMovingTowardsGoal = true;
              rateTowardsGoal = weeklyRate;
            }
          }
        }
        
        if (isMovingTowardsGoal && rateTowardsGoal > 0) {
          const weightRemaining = Math.abs(currentWeight - tw);
          const estDaysRemaining = Math.ceil(weightRemaining / (rateTowardsGoal / 7));
          const daysDifference = daysRemaining - estDaysRemaining;
          
          goalValueText = daysDifference > 0 ? `${daysDifference} days ahead` : `${Math.abs(daysDifference)} days behind`;
          
          if (daysDifference >= -3) {
            goalScore = 100;
            goalExplanation = `Your weight velocity (${Math.abs(weeklyRate).toFixed(2)} kg/week) is on track. Projected to hit target weight ${daysDifference > 0 ? daysDifference + ' days ahead' : 'close to'} schedule.`;
          } else {
            const behindDays = Math.abs(daysDifference);
            goalScore = Math.max(20, Math.round(100 - behindDays * 2));
            goalExplanation = `Your weight velocity (${Math.abs(weeklyRate).toFixed(2)} kg/week) is behind target by ${Math.round(behindDays)} days. Adjust active thresholds.`;
          }
        } else {
          goalValueText = 'Velocity lagging';
          goalScore = 60;
          if (weightLogsCount < 2) {
            goalExplanation = 'Insufficient logs to determine schedule velocity. Log weight at least twice over a 3-day window to evaluate.';
          } else {
            goalExplanation = `Your weight trend (${weeklyRate > 0 ? '+' : ''}${weeklyRate} kg/week) is stable or moving away from your goal parameters. Check consistency inputs.`;
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────
    // COMPONENT B: DAILY ACTIVITY (20% weight)
    // ─────────────────────────────────────────────────────────────────
    let activityScore = 0;
    const stepsLogged = todayLog ? parseInt(todayLog.steps_count || 0, 10) : 0;
    const durationLogged = todayLog ? parseInt(todayLog.workout_duration_mins || 0, 10) : 0;
    
    const stepsPart = Math.min(100, (stepsLogged / 10000) * 100);
    const durationPart = Math.min(100, (durationLogged / 30) * 100);
    activityScore = Math.round(0.60 * stepsPart + 0.40 * durationPart);
    
    const activityValueText = `${stepsLogged.toLocaleString()} steps, ${durationLogged} mins`;
    const activityTargetText = '10,000 steps, 30 mins';
    let activityExplanation = `You walked ${stepsLogged.toLocaleString()} steps (target: 10,000) and completed ${durationLogged} minutes of active exercise (target: 30) today.`;
    
    if (stepsLogged === 0 && durationLogged === 0) {
      activityExplanation = 'No movement logged today. Complete a workout or log steps in your check-in to unlock daily activity points.';
    }

    // ─────────────────────────────────────────────────────────────────
    // COMPONENT C: WORKOUT CONSISTENCY (20% weight)
    // ─────────────────────────────────────────────────────────────────
    const consistencyScore = Math.round(Math.min(100, (completedWorkoutsThisWeek / 3) * 100));
    const consistencyValueText = `${completedWorkoutsThisWeek} workouts`;
    const consistencyTargetText = '3 workouts / week';
    const consistencyExplanation = `You completed ${completedWorkoutsThisWeek} workout sessions in the past 7 days (target: 3 per week). Regular structured training improves health parameters.`;

    // ─────────────────────────────────────────────────────────────────
    // COMPONENT D: HYDRATION (15% weight)
    // ─────────────────────────────────────────────────────────────────
    const waterMl = todayLog ? parseInt(todayLog.water_intake_ml || 0, 10) : 0;
    const waterL = parseFloat((waterMl / 1000).toFixed(2));
    const hydrationScore = Math.round(Math.min(100, (waterL / 3.0) * 100));
    const hydrationValueText = `${waterL} L`;
    const hydrationTargetText = '3.0 L';
    let hydrationExplanation = `You logged ${waterL} L of water today (target: 3.0 L). Proper hydration is essential for cellular recovery and physical energy.`;
    
    if (waterL === 0) {
      hydrationExplanation = 'No hydration logged today. Log water cups in your check-in to unlock points and keep metabolism primed.';
    }

    // ─────────────────────────────────────────────────────────────────
    // COMPONENT E: ENERGY LEVELS (5% weight)
    // ─────────────────────────────────────────────────────────────────
    const energyVal = todayLog ? todayLog.energy_level : null;
    const finalEnergy = energyVal !== null ? energyVal : avgEnergy;
    const energyScore = Math.round((finalEnergy / 5) * 100);
    
    const energyLabels = { 1: 'Exhausted', 2: 'Tired', 3: 'Normal', 4: 'Energetic', 5: 'Peak' };
    const energyValueText = energyVal !== null ? `${energyVal}/5 (${energyLabels[energyVal]})` : `${finalEnergy.toFixed(1)}/5 (Avg)`;
    const energyTargetText = '5/5 (Peak)';
    let energyExplanation = `Your subjective energy level is rated as ${energyLabels[Math.round(finalEnergy)]} (${finalEnergy.toFixed(1)}/5) today.`;
    
    if (energyVal === null) {
      energyExplanation = `No check-in rating logged today; falling back to 30-day average energy level (${finalEnergy.toFixed(1)}/5).`;
    }

    // ─────────────────────────────────────────────────────────────────
    // COMPONENT F: CHECK-IN STREAKS (15% weight)
    // ─────────────────────────────────────────────────────────────────
    const streakScore = Math.round(Math.min(100, (currentStreak / 7) * 100));
    const streakValueText = `${currentStreak} ${currentStreak === 1 ? 'day' : 'days'}`;
    const streakTargetText = '7 days';
    const streakExplanation = `Your current check-in streak is ${currentStreak} consecutive ${currentStreak === 1 ? 'day' : 'days'}. Logging daily habits locks in score points.`;

    // ─────────────────────────────────────────────────────────────────
    // OVERALL HEALTH SCORE CALCULATION
    // ─────────────────────────────────────────────────────────────────
    const totalScore = Math.round(
      0.25 * goalScore +
      0.20 * activityScore +
      0.20 * consistencyScore +
      0.15 * hydrationScore +
      0.05 * energyScore +
      0.15 * streakScore
    );

    // Determine category rating
    let rating = 'Needs Attention';
    if (totalScore >= 90) rating = 'Elite';
    else if (totalScore >= 80) rating = 'Excellent';
    else if (totalScore >= 70) rating = 'Good';
    else if (totalScore >= 60) rating = 'Fair';

    // ─────────────────────────────────────────────────────────────────
    // DETERMINISTIC ACTION SUGGESTIONS & POINTS CALCULATION
    // ─────────────────────────────────────────────────────────────────
    const tips = [];
    
    if (stepsPart < 100) {
      const stepsRem = 10000 - stepsLogged;
      const stepPts = Math.round((0.20 * 0.60 * (stepsRem / 10000) * 100) * 10) / 10;
      if (stepPts > 0) {
        tips.push({ tip: `Walk ${stepsRem.toLocaleString()} more steps today`, points: stepPts });
      }
    }
    
    if (durationPart < 100) {
      const durRem = 30 - durationLogged;
      const durPts = Math.round((0.20 * 0.40 * (durRem / 30) * 100) * 10) / 10;
      if (durPts > 0) {
        tips.push({ tip: `Exercise for ${durRem} more minutes today`, points: durPts });
      }
    }
    
    if (completedWorkoutsThisWeek < 3) {
      const consistencyPts = Math.round((0.20 * (1 / 3) * 100) * 10) / 10;
      tips.push({ tip: `Complete your next workout session this week`, points: consistencyPts });
    }
    
    if (waterL < 3.0) {
      const waterRem = parseFloat((3.0 - waterL).toFixed(1));
      const waterPts = Math.round((0.15 * (waterRem / 3.0) * 100) * 10) / 10;
      if (waterPts > 0) {
        tips.push({ tip: `Drink ${waterRem} L more water today`, points: waterPts });
      }
    }
    
    if (currentStreak < 7) {
      const streakPts = Math.round((0.15 * (1 / 7) * 100) * 10) / 10;
      tips.push({ tip: `Log check-in tomorrow to advance streak`, points: streakPts });
    }
    
    if (!activeGoal) {
      tips.push({ tip: `Set an active fitness or weight goal`, points: 10.0 });
    }

    res.json({
      success: true,
      healthScore: totalScore,
      rating,
      breakdown: {
        goalProgress: {
          score: goalScore,
          weight: 25,
          value: goalValueText,
          target: goalTargetText,
          explanation: goalExplanation
        },
        dailyActivity: {
          score: activityScore,
          weight: 20,
          value: activityValueText,
          target: activityTargetText,
          explanation: activityExplanation
        },
        workoutConsistency: {
          score: consistencyScore,
          weight: 20,
          value: consistencyValueText,
          target: consistencyTargetText,
          explanation: consistencyExplanation
        },
        hydration: {
          score: hydrationScore,
          weight: 15,
          value: hydrationValueText,
          target: hydrationTargetText,
          explanation: hydrationExplanation
        },
        energyLevels: {
          score: energyScore,
          weight: 5,
          value: energyValueText,
          target: energyTargetText,
          explanation: energyExplanation
        },
        checkinStreaks: {
          score: streakScore,
          weight: 15,
          value: streakValueText,
          target: streakTargetText,
          explanation: streakExplanation
        }
      },
      tips
    });

  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ─── Recommendation Engine: Deterministic Rule-Based Calculations (Phase 7) ──────
app.get('/api/recommendations', async (req, res) => {
  if (!req.session.user)
    return res.json({ success: false, message: 'Not logged in.' });

  try {
    const userId = req.session.user.id;
    const todayStr = getLocalDateString(new Date());

    // 1. Fetch active goal
    const goalRes = await pool.query(
      `SELECT * FROM goals WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [userId]
    );
    const activeGoal = goalRes.rows.length > 0 ? goalRes.rows[0] : null;

    // 2. Fetch today's check-in
    const todayLogRes = await pool.query(
      `SELECT * FROM progress_logs
       WHERE user_id = $1 AND log_date = $2 LIMIT 1`,
      [userId, todayStr]
    );
    const todayLog = todayLogRes.rows.length > 0 ? todayLogRes.rows[0] : null;

    // 3. Fetch all check-in dates for streak calculations
    const datesRes = await pool.query(
      `SELECT DISTINCT log_date::text FROM progress_logs
       WHERE user_id = $1
       ORDER BY log_date::text ASC`,
      [userId]
    );
    const logDates = datesRes.rows.map(row => row.log_date);
    const { currentStreak } = calculateStreaks(logDates);

    // 4. Fetch past 7 days logs for consistency calculations
    const last7DaysRes = await pool.query(
      `SELECT workout_completed FROM progress_logs
       WHERE user_id = $1 AND log_date >= CURRENT_DATE - INTERVAL '6 days'
       AND workout_completed = TRUE`,
      [userId]
    );
    const completedWorkoutsThisWeek = last7DaysRes.rows.length;

    // 5. Fetch 30-day energy levels average
    const energyAvgRes = await pool.query(
      `SELECT AVG(energy_level) as avg_energy FROM progress_logs
       WHERE user_id = $1 AND log_date >= CURRENT_DATE - INTERVAL '29 days'
       AND energy_level IS NOT NULL`,
      [userId]
    );
    const avgEnergy = energyAvgRes.rows.length > 0 && energyAvgRes.rows[0].avg_energy !== null
      ? parseFloat(energyAvgRes.rows[0].avg_energy)
      : 3.0;

    // 6. Fetch 30-day logs
    const logsRes = await pool.query(
      `SELECT log_date::text, weight FROM progress_logs
       WHERE user_id = $1 AND log_date >= CURRENT_DATE - INTERVAL '29 days'
       AND weight IS NOT NULL
       ORDER BY log_date ASC`,
      [userId]
    );
    const weightHistory = logsRes.rows.map(row => ({
      log_date: row.log_date,
      weight: parseFloat(row.weight)
    }));

    // 7. Fetch latest weight
    const latestWeightRes = await pool.query(
      `SELECT weight FROM progress_logs
       WHERE user_id = $1 AND weight IS NOT NULL
       ORDER BY log_date DESC, created_at DESC LIMIT 1`,
      [userId]
    );
    const sw = activeGoal ? parseFloat(activeGoal.start_weight) : null;
    const tw = activeGoal ? parseFloat(activeGoal.target_weight) : null;
    const currentWeight = latestWeightRes.rows.length > 0
      ? parseFloat(latestWeightRes.rows[0].weight)
      : (sw || null);

    // Calculate components to get current health score
    let goalScore = 60;
    if (activeGoal) {
      if (activeGoal.goal_type === 'maintenance') {
        const deviation = Math.abs(currentWeight - tw);
        if (deviation <= 2) goalScore = 100;
        else goalScore = Math.max(0, Math.round(100 - (deviation - 2) * 10));
      } else {
        const targetDate = new Date(activeGoal.target_date);
        const today = new Date(); today.setHours(0,0,0,0);
        const daysRemaining = Math.max(0, Math.round((targetDate - today) / (1000 * 60 * 60 * 24)));
        const weightLogsCount = weightHistory.length;
        let weeklyRate = 0;
        let isMovingTowardsGoal = false;
        let rateTowardsGoal = 0;
        
        if (weightLogsCount >= 2) {
          const earliest = weightHistory[0];
          const latest = weightHistory[weightLogsCount - 1];
          const dateDiffDays = Math.round((new Date(latest.log_date) - new Date(earliest.log_date)) / (1000 * 60 * 60 * 24));
          if (dateDiffDays >= 3) {
            const weightDiff = latest.weight - earliest.weight;
            weeklyRate = Math.round((weightDiff / dateDiffDays * 7) * 100) / 100;
            if (activeGoal.goal_type === 'weight_loss' && weeklyRate < 0) {
              isMovingTowardsGoal = true;
              rateTowardsGoal = -weeklyRate;
            } else if (activeGoal.goal_type === 'muscle_gain' && weeklyRate > 0) {
              isMovingTowardsGoal = true;
              rateTowardsGoal = weeklyRate;
            }
          }
        }
        if (isMovingTowardsGoal && rateTowardsGoal > 0) {
          const weightRemaining = Math.abs(currentWeight - tw);
          const estDaysRemaining = Math.ceil(weightRemaining / (rateTowardsGoal / 7));
          const daysDifference = daysRemaining - estDaysRemaining;
          if (daysDifference >= -3) goalScore = 100;
          else goalScore = Math.max(20, Math.round(100 - Math.abs(daysDifference) * 2));
        } else {
          goalScore = 60;
        }
      }
    } else {
      goalScore = 40;
    }

    const stepsLogged = todayLog ? parseInt(todayLog.steps_count || 0, 10) : 0;
    const durationLogged = todayLog ? parseInt(todayLog.workout_duration_mins || 0, 10) : 0;
    const stepsPart = Math.min(100, (stepsLogged / 10000) * 100);
    const durationPart = Math.min(100, (durationLogged / 30) * 100);
    const activityScore = Math.round(0.60 * stepsPart + 0.40 * durationPart);

    const consistencyScore = Math.round(Math.min(100, (completedWorkoutsThisWeek / 3) * 100));

    const waterMl = todayLog ? parseInt(todayLog.water_intake_ml || 0, 10) : 0;
    const waterL = parseFloat((waterMl / 1000).toFixed(2));
    const hydrationScore = Math.round(Math.min(100, (waterL / 3.0) * 100));

    const energyVal = todayLog ? todayLog.energy_level : null;
    const finalEnergy = energyVal !== null ? energyVal : avgEnergy;
    const energyScore = Math.round((finalEnergy / 5) * 100);

    const streakScore = Math.round(Math.min(100, (currentStreak / 7) * 100));

    const totalScore = Math.round(
      0.25 * goalScore +
      0.20 * activityScore +
      0.20 * consistencyScore +
      0.15 * hydrationScore +
      0.05 * energyScore +
      0.15 * streakScore
    );

    // RECOMMENDATIONS GENERATION
    const recommendations = [];

    const isNewUser = (logDates.length === 0 && !activeGoal);

    if (isNewUser) {
      recommendations.push({
        category: 'goal_progress',
        priority: 'high',
        title: 'Onboarding: Create Your Health Goal',
        description: 'Welcome to MapMyHealth! Set a weight loss, muscle gain, or maintenance target weight to structure your journey.',
        expectedBenefit: 'Unlocks Goal Progress tracking, forecast projections, and activates your Health Score.'
      });
      recommendations.push({
        category: 'consistency',
        priority: 'high',
        title: 'Onboarding: Complete Your First Check-In',
        description: 'Establishing a daily logging habit is key. Submit today\'s check-in to start your streak and seed your progress charts.',
        expectedBenefit: 'Initiates your check-in streak and feeds metrics to your forecasting engine.'
      });
      recommendations.push({
        category: 'activity',
        priority: 'high',
        title: 'Onboarding: Establish a Daily Step Habit',
        description: 'Aim for a target of 10,000 steps daily. Track your progress by logging daily movement in check-ins.',
        expectedBenefit: 'Sets a baseline cardio index and increases your activity score component.'
      });
      recommendations.push({
        category: 'hydration',
        priority: 'medium',
        title: 'Onboarding: Aim for 3.0 L Daily Water',
        description: 'Begin tracking hydration by logging water intake. Try to hit a baseline target of 3.0 Liters per day.',
        expectedBenefit: 'Maintains optimal blood volume, aids digestion, and keeps cellular performance high.'
      });
      recommendations.push({
        category: 'recovery',
        priority: 'medium',
        title: 'Onboarding: Track Sleep & Vitality',
        description: 'Monitor your subjective energy levels and match physical efforts with 7-8 hours of quality sleep.',
        expectedBenefit: 'Stabilizes central nervous system fatigue and improves daily energy levels.'
      });
    } else {
      // 1. Goal Progress
      if (!activeGoal) {
        recommendations.push({
          category: 'goal_progress',
          priority: 'high',
          title: 'Set an Active Health Goal',
          description: 'You do not have an active goal. Setting a target weight or maintenance goal provides a clear endpoint for your health journey.',
          expectedBenefit: 'Unlocks Goal Progress score tracking and adds structure to your health score roadmap.'
        });
      } else if (activeGoal.goal_type === 'maintenance') {
        const deviation = Math.abs(currentWeight - tw);
        if (deviation > 2) {
          recommendations.push({
            category: 'goal_progress',
            priority: deviation > 5 ? 'high' : 'medium',
            title: 'Realign to Weight Maintenance Target',
            description: `Your weight (${currentWeight.toFixed(1)} kg) deviates from your maintenance target of ${tw} kg by ${deviation.toFixed(1)} kg (zone is +/- 2 kg).`,
            expectedBenefit: 'Improves skeletal stability, controls body fat distribution, and restores your Goal Progress score component.'
          });
        } else {
          recommendations.push({
            category: 'goal_progress',
            priority: 'low',
            title: 'Maintain Current Weight Trajectory',
            description: `Your current weight (${currentWeight.toFixed(1)} kg) is within your stability target zone (+/- 2 kg of ${tw} kg).`,
            expectedBenefit: 'Maintains optimal energy balance and skeletal stability.'
          });
        }
      } else {
        const startDate = new Date(activeGoal.start_date);
        const targetDate = new Date(activeGoal.target_date);
        const today = new Date(); today.setHours(0,0,0,0);
        const daysRemaining = Math.max(0, Math.round((targetDate - today) / (1000 * 60 * 60 * 24)));
        const weightLogsCount = weightHistory.length;
        let weeklyRate = 0;
        let isMovingTowardsGoal = false;
        let rateTowardsGoal = 0;
        
        if (weightLogsCount >= 2) {
          const earliest = weightHistory[0];
          const latest = weightHistory[weightLogsCount - 1];
          const dateDiffDays = Math.round((new Date(latest.log_date) - new Date(earliest.log_date)) / (1000 * 60 * 60 * 24));
          if (dateDiffDays >= 3) {
            const weightDiff = latest.weight - earliest.weight;
            weeklyRate = Math.round((weightDiff / dateDiffDays * 7) * 100) / 100;
            if (activeGoal.goal_type === 'weight_loss' && weeklyRate < 0) {
              isMovingTowardsGoal = true;
              rateTowardsGoal = -weeklyRate;
            } else if (activeGoal.goal_type === 'muscle_gain' && weeklyRate > 0) {
              isMovingTowardsGoal = true;
              rateTowardsGoal = weeklyRate;
            }
          }
        }

        if (isMovingTowardsGoal && rateTowardsGoal > 0) {
          const weightRemaining = Math.abs(currentWeight - tw);
          const estDaysRemaining = Math.ceil(weightRemaining / (rateTowardsGoal / 7));
          const daysDifference = daysRemaining - estDaysRemaining;
          
          if (daysDifference >= -3) {
            if (daysDifference > 15 && rateTowardsGoal > 1.5 && activeGoal.goal_type === 'weight_loss') {
              recommendations.push({
                category: 'goal_progress',
                priority: 'low',
                title: 'Moderate Weight Progress Pace',
                description: `You are ${daysDifference} days ahead of schedule with a rate of ${rateTowardsGoal.toFixed(2)} kg/week. Slowing down ensures changes are sustainable.`,
                expectedBenefit: 'Preserves lean muscle mass and avoids physical fatigue or metabolic crash.'
              });
            } else {
              recommendations.push({
                category: 'goal_progress',
                priority: 'low',
                title: 'Maintain Current Weight Trajectory',
                description: `Your weight velocity (${rateTowardsGoal.toFixed(2)} kg/week) is perfectly on track with your target goal schedule.`,
                expectedBenefit: 'Ensures you reach your goal weight safely and predictably.'
              });
            }
          } else {
            const behindDays = Math.abs(daysDifference);
            recommendations.push({
              category: 'goal_progress',
              priority: behindDays > 10 ? 'high' : 'medium',
              title: activeGoal.goal_type === 'weight_loss' ? 'Increase Weight Velocity Pace' : 'Increase Muscle Weight Pace',
              description: `Your weight velocity is currently behind schedule by ${Math.round(behindDays)} days. Your current rate is ${weeklyRate > 0 ? '+' : ''}${weeklyRate} kg/week.`,
              expectedBenefit: `Puts you back on track to hit your goal of ${tw} kg by your target date of ${getLocalDateString(targetDate)}.`
            });
          }
        } else {
          recommendations.push({
            category: 'goal_progress',
            priority: 'medium',
            title: activeGoal.goal_type === 'weight_loss' ? 'Accelerate Weight Loss Progress' : 'Accelerate Muscle Gain Progress',
            description: weightLogsCount < 2 
              ? 'Insufficient logs to determine schedule velocity. Log weight at least twice over a 3-day window.' 
              : `Your weight trend (${weeklyRate > 0 ? '+' : ''}${weeklyRate} kg/week) is stable or moving away from your goal parameters.`,
            expectedBenefit: 'Re-aligns metabolic output to resume weight trajectory towards goal.'
          });
        }
      }

      // 2. Activity
      if (stepsLogged < 2000) {
        const stepsRem = 10000 - stepsLogged;
        recommendations.push({
          category: 'activity',
          priority: 'high',
          title: 'Activate Daily Movement',
          description: stepsLogged === 0 
            ? 'No steps logged today. Start walking to build cardiovascular momentum.'
            : `You have only logged ${stepsLogged.toLocaleString()} steps today. Walk ${stepsRem.toLocaleString()} more steps to hit your daily goal.`,
          expectedBenefit: 'Triggers active calorie burn, boosts circulation, and increases activity score component.'
        });
      } else if (stepsLogged < 4000) {
        const stepsRem = 10000 - stepsLogged;
        recommendations.push({
          category: 'activity',
          priority: 'medium',
          title: 'Increase Daily Step Count',
          description: `You have logged ${stepsLogged.toLocaleString()} steps today. Walk ${stepsRem.toLocaleString()} more steps to hit your 10,000 step goal.`,
          expectedBenefit: 'Improves aerobic fitness, enhances active recovery, and increases activity score component.'
        });
      } else if (stepsLogged < 10000) {
        const stepsRem = 10000 - stepsLogged;
        recommendations.push({
          category: 'activity',
          priority: 'low',
          title: 'Optimize Daily Step Target',
          description: `You are at ${stepsLogged.toLocaleString()} steps today. Walk ${stepsRem.toLocaleString()} more steps to reach full optimization.`,
          expectedBenefit: 'Maximizes step-points and locks in consistent daily movement patterns.'
        });
      } else {
        recommendations.push({
          category: 'activity',
          priority: 'low',
          title: 'Maintain Active Movement Habit',
          description: 'Excellent! You met or exceeded your 10,000 steps daily target today.',
          expectedBenefit: 'Supports cardiorespiratory health and preserves your 100% daily activity score.'
        });
      }

      // 3. Hydration
      if (waterL < 1.5) {
        recommendations.push({
          category: 'hydration',
          priority: 'high',
          title: 'Increase Hydration Immediately',
          description: `Water intake is critically low at ${waterL} L. Drink 6-8 glasses of water to support cellular hydration.`,
          expectedBenefit: 'Boosts energy, improves cognitive clarity, and increases Health Score by up to 7.5 points.'
        });
      } else if (waterL < 3.0) {
        const waterRem = parseFloat((3.0 - waterL).toFixed(1));
        recommendations.push({
          category: 'hydration',
          priority: 'medium',
          title: 'Increase Daily Water Intake',
          description: `You have consumed ${waterL} L of water today. Drink approximately ${waterRem} L more to reach your daily goal.`,
          expectedBenefit: 'Supports metabolic detoxification and helps secure maximum hydration score.'
        });
      } else {
        recommendations.push({
          category: 'hydration',
          priority: 'low',
          title: 'Maintain Hydration Habits',
          description: 'Great job! You met your 3.0 L daily hydration goal.',
          expectedBenefit: 'Maintains cellular volume, aids digestion, and preserves hydration score at 100%.'
        });
      }

      // 4. Recovery (Combining Energy & Workouts)
      const energyLabels = { 1: 'Exhausted', 2: 'Tired', 3: 'Normal', 4: 'Energetic', 5: 'Peak' };
      if ((energyVal !== null && energyVal <= 2) || (energyVal === null && avgEnergy <= 2.5)) {
        if (completedWorkoutsThisWeek >= 4) {
          recommendations.push({
            category: 'recovery',
            priority: 'high',
            title: 'Immediate Rest & Active Recovery',
            description: `Your energy is rated as low (${finalEnergy.toFixed(1)}/5) and you have trained intensely with ${completedWorkoutsThisWeek} workouts this week. Your nervous system needs rest.`,
            expectedBenefit: 'Prevents acute muscle strain, lowers systemic fatigue, and protects long-term metabolic health.'
          });
        } else {
          recommendations.push({
            category: 'recovery',
            priority: 'high',
            title: 'Prioritize Quality Sleep & Rest',
            description: `Your energy level is rated as ${energyLabels[Math.round(finalEnergy)]} (${finalEnergy.toFixed(1)}/5). Ensure you get 7-8 hours of sleep tonight and avoid intense exertion.`,
            expectedBenefit: 'Lowers circulating cortisol, initiates hormone recovery, and restores basic daily vitality.'
          });
        }
      } else if (completedWorkoutsThisWeek >= 5) {
        recommendations.push({
          category: 'recovery',
          priority: 'medium',
          title: 'Schedule a Planned Rest Day',
          description: `You have completed ${completedWorkoutsThisWeek} workouts in the last 7 days. Even with good energy, continuous training without rest increases injury risk.`,
          expectedBenefit: 'Allows supercompensation, repairs microtears, and maintains metabolic performance.'
        });
      } else if (finalEnergy === 3) {
        recommendations.push({
          category: 'recovery',
          priority: 'low',
          title: 'Active Recovery & Mobility',
          description: 'Energy is at a stable baseline (3/5). Support muscle regeneration with light mobility drills, hydration, and stretching.',
          expectedBenefit: 'Increases blood flow to recovering tissues and maintains joint flexibility.'
        });
      } else {
        recommendations.push({
          category: 'recovery',
          priority: 'low',
          title: 'Optimal Recovery Status',
          description: 'Excellent balance of energy and training consistency. Your recovery capacity matches your active workload.',
          expectedBenefit: 'Supports consistent training progression without risk of overtraining.'
        });
      }

      // 5. Consistency
      if (!todayLog) {
        recommendations.push({
          category: 'consistency',
          priority: currentStreak > 0 ? 'high' : 'medium',
          title: currentStreak > 0 ? 'Protect Check-In Streak' : 'Establish Daily Logging Habits',
          description: 'You haven\'t logged your metrics today. Fill out your check-in card to keep your dashboard records active.',
          expectedBenefit: `Protects your check-in streak of ${currentStreak} days and feeds data to your forecasting engine.`
        });
      } else if (completedWorkoutsThisWeek < 3) {
        const workoutsRem = 3 - completedWorkoutsThisWeek;
        recommendations.push({
          category: 'consistency',
          priority: 'medium',
          title: 'Build Workout Consistency',
          description: `Completed ${completedWorkoutsThisWeek} workouts this week. Try to complete ${workoutsRem} more sessions to hit your target of 3.`,
          expectedBenefit: 'Improves general physical fitness and raises consistency score component.'
        });
      } else if (currentStreak >= 3 && currentStreak < 7) {
        const streakRem = 7 - currentStreak;
        recommendations.push({
          category: 'consistency',
          priority: 'low',
          title: 'Secure 7-Day Streak Bonus',
          description: `You have logged ${currentStreak} consecutive days. Log ${streakRem} more days to secure your 7-day bonus.`,
          expectedBenefit: 'Builds lasting habit loops and locks in check-in streak score points.'
        });
      } else {
        recommendations.push({
          category: 'consistency',
          priority: 'low',
          title: 'Maintain Logging Habits',
          description: `Fantastic! You are on a ${currentStreak}-day check-in streak.`,
          expectedBenefit: 'Maintains maximum check-in streak score and ensures uninterrupted weight trend data.'
        });
      }
    }

    // Sort by Priority: High -> Medium -> Low
    const priorityWeights = { high: 3, medium: 2, low: 1 };
    recommendations.sort((a, b) => priorityWeights[b.priority] - priorityWeights[a.priority]);

    res.json({
      success: true,
      healthScore: totalScore,
      recommendations
    });

  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ─── AI Coach: Deterministic NLP-based Explanation Engine (Phase 8) ──────
app.get('/api/coach', async (req, res) => {
  if (!req.session.user)
    return res.json({ success: false, message: 'Not logged in.' });

  try {
    const userId = req.session.user.id;
    const todayStr = getLocalDateString(new Date());

    // 1. Fetch active goal
    const goalRes = await pool.query(
      `SELECT * FROM goals WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [userId]
    );
    const activeGoal = goalRes.rows.length > 0 ? goalRes.rows[0] : null;

    // 2. Fetch today's check-in
    const todayLogRes = await pool.query(
      `SELECT * FROM progress_logs
       WHERE user_id = $1 AND log_date = $2 LIMIT 1`,
      [userId, todayStr]
    );
    const todayLog = todayLogRes.rows.length > 0 ? todayLogRes.rows[0] : null;

    // 3. Fetch all check-in dates for streak calculations
    const datesRes = await pool.query(
      `SELECT DISTINCT log_date::text FROM progress_logs
       WHERE user_id = $1
       ORDER BY log_date::text ASC`,
      [userId]
    );
    const logDates = datesRes.rows.map(row => row.log_date);
    const { currentStreak } = calculateStreaks(logDates);

    // 4. Fetch past 7 days logs for consistency calculations
    const last7DaysRes = await pool.query(
      `SELECT workout_completed FROM progress_logs
       WHERE user_id = $1 AND log_date >= CURRENT_DATE - INTERVAL '6 days'
       AND workout_completed = TRUE`,
      [userId]
    );
    const completedWorkoutsThisWeek = last7DaysRes.rows.length;

    // 5. Fetch 30-day energy levels average
    const energyAvgRes = await pool.query(
      `SELECT AVG(energy_level) as avg_energy FROM progress_logs
       WHERE user_id = $1 AND log_date >= CURRENT_DATE - INTERVAL '29 days'
       AND energy_level IS NOT NULL`,
      [userId]
    );
    const avgEnergy = energyAvgRes.rows.length > 0 && energyAvgRes.rows[0].avg_energy !== null
      ? parseFloat(energyAvgRes.rows[0].avg_energy)
      : 3.0;

    // 6. Fetch 30-day logs
    const logsRes = await pool.query(
      `SELECT log_date::text, weight FROM progress_logs
       WHERE user_id = $1 AND log_date >= CURRENT_DATE - INTERVAL '29 days'
       AND weight IS NOT NULL
       ORDER BY log_date ASC`,
      [userId]
    );
    const weightHistory = logsRes.rows.map(row => ({
      log_date: row.log_date,
      weight: parseFloat(row.weight)
    }));

    // 7. Fetch latest weight
    const latestWeightRes = await pool.query(
      `SELECT weight FROM progress_logs
       WHERE user_id = $1 AND weight IS NOT NULL
       ORDER BY log_date DESC, created_at DESC LIMIT 1`,
      [userId]
    );
    const sw = activeGoal ? parseFloat(activeGoal.start_weight) : null;
    const tw = activeGoal ? parseFloat(activeGoal.target_weight) : null;
    const currentWeight = latestWeightRes.rows.length > 0
      ? parseFloat(latestWeightRes.rows[0].weight)
      : (sw || null);

    // Health Score Components
    let goalScore = 60;
    let daysDifference = 0;
    let estDaysRemaining = 0;
    let weeklyRate = 0;
    let isMovingTowardsGoal = false;
    let rateTowardsGoal = 0;

    if (activeGoal) {
      if (activeGoal.goal_type === 'maintenance') {
        const deviation = Math.abs(currentWeight - tw);
        if (deviation <= 2) goalScore = 100;
        else goalScore = Math.max(0, Math.round(100 - (deviation - 2) * 10));
      } else {
        const targetDate = new Date(activeGoal.target_date);
        const today = new Date(); today.setHours(0,0,0,0);
        const daysRemaining = Math.max(0, Math.round((targetDate - today) / (1000 * 60 * 60 * 24)));
        const weightLogsCount = weightHistory.length;
        
        if (weightLogsCount >= 2) {
          const earliest = weightHistory[0];
          const latest = weightHistory[weightLogsCount - 1];
          const dateDiffDays = Math.round((new Date(latest.log_date) - new Date(earliest.log_date)) / (1000 * 60 * 60 * 24));
          if (dateDiffDays >= 3) {
            const weightDiff = latest.weight - earliest.weight;
            weeklyRate = Math.round((weightDiff / dateDiffDays * 7) * 100) / 100;
            if (activeGoal.goal_type === 'weight_loss' && weeklyRate < 0) {
              isMovingTowardsGoal = true;
              rateTowardsGoal = -weeklyRate;
            } else if (activeGoal.goal_type === 'muscle_gain' && weeklyRate > 0) {
              isMovingTowardsGoal = true;
              rateTowardsGoal = weeklyRate;
            }
          }
        }
        if (isMovingTowardsGoal && rateTowardsGoal > 0) {
          const weightRemaining = Math.abs(currentWeight - tw);
          estDaysRemaining = Math.ceil(weightRemaining / (rateTowardsGoal / 7));
          daysDifference = daysRemaining - estDaysRemaining;
          if (daysDifference >= -3) goalScore = 100;
          else goalScore = Math.max(20, Math.round(100 - Math.abs(daysDifference) * 2));
        } else {
          goalScore = 60;
        }
      }
    } else {
      goalScore = 40;
    }

    const stepsLogged = todayLog ? parseInt(todayLog.steps_count || 0, 10) : 0;
    const durationLogged = todayLog ? parseInt(todayLog.workout_duration_mins || 0, 10) : 0;
    const stepsPart = Math.min(100, (stepsLogged / 10000) * 100);
    const durationPart = Math.min(100, (durationLogged / 30) * 100);
    const activityScore = Math.round(0.60 * stepsPart + 0.40 * durationPart);

    const consistencyScore = Math.round(Math.min(100, (completedWorkoutsThisWeek / 3) * 100));

    const waterMl = todayLog ? parseInt(todayLog.water_intake_ml || 0, 10) : 0;
    const waterL = parseFloat((waterMl / 1000).toFixed(2));
    const hydrationScore = Math.round(Math.min(100, (waterL / 3.0) * 100));

    const energyVal = todayLog ? todayLog.energy_level : null;
    const finalEnergy = energyVal !== null ? energyVal : avgEnergy;
    const energyScore = Math.round((finalEnergy / 5) * 100);

    const streakScore = Math.round(Math.min(100, (currentStreak / 7) * 100));

    const totalScore = Math.round(
      0.25 * goalScore +
      0.20 * activityScore +
      0.20 * consistencyScore +
      0.15 * hydrationScore +
      0.05 * energyScore +
      0.15 * streakScore
    );

    let rating = 'Needs Attention';
    if (totalScore >= 90) rating = 'Elite';
    else if (totalScore >= 80) rating = 'Excellent';
    else if (totalScore >= 70) rating = 'Good';
    else if (totalScore >= 60) rating = 'Fair';

    // RECOMMENDATIONS GENERATION
    const recommendations = [];
    const isNewUser = (logDates.length === 0 && !activeGoal);

    if (isNewUser) {
      recommendations.push({
        category: 'goal_progress',
        priority: 'high',
        title: 'Onboarding: Create Your Health Goal',
        description: 'Welcome to MapMyHealth! Set a weight loss, muscle gain, or maintenance target weight to structure your journey.',
        expectedBenefit: 'Unlocks Goal Progress tracking, forecast projections, and activates your Health Score.'
      });
      recommendations.push({
        category: 'consistency',
        priority: 'high',
        title: 'Onboarding: Complete Your First Check-In',
        description: 'Establishing a daily logging habit is key. Submit today\'s check-in to start your streak and seed your progress charts.',
        expectedBenefit: 'Initiates your check-in streak and feeds metrics to your forecasting engine.'
      });
      recommendations.push({
        category: 'activity',
        priority: 'high',
        title: 'Onboarding: Establish a Daily Step Habit',
        description: 'Aim for a target of 10,000 steps daily. Track your progress by logging daily movement in check-ins.',
        expectedBenefit: 'Sets a baseline cardio index and increases your activity score component.'
      });
      recommendations.push({
        category: 'hydration',
        priority: 'medium',
        title: 'Onboarding: Aim for 3.0 L Daily Water',
        description: 'Begin tracking hydration by logging water intake. Try to hit a baseline target of 3.0 Liters per day.',
        expectedBenefit: 'Maintains optimal blood volume, aids digestion, and keeps cellular performance high.'
      });
      recommendations.push({
        category: 'recovery',
        priority: 'medium',
        title: 'Onboarding: Track Sleep & Vitality',
        description: 'Monitor your subjective energy levels and match physical efforts with 7-8 hours of quality sleep.',
        expectedBenefit: 'Stabilizes central nervous system fatigue and improves daily energy levels.'
      });
    } else {
      // 1. Goal Progress
      if (!activeGoal) {
        recommendations.push({
          category: 'goal_progress',
          priority: 'high',
          title: 'Set an Active Health Goal',
          description: 'You do not have an active goal. Setting a target weight or maintenance goal provides a clear endpoint for your health journey.',
          expectedBenefit: 'Unlocks Goal Progress score tracking and adds structure to your health score roadmap.'
        });
      } else if (activeGoal.goal_type === 'maintenance') {
        const deviation = Math.abs(currentWeight - tw);
        if (deviation > 2) {
          recommendations.push({
            category: 'goal_progress',
            priority: deviation > 5 ? 'high' : 'medium',
            title: 'Realign to Weight Maintenance Target',
            description: `Your weight (${currentWeight.toFixed(1)} kg) deviates from your maintenance target of ${tw} kg by ${deviation.toFixed(1)} kg (zone is +/- 2 kg).`,
            expectedBenefit: 'Improves skeletal stability, controls body fat distribution, and restores your Goal Progress score component.'
          });
        } else {
          recommendations.push({
            category: 'goal_progress',
            priority: 'low',
            title: 'Maintain Current Weight Trajectory',
            description: `Your current weight (${currentWeight.toFixed(1)} kg) is within your stability target zone (+/- 2 kg of ${tw} kg).`,
            expectedBenefit: 'Maintains optimal energy balance and skeletal stability.'
          });
        }
      } else {
        const startDate = new Date(activeGoal.start_date);
        const targetDate = new Date(activeGoal.target_date);
        const today = new Date(); today.setHours(0,0,0,0);
        const daysRemaining = Math.max(0, Math.round((targetDate - today) / (1000 * 60 * 60 * 24)));
        const weightLogsCount = weightHistory.length;
        let weeklyRate = 0;
        let isMovingTowardsGoal = false;
        let rateTowardsGoal = 0;
        
        if (weightLogsCount >= 2) {
          const earliest = weightHistory[0];
          const latest = weightHistory[weightLogsCount - 1];
          const dateDiffDays = Math.round((new Date(latest.log_date) - new Date(earliest.log_date)) / (1000 * 60 * 60 * 24));
          if (dateDiffDays >= 3) {
            const weightDiff = latest.weight - earliest.weight;
            weeklyRate = Math.round((weightDiff / dateDiffDays * 7) * 100) / 100;
            if (activeGoal.goal_type === 'weight_loss' && weeklyRate < 0) {
              isMovingTowardsGoal = true;
              rateTowardsGoal = -weeklyRate;
            } else if (activeGoal.goal_type === 'muscle_gain' && weeklyRate > 0) {
              isMovingTowardsGoal = true;
              rateTowardsGoal = weeklyRate;
            }
          }
        }

        if (isMovingTowardsGoal && rateTowardsGoal > 0) {
          const weightRemaining = Math.abs(currentWeight - tw);
          const estDaysRemaining = Math.ceil(weightRemaining / (rateTowardsGoal / 7));
          const daysDifference = daysRemaining - estDaysRemaining;
          
          if (daysDifference >= -3) {
            if (daysDifference > 15 && rateTowardsGoal > 1.5 && activeGoal.goal_type === 'weight_loss') {
              recommendations.push({
                category: 'goal_progress',
                priority: 'low',
                title: 'Moderate Weight Progress Pace',
                description: `You are ${daysDifference} days ahead of schedule with a rate of ${rateTowardsGoal.toFixed(2)} kg/week. Slowing down ensures changes are sustainable.`,
                expectedBenefit: 'Preserves lean muscle mass and avoids physical fatigue or metabolic crash.'
              });
            } else {
              recommendations.push({
                category: 'goal_progress',
                priority: 'low',
                title: 'Maintain Current Weight Trajectory',
                description: `Your weight velocity (${rateTowardsGoal.toFixed(2)} kg/week) is perfectly on track with your target goal schedule.`,
                expectedBenefit: 'Ensures you reach your goal weight safely and predictably.'
              });
            }
          } else {
            const behindDays = Math.abs(daysDifference);
            recommendations.push({
              category: 'goal_progress',
              priority: behindDays > 10 ? 'high' : 'medium',
              title: activeGoal.goal_type === 'weight_loss' ? 'Increase Weight Velocity Pace' : 'Increase Muscle Weight Pace',
              description: `Your weight velocity is currently behind schedule by ${Math.round(behindDays)} days. Your current rate is ${weeklyRate > 0 ? '+' : ''}${weeklyRate} kg/week.`,
              expectedBenefit: `Puts you back on track to hit your goal of ${tw} kg by your target date of ${getLocalDateString(targetDate)}.`
            });
          }
        } else {
          recommendations.push({
            category: 'goal_progress',
            priority: 'medium',
            title: activeGoal.goal_type === 'weight_loss' ? 'Accelerate Weight Loss Progress' : 'Accelerate Muscle Gain Progress',
            description: weightLogsCount < 2 
              ? 'Insufficient logs to determine schedule velocity. Log weight at least twice over a 3-day window.' 
              : `Your weight trend (${weeklyRate > 0 ? '+' : ''}${weeklyRate} kg/week) is stable or moving away from your goal parameters.`,
            expectedBenefit: 'Re-aligns metabolic output to resume weight trajectory towards goal.'
          });
        }
      }

      // 2. Activity
      if (stepsLogged < 2000) {
        const stepsRem = 10000 - stepsLogged;
        recommendations.push({
          category: 'activity',
          priority: 'high',
          title: 'Activate Daily Movement',
          description: stepsLogged === 0 
            ? 'No steps logged today. Start walking to build cardiovascular momentum.'
            : `You have only logged ${stepsLogged.toLocaleString()} steps today. Walk ${stepsRem.toLocaleString()} more steps to hit your daily goal.`,
          expectedBenefit: 'Triggers active calorie burn, boosts circulation, and increases activity score component.'
        });
      } else if (stepsLogged < 4000) {
        const stepsRem = 10000 - stepsLogged;
        recommendations.push({
          category: 'activity',
          priority: 'medium',
          title: 'Increase Daily Step Count',
          description: `You have logged ${stepsLogged.toLocaleString()} steps today. Walk ${stepsRem.toLocaleString()} more steps to hit your 10,000 step goal.`,
          expectedBenefit: 'Improves aerobic fitness, enhances active recovery, and increases activity score component.'
        });
      } else if (stepsLogged < 10000) {
        const stepsRem = 10000 - stepsLogged;
        recommendations.push({
          category: 'activity',
          priority: 'low',
          title: 'Optimize Daily Step Target',
          description: `You are at ${stepsLogged.toLocaleString()} steps today. Walk ${stepsRem.toLocaleString()} more steps to reach full optimization.`,
          expectedBenefit: 'Maximizes step-points and locks in consistent daily movement patterns.'
        });
      } else {
        recommendations.push({
          category: 'activity',
          priority: 'low',
          title: 'Maintain Active Movement Habit',
          description: 'Excellent! You met or exceeded your 10,000 steps daily target today.',
          expectedBenefit: 'Supports cardiorespiratory health and preserves your 100% daily activity score.'
        });
      }

      // 3. Hydration
      if (waterL < 1.5) {
        recommendations.push({
          category: 'hydration',
          priority: 'high',
          title: 'Increase Hydration Immediately',
          description: `Water intake is critically low at ${waterL} L. Drink 6-8 glasses of water to support cellular hydration.`,
          expectedBenefit: 'Boosts energy, improves cognitive clarity, and increases Health Score by up to 7.5 points.'
        });
      } else if (waterL < 3.0) {
        const waterRem = parseFloat((3.0 - waterL).toFixed(1));
        recommendations.push({
          category: 'hydration',
          priority: 'medium',
          title: 'Increase Daily Water Intake',
          description: `You have consumed ${waterL} L of water today. Drink approximately ${waterRem} L more to reach your daily goal.`,
          expectedBenefit: 'Supports metabolic detoxification and helps secure maximum hydration score.'
        });
      } else {
        recommendations.push({
          category: 'hydration',
          priority: 'low',
          title: 'Maintain Hydration Habits',
          description: 'Great job! You met your 3.0 L daily hydration goal.',
          expectedBenefit: 'Maintains cellular volume, aids digestion, and preserves hydration score at 100%.'
        });
      }

      // 4. Recovery (Combining Energy & Workouts)
      const energyLabels = { 1: 'Exhausted', 2: 'Tired', 3: 'Normal', 4: 'Energetic', 5: 'Peak' };
      if ((energyVal !== null && energyVal <= 2) || (energyVal === null && avgEnergy <= 2.5)) {
        if (completedWorkoutsThisWeek >= 4) {
          recommendations.push({
            category: 'recovery',
            priority: 'high',
            title: 'Immediate Rest & Active Recovery',
            description: `Your energy is rated as low (${finalEnergy.toFixed(1)}/5) and you have trained intensely with ${completedWorkoutsThisWeek} workouts this week. Your nervous system needs rest.`,
            expectedBenefit: 'Prevents acute muscle strain, lowers systemic fatigue, and protects long-term metabolic health.'
          });
        } else {
          recommendations.push({
            category: 'recovery',
            priority: 'high',
            title: 'Prioritize Quality Sleep & Rest',
            description: `Your energy level is rated as ${energyLabels[Math.round(finalEnergy)]} (${finalEnergy.toFixed(1)}/5). Ensure you get 7-8 hours of sleep tonight and avoid intense exertion.`,
            expectedBenefit: 'Lowers circulating cortisol, initiates hormone recovery, and restores basic daily vitality.'
          });
        }
      } else if (completedWorkoutsThisWeek >= 5) {
        recommendations.push({
          category: 'recovery',
          priority: 'medium',
          title: 'Schedule a Planned Rest Day',
          description: `You have completed ${completedWorkoutsThisWeek} workouts in the last 7 days. Even with good energy, continuous training without rest increases injury risk.`,
          expectedBenefit: 'Allows supercompensation, repairs microtears, and maintains metabolic performance.'
        });
      } else if (finalEnergy === 3) {
        recommendations.push({
          category: 'recovery',
          priority: 'low',
          title: 'Active Recovery & Mobility',
          description: 'Energy is at a stable baseline (3/5). Support muscle regeneration with light mobility drills, hydration, and stretching.',
          expectedBenefit: 'Increases blood flow to recovering tissues and maintains joint flexibility.'
        });
      } else {
        recommendations.push({
          category: 'recovery',
          priority: 'low',
          title: 'Optimal Recovery Status',
          description: 'Excellent balance of energy and training consistency. Your recovery capacity matches your active workload.',
          expectedBenefit: 'Supports consistent training progression without risk of overtraining.'
        });
      }

      // 5. Consistency
      if (!todayLog) {
        recommendations.push({
          category: 'consistency',
          priority: currentStreak > 0 ? 'high' : 'medium',
          title: currentStreak > 0 ? 'Protect Check-In Streak' : 'Establish Daily Logging Habits',
          description: 'You haven\'t logged your metrics today. Fill out your check-in card to keep your dashboard records active.',
          expectedBenefit: `Protects your check-in streak of ${currentStreak} days and feeds data to your forecasting engine.`
        });
      } else if (completedWorkoutsThisWeek < 3) {
        const workoutsRem = 3 - completedWorkoutsThisWeek;
        recommendations.push({
          category: 'consistency',
          priority: 'medium',
          title: 'Build Workout Consistency',
          description: `Completed ${completedWorkoutsThisWeek} workouts this week. Try to complete ${workoutsRem} more sessions to hit your target of 3.`,
          expectedBenefit: 'Improves general physical fitness and raises consistency score component.'
        });
      } else if (currentStreak >= 3 && currentStreak < 7) {
        const streakRem = 7 - currentStreak;
        recommendations.push({
          category: 'consistency',
          priority: 'low',
          title: 'Secure 7-Day Streak Bonus',
          description: `You have logged ${currentStreak} consecutive days. Log ${streakRem} more days to secure your 7-day bonus.`,
          expectedBenefit: 'Builds lasting habit loops and locks in check-in streak score points.'
        });
      } else {
        recommendations.push({
          category: 'consistency',
          priority: 'low',
          title: 'Maintain Logging Habits',
          description: `Fantastic! You are on a ${currentStreak}-day check-in streak.`,
          expectedBenefit: 'Maintains maximum check-in streak score and ensures uninterrupted weight trend data.'
        });
      }
    }

    const priorityWeights = { high: 3, medium: 2, low: 1 };
    recommendations.sort((a, b) => priorityWeights[b.priority] - priorityWeights[a.priority]);
    const topRec = recommendations.length > 0 ? recommendations[0] : null;

    // ─────────────────────────────────────────────────────────────────
    // DYNAMIC COACH DASHBOARD SUMMARIES
    // ─────────────────────────────────────────────────────────────────
    const categoryLabels = {
      goal_progress: 'Goal Progress',
      activity: 'Activity',
      hydration: 'Hydration',
      recovery: 'Recovery',
      consistency: 'Consistency'
    };

    let coachSummary = 'Your journey metrics look stable. Review your recommendations to begin optimizing your lifestyle scores.';
    let coachFocus = topRec ? `${topRec.title}: ${topRec.description}` : 'Maintain current habits.';
    let coachMotivation = 'Consistency is the cornerstone of sustainable health journey progression!';

    if (isNewUser) {
      coachSummary = 'Welcome to MapMyHealth! Your primary objective today is onboarding. Follow the coaching checklist to start tracking details.';
      coachFocus = 'Set your active health goal and log today\'s initial check-in statistics.';
      coachMotivation = 'Your health route starts here. Every tracking milestone makes progress clearer!';
    } else {
      if (totalScore >= 80) {
        coachSummary = `Outstanding work! You have achieved an ${rating} health status with a score of ${totalScore}. Your activity and recovery balance is highly optimized.`;
        coachMotivation = 'Keep pushing your limits. You are currently in the peak tier of wellness!';
      } else if (totalScore >= 70) {
        coachSummary = `Great progress! Your score is ${totalScore} (Good). You have a solid habit base, but a few minor tweaks will push you into the Excellent tier.`;
        coachMotivation = 'Focus on consistency today. Smaller actions compound into massive wins!';
      } else if (totalScore >= 60) {
        coachSummary = `Your score is ${totalScore} (Fair). Your habit structure is starting to align, but there are multiple opportunities to capture immediate score points.`;
        coachMotivation = 'Let\'s raise that score. Tackle the high-priority targets first!';
      } else {
        coachSummary = `Your current score is ${totalScore} (Needs Attention). Regular daily logging and setting structured goals are critical to get back on track.`;
        coachMotivation = 'Every journey begins with a single step. Complete today\'s check-in to jumpstart your stats!';
      }
    }

    // ─────────────────────────────────────────────────────────────────
    // WEEKLY WINS / RISKS / FOCUS AREAS
    // ─────────────────────────────────────────────────────────────────
    const wins = [];
    const risks = [];
    const focusAreas = [];

    if (isNewUser) {
      wins.push('Created MapMyHealth account.');
      risks.push('No active weight or fitness goal has been configured.');
      risks.push('Initial check-in data is pending.');
      focusAreas.push('Create a weight loss, muscle gain, or maintenance goal.');
      focusAreas.push('Complete today\'s metrics check-in (Weight, Steps, Water).');
    } else {
      // Wins
      if (stepsLogged >= 10000) wins.push(`Met step target today (${stepsLogged.toLocaleString()} steps walked).`);
      if (waterL >= 3.0) wins.push(`Met hydration goal today (${waterL} L water logged).`);
      if (durationLogged >= 30) wins.push(`Completed daily active exercise target (${durationLogged} mins logged).`);
      if (currentStreak >= 3) wins.push(`Maintained a solid check-in streak of ${currentStreak} consecutive days.`);
      if (completedWorkoutsThisWeek >= 3) wins.push(`Completed consistency targets with ${completedWorkoutsThisWeek} weekly workouts.`);
      if (wins.length === 0) wins.push('Completed today\'s progress log.');

      // Risks
      if (!activeGoal) risks.push('No active health goal configured.');
      if (activeGoal && activeGoal.goal_type !== 'maintenance' && daysDifference < -3) {
        risks.push(`Behind target weight schedule by ${Math.abs(daysDifference)} days.`);
      }
      if (stepsLogged < 2000) risks.push(`Daily steps count is critically low (${stepsLogged.toLocaleString()} steps).`);
      if (waterL < 1.5) risks.push(`Daily water intake is critically low (${waterL} L).`);
      if (completedWorkoutsThisWeek < 2) risks.push(`Weekly training frequency is lagging (${completedWorkoutsThisWeek}/3 target workouts completed).`);
      const energyLabels = { 1: 'Exhausted', 2: 'Tired', 3: 'Normal', 4: 'Energetic', 5: 'Peak' };
      if (energyVal !== null && energyVal <= 2) risks.push(`Fatigue detected: energy rated low today (${energyVal}/5 - ${energyLabels[energyVal]}).`);
      if (risks.length === 0) risks.push('No major health risks detected. Your metrics are well balanced!');

      // Focus Areas
      recommendations.slice(0, 3).forEach(rec => {
        focusAreas.push(`${rec.title} (${categoryLabels[rec.category] || rec.category})`);
      });
    }

    // ─────────────────────────────────────────────────────────────────
    // DETERMINISTIC COACH ANSWERS (PREDEFINED QUESTIONS)
    // ─────────────────────────────────────────────────────────────────
    const answers = {
      why_score: '',
      on_track: '',
      weekly_focus: '',
      why_recommendations: '',
      improve_score: ''
    };

    // 1. Why did my Health Score change?
    const scoreRating = rating;
    const goalContrib = (0.25 * goalScore).toFixed(1);
    const actContrib = (0.20 * activityScore).toFixed(1);
    const constContrib = (0.20 * consistencyScore).toFixed(1);
    const hydContrib = (0.15 * hydrationScore).toFixed(1);
    const energyContrib = (0.05 * energyScore).toFixed(1);
    const streakContrib = (0.15 * streakScore).toFixed(1);

    answers.why_score = `Your Health Score is currently at **${totalScore}** (rated **${scoreRating}**). The score is constructed dynamically based on 6 weighted health metrics:

*   **Goal Progress (25% weight)**: Contributing **${goalContrib}** points (Metric: ${activeGoal ? goalScore : 40}/100).
*   **Daily Activity (20% weight)**: Contributing **${actContrib}** points (Metric: ${activityScore}/100 based on ${stepsLogged.toLocaleString()} steps and ${durationLogged} mins exercise today).
*   **Workout Consistency (20% weight)**: Contributing **${constContrib}** points (Metric: ${consistencyScore}/100 based on ${completedWorkoutsThisWeek} workouts in last 7 days).
*   **Hydration (15% weight)**: Contributing **${hydContrib}** points (Metric: ${hydrationScore}/100 based on ${waterL} L water consumed today).
*   **Energy Levels (5% weight)**: Contributing **${energyContrib}** points (Metric: ${energyScore}/100 based on an energy rating of ${finalEnergy.toFixed(1)}/5).
*   **Check-In Streak (15% weight)**: Contributing **${streakContrib}** points (Metric: ${streakScore}/100 based on a ${currentStreak}-day active logging streak).

Focus on addressing daily hydration and step deficits to trigger immediate positive score shifts.`;

    // 2. Am I on track to reach my goal?
    if (isNewUser) {
      answers.on_track = 'You do not have an active goal or logging history. Please set an active fitness goal and complete today\'s check-in to enable tracking calculations.';
    } else if (!activeGoal) {
      answers.on_track = 'No active goal is set. Setting an active fitness target (weight loss, muscle gain, or maintenance) is required to calculate schedule tracking.';
    } else if (activeGoal.goal_type === 'maintenance') {
      const deviation = Math.abs(currentWeight - tw);
      answers.on_track = `You are on a **Maintenance Goal** targeting **${tw} kg**. Your current weight is **${currentWeight.toFixed(1)} kg**, which deviates by **${deviation.toFixed(1)} kg**. You are currently **${deviation <= 2 ? 'On Track' : 'Behind Target'}** (your stability target zone is +/- 2 kg).`;
    } else {
      const targetDate = new Date(activeGoal.target_date);
      if (isMovingTowardsGoal && rateTowardsGoal > 0) {
        answers.on_track = `Yes! You are on track. Your current weight is **${currentWeight.toFixed(1)} kg** against a target of **${tw} kg**. You are projected to hit your goal **${daysDifference >= 0 ? daysDifference + ' days ahead of' : Math.abs(daysDifference) + ' days behind'}** your target date of **${getLocalDateString(targetDate)}**. Your average weekly weight change rate is **${weeklyRate.toFixed(2)} kg/week**.`;
      } else {
        answers.on_track = `Your weight trajectory is currently lagging. Your current weight is **${currentWeight.toFixed(1)} kg** (target: **${tw} kg**). Your weekly rate of weight change is **${weeklyRate > 0 ? '+' : ''}${weeklyRate} kg/week**, which is stable or moving away from your goal parameters. Log weight consistently over the next few days to allow the forecasting model to recalculate.`;
      }
    }

    // 3. What should I focus on this week?
    if (isNewUser) {
      answers.weekly_focus = 'Your main focus this week is establishing consistent daily habit patterns:\n\n1. Set an active goal parameters (Weight Loss / Muscle Gain / Maintenance).\n2. Complete at least 3 check-ins to initialize streak tracking.\n3. Establish baseline step movements of 6,000+ steps daily.';
    } else {
      const top3 = recommendations.slice(0, 3);
      answers.weekly_focus = `Based on your telemetry, here are your top 3 actionable tasks to focus on this week:

${top3.map((rec, i) => `${i + 1}.  **${rec.title}** (${categoryLabels[rec.category] || rec.category})
    *   *Action*: ${rec.description}
    *   *Benefit*: ${rec.expectedBenefit}`).join('\n\n')}`;
    }

    // 4. Why am I receiving this recommendation?
    if (isNewUser) {
      answers.why_recommendations = 'You are receiving onboarding recommendations because your account is brand new. Once you set a goal and submit check-ins, recommendations will update dynamically based on your physical telemetry.';
    } else if (topRec) {
      let triggerReason = 'your wellness parameters are under evaluation';
      const energyLabels = { 1: 'Exhausted', 2: 'Tired', 3: 'Normal', 4: 'Energetic', 5: 'Peak' };
      if (topRec.category === 'hydration') triggerReason = `today's water intake is at ${waterL} L (target: 3.0 L)`;
      else if (topRec.category === 'activity') triggerReason = `today's step count is at ${stepsLogged.toLocaleString()} (target: 10,000)`;
      else if (topRec.category === 'recovery') triggerReason = `your energy is rated as ${energyLabels[Math.round(finalEnergy)]} (${finalEnergy.toFixed(1)}/5) and weekly training volume is at ${completedWorkoutsThisWeek} sessions`;
      else if (topRec.category === 'consistency') triggerReason = `your daily logging check-in is pending for today (current streak is at ${currentStreak} days)`;
      else if (topRec.category === 'goal_progress') triggerReason = `your weight velocity is currently behind your goal target timeline`;

      answers.why_recommendations = `You are receiving the primary recommendation **"${topRec.title}"** because **${triggerReason}**. The system dynamically flags the category with the largest score deficit to guide your health journey route safely.`;
    } else {
      answers.why_recommendations = 'No active recommendations are triggered because all your daily targets, consistency streaks, and weight velocities are fully optimized!';
    }

    // 5. How can I improve my score?
    if (isNewUser) {
      answers.improve_score = 'To immediately improve your Health Score: \n\n1. Create an active goal: **+15 points** (Goal Progress contribution)\n2. Complete today\'s check-in: **+15 points** (Streak and Energy contributions)';
    } else {
      const improveTips = [];
      if (stepsPart < 100) {
        const stepsRem = 10000 - stepsLogged;
        const stepPts = Math.round((0.20 * 0.60 * (stepsRem / 10000) * 100) * 10) / 10;
        if (stepPts > 0) improveTips.push(`*   **Walk ${stepsRem.toLocaleString()} more steps today**: Adds up to **+${stepPts}** points to your Health Score.`);
      }
      if (durationPart < 100) {
        const durRem = 30 - durationLogged;
        const durPts = Math.round((0.20 * 0.40 * (durRem / 30) * 100) * 10) / 10;
        if (durPts > 0) improveTips.push(`*   **Exercise for ${durRem} more minutes today**: Adds up to **+${durPts}** points to your Health Score.`);
      }
      if (waterL < 3.0) {
        const waterRem = parseFloat((3.0 - waterL).toFixed(1));
        const waterPts = Math.round((0.15 * (waterRem / 3.0) * 100) * 10) / 10;
        if (waterPts > 0) improveTips.push(`*   **Drink ${waterRem} L more water today**: Adds up to **+${waterPts}** points to your Health Score.`);
      }
      if (completedWorkoutsThisWeek < 3) {
        const consistencyPts = Math.round((0.20 * (1 / 3) * 100) * 10) / 10;
        improveTips.push(`*   **Complete your next workout session**: Adds **+${consistencyPts}** points to your Consistency component.`);
      }
      if (currentStreak < 7) {
        const streakPts = Math.round((0.15 * (1 / 7) * 100) * 10) / 10;
        improveTips.push(`*   **Log check-in tomorrow**: Extends your streak and adds **+${streakPts}** points to your Streak component.`);
      }
      if (!activeGoal) {
        improveTips.push('*   **Set an active goal**: Restores your Goal Progress component and adds **+10.0** points.');
      }

      if (improveTips.length > 0) {
        answers.improve_score = `Here are the exact points-earning actions you can perform today to raise your Health Score:

${improveTips.join('\n\n')}

Focus on completing these actions to secure immediate score improvements.`;
      } else {
        answers.improve_score = 'Excellent! All your daily tracking targets and consistency streaks are fully optimized today. Keep maintaining this routine to preserve your high score!';
      }
    }

    res.json({
      success: true,
      dailySummary: {
        summary: coachSummary,
        focus: coachFocus,
        motivation: coachMotivation
      },
      weeklySummary: {
        wins,
        risks,
        focusAreas
      },
      answers
    });

  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Server error. Please try again.' });
  }
});



// ─── Serve SPA ────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start Server ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅ BeginnerFit server running at http://localhost:${PORT}`);
  console.log(`✅ Connected to PostgreSQL database: mapmyhealth\n`);
});