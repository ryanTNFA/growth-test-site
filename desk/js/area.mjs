// @ts-check
// The area page (interface PRD v0.3, 5C): one area of one economy in one place, area.html?iso=KEN&area=N5. Tenet 10: each area
// has one page that holds its reading, its tests and its evidence. This module draws the plain part: the head (the area, its
// question, the assumptions line, the previous and next areas in tree order, C7), the four tests framed by the method's question
// (E9 a, static in area.html), and the evidence card drawn in place (card.mjs, inline): the rating and its plain reading, "Does
// this look right?", the sub-areas as rows to pick (C2), the four tests on one axis with what counts in each (the ledger, C8 to
// C10), the measures each way with equal weight, what would move the rating and the reader's own rating. The charts below are
// the Analyst View's per-area view, whole (evidence.mjs in area mode). The first decision adds its table (from the retired Areas
// page); self-discovery adds its thirteen sections, folded (C5).
import { refreshNav, setAssumptions, areaHref, tabHref } from './shell.mjs';
// the charts below are the Analyst View's per-area view, whole: evidence.mjs runs itself in area mode on this page
import './evidence.mjs';
import { h, qs, writeState, parseHash, currentHash, nodeCode, fmt, fmtSigned, englishList, currentDetail, pictogram, tapSources } from './common.mjs';
import { createCard, plainTier, plainTierOf } from './card.mjs';
import { loadCountryState, applySetting } from './countrystate.mjs';
import { ratingChanged } from './motion.mjs';
import { STRIP_AREAS } from './components/strip.mjs';

const $ = (id) => document.getElementById(id);
const iso = (qs('iso') || document.body.dataset.iso || 'KEN').toUpperCase();
const area = qs('area') || 'N5';
const SET_KIND = { structural: 'similar economies', regional: 'regional neighbors', aspirational: 'faster growers that were once as rich' };

function showError(msg) { const e = $('page-error'); if (e) { e.hidden = false; e.textContent = msg; } }

