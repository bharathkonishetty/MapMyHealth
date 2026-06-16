/* ═══════════════════════════════════════════════════════════
   BeginnerFit - Frontend App Logic
   Communicates with Node.js backend via fetch() API calls
═══════════════════════════════════════════════════════════ */
 
// ─── Toast Notification ───────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
 
// ─── API Helpers ──────────────────────────────────────────────────
async function apiPost(endpoint, data) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}
 
// ─── Auth: Check session on load ─────────────────────────────────
window.addEventListener('load', async () => {
  const data = await fetch('/api/session').then(r => r.json());
  if (data.loggedIn) {
    showDashboard(data.user);
  }
});
 
// ─── Register ─────────────────────────────────────────────────────
async function register() {
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const mobile   = document.getElementById('reg-mobile').value.trim();
  const password = document.getElementById('reg-pass').value.trim();
  const repass   = document.getElementById('reg-repass').value.trim();
  const msgEl    = document.getElementById('reg-msg');
 
  if (password !== repass) {
    msgEl.textContent = 'Passwords do not match!';
    msgEl.className = 'msg error';
    return;
  }
 
  msgEl.textContent = '';
  const result = await apiPost('/api/register', { name, email, mobile, password });
 
  if (result.success) {
    msgEl.textContent = result.message;
    msgEl.className = 'msg success';
    document.getElementById('reg-form').reset();
    setTimeout(() => toggleAuth(), 1500);
  } else {
    msgEl.textContent = result.message;
    msgEl.className = 'msg error';
  }
}
 
// ─── Login ────────────────────────────────────────────────────────
async function login() {
  const identifier = document.getElementById('log-id').value.trim();
  const password   = document.getElementById('log-pass').value.trim();
  const msgEl      = document.getElementById('login-msg');
 
  msgEl.textContent = '';
  const result = await apiPost('/api/login', { identifier, password });
 
  if (result.success) {
    document.getElementById('log-id').value = '';
    document.getElementById('log-pass').value = '';
    showDashboard(result.user);
  } else {
    msgEl.textContent = result.message;
    msgEl.className = 'msg error';
  }
}
 
// ─── Logout ───────────────────────────────────────────────────────
async function logout() {
  await apiPost('/api/logout', {});
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('auth-section').style.display = 'flex';
  document.getElementById('profile-modal').style.display = 'none';
  // show login by default on logout
  document.getElementById('reg-form').classList.add('hidden');
  document.getElementById('login-form').classList.remove('hidden');
  showToast('Logged out successfully.');
}
 
// ─── Show Dashboard ───────────────────────────────────────────────
function showDashboard(user) {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
 
  document.getElementById('p-name').textContent   = user.name;
  document.getElementById('p-email').textContent  = user.email;
  document.getElementById('p-mobile').textContent = user.mobile;
 
  document.getElementById('u-age').value    = user.age    || '';
  document.getElementById('u-height').value = user.height || '';
  document.getElementById('u-weight').value = user.weight || '';
}
 
// ─── Save Profile Stats ───────────────────────────────────────────
async function saveProfile() {
  const age    = document.getElementById('u-age').value;
  const height = document.getElementById('u-height').value;
  const weight = document.getElementById('u-weight').value;
 
  const result = await apiPost('/api/profile', { age, height, weight });
  if (result.success) showToast('Profile updated ✓');
}
 
// ─── Toggle Auth Forms ────────────────────────────────────────────
function toggleAuth() {
  document.getElementById('reg-form').classList.toggle('hidden');
  document.getElementById('login-form').classList.toggle('hidden');
  document.getElementById('reg-msg').textContent = '';
  document.getElementById('login-msg').textContent = '';
}
 
// ─── Toggle Profile Modal ─────────────────────────────────────────
function toggleProfile() {
  const m = document.getElementById('profile-modal');
  m.style.display = (m.style.display === 'block') ? 'none' : 'block';
}
 
// Close profile modal if clicked outside
document.addEventListener('click', (e) => {
  const modal   = document.getElementById('profile-modal');
  const trigger = document.querySelector('.profile-trigger');
  if (modal && modal.style.display === 'block' &&
      !modal.contains(e.target) && !trigger.contains(e.target)) {
    modal.style.display = 'none';
  }
});
 
