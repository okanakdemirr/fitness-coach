import { store } from '../store.js';
import { showModal, parseDecimal, formatNumber, escapeHtml } from '../utils.js';
import { showExerciseProgress } from '../exerciseProgress.js';

const TOOLS = [
  {
    id: 'plates', name: 'Plate Calculator', desc: 'What to load on each side', tone: 'var(--accent-ink)',
    icon: '<rect x="3" y="7" width="3" height="10" rx="1"/><rect x="6" y="5" width="3" height="14" rx="1"/><path d="M9 12h6"/><rect x="15" y="5" width="3" height="14" rx="1"/><rect x="18" y="7" width="3" height="10" rx="1"/>'
  },
  {
    id: '1rm', name: '1RM Calculator', desc: 'Estimate your one-rep max', tone: 'var(--accent-secondary)',
    icon: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>'
  },
  {
    id: 'progress', name: 'Exercise Progress', desc: 'Charts for every lift', tone: '#4cc9f0',
    icon: '<polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/>'
  },
  {
    id: 'weight', name: 'Body Weight', desc: 'Log and chart your weight', tone: '#b18cff',
    icon: '<path d="M5 7h14l-1.5 13h-11z"/><path d="M9 7a3 3 0 0 1 6 0"/>'
  },
  {
    id: 'rm-table', name: 'Percentage Table', desc: 'Working weights from a 1RM', tone: 'var(--danger)',
    icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>'
  },
  {
    id: 'bmi', name: 'BMI Calculator', desc: 'Body mass index', tone: 'var(--warning)',
    icon: '<circle cx="12" cy="7" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>'
  },
  {
    id: 'stopwatch', name: 'Stopwatch', desc: 'Count up with laps', tone: '#ff8f5a',
    icon: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6M12 2v3"/>'
  }
];

export function toolsPage(container) {
  const unit = store.getSettings().weightUnit;

  container.innerHTML = `
    <header class="page-header"><h1 class="page-title">Tools</h1></header>
    <div class="tools-grid">
      ${TOOLS.map(t => `
        <button class="tool-card" data-tool="${t.id}">
          <span class="tool-icon" style="--tone:${t.tone}" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${t.icon}</svg>
          </span>
          <span class="tool-name">${t.name}</span>
          <span class="tool-desc">${t.desc}</span>
        </button>
      `).join('')}
    </div>
  `;

  const actions = {
    plates: () => showPlateCalculator(unit),
    '1rm': () => show1RMCalculator(unit),
    progress: () => showExerciseProgress(),
    weight: () => { window.location.hash = '#/weight'; },
    'rm-table': () => showRMTable(unit),
    bmi: () => showBMICalculator(unit),
    stopwatch: () => showStopwatch()
  };

  container.querySelectorAll('[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => actions[btn.dataset.tool]());
  });
}

function sheetHeader(title) {
  return `
    <div class="modal-header">
      <h3 class="modal-title">${title}</h3>
      <button class="modal-close" data-close aria-label="Close">&times;</button>
    </div>
  `;
}

function numberField(id, label, placeholder, mode = 'decimal') {
  return `
    <div class="input-group">
      <label class="input-label" for="${id}">${label}</label>
      <input type="text" class="input input-lg" id="${id}" placeholder="${placeholder}" inputmode="${mode}" autocomplete="off">
    </div>
  `;
}

// ===== PLATE CALCULATOR =====
const PLATES = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lbs: [45, 35, 25, 10, 5, 2.5]
};
const BARS = { kg: [20, 15, 10], lbs: [45, 35, 15] };
// Standard competition colours, heaviest first
const PLATE_COLORS = ['#ff5d6c', '#4c8dff', '#ffc94d', '#36d399', '#e9ebf0', '#9aa0ad', '#6e7381'];

