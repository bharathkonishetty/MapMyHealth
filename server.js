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

// ─── Middleware ───────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'beginner-fit-secret-2024',
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

// ─── Serve SPA ────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start Server ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅ BeginnerFit server running at http://localhost:${PORT}`);
  console.log(`✅ Connected to PostgreSQL database: mapmyhealth\n`);
});