// @ts-check
// The anatomy of a rating, DOM-free: the numbers the engine already computed for one area, arranged the way the
// rating is built (the evidence families with their class, signal, weight and vote; the four test scores; the net
// score, the agreement count and the voting sources; the thresholds and counts the tier is read against). Every number
// here is a number in the data file or the registry; nothing is recomputed, so the picture can never disagree with the
// rating. Drawn by components/ledger.mjs; tested under Node by tests/test_anatomy.py.
import { TEST_ORDER, TEST_NUM, shortName, isStale, cannotTellCode } from './common.mjs';

/** The four tests as questions. */
export const TEST_QUESTION = {
  price: 'Is it expensive or rationed?',
  changes: 'When it changed, did investment move?',
  circumvention: 'Are firms paying to get around it?',
  camels: 'Do the activities that need it least do best?',
};
export const TEST_SHORT = { price: 'Price', changes: 'Changes', circumvention: 'Workarounds', camels: 'Camels' };
/** What each class of evidence is, in a few words. */
export const CLASS_WORDS = {
  A: 'a price: measures the cost directly',
  B: 'a workaround: behaviour that only makes sense if it binds',
  C: 'a quantity or a survey answer: cannot tell cause from effect',
  D: 'an expert rating',
};

/**
 * @typedef {object} FamilyRow
 * @property {string} id the family id
 * @property {string} name the plain name of the measure shown: the member whose own signal is nearest the family's
 * @property {number} members how many measures the family holds (its signal is their median)
 * @property {string | null} shown the id of the measure shown (null for a family with no data rows)
 * @property {string} cls A, B, C or D
 * @property {number | null} signal -2 to +2, positive toward binding
 * @property {number} weight the class weight after recency (0 to 1)
 * @property {number | null} year the data year
 * @property {boolean} votes whether it counts in the test's score (C and D inform only on tests 1 and 4)
 * @property {boolean} stale older than the staleness limit at the snapshot
 * @property {string | null} note the engine's note when it informs or was downgraded
 * @property {number | null} sd the shown measure's gap from what income predicts, in standard deviations, signed toward
 *   binding; only when the signal used that reading
 * @property {string | null} rankText its place among the comparison countries, as the cards word it ("2nd-lowest of 11");
 *   only when the signal used that reading
 * @property {string | null} detail what the signal rests on when it is neither: the year pairs of a changes test, a camels gate
 */
/**
 * @typedef {object} TestRow
 * @property {string} key price | changes | circumvention | camels
 * @property {number} num 1 to 4
 * @property {string} question the test as a question
 * @property {number | null} T the test's score, -2 to +2, or null when not computed
 * @property {boolean} notObserved a price (or camels) test with informing families only
 * @property {boolean} shrunk pulled toward zero because its voting weight is thin
 * @property {number} weight the test's weight in the net score (price 2, the others 1)
 * @property {FamilyRow[]} voting the families that count, strongest first
 * @property {FamilyRow[]} informing the families that inform only
 */

/** The rubric's tiers under a reading: params.tiers with params.settings[setting].tiers laid over, one level deep. @param {any} params @param {string} setting */
export function tiersFor(params, setting) {
  const base = (params && params.tiers) || {};
  const S = (params && params.settings && params.settings[setting]) || null;
  const over = (S && S.tiers) || {};
  /** @type {Record<string, any>} */
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = v && typeof v === 'object' ? { ...(base[k] || {}), ...v } : v;
  return { tiers: out, label: (S && S.label) || 'Standard' };
}

/**
 * The anatomy of one area's rating.
 * @param {any} node a node of the scorecard (view.nodes), under the reading and comparator set in force
 * @param {any} registry the loaded registry ({indicatorById, nodeById, params})
 * @param {{snapshotYear?: number, byId?: Record<string, any>, set?: string, fallbackSet?: string, setting?: string, comovement?: any[]}} [opts]
 *   byId: the indicator rows in force by id (sd, rank, member signals); set: the comparator set of those rows ('custom' after an
 *   edited peer list) and fallbackSet the set it replaced; setting: the reading whose thresholds the lines show; comovement: the
 *   scorecard's comovement records (the changes test's year pairs)
 * @returns {any}
 */