function showPlateCalculator(unit) {
  const plates = PLATES[unit] || PLATES.kg;
  const bars = BARS[unit] || BARS.kg;
  let bar = bars[0];
  const el = document.createElement('div');
  el.innerHTML = `
    ${sheetHeader('Plate Calculator')}
    ${numberField('plate-target', `Target weight (${escapeHtml(unit)})`, unit === 'kg' ? 'e.g. 100' : 'e.g. 225')}
    <div class="input-group">
      <span class="input-label">Bar weight</span>
      <div class="chip-group">
        ${bars.map(b => `<button class="chip ${b === bar ? 'active' : ''}" data-bar="${b}">${b} ${escapeHtml(unit)}</button>`).join('')}
      </div>
    </div>
    <div id="plate-result" class="tool-result"></div>
  `;
  showModal(el);

  const input = el.querySelector('#plate-target');
  const result = el.querySelector('#plate-result');

  function calc() {
    const target = parseDecimal(input.value);
    if (!target) {
      result.innerHTML = '<p class="tool-hint">Enter the total weight you want on the bar.</p>';
      return;
    }
    if (target < bar) {
      result.innerHTML = `<p class="tool-hint">That's lighter than the bar (${bar} ${escapeHtml(unit)}).</p>`;
      return;
    }
    let perSide = (target - bar) / 2;
    const loaded = [];
    for (const p of plates) {
      while (perSide >= p - 1e-9) {
        loaded.push(p);
        perSide -= p;
      }
    }
    const achieved = target - perSide * 2;
    const counts = loaded.reduce((m, p) => { m[p] = (m[p] || 0) + 1; return m; }, {});

    result.innerHTML = `
      <div class="barbell" aria-hidden="true">
        <span class="barbell-sleeve"></span>
        ${loaded.slice().reverse().map(p => plateEl(p, plates)).join('')}
        <span class="barbell-bar"></span>
        ${loaded.map(p => plateEl(p, plates)).join('')}
        <span class="barbell-sleeve"></span>
      </div>
      ${loaded.length ? `
        <p class="section-title text-center">Each side</p>
        <div class="plate-counts">
          ${Object.entries(counts).sort((a, b) => b[0] - a[0]).map(([p, n]) => `
            <span class="plate-count"><b>${n}×</b> ${formatNumber(+p, 2)} ${escapeHtml(unit)}</span>
          `).join('')}
        </div>
      ` : '<p class="tool-hint">Just the empty bar.</p>'}
      ${perSide > 1e-9 ? `<p class="tool-warning">Closest possible: ${formatNumber(achieved, 2)} ${escapeHtml(unit)} (${formatNumber(perSide * 2, 2)} short)</p>` : ''}
    `;
  }

  function plateEl(p, all) {
    // lbs sets have no 25kg-equivalent red plate, so shift their colours by one
    const rank = all.indexOf(p);
    const color = PLATE_COLORS[rank + (all === PLATES.lbs ? 1 : 0)] || '#9aa0ad';
    return `<span class="plate" style="height:${100 - rank * 11}%;background:${color}" title="${p}"></span>`;
  }

  input.addEventListener('input', calc);
  el.querySelectorAll('[data-bar]').forEach(btn => {
    btn.addEventListener('click', () => {
      bar = +btn.dataset.bar;
      el.querySelectorAll('[data-bar]').forEach(b => b.classList.toggle('active', b === btn));
      calc();
    });
  });
  calc();
}

// ===== 1RM CALCULATOR =====
const PERCENTAGES = [
  { pct: 95, reps: '2' }, { pct: 90, reps: '3–4' }, { pct: 85, reps: '5–6' }, { pct: 80, reps: '7–8' },
  { pct: 75, reps: '9–10' }, { pct: 70, reps: '11–12' }, { pct: 65, reps: '13–15' }, { pct: 60, reps: '16–20' }
];

function show1RMCalculator(unit) {
  const el = document.createElement('div');
  el.innerHTML = `
    ${sheetHeader('1RM Calculator')}
    <p class="modal-text">Enter a set you completed to estimate your one-rep max.</p>
    <div class="field-row">
      ${numberField('orm-weight', `Weight (${escapeHtml(unit)})`, '80')}
      ${numberField('orm-reps', 'Reps', '5', 'numeric')}
    </div>
    <div id="orm-results" class="tool-result"></div>
  `;
  showModal(el);

  const w = el.querySelector('#orm-weight');
  const r = el.querySelector('#orm-reps');
  const out = el.querySelector('#orm-results');

  function calc() {
    const weight = parseDecimal(w.value);
    const reps = parseInt(r.value, 10);
    if (!weight || !reps || reps < 1) {
      out.innerHTML = '<p class="tool-hint">Results update as you type.</p>';
      return;
    }
    if (reps > 15) {
      out.innerHTML = '<p class="tool-warning">Estimates get unreliable above ~12 reps. Try a heavier set.</p>';
      return;
    }
    const epley = reps === 1 ? weight : weight * (1 + reps / 30);
    const brzycki = reps === 1 ? weight : weight * (36 / (37 - reps));
    const lander = reps === 1 ? weight : (100 * weight) / (101.3 - 2.67123 * reps);
    const avg = (epley + brzycki + lander) / 3;

    out.innerHTML = `
      <div class="result-hero">
        <span class="result-value">${formatNumber(avg, 1)}<small> ${escapeHtml(unit)}</small></span>
        <span class="result-label">Estimated 1RM</span>
      </div>
      <div class="formula-row">
        <span>Epley <b>${formatNumber(epley, 1)}</b></span>
        <span>Brzycki <b>${formatNumber(brzycki, 1)}</b></span>
        <span>Lander <b>${formatNumber(lander, 1)}</b></span>
      </div>
      <div class="pct-table">
        ${PERCENTAGES.map(p => `
          <div class="pct-row">
            <span class="pct-pct">${p.pct}%</span>
            <span class="pct-reps">${p.reps} reps</span>
            <span class="pct-weight">${formatNumber(avg * p.pct / 100, 1)} ${escapeHtml(unit)}</span>
          </div>
        `).join('')}
      </div>
    `;
  }
  w.addEventListener('input', calc);
  r.addEventListener('input', calc);
  calc();
}