async function main() {
  /** @type {import('./countrystate.mjs').CountryState} */
  let state;
  try { state = await loadCountryState(iso); } catch (e) { showError(`Could not load the snapshot for ${iso}: ${/** @type {Error} */ (e).message}.`); return; }
  const R = state.registry; const sc = state.scorecard; const c = sc.country.name;
  const reg = R.nodeById[area];
  if (!reg) { showError(`There is no area ${area} in the tree.`); return; }
  const name = String(reg.short).replace(/\?$/, '');
  const parent = R.nodeById[reg.parent];
  document.title = `${name} · ${c} · The Growth Test`;

  // the head: the economy (back to its overview), the area, its question; the walk through the tree (C7)
  $('ar-crumbs').replaceChildren(h('a', { href: tabHref('/growth-test-site/desk/country.html', iso) }, c), ' · ',
    // spread: replaceChildren takes nodes and strings, and an array would be printed as text (the link's address)
    ...(parent && /^N11$/.test(parent.id) ? [h('a', { href: areaHref(iso, parent.id) }, String(parent.short)), ' · '] : []),
    area === 'N0' ? 'the first decision' : h('span', { class: 'an-only' }, `${nodeCode(area)} of the tree`));
  const title = $('page-title'); title.replaceChildren(pictogram(area) || '', area === 'N0' ? 'Costly finance, or low returns?' : name);
  title.removeAttribute('data-country-title');
  $('ar-q').textContent = reg.question || reg.label || '';
  const at = STRIP_AREAS.indexOf(STRIP_AREAS.includes(area) ? area : String(reg.parent));
  const step = (i, rel) => {
    const id = STRIP_AREAS[i]; if (!id) return h('span', {});
    const r = R.nodeById[id];
    return h('a', { class: rel === 'prev' ? 'ar-step ar-prev' : 'ar-step ar-next', rel, href: areaHref(iso, id) }, rel === 'prev' ? '← ' : '', String(r ? r.short : id).replace(/\?$/, ''), rel === 'next' ? ' →' : '');
  };
  $('ar-walk').replaceChildren(step(at - 1, 'prev'), h('span', { class: 'ar-pos' }, `${at + 1} of ${STRIP_AREAS.length} in tree order`), step(at + 1, 'next'));

  // L3: the assumptions line under the area's name
  const members = Array.isArray(state.peers) ? state.peers : ((sc.comparators[state.activeSet] || { members: [] }).members);
  const nameOf = (x) => { const k = state.countries.find((y) => y.iso3 === x); return k ? k.name : x; };
  setAssumptions({ members: members.map(nameOf), kind: Array.isArray(state.peers) ? 'countries you chose' : (SET_KIND[state.activeSet] || 'countries'),
    snapshotId: sc.meta.snapshot_id, custom: Array.isArray(state.peers) });

  // the evidence card, drawn in place
  const card = createCard({
    drawer: /** @type {HTMLElement} */ ($('ar-plain')), registry: R, inline: true, getState: () => state,
    onOverride: (id, ov) => {
      if (ov) state.overrides[id] = ov; else delete state.overrides[id]; writeState(state); refresh(); refreshNav();
      // 5F: the reader changed their own rating: one line says so (F2), and the badge fades in once (F1)
      const nm = String((R.nodeById[id] || {}).short || id).replace(/\?$/, '').toLowerCase();
      $('ar-changed').textContent = ov ? `1 area changed: ${nm}, your own rating is now ${plainTierOf(id, ov.tier).toLowerCase()}.` : `1 area changed: ${nm}, back to the tool’s rating.`;
      ratingChanged(document.querySelector('#ar-plain .plain-read .tier-badge'));
    },
    onOpenNode: (id, sub) => { if (id === area) draw(id, sub); else location.href = areaHref(iso, id); },
  });
  // C8, test 4: what the Analyst View charts below from trade data and does not count joins the block's line: the export tilts
  // that have not passed their checks, and the hippo gap (the presence version) when it is shown only
  /** @type {string[]} */
  let tilts = [];
  let hippoShown = false;
  const addTilts = () => {
    const line = document.querySelector('#ar-plain .lg-test[data-test="camels"] .lg-rests');
    if (!line || (!tilts.length && !hippoShown) || line.querySelector('.lg-tilts')) return;
    const lower = (s) => String(s).replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase());
    const parts = [tilts.length ? `export tilts on ${englishList(tilts.map(lower))}` : '', hippoShown ? 'the hippo gap' : ''].filter(Boolean);
    const one = !tilts.length || (tilts.length === 1 && !hippoShown);
    line.append(h('span', { class: 'lg-tilts' }, ` Also shown only, from trade data: ${parts.join(', and ')}, which ${one ? 'has' : 'have'} not ` +
      `passed ${one ? 'its' : 'their'} checks (the camels chart below).`));
  };
  window.addEventListener('area-camels', (e) => {
    const d = /** @type {CustomEvent} */ (e).detail;
    if (d && d.node === area) { tilts = d.shown || []; hippoShown = !!d.hippoShown; addTilts(); }
  });
  // C4: the card's numbers carry their year inline and their source on tap in Plain
  const draw = (/** @type {string} */ id, /** @type {string | undefined} */ sub) => { card.open(id, sub); addTilts(); tapSources($('ar-plain')); };
  draw(area);
  applyDetail();
  window.addEventListener('desk-detail', applyDetail);
  if (state.lastRecompute) $('ar-plain').prepend(h('p', { class: 'note' }, state.lastRecompute));

  if (area === 'N0') $('ar-extra').append(topSplit(state));
  if (area === 'N12') mountSelfDiscovery();
  refreshNav();
  window.addEventListener('hashchange', () => { const p = parseHash(); state.overrides = p.overrides || {}; refresh(); });
  window.addEventListener('desk-setting', (e) => {
    const before = (state.view.nodes.find((n) => n.id === area) || {}).tier;
    state.setting = /** @type {CustomEvent} */ (e).detail.setting; state.view = applySetting(state, state.viewBase); writeState(state); refresh();
    const after = (state.view.nodes.find((n) => n.id === area) || {}).tier;
    // 5F: a reading that changes this area's rating says so in words and fades the badge in once
    if (before !== after) {
      $('ar-changed').textContent = `1 area changed: ${name.toLowerCase()}, now ${plainTierOf(area, after).toLowerCase()} under the ${state.setting} reading.`;
      ratingChanged(document.querySelector('#ar-plain .plain-read .tier-badge'));
    } else $('ar-changed').textContent = '';
  });
  function refresh() { card.refresh(); addTilts(); tapSources($('ar-plain')); applyDetail(); }
}

