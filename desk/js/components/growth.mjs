// @ts-check
// The growth problem, drawn (Ryan, 8 November 2026: the section "feels pretty dull, given its importance"). Three
// pictures on the Areas page, each from numbers already in the data file (growth_read.mjs arranges them):
//   patternChecks: the four patterns the engine checks in order, each a track with the zone where it fits, the line
//     and the economy's dot; the first that fits names the growth problem.
//   growthChart: income per person and growth each year on one time axis, the last 10 and 20 years shaded, their
//     averages drawn across them, the similar economies' median beside them; drawn at the width it is given.
//   incomeStrip: the figures the statement reads against income, one dot each on a shared scale of standard deviations.
import { h, fmt, fmtSigned } from '../common.mjs';
import { sdText, outside, gapSentence } from '../growth_read.mjs';

const SVG = 'http://www.w3.org/2000/svg';
/** @param {string} tag @param {Record<string, any>} attrs @param {string | null} [text] */
function s(tag, attrs, text = null) {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, String(v));
  if (text != null) e.textContent = text;
  return e;
}

// ---------- the four checks ----------
const STATE = {
  decides: 'Yes: this names the pattern',
  also: 'Yes, but an earlier check came first',
  no: 'No',
  na: 'No figure',
};

/**
 * One check's track: the zone where it fits, its lines and the dot.
 * @param {import('../growth_read.mjs').Meter} m @param {string} label
 */
function meterEl(m, label) {
  const at = (x) => ((x - m.min) / (m.max - m.min)) * 100;
  const zone = (z, cls) => h('span', { class: cls, 'aria-hidden': 'true',
    style: `left:${at(z[0]).toFixed(2)}%;width:${(at(z[1]) - at(z[0])).toFixed(2)}%` });
  const track = h('div', { class: 'gp-track', role: 'img', 'aria-label': label },
    zone(m.zone, `gp-zone${m.zoneOn ? '' : ' off'}`),
    m.alt ? zone(m.alt, `gp-zone alt${m.altOn ? '' : ' off'}`) : null,
    m.ticks.map((t) => h('span', { class: 'gp-tick', style: `left:${at(t.at).toFixed(2)}%`, 'aria-hidden': 'true' })),
    m.value == null ? null : h('span', {
      class: `gp-dot${m.clipped ? ` clip ${m.value <= m.min ? 'lo' : 'hi'}` : ''}`, style: `left:${at(m.value).toFixed(2)}%`, 'aria-hidden': 'true',
    }));
  // the lines' labels above the track, like a ruler; what the ends mean below it
  const lines = h('div', { class: 'gp-lines', 'aria-hidden': 'true' }, m.ticks.filter((t) => t.label).map((t) => {
    // a label near an end sits inside the track instead of hanging past it
    const p = at(t.at); const shift = p < 12 ? '0' : p > 88 ? '-100%' : '-50%';
    return h('span', { class: 'gp-tl', style: `left:${p.toFixed(2)}%;transform:translateX(${shift})` }, t.label);
  }));
  const ends = h('div', { class: 'gp-scale', 'aria-hidden': 'true' },
    h('span', { class: 'gp-end lo' }, m.ends[0]), h('span', { class: 'gp-end hi' }, m.ends[1]));
  return [lines, track, ends];
}

/**
 * The pattern and the four checks behind it.
 * @param {ReturnType<typeof import('../growth_read.mjs').growthChecks>} read
 */
