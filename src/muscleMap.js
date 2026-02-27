import { store } from './store.js';
import { escapeHtml } from './utils.js';

// Map exercise categories to muscle zone IDs
const CATEGORY_MUSCLES = {
  chest:     ['chest-l', 'chest-r'],
  back:      ['upper-back-l', 'upper-back-r', 'traps'],
  legs:      ['quad-l', 'quad-r', 'ham-l', 'ham-r', 'glute-l', 'glute-r', 'calf-l', 'calf-r'],
  shoulders: ['delt-l', 'delt-r'],
  arms:      ['bicep-l', 'bicep-r', 'tricep-l', 'tricep-r', 'forearm-l', 'forearm-r'],
  core:      ['core'],
  cardio:    []
};

// Which zones appear on which view
const FRONT_ZONES = ['delt-l','delt-r','chest-l','chest-r','bicep-l','bicep-r','forearm-l','forearm-r','core','quad-l','quad-r','calf-l','calf-r'];
const BACK_ZONES = ['traps','upper-back-l','upper-back-r','tricep-l','tricep-r','lower-back','glute-l','glute-r','ham-l','ham-r','calf-l','calf-r'];

// Human-readable names for zones
const ZONE_LABELS = {
  'delt-l': 'Shoulders', 'delt-r': 'Shoulders',
  'chest-l': 'Chest', 'chest-r': 'Chest',
  'bicep-l': 'Biceps', 'bicep-r': 'Biceps',
  'forearm-l': 'Forearms', 'forearm-r': 'Forearms',
  'core': 'Core',
  'quad-l': 'Quads', 'quad-r': 'Quads',
  'calf-l': 'Calves', 'calf-r': 'Calves',
  'traps': 'Traps',
  'upper-back-l': 'Back', 'upper-back-r': 'Back',
  'lower-back': 'Lower Back',
  'tricep-l': 'Triceps', 'tricep-r': 'Triceps',
  'glute-l': 'Glutes', 'glute-r': 'Glutes',
  'ham-l': 'Hamstrings', 'ham-r': 'Hamstrings'
};

// Logical groups so clicking left or right highlights both
const ZONE_PAIRS = {
  'delt-l': 'delt-r', 'delt-r': 'delt-l',
  'chest-l': 'chest-r', 'chest-r': 'chest-l',
  'bicep-l': 'bicep-r', 'bicep-r': 'bicep-l',
  'forearm-l': 'forearm-r', 'forearm-r': 'forearm-l',
  'quad-l': 'quad-r', 'quad-r': 'quad-l',
  'calf-l': 'calf-r', 'calf-r': 'calf-l',
  'upper-back-l': 'upper-back-r', 'upper-back-r': 'upper-back-l',
  'tricep-l': 'tricep-r', 'tricep-r': 'tricep-l',
  'glute-l': 'glute-r', 'glute-r': 'glute-l',
  'ham-l': 'ham-r', 'ham-r': 'ham-l'
};

function getIntensity(sets) {
  if (!sets || sets === 0) return 0;
  if (sets <= 3) return 1;
  if (sets <= 8) return 2;
  if (sets <= 15) return 3;
  return 4;
}

function computeActivation(workouts) {
  const data = {};
  for (const w of workouts) {
    for (const ex of (w.exercises || [])) {
      const cat = (ex.category || '').toLowerCase();
      const completedSets = (ex.sets || []).filter(s => s.completed).length;
      if (!completedSets) continue;

      const muscles = CATEGORY_MUSCLES[cat] || [];
      for (const m of muscles) {
        if (!data[m]) data[m] = { sets: 0, exercises: [] };
        data[m].sets += completedSets;
        if (!data[m].exercises.includes(ex.name)) data[m].exercises.push(ex.name);
      }

      // Back exercises also lightly activate lower-back
      if (cat === 'back') {
        if (!data['lower-back']) data['lower-back'] = { sets: 0, exercises: [] };
        data['lower-back'].sets += Math.ceil(completedSets * 0.5);
        if (!data['lower-back'].exercises.includes(ex.name)) data['lower-back'].exercises.push(ex.name);
      }

      // Cardio lightly activates all zones
      if (cat === 'cardio') {
        const allZones = [...new Set([...FRONT_ZONES, ...BACK_ZONES])];
        for (const z of allZones) {
          if (!data[z]) data[z] = { sets: 0, exercises: [] };
          data[z].sets += Math.ceil(completedSets * 0.2);
          if (!data[z].exercises.includes(ex.name)) data[z].exercises.push(ex.name);
        }
      }
    }
  }
  return data;
}

