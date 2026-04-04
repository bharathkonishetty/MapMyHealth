const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── PostgreSQL Connection ────────────────────────────────────────
const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : { user: 'postgres', host: 'localhost', database: 'mapmyhealth', password: 'postgre_bharath', port: 5432 }
);

// ─── Middleware ───────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'beginner-fit-secret-2024',
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
    const nameCheck = await pool.query('SELECT id FROM users WHERE LOWER(name) = $1', [name.toLowerCase()]);
    if (nameCheck.rows.length > 0)
      return res.json({ success: false, message: 'Username already registered.' });

    // Check duplicate email
    const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (emailCheck.rows.length > 0)
      return res.json({ success: false, message: 'Email already registered.' });

    const hashedPass = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO users (name, email, mobile, password) VALUES ($1, $2, $3, $4)',
      [name, email.toLowerCase(), mobile, hashedPass]
    );

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
      'SELECT * FROM users WHERE LOWER(name) = $1 OR email = $1',
      [id]
    );

    if (result.rows.length === 0)
      return res.json({ success: false, message: 'Invalid username/email or password.' });

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match)
      return res.json({ success: false, message: 'Invalid username/email or password.' });

    req.session.user = {
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      age: user.age || '',
      height: user.height || '',
      weight: user.weight || ''
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
    await pool.query(
      'UPDATE users SET age = $1, height = $2, weight = $3 WHERE LOWER(name) = $4',
      [age || '', height || '', weight || '', req.session.user.name.toLowerCase()]
    );

    req.session.user.age = age || '';
    req.session.user.height = height || '';
    req.session.user.weight = weight || '';

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