// ─── Navigation Tabs ─────────────────────────────────────────────
function switchSection(sectionId, btn) {
  document.querySelectorAll('.section-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
  document.getElementById(sectionId).classList.add('active');
  if (btn) btn.classList.add('active');
}
 
// ─── Select Workout Day ───────────────────────────────────────────
function selectDay(day) {
  const grid       = document.getElementById('workout-grid');
  const dayInfo    = document.getElementById('day-info');
  const warmupSec  = document.getElementById('warmup-section');

  if (!day) {
    grid.style.display       = 'none';
    dayInfo.style.display    = 'none';
    warmupSec.style.display  = 'none';
  } else {
    const dayMap = {
      Monday:    'CHEST',
      Tuesday:   'BACK',
      Wednesday: 'SHOULDERS',
      Thursday:  'BICEPS',
      Friday:    'TRICEPS',
      Saturday:  'LEGS',
      Sunday:    'FULL BODY'
    };
    grid.style.display       = 'flex';
    dayInfo.style.display    = 'block';
    warmupSec.style.display  = 'block';
    dayInfo.textContent      = `${day.toUpperCase()} — ${dayMap[day] || 'SELECT MUSCLE'}`;
  }
}
 
// ─── Exercise Data ────────────────────────────────────────────────
const workoutData = {
  'Warmup': [
    { name: 'Jumping Jacks',     video: 'https://www.youtube.com/watch?v=UpH7RmJsmUY' },
    { name: 'Arm Circles',       video: 'https://www.youtube.com/watch?v=OAg0YGxKPzI' },
    { name: 'Leg Swings',        video: 'https://www.youtube.com/watch?v=3p8EBPVZ2Iw' },
    { name: 'Torso Twists',      video: 'https://www.youtube.com/watch?v=ExR0m8W5YOc' },
    { name: 'Shoulder Rolls',    video: 'https://www.youtube.com/watch?v=2Ew6yq7zZ4A' },
    { name: 'March in Place',    video: 'https://www.youtube.com/watch?v=4n8F7q9zZ2A' }
  ],
  'Chest': [
    { name: 'Standard Pushups',  video: 'https://www.youtube.com/watch?v=WDIpL0pjun0' },
    { name: 'Bench Press',       video: 'https://www.youtube.com/shorts/hWbUlkb5Ms4' },
    { name: 'Chest Press',       video: 'https://www.youtube.com/watch?v=VmB1G1K7v94' },
    { name: 'Pec Flys',          video: 'https://www.youtube.com/shorts/g3T7LsEeDWQ' },
    { name: 'Incline Press',     video: 'https://www.youtube.com/shorts/ou6s32mJgjU' }
  ],
  'Shoulders': [
    { name: 'Overhead Press',    video: 'https://www.youtube.com/watch?v=F3QY5vMz_6I' },
    { name: 'Lateral Raises',    video: 'https://www.youtube.com/watch?v=geenhiHju-o' },
    { name: 'Front Raises',      video: 'https://www.youtube.com/watch?v=-t7fuZ0KhDA' },
    { name: 'Reverse Flys',      video: 'https://www.youtube.com/watch?v=rtkvodbZfGY' },
    { name: 'Shrugs',            video: 'https://www.youtube.com/watch?v=cJRVVxmytaM' }
  ],
  'Back': [
    { name: 'Pull Ups',          video: 'https://www.youtube.com/watch?v=eGo4IYlbE5g' },
    { name: 'Rear Pec Flys',     video: 'https://www.youtube.com/watch?v=JL8nHvZcAK8' },
    { name: 'Lat Pulldowns',     video: 'https://www.youtube.com/watch?v=lSt1oTrZ_Cc' },
    { name: 'Seated Cable Rows', video: 'https://www.youtube.com/watch?v=GZbfZ033f74' },
    { name: 'Deadlifts',         video: 'https://www.youtube.com/watch?v=XxWcirHIwVo' }
  ],
  'Biceps': [
    { name: 'Dumbbell Curls',       video: 'https://www.youtube.com/watch?v=zC3nLlEvin4' },
    { name: 'Hammer Curls',         video: 'https://www.youtube.com/watch?v=32W1sB5DkHY' },
    { name: 'Concentration Curls',  video: 'https://www.youtube.com/watch?v=Jvj2wV0vOYU' },
    { name: 'Preacher Curls',       video: 'https://www.youtube.com/watch?v=Gydpcouclx8' },
    { name: 'Barbell Curls',        video: 'https://www.youtube.com/watch?v=N6paU6TGFWU' }
  ],
  'Legs': [
    { name: 'Bodyweight Squats', video: 'https://www.youtube.com/watch?v=P-yaD24bUE8' },
    { name: 'Lunges',            video: 'https://www.youtube.com/watch?v=wrwwXE_x-pQ' },
    { name: 'Calf Raises',       video: 'https://www.youtube.com/watch?v=c5Kv6-fnTj8' },
    { name: 'Leg Extensions',    video: 'https://www.youtube.com/watch?v=YyvSfVjQeL0' },
    { name: 'Hamstring Curls',   video: 'https://www.youtube.com/shorts/Lh3iMIcbkBQ' },
    { name: 'Glute Bridges',     video: 'https://www.youtube.com/watch?v=OUgsJ8-Vi0E' }
  ],
  'Triceps': [
    { name: 'Tricep Dips',                  video: 'https://www.youtube.com/watch?v=thx13oPVK5c' },
    { name: 'Diamond Pushups',              video: 'https://www.youtube.com/watch?v=t2cR426fFx0' },
    { name: 'Tricep Kickbacks',             video: 'https://www.youtube.com/watch?v=3Bv1n7-DN7c' },
    { name: 'Overhead Tricep Extensions',   video: 'https://www.youtube.com/watch?v=fYqswDVbJDg' },
    { name: 'Cable Tricep Pushdowns',       video: 'https://www.youtube.com/watch?v=_w-HpW70nSQ' }
  ]
};
 
// ─── Open Exercise Popup ──────────────────────────────────────────
function openExercise(muscle) {
  const view    = document.getElementById('exercise-view');
  const overlay = document.getElementById('screen-overlay');
  const list    = document.getElementById('ex-list');

  document.getElementById('ex-title').textContent = muscle + ' Workouts';

  function getYTEmbed(url) {
    if (!url) return '';
    const m = url.match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/);
    return m ? `https://www.youtube.com/embed/${m[1]}?rel=0&controls=1&modestbranding=1` : '';
  }

  list.innerHTML = (workoutData[muscle] || []).map(ex => {
    const yt = getYTEmbed(ex.video || '');
    const mediaHTML = yt
      ? `<div class="video-wrap"><iframe src="${yt}" allowfullscreen></iframe></div>`
      : ex.video
        ? `<video controls preload="metadata" src="${ex.video}"></video>`
        : `<img src="${ex.img || ''}" alt="${ex.name}" onerror="this.src='https://via.placeholder.com/300x200?text=Loading...'">`;

    return `
      <div class="exercise-item">
        <h4>${ex.name}</h4>
        ${mediaHTML}
      </div>`;
  }).join('');

  view.style.display    = 'block';
  overlay.style.display = 'block';
}

