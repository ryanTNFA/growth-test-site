// @ts-check
// The growth record read the way the engine classifies it, DOM-free. engine/src/growth.mjs (classifyGrowthProblem)
// checks four patterns in order and names the growth problem after the first that fits; this module lays out the
// same four checks with the economy's figure, the line it has to cross and whether it crossed it, from the figures
// in the data file and the thresholds in params.growth_problem. The pattern named is always the file's own
// classification (or "not classifiable" where the engine's statement says so: no 10-year average growth);
// tests/test_growth_read.py sweeps every economy to confirm the first check met is that pattern, and that no figure
// rounds onto the line it is read against. It also lists the figures the growth statement reads against income
// (G2, G6, G7, G10, G11) for one strip. Drawn by components/growth.mjs on the Areas page.
import { fmt, fmtSigned } from './common.mjs';

/** The patterns, in plain words. */
export const PATTERN = {
  slowdown: { label: 'Slowdown', meaning: 'growth has slowed against its own record' },
  collapse_recovery: { label: 'Collapse and recovery', meaning: 'income fell well below an earlier peak and has not regained it' },
  volatile: { label: 'Volatile', meaning: 'growth swings more than in most economies' },
  growing: { label: 'Growing', meaning: 'growth is fast' },
  mixed: { label: 'Mixed', meaning: 'none of the four patterns fits' },
  unclassified: { label: 'Not classifiable', meaning: 'there are too few years of growth to read a pattern' },
};

/** The rubric's values (params.growth_problem, v0.1.2), used only when the registry lacks one. */
const DEFAULTS = {
  slowdown_min_gap_pp: 1.5, collapse_min_peak_age_years: 8, collapse_max_peak_age_years: 30, collapse_min_shortfall_pct: 10,
  volatile_min_universe_percentile: 75, growing_min_growth_pct: 3, growing_alt_min_convergence_t: 1, growing_alt_min_growth_pct: 2,
};

const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const yrs = (n) => `${n} year${n === 1 ? '' : 's'}`;
const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;

/**
 * A figure to d decimals, unless it would print as a line it is read against while lying on the other side of it:
 * then "just under" or "just over" the line, so "1.5 points slower" never sits beside "No" for a 1.5-point rule.
 * @param {number} x @param {number[]} lines @param {number} d
 */
export function vsLine(x, lines, d) {
  const r = Number(x.toFixed(d));
  for (const line of lines) {
    if (Math.abs(r - line) < 1e-9 && x !== line) return `just ${x < line ? 'under' : 'over'} ${fmt(line, d)}`;
  }
  return fmt(x, d);
}

/**
 * @typedef {object} Meter one track: a range, the zone where the check is met, the line, and the economy's dot
 * @property {number} min
 * @property {number} max
 * @property {number | null} value the dot, clamped to the range (null when there is no figure)
 * @property {boolean} clipped the figure lies beyond the range
 * @property {[number, number]} zone where the check is met
 * @property {boolean} zoneOn false when another condition rules the zone out (a peak too recent or too old)
 * @property {[number, number] | null} alt a second zone met only with another condition (fast growth at 2% when ahead of income)
 * @property {boolean} altOn whether that condition holds
 * @property {{at: number, label: string}[]} ticks the lines, labelled (an empty label draws the line alone)
 * @property {[string, string]} ends what the left and right ends mean
 */
/**
 * @typedef {object} Check
 * @property {string} key slowdown | collapse_recovery | volatile | growing
 * @property {string} question the check as a question, with its line in it
 * @property {boolean | null} met null when the figure is missing
 * @property {boolean} decides the check that names the pattern
 * @property {string} figure the economy's figure, in words
 * @property {string} need the line, in words
 * @property {Meter} meter
 */

/**
 * The four checks, in the engine's order.
 * @param {any} g the scorecard's growth_problem
 * @param {any} [gp] params.growth_problem
 * @returns {{checks: Check[], pattern: string, label: string, meaning: string, rule: string}}
 */
