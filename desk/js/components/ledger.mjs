// @ts-check
// The ledger: how a rating adds up, drawn on one axis (Ryan, 7 November 2026: "greater and more intuitive understanding of
// the four tests and how the various data types contribute to ratings"). Every bar reaches a number the engine already
// computed (anatomy.mjs); nothing is derived here but pixel positions. One axis for every level, -2 at the left, +2 at
// the right, 0 in the middle, binding to the right in the chart's binding colour and away in ink: a measure's signal,
// a test's score, the net score. Thicker counts more (the class weight after recency; the price test's double weight);
// hollow is shown but not counted. The tier appears only as the existing chip. Plain h() elements, no SVG, no motion:
// the ledger is a rating surface (motion.mjs refuses it). The full ledger lives in the Areas drawer and on the Methods
// page; the tally (the four tests, the net score and the lines) beside the Bottom line's cards and the Analyst View's verdict.
import { h, fmtSigned } from '../common.mjs';
import { TEST_SHORT, bandWord } from '../anatomy.mjs';

/** Where a score sits on the axis, as a percentage of the track (0 in the middle, +-2 at the ends). @param {number} x */
const pct = (x) => 50 + 25 * Math.max(-2, Math.min(2, x));
/** The bar from 0 to x: left and width as percentages. @param {number} x */
const span = (x) => (x >= 0 ? { left: 50, width: pct(x) - 50 } : { left: pct(x), width: 50 - pct(x) });
const fmt2 = (x) => fmtSigned(x, 2);
/** A signal or a threshold as the rubric writes it: +2, -1.5, -0.25. @param {number} x */
const fmt1 = (x) => (Number.isInteger(x) ? fmtSigned(x, 0) : fmtSigned(x, Math.abs(x * 10 - Math.round(x * 10)) < 1e-9 ? 1 : 2));
/** "1 test agrees", "2 tests agree". @param {number} n @param {string} one @param {string} many */
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const NUMWORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];
const word = (n) => NUMWORD[n] || String(n);

/**
 * A bar on the shared track.
 * @param {number | null} x the value the bar reaches
 * @param {{thick: number, hollow?: boolean, fork?: boolean, dashed?: boolean, ticks?: {x: number, cls?: string}[]}} o
 */
function track(x, { thick, hollow = false, fork = false, dashed = false, ticks = [] }) {
  const t = h('div', { class: `lg-track${dashed ? ' dashed' : ''}${fork ? ' fork' : ''}` }, h('span', { class: 'lg-zero', 'aria-hidden': 'true' }));
  for (const k of ticks) t.append(h('span', { class: `lg-tick ${k.cls || ''}`, style: `left:${pct(k.x)}%`, 'aria-hidden': 'true' }));
  if (x == null) return t;
  if (x === 0) { t.append(h('span', { class: 'lg-bar zero', style: `left:calc(50% - 1px);width:2px;height:${thick}px` })); return t; }
  const s = span(x);
  const cls = `lg-bar ${x > 0 ? 'pos' : 'neg'}${hollow ? ' hollow' : ''}`;
  t.append(h('span', { class: cls, style: `left:${s.left}%;width:${s.width}%;height:${thick}px` }));
  return t;
}
/** One row: a label, the track, the right-hand words. @param {string} cls @param {any} label @param {HTMLElement} tr @param {any} val */
const row = (cls, label, tr, val) => h('div', { class: `lg-row ${cls}` }, h('div', { class: 'lg-lab' }, label), tr, h('div', { class: 'lg-val' }, val));

/** The axis at the top: the two end words and the five ticks. @param {boolean} fork */
function axis(fork) {
  const ends = fork ? ['◀ low returns', 'costly finance ▶'] : ['◀ away from a problem', 'toward a problem ▶'];
  const ticks = [-2, -1, 0, 1, 2].map((v) => h('span', { class: 'lg-tl', style: `left:${pct(v)}%` }, v === 0 ? '0' : fmtSigned(v, 0)));
  return h('div', { class: `lg-axis${fork ? ' fork' : ''}`, 'aria-hidden': 'true' },
    h('div', { class: 'lg-lab' }),
    h('div', { class: 'lg-track-head' }, h('span', { class: 'lg-end away' }, ends[0]), h('span', { class: 'lg-end toward' }, ends[1]), ...ticks),
    h('div', { class: 'lg-val' }));
}
/** The thresholds on the net row, from the reading in force. @param {any} a */
const thresholdTicks = (a) => [{ x: a.thresholds.notAlone, cls: 'alone' }, { x: a.thresholds.not }, { x: a.thresholds.look },
  { x: a.thresholds.lookAlone, cls: 'alone' }];