function getWorkoutsForPeriod(period) {
  const workouts = store.getWorkouts();
  const active = store.getActiveWorkout();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const filtered = workouts.filter(w => {
    if (!w.date) return false;
    switch (period) {
      case 'today': return w.date === todayStr;
      case 'week': return (now - new Date(w.date + 'T00:00:00')) < 7 * 86400000;
      case 'month': return (now - new Date(w.date + 'T00:00:00')) < 30 * 86400000;
      default: return false;
    }
  });

  if (active) {
    filtered.push(active);
  }
  return filtered;
}

// SVG zone paths — front view (viewBox 0 0 160 400)
function frontZones() {
  return `
    <path data-zone="delt-l" d="M58,66 C50,64 40,68 35,76 C30,84 32,92 37,96 L54,93 C56,86 57,76 58,66Z"/>
    <path data-zone="delt-r" d="M102,66 C110,64 120,68 125,76 C130,84 128,92 123,96 L106,93 C104,86 103,76 102,66Z"/>
    <path data-zone="chest-l" d="M56,96 L37,98 C34,108 34,120 38,130 L56,132 L78,132 L78,96Z"/>
    <path data-zone="chest-r" d="M104,96 L123,98 C126,108 126,120 122,130 L104,132 L82,132 L82,96Z"/>
    <path data-zone="core" d="M58,136 L102,136 L106,172 L108,208 L52,208 L54,172Z"/>
    <path data-zone="bicep-l" d="M35,100 L24,100 C20,110 18,130 20,150 L22,168 L38,168 L36,140 C36,124 35,110 35,100Z"/>
    <path data-zone="bicep-r" d="M125,100 L136,100 C140,110 142,130 140,150 L138,168 L122,168 L124,140 C124,124 125,110 125,100Z"/>
    <path data-zone="forearm-l" d="M22,172 L16,232 L28,236 L38,172Z"/>
    <path data-zone="forearm-r" d="M138,172 L144,232 L132,236 L122,172Z"/>
    <path data-zone="quad-l" d="M54,212 L74,242 L70,320 L54,326 L46,270Z"/>
    <path data-zone="quad-r" d="M106,212 L86,242 L90,320 L106,326 L114,270Z"/>
    <path data-zone="calf-l" d="M56,332 L68,328 L66,392 L58,396Z"/>
    <path data-zone="calf-r" d="M104,332 L92,328 L94,392 L102,396Z"/>
  `;
}

// SVG zone paths — back view (viewBox 0 0 160 400)
function backZones() {
  return `
    <path data-zone="traps" d="M62,62 L80,56 L98,62 L106,78 L100,88 L80,84 L60,88 L54,78Z"/>
    <path data-zone="upper-back-l" d="M56,92 L38,98 C34,108 32,126 36,148 L42,168 L56,172 L78,172 L78,92Z"/>
    <path data-zone="upper-back-r" d="M104,92 L122,98 C126,108 128,126 124,148 L118,168 L104,172 L82,172 L82,92Z"/>
    <path data-zone="lower-back" d="M56,176 L104,176 L108,208 L52,208Z"/>
    <path data-zone="tricep-l" d="M36,100 L24,100 C20,110 18,130 20,150 L22,168 L38,168 L36,140Z"/>
    <path data-zone="tricep-r" d="M124,100 L136,100 C140,110 142,130 140,150 L138,168 L122,168 L124,140Z"/>
    <path data-zone="glute-l" d="M54,212 L78,212 L78,246 L56,252 L48,234Z"/>
    <path data-zone="glute-r" d="M106,212 L82,212 L82,246 L104,252 L112,234Z"/>
    <path data-zone="ham-l" d="M50,256 L76,248 L72,320 L52,328Z"/>
    <path data-zone="ham-r" d="M110,256 L84,248 L88,320 L108,328Z"/>
    <path data-zone="calf-l" d="M56,332 L68,328 L66,392 L58,396Z"/>
    <path data-zone="calf-r" d="M104,332 L92,328 L94,392 L102,396Z"/>
  `;
}

// Non-interactive body parts (head, hands, feet) for context
function bodyAccents() {
  return `
    <circle cx="80" cy="30" r="18" class="body-outline"/>
    <rect x="74" y="48" width="12" height="14" rx="5" class="body-outline"/>
    <ellipse cx="14" cy="242" rx="6" ry="8" class="body-outline"/>
    <ellipse cx="146" cy="242" rx="6" ry="8" class="body-outline"/>
    <ellipse cx="60" cy="402" rx="8" ry="6" class="body-outline"/>
    <ellipse cx="100" cy="402" rx="8" ry="6" class="body-outline"/>
  `;
}

let svgCounter = 0;

function buildSVG(zonesMarkup) {
  const filterId = `glow-${svgCounter++}`;
  return `<svg viewBox="0 0 160 410" xmlns="http://www.w3.org/2000/svg" data-glow="${filterId}">
    <defs>
      <filter id="${filterId}">
        <feGaussianBlur stdDeviation="4" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    ${bodyAccents()}
    ${zonesMarkup}
  </svg>`;
}

