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
 
async function apiGet(endpoint) {
  const res = await fetch(endpoint);
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

  loadGoals();
  loadJourney();
}
 
// ─── Save Profile Stats ───────────────────────────────────────────
async function saveProfile() {
  const age    = document.getElementById('u-age').value;
  const height = document.getElementById('u-height').value;
  const weight = document.getElementById('u-weight').value;
 
  const result = await apiPost('/api/profile', { age, height, weight });
  if (result.success) {
    showToast('Profile updated ✓');
    loadGoals();
    loadJourney();
  }
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

  if (sectionId === 'journey') {
    loadJourney();
  }
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
 
// ─── Goals: Load ──────────────────────────────────────────────────
async function loadGoals() {
  const data = await apiGet('/api/goals');
  if (data.success) renderGoals(data.goals);
}
 
// ─── Goals: Render ─────────────────────────────────────────────────
function renderGoals(goals) {
  const activeArea = document.getElementById('active-goal-area');
  const pastArea   = document.getElementById('past-goals-area');
  const newBtn     = document.getElementById('btn-new-goal');
  if (!activeArea) return;

  const activeGoals = goals.filter(g => g.status === 'active');
  const pastGoals   = goals.filter(g => g.status !== 'active');

  if (activeGoals.length === 0) {
    activeArea.innerHTML = `
      <div class="goals-empty">
        <i class="fas fa-map-location-dot"></i>
        <h3>No active goal yet</h3>
        <p>Set your first health goal to begin mapping your journey.</p>
        <button class="btn-main" style="width:auto;padding:12px 28px;" onclick="openGoalModal()">
          <i class="fas fa-plus"></i>&nbsp; Set My First Goal
        </button>
      </div>`;
    if (newBtn) newBtn.style.display = 'none';
  } else {
    if (newBtn) newBtn.style.display = 'flex';
    activeArea.innerHTML = activeGoals.map(goalCardHTML).join('');
  }

  if (pastGoals.length > 0) {
    pastArea.innerHTML = `
      <p class="past-goals-title">Past Goals</p>
      ${pastGoals.map(g => `
        <div class="past-goal-item">
          <div class="past-goal-info">
            <h4>${escapeHtml(g.goal_name || goalTypeLabel(g.goal_type))}</h4>
            <p>${g.start_weight} kg → ${g.target_weight} kg &nbsp;·&nbsp; Target: ${formatDate(g.target_date)}</p>
          </div>
          <span class="status-badge-${g.status}">${capitalize(g.status)}</span>
        </div>`).join('')}`;
  } else {
    pastArea.innerHTML = '';
  }
}
 
// ─── Goals: Card HTML ──────────────────────────────────────────────
function goalCardHTML(g) {
  const daysLeft = Math.max(0, Math.ceil((new Date(g.target_date) - new Date()) / (1000*60*60*24)));
  const badgeClass = `badge-${g.goal_type}`;
  return `
    <div class="goal-card">
      <div class="goal-card-header">
        <div class="goal-card-title">
          <h3>${escapeHtml(g.goal_name || goalTypeLabel(g.goal_type))}</h3>
          <span class="goal-type-badge ${badgeClass}">${goalTypeLabel(g.goal_type)}</span>
        </div>
        <div class="goal-card-actions">
          <button class="btn-goal-edit" onclick="openGoalModal('${g.id}')">
            <i class="fas fa-pen"></i> Edit
          </button>
          <button class="btn-goal-complete" onclick="updateGoalStatus('${g.id}','completed')">
            <i class="fas fa-check"></i> Complete
          </button>
          <button class="btn-goal-cancel-action" onclick="updateGoalStatus('${g.id}','cancelled')">
            <i class="fas fa-xmark"></i> Cancel
          </button>
        </div>
      </div>

      <div class="goal-stats">
        <div class="goal-stat">
          <div class="stat-label">Start</div>
          <div class="stat-value">${g.start_weight} kg</div>
        </div>
        <div class="goal-stat">
          <div class="stat-label">Current</div>
          <div class="stat-value current">${g.current_weight} kg</div>
        </div>
        <div class="goal-stat">
          <div class="stat-label">Target</div>
          <div class="stat-value target">${g.target_weight} kg</div>
        </div>
      </div>

      <div class="goal-progress-section">
        <div class="goal-progress-label">
          <span>Progress</span>
          <span class="pct">${g.progress_pct}%</span>
        </div>
        <div class="goal-progress-bar">
          <div class="goal-progress-fill" style="width:${g.progress_pct}%"></div>
        </div>
      </div>

      <div class="goal-days">
        <span>${daysLeft}</span> days remaining · Target: ${formatDate(g.target_date)}
      </div>
    </div>`;
}
 
// ─── Goals: Open Modal ─────────────────────────────────────────────
async function openGoalModal(goalId) {
  const overlay = document.getElementById('goal-modal-overlay');
  const modal   = document.getElementById('goal-modal');
  const title   = document.getElementById('goal-modal-title');
  const submit  = document.getElementById('btn-goal-submit');
  const msg     = document.getElementById('goal-modal-msg');

  // Reset
  document.getElementById('goal-edit-id').value       = '';
  document.getElementById('goal-name').value          = '';
  document.getElementById('goal-type-value').value    = '';
  document.getElementById('goal-start-weight').value  = '';
  document.getElementById('goal-target-weight').value = '';
  document.getElementById('goal-target-date').value   = '';
  document.getElementById('goal-start-weight').disabled = false;
  msg.textContent = '';
  msg.className   = 'msg';
  document.querySelectorAll('.goal-type-option').forEach(el => {
    el.classList.remove('selected');
    el.style.pointerEvents = '';
    el.style.opacity = '';
  });

  if (goalId) {
    title.textContent  = 'Edit Goal';
    submit.textContent = 'Save Changes';
    document.getElementById('goal-edit-id').value = goalId;

    const data = await apiGet('/api/goals');
    if (data.success) {
      const g = data.goals.find(g => g.id === goalId);
      if (g) {
        document.getElementById('goal-name').value          = g.goal_name || '';
        document.getElementById('goal-start-weight').value  = g.start_weight;
        document.getElementById('goal-target-weight').value = g.target_weight;
        document.getElementById('goal-target-date').value   = (g.target_date || '').split('T')[0];
        selectGoalType(g.goal_type);
        // Lock immutable fields in edit mode
        document.getElementById('goal-start-weight').disabled = true;
        document.querySelectorAll('.goal-type-option').forEach(el => {
          el.style.pointerEvents = 'none';
          el.style.opacity = el.dataset.type === g.goal_type ? '1' : '0.4';
        });
      }
    }
  } else {
    title.textContent  = 'Set New Goal';
    submit.textContent = 'Create Goal';
  }

  overlay.style.display = 'block';
  modal.style.display   = 'block';
}
 
// ─── Goals: Close Modal ───────────────────────────────────────────
function closeGoalModal() {
  document.getElementById('goal-modal-overlay').style.display = 'none';
  document.getElementById('goal-modal').style.display         = 'none';
  document.getElementById('goal-start-weight').disabled       = false;
  document.querySelectorAll('.goal-type-option').forEach(el => {
    el.style.pointerEvents = '';
    el.style.opacity = '';
  });
}
 
// ─── Goals: Select Type ──────────────────────────────────────────
function selectGoalType(type) {
  document.getElementById('goal-type-value').value = type;
  document.querySelectorAll('.goal-type-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.type === type);
  });
}
 