// ---------- L2 and C3: Plain folds the rule detail and the charts; Analyst opens them ----------
let revealed = false;
function applyDetail() {
  const analyst = currentDetail() === 'analyst';
  for (const d of /** @type {NodeListOf<HTMLDetailsElement>} */ (document.querySelectorAll('#ar-plain details.rule-detail, #ar-plain details.k-fold'))) d.open = analyst;
  const sec = $('ar-analyst'); if (!sec) return;
  const show = analyst || revealed;
  const wasHidden = sec.hidden;
  sec.hidden = !show;
  let btn = $('ar-show');
  if (!btn) {
    btn = h('button', { class: 'btn ar-show', id: 'ar-show', type: 'button' }, 'Show the charts and every control');
    btn.addEventListener('click', () => { revealed = true; applyDetail(); });
    sec.before(h('div', { class: 'ar-show-row' }, btn, h('span', { class: 'small muted' }, ' The Analyst View for this area: the strip, the four tests’ charts, ' +
      'any indicator against income and the comparison countries.')));
  }
  /** @type {HTMLElement} */ (btn.parentElement).hidden = show;
  // the charts were drawn at no width while folded: a resize redraws them (evidence.mjs listens)
  if (wasHidden && show) window.dispatchEvent(new Event('resize'));
}

