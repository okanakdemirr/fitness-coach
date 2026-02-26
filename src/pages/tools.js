import { store } from '../store.js';
import { showModal, showToast } from '../utils.js';

export function toolsPage(container) {
  const settings = store.getSettings();
  const unit = settings.weightUnit || 'kg';

  container.innerHTML = `
    <p class="page-title">Tools</p>

    <div class="tools-grid">
      <div class="tool-card" id="tool-1rm">
        <div class="tool-icon" style="background: var(--accent-dim); color: var(--accent)">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 20V10M12 20V4M6 20v-6"/>
          </svg>
        </div>
        <div class="tool-name">1RM Calculator</div>
        <div class="tool-desc">Estimate your one-rep max</div>
      </div>

      <div class="tool-card" id="tool-plate">
        <div class="tool-icon" style="background: var(--warning-dim); color: var(--warning)">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="6" width="4" height="12" rx="1"/>
            <rect x="18" y="6" width="4" height="12" rx="1"/>
            <line x1="6" y1="12" x2="18" y2="12"/>
            <rect x="6" y="8" width="3" height="8" rx="0.5"/>
            <rect x="15" y="8" width="3" height="8" rx="0.5"/>
          </svg>
        </div>
        <div class="tool-name">Plate Calculator</div>
        <div class="tool-desc">What plates to load</div>
      </div>

      <div class="tool-card" id="tool-bmi">
        <div class="tool-icon" style="background: rgba(165,94,234,0.15); color: #a55eea">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
          </svg>
        </div>
        <div class="tool-name">BMI Calculator</div>
        <div class="tool-desc">Body mass index</div>
      </div>

      <div class="tool-card" id="tool-rm-table">
        <div class="tool-icon" style="background: var(--danger-dim); color: var(--danger)">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="3" y1="15" x2="21" y2="15"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
          </svg>
        </div>
        <div class="tool-name">RM Table</div>
        <div class="tool-desc">Rep max percentages</div>
      </div>

      <div class="tool-card" id="tool-progress">
        <div class="tool-icon" style="background: rgba(102,126,234,0.15); color: var(--accent-secondary)">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        </div>
        <div class="tool-name">Exercise Progress</div>
        <div class="tool-desc">Track per-exercise history</div>
      </div>

      <div class="tool-card" id="tool-stopwatch">
        <div class="tool-icon" style="background: rgba(0,212,170,0.15); color: var(--accent)">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="13" r="9"/>
            <polyline points="12 9 12 13 16 13"/>
            <path d="M9 2h6M12 2v2"/>
          </svg>
        </div>
        <div class="tool-name">Stopwatch</div>
        <div class="tool-desc">Count up timer with laps</div>
      </div>
    </div>
  `;

  container.querySelector('#tool-1rm').addEventListener('click', () => show1RMCalculator(unit));
  container.querySelector('#tool-plate').addEventListener('click', () => showPlateCalculator(unit));
  container.querySelector('#tool-bmi').addEventListener('click', () => showBMICalculator(unit));
  container.querySelector('#tool-rm-table').addEventListener('click', () => showRMTable(unit));
  container.querySelector('#tool-progress').addEventListener('click', () => showExerciseProgress(unit));
  container.querySelector('#tool-stopwatch').addEventListener('click', () => showStopwatch());
}