/** The thresholds in words, for the key, from the reading's own counts. @param {any} a */
function thresholdWords(a) {
  const th = a.thresholds, k = a.counts;
  const dashed = k.lookC === k.notC
    ? `${fmt1(th.not)} and ${fmt1(th.look)} (dashed) are a rating when ${word(k.lookC)} ${k.lookC === 1 ? 'test agrees' : 'tests agree'}`
    : `${fmt1(th.look)} (dashed) is a rating when ${word(k.lookC)} ${k.lookC === 1 ? 'test agrees' : 'tests agree'}, ${fmt1(th.not)} when ${word(k.notC)} do`;
  const reading = a.settingLabel !== 'Standard' ? ` (${a.settingLabel} reading)` : '';
  return `Lines on the net row${reading}: ${dashed}; ${fmt1(th.notAlone)} and ${fmt1(th.lookAlone)} (solid) are a rating on their own. ` +
    `No line counts with fewer than ${word(k.Ebelow)} counted sources, or with tests pulling hard both ways; “ruled out” and “likely” need ` +
    `${word(k.ruledC)} agreeing tests and ${word(k.ruledE)} sources.`;
}

/** The net row's right-hand words. @param {any} a */
function netWords(a) {
  if (a.N == null) return 'no net score yet';
  const scored = a.tests.filter((t) => t.T != null).length;
  const C = a.C ?? 0, E = a.E ?? 0;
  const agree = `${C} of ${count(scored, 'scored test', 'scored tests')} ${C === 1 ? 'agrees' : 'agree'}`;
  return `N ${fmt2(a.N)} · ${agree} · ${count(E, 'source counts', 'sources count')}`;
}
/** Whether a test counts toward C: it speaks and agrees with the net score's sign. @param {any} a @param {any} t */
const agrees = (a, t) => t.T != null && a.N != null && a.N !== 0 && Math.abs(t.T) >= a.speakingMin && Math.sign(t.T) === Math.sign(a.N);
/** The words for a test with no score. @param {any} t @param {(k: string) => string} missing */
const noScore = (t, missing) => (t.notObserved ? (t.key === 'price' ? 'no price measure' : 'no class A or B measure') : missing(t.key));

/** The tally in one sentence, for assistive technology. @param {any} a @param {boolean} fork */
function tallyWords(a, fork) {
  const tests = a.tests.map((t) => `${TEST_SHORT[t.key]} ${t.T == null ? 'not scored' : fmt2(t.T)}`).join(', ');
  const net = a.N == null ? 'none' : fmt2(a.N);
  return `How the ${fork ? 'first decision' : 'rating'} adds up: ${tests}; net score ${net}, ${bandWord(a.N, fork)}. ${netWords(a)}.`;
}

/**
 * The compact tally: the four tests, the net score against the lines, one caption. Beside a tier chip.
 * @param {any} a from ratingAnatomy()
 * @param {{fork?: boolean, missing?: (key: string) => string, of?: string}} [o] of: the sub-area a roll-up's numbers belong to
 * @returns {HTMLElement | null}
 */
export function tally(a, { fork = false, missing = () => 'no test', of = '' } = {}) {
  if (!a) return null;
  const el = h('div', { class: `tally${fork ? ' fork' : ''}`, role: 'figure', 'aria-label': tallyWords(a, fork) });
  for (const t of a.tests) {
    const lab = h('span', {}, `${t.num} ${TEST_SHORT[t.key]}`, t.weight > 1 ? h('span', { class: 'lg-x' }, ` ×${t.weight}`) : null);
    const val = t.T == null ? h('span', { class: 'muted' }, noScore(t, missing))
      : h('span', {}, fmt2(t.T), t.shrunk ? h('span', { class: 'lg-tag' }, ' thin') : null);
    el.append(row('lg-t', lab, track(t.T, { thick: t.weight > 1 ? 10 : 6, fork, dashed: t.T == null }), val));
  }
  const net = track(a.N, { thick: 8, fork, ticks: thresholdTicks(a) });
  el.append(row('lg-net', h('span', {}, 'Net'), net, h('span', {}, a.N == null ? '—' : fmt2(a.N))));
  el.append(h('p', { class: 'lg-cap' }, `${of ? `For ${of}: ` : ''}${netWords(a)}`));
  return el;
}

