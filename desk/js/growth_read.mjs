// @ts-check
// The growth record read the way the engine classifies it, DOM-free. engine/src/growth.mjs (classifyGrowthProblem,
// rubric 0.3.0) tries its patterns in order and names the growth problem after the first that fits; this module lays
// out four checks that find them (the peak, the change from the decade before, the swings, the pace of the last
// decade) with the economy's figure, the lines and whether it crossed them, from the figures in the data file and the
// thresholds in params.growth_problem, and the record in one line from the eras (growthArc). The pattern named is
// always the file's own classification; tests/test_growth_read.py sweeps every economy to confirm that the engine's
// order over these checks gives that pattern, and that no figure rounds onto the line it is read against. It also lists the figures the growth statement reads against income
// (G2, G6, G7, G10, G11) for one strip. Drawn by components/growth.mjs on the Areas page.
import { fmt, fmtSigned } from './common.mjs';

/**
 * The patterns, in plain words (rubric 0.3.0, engine/src/growth.mjs GROWTH_PATTERNS). The meanings carry no numbers:
 * the checks below state their lines from params.growth_problem.
 */
export const PATTERN = {
  collapse_recovery: { label: 'Collapse', meaning: 'income fell well below a recent peak and has not regained it' },
  slowdown: { label: 'Slowdown', meaning: 'growth has slowed sharply from the decade before' },
  acceleration: { label: 'Speeding up', meaning: 'growth has sped up sharply from the decade before' },
  volatile: { label: 'Volatile', meaning: 'growth swings more than in most economies' },
  growing: { label: 'Growing', meaning: 'growth is fast' },
  never_recovered: { label: 'Never recovered', meaning: 'income is still far below a peak from decades ago' },
  high_income_pace: { label: 'High-income pace', meaning: 'a high-income economy growing at the modest pace usual for rich economies' },
  stuck: { label: 'Stuck', meaning: 'growth has been too slow to catch up' },
  steady: { label: 'Steady, not fast', meaning: 'growth is steady, but too slow to close income gaps quickly' },
  not_classifiable: { label: 'Not classifiable', meaning: 'there are too few years of growth to read a pattern' },
  mixed: { label: 'Mixed', meaning: 'none of the patterns fits' },
};

/** The engine's order: when more than one pattern fits, the first in this list names the growth problem. */
export const ORDER = ['collapse_recovery', 'slowdown', 'acceleration', 'volatile', 'growing', 'never_recovered', 'high_income_pace', 'stuck', 'steady'];

/** The rubric's values (params.growth_problem, rubric 0.3.0), used only when the registry lacks one. */
const DEFAULTS = {
  slowdown_min_drop_pp: 2, acceleration_min_rise_pp: 2, acceleration_min_growth_pct: 2,
  collapse_min_peak_age_years: 8, collapse_max_peak_age_years: 30, collapse_min_shortfall_pct: 10, never_recovered_min_shortfall_pct: 20,
  volatile_min_universe_percentile: 75, growing_min_growth_pct: 3, growing_alt_min_convergence_t: 1, growing_alt_min_growth_pct: 2,
  high_income_pace_min_growth_pct: 0, stuck_max_growth_pct: 1.5, level_line_min_years: 5,
};

const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const yrs = (n) => `${n} year${n === 1 ? '' : 's'}`;
const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
/** A parameter as written: 2, 1.5 */
const n = (x) => fmt(x, Number.isInteger(x) ? 0 : 1);
/** "a, b and c" @param {string[]} xs */
const and = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

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
 * @typedef {object} Zone a stretch of the track where a pattern fits
 * @property {[number, number]} z
 * @property {boolean} on false when another condition rules it out (drawn hatched: a peak too recent; growth too slow to count as speeding up)
 * @property {boolean} [light] met only with a second condition (fast growth at 2% when well ahead of its income)
 */
/**
 * @typedef {object} Meter one track: a range, the zones where a pattern fits, the lines, and the economy's dot
 * @property {number} min
 * @property {number} max
 * @property {number | null} value the dot, clamped to the range (null when there is no figure)
 * @property {boolean} clipped the figure lies beyond the range
 * @property {Zone[]} zones
 * @property {{at: number, label: string}[]} ticks the lines, labelled (an empty label draws the line alone)
 * @property {[string, string]} ends what the left and right ends mean
 */