// ─── Open Warmup Exercises ────────────────────────────────────────
function openWarmup() {
  const view = document.getElementById('exercise-view');
  const overlay = document.getElementById('screen-overlay');
  const list = document.getElementById('ex-list');

  document.getElementById('ex-title').textContent = 'Warmup Exercises';

  function getYTEmbed(url) {
    if (!url) return '';
    const m = url.match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/);
    return m ? `https://www.youtube.com/embed/${m[1]}?rel=0&controls=1&modestbranding=1` : '';
  }

  list.innerHTML = (workoutData['Warmup'] || []).map(ex => {
    const yt = getYTEmbed(ex.video || '');
    const mediaHTML = yt
      ? `<div class="video-wrap"><iframe src="${yt}" allowfullscreen></iframe></div>`
      : ex.video
        ? `<video controls preload="metadata" src="${ex.video}"></video>`
        : `<img src="${ex.img || ''}" alt="${ex.name}" onerror="this.src='https://via.placeholder.com/300x200?text=Loading...'">`;

    return `
<div class="exercise-item">
<h4>${ex.name}</h4>
${mediaHTML}
</div>`;
  }).join('');

  view.style.display = 'block';
  overlay.style.display = 'block';
}

// ─── Close Exercise Popup ─────────────────────────────────────────
function closeEx() {
  document.getElementById('exercise-view').style.display = 'none';
  document.getElementById('screen-overlay').style.display = 'none';
}
 
// ─── Book Trainer ─────────────────────────────────────────────────
function bookTrainer(trainerName) {
  showToast(`✅ Booking request sent for ${trainerName}! We'll contact you soon.`);
}
 
// ─── Enter key support for forms ──────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const loginForm = document.getElementById('login-form');
  const regForm   = document.getElementById('reg-form');
  if (loginForm && !loginForm.classList.contains('hidden')) login();
  else if (regForm && !regForm.classList.contains('hidden')) register();
});
 