// ─── Goals: Submit (Create or Edit) ───────────────────────────────
async function submitGoal() {
  const editId        = document.getElementById('goal-edit-id').value;
  const goal_name     = document.getElementById('goal-name').value.trim();
  const goal_type     = document.getElementById('goal-type-value').value;
  const start_weight  = document.getElementById('goal-start-weight').value;
  const target_weight = document.getElementById('goal-target-weight').value;
  const target_date   = document.getElementById('goal-target-date').value;
  const msg           = document.getElementById('goal-modal-msg');

  msg.textContent = '';
  msg.className   = 'msg';

  if (!editId && !goal_type) {
    msg.textContent = 'Please select a goal type.'; msg.className = 'msg error'; return;
  }
  if (!editId && (!start_weight || isNaN(parseFloat(start_weight)))) {
    msg.textContent = 'Please enter a valid start weight.'; msg.className = 'msg error'; return;
  }
  if (!target_weight || isNaN(parseFloat(target_weight))) {
    msg.textContent = 'Please enter a valid target weight.'; msg.className = 'msg error'; return;
  }
  if (!target_date) {
    msg.textContent = 'Please select a target date.'; msg.className = 'msg error'; return;
  }
  const today = new Date(); today.setHours(0,0,0,0);
  if (new Date(target_date) <= today) {
    msg.textContent = 'Target date must be in the future.'; msg.className = 'msg error'; return;
  }

  let result;
  if (editId) {
    result = await fetch(`/api/goals/${editId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal_name, target_weight: parseFloat(target_weight), target_date })
    }).then(r => r.json());
  } else {
    result = await apiPost('/api/goals', {
      goal_name, goal_type,
      start_weight: parseFloat(start_weight),
      target_weight: parseFloat(target_weight),
      target_date
    });
  }

  if (result.success) {
    closeGoalModal();
    await loadGoals();
    loadJourney();
    showToast(editId ? '✓ Goal updated.' : '✓ Goal created! Your journey has begun.');
  } else {
    msg.textContent = result.message;
    msg.className   = 'msg error';
  }
}
 
// ─── Goals: Update Status ──────────────────────────────────────────
async function updateGoalStatus(goalId, status) {
  const label = status === 'completed' ? 'mark this goal as completed' : 'cancel this goal';
  if (!confirm(`Are you sure you want to ${label}? This cannot be undone.`)) return;

  const result = await fetch(`/api/goals/${goalId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  }).then(r => r.json());

  if (result.success) {
    await loadGoals();
    loadJourney();
    showToast(status === 'completed' ? '🎉 Goal completed! Well done.' : 'Goal cancelled.');
  } else {
    showToast('Error: ' + result.message);
  }
}
 
// ─── Goals: Helpers ─────────────────────────────────────────────────
function goalTypeLabel(type) {
  return { weight_loss: 'Weight Loss', muscle_gain: 'Muscle Gain', maintenance: 'Maintenance' }[type] || type;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}
 
// ─── Enter key support for forms ──────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const loginForm = document.getElementById('login-form');
  const regForm   = document.getElementById('reg-form');
  if (loginForm && !loginForm.classList.contains('hidden')) login();
  else if (regForm && !regForm.classList.contains('hidden')) register();
});

