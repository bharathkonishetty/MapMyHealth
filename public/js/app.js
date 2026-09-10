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
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const mobile = document.getElementById('reg-mobile').value.trim();
  const password = document.getElementById('reg-pass').value.trim();
  const repass = document.getElementById('reg-repass').value.trim();
  const msgEl = document.getElementById('reg-msg');

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
  const password = document.getElementById('log-pass').value.trim();
  const msgEl = document.getElementById('login-msg');

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

  document.getElementById('p-name').textContent = user.name;
  document.getElementById('p-email').textContent = user.email;
  document.getElementById('p-mobile').textContent = user.mobile;

  document.getElementById('u-age').value = user.age || '';
  document.getElementById('u-height').value = user.height || '';
  document.getElementById('u-weight').value = user.weight || '';

  loadGoals();
  loadJourney();
  loadAnalytics();
  loadCheckin();
  loadHealthScore();
  loadRecommendations();
  loadCoach();
  loadDashboardHome();
}

// ─── Save Profile Stats ───────────────────────────────────────────
async function saveProfile() {
  const age = document.getElementById('u-age').value;
  const height = document.getElementById('u-height').value;
  const weight = document.getElementById('u-weight').value;

  const result = await apiPost('/api/profile', { age, height, weight });
  if (result.success) {
    showToast('Profile updated ✓');
    loadGoals();
    loadJourney();
    loadAnalytics();
    loadCheckin();
    loadHealthScore();
    loadRecommendations();
    loadCoach();
    loadDashboardHome();
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
  const modal = document.getElementById('profile-modal');
  const trigger = document.querySelector('.profile-trigger');
  if (modal && modal.style.display === 'block' &&
    !modal.contains(e.target) && !trigger.contains(e.target)) {
    modal.style.display = 'none';
  }
});

// ─── Navigation Tabs ─────────────────────────────────────────────
function switchSection(sectionId, btn) {
  // Dismiss profile modal if visible
  const m = document.getElementById('profile-modal');
  if (m) m.style.display = 'none';

  document.querySelectorAll('.section-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.dropdown-item').forEach(el => el.classList.remove('active'));

  const sectionEl = document.getElementById(sectionId);
  if (sectionEl) sectionEl.classList.add('active');

  if (btn) {
    btn.classList.add('active');
    if (btn.classList.contains('dropdown-item')) {
      const trigger = document.querySelector('.dropdown-trigger');
      if (trigger) trigger.classList.add('active');
    }
  } else {
    // If switched programmatically, try to find and highlight the button
    const matchingBtn = document.querySelector(`.nav-tab[onclick*="'${sectionId}'"]`) ||
      document.querySelector(`.dropdown-item[onclick*="'${sectionId}'"]`);
    if (matchingBtn) {
      matchingBtn.classList.add('active');
      if (matchingBtn.classList.contains('dropdown-item')) {
        const trigger = document.querySelector('.dropdown-trigger');
        if (trigger) trigger.classList.add('active');
      }
    }
  }

  if (sectionId === 'dashboard-home') {
    loadDashboardHome();
  } else if (sectionId === 'journey') {
    loadJourney();
  } else if (sectionId === 'analytics') {
    loadAnalytics();
  } else if (sectionId === 'checkin') {
    loadCheckin();
  } else if (sectionId === 'healthscore') {
    loadHealthScore();
  } else if (sectionId === 'recommendations') {
    loadRecommendations();
  } else if (sectionId === 'coach') {
    loadCoach();
  } else if (sectionId === 'goals') {
    loadGoals();
  }
}

// ─── Select Workout Day ───────────────────────────────────────────
function selectDay(day) {
  const grid = document.getElementById('workout-grid');
  const dayInfo = document.getElementById('day-info');
  const warmupSec = document.getElementById('warmup-section');

  if (!day) {
    grid.style.display = 'none';
    dayInfo.style.display = 'none';
    warmupSec.style.display = 'none';
  } else {
    const dayMap = {
      Monday: 'CHEST',
      Tuesday: 'BACK',
      Wednesday: 'SHOULDERS',
      Thursday: 'BICEPS',
      Friday: 'TRICEPS',
      Saturday: 'LEGS',
      Sunday: 'FULL BODY'
    };
    grid.style.display = 'flex';
    dayInfo.style.display = 'block';
    warmupSec.style.display = 'block';
    dayInfo.textContent = `${day.toUpperCase()} — ${dayMap[day] || 'SELECT MUSCLE'}`;
  }
}

// ─── Exercise Data ────────────────────────────────────────────────
const workoutData = {
  'Warmup': [
    { name: 'Jumping Jacks', video: 'https://www.youtube.com/watch?v=UpH7RmJsmUY' },
    { name: 'Arm Circles', video: 'https://www.youtube.com/watch?v=OAg0YGxKPzI' },
    { name: 'Leg Swings', video: 'https://www.youtube.com/watch?v=3p8EBPVZ2Iw' },
    { name: 'Torso Twists', video: 'https://www.youtube.com/watch?v=ExR0m8W5YOc' },
    { name: 'Shoulder Rolls', video: 'https://www.youtube.com/watch?v=2Ew6yq7zZ4A' },
    { name: 'March in Place', video: 'https://www.youtube.com/watch?v=4n8F7q9zZ2A' }
  ],
  'Chest': [
    { name: 'Standard Pushups', video: 'https://www.youtube.com/watch?v=WDIpL0pjun0' },
    { name: 'Bench Press', video: 'https://www.youtube.com/shorts/hWbUlkb5Ms4' },
    { name: 'Chest Press', video: 'https://www.youtube.com/watch?v=VmB1G1K7v94' },
    { name: 'Pec Flys', video: 'https://www.youtube.com/shorts/g3T7LsEeDWQ' },
    { name: 'Incline Press', video: 'https://www.youtube.com/shorts/ou6s32mJgjU' }
  ],
  'Shoulders': [
    { name: 'Overhead Press', video: 'https://www.youtube.com/watch?v=F3QY5vMz_6I' },
    { name: 'Lateral Raises', video: 'https://www.youtube.com/watch?v=geenhiHju-o' },
    { name: 'Front Raises', video: 'https://www.youtube.com/watch?v=-t7fuZ0KhDA' },
    { name: 'Reverse Flys', video: 'https://www.youtube.com/watch?v=rtkvodbZfGY' },
    { name: 'Shrugs', video: 'https://www.youtube.com/watch?v=cJRVVxmytaM' }
  ],
  'Back': [
    { name: 'Pull Ups', video: 'https://www.youtube.com/watch?v=eGo4IYlbE5g' },
    { name: 'Rear Pec Flys', video: 'https://www.youtube.com/watch?v=JL8nHvZcAK8' },
    { name: 'Lat Pulldowns', video: 'https://www.youtube.com/watch?v=lSt1oTrZ_Cc' },
    { name: 'Seated Cable Rows', video: 'https://www.youtube.com/watch?v=GZbfZ033f74' },
    { name: 'Deadlifts', video: 'https://www.youtube.com/watch?v=XxWcirHIwVo' }
  ],
  'Biceps': [
    { name: 'Dumbbell Curls', video: 'https://www.youtube.com/watch?v=zC3nLlEvin4' },
    { name: 'Hammer Curls', video: 'https://www.youtube.com/watch?v=32W1sB5DkHY' },
    { name: 'Concentration Curls', video: 'https://www.youtube.com/watch?v=Jvj2wV0vOYU' },
    { name: 'Preacher Curls', video: 'https://www.youtube.com/watch?v=Gydpcouclx8' },
    { name: 'Barbell Curls', video: 'https://www.youtube.com/watch?v=N6paU6TGFWU' }
  ],
  'Legs': [
    { name: 'Bodyweight Squats', video: 'https://www.youtube.com/watch?v=P-yaD24bUE8' },
    { name: 'Lunges', video: 'https://www.youtube.com/watch?v=wrwwXE_x-pQ' },
    { name: 'Calf Raises', video: 'https://www.youtube.com/watch?v=c5Kv6-fnTj8' },
    { name: 'Leg Extensions', video: 'https://www.youtube.com/watch?v=YyvSfVjQeL0' },
    { name: 'Hamstring Curls', video: 'https://www.youtube.com/shorts/Lh3iMIcbkBQ' },
    { name: 'Glute Bridges', video: 'https://www.youtube.com/watch?v=OUgsJ8-Vi0E' }
  ],
  'Triceps': [
    { name: 'Tricep Dips', video: 'https://www.youtube.com/watch?v=thx13oPVK5c' },
    { name: 'Diamond Pushups', video: 'https://www.youtube.com/watch?v=t2cR426fFx0' },
    { name: 'Tricep Kickbacks', video: 'https://www.youtube.com/watch?v=3Bv1n7-DN7c' },
    { name: 'Overhead Tricep Extensions', video: 'https://www.youtube.com/watch?v=fYqswDVbJDg' },
    { name: 'Cable Tricep Pushdowns', video: 'https://www.youtube.com/watch?v=_w-HpW70nSQ' }
  ]
};

// ─── Open Exercise Popup ──────────────────────────────────────────
function openExercise(muscle) {
  const view = document.getElementById('exercise-view');
  const overlay = document.getElementById('screen-overlay');
  const list = document.getElementById('ex-list');

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

  view.style.display = 'block';
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
  const pausedArea = document.getElementById('paused-goals-area');
  const pastArea = document.getElementById('past-goals-area');
  const newBtn = document.getElementById('btn-new-goal');
  const countBadge = document.getElementById('goals-count-badge');
  if (!activeArea) return;

  const activeGoals = goals.filter(g => g.status === 'active');
  const pausedGoals = goals.filter(g => g.status === 'paused');
  const pastGoals = goals.filter(g => g.status === 'completed' || g.status === 'cancelled');

  if (countBadge) {
    countBadge.textContent = `${activeGoals.length} / 3 Active`;
  }

  if (newBtn) {
    if (activeGoals.length >= 3) {
      newBtn.disabled = true;
      newBtn.classList.add('disabled');
      newBtn.title = 'Maximum 3 active goals reached. Complete or pause an existing goal to set a new one.';
    } else {
      newBtn.disabled = false;
      newBtn.classList.remove('disabled');
      newBtn.title = 'Set a new health goal';
    }
  }

  // 1. Active Goals Area
  if (activeGoals.length === 0) {
    activeArea.innerHTML = `
      <div class="goals-empty">
        <i class="fas fa-bullseye"></i>
        <h3>No active goal right now</h3>
        <p>You can have up to 3 concurrent active goals. Set a goal to track your fitness journey.</p>
        <button class="btn-main" style="width:auto;padding:12px 28px;margin-top:12px;" onclick="openGoalModal()">
          <i class="fas fa-plus"></i>&nbsp; Set My First Goal
        </button>
      </div>`;
  } else {
    activeArea.innerHTML = `
      <div class="active-goals-grid">
        ${activeGoals.map(goalCardHTML).join('')}
      </div>`;
  }

  // 2. Paused Goals Area
  if (pausedArea) {
    if (pausedGoals.length > 0) {
      pausedArea.innerHTML = `
        <div class="paused-goals-section">
          <p class="past-goals-title"><i class="fas fa-pause-circle" style="color:var(--warning-amber);margin-right:6px;"></i> Paused Goals (${pausedGoals.length})</p>
          <div class="paused-goals-grid">
            ${pausedGoals.map(pausedGoalCardHTML).join('')}
          </div>
        </div>`;
    } else {
      pausedArea.innerHTML = '';
    }
  }

  // 3. Past Goals Area (Completed & Cancelled)
  if (pastArea) {
    if (pastGoals.length > 0) {
      pastArea.innerHTML = `
        <div class="past-goals-section">
          <p class="past-goals-title">Past Goals (${pastGoals.length})</p>
          <div class="past-goals-list">
            ${pastGoals.map(g => `
              <div class="past-goal-item">
                <div class="past-goal-info">
                  <h4>${escapeHtml(g.goal_name || goalTypeLabel(g.goal_type))}</h4>
                  <p>${g.start_weight} kg → ${g.target_weight} kg &nbsp;·&nbsp; Target: ${formatDate(g.target_date)}</p>
                </div>
                <span class="status-badge-${g.status}">${capitalize(g.status)}</span>
              </div>`).join('')}
          </div>
        </div>`;
    } else {
      pastArea.innerHTML = '';
    }
  }
}