export function patternChecks(read) {
  const items = read.checks.map((c, i) => {
    const state = c.met == null ? 'na' : !c.met ? 'no' : c.decides ? 'decides' : 'also';
    return h('li', { class: `gp-check ${state}` },
      h('p', { class: 'gp-q' }, h('span', { class: 'gp-n' }, String(i + 1)), ' ', c.question),
      h('p', { class: `gp-state ${state}` }, STATE[state]),
      meterEl(c.meter, `${c.question} ${c.figure} ${c.need}`),
      h('p', { class: 'gp-fig' }, c.figure),
      h('p', { class: 'gp-need' }, c.need));
  });
  const lead = read.pattern === 'unclassified'
    ? 'The tool checks four patterns in turn, but without ten years of growth it cannot run them.'
    : read.pattern === 'mixed' ? 'The tool checks four patterns in turn. None fits, so the record is read as mixed.'
      : 'The tool checks four patterns in turn; the first that fits names the growth problem.';
  const sw = (cls) => h('span', { class: `gp-sw ${cls}`, 'aria-hidden': 'true' });
  const key = h('p', { class: 'gp-key' },
    h('span', {}, sw('zone'), 'where the pattern fits'),
    h('span', {}, sw('off'), 'in range, but ruled out by the check’s other condition (the peak’s age; growth not far enough ahead of its income)'),
    h('span', {}, sw('dot'), 'this economy'));
  return h('div', { class: 'gp' },
    h('p', { class: 'gp-head' }, h('span', { class: `gp-chip ${read.pattern}` }, read.label), ' ',
      h('span', { class: 'gp-mean' }, `${read.meaning[0].toUpperCase()}${read.meaning.slice(1)}.`)),
    h('p', { class: 'gp-lead' }, lead),
    h('ol', { class: 'gp-checks' }, items), key);
}

// ---------- the growth record ----------
/** @type {WeakMap<Element, ResizeObserver>} */
const watching = new WeakMap();

/**
 * Income per person and growth each year on one time axis, redrawn when its width changes.
 * @param {HTMLElement} host
 * @param {{level: [number, number][], growth: [number, number][], g: any, name: string}} o
 * @returns {HTMLElement} the key under the chart
 */
export function growthChart(host, o) {
  let last = 0;
  const draw = () => {
    const w = Math.max(300, Math.round(host.clientWidth || 600));
    if (Math.abs(w - last) < 8) return;
    last = w;
    host.replaceChildren(chartSvg(w, o));
  };
  draw();
  const prev = watching.get(host); if (prev) prev.disconnect();
  if (typeof ResizeObserver !== 'undefined') {
    // redraw in the next frame: replacing the chart inside the observer's callback changes the host's height mid-frame
    let queued = false;
    const ro = new ResizeObserver(() => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; draw(); }); } });
    ro.observe(host); watching.set(host, ro);
  }
  return chartKey(o);
}

/** @param {number} lo @param {number} hi */
function niceStep(lo, hi) { const r = hi - lo; return r <= 10 ? 2 : r <= 24 ? 5 : 10; }