export function growthChecks(g, gp) {
  const P = { ...DEFAULTS, ...(gp || {}) };
  g = g || {};
  const G1 = g.G1 || {}, G2 = g.G2 || {}, G3 = g.G3 || {}, G5 = g.G5 || {};
  const a10 = num(G1.avg_10y), a20 = num(G1.avg_20y), t2 = num(G2.t);
  const age = num(G3.years_since_peak), short = num(G3.shortfall_pct), pct = num(G5.universe_percentile);
  const D = P.slowdown_min_gap_pp, S = P.collapse_min_shortfall_pct, V = P.volatile_min_universe_percentile;
  const F = P.growing_min_growth_pct, F2 = P.growing_alt_min_growth_pct, T = P.growing_alt_min_convergence_t;

  // 1. slowdown: the same comparison as the engine, avg10 <= avg20 - gap
  const gap = a10 != null && a20 != null ? a10 - a20 : null;
  const gapWords = gap == null ? '' : Math.abs(gap) < 0.05 ? 'no change'
    : gap < 0 ? `${vsLine(-gap, [D], 1)} points slower` : `${fmt(gap, 1)} points faster`;
  const slow = /** @type {Check} */ ({
    key: 'slowdown', question: `Has growth slowed by ${fmt(D, 1)} points or more?`,
    met: gap == null ? null : a10 <= a20 - D, decides: false,
    figure: gap == null ? 'Not enough years of growth to compare.'
      : `${fmt(a10, 1)}% a year${period(G1.window_10y, G1.years_10y)}, against ${fmt(a20, 1)}%${period(G1.window_20y, G1.years_20y)}: ${gapWords}.`,
    need: `A slowdown is ${fmt(D, 1)} points a year or more below the 20-year average.`,
    meter: meter(gap, -4, 4, [-Infinity, -D], [{ at: -D, label: fmtSigned(-D, 1) }, { at: 0, label: '0' }], ['slower', 'faster']),
  });

  // 2. collapse: the engine's assessPeak
  const lo = P.collapse_min_peak_age_years, hi = P.collapse_max_peak_age_years;
  const ageOk = age != null && age >= lo && age <= hi;
  const deep = short != null && short >= S;
  const peakYear = num(G3.peak_year);
  let fig = 'No income series to find a peak in.';
  if (age === 0) fig = `Income per person is at its peak${peakYear ? ` (${peakYear})` : ''}.`;
  else if (age != null) {
    const why = age < lo ? ': too recent to count' : age > hi ? ': too long ago to count' : '';
    const below = short == null ? 'below it' : short < 0.5 ? 'less than 1% below it' : `${vsLine(short, [S], 0)}% below it`;
    fig = `Peak in ${peakYear ?? '—'}, ${yrs(age)} ago${why}; income is ${below}.`;
  }
  const collapse = /** @type {Check} */ ({
    key: 'collapse_recovery', question: `Is income still ${fmt(S, 0)}% or more below a peak from ${lo}–${hi} years ago?`,
    met: age == null ? null : ageOk && deep, decides: false, figure: fig,
    need: `A collapse is a peak ${lo} to ${hi} years old with income still ${fmt(S, 0)}% or more below it.`,
    meter: { ...meter(short, 0, 50, [S, Infinity], [{ at: S, label: `${fmt(S, 0)}% below` }], ['at the peak', 'far below']), zoneOn: ageOk },
  });

  // 3. volatile: the universe percentile of the 20-year standard deviation of growth (the share of economies at or below it)
  const sd = num(G5.sd);
  let where = '';
  if (pct != null) {
    if (pct >= 99.95) where = 'the most volatile of all economies';
    else {
      const r = Math.round(pct);
      where = r === V && pct !== V ? `just ${pct < V ? 'under' : 'over'} the ${ordinal(V)} percentile of all economies`
        : `at the ${ordinal(Math.min(99, r))} percentile of all economies`;
    }
  }
  const vol = /** @type {Check} */ ({
    key: 'volatile', question: V === 75 ? 'Is growth among the most volatile quarter of economies?' : `Is growth above the ${ordinal(V)} percentile for volatility?`,
    met: pct == null ? null : pct > V, decides: false,
    figure: pct == null ? 'Not enough years of growth to measure the swings.'
      : `Growth swings by ${fmt(sd, 1)} points a year (its standard deviation over ${G5.window_years || 20} years), ${where}.`,
    need: `Volatile is above the ${ordinal(V)} percentile: the 100th swings most.`,
    meter: meter(pct, 0, 100, [V, Infinity], [{ at: V, label: ordinal(V) }], ['steadier', 'swings more']),
  });

  // 4. growing: fast, or a little slower while well ahead of what starting income predicts
  const altOn = t2 != null && t2 >= T;
  let ahead = '';
  if (t2 != null) {
    ahead = Math.abs(t2) < 0.05 ? ', as its starting income predicts'
      : `, ${t2 > 0 ? vsLine(t2, [T], 1) : fmt(-t2, 1)} sd ${t2 > 0 ? 'above' : 'below'} what its starting income predicts`;
  }
  const grow = /** @type {Check} */ ({
    key: 'growing', question: `Is growth fast: ${fmt(F, 0)}% a year, or ${fmt(F2, 0)}% when well ahead of its income?`,
    met: a10 == null ? null : a10 >= F || (altOn && a10 >= F2), decides: false,
    figure: a10 == null ? 'No 10-year average growth.' : `${vsLine(a10, [F2, F], 1)}% a year${period(G1.window_10y, G1.years_10y)}${ahead}.`,
    need: `Growing is ${fmt(F, 0)}% a year or more, or ${fmt(F2, 0)}% when growth is at least ${fmt(T, 0)} sd above what starting income predicts.`,
    meter: { ...meter(a10, -2, 8, [F, Infinity], [{ at: 0, label: '0' }, { at: F2, label: '' }, { at: F, label: `${fmt(F, 0)}%` }], ['shrinking', 'faster']),
      alt: [F2, F], altOn },
  });

  const checks = [slow, collapse, vol, grow];
  // the file's classification names the pattern; where it is mixed for want of a 10-year average, the engine's statement
  // calls the record not classifiable, and so does the page (a collapse needs no average: Eritrea and Yemen keep theirs)
  const named = PATTERN[g.classification] ? g.classification : 'mixed';
  const pattern = named === 'mixed' && a10 == null ? 'unclassified' : named;
  const decider = checks.find((c) => c.key === pattern);
  if (decider) decider.decides = true;
  let meaning = PATTERN[pattern].meaning;
  if (pattern === 'growing' && a10 != null && a10 < F) meaning = 'growth is fast for its starting income';
  return { checks, pattern, label: PATTERN[pattern].label, meaning, rule: String(g.classification_rule || '') };
}