// ─── Goals: Active Card HTML ───────────────────────────────────────
function goalCardHTML(g) {
  const daysLeft = Math.max(0, Math.ceil((new Date(g.target_date) - new Date()) / (1000 * 60 * 60 * 24)));
  const badgeClass = `badge-${g.goal_type}`;

  // Nutrition targets markup if defined
  let macrosHTML = '';
  if (g.target_calories || g.target_protein_g || g.target_carbs_g || g.target_fats_g) {
    macrosHTML = `
      <div class="goal-macro-targets">
        ${g.target_calories ? `<span class="macro-chip cal"><i class="fas fa-fire"></i> ${g.target_calories} kcal</span>` : ''}
        ${g.target_protein_g ? `<span class="macro-chip prot"><i class="fas fa-drumstick-bite"></i> ${g.target_protein_g}g P</span>` : ''}
        ${g.target_carbs_g ? `<span class="macro-chip carb"><i class="fas fa-wheat-awn"></i> ${g.target_carbs_g}g C</span>` : ''}
        ${g.target_fats_g ? `<span class="macro-chip fat"><i class="fas fa-droplet"></i> ${g.target_fats_g}g F</span>` : ''}
      </div>
    `;
  }

  return `
    <div class="goal-card">
      <div class="goal-card-header">
        <div class="goal-card-title">
          <h3>${escapeHtml(g.goal_name || goalTypeLabel(g.goal_type))}</h3>
          <span class="goal-type-badge ${badgeClass}">${goalTypeLabel(g.goal_type)}</span>
        </div>
        <div class="goal-card-actions">
          <button class="btn-goal-edit" title="Edit goal" onclick="openGoalModal('${g.id}')">
            <i class="fas fa-pen"></i> Edit
          </button>
          <button class="btn-goal-pause" title="Pause goal" onclick="updateGoalStatus('${g.id}','paused')">
            <i class="fas fa-pause"></i> Pause
          </button>
          <button class="btn-goal-complete" title="Mark as completed" onclick="updateGoalStatus('${g.id}','completed')">
            <i class="fas fa-check"></i> Complete
          </button>
          <button class="btn-goal-cancel-action" title="Cancel goal" onclick="updateGoalStatus('${g.id}','cancelled')">
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

      ${macrosHTML}

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

// ─── Goals: Paused Card HTML ───────────────────────────────────────
function pausedGoalCardHTML(g) {
  const badgeClass = `badge-${g.goal_type}`;
  return `
    <div class="goal-card paused">
      <div class="goal-card-header">
        <div class="goal-card-title">
          <h3>${escapeHtml(g.goal_name || goalTypeLabel(g.goal_type))}</h3>
          <span class="goal-type-badge ${badgeClass}">${goalTypeLabel(g.goal_type)}</span>
          <span class="status-badge-paused">Paused</span>
        </div>
        <div class="goal-card-actions">
          <button class="btn-goal-resume" onclick="updateGoalStatus('${g.id}','active')">
            <i class="fas fa-play"></i> Resume
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

      <div class="goal-days">
        Target: ${formatDate(g.target_date)} · Paused
      </div>
    </div>`;
}

// ─── Goals: Open Modal ─────────────────────────────────────────────
async function openGoalModal(goalId) {
  const overlay = document.getElementById('goal-modal-overlay');
  const modal = document.getElementById('goal-modal');
  const title = document.getElementById('goal-modal-title');
  const submit = document.getElementById('btn-goal-submit');
  const msg = document.getElementById('goal-modal-msg');

  // Reset fields
  document.getElementById('goal-edit-id').value = '';
  document.getElementById('goal-name').value = '';
  document.getElementById('goal-type-value').value = '';
  document.getElementById('goal-start-weight').value = '';
  document.getElementById('goal-target-weight').value = '';
  document.getElementById('goal-target-date').value = '';
  document.getElementById('goal-target-calories').value = '';
  document.getElementById('goal-target-protein').value = '';
  document.getElementById('goal-target-carbs').value = '';
  document.getElementById('goal-target-fats').value = '';
  document.getElementById('goal-start-weight').disabled = false;
  msg.textContent = '';
  msg.className = 'msg';
  document.querySelectorAll('.goal-type-option').forEach(el => {
    el.classList.remove('selected');
    el.style.pointerEvents = '';
    el.style.opacity = '';
  });

  if (goalId) {
    title.textContent = 'Edit Goal';
    submit.textContent = 'Save Changes';
    document.getElementById('goal-edit-id').value = goalId;

    const data = await apiGet('/api/goals');
    if (data.success) {
      const g = data.goals.find(g => g.id === goalId);
      if (g) {
        document.getElementById('goal-name').value = g.goal_name || '';
        document.getElementById('goal-start-weight').value = g.start_weight;
        document.getElementById('goal-target-weight').value = g.target_weight;
        document.getElementById('goal-target-date').value = (g.target_date || '').split('T')[0];
        if (g.target_calories) document.getElementById('goal-target-calories').value = g.target_calories;
        if (g.target_protein_g) document.getElementById('goal-target-protein').value = g.target_protein_g;
        if (g.target_carbs_g) document.getElementById('goal-target-carbs').value = g.target_carbs_g;
        if (g.target_fats_g) document.getElementById('goal-target-fats').value = g.target_fats_g;
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
    title.textContent = 'Set New Goal';
    submit.textContent = 'Create Goal';
  }

  overlay.style.display = 'block';
  modal.style.display = 'block';
}

// ─── Goals: Close Modal ───────────────────────────────────────────
function closeGoalModal() {
  document.getElementById('goal-modal-overlay').style.display = 'none';
  document.getElementById('goal-modal').style.display = 'none';
  document.getElementById('goal-start-weight').disabled = false;
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
  const editId = document.getElementById('goal-edit-id').value;
  const goal_name = document.getElementById('goal-name').value.trim();
  const goal_type = document.getElementById('goal-type-value').value;
  const start_weight = document.getElementById('goal-start-weight').value;
  const target_weight = document.getElementById('goal-target-weight').value;
  const target_date = document.getElementById('goal-target-date').value;
  const target_calories = document.getElementById('goal-target-calories').value;
  const target_protein_g = document.getElementById('goal-target-protein').value;
  const target_carbs_g = document.getElementById('goal-target-carbs').value;
  const target_fats_g = document.getElementById('goal-target-fats').value;
  const msg = document.getElementById('goal-modal-msg');

  msg.textContent = '';
  msg.className = 'msg';

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
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (new Date(target_date) <= today) {
    msg.textContent = 'Target date must be in the future.'; msg.className = 'msg error'; return;
  }

  const payload = {
    goal_name,
    target_weight: parseFloat(target_weight),
    target_date,
    target_calories: target_calories ? parseInt(target_calories, 10) : null,
    target_protein_g: target_protein_g ? parseInt(target_protein_g, 10) : null,
    target_carbs_g: target_carbs_g ? parseInt(target_carbs_g, 10) : null,
    target_fats_g: target_fats_g ? parseInt(target_fats_g, 10) : null
  };

  let result;
  if (editId) {
    result = await fetch(`/api/goals/${editId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(r => r.json());
  } else {
    payload.goal_type = goal_type;
    payload.start_weight = parseFloat(start_weight);
    result = await apiPost('/api/goals', payload);
  }

  if (result.success) {
    closeGoalModal();
    await loadGoals();
    loadJourney();
    loadAnalytics();
    loadCheckin();
    loadHealthScore();
    loadRecommendations();
    loadCoach();
    loadDashboardHome();
    showToast(editId ? '✓ Goal updated.' : '✓ Goal created! Your journey has begun.');
  } else {
    msg.textContent = result.message;
    msg.className = 'msg error';
  }
}