export function renderMuscleMap(container) {
  let currentPeriod = 'week';
  let selectedZone = null;

  function render() {
    const workouts = getWorkoutsForPeriod(currentPeriod);
    const activation = computeActivation(workouts);

    // Count distinct activated zone groups
    const activatedGroups = new Set();
    for (const [zone, data] of Object.entries(activation)) {
      if (data.sets > 0) activatedGroups.add(ZONE_LABELS[zone] || zone);
    }

    container.innerHTML = `
      <div class="muscle-map-card">
        <div class="muscle-map-header">
          <span class="section-title" style="margin:0">Muscle Map</span>
          <span class="muscle-map-count">${activatedGroups.size} groups hit</span>
        </div>
        <div class="muscle-map-tabs">
          <button class="muscle-tab ${currentPeriod === 'today' ? 'active' : ''}" data-period="today">Today</button>
          <button class="muscle-tab ${currentPeriod === 'week' ? 'active' : ''}" data-period="week">Week</button>
          <button class="muscle-tab ${currentPeriod === 'month' ? 'active' : ''}" data-period="month">Month</button>
        </div>
        <div class="muscle-map-body">
          <div class="muscle-map-view">
            <div class="muscle-map-svg" id="muscle-front">
              ${buildSVG(frontZones())}
            </div>
            <span class="muscle-map-label">FRONT</span>
          </div>
          <div class="muscle-map-view">
            <div class="muscle-map-svg" id="muscle-back">
              ${buildSVG(backZones())}
            </div>
            <span class="muscle-map-label">BACK</span>
          </div>
        </div>
        <div class="muscle-map-legend">
          <span class="legend-label">Rest</span>
          <span class="legend-swatch" data-lvl="0"></span>
          <span class="legend-swatch" data-lvl="1"></span>
          <span class="legend-swatch" data-lvl="2"></span>
          <span class="legend-swatch" data-lvl="3"></span>
          <span class="legend-swatch" data-lvl="4"></span>
          <span class="legend-label">Intense</span>
        </div>
        <div class="muscle-map-detail" id="muscle-detail"></div>
      </div>
    `;

    // Apply activation colors to zones
    container.querySelectorAll('[data-zone]').forEach(el => {
      const zone = el.dataset.zone;
      const info = activation[zone];
      const level = info ? getIntensity(info.sets) : 0;
      el.setAttribute('data-level', level);
      if (level >= 4) {
        const filterId = el.closest('svg').dataset.glow;
        el.style.filter = `url(#${filterId})`;
      }
    });

    // Tab click handlers
    container.querySelectorAll('.muscle-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        currentPeriod = btn.dataset.period;
        selectedZone = null;
        render();
      });
    });

    // Zone click handlers
    container.querySelectorAll('[data-zone]').forEach(el => {
      el.addEventListener('click', () => {
        const zone = el.dataset.zone;
        const label = ZONE_LABELS[zone] || zone;

        if (selectedZone === label) {
          selectedZone = null;
          clearSelection();
          return;
        }
        selectedZone = label;

        // Highlight selected + pair
        container.querySelectorAll('[data-zone]').forEach(z => z.classList.remove('selected'));
        el.classList.add('selected');
        const pair = ZONE_PAIRS[zone];
        if (pair) {
          container.querySelectorAll(`[data-zone="${pair}"]`).forEach(z => z.classList.add('selected'));
        }

        // Collect all exercise data for this logical group
        const groupZones = Object.entries(ZONE_LABELS)
          .filter(([, v]) => v === label)
          .map(([k]) => k);
        const exercises = [];
        let totalSets = 0;
        for (const z of groupZones) {
          if (activation[z]) {
            totalSets = Math.max(totalSets, activation[z].sets);
            for (const name of activation[z].exercises) {
              if (!exercises.includes(name)) exercises.push(name);
            }
          }
        }

        const detail = container.querySelector('#muscle-detail');
        if (totalSets > 0) {
          detail.innerHTML = `
            <div class="muscle-detail-content">
              <div class="muscle-detail-header">
                <span class="muscle-detail-name">${label}</span>
                <span class="muscle-detail-sets">${totalSets} sets</span>
              </div>
              <div class="muscle-detail-exercises">${exercises.map(e => escapeHtml(e)).join(' &middot; ')}</div>
            </div>
          `;
        } else {
          detail.innerHTML = `
            <div class="muscle-detail-content">
              <span class="muscle-detail-name">${label}</span>
              <span class="muscle-detail-exercises text-muted">No exercises yet</span>
            </div>
          `;
        }
        detail.classList.add('visible');
      });
    });

    function clearSelection() {
      container.querySelectorAll('[data-zone]').forEach(z => z.classList.remove('selected'));
      const detail = container.querySelector('#muscle-detail');
      detail.classList.remove('visible');
      detail.innerHTML = '';
    }
  }

  render();
}