/**
 * " over 2016–2025", or the years actually observed when the data stop short of the window.
 * @param {any} win the window @param {any} obs the years observed
 */
function period(win, obs) {
  const w = Array.isArray(win) ? win : null, o = Array.isArray(obs) ? obs : null;
  if (o && w && (o[0] !== w[0] || o[1] !== w[1])) return ` over ${o[0]}–${o[1]} (the years with data)`;
  const x = o || w;
  return x ? ` over ${x[0]}–${x[1]}` : '';
}

/**
 * @param {number | null} x @param {number} min @param {number} max @param {[number, number]} zone
 * @param {{at: number, label: string}[]} ticks @param {[string, string]} ends
 * @returns {Meter}
 */
function meter(x, min, max, zone, ticks, ends) {
  const lo = x == null ? min : Math.min(min, Math.floor(x)), hi = x == null ? max : Math.max(max, Math.ceil(x));
  // the range stretches to a figure a little beyond it, then stops: past that the dot sits at the end with an arrow
  const a = Math.max(lo, min - (max - min) * 0.5), b = Math.min(hi, max + (max - min) * 0.5);
  return {
    min: a, max: b, value: x == null ? null : clamp(x, a, b), clipped: x != null && (x < a || x > b),
    zone: [clamp(zone[0], a, b), clamp(zone[1], a, b)], zoneOn: true, alt: null, altOn: false, ticks, ends,
  };
}