/** @param {number} W @param {{level: [number, number][], growth: [number, number][], g: any, name: string}} o */
function chartSvg(W, { level, growth, g, name }) {
  const G1 = g.G1 || {}, G3 = g.G3 || {}, G4 = g.G4 || {};
  const narrow = W < 520;
  const ML = 30, MR = 10, top = 22, levH = narrow ? 84 : 100, gap = 30, barH = narrow ? 120 : 140, bottom = 22;
  const H = top + levH + gap + barH + bottom;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'gc', role: 'img' });
  const years = [...level.map((p) => p[0]), ...growth.map((p) => p[0])];
  if (!years.length) { svg.setAttribute('aria-label', 'No growth series in the file.'); return svg; }
  const y0 = Math.min(...years), y1 = Math.max(...years);
  const X = (y) => ML + ((y - y0 + 0.5) / (y1 - y0 + 1)) * (W - ML - MR);
  const bw = Math.max(1, ((W - ML - MR) / (y1 - y0 + 1)) * 0.72);

  // income per person, from zero
  const vmax = level.length ? Math.max(...level.map((p) => p[1])) * 1.25 : 1; // headroom keeps the peak label off the title
  const LY = (v) => top + levH - (v / vmax) * levH;
  svg.append(s('text', { x: ML, y: top - 8, class: 'gc-title' }, narrow ? 'Income per person (2015 US$)' : 'Income per person (constant 2015 US$)'));
  svg.append(s('line', { x1: ML, x2: W - MR, y1: LY(0), y2: LY(0), class: 'gc-axis' }));
  // the averages cover the years observed (years_10y), which can stop short of the window; never past the drawn years
  const inside = (w) => (Array.isArray(w) && w[1] >= y0 && w[0] <= y1 ? [Math.max(w[0], y0), Math.min(w[1], y1)] : null);
  const w10 = inside(G1.years_10y || G1.window_10y), w20 = inside(G1.years_20y || G1.window_20y);
  if (level.length) {
    svg.append(s('path', { d: level.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${LY(p[1]).toFixed(1)}`).join(' '), class: 'gc-line' }));
    const peak = level.find((p) => p[0] === G3.peak_year) || level.reduce((a, b) => (b[1] > a[1] ? b : a));
    const end = level[level.length - 1];
    if (end[0] !== peak[0]) {
      // the shortfall: the peak's level carried forward to the latest year
      svg.append(s('line', { x1: X(peak[0]), x2: X(end[0]), y1: LY(peak[1]), y2: LY(peak[1]), class: 'gc-peakline' }));
      svg.append(s('line', { x1: X(end[0]), x2: X(end[0]), y1: LY(peak[1]), y2: LY(end[1]), class: 'gc-short' }));
    }
    svg.append(s('circle', { cx: X(peak[0]), cy: LY(peak[1]), r: 3.5, class: 'gc-peak' }));
    const px = X(peak[0]); const right = px > W * 0.62;
    const same = end[0] === peak[0];
    svg.append(s('text', { x: px + (right ? -7 : 7), y: LY(peak[1]) - 7, 'text-anchor': right ? 'end' : 'start', class: 'gc-lab strong' },
      same ? `peak, ${peak[0]}: $${fmt(peak[1], 0)}` : `peak ${peak[0]}: $${fmt(peak[1], 0)}`));
    if (!same) {
      const below = G3.shortfall_pct != null ? ` (${fmt(G3.shortfall_pct, 0)}% below)` : '';
      svg.append(s('text', { x: X(end[0]) - 4, y: Math.min(LY(end[1]) + 15, top + levH - 3), 'text-anchor': 'end', class: 'gc-lab' },
        `${end[0]}: $${fmt(end[1], 0)}${below}`));
    }
  }

  // growth each year
  const B0 = top + levH + gap;
  const vals = growth.map((p) => p[1]);
  const lo = Math.max(-15, Math.min(-2, ...vals)), hi = Math.min(15, Math.max(6, ...vals, G1.avg_10y ?? 0, G1.avg_20y ?? 0));
  const step = niceStep(lo, hi);
  const ylo = Math.floor(lo / step) * step, yhi = Math.ceil(hi / step) * step;
  const BY = (v) => B0 + ((yhi - Math.max(ylo, Math.min(yhi, v))) / (yhi - ylo)) * barH;
  svg.append(s('text', { x: ML, y: B0 - 8, class: 'gc-title' }, 'Growth of income per person each year (%)'));
  const band = (w, cls) => (Array.isArray(w)
    ? svg.append(s('rect', { x: X(w[0]) - bw / 2 - 1, y: B0, width: X(w[1]) - X(w[0]) + bw + 2, height: barH, class: cls })) : null);
  band(w20, 'gc-band'); band(w10, 'gc-band ten');
  for (let v = ylo; v <= yhi + 1e-9; v += step) {
    svg.append(s('line', { x1: ML, x2: W - MR, y1: BY(v), y2: BY(v), class: v === 0 ? 'gc-zero' : 'gc-grid' }));
    svg.append(s('text', { x: ML - 5, y: BY(v) + 4, 'text-anchor': 'end', class: 'gc-tick' }, v === 0 ? '0' : fmtSigned(v, 0)));
  }
  const inWin = (y) => Array.isArray(w20) && y >= w20[0] && y <= w20[1];
  for (const [yr, v] of growth) {
    const y = BY(v), z = BY(0);
    const clipped = v > yhi || v < ylo;
    const r = s('rect', { x: X(yr) - bw / 2, y: Math.min(y, z), width: bw, height: Math.max(0.5, Math.abs(z - y)),
      class: `gc-bar${inWin(yr) ? '' : ' old'}${clipped ? ' clip' : ''}` });
    r.append(s('title', {}, `${yr}: ${fmtSigned(v, 1)}%`));
    svg.append(r);
    if (clipped) {
      // a cut bar: a small arrow past its end, pointing the way it goes on
      const tip = v > yhi ? B0 - 1 : B0 + barH + 1, base = v > yhi ? tip + 5 : tip - 5, x = X(yr), half = Math.max(2.5, bw / 2 + 1);
      svg.append(s('path', { d: `M${x - half},${base}L${x},${tip}L${x + half},${base}Z`, class: 'gc-cut' }));
    }
  }
  const seg = (w, v, cls) => (Array.isArray(w) && v != null && Number.isFinite(v)
    ? svg.append(s('line', { x1: X(w[0]) - bw / 2, x2: X(w[1]) + bw / 2, y1: BY(v), y2: BY(v), class: cls })) : null);
  seg(w20, G1.avg_20y, 'gc-avg twenty');
  if (G1.structural_n > 1) seg(w10, G1.structural_median_10y, 'gc-avg peers');
  seg(w10, G1.avg_10y, 'gc-avg ten');
  if (G4.reported && G4.break_year != null && G4.break_year >= y0) {
    const bx = X(G4.break_year - 0.5);
    svg.append(s('line', { x1: bx, x2: bx, y1: B0, y2: B0 + barH, class: 'gc-break' }));
    svg.append(s('text', { x: bx + 4, y: B0 + 11, class: 'gc-lab' }, 'break'));
  }
  // the years
  const every = narrow ? 20 : 10;
  for (let y = Math.ceil(y0 / every) * every; y <= y1; y += every) {
    if (X(y) - X(y0) < 56 || X(y1) - X(y) < 56) continue; // keep clear of the first and last years' labels
    svg.append(s('text', { x: X(y), y: H - 6, 'text-anchor': 'middle', class: 'gc-tick' }, String(y)));
  }
  svg.append(s('text', { x: X(y0), y: H - 6, 'text-anchor': 'start', class: 'gc-tick' }, String(y0)));
  svg.append(s('text', { x: X(y1), y: H - 6, 'text-anchor': 'end', class: 'gc-tick' }, String(y1)));
  const since = G3.years_since_peak ? ` and is ${fmt(G3.shortfall_pct, 0)}% below that peak` : ', the latest year';
  const pk = G3.peak_year != null ? ` Income per person peaked in ${G3.peak_year}${since}.` : '';
  const avg20 = G1.avg_20y != null ? ` and ${fmt(G1.avg_20y, 1)}% over the last 20` : '';
  const avg = G1.avg_10y != null ? ` Growth averaged ${fmt(G1.avg_10y, 1)}% a year over the last 10 years${avg20}.` : '';
  const med = G1.structural_n > 1 && G1.structural_median_10y != null ? ` The similar economies' median is ${fmt(G1.structural_median_10y, 1)}%.` : '';
  svg.setAttribute('aria-label', `${name}: income per person ${y0}–${y1} and growth each year.${pk}${avg}${med}`);
  return svg;
}

/** @param {{g: any, growth?: [number, number][]}} o */
function chartKey({ g, growth }) {
  const G1 = g.G1 || {}, G4 = g.G4 || {};
  const item = (cls, text) => h('li', {}, h('span', { class: `gc-sw ${cls}`, 'aria-hidden': 'true' }), text);
  const span = (win, obs) => {
    const w = Array.isArray(win) ? win : null, o = Array.isArray(obs) ? obs : null;
    if (o && w && (o[0] !== w[0] || o[1] !== w[1])) return ` (observed ${o[0]}–${o[1]})`;
    const x = o || w; return x ? ` (${x[0]}–${x[1]})` : '';
  };
  const peers = G1.structural_n > 1 && G1.structural_median_10y != null;
  const rank = peers && G1.rank_in_structural != null ? `; ranked ${G1.rank_in_structural} of ${G1.structural_n} by growth` : '';
  const vals = (growth || []).map((p) => p[1]);
  const cut = vals.some((v) => v > 15 || v < -15);
  return h('ul', { class: 'gc-key' },
    G1.avg_10y != null ? item('ten', `Last 10 years${span(G1.window_10y, G1.years_10y)}: ${fmt(G1.avg_10y, 1)}% a year`) : null,
    G1.avg_20y != null ? item('twenty', `Last 20 years${span(G1.window_20y, G1.years_20y)}: ${fmt(G1.avg_20y, 1)}% a year`) : null,
    peers ? item('peers', `Similar economies, last 10 years: ${fmt(G1.structural_median_10y, 1)}% (median)${rank}`) : null,
    cut ? item('cut', 'A bar cut at the edge of the scale: hover it for the year’s growth') : null,
    G4.reported && G4.break_year != null
      ? item('break', `Break in ${G4.break_year}: growth ${G4.change_pp < 0 ? 'fell' : 'rose'} `
        + `from ${fmt(G4.mean_before, 1)}% a year before to ${fmt(G4.mean_after, 1)}% after`)
      : null);
}

// ---------- against what income predicts ----------
const RANGE = 3;
/** @param {number} t */
const gx = (t) => 50 + (Math.max(-RANGE, Math.min(RANGE, t)) / RANGE) * 50;

/**
 * The figures read against income, one dot each.
 * @param {import('../growth_read.mjs').IncomeRow[]} rows
 */
export function incomeStrip(rows) {
  const ticks = [-2, -1, 0, 1, 2];
  const head = h('div', { class: 'gi-row gi-axis', 'aria-hidden': 'true' }, h('span', { class: 'gi-lab' }),
    h('span', { class: 'gi-head' }, h('span', { class: 'gi-end lo' }, '◀ below'), h('span', { class: 'gi-end hi' }, 'above ▶'),
      ticks.map((t) => h('span', { class: 'gi-tl', style: `left:${gx(t)}%` }, t === 0 ? '0' : fmtSigned(t, 0)))),
    h('span', { class: 'gi-val' }));
  const body = rows.map((r) => {
    const far = outside(r.t);
    const clip = r.t != null && Math.abs(r.t) > RANGE;
    return h('li', { class: `gi-row${far ? ' far' : ''}${r.t == null ? ' na' : ''}` },
      h('span', { class: 'gi-lab' }, h('span', { class: 'gi-name' }, r.name), h('span', { class: 'gi-sub' }, `${r.value} · ${r.code}`)),
      h('span', { class: 'gi-track', role: 'img', 'aria-label': gapSentence(r.name, r.t) },
        h('span', { class: 'gi-band', 'aria-hidden': 'true' }), h('span', { class: 'gi-zero', 'aria-hidden': 'true' }),
        r.t == null ? null
          : h('span', { class: `gi-dot${clip ? ` clip ${r.t < 0 ? 'lo' : 'hi'}` : ''}`, style: `left:${gx(r.t).toFixed(2)}%`, 'aria-hidden': 'true' })),
      h('span', { class: 'gi-val' }, sdText(r.t)));
  });
  return h('div', { class: 'gi' }, head, h('ul', { class: 'gi-rows' }, body));
}
