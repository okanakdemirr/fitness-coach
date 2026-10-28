// Lightweight SVG charts (no dependencies)
import { escapeHtml, formatNumber } from './utils.js';

let gradientId = 0;

/**
 * Line/area chart. points: [{ label, value }] oldest → newest.
 * Returns an HTML string; sized by its container width.
 */
export function lineChart(points, { height = 140, unit = '', decimals = 1 } = {}) {
  if (points.length < 2) return '';
  const W = 320;
  const H = height;
  const padTop = 16;
  const padBottom = 22;
  const padX = 8;
  const values = points.map(p => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const range = max - min;
  // Breathing room above/below the line
  min -= range * 0.12;
  max += range * 0.12;

  const x = (i) => padX + (i / (points.length - 1)) * (W - padX * 2);
  const y = (v) => padTop + (1 - (v - min) / (max - min)) * (H - padTop - padBottom);

  const coords = points.map((p, i) => [x(i), y(p.value)]);
  const line = coords.map(([cx, cy], i) => `${i ? 'L' : 'M'}${cx.toFixed(1)},${cy.toFixed(1)}`).join(' ');
  const area = `${line} L${coords.at(-1)[0].toFixed(1)},${H - padBottom} L${coords[0][0].toFixed(1)},${H - padBottom} Z`;
  const id = `lg-${gradientId++}`;

  const maxIdx = values.indexOf(Math.max(...values));
  const last = coords.at(-1);

  // At most 4 evenly spaced x labels, always including first and last
  const labelCount = Math.min(4, points.length);
  const labelIdx = [...new Set(Array.from({ length: labelCount }, (_, k) =>
    Math.round((k * (points.length - 1)) / (labelCount - 1))))];
  const labels = labelIdx.map(i => ({ p: points[i], i }));

  return `
    <div class="chart">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="chart-svg" style="height:${H}px" role="img"
        aria-label="Trend from ${formatNumber(values[0], decimals)} to ${formatNumber(values.at(-1), decimals)} ${escapeHtml(unit)}">
        <defs>
          <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--accent-ink)" stop-opacity="0.28"/>
            <stop offset="100%" stop-color="var(--accent-ink)" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${[0.25, 0.5, 0.75].map(f => `<line x1="0" x2="${W}" y1="${padTop + f * (H - padTop - padBottom)}" y2="${padTop + f * (H - padTop - padBottom)}" class="chart-grid"/>`).join('')}
        <path d="${area}" fill="url(#${id})"/>
        <path d="${line}" class="chart-line" vector-effect="non-scaling-stroke"/>
      </svg>
      <span class="chart-dot" style="left:${(last[0] / W) * 100}%;top:${last[1]}px"></span>
      <span class="chart-max" style="left:${(coords[maxIdx][0] / W) * 100}%;top:${coords[maxIdx][1]}px">${formatNumber(values[maxIdx], decimals)}</span>
      <div class="chart-x">
        ${labels.map(({ p, i }) => `<span style="left:${(x(i) / W) * 100}%">${escapeHtml(p.label)}</span>`).join('')}
      </div>
    </div>
  `;
}

/**
 * Vertical bars. bars: [{ label, value, highlight? }]
 */
export function barChart(bars, { height = 120, format = (v) => formatNumber(v, 0), showValues = true } = {}) {
  const max = Math.max(...bars.map(b => b.value), 1);
  return `
    <div class="bar-chart" style="--chart-h:${height}px">
      ${bars.map(b => `
        <div class="bar-col ${b.highlight ? 'highlight' : ''}" title="${escapeHtml(b.label)}: ${escapeHtml(format(b.value))}">
          <span class="bar-value">${showValues && b.value ? escapeHtml(format(b.value)) : ''}</span>
          <div class="bar-track">
            <div class="bar-fill ${b.value ? '' : 'empty'}" style="height:${b.value ? Math.max(6, (b.value / max) * 100) : 0}%"></div>
          </div>
          <span class="bar-label">${escapeHtml(b.label)}</span>
        </div>
      `).join('')}
    </div>
  `;
}
