// @ts-check
// The state a country page works from (interface PRD v0.3, step 3): the snapshot and the registry, the comparison set in force
// (with the in-browser recompute when the reader edits the list), the reading, and the reader's overrides, all from the link.
// The area page and the overview (country.mjs) both use it: one copy of the logic (Night 2, 18 November).
import { getJSON, loadRegistry, parseHash, writeState, dataBase, SETTING_LABEL } from './common.mjs';
import { plainTierOf } from './card.mjs';

/**
 * @typedef {{iso: string, registry: any, scorecard: any, countries: any[], fcs: any, index: any, narrative: any, engine: any,
 *   engineStatus: {ok: boolean, message: string}, matrix: any, activeSet: string, peers: string[] | null, overrides: Record<string, any>,
 *   setting: string, view: any, viewBase: any, lastRecompute: string}} CountryState
 */

/** The engine's own view of the snapshot, as the default comparison set computed it. @param {any} sc */
export function baseView(sc) {
  return { nodes: sc.nodes.map((n) => ({ ...n })), ranking: sc.ranking, statements: sc.statements, sensitivity: sc.sensitivity, indicators: sc.indicators,
    setKey: sc.meta.active_comparator_set || 'structural', note: '' };
}

/** The reading in force: Standard is the engine's tiers; Cautious and Exploratory use the tiers the engine stored for them. @param {CountryState} state @param {any} view */
export function applySetting(state, view) {
  if (!view || state.setting === 'standard' || view.fallback) return view;
  const label = SETTING_LABEL[state.setting];
  const nodes = view.nodes.map((n) => {
    const t = n.tier_by_setting && n.tier_by_setting[state.setting];
    if (!t || t === n.tier) return n;
    return { ...n, tier: t, cannot_tell_reason: null, cannot_tell_detail: null, tier_reason: `${plainTierOf(n.id, t)} under the ${label} reading (Standard: ` +
      `${plainTierOf(n.id, n.tier).toLowerCase()}). The rule text that follows is the Standard computation. ${n.tier_reason}` };
  });
  return { ...view, nodes, setting: state.setting };
}

/** Without the engine module, another preset set's stored tiers. @param {CountryState} state @param {any} base */
export function fallbackView(state, base) {
  const nodes = base.nodes.map((n) => (n.tier_by_set && n.tier_by_set[state.activeSet]
    ? { ...n, ...(n.tier_by_set[state.activeSet] === n.tier ? {} : { cannot_tell_reason: null, cannot_tell_detail: null }), tier: n.tier_by_set[state.activeSet] }
    : n));
  return { nodes, ranking: base.ranking, statements: base.statements, indicators: base.indicators, setKey: state.activeSet, fallback: true,
    note: 'Ranking and statements are shown for the default set; the engine module is not available for a browser recompute.' };
}

/** The comparison set in force: the engine's view for the default set, a browser recompute for any other or an edited list. @param {CountryState} state */
export async function applyComparators(state) {
  const sc = state.scorecard; const base = baseView(sc);
  const isDefault = state.activeSet === (sc.meta.active_comparator_set || 'structural') && !Array.isArray(state.peers);
  state.lastRecompute = '';
  if (isDefault) state.viewBase = base;
  else if (state.engine) {
    try {
      if (!state.matrix) state.matrix = await getJSON(`${dataBase()}/matrix.json`);
      const members = sc.comparators[state.activeSet] ? sc.comparators[state.activeSet].members : [];
      const peers = Array.isArray(state.peers) ? state.peers : members;
      const res = state.engine.recomputeWithPeers(sc, state.matrix, peers, { indicators: state.registry.indicators, nodes: state.registry.nodes },
        state.registry.params, { replaces: state.activeSet });
      const nodes = Array.isArray(res.nodes) ? res.nodes.map((n) => ({ ...(base.nodes.find((b) => b.id === n.id) || {}), ...n })) : base.nodes;
      state.viewBase = { nodes, ranking: res.ranking || base.ranking, statements: res.statements || base.statements, sensitivity: res.sensitivity ||
        base.sensitivity, indicators: Array.isArray(res.indicators) ? res.indicators : base.indicators, setKey: res.active_comparator_set || 'custom', note: '' };
      state.lastRecompute = `Recomputed in the browser with ${peers.length} comparison countries.`;
    } catch (e) { console.error(e); state.viewBase = fallbackView(state, base); state.lastRecompute = `Recompute failed: ${e.message}.`; }
  } else state.viewBase = fallbackView(state, base);
  state.view = applySetting(state, state.viewBase);
  writeState(state);
}

/**
 * Load one economy's state from the snapshot and the link, without applying the comparison set yet (the overview draws its
 * head first, then applies it; loadCountryState() does both).
 * @param {string} iso
 * @returns {Promise<CountryState>}
 */
export async function loadCountryData(iso) {
  const DATA = dataBase();
  const [registry, scorecard, countries, fcs, index] = await Promise.all([loadRegistry(), getJSON(`${DATA}/${iso}.json`),
    getJSON(`${DATA}/countries.json`, { optional: true }), getJSON('/growth-test-site/registry/static_fcs.json', { optional: true }), getJSON(`${DATA}/index.json`, { optional: true })]);
  const narrative = await getJSON(`/growth-test-site/synth/narratives/${iso}.json`, { optional: true });
  /** @type {any} */
  let engine = null; let engineStatus = { ok: false, message: '' };
  // C8: a root path in quotes, which build_site.py can rewrite
  const enginePath = '/growth-test-site/engine/src/scorecard.mjs';
  try {
    const mod = await import(enginePath);
    if (typeof mod.recomputeWithPeers === 'function') { engine = mod; engineStatus = { ok: true, message: '' }; }
  } catch (e) { engineStatus = { ok: false, message: `the engine module could not be imported (${/** @type {Error} */ (e).message}).` }; }
  const hs = parseHash();
  /** @type {CountryState} */
  const state = { iso, registry, scorecard, countries: countries || [], fcs, index, narrative, engine, engineStatus, matrix: null,
    activeSet: hs.set && scorecard.comparators[hs.set] ? hs.set : (scorecard.meta.active_comparator_set || 'structural'),
    peers: hs.peers, overrides: hs.overrides || {}, setting: hs.setting, view: null, viewBase: null, lastRecompute: '' };
  return state;
}

/**
 * Load one economy's state and apply its comparison set and reading.
 * @param {string} iso
 * @returns {Promise<CountryState>}
 */
export async function loadCountryState(iso) {
  const state = await loadCountryData(iso);
  await applyComparators(state);
  return state;
}