// ===== 1RM CALCULATOR =====
function show1RMCalculator(unit) {
  const el = document.createElement('div');

  el.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">1RM Calculator</h3>
      <button class="modal-close" id="close-1rm">&times;</button>
    </div>
    <p class="text-muted text-sm mb-16">Estimate your one-rep max from a set you completed.</p>
    <div class="input-group">
      <label class="input-label">Weight lifted (${unit})</label>
      <input type="number" class="input" id="orm-weight" placeholder="e.g. 80" inputmode="decimal">
    </div>
    <div class="input-group">
      <label class="input-label">Reps completed</label>
      <input type="number" class="input" id="orm-reps" placeholder="e.g. 5" min="1" max="30" inputmode="numeric">
    </div>
    <button class="btn btn-primary btn-block mb-16" id="calc-1rm">Calculate</button>
    <div id="orm-results"></div>
  `;

  const close = showModal(el);

  setTimeout(() => {
    el.querySelector('#close-1rm')?.addEventListener('click', close);
    el.querySelector('#calc-1rm')?.addEventListener('click', () => {
      const weight = parseFloat(el.querySelector('#orm-weight').value);
      const reps = parseInt(el.querySelector('#orm-reps').value);

      if (!weight || !reps || reps < 1) {
        showToast('Enter weight and reps', 'error');
        return;
      }

      if (reps === 1) {
        el.querySelector('#orm-results').innerHTML = `
          <div class="card text-center">
            <div class="stat-value">${weight} ${unit}</div>
            <div class="stat-label">Your 1RM (actual)</div>
          </div>
        `;
        return;
      }

      const epley = weight * (1 + reps / 30);
      const brzycki = weight * (36 / (37 - reps));
      const lander = (100 * weight) / (101.3 - 2.67123 * reps);
      const avg = (epley + brzycki + lander) / 3;

      el.querySelector('#orm-results').innerHTML = `
        <div class="card mb-12 text-center">
          <div class="stat-value">${Math.round(avg)} ${unit}</div>
          <div class="stat-label">Estimated 1RM (average)</div>
        </div>
        <div class="text-sm text-muted mb-8">
          <div class="flex justify-between" style="padding:4px 0"><span>Epley formula</span><span class="font-bold">${Math.round(epley)} ${unit}</span></div>
          <div class="flex justify-between" style="padding:4px 0"><span>Brzycki formula</span><span class="font-bold">${Math.round(brzycki)} ${unit}</span></div>
          <div class="flex justify-between" style="padding:4px 0"><span>Lander formula</span><span class="font-bold">${Math.round(lander)} ${unit}</span></div>
        </div>
        <div class="divider"></div>
        <p class="section-title mt-8">Training Percentages</p>
        <div class="text-sm">
          ${[
            { pct: 95, label: '2 reps' },
            { pct: 90, label: '3-4 reps' },
            { pct: 85, label: '5-6 reps' },
            { pct: 80, label: '7-8 reps' },
            { pct: 75, label: '8-10 reps' },
            { pct: 70, label: '10-12 reps' },
            { pct: 65, label: '12-15 reps' },
            { pct: 60, label: '15-20 reps' },
          ].map(r => `
            <div class="flex justify-between" style="padding:4px 0">
              <span>${r.pct}% <span class="text-muted">(${r.label})</span></span>
              <span class="font-bold text-accent">${Math.round(avg * r.pct / 100)} ${unit}</span>
            </div>
          `).join('')}
        </div>
      `;
    });
  }, 100);
}

// ===== PLATE CALCULATOR =====
function showPlateCalculator(unit) {
  const barWeight = unit === 'kg' ? 20 : 45;
  const plates = unit === 'kg'
    ? [25, 20, 15, 10, 5, 2.5, 1.25]
    : [45, 35, 25, 10, 5, 2.5];

  const el = document.createElement('div');

  el.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">Plate Calculator</h3>
      <button class="modal-close" id="close-plate">&times;</button>
    </div>
    <p class="text-muted text-sm mb-16">Shows plates needed per side (${barWeight} ${unit} bar).</p>
    <div class="input-group">
      <label class="input-label">Target weight (${unit})</label>
      <input type="number" class="input" id="plate-target" placeholder="e.g. 100" inputmode="decimal">
    </div>
    <div class="input-group">
      <label class="input-label">Bar weight (${unit})</label>
      <input type="number" class="input" id="plate-bar" value="${barWeight}" inputmode="decimal">
    </div>
    <button class="btn btn-primary btn-block mb-16" id="calc-plates">Calculate</button>
    <div id="plate-results"></div>
  `;

  const close = showModal(el);

  setTimeout(() => {
    el.querySelector('#close-plate')?.addEventListener('click', close);
    el.querySelector('#calc-plates')?.addEventListener('click', () => {
      const target = parseFloat(el.querySelector('#plate-target').value);
      const bar = parseFloat(el.querySelector('#plate-bar').value) || barWeight;

      if (!target || target <= bar) {
        el.querySelector('#plate-results').innerHTML = `
          <div class="card text-center text-muted">
            ${target && target === bar ? 'Just the bar!' : 'Enter a weight greater than the bar.'}
          </div>
        `;
        return;
      }

      let perSide = (target - bar) / 2;
      const needed = [];
      const plateColors = {
        25: '#ff6b6b', 20: '#667eea', 15: '#ffd93d', 10: '#00d4aa',
        5: '#ff9f43', 2.5: '#a55eea', 1.25: '#888',
        45: '#667eea', 35: '#ffd93d'
      };

      for (const plate of plates) {
        const count = Math.floor(perSide / plate);
        if (count > 0) {
          needed.push({ weight: plate, count });
          perSide -= count * plate;
        }
      }

      const remainder = Math.round(perSide * 100) / 100;

      el.querySelector('#plate-results').innerHTML = `
        <div class="card mb-12">
          <div class="text-center mb-12">
            <div class="stat-value">${target} ${unit}</div>
            <div class="stat-label">Total weight</div>
          </div>
          ${needed.length === 0 ? '<p class="text-center text-muted">No plates needed</p>' : ''}
          <p class="section-title">Per side:</p>
          <div class="plate-visual">
            ${needed.map(p => `
              <div class="plate-row">
                <div class="plate-display">
                  ${Array.from({ length: p.count }, () => `
                    <div class="plate-disc" style="background:${plateColors[p.weight] || 'var(--bg-tertiary)'}; height:${Math.max(24, Math.min(56, p.weight * 2.2))}px">
                      ${p.weight}
                    </div>
                  `).join('')}
                </div>
                <span class="text-sm">${p.weight} ${unit} &times; ${p.count}</span>
              </div>
            `).join('')}
          </div>
          ${remainder > 0.01 ? `<p class="text-sm text-danger mt-8">Cannot make exact weight. ${remainder} ${unit} short per side.</p>` : ''}
        </div>
      `;
    });
  }, 100);
}