// ─── Goals: Update Status (Pause, Resume, Complete, Cancel) ────────
async function updateGoalStatus(goalId, status) {
  let promptMsg = '';
  if (status === 'completed') {
    promptMsg = 'Mark this goal as completed? This cannot be undone.';
  } else if (status === 'paused') {
    promptMsg = 'Pause this goal? You can resume it anytime when you have fewer than 3 active goals.';
  } else if (status === 'active') {
    promptMsg = 'Resume this goal as active?';
  } else if (status === 'cancelled') {
    promptMsg = 'Cancel this goal? This cannot be undone.';
  }

  if (promptMsg && !confirm(promptMsg)) return;

  const result = await fetch(`/api/goals/${goalId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  }).then(r => r.json());

  if (result.success) {
    await loadGoals();
    loadJourney();
    loadAnalytics();
    loadCheckin();
    loadHealthScore();
    loadRecommendations();
    loadCoach();
    loadDashboardHome();

    let toastText = 'Goal updated.';
    if (status === 'completed') toastText = '🎉 Goal completed! Excellent job.';
    else if (status === 'paused') toastText = '⏸️ Goal paused.';
    else if (status === 'active') toastText = '▶️ Goal resumed as active!';
    else if (status === 'cancelled') toastText = 'Goal cancelled.';

    showToast(toastText);
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
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

// ─── Enter key support for forms ──────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const loginForm = document.getElementById('login-form');
  const regForm = document.getElementById('reg-form');
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
      { x: 180, y: 500 }, // Seq 0 - Starting Point
      { x: 100, y: 390 }, // Seq 1 - First Step
      { x: 260, y: 280 }, // Seq 2 - Halfway Hero
      { x: 100, y: 170 }, // Seq 3 - Momentum
      { x: 180, y: 60 }   // Seq 4 - Destination
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
    const activeClass = !m.is_completed && (idx === 0 || milestones[idx - 1]?.is_completed) ? 'active' : '';
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
    { start: { x: 180, y: 500 }, ctrl: { x: 100, y: 445 }, end: { x: 100, y: 390 } },
    { start: { x: 100, y: 390 }, ctrl: { x: 180, y: 335 }, end: { x: 260, y: 280 } },
    { start: { x: 260, y: 280 }, ctrl: { x: 180, y: 225 }, end: { x: 100, y: 170 } },
    { start: { x: 100, y: 170 }, ctrl: { x: 180, y: 115 }, end: { x: 180, y: 60 } }
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

// ─── Analytics: Load (Phase 4) ──────────────────────────────────────
async function loadAnalytics() {
  const container = document.getElementById('analytics-main-area');
  const badgeContainer = document.getElementById('analytics-status-badge-container');
  if (!container) return;

  if (badgeContainer) badgeContainer.innerHTML = '';
  container.innerHTML = `
    <div style="text-align:center;padding:50px 0;color:rgba(255,255,255,0.4);">
      <i class="fas fa-spinner fa-spin" style="font-size:2rem;margin-bottom:12px;"></i>
      <p>Loading progress analytics...</p>
    </div>`;

  try {
    const response = await fetch('/api/progress/analytics').then(r => r.json());
    let progressSignals = null;
    try {
      const signalsRes = await fetch('/api/progress/signals').then(r => r.json());
      if (signalsRes && signalsRes.success) progressSignals = signalsRes;
    } catch (signalErr) {
      console.error('Progress signals fetch failed (non-critical):', signalErr);
    }
    let goalAchievement = null;
    try {
      const achieveRes = await fetch('/api/goals/achievement').then(r => r.json());
      if (achieveRes && achieveRes.success) goalAchievement = achieveRes;
    } catch (achieveErr) {
      console.error('Goal achievement fetch failed (non-critical):', achieveErr);
    }
    let personalizedRec = null;
    try {
      const recRes = await fetch('/api/recommendations/personalized').then(r => r.json());
      if (recRes && recRes.success) personalizedRec = recRes;
    } catch (recErr) {
      console.error('Personalized rec fetch failed (non-critical):', recErr);
    }
    if (response.success) {
      renderAnalyticsView(response, progressSignals, goalAchievement, personalizedRec);
    } else {
      container.innerHTML = `
        <div class="journey-empty-card">
          <i class="fas fa-circle-exclamation" style="color:var(--danger-red);"></i>
          <h3>Failed to load analytics</h3>
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

// ─── Progress Signal Note: Render Helper (Capability 3) ─────────────
function renderProgressSignalNote(progressSignals) {
  if (!progressSignals || !progressSignals.primary) return '';
  const p = progressSignals.primary;
  if (p.type === 'none' || p.type === 'insufficient') return '';
  const typeClass = 'signal-' + String(p.type || 'none').replace(/_/g, '-');
  return `
          <div class="progress-signal-note ${typeClass}" style="margin-top: 14px; display: flex; align-items: flex-start; gap: 14px;">
            <span class="badge-signal ${typeClass}">${escapeHtml(p.title || 'Progress note')}</span>
            <p style="margin: 0; line-height: 1.5; font-size: 13px;">${escapeHtml(p.explanation || '')}</p>
          </div>`;
}

// ─── Capability 4 Preview Note: Render Helper (Analytics Preview) ───
function renderAnalyticsRecPreview(personalizedRec) {
  if (!personalizedRec || !personalizedRec.primary) return '';
  const p = personalizedRec.primary;
  const priority = p.priority || 'medium';
  return `
    <div class="analytics-rec-preview-box" style="margin-top: 14px; background: rgba(20, 184, 166, 0.06); border: 1px solid rgba(20, 184, 166, 0.22); border-radius: 12px; padding: 14px 16px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
        <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: var(--primary-teal); display: flex; align-items: center; gap: 6px;">
          <i class="fas fa-compass"></i> Recommended Next Focus
        </span>
        <span class="prio-badge badge-${priority}" style="font-size: 10px; padding: 2px 8px;">${priority.toUpperCase()} PRIORITY</span>
      </div>
      <h4 style="margin: 0 0 4px 0; font-size: 13.5px; font-weight: 700; color: #fff;">${escapeHtml(p.title)}</h4>
      <p style="margin: 0 0 10px 0; font-size: 12.5px; color: rgba(255,255,255,0.75); line-height: 1.45;">${escapeHtml(p.action)}</p>
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
        <span style="font-size: 11.5px; color: rgba(255,255,255,0.5);"><i class="fas fa-circle-question"></i> ${escapeHtml(p.reason)}</span>
        <button class="btn-text-link" onclick="switchSection('recommendations', document.querySelector('.nav-tab[onclick*=\\'recommendations\\']'))" style="font-size: 12px; color: var(--primary-teal); background: none; border: none; padding: 0; cursor: pointer; font-weight: 600; white-space: nowrap;">
          View Recommendations <i class="fas fa-arrow-right" style="font-size: 10px;"></i>
        </button>
      </div>
    </div>
  `;
}

// ─── Goal Achievement: Render Helper (Capability 2) ─────────────────
function renderGoalAchievementCard(goalAchievement) {
  if (!goalAchievement) return '';

  if (goalAchievement.status === 'no_goal') {
    return `
      <div class="analytics-card goal-achievement-card">
        <div class="achievement-header-row">
          <div class="achievement-title-area">
            <i class="fas fa-bullseye" style="color:var(--primary);"></i>
            <h3>Goal Achievement</h3>
          </div>
        </div>
        <p style="margin: 12px 0 0; color: var(--text-secondary); font-size: 13px; line-height: 1.5;">
          Analytics requires an active goal to perform trajectory predictions and estimate achievement timelines.
        </p>
      </div>`;
  }

  if (goalAchievement.status === 'insufficient_data') {
    const obs = goalAchievement.evidence ? goalAchievement.evidence.observations : 0;
    const span = goalAchievement.evidence ? goalAchievement.evidence.spanDays : 0;
    return `
      <div class="analytics-card goal-achievement-card">
        <div class="achievement-header-row">
          <div class="achievement-title-area">
            <i class="fas fa-bullseye" style="color:var(--primary);"></i>
            <h3>Goal Achievement</h3>
          </div>
          <span class="badge-status-insufficient" style="padding: 3px 10px; font-size: 10.5px; font-weight: 700;">INSUFFICIENT DATA</span>
        </div>
        <div class="achievement-guidance-box" style="margin-top: 14px;">
          <i class="fas fa-chart-line" style="color:var(--primary); font-size: 16px; margin-top: 2px;"></i>
          <div>
            <h4 style="margin: 0 0 4px; font-size: 13px; font-weight: 700; color: var(--text-primary);">Not enough personal history yet</h4>
            <p style="margin: 0; line-height: 1.5; font-size: 13px; color: var(--text-secondary);">
              Keep logging your weight so MapMyHealth can estimate your goal trajectory. We require at least 5 check-ins across 10 or more calendar days.
            </p>
            <div style="margin-top: 8px; font-size: 11.5px; color: rgba(255,255,255,0.45);">
              Current data: <strong>${obs} check-in${obs === 1 ? '' : 's'}</strong> across <strong>${span} calendar day${span === 1 ? '' : 's'}</strong>.
            </div>
          </div>
        </div>
      </div>`;
  }

  const g = goalAchievement.goal || {};
  const o = goalAchievement.outlook || {};
  const f = goalAchievement.forecast || {};
  const c = goalAchievement.confidence || {};
  const p = goalAchievement.progress || {};
  const t = goalAchievement.trend || {};
  const b = goalAchievement.behavioralContext || null;

  // Outlook Badge Class & Label
  let outlookBadgeClass = 'ontrack';
  if (o.status === 'achieved') outlookBadgeClass = 'ahead';
  else if (o.status === 'on_track' || o.status === 'stable') outlookBadgeClass = 'ontrack';
  else if (o.status === 'slow_progress') outlookBadgeClass = 'warning-gold';
  else if (o.status === 'at_risk' || o.status === 'drifting_up' || o.status === 'drifting_down') outlookBadgeClass = 'behind';
  else if (o.status === 'moving_away' || o.status === 'above_zone' || o.status === 'below_zone') outlookBadgeClass = 'behind';

  const outlookBadge = `<span class="badge-status-${outlookBadgeClass}" style="padding: 3px 10px; font-size: 10.5px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">${escapeHtml(o.title || o.status || 'Outlook')}</span>`;

  // Confidence Badge Class
  const confClass = c.level === 'high' ? 'ahead' : (c.level === 'moderate' ? 'ontrack' : 'insufficient');
  const confBadge = `<span class="badge-status-${confClass}" style="padding: 2px 8px; font-size: 10px; font-weight: 700; text-transform: capitalize;">${escapeHtml(c.level || 'Moderate')} Confidence</span>`;

  // Goal type descriptor
  const goalTypeFormatted = g.type ? (g.type === 'weight_loss' ? 'Weight-loss goal' : (g.type === 'muscle_gain' ? 'Muscle-gain goal' : 'Maintenance goal')) : 'Active goal';

  // Completion Time String
  let completionStr = 'N/A';
  if (o.status === 'achieved') {
    completionStr = '<span style="color: var(--success); font-weight: 700;">Target Achieved!</span>';
  } else if (f.estimatedWeeksRemaining !== null && f.estimatedCompletionDate) {
    completionStr = `~${f.estimatedWeeksRemaining} weeks <span style="font-size: 11.5px; color: var(--text-secondary); font-weight: 400;">(${formatDate(f.estimatedCompletionDate)})</span>`;
  } else if (g.type === 'maintenance') {
    completionStr = '<span style="color: var(--text-secondary); font-size: 12px;">Ongoing zone maintenance</span>';
  } else if (o.status === 'at_risk') {
    completionStr = '<span style="color: #F59E0B; font-size: 12px;">Stalled (insufficient trend)</span>';
  } else if (o.status === 'moving_away') {
    completionStr = '<span style="color: var(--danger); font-size: 12px;">Moving away from target</span>';
  }

  return `
    <div class="analytics-card goal-achievement-card">
      <div class="achievement-header-row">
        <div class="achievement-title-area">
          <i class="fas fa-bullseye" style="color:var(--primary);"></i>
          <h3>Goal Achievement</h3>
          <span class="achievement-type-tag">${goalTypeFormatted}</span>
        </div>
        ${outlookBadge}
      </div>

      <div class="metrics-panel-stack" style="gap:10px; margin-top: 14px;">
        <div class="insight-stat-row">
          <span class="label">Current Weight</span>
          <span class="val highlight">${g.currentWeight != null ? g.currentWeight + ' kg' : 'N/A'}</span>
        </div>
        <div class="insight-stat-row">
          <span class="label">Target Weight</span>
          <span class="val" style="color:var(--accent-green);">${g.targetWeight != null ? g.targetWeight + ' kg' : 'N/A'}</span>
        </div>
        <div class="insight-stat-row">
          <span class="label">${g.type === 'maintenance' ? 'Zone Deviation' : 'Remaining Distance'}</span>
          <span class="val">${g.remainingKg != null ? g.remainingKg + ' kg' : '0 kg'}</span>
        </div>
        <div class="insight-stat-row">
          <span class="label">Observed Velocity</span>
          <span class="val">${escapeHtml(t.label || (t.slopeKgPerWeek != null ? t.slopeKgPerWeek + ' kg/week' : 'N/A'))}</span>
        </div>
        <div class="insight-stat-row">
          <span class="label">Estimated Completion</span>
          <span class="val" style="display: flex; align-items: center; gap: 6px;">${completionStr}</span>
        </div>
        <div class="insight-stat-row">
          <span class="label">Prediction Confidence</span>
          <span class="val">${confBadge}</span>
        </div>
      </div>

      <div class="analytics-progress-wrapper" style="margin-top: 16px;">
        <div class="analytics-progress-label">
          <span>Overall Goal Progress</span>
          <span style="font-weight:700;color:var(--primary-teal);">${p.percentage != null ? p.percentage : 0}%</span>
        </div>
        <div class="analytics-progress-bg">
          <div class="analytics-progress-fill" style="width:${p.percentage != null ? p.percentage : 0}%;"></div>
        </div>
      </div>

      <!-- Trajectory Outlook Explanation Box -->
      <div class="achievement-guidance-box" style="margin-top: 16px;">
        <i class="fas fa-compass" style="color:var(--primary); font-size: 15px; margin-top: 2px;"></i>
        <div>
          <p style="margin: 0; line-height: 1.5; font-size: 13px; color: var(--text-primary); font-weight: 500;">
            ${escapeHtml(o.explanation || '')}
          </p>
          ${b && b.note ? `<p style="margin: 6px 0 0; line-height: 1.45; font-size: 12px; color: var(--text-secondary);">${escapeHtml(b.note)}</p>` : ''}
          ${c && c.reason ? `<div style="margin-top: 6px; font-size: 11px; color: rgba(255,255,255,0.4);">${escapeHtml(c.reason)}</div>` : ''}
        </div>
      </div>

      <div class="achievement-disclaimer">
        Personalized trajectory prediction based on your logged history — not a clinical medical model.
      </div>
    </div>`;
}

// ─── Analytics: Render (Phase 4) ────────────────────────────────────
function renderAnalyticsView(data, progressSignals, goalAchievement, personalizedRec = null) {
  const container = document.getElementById('analytics-main-area');
  const badgeContainer = document.getElementById('analytics-status-badge-container');
  if (!container) return;

  if (!data.activeGoal) {
    if (badgeContainer) badgeContainer.innerHTML = '';
    container.innerHTML = `
      <div class="journey-empty-card">
        <i class="fas fa-chart-column"></i>
        <h3>No Active Goal</h3>
        <p>Analytics requires an active goal parameters to perform velocity trends and completion forecasts. Create an active goal to get started.</p>
        <button class="btn-main" style="width:auto;padding:12px 28px;" onclick="switchSection('goals', document.querySelector('.nav-tab[onclick*=\\'goals\\']'))">
          <i class="fas fa-plus"></i>&nbsp; Set My Active Goal
        </button>
      </div>`;
    return;
  }

  // Populate Header Status Badge
  if (badgeContainer) {
    badgeContainer.innerHTML = `<span class="badge-status-${data.forecast.status}">${data.forecast.statusLabel}</span>`;
  }

  const g = data.activeGoal;
  const cw = data.currentWeight;
  const pct = data.progressPct;
  const history = data.weightHistory || [];

  // Estimated Date display with Confidence badge immediately next to it
  const estDateStr = data.forecast.estimatedDate === 'N/A' || data.forecast.estimatedDate === 'Infinite' || data.forecast.estimatedDate === 'Stable'
    ? data.forecast.estimatedDate
    : formatDate(data.forecast.estimatedDate);

  const confidenceClass = data.forecast.confidence === 'High' ? 'ahead' : (data.forecast.confidence === 'Medium' ? 'ontrack' : 'insufficient');
  const confidenceBadge = `<span class="badge-status-${confidenceClass}" style="margin-left: 8px; padding: 2px 8px; font-size: 10px; display: inline-flex; vertical-align: middle;">${data.forecast.confidence} Confidence</span>`;

  let varianceText = 'N/A';
  let varianceClass = '';
  if (data.forecast.daysDifference !== null) {
    if (data.forecast.daysDifference > 3) {
      varianceText = `${Math.round(data.forecast.daysDifference)} days ahead`;
      varianceClass = 'val highlight';
    } else if (data.forecast.daysDifference < -3) {
      varianceText = `${Math.round(Math.abs(data.forecast.daysDifference))} days behind`;
      varianceClass = 'val warning-gold';
    } else {
      varianceText = 'On track';
      varianceClass = 'val highlight';
    }
  }

  container.innerHTML = `
    <div class="analytics-grid">
      <!-- Column A: Progress & Projections Metrics Cards -->
      <div class="metrics-panel-stack">
        
        <!-- Card 1: Goal Progress Stats -->
        <div class="analytics-card">
          <h3>Goal & Weight Progress</h3>
          <div class="metrics-panel-stack" style="gap:10px;">
            <div class="insight-stat-row">
              <span class="label">Current Goal</span>
              <span class="val">${escapeHtml(g.goal_name || goalTypeLabel(g.goal_type))}</span>
            </div>
            <div class="insight-stat-row">
              <span class="label">Starting Weight</span>
              <span class="val">${g.start_weight} kg</span>
            </div>
            <div class="insight-stat-row">
              <span class="label">Current Weight</span>
              <span class="val highlight">${cw} kg</span>
            </div>
            <div class="insight-stat-row">
              <span class="label">Target Weight</span>
              <span class="val" style="color:var(--accent-green);">${g.target_weight} kg</span>
            </div>
          </div>
          
          <div class="analytics-progress-wrapper">
            <div class="analytics-progress-label">
              <span>Goal Completion Progress</span>
              <span style="font-weight:700;color:var(--primary-teal);">${pct}%</span>
            </div>
            <div class="analytics-progress-bg">
              <div class="analytics-progress-fill" style="width:${pct}%;"></div>
            </div>
          </div>
        </div>

        <!-- Card 2: Timeline & Forecast Projections (Capability 1) -->
        <div class="analytics-card">
          <h3>Goal Completion Forecast</h3>
          <div class="metrics-panel-stack" style="gap:10px;">
            <div class="insight-stat-row">
              <span class="label">Target Completion Date</span>
              <span class="val">${formatDate(g.target_date)}</span>
            </div>
            <div class="insight-stat-row">
              <span class="label">Calendar Days Remaining</span>
              <span class="val">${data.timeline.daysRemaining} days</span>
            </div>
            <div class="insight-stat-row">
              <span class="label">Projected Date</span>
              <span class="val" style="display: flex; align-items: center;">
                ${estDateStr}
                ${confidenceBadge}
              </span>
            </div>
            <div class="insight-stat-row">
              <span class="label">Schedule Variance</span>
              <span class="${varianceClass || 'val'}">${varianceText}</span>
            </div>
          </div>
        </div>

        <!-- Card 3: Goal Achievement Prediction (Capability 2) -->
        ${renderGoalAchievementCard(goalAchievement)}
      </div>

      <!-- Column B: Interactive Weight Chart & Weekly Velocity Insights -->
      <div class="metrics-panel-stack">
        <div class="analytics-card">
          <h3>30-Day Weight Trend</h3>
          <div class="chart-canvas-container" id="weight-chart-container">
            <!-- Custom SVG weight chart will draw here -->
          </div>

          <!-- Velocity Insights Guidance Box -->
          <div class="coach-guidance-box" style="margin-top: 18px; display: flex; align-items: flex-start; gap: 14px;">
            <i class="fas fa-chart-line" style="font-size: 1.25rem; color: var(--primary-teal); margin-top: 2px;"></i>
            <div>
              <p style="margin: 0; line-height: 1.5; font-size: 13px;">${escapeHtml(data.forecast.insights)}</p>
            </div>
          </div>
          ${renderProgressSignalNote(progressSignals)}
          ${renderAnalyticsRecPreview(personalizedRec)}
        </div>
      </div>
    </div>
  `;

  // Draw Weight Chart with history logs
  drawWeightChart(history);
}

// ─── Analytics: Custom SVG Weight Chart (Phase 4) ────────────────────
function drawWeightChart(logs) {
  const chartContainer = document.getElementById('weight-chart-container');
  if (!chartContainer) return;

  if (!logs || logs.length < 2) {
    chartContainer.innerHTML = `
      <div style="height:100%; display:flex; align-items:center; justify-content:center; color:rgba(255,255,255,0.35); font-size:13px; text-align:center; padding: 20px; border: 1px dashed rgba(255,255,255,0.08); border-radius: 12px; min-height: 160px;">
        <div>
          <i class="fas fa-chart-area" style="font-size: 24px; margin-bottom: 8px; opacity: 0.5;"></i>
          <p>Please log your weight on at least two different days to generate weight trend visualization.</p>
        </div>
      </div>`;
    return;
  }

  // Setup dimensions
  const width = 500;
  const height = 200;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;

  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  // Find boundaries
  const weights = logs.map(l => l.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);

  // Buffer range to prevent collapse
  const weightRange = maxW - minW;
  const rangeMin = weightRange === 0 ? minW - 2 : minW - (weightRange * 0.1 || 1);
  const rangeMax = weightRange === 0 ? maxW + 2 : maxW + (weightRange * 0.1 || 1);
  const delta = rangeMax - rangeMin;

  // Calculate scaling coordinates
  const points = logs.map((log, i) => {
    const x = padLeft + (i / (logs.length - 1)) * chartWidth;
    const y = height - padBottom - ((log.weight - rangeMin) / delta) * chartHeight;
    return { x, y, log_date: log.log_date, weight: log.weight };
  });

  // Build SVG Content
  // 1. Grid guide values
  const yValTop = rangeMax;
  const yValMid = (rangeMin + rangeMax) / 2;
  const yValBot = rangeMin;

  const yPosTop = padTop;
  const yPosMid = padTop + chartHeight / 2;
  const yPosBot = height - padBottom;

  // 2. Build paths
  let linePath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    linePath += ` L ${points[i].x} ${points[i].y}`;
  }

  let fillPath = `${linePath} L ${points[points.length - 1].x} ${height - padBottom} L ${points[0].x} ${height - padBottom} Z`;

  function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  const svgHTML = `
    <svg viewBox="0 0 500 200" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="overflow: visible;">
      <defs>
        <linearGradient id="chart-glow-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--primary-teal)" stop-opacity="0.25" />
          <stop offset="100%" stop-color="var(--primary-teal)" stop-opacity="0.0" />
        </linearGradient>
      </defs>

      <!-- Horizontal Grid Lines -->
      <line x1="${padLeft}" y1="${yPosTop}" x2="${width - padRight}" y2="${yPosTop}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="4" />
      <line x1="${padLeft}" y1="${yPosMid}" x2="${width - padRight}" y2="${yPosMid}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="4" />
      <line x1="${padLeft}" y1="${yPosBot}" x2="${width - padRight}" y2="${yPosBot}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="4" />

      <!-- Y-Axis Labels -->
      <text x="${padLeft - 8}" y="${yPosTop + 3}" fill="rgba(255,255,255,0.4)" font-size="9px" text-anchor="end" font-family="Inter, sans-serif">${yValTop.toFixed(1)}</text>
      <text x="${padLeft - 8}" y="${yPosMid + 3}" fill="rgba(255,255,255,0.4)" font-size="9px" text-anchor="end" font-family="Inter, sans-serif">${yValMid.toFixed(1)}</text>
      <text x="${padLeft - 8}" y="${yPosBot + 3}" fill="rgba(255,255,255,0.4)" font-size="9px" text-anchor="end" font-family="Inter, sans-serif">${yValBot.toFixed(1)}</text>

      <!-- Gradient Area Under Curve -->
      <path d="${fillPath}" fill="url(#chart-glow-grad)" />

      <!-- Main Trend Line -->
      <path d="${linePath}" fill="none" stroke="var(--primary-teal)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />

      <!-- Data Nodes -->
      ${points.map((pt, idx) => `
        <g class="chart-point-group" style="cursor: pointer;"
           onmouseover="showChartTooltip(event, '${escapeHtml(formatDate(pt.log_date))}', '${pt.weight.toFixed(1)} kg')"
           onmouseout="hideChartTooltip()">
          <circle cx="${pt.x}" cy="${pt.y}" r="4" class="chart-point-marker" fill="var(--primary-teal)" stroke="#020617" stroke-width="1.5" />
          <!-- Larger transparent hover target -->
          <circle cx="${pt.x}" cy="${pt.y}" r="12" fill="transparent" />
        </g>
      `).join('')}

      <!-- Timeline X-Axis Dates -->
      <text x="${padLeft}" y="${height - 10}" fill="rgba(255,255,255,0.4)" font-size="9px" text-anchor="start" font-family="Inter, sans-serif">${formatDateShort(points[0].log_date)}</text>
      <text x="${width - padRight}" y="${height - 10}" fill="rgba(255,255,255,0.4)" font-size="9px" text-anchor="end" font-family="Inter, sans-serif">${formatDateShort(points[points.length - 1].log_date)}</text>
    </svg>
    <div class="chart-tooltip" id="chart-tooltip"></div>
  `;

  chartContainer.innerHTML = svgHTML;
}

// ─── Analytics: Tooltip Hover Handler (Phase 4) ──────────────────────
function showChartTooltip(e, dateStr, weightStr) {
  const tooltip = document.getElementById('chart-tooltip');
  const container = document.getElementById('weight-chart-container');
  if (!tooltip || !container) return;

  const rect = container.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  tooltip.innerHTML = `<strong>${weightStr}</strong><br/><span style="color:rgba(255,255,255,0.6);font-size:10px;">${dateStr}</span>`;
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
  tooltip.style.display = 'block';
}

function hideChartTooltip() {
  const tooltip = document.getElementById('chart-tooltip');
  if (tooltip) tooltip.style.display = 'none';
}

// ─── Daily Check-In: Load Data (Phase 5) ─────────────────────────────
async function loadCheckin() {
  const container = document.getElementById('checkin-main-area');
  const streakContainer = document.getElementById('checkin-streak-badge-container');
  if (!container) return;

  if (streakContainer) streakContainer.innerHTML = '';
  container.innerHTML = `
    <div style="text-align:center;padding:50px 0;color:rgba(255,255,255,0.4);">
      <i class="fas fa-spinner fa-spin" style="font-size:2rem;margin-bottom:12px;"></i>
      <p>Loading daily check-in...</p>
    </div>`;

  try {
    // 1. Fetch today's check-in & streaks
    const response = await fetch('/api/checkin/today').then(r => r.json());

    // 2. Fetch goals to get active goal info
    const goalsRes = await fetch('/api/goals').then(r => r.json());
    const activeGoal = goalsRes.success && goalsRes.goals ? goalsRes.goals.find(g => g.status === 'active') : null;

    if (response.success) {
      renderCheckinView(response, activeGoal);
    } else {
      container.innerHTML = `
        <div class="journey-empty-card">
          <i class="fas fa-circle-exclamation" style="color:var(--danger-red);"></i>
          <h3>Failed to load daily check-in</h3>
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

// ─── Daily Check-In: Render Form (Phase 5) ───────────────────────────
function renderCheckinView(response, activeGoal) {
  const container = document.getElementById('checkin-main-area');
  const streakContainer = document.getElementById('checkin-streak-badge-container');
  if (!container) return;

  const logged = response.logged;
  const data = response.data || {};
  const streak = response.streak || { currentStreak: 0, bestStreak: 0 };

  // 1. Update streak badge in header
  if (streakContainer) {
    streakContainer.innerHTML = `
      <span class="badge-status-ontrack" style="padding: 4px 10px; font-size: 10px;">
        <i class="fas fa-fire" style="color: var(--warning-gold); margin-right: 4px;"></i> Streak: ${streak.currentStreak} ${streak.currentStreak === 1 ? 'Day' : 'Days'}
      </span>
    `;
  }

  // 2. Setup right column active goal context card
  let activeGoalHTML = `
    <div style="text-align: center; padding: 20px; opacity: 0.5;">
      <i class="fas fa-map-location-dot" style="font-size: 32px; margin-bottom: 8px;"></i>
      <p style="font-size: 12px; margin: 0;">No active goal selected. Set a goal to see parameters here.</p>
    </div>
  `;

  if (activeGoal) {
    activeGoalHTML = `
      <h3>Goal Roadmap Target</h3>
      <div class="metrics-panel-stack" style="gap: 12px;">
        <div class="insight-stat-row">
          <span class="label">Current Goal</span>
          <span class="val highlight">${escapeHtml(activeGoal.goal_name || goalTypeLabel(activeGoal.goal_type))}</span>
        </div>
        <div class="insight-stat-row">
          <span class="label">Target Date</span>
          <span class="val">${formatDate(activeGoal.target_date)}</span>
        </div>
        <div class="insight-stat-row">
          <span class="label">Target Weight</span>
          <span class="val" style="color: var(--accent-green);">${activeGoal.target_weight} kg</span>
        </div>
        <div class="insight-stat-row">
          <span class="label">Completed Progress</span>
          <span class="val highlight">${activeGoal.progress_pct}%</span>
        </div>
      </div>
      <div class="coach-guidance-box" style="margin-top: 16px; display: flex; gap: 10px; align-items: flex-start;">
        <i class="fas fa-compass" style="color: var(--primary-teal); font-size: 1.1rem; margin-top: 2px;"></i>
        <p style="margin: 0; font-size: 11.5px; line-height: 1.4; color: rgba(255,255,255,0.7);">
          Daily check-in logs feed directly into your <strong>${goalTypeLabel(activeGoal.goal_type)}</strong> route progress. Logging weight updates the roadmap dynamically.
        </p>
      </div>
    `;
  }

  const weightVal = data.weight !== null && data.weight !== undefined ? data.weight : '';
  const stepsVal = data.steps_count !== null && data.steps_count !== undefined ? data.steps_count : '';
  const waterVal = data.water_intake_l !== null && data.water_intake_l !== undefined ? data.water_intake_l.toFixed(1) : '0.0';
  const notesVal = data.notes || '';
  const durationVal = data.workout_duration_mins !== null && data.workout_duration_mins !== undefined ? data.workout_duration_mins : '';

  container.innerHTML = `
    <div class="analytics-grid">
      <!-- Left Column: Form -->
      <form id="checkin-form" onsubmit="saveCheckin(event)" class="analytics-card" style="padding: 28px;">
        <h3>Today's Tracking Metrics</h3>
        
        <div class="metrics-panel-stack" style="gap: 18px;">
          
          <div class="form-group-flex">
            <!-- Weight Input -->
            <div style="flex: 1;">
              <label style="display:block; font-size: 11px; color:rgba(255,255,255,0.5); margin-bottom: 6px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Weight (kg)</label>
              <input type="number" id="checkin-weight" step="0.1" min="1" max="500" class="input-field" placeholder="e.g. 85.0" style="width: 100%;" value="${weightVal}">
            </div>
            
            <!-- Steps Input -->
            <div style="flex: 1;">
              <label style="display:block; font-size: 11px; color:rgba(255,255,255,0.5); margin-bottom: 6px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Steps Walked</label>
              <input type="number" id="checkin-steps" min="0" max="100000" class="input-field" placeholder="e.g. 10000" style="width: 100%;" value="${stepsVal}">
            </div>
          </div>

          <!-- Water Intake Stepper -->
          <div>
            <label style="display:block; font-size: 11px; color:rgba(255,255,255,0.5); margin-bottom: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Water Intake (Liters)</label>
            <div style="display: flex; align-items: center; gap: 12px;">
              <button type="button" class="btn-goal-edit" style="padding: 10px 16px; min-width: 50px;" onclick="adjustWater(-0.5)">-0.5 L</button>
              <input type="number" id="checkin-water" step="0.1" min="0" max="20" class="input-field" style="text-align: center; font-size: 18px; font-weight: 700; width: 90px; color: var(--primary-teal);" value="${waterVal}">
              <button type="button" class="btn-goal-edit" style="padding: 10px 16px; min-width: 50px;" onclick="adjustWater(0.5)">+0.5 L</button>
              <span style="font-size: 12px; color: rgba(255,255,255,0.45);"><i class="fas fa-droplet" style="color:var(--primary-teal); margin-right: 4px;"></i> Optional</span>
            </div>
          </div>

          <!-- Workout Toggle Checkbox -->
          <div>
            <label style="display:flex; align-items:center; gap: 10px; cursor: pointer; font-size:13px; user-select:none; font-weight: 600;">
              <input type="checkbox" id="checkin-workout-completed" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--primary-teal);" onchange="toggleWorkoutDuration()" ${data.workout_completed ? 'checked' : ''}>
              <span>Completed a Workout Today</span>
            </label>
          </div>

          <!-- Workout Duration (collapsible) -->
          <div id="checkin-workout-duration-wrapper" style="display: ${data.workout_completed ? 'block' : 'none'};">
            <label style="display:block; font-size: 11px; color:rgba(255,255,255,0.5); margin-bottom: 6px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Workout Duration (minutes)</label>
            <input type="number" id="checkin-workout-duration" min="0" max="1440" class="input-field" placeholder="e.g. 45" style="width: 100%;" value="${durationVal}">
          </div>

          <!-- Energy Level Selector -->
          <div>
            <label style="display:block; font-size: 11px; color:rgba(255,255,255,0.5); margin-bottom: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Energy Level (Mandatory)</label>
            <div class="energy-selector-grid">
              <button type="button" class="energy-btn ${data.energy_level === 1 ? 'selected' : ''}" data-level="1" onclick="selectEnergyLevel(1)">
                <span class="emoji">⚡</span>
                <span class="lbl">Exhausted</span>
              </button>
              <button type="button" class="energy-btn ${data.energy_level === 2 ? 'selected' : ''}" data-level="2" onclick="selectEnergyLevel(2)">
                <span class="emoji">🥱</span>
                <span class="lbl">Tired</span>
              </button>
              <button type="button" class="energy-btn ${data.energy_level === 3 ? 'selected' : ''}" data-level="3" onclick="selectEnergyLevel(3)">
                <span class="emoji">😐</span>
                <span class="lbl">Normal</span>
              </button>
              <button type="button" class="energy-btn ${data.energy_level === 4 ? 'selected' : ''}" data-level="4" onclick="selectEnergyLevel(4)">
                <span class="emoji">🔋</span>
                <span class="lbl">Energetic</span>
              </button>
              <button type="button" class="energy-btn ${data.energy_level === 5 ? 'selected' : ''}" data-level="5" onclick="selectEnergyLevel(5)">
                <span class="emoji">🔥</span>
                <span class="lbl">Peak</span>
              </button>
            </div>
            <input type="hidden" id="checkin-energy-val" value="${data.energy_level || ''}">
          </div>

          <!-- Notes Textarea -->
          <div>
            <label style="display:block; font-size: 11px; color:rgba(255,255,255,0.5); margin-bottom: 6px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Notes (Optional)</label>
            <textarea id="checkin-notes" class="input-field" rows="3" placeholder="How was your consistency? Notes on nutrition or mood..." style="width:100%; font-family:inherit; resize:vertical; max-height:120px;">${notesVal}</textarea>
          </div>

          <div id="checkin-msg" class="msg" style="margin: 0;"></div>

          <button type="submit" class="btn-main" style="width: 100%; padding: 14px; font-weight:700; margin-top: 10px;">
            <i class="fas fa-check"></i>&nbsp; ${logged ? 'Update Daily Check-In' : 'Submit Daily Check-In'}
          </button>
        </div>
      </form>

      <!-- Right Column: Streaks and Contextual Guidance -->
      <div class="metrics-panel-stack">
        <!-- Streak Stats Card -->
        <div class="analytics-card" style="text-align: center; padding: 32px 24px;">
          <h3>Daily Check-in Streak</h3>
          <div style="display: flex; justify-content: space-around; margin: 24px 0 12px; align-items: center;">
            <div>
              <div style="font-size: 42px; margin-bottom: 8px;">🔥</div>
              <div id="streak-current-val" style="font-size: 32px; font-weight: 800; color: var(--warning-gold);">${streak.currentStreak} ${streak.currentStreak === 1 ? 'Day' : 'Days'}</div>
              <div style="font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 4px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Current Streak</div>
            </div>
            
            <div style="border-left: 1px solid rgba(255,255,255,0.08); height: 80px;"></div>

            <div>
              <div style="font-size: 42px; margin-bottom: 8px;">👑</div>
              <div id="streak-best-val" style="font-size: 32px; font-weight: 800; color: var(--primary-teal);">${streak.bestStreak} ${streak.bestStreak === 1 ? 'Day' : 'Days'}</div>
              <div style="font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 4px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Best Streak</div>
            </div>
          </div>
        </div>

        <!-- Active Goal Quick Overview Card -->
        <div class="analytics-card" id="checkin-active-goal-overview">
          ${activeGoalHTML}
        </div>
      </div>
    </div>
  `;
}

// ─── Daily Check-In: Click Handlers & Adjustments (Phase 5) ───────────
function adjustWater(val) {
  const input = document.getElementById('checkin-water');
  if (!input) return;
  const current = parseFloat(input.value) || 0.0;
  const target = Math.max(0, current + val);
  input.value = target.toFixed(1);
}

function selectEnergyLevel(level) {
  const input = document.getElementById('checkin-energy-val');
  if (!input) return;

  input.value = level;

  // Update UI selection classes
  document.querySelectorAll('.energy-selector-grid .energy-btn').forEach(btn => {
    btn.classList.toggle('selected', parseInt(btn.dataset.level, 10) === level);
  });
}

function toggleWorkoutDuration() {
  const checkbox = document.getElementById('checkin-workout-completed');
  const wrapper = document.getElementById('checkin-workout-duration-wrapper');
  if (!checkbox || !wrapper) return;

  wrapper.style.display = checkbox.checked ? 'block' : 'none';
}

// ─── Daily Check-In: Save Form (Phase 5) ─────────────────────────────
async function saveCheckin(e) {
  e.preventDefault();

  const msg = document.getElementById('checkin-msg');
  if (msg) {
    msg.textContent = '';
    msg.className = 'msg';
  }

  const weight = document.getElementById('checkin-weight').value;
  const steps_count = document.getElementById('checkin-steps').value;
  const water_intake_l = document.getElementById('checkin-water').value;
  const workout_completed = document.getElementById('checkin-workout-completed').checked;
  const workout_duration_mins = document.getElementById('checkin-workout-duration').value;
  const energy_level = document.getElementById('checkin-energy-val').value;
  const notes = document.getElementById('checkin-notes').value;

  // Client-side validations
  if (!energy_level) {
    if (msg) {
      msg.textContent = 'Please select your energy level today.';
      msg.className = 'msg error';
    }
    return;
  }

  const payload = {
    weight: weight !== '' ? parseFloat(weight) : null,
    steps_count: steps_count !== '' ? parseInt(steps_count, 10) : null,
    water_intake_l: water_intake_l !== '' ? parseFloat(water_intake_l) : null,
    workout_completed: !!workout_completed,
    workout_duration_mins: workout_duration_mins !== '' ? parseInt(workout_duration_mins, 10) : null,
    energy_level: parseInt(energy_level, 10),
    notes: notes || null
  };

  try {
    const result = await apiPost('/api/checkin', payload);
    if (result.success) {
      showToast('Daily check-in saved ✓');

      // Reload relevant data stores
      loadGoals();
      loadJourney();
      loadAnalytics();
      loadCheckin();
      loadHealthScore();
      loadRecommendations();
      loadCoach();
      loadDashboardHome();
    } else {
      if (msg) {
        msg.textContent = result.message || 'Validation error.';
        msg.className = 'msg error';
      }
    }
  } catch (err) {
    console.error(err);
    if (msg) {
      msg.textContent = 'Network error. Please try again.';
      msg.className = 'msg error';
    }
  }
}

// ─── Health Score: Load Data (Phase 6) ───────────────────────────────
async function loadHealthScore() {
  const container = document.getElementById('healthscore-main-area');
  const badgeContainer = document.getElementById('healthscore-badge-container');
  if (!container) return;

  if (badgeContainer) badgeContainer.innerHTML = '';
  container.innerHTML = `
    <div style="text-align:center;padding:50px 0;color:rgba(255,255,255,0.4);">
      <i class="fas fa-spinner fa-spin" style="font-size:2rem;margin-bottom:12px;"></i>
      <p>Calculating your dynamic health score...</p>
    </div>`;

  try {
    const response = await fetch('/api/healthscore').then(r => r.json());
    if (response.success) {
      renderHealthScoreView(response);
    } else {
      container.innerHTML = `
        <div class="journey-empty-card">
          <i class="fas fa-circle-exclamation" style="color:var(--danger-red);"></i>
          <h3>Failed to calculate health score</h3>
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

// ─── Health Score: Render Dashboard (Phase 6) ────────────────────────
function renderHealthScoreView(data) {
  const container = document.getElementById('healthscore-main-area');
  const badgeContainer = document.getElementById('healthscore-badge-container');
  if (!container) return;

  const score = data.healthScore;
  const rating = data.rating;
  const breakdown = data.breakdown || {};
  const tips = data.tips || [];

  // 1. Update header rating badge
  const ratingClass = rating.toLowerCase().replace(' ', '-');
  if (badgeContainer) {
    badgeContainer.innerHTML = `<span class="badge-status-${ratingClass === 'needs-attention' ? 'behind' : (ratingClass === 'fair' ? 'behind' : (ratingClass === 'good' ? 'ontrack' : 'ahead'))}" style="padding: 6px 14px; font-weight: 800; font-size: 11px;">${rating}</span>`;
  }

  // Calculate SVG circular parameters
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  // Render Layout
  container.innerHTML = `
    <div class="analytics-grid">
      <!-- Column A: Circular SVG Gauge & Tips -->
      <div class="metrics-panel-stack">
        
        <!-- Score Circular Gauge Card -->
        <div class="analytics-card" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 24px;">
          <h3>Health Score Gauge</h3>
          
          <div class="healthscore-circle-container">
            <svg class="healthscore-circle-svg" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r="${radius}" class="healthscore-circle-bg" />
              <circle cx="80" cy="80" r="${radius}" class="healthscore-circle-progress ${ratingClass}"
                      stroke-dasharray="${circumference}" 
                      stroke-dashoffset="${circumference}" />
            </svg>
            <div class="healthscore-center-text">
              <span class="score-number" id="healthscore-number-val">0</span>
              <span class="score-rating badge-rating-${ratingClass}" style="margin-top: 4px;">${rating}</span>
            </div>
          </div>
          <div style="font-size: 13px; color: rgba(255,255,255,0.45); text-align: center; max-width: 250px; line-height: 1.4; margin-top: 8px;">
            Deterministic index calculated from goals, daily checks, streaks, and hydration.
          </div>
        </div>

        <!-- Suggestions & Action Items checklist -->
        <div class="analytics-card">
          <h3>Optimization Suggestion List</h3>
          ${tips.length > 0 ? `
            <div class="healthscore-tips-list">
              ${tips.map(t => `
                <div class="healthscore-tip-item">
                  <span>${escapeHtml(t.tip)}</span>
                  <span class="points">+${t.points.toFixed(1)} pts</span>
                </div>
              `).join('')}
            </div>
          ` : `
            <div style="text-align: center; padding: 20px; opacity: 0.5;">
              <i class="fas fa-crown" style="font-size: 32px; color: var(--warning-gold); margin-bottom: 8px;"></i>
              <p style="font-size: 13px; margin: 0; font-weight: 600; color: var(--success);">Excellent progress! You have locked in all target points today.</p>
            </div>
          `}
        </div>
      </div>

      <!-- Column B: Deterministic Sub-score Cards Breakdown -->
      <div class="metrics-panel-stack">
        <div class="analytics-card" style="padding: 24px 28px;">
          <h3>Deterministic Component Breakdown</h3>
          
          <div class="metrics-panel-stack" style="gap: 16px;">
            ${Object.entries(breakdown).map(([key, item]) => {
    const compTitles = {
      goalProgress: { title: 'Goal Progress', icon: 'fa-bullseye' },
      dailyActivity: { title: 'Daily Activity', icon: 'fa-running' },
      workoutConsistency: { title: 'Workout Consistency', icon: 'fa-calendar-check' },
      hydration: { title: 'Daily Hydration', icon: 'fa-tint' },
      energyLevels: { title: 'Energy Levels', icon: 'fa-bolt' },
      checkinStreaks: { title: 'Check-In Streaks', icon: 'fa-fire' }
    }[key] || { title: key, icon: 'fa-question' };

    const scoreVal = item.score;
    const statusColor = scoreVal >= 80 ? 'var(--success)' : (scoreVal >= 60 ? 'var(--warning)' : 'var(--danger)');

    return `
                <details class="score-breakdown-details">
                  <summary class="breakdown-summary">
                    <span class="breakdown-summary-left">
                      <i class="fas ${compTitles.icon}"></i>
                      <span>${compTitles.title}</span>
                    </span>
                    <span class="breakdown-summary-right">
                      <span class="score-val" style="color: ${statusColor};">
                        ${scoreVal}/100
                      </span>
                      <i class="fas fa-chevron-down arrow-icon"></i>
                    </span>
                  </summary>
                  
                  <div class="breakdown-details-content" style="padding-top: 16px;">
                    <div style="font-size: 11.5px; color: var(--text-secondary); display: flex; justify-content: space-between; margin-bottom: 8px;">
                      <span>Metric: <strong>${escapeHtml(item.value)}</strong></span>
                      <span>Target: <strong>${escapeHtml(item.target)}</strong></span>
                    </div>
                    
                    <div class="analytics-progress-bg" style="height: 6px; margin-bottom: 12px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden;">
                      <div class="analytics-progress-fill" style="height: 100%; width: ${scoreVal}%; background: ${statusColor}; border-radius: 3px;"></div>
                    </div>

                    <p style="margin: 0; font-size: 13px; line-height: 1.45; color: var(--text-secondary); font-style: italic;">
                      ${escapeHtml(item.explanation)}
                    </p>
                  </div>
                </details>
              `;
  }).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  // Animate Circular Gauge circle from 0 to target offset
  setTimeout(() => {
    const circle = container.querySelector('.healthscore-circle-progress');
    if (circle) {
      circle.style.strokeDashoffset = strokeDashoffset;
    }

    // Animate the text counter in the center
    const numVal = document.getElementById('healthscore-number-val');
    if (numVal) {
      let currentNum = 0;
      const stepTime = Math.abs(Math.floor(1000 / score));
      const timer = setInterval(() => {
        if (currentNum >= score) {
          numVal.textContent = score;
          clearInterval(timer);
        } else {
          currentNum++;
          numVal.textContent = currentNum;
        }
      }, Math.max(10, stepTime));
    }
  }, 100);
}

// ─── AI Coach: Load & Render Data (Phase 8) ───────────────────────────
async function loadCoach() {
  const container = document.getElementById('coach-main-area');
  if (!container) return;

  container.innerHTML = `
    <div class="loading-container" style="padding: 40px; text-align: center;">
      <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: rgba(255,255,255,0.4);"></i>
      <p style="margin-top: 10px; color: rgba(255,255,255,0.4); font-size: 13px;">Preparing your coaching summary...</p>
    </div>
  `;

  try {
    const response = await fetch('/api/coach').then(r => r.json());
    if (response.success) {
      renderCoachView(response);
    } else {
      container.innerHTML = `<p class="msg error" style="margin: 20px;">Error loading coach session: ${escapeHtml(response.message)}</p>`;
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p class="msg error" style="margin: 20px;">Failed to connect to coaching server.</p>`;
  }
}

function renderCoachView(data) {
  const container = document.getElementById('coach-main-area');
  if (!container) return;

  const { dailySummary, weeklySummary, answers } = data;

  container.innerHTML = `
    <div class="coach-grid">
      <!-- Left Panel: Weekly Review & Focus Card -->
      <div>
        <!-- Daily Focus Card -->
        <div class="coach-card">
          <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #fff; display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-user-md" style="color: var(--primary-teal);"></i> Daily Coaching Summary
          </h3>
          <p style="margin: 0 0 14px 0; font-size: 13.5px; line-height: 1.5; color: rgba(255,255,255,0.85);">
            ${escapeHtml(dailySummary.summary)}
          </p>
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); padding: 12px 14px; border-radius: 12px;">
            <span style="display: block; font-size: 10px; font-weight: 800; color: rgba(255,255,255,0.4); text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px;">Today's Focus Area</span>
            <span style="font-size: 13px; font-weight: 600; color: var(--warning-gold); line-height: 1.4;">${escapeHtml(dailySummary.focus)}</span>
          </div>
          <div class="coach-motivation-box">
            "${escapeHtml(dailySummary.motivation)}"
          </div>
        </div>

        <!-- Weekly Summary Card -->
        <div class="coach-card">
          <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #fff;">
            Weekly Progress Summary
          </h3>
          
          <!-- Wins -->
          <h4 style="margin: 15px 0 8px 0; font-size: 11.5px; font-weight: 700; color: var(--accent-green); text-transform: uppercase; letter-spacing: 0.5px;">Weekly Wins</h4>
          <div class="coach-summary-list">
            ${weeklySummary.wins.map(w => `
              <div class="coach-summary-item win">
                <i class="fas fa-check-circle"></i>
                <span>${escapeHtml(w)}</span>
              </div>
            `).join('')}
          </div>

          <!-- Risks -->
          <h4 style="margin: 20px 0 8px 0; font-size: 11.5px; font-weight: 700; color: #ef4444; text-transform: uppercase; letter-spacing: 0.5px;">Weekly Risks</h4>
          <div class="coach-summary-list">
            ${weeklySummary.risks.map(r => `
              <div class="coach-summary-item risk">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${escapeHtml(r)}</span>
              </div>
            `).join('')}
          </div>

          <!-- Focus Areas -->
          <h4 style="margin: 20px 0 8px 0; font-size: 11.5px; font-weight: 700; color: var(--warning-gold); text-transform: uppercase; letter-spacing: 0.5px;">Key Focus Targets</h4>
          <div class="coach-summary-list">
            ${weeklySummary.focusAreas.map(f => `
              <div class="coach-summary-item focus">
                <i class="fas fa-bullseye"></i>
                <span>${escapeHtml(f)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Right Panel: Predefined Coach drawer -->
      <div>
        <div class="ask-coach-box">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #fff;">
            Ask Coach Console
          </h3>
          <p style="margin: 0 0 20px 0; font-size: 12.5px; color: rgba(255,255,255,0.45); line-height: 1.4;">
            Select one of the predefined topics below to receive detailed wellness analysis derived from your active logs.
          </p>

          <!-- Predefined Questions -->
          <button class="coach-question-btn" onclick="showCoachAnswer('why_score', this)">
            <span>Why did my Health Score change?</span>
            <i class="fas fa-chevron-right" style="font-size: 11px; color: rgba(255,255,255,0.3);"></i>
          </button>
          
          <button class="coach-question-btn" onclick="showCoachAnswer('on_track', this)">
            <span>Am I on track to reach my goal?</span>
            <i class="fas fa-chevron-right" style="font-size: 11px; color: rgba(255,255,255,0.3);"></i>
          </button>

          <button class="coach-question-btn" onclick="showCoachAnswer('weekly_focus', this)">
            <span>What should I focus on this week?</span>
            <i class="fas fa-chevron-right" style="font-size: 11px; color: rgba(255,255,255,0.3);"></i>
          </button>

          <button class="coach-question-btn" onclick="showCoachAnswer('why_recommendations', this)">
            <span>Why am I receiving this recommendation?</span>
            <i class="fas fa-chevron-right" style="font-size: 11px; color: rgba(255,255,255,0.3);"></i>
          </button>

          <button class="coach-question-btn" onclick="showCoachAnswer('improve_score', this)">
            <span>How can I improve my score?</span>
            <i class="fas fa-chevron-right" style="font-size: 11px; color: rgba(255,255,255,0.3);"></i>
          </button>

          <!-- Answer View Box -->
          <div id="coach-answer-display" class="coach-answer-container" style="display: none;">
            <h4 id="coach-answer-title"></h4>
            <div id="coach-answer-text" style="white-space: pre-wrap;"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Store answers in global window context for drawer toggle
  window.coachAnswersData = answers;
}

function showCoachAnswer(key, btn) {
  const display = document.getElementById('coach-answer-display');
  const title = document.getElementById('coach-answer-title');
  const text = document.getElementById('coach-answer-text');
  if (!display || !title || !text || !window.coachAnswersData) return;

  // Highlight selected button
  document.querySelectorAll('.coach-question-btn').forEach(el => {
    el.style.borderColor = 'rgba(255, 255, 255, 0.06)';
    el.style.background = 'rgba(255, 255, 255, 0.02)';
  });
  if (btn) {
    btn.style.borderColor = 'var(--primary-teal)';
    btn.style.background = 'rgba(20, 184, 166, 0.05)';
  }

  // Set titles
  const questionTitles = {
    why_score: 'Why did my Health Score change?',
    on_track: 'Am I on track to reach my goal?',
    weekly_focus: 'What should I focus on this week?',
    why_recommendations: 'Why am I receiving this recommendation?',
    improve_score: 'How can I improve my score?'
  };

  title.textContent = questionTitles[key] || '';

  // Format markdown-like bold strings
  let rawText = window.coachAnswersData[key] || 'No analysis available.';
  let formatted = rawText.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#fff;">$1</strong>');

  text.innerHTML = formatted;

  // Slide down or fade in
  display.style.display = 'block';
  display.style.opacity = '0';
  display.style.transition = 'opacity 0.3s ease';
  setTimeout(() => {
    display.style.opacity = '1';
  }, 50);
}


// ─── Recommendations: Load Data (Phase 7 & Capability 4) ───────────
async function loadRecommendations() {
  const container = document.getElementById('recommendations-main-area');
  const badgeContainer = document.getElementById('recommendations-summary-badge');
  if (!container) return;

  container.innerHTML = `
    <div class="loading-container" style="padding: 40px; text-align: center;">
      <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: rgba(255,255,255,0.4);"></i>
      <p style="margin-top: 10px; color: rgba(255,255,255,0.4); font-size: 13px;">Analyzing your health data & personal trajectory...</p>
    </div>
  `;

  try {
    const [recResponse, personalizedResponse] = await Promise.all([
      fetch('/api/recommendations').then(r => r.json()),
      fetch('/api/recommendations/personalized').then(r => r.json()).catch(() => null)
    ]);

    if (recResponse.success) {
      renderRecommendationsView(recResponse, personalizedResponse);
    } else {
      container.innerHTML = `<p class="msg error" style="margin: 20px;">Error loading recommendations: ${escapeHtml(recResponse.message)}</p>`;
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p class="msg error" style="margin: 20px;">Failed to connect to recommendation server.</p>`;
  }
}

// ─── Capability 4: Personalized Recommendation Hero Renderer ──────
function renderPersonalizedRecommendationHero(personalizedRec) {
  if (!personalizedRec) return '';

  if (personalizedRec.status === 'no_active_goal') {
    return `
      <div class="glass-card personalized-rec-hero no-goal">
        <div class="p-rec-header">
          <span class="p-rec-chip"><i class="fas fa-compass"></i> CAPABILITY 4 — PERSONALIZED FOCUS</span>
          <span class="prio-badge badge-medium">GOAL NEEDED</span>
        </div>
        <h3 class="p-rec-title">Set an active goal to unlock tailored trajectory recommendations</h3>
        <p class="p-rec-action"><i class="fas fa-bullseye"></i> Create your target weight and timeframe in Goals to receive personalized guidance.</p>
        <div class="p-rec-reason-box">
          <span class="p-rec-reason-label"><i class="fas fa-circle-question"></i> Why am I seeing this?</span>
          <p class="p-rec-reason-text">Personalized recommendations synthesize your trajectory, goal outlook, and signals. Setting an active goal allows the intelligence pipeline to align suggestions with your target direction.</p>
        </div>
        <div style="margin-top: 14px;">
          <button class="btn-main" style="width: auto; padding: 10px 22px; font-size: 13px;" onclick="switchSection('goals', document.querySelector('.nav-tab[onclick*=\\'goals\\']'))">
            <i class="fas fa-plus"></i>&nbsp; Set Active Goal
          </button>
        </div>
      </div>
    `;
  }

  const p = personalizedRec.primary;
  if (!p) return '';

  const isInsufficient = personalizedRec.status === 'insufficient_data';
  const priority = p.priority || 'medium';
  const prioLabel = priority.toUpperCase();
  const ctx = personalizedRec.context || {};

  const goalTypeLabels = {
    weight_loss: 'Weight Loss',
    muscle_gain: 'Muscle Gain',
    maintenance: 'Maintenance'
  };
  const goalTypeStr = goalTypeLabels[ctx.goalType] || ctx.goalType || 'Active';

  const achievementLabels = {
    on_track: 'On Track',
    slow_progress: 'Slow Progress',
    at_risk: 'At Risk',
    moving_away: 'Moving Away',
    achieved: 'Achieved',
    insufficient_data: 'Evaluating'
  };
  const achievementStr = achievementLabels[ctx.achievementStatus] || ctx.achievementStatus || 'Evaluating';

  const signalLabels = {
    point_anomaly: 'Scale Fluctuation',
    reversal: 'Trend Reversal',
    plateau: 'Plateau',
    behavior_drop: 'Activity Drop',
    stable: 'Stable Trend',
    drift: 'Trend Drift',
    insufficient: 'Establishing Baseline',
    none: 'Normal'
  };
  const signalStr = signalLabels[ctx.progressSignal] || ctx.progressSignal || 'Active';

  const supportingActions = Array.isArray(personalizedRec.supporting) ? personalizedRec.supporting : [];

  return `
    <div class="glass-card personalized-rec-hero priority-${priority}">
      <div class="p-rec-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="p-rec-chip"><i class="fas fa-compass"></i> CAPABILITY 4 — PERSONALIZED FOCUS</span>
          <span class="prio-badge badge-${priority}">${prioLabel} PRIORITY</span>
        </div>
        <div class="p-rec-context-pills">
          <span class="p-rec-pill"><i class="fas fa-bullseye"></i> Goal: ${escapeHtml(goalTypeStr)}</span>
          <span class="p-rec-pill"><i class="fas fa-chart-line"></i> Outlook: ${escapeHtml(achievementStr)}</span>
          <span class="p-rec-pill"><i class="fas fa-satellite-dish"></i> Signal: ${escapeHtml(signalStr)}</span>
        </div>
      </div>

      <div class="p-rec-body">
        <h3 class="p-rec-title">${escapeHtml(p.title)}</h3>
        <div class="p-rec-action-callout">
          <div class="p-rec-action-icon"><i class="fas fa-arrow-right"></i></div>
          <div class="p-rec-action-content">
            <span class="p-rec-action-label">Recommended Action</span>
            <p class="p-rec-action-text">${escapeHtml(p.action)}</p>
          </div>
        </div>

        <div class="p-rec-reason-box">
          <span class="p-rec-reason-label"><i class="fas fa-circle-question"></i> Why am I seeing this recommendation?</span>
          <p class="p-rec-reason-text">${escapeHtml(p.reason)}</p>
        </div>

        ${supportingActions.length > 0 ? `
          <div class="p-rec-supporting-section">
            <h4 class="p-rec-supporting-title"><i class="fas fa-list-check"></i> Supporting Actions</h4>
            <div class="p-rec-supporting-grid">
              ${supportingActions.map(s => `
                <div class="p-rec-supporting-card">
                  <span class="p-rec-supporting-head">${escapeHtml(s.title)}</span>
                  <p class="p-rec-supporting-action">${escapeHtml(s.action)}</p>
                  <span class="p-rec-supporting-reason">${escapeHtml(s.reason)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${isInsufficient ? `
          <div style="margin-top: 14px;">
            <button class="btn-main" style="width: auto; padding: 10px 22px; font-size: 13px;" onclick="switchSection('checkin', document.querySelector('.nav-tab[onclick*=\\'checkin\\']'))">
              <i class="fas fa-plus-circle"></i>&nbsp; Log Daily Check-in
            </button>
          </div>
        ` : ''}

        <div class="p-rec-disclaimer">
          <i class="fas fa-shield-heart"></i>
          <span>${escapeHtml(personalizedRec.disclaimer || 'Recommendations are wellness suggestions based on your logged telemetry trends and are not medical advice.')}</span>
        </div>
      </div>
    </div>
  `;
}

function renderRecommendationsView(data, personalizedRec = null) {
  const container = document.getElementById('recommendations-main-area');
  const badgeContainer = document.getElementById('recommendations-summary-badge');
  if (!container || !badgeContainer) return;

  const score = data.healthScore;
  const list = data.recommendations || [];

  const totalCount = list.length;
  const highCount = list.filter(r => r.priority === 'high').length;

  let scoreClass = 'needs-attention';
  if (score >= 90) scoreClass = 'elite';
  else if (score >= 80) scoreClass = 'excellent';
  else if (score >= 70) scoreClass = 'good';
  else if (score >= 60) scoreClass = 'fair';

  badgeContainer.innerHTML = `
    <span class="rating-badge ${scoreClass}" style="padding: 4px 12px; font-weight: 700; font-size: 13px; border-radius: 20px;">Score: ${score}</span>
    <span style="font-size: 13px; background: rgba(255,255,255,0.06); padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.85);">
      Telemetry Items: <strong>${totalCount}</strong>
    </span>
    <span style="font-size: 13px; background: ${highCount > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.06)'}; color: ${highCount > 0 ? '#ef4444' : 'rgba(255,255,255,0.85)'}; padding: 4px 12px; border-radius: 20px; border: 1px solid ${highCount > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.1)'};">
      High Priority: <strong>${highCount}</strong>
    </span>
  `;

  const heroHtml = renderPersonalizedRecommendationHero(personalizedRec);

  const categoryLabels = {
    goal_progress: 'Goal Progress',
    activity: 'Activity',
    hydration: 'Hydration',
    recovery: 'Recovery',
    consistency: 'Consistency'
  };

  const priorityLabels = {
    high: 'HIGH',
    medium: 'MEDIUM',
    low: 'LOW'
  };

  const gridHtml = totalCount === 0 ? `
    <div style="text-align: center; padding: 30px; background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px;">
      <i class="fas fa-check-circle" style="font-size: 28px; color: var(--accent-green); margin-bottom: 10px;"></i>
      <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.85);">All telemetry metrics are currently optimized!</p>
    </div>
  ` : `
    <div class="recommendations-grid">
      ${list.map(rec => {
    const catLabel = categoryLabels[rec.category] || rec.category;
    const prioLabel = priorityLabels[rec.priority] || rec.priority;
    const iconClass = getCategoryIcon(rec.category);
    const scoreImpact = getHealthScoreImpact(rec.category, rec.priority);
    return `
          <div class="glass-card recommendation-card priority-${rec.priority}">
            <div>
              <div class="rec-card-header">
                <span class="prio-badge badge-${rec.priority}">${prioLabel}</span>
                <span class="rec-category"><i class="fas ${iconClass}"></i> ${catLabel}</span>
              </div>
              <h3 class="rec-title">${escapeHtml(rec.title)}</h3>
              <p class="rec-desc">${escapeHtml(rec.description)}</p>
            </div>
            <div class="rec-card-footer">
              <div class="rec-footer-item">
                <span class="footer-label">Expected Benefit</span>
                <span class="footer-value">${escapeHtml(rec.expectedBenefit)}</span>
              </div>
              <div class="rec-footer-item">
                <span class="footer-label">Score Impact</span>
                <span class="footer-value highlight">${scoreImpact}</span>
              </div>
            </div>
          </div>
        `;
  }).join('')}
    </div>
  `;

  container.innerHTML = `
    ${heroHtml}
    <div class="rec-telemetry-header" style="margin: 32px 0 16px 0; display: flex; align-items: center; justify-content: space-between;">
      <div>
        <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
          <i class="fas fa-layer-group" style="color: var(--primary-teal);"></i> Category Telemetry Recommendations
        </h3>
        <p style="margin: 4px 0 0 0; font-size: 12.5px; color: rgba(255,255,255,0.5);">
          Telemetry and check-in score optimizations across activity, hydration, recovery, and consistency.
        </p>
      </div>
    </div>
    ${gridHtml}
  `;
}

// Helper to determine calculated impact
function getHealthScoreImpact(category, priority) {
  const impacts = {
    goal_progress: { high: '+15.0 to +25.0 pts', medium: '+5.0 to +15.0 pts', low: 'Optimized' },
    activity: { high: '+10.0 to +20.0 pts', medium: '+4.0 to +10.0 pts', low: 'Optimized' },
    consistency: { high: '+10.0 to +20.0 pts', medium: '+4.0 to +10.0 pts', low: 'Optimized' },
    hydration: { high: '+7.5 to +15.0 pts', medium: '+2.5 to +7.5 pts', low: 'Optimized' },
    recovery: { high: '+2.5 to +5.0 pts', medium: '+1.0 to +2.5 pts', low: 'Optimized' }
  };
  return impacts[category]?.[priority] || '+0 pts';
}

// Helper to resolve Font Awesome icons
function getCategoryIcon(category) {
  const icons = {
    goal_progress: 'fa-bullseye',
    activity: 'fa-running',
    hydration: 'fa-tint',
    recovery: 'fa-bed',
    consistency: 'fa-calendar-check'
  };
  return icons[category] || 'fa-lightbulb';
}

// ─── Dashboard Home: Load Data (Phase 3 Redesign) ─────────────────────
function renderDashboardSparkline(weightHistory) {
  if (!weightHistory || weightHistory.length < 2) {
    return `
      <div style="height: 74px; display: flex; align-items: center; justify-content: center; background: rgba(9, 12, 19, 0.4); border-radius: 12px; border: 1px dashed rgba(255, 255, 255, 0.08);">
        <span style="font-size: 11.5px; color: #71717A;">Trajectory curve activates with 2+ weigh-ins</span>
      </div>
    `;
  }

  const points = weightHistory.slice(-10);
  const weights = points.map(p => p.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 1;
  const padY = 10;
  const w = 360;
  const h = 74;

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * (w - 24) + 12;
    const y = h - padY - ((p.weight - minW) / range) * (h - padY * 2);
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, weight: p.weight };
  });

  let pathD = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const cpX = (p0.x + p1.x) / 2;
    pathD += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
  }

  const lastPt = coords[coords.length - 1];
  const areaD = `${pathD} L ${lastPt.x} ${h} L ${coords[0].x} ${h} Z`;

  return `
    <svg class="dash-sparkline-canvas" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="dashSparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#00D2FF" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="#00D2FF" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      <path d="${areaD}" fill="url(#dashSparkGrad)" />
      <path d="${pathD}" fill="none" stroke="#00D2FF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="${lastPt.x}" cy="${lastPt.y}" r="4" fill="#00F5A0" stroke="#06090F" stroke-width="2" />
    </svg>
  `;
}

async function loadDashboardHome() {
  const container = document.getElementById('dashboard-main-area');
  if (!container) return;

  container.innerHTML = `
    <div class="loading-container" style="padding: 48px; text-align: center;">
      <i class="fas fa-circle-notch fa-spin" style="font-size: 26px; color: #00D2FF;"></i>
      <p style="margin-top: 14px; color: #A1A1AA; font-size: 13.5px; letter-spacing: 0.2px;">
        Synchronizing physiological telemetry...
      </p>
    </div>
  `;

  // Set formatted current date in date badge
  const dateBadge = document.getElementById('dashboard-date');
  if (dateBadge) {
    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    dateBadge.textContent = new Date().toLocaleDateString('en-US', options);
  }

  try {
    const [scoreData, goalsData, signalsData, analyticsData, checkinToday, recData, coachData] = await Promise.all([
      fetch('/api/healthscore').then(r => r.json()).catch(() => ({ success: false })),
      fetch('/api/goals').then(r => r.json()).catch(() => ({ success: false })),
      fetch('/api/progress/signals').then(r => r.json()).catch(() => ({ success: false })),
      fetch('/api/progress/analytics').then(r => r.json()).catch(() => ({ success: false })),
      fetch('/api/checkin/today').then(r => r.json()).catch(() => ({ success: false })),
      fetch('/api/recommendations').then(r => r.json()).catch(() => ({ success: false })),
      fetch('/api/coach').then(r => r.json()).catch(() => ({ success: false }))
    ]);

    // 1. GREETING & HEADER
    const welcomeTitle = document.getElementById('welcome-title');
    const welcomeSubtitle = document.getElementById('welcome-subtitle');
    const username = (document.getElementById('p-name') && document.getElementById('p-name').textContent.trim()) || 'Athlete';

    const hours = new Date().getHours();
    let greeting = 'Good evening';
    if (hours >= 5 && hours < 12) greeting = 'Good morning';
    else if (hours >= 12 && hours < 17) greeting = 'Good afternoon';

    if (welcomeTitle) {
      welcomeTitle.textContent = `${greeting}, ${username}`;
    }
    if (welcomeSubtitle) {
      welcomeSubtitle.textContent = `Your health state & biometric momentum at a glance.`;
    }

    // 2. HEALTH STATE — PRIMARY HERO
    const score = (scoreData.success && typeof scoreData.healthScore === 'number') ? scoreData.healthScore : 0;
    const rating = (scoreData.success && scoreData.rating) ? scoreData.rating : 'Calibrating';
    const ratingClass = rating.toLowerCase().replace(/\s+/g, '-');
    const breakdown = (scoreData.success && scoreData.breakdown) ? scoreData.breakdown : {};

    // Determine gauge color
    let gaugeColor = '#00D2FF';
    if (score >= 90) gaugeColor = '#A78BFA';
    else if (score >= 80) gaugeColor = '#00D2FF';
    else if (score >= 70) gaugeColor = '#00F5A0';
    else if (score >= 60) gaugeColor = '#FBBF24';
    else if (score > 0) gaugeColor = '#F87171';

    const circ = 2 * Math.PI * 54; // ~339.29
    const strokeOffset = Math.max(0, Math.min(circ, circ * (1 - (score / 100))));

    // Driver narrative
    let driverText = 'Consistent tracking across activity and hydration maintains your score baseline.';
    if (breakdown.checkinStreaks && breakdown.checkinStreaks.score >= 18) {
      driverText = `Consistency is a top positive driver (+${breakdown.checkinStreaks.score} pts). Protecting daily check-in streak compounds momentum.`;
    } else if (breakdown.hydration && breakdown.hydration.score < 8) {
      driverText = 'Hydration deficit is currently holding your score below potential. Prioritize water intake today.';
    } else if (breakdown.goalProgress && breakdown.goalProgress.score >= 18) {
      driverText = 'Goal alignment is exceptional. Target trajectory velocity is well within planned parameters.';
    }

    // 3. GOAL PROGRESS
    const activeGoal = (goalsData.success && goalsData.goals)
      ? goalsData.goals.find(g => g.status === 'active')
      : null;

    let goalHeroHtml = '';
    if (activeGoal) {
      const sw = parseFloat(activeGoal.start_weight);
      const tw = parseFloat(activeGoal.target_weight);
      const cw = activeGoal.current_weight !== undefined && activeGoal.current_weight !== null
        ? parseFloat(activeGoal.current_weight)
        : sw;
      const progressPct = Math.max(0, Math.min(100, Math.round(activeGoal.progress_pct || 0)));
      const remainingKg = Math.abs(cw - tw).toFixed(1);

      let targetDateText = 'No target date set';
      let daysRemainingText = '';
      if (activeGoal.target_date) {
        const tDate = new Date(activeGoal.target_date);
        targetDateText = tDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const diffDays = Math.ceil((tDate - new Date()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0) daysRemainingText = `${diffDays} days left`;
        else daysRemainingText = `${Math.abs(diffDays)}d past target`;
      }

      const goalTypeMap = {
        weight_loss: 'Weight Loss',
        muscle_gain: 'Muscle Gain',
        maintenance: 'Maintenance'
      };
      const goalTypeLabel = goalTypeMap[activeGoal.goal_type] || 'Target Route';

      goalHeroHtml = `
        <div class="dash-card" onclick="switchSection('goals', document.querySelector('.dropdown-item[onclick*=\\'goals\\']'))" style="cursor: pointer;">
          <div class="dash-card-header">
            <h3 class="dash-card-title"><i class="fas fa-bullseye"></i> Primary Goal</h3>
            <span class="dash-tag">${escapeHtml(goalTypeLabel)}</span>
          </div>

          <div class="dash-goal-hero">
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <h4 class="dash-goal-name">${escapeHtml(activeGoal.name || `${goalTypeLabel} Route`)}</h4>
              <span style="font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 700; color: #00F5A0;">
                ${progressPct}% Completed
              </span>
            </div>

            <!-- Biometric Trajectory Track -->
            <div class="dash-trajectory-track">
              <div class="dash-trajectory-stations">
                <div class="dash-station station-start">
                  <span class="dash-station-label">Start</span>
                  <span class="dash-station-val">${sw.toFixed(1)} kg</span>
                </div>
                <div class="dash-station station-current">
                  <span class="dash-station-label">Current</span>
                  <span class="dash-station-val">${cw.toFixed(1)} kg</span>
                </div>
                <div class="dash-station station-target">
                  <span class="dash-station-label">Target</span>
                  <span class="dash-station-val">${tw.toFixed(1)} kg</span>
                </div>
              </div>

              <div class="dash-progress-slider-wrap">
                <div class="dash-progress-slider-fill" style="width: ${progressPct}%;">
                  <div class="dash-progress-pin"></div>
                </div>
              </div>

              <div class="dash-goal-meta-row">
                <div class="dash-meta-item">
                  <i class="fas fa-route"></i>
                  <span>Distance:</span>
                  <span class="dash-meta-val">${remainingKg} kg left</span>
                </div>
                <div class="dash-meta-item">
                  <i class="fas fa-calendar-alt"></i>
                  <span>Target:</span>
                  <span class="dash-meta-val">${targetDateText} ${daysRemainingText ? `(${daysRemainingText})` : ''}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    } else {
      goalHeroHtml = `
        <div class="dash-card">
          <div class="dash-card-header">
            <h3 class="dash-card-title"><i class="fas fa-bullseye"></i> Primary Goal</h3>
            <span class="dash-tag">Standby</span>
          </div>
          <div class="dash-empty-goal">
            <i class="fas fa-bullseye"></i>
            <p>No active health goal defined yet. Setting a target weight activates precision telemetry, trajectory curves, and pace tracking.</p>
            <button class="dash-btn-primary" onclick="openGoalModal()">
              <i class="fas fa-plus"></i> Set Primary Goal
            </button>
          </div>
        </div>
      `;
    }

    // 4. "WHAT CHANGED?" INTELLIGENCE (Capability 3)
    let intelClass = 'intel-steady';
    let intelIcon = 'fa-compass';
    let intelEyebrow = 'Progress Telemetry';
    let intelStatus = 'Steady Pace';
    let intelTitle = 'Physiological Trajectory is Steady';
    let intelDesc = 'Recent weight measurements show consistent progress aligned with your target direction. Zero anomalies or plateau stalls flagged.';

    const primarySignal = (signalsData.success && signalsData.primary) ? signalsData.primary : null;

    if (primarySignal) {
      if (primarySignal.type === 'plateau') {
        intelClass = 'intel-plateau';
        intelIcon = 'fa-pause-circle';
        intelStatus = 'Plateau Flagged';
        intelTitle = primarySignal.title || 'Weight Plateau Detected';
        intelDesc = primarySignal.explanation || '14-day weight slope is near zero. This is a natural physiological adaptation. Focus on consistency and hydration.';
      } else if (primarySignal.type === 'reversal') {
        intelClass = 'intel-reversal';
        intelIcon = 'fa-arrow-trend-up';
        intelStatus = 'Direction Shift';
        intelTitle = primarySignal.title || 'Pace Shift Flagged';
        intelDesc = primarySignal.explanation || 'Recent measurements trend opposite your target direction. Review daily caloric targets and hydration.';
      } else if (primarySignal.type === 'unusual_entry') {
        intelClass = 'intel-plateau';
        intelIcon = 'fa-bolt';
        intelStatus = 'Anomalous Entry';
        intelTitle = primarySignal.title || 'Unusual Weigh-in Entry';
        intelDesc = primarySignal.explanation || 'Latest weigh-in varied sharply from trend. Likely normal water fluctuation or measurement variance.';
      } else if (primarySignal.type === 'behavior_drop') {
        intelClass = 'intel-plateau';
        intelIcon = 'fa-chart-line';
        intelStatus = 'Activity Dip';
        intelTitle = primarySignal.title || 'Activity Frequency Shift';
        intelDesc = primarySignal.explanation || 'Check-in logging or step count has dropped below your personal baseline. Daily tracking protects momentum.';
      } else if (primarySignal.type === 'insufficient') {
        intelClass = '';
        intelIcon = 'fa-wave-square';
        intelStatus = 'Calibrating';
        intelTitle = 'Statistical Telemetry Calibrating';
        intelDesc = primarySignal.explanation || 'Statistical trend detection requires at least 4 weigh-ins spanning 7 calendar days. Continue your daily logs.';
      }
    } else if (analyticsData.velocity && analyticsData.velocity.onTrack) {
      intelTitle = 'Weekly Velocity On Track';
      intelDesc = `Current rate (${analyticsData.velocity.weeklyRate || 0} kg/wk) is matching required trajectory for your target date.`;
    }

    const intelSectionHtml = `
      <div class="dash-intel-card ${intelClass}">
        <div class="dash-intel-beacon">
          <i class="fas ${intelIcon}"></i>
        </div>
        <div class="dash-intel-content">
          <div class="dash-intel-top">
            <span class="dash-intel-eyebrow">${intelEyebrow}</span>
            <span class="dash-intel-status-pill">${intelStatus}</span>
          </div>
          <h4 class="dash-intel-title">${escapeHtml(intelTitle)}</h4>
          <p class="dash-intel-desc">${escapeHtml(intelDesc)}</p>
        </div>
        <button class="dash-btn-secondary" onclick="switchSection('analytics', document.querySelector('.dropdown-item[onclick*=\\'analytics\\']'))" style="align-self: center; flex-shrink: 0;">
          <span>Analytics</span>
          <i class="fas fa-chevron-right" style="font-size: 10px;"></i>
        </button>
      </div>
    `;

    // 5. TODAY (Daily Check-in Status)
    const todayLogged = checkinToday.logged && checkinToday.data;
    const cData = todayLogged ? checkinToday.data : {};

    const weightVal = cData.weight !== undefined && cData.weight !== null ? `${cData.weight} kg` : null;
    let waterVal = null;
    if (cData.water_intake_l !== undefined && cData.water_intake_l !== null) {
      waterVal = `${cData.water_intake_l.toFixed(1)} L`;
    } else if (cData.water_intake_ml) {
      waterVal = `${(cData.water_intake_ml / 1000).toFixed(1)} L`;
    }

    const stepsVal = cData.steps_count !== undefined && cData.steps_count !== null ? `${cData.steps_count.toLocaleString()} steps` : null;
    let workoutVal = null;
    if (cData.workout_completed) {
      workoutVal = cData.workout_duration_mins ? `Done (${cData.workout_duration_mins}m)` : 'Completed';
    } else if (cData.workout_completed === false) {
      workoutVal = 'Rest Day';
    }

    const energyVal = cData.energy_level !== undefined && cData.energy_level !== null ? `${cData.energy_level} / 10` : null;

    let loggedCount = 0;
    if (weightVal) loggedCount++;
    if (waterVal) loggedCount++;
    if (stepsVal) loggedCount++;
    if (workoutVal) loggedCount++;
    if (energyVal) loggedCount++;

    const todaySectionHtml = `
      <div class="dash-card">
        <div class="dash-card-header">
          <h3 class="dash-card-title"><i class="fas fa-calendar-check"></i> Today's Status</h3>
          <span class="dash-tag">${loggedCount} of 5 Logged</span>
        </div>

        <div class="dash-today-grid">
          <!-- Weight -->
          <div class="dash-metric-tile ${weightVal ? 'tile-logged' : 'tile-pending'}" onclick="switchSection('checkin', document.querySelector('.nav-tab[onclick*=\\'checkin\\']'))">
            <div class="dash-metric-tile-header">
              <span class="dash-metric-name">Weight</span>
              <span class="dash-metric-badge">${weightVal ? '<i class="fas fa-check-circle" style="color:#00F5A0;"></i>' : '<i class="fas fa-circle" style="color:#71717A; font-size:7px;"></i>'}</span>
            </div>
            ${weightVal
        ? `<span class="dash-metric-val">${weightVal}</span>`
        : `<span class="dash-metric-prompt">+ Log Weight</span>`}
          </div>

          <!-- Hydration -->
          <div class="dash-metric-tile ${waterVal ? 'tile-logged' : 'tile-pending'}" onclick="switchSection('checkin', document.querySelector('.nav-tab[onclick*=\\'checkin\\']'))">
            <div class="dash-metric-tile-header">
              <span class="dash-metric-name">Water</span>
              <span class="dash-metric-badge">${waterVal ? '<i class="fas fa-check-circle" style="color:#00F5A0;"></i>' : '<i class="fas fa-circle" style="color:#71717A; font-size:7px;"></i>'}</span>
            </div>
            ${waterVal
        ? `<span class="dash-metric-val">${waterVal}</span>`
        : `<span class="dash-metric-prompt">+ Log Water</span>`}
          </div>

          <!-- Steps -->
          <div class="dash-metric-tile ${stepsVal ? 'tile-logged' : 'tile-pending'}" onclick="switchSection('checkin', document.querySelector('.nav-tab[onclick*=\\'checkin\\']'))">
            <div class="dash-metric-tile-header">
              <span class="dash-metric-name">Steps</span>
              <span class="dash-metric-badge">${stepsVal ? '<i class="fas fa-check-circle" style="color:#00F5A0;"></i>' : '<i class="fas fa-circle" style="color:#71717A; font-size:7px;"></i>'}</span>
            </div>
            ${stepsVal
        ? `<span class="dash-metric-val">${stepsVal}</span>`
        : `<span class="dash-metric-prompt">+ Log Steps</span>`}
          </div>

          <!-- Workout -->
          <div class="dash-metric-tile ${workoutVal ? 'tile-logged' : 'tile-pending'}" onclick="switchSection('checkin', document.querySelector('.nav-tab[onclick*=\\'checkin\\']'))">
            <div class="dash-metric-tile-header">
              <span class="dash-metric-name">Workout</span>
              <span class="dash-metric-badge">${workoutVal ? '<i class="fas fa-check-circle" style="color:#00F5A0;"></i>' : '<i class="fas fa-circle" style="color:#71717A; font-size:7px;"></i>'}</span>
            </div>
            ${workoutVal
        ? `<span class="dash-metric-val">${workoutVal}</span>`
        : `<span class="dash-metric-prompt">+ Log Workout</span>`}
          </div>

          <!-- Energy -->
          <div class="dash-metric-tile ${energyVal ? 'tile-logged' : 'tile-pending'}" onclick="switchSection('checkin', document.querySelector('.nav-tab[onclick*=\\'checkin\\']'))">
            <div class="dash-metric-tile-header">
              <span class="dash-metric-name">Energy</span>
              <span class="dash-metric-badge">${energyVal ? '<i class="fas fa-check-circle" style="color:#00F5A0;"></i>' : '<i class="fas fa-circle" style="color:#71717A; font-size:7px;"></i>'}</span>
            </div>
            ${energyVal
        ? `<span class="dash-metric-val">${energyVal}</span>`
        : `<span class="dash-metric-prompt">+ Rate Energy</span>`}
          </div>
        </div>
      </div>
    `;

    // 6. NEXT ACTION (Clear Priority Recommendation)
    let nextActionHtml = '';
    const recs = (recData.success && recData.recommendations) ? recData.recommendations : [];

    if (recs.length > 0) {
      const prioOrder = { high: 1, medium: 2, low: 3 };
      const sortedRecs = [...recs].sort((a, b) => (prioOrder[a.priority] || 4) - (prioOrder[b.priority] || 4));
      const topRec = sortedRecs[0];

      const categoryLabels = {
        goal_progress: 'Goal Strategy',
        activity: 'Activity Habit',
        hydration: 'Hydration Target',
        recovery: 'Recovery & Rest',
        consistency: 'Routine Consistency'
      };
      const catLabel = categoryLabels[topRec.category] || topRec.category;
      const catIcon = getCategoryIcon(topRec.category);
      const impactScore = getHealthScoreImpact(topRec.category, topRec.priority);

      let targetSection = 'checkin';
      if (topRec.category === 'activity') targetSection = 'workouts';
      else if (topRec.category === 'goal_progress') targetSection = 'goals';

      nextActionHtml = `
        <div class="dash-card">
          <div class="dash-card-header">
            <h3 class="dash-card-title"><i class="fas fa-bolt"></i> Next Action</h3>
            <span class="dash-tag" style="color: #00D2FF; border-color: rgba(0, 210, 255, 0.3);">${escapeHtml(catLabel)}</span>
          </div>
          <div class="dash-nextaction-body">
            <div>
              <h4 class="dash-action-headline">${escapeHtml(topRec.title)}</h4>
              <p class="dash-action-desc">${escapeHtml(topRec.description)}</p>
            </div>

            <div class="dash-action-impact-box">
              <span class="dash-impact-label">Potential Score Gain</span>
              <span class="dash-impact-val">${impactScore}</span>
            </div>

            <button class="dash-btn-primary" onclick="switchSection('${targetSection}')">
              <span>Execute Action</span>
              <i class="fas fa-arrow-right" style="font-size: 11px;"></i>
            </button>
          </div>
        </div>
      `;
    } else {
      nextActionHtml = `
        <div class="dash-card">
          <div class="dash-card-header">
            <h3 class="dash-card-title"><i class="fas fa-bolt"></i> Next Action</h3>
            <span class="dash-tag" style="color: #00F5A0;">Optimized</span>
          </div>
          <div class="dash-nextaction-body" style="text-align: center; align-items: center; justify-content: center;">
            <i class="fas fa-check-circle" style="font-size: 32px; color: #00F5A0; margin-bottom: 8px;"></i>
            <h4 class="dash-action-headline" style="margin-bottom: 4px;">System Fully Balanced</h4>
            <p class="dash-action-desc" style="max-width: 280px;">All check-in habits and nutrition markers are within target range. Protect your streak with today's log.</p>
            <button class="dash-btn-secondary" onclick="switchSection('checkin')" style="margin-top: 10px;">
              <span>Open Check-in</span>
            </button>
          </div>
        </div>
      `;
    }

    // 7. JOURNEY PREVIEW (Compact Weight Spark-Curve)
    const weightHistory = (analyticsData.success && analyticsData.weightHistory) ? analyticsData.weightHistory : [];
    const sparklineSvg = renderDashboardSparkline(weightHistory);

    let latestWeightStr = '--';
    let totalDeltaStr = '--';
    if (weightHistory.length > 0) {
      const latestW = weightHistory[weightHistory.length - 1].weight;
      const firstW = weightHistory[0].weight;
      latestWeightStr = `${latestW.toFixed(1)} kg`;
      const delta = (latestW - firstW);
      totalDeltaStr = `${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg`;
    }

    let weeklyVelocityStr = 'Calibrating';
    if (analyticsData.velocity && typeof analyticsData.velocity.weeklyRate === 'number') {
      const rate = analyticsData.velocity.weeklyRate;
      weeklyVelocityStr = `${rate > 0 ? '+' : ''}${rate.toFixed(2)} kg/wk`;
    }

    const journeyPreviewHtml = `
      <div class="dash-card" onclick="switchSection('journey', document.querySelector('.nav-tab[onclick*=\\'journey\\']'))" style="cursor: pointer;">
        <div class="dash-card-header">
          <h3 class="dash-card-title"><i class="fas fa-chart-line"></i> Weight Trajectory</h3>
          <span class="dash-tag">30-Day Window</span>
        </div>
        <div class="dash-journey-spark-wrap">
          ${sparklineSvg}

          <div class="dash-journey-stats">
            <div class="dash-j-stat">
              <span class="j-label">Latest Weigh-in</span>
              <span class="j-val">${latestWeightStr}</span>
            </div>
            <div class="dash-j-stat">
              <span class="j-label">Total Delta</span>
              <span class="j-val">${totalDeltaStr}</span>
            </div>
            <div class="dash-j-stat">
              <span class="j-label">Weekly Velocity</span>
              <span class="j-val">${weeklyVelocityStr}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // 8. AI COACH ENTRY
    const coachDaily = (coachData.success && coachData.dailySummary) ? coachData.dailySummary : {};
    const coachQuote = coachDaily.summary || "Your biometric telemetry is active. Consistent logging creates the statistical resolution required for precision guidance.";
    const coachFocus = coachDaily.focus || "Maintain hydration and active recovery pace.";

    const coachEntryHtml = `
      <div class="dash-card">
        <div class="dash-card-header">
          <h3 class="dash-card-title"><i class="fas fa-robot" style="color: #A78BFA;"></i> AI Coach</h3>
          <span class="dash-tag" style="color: #A78BFA; border-color: rgba(167, 139, 250, 0.3);">
            <i class="fas fa-circle" style="font-size: 6px; margin-right: 4px; color: #00F5A0;"></i> Synchronized
          </span>
        </div>

        <div class="dash-coach-body">
          <p class="dash-coach-quote">"${escapeHtml(coachQuote)}"</p>

          <div class="dash-coach-focus-pill">
            <span class="dash-coach-focus-label">Today's Directive</span>
            <span class="dash-coach-focus-text">${escapeHtml(coachFocus)}</span>
          </div>

          <div class="dash-coach-prompts">
            <span class="dash-prompt-chip" onclick="switchSection('coach'); event.stopPropagation();">
              "How is my weight velocity?"
            </span>
            <span class="dash-prompt-chip" onclick="switchSection('coach'); event.stopPropagation();">
              "Review rest day nutrition"
            </span>
          </div>

          <button class="dash-btn-primary" onclick="switchSection('coach', document.querySelector('.nav-tab[onclick*=\\'coach\\']'))" style="background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%);">
            <span>Consult AI Coach</span>
            <i class="fas fa-arrow-right" style="font-size: 11px;"></i>
          </button>
        </div>
      </div>
    `;

    // Assemble the complete Dashboard Layout
    container.innerHTML = `
      <div class="dashboard-layout-container">
        <!-- Stage 1: Health State Hero + Goal Progress Hero -->
        <div class="dash-hero-grid">
          <!-- Health Hero Card -->
          <div class="dash-card" onclick="switchSection('healthscore', document.querySelector('.nav-tab[onclick*=\\'healthscore\\']'))" style="cursor: pointer;">
            <div class="dash-card-header">
              <h3 class="dash-card-title"><i class="fas fa-heartbeat"></i> Health State</h3>
              <span class="dash-tier-badge tier-${ratingClass}">
                <i class="fas fa-shield-halved"></i> ${rating}
              </span>
            </div>

            <div class="dash-health-hero">
              <div class="dash-gauge-wrapper">
                <svg class="dash-gauge-svg" viewBox="0 0 120 120">
                  <circle class="dash-gauge-bg" cx="60" cy="60" r="54" fill="none" stroke-width="8" />
                  <circle class="dash-gauge-progress" cx="60" cy="60" r="54" fill="none"
                    stroke="${gaugeColor}"
                    stroke-width="8"
                    stroke-dasharray="${circ}"
                    stroke-dashoffset="${strokeOffset}" />
                </svg>
                <div class="dash-gauge-center">
                  <span class="dash-score-num">${score}</span>
                  <span class="dash-score-denom">OF 100</span>
                </div>
              </div>

              <div class="dash-health-details">
                <p class="dash-health-driver">${escapeHtml(driverText)}</p>

                <div class="dash-pillars-mini">
                  <div class="dash-pillar-row">
                    <span class="dash-pillar-name">Goal Progress</span>
                    <div class="dash-pillar-bar"><div class="dash-pillar-fill" style="width: ${(breakdown.goalProgress?.score || 0) / 25 * 100}%;"></div></div>
                    <span class="dash-pillar-val">${breakdown.goalProgress?.score || 0}/25</span>
                  </div>
                  <div class="dash-pillar-row">
                    <span class="dash-pillar-name">Activity Habits</span>
                    <div class="dash-pillar-bar"><div class="dash-pillar-fill" style="width: ${(breakdown.activityHabits?.score || 0) / 20 * 100}%;"></div></div>
                    <span class="dash-pillar-val">${breakdown.activityHabits?.score || 0}/20</span>
                  </div>
                  <div class="dash-pillar-row">
                    <span class="dash-pillar-name">Hydration</span>
                    <div class="dash-pillar-bar"><div class="dash-pillar-fill" style="width: ${(breakdown.hydration?.score || 0) / 15 * 100}%;"></div></div>
                    <span class="dash-pillar-val">${breakdown.hydration?.score || 0}/15</span>
                  </div>
                  <div class="dash-pillar-row">
                    <span class="dash-pillar-name">Consistency</span>
                    <div class="dash-pillar-bar"><div class="dash-pillar-fill" style="width: ${(breakdown.checkinStreaks?.score || 0) / 25 * 100}%;"></div></div>
                    <span class="dash-pillar-val">${breakdown.checkinStreaks?.score || 0}/25</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Goal Hero Card -->
          ${goalHeroHtml}
        </div>

        <!-- Stage 2: "What Changed?" Intelligence (Capability 3) -->
        ${intelSectionHtml}

        <!-- Stage 3: Today's Biometric Logbook + Next Action Directive -->
        <div class="dash-split-grid">
          ${todaySectionHtml}
          ${nextActionHtml}
        </div>

        <!-- Stage 4: Weight Journey Preview + AI Coach Integration -->
        <div class="dash-split-grid">
          ${journeyPreviewHtml}
          ${coachEntryHtml}
        </div>
      </div>
    `;

  } catch (err) {
    console.error(err);
    container.innerHTML = `
      <div class="dash-card" style="padding: 28px; text-align: center;">
        <i class="fas fa-exclamation-triangle" style="font-size: 28px; color: #EF4444; margin-bottom: 12px;"></i>
        <h4 style="margin: 0 0 6px 0; color: #FAFAFA;">Failed to load dashboard telemetry</h4>
        <p style="margin: 0 0 16px 0; font-size: 13px; color: #A1A1AA;">Unable to connect to local health service. Please refresh or check your session.</p>
        <button class="dash-btn-secondary" onclick="loadDashboardHome()">
          <i class="fas fa-rotate-right"></i> Retry Sync
        </button>
      </div>
    `;
  }
}