/**
 * The full ledger: every measure under its test with its class, signal, weight and vote; the four test scores; the net
 * score against the lines; the tier chip with the rule that fired.
 * @param {any} a from ratingAnatomy()
 * @param {{fork?: boolean, chip?: HTMLElement | null, missing?: (key: string) => string, why?: (key: string) => string, country?: string}} [o]
 *   missing: the short words for a test with no score; why: the longer reason, drawn on its own line under the row
 * @returns {HTMLElement | null}
 */
export function ledger(a, { fork = false, chip = null, missing = () => 'no test defined', why = () => '', country = '' } = {}) {
  if (!a) return null;
  const label = `How the ${fork ? 'first decision' : 'rating'} adds up${country ? ` for ${country}` : ''}: ${tallyWords(a, fork)}`;
  const el = h('div', { class: `ledger${fork ? ' fork' : ''}`, role: 'figure', 'aria-label': label });
  el.append(axis(fork));
  for (const t of a.tests) el.append(testSection(a, t, fork, missing, why));
  el.append(row('lg-net', h('span', {}, 'Net score'), track(a.N, { thick: 12, fork, ticks: thresholdTicks(a) }), h('span', {}, netWords(a))));
  el.append(h('div', { class: 'lg-chip' }, chip, h('span', { class: 'lg-rule' }, ruleWords(a, fork))));
  el.append(h('p', { class: 'lg-key' },
    'Each bar reaches a measure’s signal, −2 to +2. Most rest on two readings shown under the name: the gap from what income predicts, in ' +
    'standard deviations (sd), and the rank among the comparison countries; a changes bar rests on how often investment moved as predicted. ' +
    'Thicker counts more: class A (a price) thickest, then B (a workaround), C (a quantity), D (an expert rating), and older data thinner. ' +
    'Hollow bars are shown but not counted. A test’s score is the weighted average of its counted bars, pulled toward 0 when its evidence is ' +
    `thin; the price test counts double in the net score. ${thresholdWords(a)}`));
  return el;
}
/**
 * One test: its counted measures, the ones shown but not counted, its score.
 * @param {any} a @param {any} t @param {boolean} fork @param {(k: string) => string} missing @param {(k: string) => string} why
 */