// ===== PERCENTAGE TABLE =====
function showRMTable(unit) {
  const rows = [
    { pct: 100, reps: '1', zone: 'Max strength' },
    { pct: 95, reps: '2', zone: 'Max strength' },
    { pct: 90, reps: '3–4', zone: 'Strength' },
    { pct: 85, reps: '5–6', zone: 'Strength' },
    { pct: 80, reps: '7–8', zone: 'Hypertrophy' },
    { pct: 75, reps: '8–10', zone: 'Hypertrophy' },
    { pct: 70, reps: '10–12', zone: 'Hypertrophy' },
    { pct: 65, reps: '12–15', zone: 'Endurance' },
    { pct: 60, reps: '15–20', zone: 'Endurance' },
    { pct: 50, reps: '20+', zone: 'Endurance' }
  ];
  const zoneTone = {
    'Max strength': 'var(--danger)',
    Strength: 'var(--warning)',
    Hypertrophy: 'var(--accent-ink)',
    Endurance: 'var(--accent-secondary)'
  };

  const el = document.createElement('div');
  el.innerHTML = `
    ${sheetHeader('Percentage Table')}
    ${numberField('rm-1rm', `Your 1RM (${escapeHtml(unit)})`, '100')}
    <div id="rm-results" class="tool-result"></div>
  `;
  showModal(el);

  const input = el.querySelector('#rm-1rm');
  const out = el.querySelector('#rm-results');
  function calc() {
    const orm = parseDecimal(input.value);
    if (!orm) {
      out.innerHTML = '<p class="tool-hint">Don\'t know your 1RM? Use the 1RM Calculator first.</p>';
      return;
    }
    out.innerHTML = `
      <div class="pct-table">
        ${rows.map(r => `
          <div class="pct-row">
            <span class="pct-pct">${r.pct}%</span>
            <span class="pct-reps">${r.reps} reps <em style="color:${zoneTone[r.zone]}">${r.zone}</em></span>
            <span class="pct-weight">${formatNumber(orm * r.pct / 100, 1)} ${escapeHtml(unit)}</span>
          </div>
        `).join('')}
      </div>
    `;
  }
  input.addEventListener('input', calc);
  calc();
}