// ===== BMI CALCULATOR =====
function showBMICalculator(unit) {
  const el = document.createElement('div');

  el.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">BMI Calculator</h3>
      <button class="modal-close" id="close-bmi">&times;</button>
    </div>
    <div class="input-group">
      <label class="input-label">Weight (${unit})</label>
      <input type="number" class="input" id="bmi-weight" placeholder="e.g. 75" inputmode="decimal">
    </div>
    <div class="input-group">
      <label class="input-label">Height (cm)</label>
      <input type="number" class="input" id="bmi-height" placeholder="e.g. 175" inputmode="numeric">
    </div>
    <button class="btn btn-primary btn-block mb-16" id="calc-bmi">Calculate</button>
    <div id="bmi-results"></div>
  `;

  const close = showModal(el);

  setTimeout(() => {
    el.querySelector('#close-bmi')?.addEventListener('click', close);
    el.querySelector('#calc-bmi')?.addEventListener('click', () => {
      let weight = parseFloat(el.querySelector('#bmi-weight').value);
      const heightCm = parseFloat(el.querySelector('#bmi-height').value);

      if (!weight || !heightCm) {
        showToast('Enter weight and height', 'error');
        return;
      }

      // Convert lbs to kg if needed
      if (unit === 'lbs') weight = weight * 0.453592;

      const heightM = heightCm / 100;
      const bmi = weight / (heightM * heightM);
      const bmiRounded = Math.round(bmi * 10) / 10;

      let category, color;
      if (bmi < 18.5) { category = 'Underweight'; color = 'var(--warning)'; }
      else if (bmi < 25) { category = 'Normal weight'; color = 'var(--accent)'; }
      else if (bmi < 30) { category = 'Overweight'; color = 'var(--warning)'; }
      else { category = 'Obese'; color = 'var(--danger)'; }

      // BMI scale position (15-40 range)
      const pct = Math.min(100, Math.max(0, ((bmi - 15) / 25) * 100));

      el.querySelector('#bmi-results').innerHTML = `
        <div class="card text-center">
          <div class="stat-value" style="color:${color}">${bmiRounded}</div>
          <div class="stat-label mb-16">${category}</div>
          <div class="bmi-scale">
            <div class="bmi-bar">
              <div class="bmi-zone" style="background:#ffd93d;flex:0.14"></div>
              <div class="bmi-zone" style="background:#00d4aa;flex:0.26"></div>
              <div class="bmi-zone" style="background:#ffd93d;flex:0.2"></div>
              <div class="bmi-zone" style="background:#ff6b6b;flex:0.4"></div>
            </div>
            <div class="bmi-marker" style="left:${pct}%"></div>
            <div class="bmi-labels">
              <span>15</span>
              <span>18.5</span>
              <span>25</span>
              <span>30</span>
              <span>40</span>
            </div>
          </div>
          <p class="text-sm text-muted mt-16">BMI is a rough guide and doesn't account for muscle mass, bone density, or body composition.</p>
        </div>
      `;
    });
  }, 100);
}

// ===== RM TABLE =====
function showRMTable(unit) {
  const el = document.createElement('div');

  el.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">Rep Max Table</h3>
      <button class="modal-close" id="close-rm">&times;</button>
    </div>
    <p class="text-muted text-sm mb-12">Enter your 1RM to see working weights.</p>
    <div class="input-group">
      <label class="input-label">1RM Weight (${unit})</label>
      <input type="number" class="input" id="rm-1rm" placeholder="e.g. 100" inputmode="decimal">
    </div>
    <button class="btn btn-primary btn-block mb-16" id="calc-rm">Generate Table</button>
    <div id="rm-results"></div>
  `;

  const close = showModal(el);

  setTimeout(() => {
    el.querySelector('#close-rm')?.addEventListener('click', close);
    el.querySelector('#calc-rm')?.addEventListener('click', () => {
      const orm = parseFloat(el.querySelector('#rm-1rm').value);
      if (!orm) { showToast('Enter your 1RM', 'error'); return; }

      const rows = [
        { pct: 100, reps: '1', zone: 'Max Strength' },
        { pct: 95, reps: '2', zone: 'Max Strength' },
        { pct: 90, reps: '3-4', zone: 'Strength' },
        { pct: 85, reps: '5-6', zone: 'Strength' },
        { pct: 80, reps: '7-8', zone: 'Hypertrophy' },
        { pct: 75, reps: '8-10', zone: 'Hypertrophy' },
        { pct: 70, reps: '10-12', zone: 'Hypertrophy' },
        { pct: 65, reps: '12-15', zone: 'Endurance' },
        { pct: 60, reps: '15-20', zone: 'Endurance' },
        { pct: 55, reps: '20-25', zone: 'Endurance' },
        { pct: 50, reps: '25+', zone: 'Endurance' },
      ];

      const zoneColors = {
        'Max Strength': 'var(--danger)',
        'Strength': 'var(--warning)',
        'Hypertrophy': 'var(--accent)',
        'Endurance': 'var(--accent-secondary)'
      };

      el.querySelector('#rm-results').innerHTML = `
        <div class="rm-table">
          <div class="rm-table-header">
            <span>%</span><span>Weight</span><span>Reps</span><span>Zone</span>
          </div>
          ${rows.map(r => `
            <div class="rm-table-row">
              <span>${r.pct}%</span>
              <span class="font-bold">${Math.round(orm * r.pct / 100)} ${unit}</span>
              <span>${r.reps}</span>
              <span style="color:${zoneColors[r.zone]};font-size:11px">${r.zone}</span>
            </div>
          `).join('')}
        </div>
      `;
    });
  }, 100);
}