function testSection(a, t, fork, missing, why) {
  const head = `Test ${t.num} · ${TEST_SHORT[t.key]}${t.weight > 1 ? ` ×${t.weight}` : ''}`;
  const sec = h('section', { class: 'lg-test', 'data-test': t.key },
    h('h4', { class: 'lg-th' }, h('span', { class: 'lg-tn' }, head), ' ', h('span', { class: 'lg-q' }, t.question)));
  for (const f of t.voting) sec.append(famRow(f, fork));
  if (t.informing.length) {
    sec.append(h('div', { class: 'lg-subrule' }, `shown, not counted (${t.informing.length})`));
    for (const f of t.informing) sec.append(famRow(f, fork, true));
  }
  const words = t.T == null ? h('span', { class: 'muted' }, noScore(t, missing))
    : h('span', {}, `T ${fmt2(t.T)}`, t.shrunk ? h('span', { class: 'lg-tag' }, ' · thin: pulled toward 0') : null,
      agrees(a, t) ? h('span', { class: 'lg-tag agrees' }, ' · agrees') : null);
  const bar = track(t.T, { thick: t.weight > 1 ? 14 : 8, fork, dashed: t.T == null });
  sec.append(row('lg-total', h('span', {}, `Test ${t.num} score${t.weight > 1 ? ` ×${t.weight}` : ''}`), bar, words));
  const reason = t.T == null && !t.notObserved ? why(t.key) : '';
  if (reason) sec.append(h('p', { class: 'lg-why' }, reason));
  return sec;
}
/** One measure's row. @param {any} f @param {boolean} fork @param {boolean} [informs] */
function famRow(f, fork, informs = false) {
  const parts = [f.sd != null ? `${fmtSigned(f.sd, 1)} sd` : '', f.rankText || '', f.detail || '', f.members > 1 ? `1 of ${f.members} measures` : '']
    .filter(Boolean);
  const lab = h('span', {}, h('span', { class: 'lg-name' }, f.name), ' ', h('span', { class: 'lg-cls', title: `class ${f.cls}` }, f.cls),
    parts.length ? h('span', { class: 'lg-sub' }, parts.join(' · ')) : null);
  const sig = f.signal == null ? '—' : fmt1(f.signal);
  const w = f.weight.toFixed(Math.abs(f.weight * 10 - Math.round(f.weight * 10)) < 1e-9 ? 1 : 2);
  const val = informs ? h('span', { class: 'muted' }, `${sig} · ${f.year ?? ''}`)
    : h('span', {}, `${sig} × ${w}`, h('span', { class: 'muted' }, ` · ${f.year ?? ''}${f.stale ? ' (old)' : ''}`));
  const thick = informs ? 6 : Math.max(3, Math.round(12 * f.weight));
  return row(`lg-fam${informs ? ' informs' : ''}`, lab, track(f.signal, { thick, hollow: informs, fork }), val);
}
/** The rule that fired, in words, from the numbers above and the rubric's counts under the reading in force. @param {any} a @param {boolean} fork */
function ruleWords(a, fork) {
  const N = a.N, th = a.thresholds, k = a.counts, t = a.tier, C = a.C ?? 0, E = a.E ?? 0;
  const side = fork ? ['to costly finance', 'to low returns'] : ['toward a problem', 'away from a problem'];
  const agreeing = `${count(C, 'test agrees', 'tests agree')}, pointing`;
  if (t === 'candidate') {
    return N != null && N >= th.lookAlone ? `the net score is at or above ${fmt1(th.lookAlone)}, enough on its own`
      : `the net score is at or above ${fmt1(th.look)} and ${agreeing} ${side[0]}`;
  }
  if (t === 'probably_not') {
    return N != null && N <= th.notAlone ? `the net score is at or below ${fmt1(th.notAlone)}, enough on its own`
      : `the net score is at or below ${fmt1(th.not)} and ${agreeing} ${side[1]}`;
  }
  if (t === 'likely_binding') return `the net score is at or above ${fmt1(th.likely)}, ${word(k.likelyC)} tests agree and ${word(k.likelyE)} sources count`;
  if (t === 'ruled_out') {
    return `the net score is at or below ${fmt1(th.ruled)}, ${word(k.ruledC)} tests agree, ${word(k.ruledE)} sources count, ` +
      'and the price and workaround tests both point away';
  }
  if (t === 'cannot_tell_data_gap') {
    if (a.reason === 'not_connected') return 'the tool has no route yet to the evidence that could settle this, so the lines do not apply';
    if (a.subreason === 'stale') {
      return `the newest class A or B evidence is from ${a.R ?? 'too long ago'}, older than ${k.staleYears} years, so the lines do not apply yet`;
    }
    return `only ${count(E, 'source counts', 'sources count')}; a rating needs ${word(k.Ebelow)}, so the lines do not apply yet`;
  }
  if (t === 'cannot_tell_conflicting') {
    const hi = a.tests.filter((x) => x.T != null && x.T >= k.conflictPos).map((x) => TEST_SHORT[x.key].toLowerCase());
    const lo = a.tests.filter((x) => x.T != null && x.T <= k.conflictNeg).map((x) => TEST_SHORT[x.key].toLowerCase());
    if (!hi.length || !lo.length) return 'tests pull hard both ways, so no rating';
    return `tests pull hard both ways (${hi.join(', ')} at ${fmt1(k.conflictPos)} or more, ${lo.join(', ')} at ${fmt1(k.conflictNeg)} or less), so no rating`;
  }
  if (t === 'desk_undiagnosable') return 'this needs a sector study; national statistics cannot settle it';
  if (t === 'elimination') return 'this is judged by elimination, once the other causes of low returns are ruled out';
  if (N == null) return 'no net score yet';
  // a weak reading: the net score falls short of a line, or reaches the dashed one with too few agreeing tests
  if (N >= th.look) return `the net score reaches ${fmt1(th.look)}, but ${count(C, 'test agrees', 'tests agree')} where ${word(k.lookC)} are needed`;
  if (N <= th.not) return `the net score reaches ${fmt1(th.not)}, but ${count(C, 'test agrees', 'tests agree')} where ${word(k.notC)} are needed`;
  return `the net score is ${bandWord(N, fork)}, short of the lines`;
}
