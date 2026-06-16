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
 