// ===== EXERCISE PROGRESS =====
function showExerciseProgress(unit) {
  const workouts = store.getWorkouts();
  const exerciseNames = new Set();
  workouts.forEach(w => w.exercises.forEach(e => exerciseNames.add(e.name)));
  const names = [...exerciseNames].sort();

  const el = document.createElement('div');

  function render(selectedExercise = null) {
    el.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">Exercise Progress</h3>
        <button class="modal-close" id="close-progress">&times;</button>
      </div>
      ${names.length === 0 ? `
        <p class="text-muted text-center">No exercise data yet. Complete some workouts first!</p>
      ` : `
        <div class="input-group">
          <label class="input-label">Select Exercise</label>
          <select class="input" id="progress-exercise">
            <option value="">Choose...</option>
            ${names.map(n => `<option value="${n}" ${n === selectedExercise ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </div>
        <div id="progress-data"></div>
      `}
    `;

    setTimeout(() => {
      el.querySelector('#close-progress')?.addEventListener('click', close);
      el.querySelector('#progress-exercise')?.addEventListener('change', (e) => {
        if (e.target.value) renderExerciseData(el.querySelector('#progress-data'), e.target.value, workouts, unit);
      });

      if (selectedExercise) {
        renderExerciseData(el.querySelector('#progress-data'), selectedExercise, workouts, unit);
      }
    }, 50);
  }

  render();
  const close = showModal(el);
}

function renderExerciseData(container, exerciseName, workouts, unit) {
  // Collect all instances of this exercise across workouts
  const history = [];
  workouts.forEach(w => {
    w.exercises.forEach(ex => {
      if (ex.name === exerciseName) {
        const completedSets = ex.sets.filter(s => s.completed);
        if (completedSets.length > 0) {
          const maxWeight = Math.max(...completedSets.map(s => s.weight || 0));
          const totalVolume = completedSets.reduce((a, s) => a + (s.weight || 0) * (s.reps || 0), 0);
          const maxReps = Math.max(...completedSets.map(s => s.reps || 0));
          history.push({
            date: w.date,
            sets: completedSets,
            maxWeight,
            maxReps,
            totalVolume,
            numSets: completedSets.length
          });
        }
      }
    });
  });

  if (history.length === 0) {
    container.innerHTML = '<p class="text-muted text-center mt-16">No completed sets found for this exercise.</p>';
    return;
  }

  // Show in reverse chronological order
  const sorted = history.sort((a, b) => b.date.localeCompare(a.date));
  const allTimeMax = Math.max(...sorted.map(h => h.maxWeight));

  // Progress chart (last 10 sessions, max weight)
  const chartData = sorted.slice(0, 10).reverse();
  const chartMax = Math.max(...chartData.map(d => d.maxWeight), 1);

  container.innerHTML = `
    <div class="stat-grid mt-16 mb-16">
      <div class="stat-card">
        <div class="stat-value">${allTimeMax}</div>
        <div class="stat-label">Best (${unit})</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${sorted.length}</div>
        <div class="stat-label">Sessions</div>
      </div>
    </div>

    ${chartData.length >= 2 ? `
      <p class="section-title">Weight Trend (last ${chartData.length})</p>
      <div class="weekly-chart" style="height:100px">
        ${chartData.map(d => `
          <div class="weekly-bar">
            <div class="weekly-bar-fill" style="height:${Math.max(6, (d.maxWeight / chartMax) * 70)}px"></div>
            <span class="weekly-bar-label">${d.maxWeight}</span>
          </div>
        `).join('')}
      </div>
    ` : ''}

    <p class="section-title">History</p>
    <div style="max-height:250px;overflow-y:auto">
      ${sorted.map(h => `
        <div class="card mb-8" style="padding:12px">
          <div class="flex justify-between items-center mb-4">
            <span class="text-sm font-bold">${new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            <span class="badge badge-accent">${h.maxWeight} ${unit}</span>
          </div>
          <div class="text-sm text-muted">
            ${h.numSets} sets · ${h.sets.map(s => `${s.weight}${unit}x${s.reps}`).join(', ')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ===== STOPWATCH =====
function showStopwatch() {
  let interval = null;
  let elapsed = 0;
  let running = false;
  let laps = [];
  let lastLapTime = 0;

  const el = document.createElement('div');

  function render() {
    el.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">Stopwatch</h3>
        <button class="modal-close" id="close-sw">&times;</button>
      </div>
      <div class="text-center">
        <div class="stopwatch-time" id="sw-time">${formatStopwatch(elapsed)}</div>
        <div class="timer-controls" style="justify-content:center;margin:20px 0">
          <button class="timer-control-btn reset" id="sw-lap" title="${elapsed === 0 ? 'Reset' : 'Lap'}">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5">
              ${elapsed === 0 && !running ? `
                <path d="M3 12a9 9 0 1 1 9 9 9 9 0 0 1-6.36-2.64"/>
                <path d="M3 3v9h9"/>
              ` : `
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              `}
            </svg>
          </button>
          <button class="timer-control-btn ${running ? 'pause' : 'play'}" id="sw-toggle">
            ${running ? `
              <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
            ` : `
              <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6,3 20,12 6,21"/></svg>
            `}
          </button>
          ${!running && elapsed > 0 ? `
            <button class="timer-control-btn stop" id="sw-reset" title="Reset">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
              </svg>
            </button>
          ` : ''}
        </div>
      </div>
      ${laps.length > 0 ? `
        <div class="divider"></div>
        <p class="section-title">Laps</p>
        <div style="max-height:200px;overflow-y:auto">
          ${laps.map((lap, i) => `
            <div class="flex justify-between text-sm" style="padding:6px 0;border-bottom:1px solid var(--border)">
              <span class="text-muted">Lap ${laps.length - i}</span>
              <span class="font-bold">${formatStopwatch(lap.split)}</span>
              <span class="text-muted">${formatStopwatch(lap.total)}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;

    setTimeout(bind, 30);
  }

  function bind() {
    el.querySelector('#close-sw')?.addEventListener('click', () => {
      clearInterval(interval);
      close();
    });

    el.querySelector('#sw-toggle')?.addEventListener('click', () => {
      if (running) {
        clearInterval(interval);
        running = false;
      } else {
        running = true;
        const start = Date.now() - elapsed;
        interval = setInterval(() => {
          elapsed = Date.now() - start;
          const timeEl = el.querySelector('#sw-time');
          if (timeEl) timeEl.textContent = formatStopwatch(elapsed);
        }, 50);
      }
      render();
    });

    el.querySelector('#sw-lap')?.addEventListener('click', () => {
      if (running) {
        const split = elapsed - lastLapTime;
        laps.unshift({ split, total: elapsed });
        lastLapTime = elapsed;
        render();
      } else if (elapsed > 0) {
        // Reset
        elapsed = 0;
        laps = [];
        lastLapTime = 0;
        render();
      }
    });

    el.querySelector('#sw-reset')?.addEventListener('click', () => {
      elapsed = 0;
      laps = [];
      lastLapTime = 0;
      render();
    });
  }

  render();
  const close = showModal(el);
}

function formatStopwatch(ms) {
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const centis = Math.floor((ms % 1000) / 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}