export function ratingAnatomy(node, registry, { snapshotYear, byId = {}, set = 'structural', fallbackSet = 'structural', setting = 'standard', comovement = [] } = {}) {
  if (!node || !node.tests || node.scored === false) return null;
  const params = (registry && registry.params) || {};
  const { tiers: P, label: settingLabel } = tiersFor(params, setting);
  const weights = { price: 2, changes: 1, circumvention: 1, camels: 1, ...(node.N_weights || P.test_weights || {}) };
  const limit = (params.recency && params.recency.staleness_limit_years) || 8;
  const indById = (registry && registry.indicatorById) || {};
  const cmById = Object.fromEntries((comovement || []).map((c) => [c.id, c]));
  const sigOf = (row) => (row ? (row.signal_by_set && row.signal_by_set[set] != null ? row.signal_by_set[set] : row.signal) : null);
  const fam = (f) => {
    const ids = f.indicators || [];
    // the member whose own signal is nearest the family's (the family signal is their median), the stronger one on a tie
    const rows = ids.map((id) => byId[id]).filter(Boolean);
    const pick = rows.length ? rows.slice().sort((a, b) => Math.abs((sigOf(a) ?? 0) - (f.signal ?? 0)) - Math.abs((sigOf(b) ?? 0) - (f.signal ?? 0))
      || Math.abs(sigOf(b) ?? 0) - Math.abs(sigOf(a) ?? 0))[0] : null;
    const id = pick ? pick.id : ids[0];
    const ind = indById[id] || pick;
    const readings = f.readings || [];
    const sd = pick && readings.includes('icr') && pick.icr && Number.isFinite(pick.icr.t) ? pick.icr.t * (pick.direction === -1 ? -1 : 1) : null;
    const pg = pick && readings.includes('peer_gap') && pick.peer_gap ? (pick.peer_gap[set] || pick.peer_gap[fallbackSet]) : null;
    const cm = cmById[f.id];
    let name = ind ? shortName(ind) : String(f.id).replace(/^es_/, '').replace(/_/g, ' ');
    let detail = null;
    if (cm) {
      const x = indById[cm.x_source] || byId[cm.x_source], y = indById[cm.y] || byId[cm.y];
      name = `Investment and ${x ? shortName(x).toLowerCase() : 'the price'}, year to year`;
      detail = Number.isFinite(cm.agree) && Number.isFinite(cm.pairs) ? `moved as predicted in ${cm.agree} of ${cm.pairs} years` : null;
      if (y && !/investment|capital formation/i.test(shortName(y))) name = `${shortName(y)} and ${x ? shortName(x).toLowerCase() : 'the price'}, year to year`;
    } else if (readings.includes('percentile') && pick && pick.camels_gated) detail = 'within the noise: scored 0';
    return /** @type {FamilyRow} */ ({
      id: f.id, name, members: ids.length, shown: pick ? pick.id : null, cls: f.class, signal: f.signal ?? null, weight: f.weight ?? 0, year: f.year ?? null, votes: !!f.votes,
      stale: snapshotYear != null && f.year != null ? isStale(f.year, snapshotYear, limit) : false, note: f.vote_note || f.class_note || null,
      sd, rankText: rankText(pick, pg), detail,
    });
  };
  const bySignal = (a, b) => Math.abs(b.signal ?? 0) - Math.abs(a.signal ?? 0) || (b.weight - a.weight);
  const tests = TEST_ORDER.map((key) => {
    const tv = node.tests[key] || null;
    const rows = (node.families || []).filter((f) => f.test === key).map(fam);
    return /** @type {TestRow} */ ({
      key, num: TEST_NUM[key], question: TEST_QUESTION[key],
      T: tv && tv.T != null ? tv.T : null, notObserved: !!(tv && tv.not_observed), shrunk: !!(tv && tv.shrunk), weight: weights[key] ?? 1,
      voting: rows.filter((r) => r.votes).sort(bySignal), informing: rows.filter((r) => !r.votes).sort(bySignal),
    });
  });
  const num = (o, k, d) => (o && Number.isFinite(o[k]) ? o[k] : d);
  const def = registry && registry.nodeById ? registry.nodeById[node.id] : null;
  return {
    id: node.id, tests, N: Number.isFinite(node.N) ? node.N : null, C: Number.isFinite(node.C) ? node.C : null, E: Number.isFinite(node.E) ? node.E : null,
    R: Number.isFinite(node.R) ? node.R : null, tier: node.tier, subreason: node.tier_subreason || null, reason: cannotTellCode(node),
    speakingMin: num(P, 'concordance_abs_T_min', 0.5),
    thresholds: { look: num(P.candidate, 'N_min', 0.5), lookAlone: num(P.candidate, 'N_alt_min', 1), not: num(P.probably_not, 'N_max', -0.5),
      notAlone: num(P.probably_not, 'N_alt_max', -1), likely: num(P.likely_binding, 'N_min', 1), ruled: num(P.ruled_out, 'N_max', -1) },
    counts: { lookC: num(P.candidate, 'C_min', 2), notC: num(P.probably_not, 'C_min', 2), likelyC: num(P.likely_binding, 'C_min', 3),
      likelyE: num(P.likely_binding, 'E_min', 5), ruledC: num(P.ruled_out, 'C_min', 3), ruledE: num(P.ruled_out, 'E_min', 5),
      Ebelow: def && Number.isFinite(def.evidence_floor) ? def.evidence_floor : num(P.cannot_tell_data_gap, 'E_below', 2),
      staleYears: num(P.cannot_tell_data_gap, 'staleness_limit_years', limit),
      conflictPos: num(P.conflicting, 'T_pos_min', 1), conflictNeg: num(P.conflicting, 'T_neg_max', -1) },
    settingLabel, weights,
  };
}

const ord = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
/**
 * The peer rank on the side that matters, as card.mjs rankPhrase words it: "highest" or "lowest" by the measure's own direction.
 * @param {any} row the indicator row @param {any} pg its peer_gap for the comparator set
 * @returns {string | null}
 */
export function rankText(row, pg) {
  if (!row || !pg || pg.insufficient || pg.rank_worst == null || !(pg.n > 2)) return null;
  const hiWorse = (row.direction ?? 1) >= 0;
  let k = pg.rank_worst; let word = hiWorse ? 'highest' : 'lowest';
  if (k > (pg.n + 1) / 2) { k = pg.n + 1 - k; word = hiWorse ? 'lowest' : 'highest'; }
  const joint = !Number.isInteger(k) || pg.ties > 0;
  const kk = Math.max(1, Math.floor(k));
  return `${joint ? 'joint ' : ''}${kk === 1 ? word : `${ord(kk)}-${word}`} of ${pg.n}`;
}

/** The band a score falls in on the shared ruler, in words; the first decision in direction words. @param {number | null} x @param {boolean} [fork] */
export function bandWord(x, fork = false) {
  if (x == null) return 'not scored';
  if (fork) return x >= 0.5 ? 'leaning to costly finance' : x <= -0.5 ? 'leaning to low returns' : 'near zero';
  if (x >= 1) return 'strongly toward a problem';
  if (x >= 0.5) return 'toward a problem';
  if (x > -0.5) return 'near zero';
  if (x > -1) return 'away from a problem';
  return 'strongly away from a problem';
}