// ---------- the first decision's table (moved from the retired Areas page) ----------
const TOPSPLIT_PATTERN = {
  finance_supply: 'fit a finance-supply problem',
  low_demand: 'fit low demand for investment, which points to the low-returns branch',
  credit_boom_no_investment: 'conflict: credit is growing fast but investment is low (check macro risk, crowding out and consumer credit)',
  not_investment_constrained: 'do not show an investment problem',
  investment_without_finance: 'show investment without bank finance, likely public or foreign-led',
  indeterminate: 'do not match any standard pattern',
};
/** The three quick statistics and the first-decision table. @param {any} state */
function topSplit(state) {
  const sc = state.scorecard; const ts = sc.top_split || {}; const th = ts.thresholds || state.registry.params.top_split; const s = ts.stats || {};
  const c = sc.country.name; const cls = ts.classification || {};
  const nodeOf = (id) => state.view.nodes.find((n) => n.id === id);
  const n0 = nodeOf('N0'); const n3 = nodeOf('N3');
  const rows = [
    ['finance_supply', 'high', 'low', 'low', 'Supply of finance constrained: points to the finance branch (top of the tree)'],
    ['low_demand', 'low', 'low', 'low', 'Low demand for investment: points to the low-returns branch (bottom of the tree)'],
    ['credit_boom_no_investment', 'high', 'high', 'low', 'Conflicting: check macro risk, crowding out, consumer credit'],
    ['not_investment_constrained', 'low', 'high', 'not low', 'Revisit the question'],
    ['investment_without_finance', 'low', 'low', 'not low', 'Likely public or FDI-led investment'],
    ['indeterminate', 'anything else', '', '', 'Between rows; state the three statistics'],
  ];
  const rateTxt = cls.rate === 'high' ? `the real lending rate is high for ${c}'s income` : cls.rate === 'low' ? `the real lending rate is low for ${c}'s income`
    : `the real lending rate is about what ${c}'s income predicts`;
  const creditTxt = s.credit_growth != null ? `private credit grew ${cls.credit === 'high' ? 'fast' : 'slowly'} (${fmt(s.credit_growth, 1)}% a year after inflation, ` +
    'three-year average)' : 'private credit growth is not available';
  const invTxt = cls.investment === 'low' ? 'investment is low for its income' : 'investment is not low for its income';
  const sec = h('section', { class: 'ar-sec ar-topsplit', 'aria-labelledby': 'topsplit-h' },
    h('span', { class: 'kicker' }, 'How the tool starts'), h('h2', { id: 'topsplit-h' }, 'The first-decision table'),
    h('p', { class: 'prose' }, `Three quick statistics ${TOPSPLIT_PATTERN[ts.row] || TOPSPLIT_PATTERN.indeterminate}: ${rateTxt}, ${creditTxt}, and ${invTxt}.`));
  if (ts.rate_source && ts.rate_source !== 'FR.INR.RINR') sec.append(h('p', { class: 'note' }, `Real rate from ${ts.rate_source}: the CPI-deflated lending rate ` +
    'stands in because the WDI real rate (FR.INR.RINR) is missing in the window.'));
  if (Array.isArray(ts.missing) && ts.missing.length) sec.append(h('p', { class: 'note' }, `Missing statistics: ${ts.missing.map((k) => k.replace(/_/g, ' ')).join(', ')}.`));
  const depthTxt = cls.credit_depth === 'thin' ? ` · private credit is thin (ICR t ≤ ${th.credit_depth_thin_t}), so growth does not read as high` : '';
  sec.append(h('div', { class: 'stat-grid' },
    h('div', { class: 'stat' }, h('span', { class: 'lab' }, 'Real lending rate, ICR t'), h('span', { class: 'val num' }, fmtSigned(s.real_rate_t)),
      h('span', { class: 'sub' }, `${cls.rate ? `read as ${cls.rate} · ` : ''}high if ≥ ${th.rate_high_t}; low if ≤ ${th.rate_low_t}${ts.rate_source ? ` · source ${ts.rate_source}` : ''}`)),
    h('div', { class: 'stat' }, h('span', { class: 'lab' }, 'Real private credit growth'), h('span', { class: 'val num' }, s.credit_growth != null ? `${fmt(s.credit_growth, 2)}%` : '—'),
      h('span', { class: 'sub' }, `${cls.credit ? `read as ${cls.credit} · ` : ''}3-year average; high if ≥ ${th.credit_growth_high_pct}%` +
        `${s.credit_depth_t != null ? ` · private credit ICR t ${fmtSigned(s.credit_depth_t, 2)}` : ''}` +
        `${s.net_cashflow_banks != null ? ` · net cash flow from banks ${fmtSigned(s.net_cashflow_banks, 1)} pp` : ''}${depthTxt}`)),
    h('div', { class: 'stat' }, h('span', { class: 'lab' }, 'Investment (GFCF), ICR t'), h('span', { class: 'val num' }, fmtSigned(s.investment_t)),
      h('span', { class: 'sub' }, `${cls.investment ? `read as ${String(cls.investment).replace(/_/g, ' ')} · ` : ''}low if ≤ ${th.investment_low_t}`))));
  const label = ts.label || (ts.row || 'indeterminate').replace(/_/g, ' ');
  const verdicts = [n0, n3].filter(Boolean).map((n) => (n.id === 'N0' ? `the first decision ${plainTierOf(n.id, n.tier).toLowerCase()}`
    : `${nodeCode(n.id)} ${String(state.registry.nodeById[n.id].short).toLowerCase()} is ${plainTier(n.tier).toLowerCase()}`) + (n.N != null ? ` (N ${fmtSigned(n.N)})` : ''));
  const tail = cls.rate === 'low' ? ' A finance area cannot be rated likely while the real rate reads low here (the engine caps it at worth a closer look).' : '';
  sec.append(h('p', { class: 'small muted' }, `Pattern: the “${label}” row of the first-decision table (rate ${cls.rate || '—'}, credit growth ${cls.credit || '—'}, ` +
    `investment ${String(cls.investment || '—').replace(/_/g, ' ')}). This is a pattern, not a verdict: ${englishList(verdicts) || 'the finance areas are not scored'}.${tail}`));
  const tb = h('tbody');
  for (const r of rows) tb.append(h('tr', { 'aria-current': r[0] === ts.row ? 'true' : null, class: r[0] === ts.row ? 'ar-row-on' : null },
    h('td', { class: 'col-row' }, r[0] === ts.row ? '▸ ' : '', r[0].replace(/_/g, ' ')), h('td', {}, r[1]), h('td', {}, r[2]), h('td', {}, r[3]), h('td', { class: 'col-reading' }, r[4])));
  sec.append(h('div', { class: 'table-wrap' }, h('table', { class: 'data topsplit-table' },
    h('thead', {}, h('tr', {}, h('th', { class: 'col-row' }, 'Row'), h('th', {}, 'Rate'), h('th', {}, 'Credit growth'), h('th', {}, 'Investment'),
      h('th', { class: 'col-reading' }, 'Reading'))), tb)));
  return sec;
}

// ---------- self-discovery: its sections fold under the area page (C5) ----------
function mountSelfDiscovery() {
  const host = $('ar-extra'); if (!host) return;
  host.append(h('p', { class: 'small muted ar-sd-wait' }, 'Loading the self-discovery sections…'));
  import('./selfdiscovery.mjs').then((m) => m.mountSelfDiscovery(host, iso)).catch((e) => { console.error(e); showError(`Could not draw the self-discovery sections: ${e.message}`); });
}

main();