/**
 * @typedef {object} Check
 * @property {string} key peak | change | volatile | pace
 * @property {string} question the check as a question
 * @property {boolean | null} met null when the figure is missing
 * @property {string | null} names the pattern this check finds (null when none fits)
 * @property {boolean} decides the check whose pattern names the growth problem
 * @property {string} figure the economy's figure, in words
 * @property {string} need the lines, in words
 * @property {Meter} meter
 */

/**
 * The four checks behind the engine's ten patterns (engine/src/growth.mjs classifyGrowthProblem, rubric 0.3.0), each
 * able to find more than one: the peak (a collapse, or never recovered), the change from the decade before (a slowdown,
 * or speeding up), the swings (volatile), and the pace of the last decade (growing, steady, stuck, or the high-income
 * pace). Where more than one fits, the first in ORDER names the pattern, as in the engine.
 * @param {any} g the scorecard's growth_problem
 * @param {any} [gp] params.growth_problem
 * @returns {{checks: Check[], pattern: string, label: string, meaning: string, rule: string, arc: string}}
 */
export function growthChecks(g, gp) {
  const P = { ...DEFAULTS, ...(gp || {}) };
  g = g || {};
  const G1 = g.G1 || {}, G2 = g.G2 || {}, G3 = g.G3 || {}, G5 = g.G5 || {}, G12 = g.G12 || {};
  const a10 = num(G1.avg_10y), a0 = num(G1.avg_prior_10y), t2 = num(G2.t);
  const age = num(G3.years_since_peak), short = num(G3.shortfall_pct), pct = num(G5.universe_percentile);

  // 1. the peak: a collapse below a peak 8-30 years old, or never recovered from an older one (the engine's assessPeak)
  const lo = P.collapse_min_peak_age_years, hi = P.collapse_max_peak_age_years;
  const S = P.collapse_min_shortfall_pct, S2 = P.never_recovered_min_shortfall_pct;
  const recent = age != null && age >= lo && age <= hi, old = age != null && age > hi;
  const line = old ? S2 : S;
  const peakYear = num(G3.peak_year);
  let fig = 'No income series to find a peak in.';
  if (age === 0) fig = `Income per person is at its peak${peakYear ? ` (${peakYear})` : ''}.`;
  else if (age != null) {
    const when = age < lo ? ': too recent to count' : old ? `: more than ${hi} years ago` : '';
    const below = short == null ? 'below it' : short < 0.5 ? 'less than 1% below it' : `${vsLine(short, [line], 0)}% below it`;
    fig = `Peak in ${peakYear ?? '—'}, ${yrs(age)} ago${when}; income is ${below}.`;
  }
  const peakNames = short == null ? null : recent && short >= S ? 'collapse_recovery' : old && short >= S2 ? 'never_recovered' : null;
  const peak = /** @type {Check} */ ({
    key: 'peak', question: 'Is income still well below an earlier peak?',
    met: age == null ? null : peakNames != null, names: peakNames, decides: false, figure: fig,
    need: `A collapse is ${n(S)}% or more below a peak ${lo}–${hi} years old; never recovered is ${n(S2)}% or more below an older peak.`,
    meter: meter(short, 0, 50, [{ z: [line, Infinity], on: recent || old }], [{ at: line, label: `${n(line)}% below` }], ['at the peak', 'far below']),
  });

  // 2. the change from the decade before: the engine compares the last decade with the one before (not the 20 years)
  const D = P.slowdown_min_drop_pp, U = P.acceleration_min_rise_pp, A = P.acceleration_min_growth_pct;
  const ch = a10 != null && a0 != null ? a10 - a0 : null;
  const quickEnough = a10 != null && a10 >= A;
  const changeNames = ch == null ? null : a10 <= a0 - D ? 'slowdown' : a10 >= a0 + U && quickEnough ? 'acceleration' : null;
  let chWords = '';
  if (ch != null) {
    chWords = Math.abs(ch) < 0.05 ? 'no change' : ch < 0 ? `${vsLine(-ch, [D], 1)} points slower` : `${vsLine(ch, [U], 1)} points faster`;
    if (ch >= U && !quickEnough) chWords += `, but still under ${n(A)}% a year`;
  }
  const change = /** @type {Check} */ ({
    key: 'change', question: `Has growth changed by ${n(D)} points or more from the decade before?`,
    met: ch == null ? null : changeNames != null, names: changeNames, decides: false,
    figure: ch == null ? 'Not enough years of growth to compare two decades.'
      : `${fmt(a10, 1)}% a year${period(G1.window_10y, G1.years_10y)}, against ${fmt(a0, 1)}%${period(G1.window_prior_10y, G1.years_prior_10y)}: ${chWords}.`,
    need: `A slowdown is ${n(D)} points a year or more slower than the decade before; speeding up is ${n(U)} points or more faster, to at least ${n(A)}% a year.`,
    meter: meter(ch, -5, 5, [{ z: [-Infinity, -D], on: true }, { z: [U, Infinity], on: quickEnough }],
      [{ at: -D, label: fmtSigned(-D, Number.isInteger(D) ? 0 : 1) }, { at: 0, label: '0' }, { at: U, label: fmtSigned(U, Number.isInteger(U) ? 0 : 1) }],
      ['slower', 'faster']),
  });

  // 3. volatile: the universe percentile of the 20-year standard deviation of growth (the share of economies at or below it)
  const V = P.volatile_min_universe_percentile;
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
    met: pct == null ? null : pct > V, names: pct != null && pct > V ? 'volatile' : null, decides: false,
    figure: pct == null ? 'Not enough years of growth to measure the swings.'
      : `Growth swings by ${fmt(sd, 1)} points a year (its standard deviation over ${G5.window_years || 20} years), ${where}.`,
    need: `Volatile is above the ${ordinal(V)} percentile: the 100th swings most.`,
    meter: meter(pct, 0, 100, [{ z: [V, Infinity], on: true }], [{ at: V, label: ordinal(V) }], ['steadier', 'swings more']),
  });

  // 4. the pace of the last decade: growing, steady or stuck; a high-income economy that is not growing fast reads at
  //    the high-income pace (unless it is shrinking, which is stuck)
  const F = P.growing_min_growth_pct, F2 = P.growing_alt_min_growth_pct, T = P.growing_alt_min_convergence_t, K = P.stuck_max_growth_pct;
  const altOn = t2 != null && t2 >= T;
  const rich = G12.income_group === 'High income';
  const growing = a10 != null && (a10 >= F || (altOn && a10 >= F2));
  const paceNames = a10 == null ? null : growing ? 'growing' : rich && a10 >= P.high_income_pace_min_growth_pct ? 'high_income_pace' : a10 < K ? 'stuck' : 'steady';
  let ahead = '';
  if (t2 != null) {
    ahead = Math.abs(t2) < 0.05 ? ', as its starting income predicts'
      : `, ${t2 > 0 ? vsLine(t2, [T], 1) : fmt(-t2, 1)} sd ${t2 > 0 ? 'above' : 'below'} what its starting income predicts`;
  }
  const PACE = { growing: 'growing', high_income_pace: 'the high-income pace', stuck: 'stuck', steady: 'steady, not fast' };
  const pace = /** @type {Check} */ ({
    key: 'pace', question: 'How fast has income per person grown over the last decade?',
    met: a10 == null ? null : true, names: paceNames, decides: false,
    figure: a10 == null ? 'No 10-year average growth.'
      : `${vsLine(a10, [K, F2, F], 1)}% a year${period(G1.window_10y, G1.years_10y)}${ahead}${rich ? '; a high-income economy' : ''}: ${PACE[paceNames]}.`,
    need: `Growing is ${n(F)}% a year or more, or ${n(F2)}% when at least ${n(T)} sd above what starting income predicts; steady is ${n(K)}% to under ${n(F)}%; `
      + `stuck is under ${n(K)}%. A high-income economy that is not growing fast reads at the high-income pace.`,
    meter: meter(a10, -2, 8, [{ z: [F, Infinity], on: true }, { z: [F2, F], on: altOn, light: true }],
      [{ at: 0, label: '0' }, { at: K, label: `${n(K)}%` }, { at: F2, label: '' }, { at: F, label: `${n(F)}%` }], ['stuck', 'growing']),
  });

  const checks = [peak, change, vol, pace];
  // the file's classification names the pattern; an older file's "mixed" with no 10-year average is not classifiable
  let pattern = PATTERN[g.classification] ? g.classification : 'mixed';
  if (pattern === 'mixed' && a10 == null) pattern = 'not_classifiable';
  const decider = checks.find((c) => c.names === pattern);
  if (decider) decider.decides = true;
  let meaning = PATTERN[pattern].meaning;
  if (pattern === 'growing' && a10 != null && a10 < F) meaning = 'growth is fast for its starting income';
  return { checks, pattern, label: PATTERN[pattern].label, meaning, rule: String(g.classification_rule || ''), arc: growthArc(g, P) };
}