// ─── Journey Map: Load (Phase 3) ───────────────────────────────────
async function loadJourney() {
  const container = document.getElementById('journey-main-area');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align:center;padding:50px 0;color:rgba(255,255,255,0.4);">
      <i class="fas fa-spinner fa-spin" style="font-size:2rem;margin-bottom:12px;"></i>
      <p>Loading your health journey map...</p>
    </div>`;

  try {
    const response = await fetch('/api/journey/map').then(r => r.json());
    if (response.success) {
      renderJourney(response);
    } else {
      container.innerHTML = `
        <div class="journey-empty-card">
          <i class="fas fa-circle-exclamation" style="color:var(--danger-red);"></i>
          <h3>Failed to load journey map</h3>
          <p>${response.message || 'Please refresh the page.'}</p>
        </div>`;
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = `
      <div class="journey-empty-card">
        <i class="fas fa-circle-exclamation" style="color:var(--danger-red);"></i>
        <h3>Connection error</h3>
        <p>Could not connect to server. Please try again.</p>
      </div>`;
  }
}

// ─── Journey Map: Render (Phase 3) ─────────────────────────────────
function renderJourney(data) {
  const container = document.getElementById('journey-main-area');
  const badge = document.getElementById('journey-route-badge');
  if (!container) return;

  if (!data.activeGoal) {
    if (badge) badge.style.display = 'none';
    container.innerHTML = `
      <div class="journey-empty-card">
        <i class="fas fa-map-location-dot"></i>
        <h3>No Active Journey</h3>
        <p>Your journey map represents a visual route from where you are to your destination. Set an active goal to generate your route.</p>
        <button class="btn-main" style="width:auto;padding:12px 28px;" onclick="switchSection('goals', document.querySelector('.nav-tab[onclick*=\\'goals\\']'))">
          <i class="fas fa-plus"></i>&nbsp; Set My Active Goal
        </button>
      </div>`;
    return;
  }

  if (badge) {
    badge.style.display = 'block';
    badge.textContent = `${data.activeGoal.goal_type.replace('_', ' ')} Route`;
  }

  const g = data.activeGoal;
  const milestones = data.checkpoints || [];
  const cw = data.currentWeight;
  const progressPct = data.progressPct;

  container.innerHTML = `
    <div class="journey-grid">
      <!-- Column A: SVG Winding Trail -->
      <div class="journey-map-container">
        <svg class="journey-svg" viewBox="0 0 360 560" xmlns="http://www.w3.org/2000/svg" id="journey-svg-canvas">
          <defs>
            <linearGradient id="progress-grad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stop-color="var(--primary-teal)" />
              <stop offset="100%" stop-color="var(--accent-green)" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          
          <!-- Background Winding Trails -->
          <path class="journey-trail-bg" d="M 180 500 Q 100 445 100 390 Q 180 335 260 280 Q 180 225 100 170 Q 180 115 180 60" />
          <path class="journey-trail-dash" d="M 180 500 Q 100 445 100 390 Q 180 335 260 280 Q 180 225 100 170 Q 180 115 180 60" />
          
          <!-- Glowing Progress Trail -->
          <path class="journey-trail-progress" id="journey-progress-path" 
                d="M 180 500 Q 100 445 100 390 Q 180 335 260 280 Q 180 225 100 170 Q 180 115 180 60" 
                stroke="url(#progress-grad)" />
          
          <!-- Plotted Milestones -->
          ${milestones.map((m, idx) => {
            const coords = [
              {x: 180, y: 500}, // Seq 0 - Starting Point
              {x: 100, y: 390}, // Seq 1 - First Step
              {x: 260, y: 280}, // Seq 2 - Halfway Hero
              {x: 100, y: 170}, // Seq 3 - Momentum
              {x: 180, y: 60}   // Seq 4 - Destination
            ][idx];
            
            const nodeClass = m.is_completed ? 'completed' : 'locked';
            const nodeRadius = idx === 0 || idx === 4 ? 14 : 10;
            const dotRadius = idx === 0 || idx === 4 ? 6 : 4;
            const glowClass = m.is_completed ? 'glow-filter' : '';
            
            return `
              <g class="journey-node ${glowClass}" onclick="showJourneyTooltip('${escapeHtml(m.title)}', '${escapeHtml(m.description)}', ${m.is_completed})">
                <circle cx="${coords.x}" cy="${coords.y}" r="${nodeRadius}" class="node-bg ${nodeClass}" />
                <circle cx="${coords.x}" cy="${coords.y}" r="${dotRadius}" class="node-dot ${nodeClass}" />
              </g>
            `;
          }).join('')}
          
          <!-- Pulsing Current Position Indicator -->
          <g class="current-marker" id="journey-current-marker" style="display:none;">
            <circle cx="0" cy="0" r="13" fill="rgba(20, 184, 166, 0.22)" stroke="var(--primary-teal)" stroke-width="2" />
            <circle cx="0" cy="0" r="6" fill="var(--primary-teal)" />
          </g>
        </svg>
        
        <div class="journey-tooltip-box" id="journey-tooltip">
          <h4 id="tooltip-title">Checkpoint</h4>
          <p id="tooltip-desc">Description</p>
          <span class="tooltip-status" id="tooltip-status">Status</span>
        </div>
      </div>
      
      <!-- Column B: Stats & Insights -->
      <div class="journey-sidebar">
        <!-- Route Summary Card -->
        <div class="journey-card">
          <h3>Route Summary</h3>
          <div style="font-size:13px;color:rgba(255,255,255,0.7);margin-bottom:18px;font-weight:600;">
            Label: ${escapeHtml(g.goal_name || 'My Route')} &nbsp;·&nbsp; Target Date: ${formatDate(g.target_date)}
          </div>
          <div class="journey-summary-grid">
            <div class="journey-summary-item">
              <div class="label">Start Weight</div>
              <div class="value">${g.start_weight} kg</div>
            </div>
            <div class="journey-summary-item">
              <div class="label">Current Weight</div>
              <div class="value highlight">${cw} kg</div>
            </div>
            <div class="journey-summary-item">
              <div class="label">Target Weight</div>
              <div class="value" style="color:var(--accent-green);">${g.target_weight} kg</div>
            </div>
            <div class="journey-summary-item">
              <div class="label">Overall Progress</div>
              <div class="value highlight">${progressPct}%</div>
            </div>
          </div>
        </div>
        
        <!-- Timeline Checklist -->
        <div class="journey-card">
          <h3>Checkpoints</h3>
          <div class="timeline-list">
            ${milestones.map((m, idx) => {
              const activeClass = !m.is_completed && (idx === 0 || milestones[idx-1]?.is_completed) ? 'active' : '';
              const completedClass = m.is_completed ? 'completed' : '';
              
              let statusIconHTML = '<i class="fas fa-lock timeline-item-status-icon locked"></i>';
              if (m.is_completed) {
                statusIconHTML = '<i class="fas fa-check-circle timeline-item-status-icon completed"></i>';
              } else if (activeClass) {
                statusIconHTML = '<i class="fas fa-spinner fa-spin timeline-item-status-icon active" style="color:var(--primary-teal);"></i>';
              }
              
              return `
                <div class="timeline-item ${completedClass} ${activeClass}">
                  <div class="timeline-item-dot"></div>
                  <div class="timeline-item-content">
                    <h4>${escapeHtml(m.title)}</h4>
                    <p>${escapeHtml(m.description)}</p>
                  </div>
                  ${statusIconHTML}
                </div>
              `;
            }).join('')}
          </div>
        </div>
        
        <!-- Navigator Guidance Box -->
        <div class="coach-guidance-box">
          <i class="fas fa-compass"></i>
          <div>
            <p id="navigator-coach-text">${getNavigatorGuidance(g, cw, milestones, progressPct)}</p>
          </div>
        </div>
      </div>
    </div>`;

  drawJourneyMap(progressPct);
}

// ─── Journey Map: Navigator Guidance (Phase 3) ──────────────────────
function getNavigatorGuidance(g, cw, milestones, pct) {
  if (pct >= 100) {
    return `🎉 Destination reached! You have completed your goal. Outstanding work on mapping this journey successfully! Ready to set your next peak?`;
  }
  
  if (g.goal_type === 'maintenance') {
    if (Math.abs(cw - g.target_weight) > 2) {
      return `⚠️ Navigator alert: Your current weight is outside your stability zone (${(g.target_weight - 2).toFixed(1)} - ${(g.target_weight + 2).toFixed(1)} kg). Log metrics regularly and adjust calories to get back on course.`;
    }
    return `🧭 Maintenance route is green! You are keeping your weight stable. Time elapsed: ${pct}% of target duration. Keep maintaining consistency.`;
  }

  const nextMilestone = milestones.find(m => !m.is_completed);
  if (!nextMilestone) {
    return `🧭 You are on the final stretch to your Destination. Keep going, you are almost there!`;
  }

  const diffToNext = Math.abs(cw - nextMilestone.target_value).toFixed(1);
  return `🧭 Position check: You are on track at ${pct}% progress. Next milestone is **${nextMilestone.title}** (Target: ${nextMilestone.target_value} kg). You are just **${diffToNext} kg** away from unlocking it. Keep going!`;
}

// ─── Journey Map: SVG Dash Offset Animation (Phase 3) ───────────────
function drawJourneyMap(progressPct) {
  const path = document.getElementById('journey-progress-path');
  const marker = document.getElementById('journey-current-marker');
  if (!path || !marker) return;

  const pathLength = path.getTotalLength();
  path.style.strokeDasharray = pathLength;
  path.style.strokeDashoffset = pathLength; 

  path.getBoundingClientRect(); 

  const fillOffset = pathLength * (1 - progressPct / 100);
  path.style.strokeDashoffset = fillOffset;

  const markerPos = getPositionOnPath(progressPct);
  marker.setAttribute('transform', `translate(${markerPos.x}, ${markerPos.y})`);
  marker.style.display = 'block';
}

// ─── Journey Map: Bezier Interpolation Math (Phase 3) ───────────────
function getPositionOnPath(progressPct) {
  const t = progressPct / 100;
  
  const segments = [
    { start: {x: 180, y: 500}, ctrl: {x: 100, y: 445}, end: {x: 100, y: 390} }, 
    { start: {x: 100, y: 390}, ctrl: {x: 180, y: 335}, end: {x: 260, y: 280} }, 
    { start: {x: 260, y: 280}, ctrl: {x: 180, y: 225}, end: {x: 100, y: 170} }, 
    { start: {x: 100, y: 170}, ctrl: {x: 180, y: 115}, end: {x: 180, y: 60}  }  
  ];

  let segmentIdx = Math.min(3, Math.floor(t * 4));
  let s = (t - segmentIdx * 0.25) / 0.25; 
  s = Math.max(0, Math.min(1, s)); 

  const seg = segments[segmentIdx];
  const u = 1 - s;
  const x = u * u * seg.start.x + 2 * u * s * seg.ctrl.x + s * s * seg.end.x;
  const y = u * u * seg.start.y + 2 * u * s * seg.ctrl.y + s * s * seg.end.y;

  return { x, y };
}

// ─── Journey Map: Tooltip Box Handler (Phase 3) ─────────────────────
function showJourneyTooltip(title, desc, isCompleted) {
  const tooltip = document.getElementById('journey-tooltip');
  if (!tooltip) return;

  const titleEl = document.getElementById('tooltip-title');
  const descEl = document.getElementById('tooltip-desc');
  const statusEl = document.getElementById('tooltip-status');

  titleEl.textContent = title;
  descEl.textContent = desc;
  statusEl.textContent = isCompleted ? '✓ Completed' : 'Locked';
  statusEl.className = 'tooltip-status ' + (isCompleted ? 'completed' : 'locked');
  statusEl.style.color = isCompleted ? 'var(--accent-green)' : 'rgba(255,255,255,0.45)';

  tooltip.style.display = 'block';

  if (window.tooltipTimer) clearTimeout(window.tooltipTimer);
  window.tooltipTimer = setTimeout(() => {
    tooltip.style.display = 'none';
  }, 4000);
}

 