/**
 * @typedef {object} IncomeRow
 * @property {string} key
 * @property {string} code the growth statistic it comes from (G2, G6, ...)
 * @property {string} name
 * @property {string} value the level, with its unit and year
 * @property {number | null} t the gap from what income predicts, in standard deviations
 */
/**
 * The figures read against income, in the statement's order.
 * @param {any} g the scorecard's growth_problem
 * @returns {IncomeRow[]}
 */
export function incomeRows(g) {
  g = g || {};
  const G1 = g.G1 || {}, G2 = g.G2 || {}, G7 = g.G7 || {}, G10 = g.G10 || {};
  const t = (o) => (o && o.icr && num(o.icr.t) != null ? o.icr.t : o && num(o.t) != null ? o.t : null);
  const val = (o) => num(o && (o.value_ref ?? o.value));
  const yr = (o) => (o && (o.year_ref ?? o.year)) || null;
  // value_ref is the mean of the observations in the three years ending at year_ref (engine/src/reference.mjs)
  const when = (o) => (yr(o) ? ` (${yr(o) - 2}–${String(yr(o)).slice(2)} average)` : '');
  const pct = (o, d = 1) => (val(o) == null ? '—' : `${fmt(val(o), d)}% of GDP${when(o)}`);
  const signedPct = (o) => (val(o) == null ? '—' : `${fmtSigned(val(o), 1)}% of GDP${when(o)}`);
  const eci = G10.complexity || G10.eci;
  const rows = [
    { key: 'growth', code: 'G2', name: 'Growth, for its starting income', t: num(G2.t),
      value: num(G1.avg_10y) == null ? '—' : `${fmt(G1.avg_10y, 1)}% a year, 10-year average` },
    { key: 'investment', code: 'G6', name: 'Investment', t: t(g.G6), value: pct(g.G6) },
    { key: 'savings', code: 'G7', name: 'Savings', t: t(G7.savings), value: pct(G7.savings) },
    { key: 'cab', code: 'G7', name: 'Current account balance', t: t(G7.current_account), value: signedPct(G7.current_account) },
    { key: 'fdi', code: 'G7', name: 'Foreign direct investment, net inflows', t: t(G7.fdi), value: pct(G7.fdi) },
    { key: 'exports', code: 'G10', name: 'Exports', t: t(G10.exports), value: pct(G10.exports) },
    { key: 'complexity', code: 'G10', name: 'Economic complexity', t: t(eci), value: val(eci) == null ? '—' : `index ${fmtSigned(val(eci), 2)}${when(eci)}` },
    { key: 'unemployment', code: 'G11', name: 'Unemployment', t: t(g.G11),
      value: val(g.G11) == null ? '—' : `${fmt(val(g.G11), 1)}% of the labour force${when(g.G11)}` },
  ];
  return rows;
}

/** Outside the usual band for its income (more than 1 sd either side). @param {number | null} t */
export const outside = (t) => t != null && Math.abs(t) > 1;

/**
 * A gap in standard deviations for the strip: "+0.7 sd", "0.0 sd", and two decimals where one would print 1.0 for a
 * figure on the other side of the band's edge ("+0.96 sd" inside it, "+1.04 sd" outside).
 * @param {number | null} t
 */
export function sdText(t) {
  if (t == null) return 'no data';
  if (Math.abs(t) < 0.05) return '0.0 sd';
  const d = Math.abs(Number(Math.abs(t).toFixed(1)) - 1) < 1e-9 && Math.abs(t) !== 1 ? 2 : 1;
  return `${fmtSigned(t, d)} sd`;
}

/** A gap in standard deviations, in words, for screen readers. @param {string} name @param {number | null} t */
export function gapSentence(name, t) {
  if (t == null) return `${name}: no data`;
  if (Math.abs(t) < 0.05) return `${name}: as its income predicts`;
  return `${name}: ${fmt(Math.abs(t), Math.abs(t) < 1.05 && Math.abs(t) > 0.95 ? 2 : 1)} sd ${t > 0 ? 'above' : 'below'} what its income predicts`;
}