/**
 * The pattern the checks name, in the engine's order: the first in ORDER that some check finds. growthChecks takes
 * the file's own classification; this repeats the engine's precedence so the tests can hold the two together.
 * @param {Check[]} checks
 */
export function firstInOrder(checks) {
  return ORDER.find((p) => checks.some((c) => c.met && c.names === p)) || null;
}

/**
 * The record in one line, from the eras (G4.eras) and the first year income reached today's level (G3): "Growth ran at
 * 2.6% a year in 2004–2013 and 0.4% since 2014; income per person is about where it first was in 2012." Empty when
 * the file has neither.
 * @param {any} g the scorecard's growth_problem
 * @param {any} [gp] params.growth_problem
 */
export function growthArc(g, gp) {
  const P = { ...DEFAULTS, ...(gp || {}) };
  const G4 = (g && g.G4) || {}, G3 = (g && g.G3) || {};
  const eras = Array.isArray(G4.eras) ? G4.eras.filter((e) => e && num(e.mean) != null) : [];
  const parts = [];
  if (eras.length === 1) parts.push(`growth has averaged ${fmt(eras[0].mean, 1)}% a year since ${eras[0].from}, with no lasting shift`);
  else if (eras.length > 1) {
    const items = eras.map((e, i) => (i === eras.length - 1 ? `${fmt(e.mean, 1)}% since ${e.from}` : `${fmt(e.mean, 1)}%${i === 0 ? ' a year' : ''} in ${e.from}–${e.to}`));
    parts.push(`growth ran at ${and(items)}`);
  }
  const ys = num(G3.years_since_level_first_reached), y = num(G3.level_first_reached);
  if (ys != null && y != null && ys >= P.level_line_min_years) {
    parts.push(G3.below_series_start ? `income per person is lower than in ${y}, the first year of the record`
      : `income per person is about where it first was in ${y}`);
  }
  if (!parts.length) return '';
  const s = parts.join('; ');
  return `${s[0].toUpperCase()}${s.slice(1)}.`;
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
 * @param {number | null} x @param {number} min @param {number} max @param {{z: [number, number], on: boolean, light?: boolean}[]} zones
 * @param {{at: number, label: string}[]} ticks @param {[string, string]} ends
 * @returns {Meter}
 */
function meter(x, min, max, zones, ticks, ends) {
  const lo = x == null ? min : Math.min(min, Math.floor(x)), hi = x == null ? max : Math.max(max, Math.ceil(x));
  // the range stretches to a figure a little beyond it, then stops: past that the dot sits at the end with an arrow
  const a = Math.max(lo, min - (max - min) * 0.5), b = Math.min(hi, max + (max - min) * 0.5);
  return {
    min: a, max: b, value: x == null ? null : clamp(x, a, b), clipped: x != null && (x < a || x > b),
    zones: zones.map((zn) => ({ z: /** @type {[number, number]} */ ([clamp(zn.z[0], a, b), clamp(zn.z[1], a, b)]), on: zn.on, light: !!zn.light })),
    ticks, ends,
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

/**
 * Which growth story the page shows (synth/narratives/{ISO}.json, block growth_story; rubric 0.3.0):
 *   none        no story file, or no growth_story in it: the page shows the record from the data
 *   data_only   tier 3: too few recent sources, so no story was written
 *   unchecked   a draft that has not passed the source and number checks: not shown
 *   stale       written for another snapshot of the data: shown, and the page says so
 *   checked     drafted by AI, sources and numbers checked in code
 *   reviewed    and read by a person
 * @param {any} narrative the narrative file (or null) @param {string} snapshotId the Scorecard's snapshot
 */
export function storyState(narrative, snapshotId) {
  const st = narrative && narrative.growth_story;
  const meta = (st && st.meta) || null;
  if (!meta) return 'none';
  if (meta.tier === 3) return 'data_only';
  if (meta.status !== 'checked' && meta.status !== 'reviewed') return 'unchecked';
  if (!st.headline || !st.arc) return 'unchecked';
  if (meta.snapshot_id !== snapshotId) return 'stale';
  return meta.status;
}