// ===== BMI CALCULATOR =====
function showBMICalculator(unit) {
  const latest = store.getBodyStats()[0];
  const el = document.createElement('div');
  el.innerHTML = `
    ${sheetHeader('BMI Calculator')}
    <div class="field-row">
      ${numberField('bmi-weight', `Weight (${escapeHtml(unit)})`, unit === 'kg' ? '75' : '165')}
      ${numberField('bmi-height', 'Height (cm)', '175', 'numeric')}
    </div>
    <div id="bmi-results" class="tool-result"></div>
  `;
  showModal(el);

  const wIn = el.querySelector('#bmi-weight');
  const hIn = el.querySelector('#bmi-height');
  const out = el.querySelector('#bmi-results');
  if (latest) wIn.value = latest.weight;
  const savedHeight = localStorage.getItem('fitcoach_height');
  if (savedHeight) hIn.value = savedHeight;

  function calc() {
    let weight = parseDecimal(wIn.value);
    const heightCm = parseDecimal(hIn.value);
    if (!weight || !heightCm || heightCm < 50) {
      out.innerHTML = '<p class="tool-hint">Results update as you type.</p>';
      return;
    }
    localStorage.setItem('fitcoach_height', String(heightCm));
    if (unit === 'lbs') weight *= 0.453592;
    const bmi = weight / ((heightCm / 100) ** 2);

    let category, tone;
    if (bmi < 18.5) { category = 'Underweight'; tone = 'var(--warning)'; }
    else if (bmi < 25) { category = 'Healthy weight'; tone = 'var(--success)'; }
    else if (bmi < 30) { category = 'Overweight'; tone = 'var(--warning)'; }
    else { category = 'Obese'; tone = 'var(--danger)'; }

    const pct = Math.min(100, Math.max(0, ((bmi - 15) / 25) * 100));
    out.innerHTML = `
      <div class="result-hero">
        <span class="result-value" style="color:${tone}">${formatNumber(bmi, 1)}</span>
        <span class="result-label">${category}</span>
      </div>
      <div class="bmi-scale">
        <div class="bmi-bar">
          <span style="flex:3.5;background:var(--warning)"></span>
          <span style="flex:6.5;background:var(--success)"></span>
          <span style="flex:5;background:var(--warning)"></span>
          <span style="flex:10;background:var(--danger)"></span>
        </div>
        <span class="bmi-marker" style="left:${pct}%"></span>
        <div class="bmi-labels"><span>15</span><span>18.5</span><span>25</span><span>30</span><span>40</span></div>
      </div>
      <p class="tool-hint">BMI doesn't account for muscle mass — lifters often read “overweight” while lean.</p>
    `;
  }
  wIn.addEventListener('input', calc);
  hIn.addEventListener('input', calc);
  calc();
}

// ===== STOPWATCH =====
function showStopwatch() {
  let raf = null;
  let startAt = 0;
  let elapsed = 0;
  let running = false;
  let laps = [];

  const el = document.createElement('div');
  el.innerHTML = `
    ${sheetHeader('Stopwatch')}
    <div class="stopwatch-time tabular" id="sw-time">00:00.00</div>
    <div class="timer-controls">
      <button class="timer-control-btn secondary" id="sw-left" aria-label="Lap"></button>
      <button class="timer-control-btn primary" id="sw-toggle" aria-label="Start"></button>
    </div>
    <div id="sw-laps"></div>
  `;

  const timeEl = el.querySelector('#sw-time');
  const leftBtn = el.querySelector('#sw-left');
  const toggleBtn = el.querySelector('#sw-toggle');
  const lapsEl = el.querySelector('#sw-laps');

  const now = () => elapsed + (running ? performance.now() - startAt : 0);

  function tick() {
    timeEl.textContent = formatStopwatch(now());
    raf = requestAnimationFrame(tick);
  }

  function renderButtons() {
    toggleBtn.classList.toggle('paused-state', running);
    toggleBtn.setAttribute('aria-label', running ? 'Pause' : 'Start');
    toggleBtn.innerHTML = running
      ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1.5"/><rect x="14" y="4" width="4" height="16" rx="1.5"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>';
    leftBtn.textContent = running ? 'Lap' : 'Reset';
    leftBtn.setAttribute('aria-label', running ? 'Lap' : 'Reset');
    leftBtn.disabled = !running && now() === 0;
  }

  function renderLaps() {
    if (!laps.length) { lapsEl.innerHTML = ''; return; }
    const splits = laps.map((t, i) => t - (laps[i + 1] || 0));
    const best = Math.min(...splits);
    const worst = Math.max(...splits);
    lapsEl.innerHTML = `
      <div class="lap-list">
        ${laps.map((t, i) => `
          <div class="lap-row ${laps.length > 1 && splits[i] === best ? 'best' : ''} ${laps.length > 1 && splits[i] === worst ? 'worst' : ''}">
            <span>Lap ${laps.length - i}</span>
            <span class="tabular">${formatStopwatch(splits[i])}</span>
            <span class="tabular text-muted">${formatStopwatch(t)}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  toggleBtn.addEventListener('click', () => {
    if (running) {
      elapsed = now();
      running = false;
      cancelAnimationFrame(raf);
      timeEl.textContent = formatStopwatch(elapsed);
    } else {
      startAt = performance.now();
      running = true;
      tick();
    }
    renderButtons();
  });

  leftBtn.addEventListener('click', () => {
    if (running) {
      laps.unshift(now());
    } else {
      elapsed = 0;
      laps = [];
      timeEl.textContent = formatStopwatch(0);
    }
    renderLaps();
    renderButtons();
  });

  renderButtons();
  // Stop the animation loop however the sheet gets closed
  showModal(el, { onClose: () => cancelAnimationFrame(raf) });
}

function formatStopwatch(ms) {
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const centis = Math.floor((ms % 1000) / 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}
