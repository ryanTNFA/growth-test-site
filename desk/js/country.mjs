// @ts-check
// The Bottom line (Growth Test PRD D1, D2, D3, D8, D9; shipped 6 November 2026 after the Kenya prototype). Behind the
// redesign flag (shell.mjs REDESIGN) it is the country overview of the interface PRD v0.3, 5B: the answer block (a short
// headline, three counts in equal type, the caveat line and the transition, E9 c), the tree as the map of the page in three
// ratings with unclear's three kinds, a Tree / Grid toggle (the heat map as a view), the flagged areas strongest first, and
// the assumptions in one line (L3) instead of the comparison countries' paragraph. The question and its
// one-sentence answer come first, in larger type, above any control; the three lists are visible in the first screen;
// method text and long definitions sit behind <gt-term> hovers and <gt-fold> disclosures; the "unclear" reasons, the
// comparison countries and the dissent never fold. The area page (area.mjs) shares the state (countrystate.mjs) and the helpers
// (card.mjs, components/); the memo is built from the same bottomLine() call as the three lists.
import { tabHref, refreshNav, REDESIGN, setAssumptions, areaHref } from './shell.mjs';
import { currentDetail, pictogram, tapSources, announce } from './common.mjs';
import { ratingChanged } from './motion.mjs';
import { initTheme, h, parseHash, writeState, qs, withData, englishList, downloadText, SETTING_LABEL, fmt, fmtInt, shortName, gNorm,
  tierClass, nodeCode, missingTestKind, MISSING_TEST_LABEL, cannotTellCode, CANNOT_TELL_PLAIN, leanOf, fmtSigned, fmtValue, unitHint, sourceLink, sourceLabel,
  isStale, reasonClause, DATA_GAP_KINDS, isRegistryGap } from './common.mjs';
import { renderComparators } from './comparators.mjs';
import { loadCountryData, applyComparators, applySetting } from './countrystate.mjs';
import { growthChecks, incomeRows } from './growth_read.mjs';
import { patternChecks, growthChart, incomeStrip, growthStory } from './components/growth.mjs';
import { compactTree, overviewMap } from './tree.mjs';
import { PATTERN } from './growth_read.mjs';
import { plainTier, plainTierOf, bottomLine, fcsNote, refSpan, plainSummary, whatWouldMove, fieldQuestions, whyNotLines, evidenceNode } from './card.mjs';
import { robustChip, reasonTag } from './components/marks.mjs';
import { STRIP_AREAS } from './components/strip.mjs';
import { buildMemo } from './memo.mjs';
import { memoHTML } from './components/markdown.mjs';
import { buildBriefing } from './briefing.mjs';
import { answerSentence, forkSentence, itemName, overviewHeadline, overviewCounts, caveatLine, transitionLine, strongestFirst } from './country_text.mjs';
import { ratingAnatomy } from './anatomy.mjs';
import { tally } from './components/ledger.mjs';

initTheme();
const iso = (qs('iso') || document.body.dataset.iso || '').toUpperCase();
const $ = (id) => document.getElementById(id);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** @type {any} */
const state = { iso, registry: null, scorecard: null, countries: [], matrix: null, narrative: null, fcs: null, index: null, engine: null,
  activeSet: 'structural', peers: null, overrides: {}, view: null, viewBase: null, setting: 'standard', ovView: 'tree', changedText: '' };
const nameOf = (iso3) => { const c = (state.countries || []).find((x) => x.iso3 === iso3); return c ? c.name : iso3; };
const short = (id) => (state.registry && state.registry.nodeById[id] ? state.registry.nodeById[id].short : id);
const nodeOf = (id) => state.view.nodes.find((n) => n.id === id);
const snapshotYear = () => state.scorecard.meta.snapshot_year || Number(String(state.scorecard.meta.snapshot_id).slice(0, 4));
const activeMembers = () => (Array.isArray(state.peers) ? state.peers : (state.scorecard.comparators[state.activeSet] || { members: [] }).members);
const SET_KIND = { structural: 'similar economies', regional: 'regional neighbors', aspirational: 'faster growers that were once as rich' };

function showError(msg) { const e = $('page-error'); e.hidden = false; e.textContent = msg; }
/** Context for the plain-language helpers in card.mjs (the same shape country.mjs builds). */
function plainCtx() {
  const ind = state.view.indicators || state.scorecard.indicators;
  return { indicators: ind, byId: Object.fromEntries(ind.map((r) => [r.id, r])), setKey: state.view.setKey || state.activeSet, fallbackSet: state.activeSet,
    country: state.scorecard.country.name, registry: state.registry, nodes: state.view.nodes, view: state.view, snapshotYear: snapshotYear() };
}

// ---------- the view in force: comparison set, edited peers (in-browser recompute), evidence setting ----------
// countrystate.mjs holds the logic, shared with the area page: applyComparators(state) and applySetting(state, view)

// ---------- main ----------
async function main() {
  if (!iso) { showError('No economy selected. Open this page as country.html?iso=XXX or pick an economy on the Countries page.'); return; }
  // the snapshot, the registry, the narrative, the engine and the link's state (countrystate.mjs, shared with the area page)
  try { Object.assign(state, await loadCountryData(iso)); } catch (e) { showError(`Could not load the snapshot for ${iso}: ${e.message}.`); return; }
  document.title = `${state.scorecard.country.name} · ${REDESIGN ? 'Overview' : 'Bottom line'} · The Growth Test`;
  renderHead();
  await applyComparators(state);
  // L2 and B5: Analyst opens the overview's folds and starts on the grid; Plain starts on the tree, folded
  if (REDESIGN) { state.ovView = currentDetail() === 'analyst' ? 'grid' : 'tree'; applyDetail(); }
  renderAll();
  renderProvenance();
  renderGrowth();
  window.addEventListener('desk-detail', () => { state.ovView = currentDetail() === 'analyst' ? 'grid' : 'tree'; applyDetail(); renderCompactTree(); });
  renderTools();
  refreshNav();
  if (new URLSearchParams(location.search).get('section') === 'comparators') openComparators();
  window.addEventListener('hashchange', () => { const p = parseHash(); state.overrides = p.overrides || {}; renderAll(); });
  window.addEventListener('desk-setting', (e) => {
    state.setting = /** @type {CustomEvent} */ (e).detail.setting; state.view = applySetting(state, state.viewBase); writeState(state); renderAll();
  });
}
function renderAll() {
  const changed = REDESIGN ? tierChanges() : [];
  renderAnswer(); renderPeers(); renderSettingNote(); renderCompactTree(); renderLists(); renderOverrides(); renderCards(); renderAssistance();
  renderComparatorsPanel(); renderRanking();
  // C4: in the lists and the cards a number's source is a tap away in Plain (printed in Analyst)
  for (const id of ['statements-body', 'cards-body']) tapSources($(id));
  // 5F: the boxes whose rating the reader has just changed fade in once; the line above the map says which (F2)
  for (const id of changed) ratingChanged(document.querySelector(`.ovt-box[data-node="${id}"]`));
}
/** F2: the areas whose rating (the reader's own included) differs from the last drawing, in tree order, and the line that says so. */
let lastTiers = /** @type {Record<string, string> | null} */ (null);
function tierChanges() {
  const now = Object.fromEntries(['N0', ...STRIP_AREAS.filter((x) => x !== 'N0')].map((id) => {
    const n = nodeOf(id); const ov = state.overrides[id]; return [id, ov ? ov.tier : (n ? n.tier : '')];
  }));
  const ids = lastTiers ? Object.keys(now).filter((id) => now[id] !== lastTiers[id]) : [];
  lastTiers = now;
  const names = ids.map((id) => (id === 'N0' ? 'the first decision' : short(id).replace(/\?$/, '').toLowerCase()));
  state.changedText = ids.length ? `${ids.length} ${ids.length === 1 ? 'area' : 'areas'} changed: ${englishList(names)}.` : (lastTiers ? state.changedText : '');
  return ids;
}

// ---------- the head: the economy, the question, the one sentence (D1), the comparison countries (D3) ----------
function renderHead() {
  const sc = state.scorecard; const c = sc.country; const m = sc.meta;
  $('country-name').textContent = c.name; $('country-name').removeAttribute('data-country-title');
  $('k-meta').replaceChildren(h('strong', { id: 'country-name' }, c.name), ` · ${c.region} · ${c.income_group}${c.landlocked ? ' · landlocked' : ''} · public data as of `,
    h('gt-term', { def: 'The snapshot date of the public data behind every rating on this page. Data arrive with a lag, so the newest year of a measure can be ' +
      'earlier than this.' }, m.snapshot_id || '—'));
  $('k-question').textContent = `What holds back private investment in ${c.name}?`;
  if (REDESIGN) {
    // the overview: the question becomes the eyebrow and the headline answers it (B1); the answer block follows it
    document.body.classList.add('ov-on');
    const q = $('k-question');
    q.insertAdjacentElement('beforebegin', h('p', { class: 'ov-ask' }, `What holds back private investment in ${c.name}?`));
    q.insertAdjacentElement('afterend', h('div', { class: 'ov-answer', id: 'ov-answer', 'aria-live': 'polite' }));
    $('k-answer').hidden = true; $('k-peers').hidden = true;
  }
  const note = fcsNote(state.fcs, c.iso3, c.name);
  const el = $('fcs-note'); if (note) { el.hidden = false; el.textContent = note; } else el.hidden = true;
  $('versions').textContent = `Public data snapshot ${m.snapshot_id || '—'} · rubric ${m.rubric_version || '—'} · engine ${m.engine_version || '—'}.`;
}
function renderAnswer() {
  const bl = bottomLine(plainCtx());
  $('k-answer').textContent = answerSentence(bl, state.scorecard.country.name);
  if (!REDESIGN) return;
  // B1: a headline of at most fourteen words, the three counts in equal type, the caveat line; E9 c: the transition
  const sc = state.scorecard; const k = overviewCounts(bl);
  $('k-question').textContent = overviewHeadline(bl, sc.country.name);
  const g = sc.growth_problem || {}; const pat = PATTERN[g.classification];
  const tl = transitionLine(g.classification, pat ? pat.meaning : '');
  const count = (cls, n, words) => h('li', { class: `ov-count ${cls}` }, h('span', { class: 'ov-n' }, String(n)), ' ', words);
  $('ov-answer').replaceChildren(
    h('ul', { class: 'ov-counts', 'aria-label': 'The three answers, counted' },
      count('ov-look', k.look, 'worth a closer look'), count('ov-against', k.against, 'the data argue against'), count('ov-unclear', k.unclear, 'unclear')),
    h('p', { class: 'ov-caveat' }, caveatLine(sc.meta.snapshot_id)),
    tl ? h('p', { class: 'ov-transition' }, tl) : '');
}
function renderPeers() {
  const members = activeMembers();
  const kind = Array.isArray(state.peers) ? 'countries you chose' : (SET_KIND[state.activeSet] || 'countries');
  // L3: the comparison countries live in the assumptions line's panel
  if (REDESIGN) setAssumptions({ members: members.map(nameOf), kind, snapshotId: state.scorecard.meta.snapshot_id, custom: Array.isArray(state.peers) });
  const change = h('a', { href: '#comparators', onclick: (e) => { e.preventDefault(); openComparators(); } }, 'change');
  $('k-peers').replaceChildren('Judged against ', h('gt-term', { def: 'Each measure is read against what the economy’s income predicts and against these ' +
    'comparison countries; the default set is the economies most similar in income, size, resources and geography. The result is not a ranking of ' +
    'countries, and it is not about household needs.' }, `${members.length} ${kind}`),
    `: ${englishList(members.map(nameOf))} (`, change, ').');
}
function renderSettingNote() {
  const el = $('setting-note');
  if (state.setting === 'standard') { el.hidden = true; return; }
  el.hidden = false;
  el.replaceChildren(h('strong', {}, `${SETTING_LABEL[state.setting]} reading, not the one to cite.`), state.viewBase && state.viewBase.fallback
    ? ' This reading needs the in-browser engine for these comparison countries, so the page shows Standard.'
    : ' The figures are the same under every reading; only the ratings change. Standard is the only reading to cite.');
}
/** B2, B3: an area's box on the overview: its name, and under it the kind of unclear or the rating in the three answers' words. */
function describeArea(id, t, n) {
  const name = short(id).replace(/\?$/, '');
  const title = n ? plainSummary(n, plainCtx(), { brief: true }) : 'Not scored in this snapshot.';
  if (id === 'N0') return { name: 'Finance or low returns?', why: plainTierOf('N0', t), title };
  const node = n && t !== n.tier ? { ...n, tier: t, cannot_tell_reason: null } : n;
  const ev = n ? evidenceNode(n, state.view.nodes) : null;
  const code = cannotTellCode(ev && ev !== n ? ev : node) || cannotTellCode(node);
  let why;
  if (code) why = CANNOT_TELL_PLAIN[code].label;
  else if (t === 'elimination') why = 'judged by elimination';
  else if (t === 'desk_undiagnosable') why = 'needs a sector study';
  else if (t === 'candidate' || t === 'likely_binding') why = 'worth a closer look';
  else if (t === 'probably_not' || t === 'ruled_out') why = 'the data argue against it';
  else why = plainTierOf(id, t).toLowerCase();
  if (ev && ev !== n && (t === 'candidate' || t === 'likely_binding')) why = `${short(ev.id).replace(/\?$/, '').toLowerCase()}: ${why}`;
  const lean = code && n ? leanOf(n) : null;
  return { name, why, title, lean: lean ? lean.mark : '' };
}
/** B2: the key, the three answers with unclear's three kinds under the third (five entries), and the way to the full key. */
function overviewKey() {
  const sw = (cls) => h('span', { class: `swatch ${cls}`, 'aria-hidden': 'true' });
  return h('div', { class: 'ov-key' },
    h('span', {}, sw('t-candidate'), 'Worth a closer look', h('span', { class: 'ov-key-sub' }, ' (crimson: likely a main constraint)')),
    h('span', {}, sw('t-probably_not'), 'The data argue against it', h('span', { class: 'ov-key-sub' }, ' (darker: ruled out)')),
    h('span', { class: 'ov-key-unclear' }, 'Unclear: ', sw('t-cannot_tell_weak'), 'evidence too weak ', sw('t-cannot_tell_conflicting'), 'conflicting ',
      sw('t-cannot_tell_data_gap'), 'data gap'),
    h('a', { href: withData('/growth-test-site/desk/methods.html#ratings') }, 'Full key'));
}
/** The grid paints its cells with D3's scales; the overview loads the vendored copy only when the grid is first asked for. */
function loadD3() {
  if (/** @type {any} */ (window).d3) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script'); s.src = '/growth-test-site/desk/vendor/d3-7.9.0.min.js';
    s.onload = () => resolve(undefined); s.onerror = () => reject(new Error('D3 did not load')); document.head.append(s);
  });
}
/** B5: Tree or Grid; the grid (the heat map and its conclusions column) loads the first time it is asked for. */
function renderOverviewMap() {
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Show the areas as' },
    ...[['tree', 'Tree'], ['grid', 'Grid']].map(([k, label]) => h('button', { type: 'button', class: 'seg-btn', 'data-ov': k, 'aria-pressed': state.ovView === k ? 'true' : 'false',
      onclick: () => { state.ovView = k; renderOverviewMap(); } }, label)));
  const map = overviewMap({ registry: state.registry, nodes: state.view.nodes, overrides: state.overrides, href: (id) => areaHref(iso, id), describe: describeArea });
  const grid = state.ovView === 'grid';
  $('ctree-host').replaceChildren(h('div', { class: 'ov-map-head' }, h('p', { class: 'ov-map-title' }, grid ? 'The grid, below' : 'The tree'), seg),
    h('p', { class: 'ov-changed', role: 'status', 'aria-live': 'polite' }, state.changedText || ''),
    grid ? h('p', { class: 'small muted' }, 'Each area’s benchmarking and four tests, with its rating and your own conclusion, are in the grid below the answer.')
      : map, grid ? '' : overviewKey());
  const sec = $('ov-grid-sec'); sec.hidden = !grid;
  if (grid) {
    loadD3().then(() => import('./summary.mjs')).then((m) => {
      if (!$('ov-grid').childElementCount) {
        m.mountGrid($('ov-grid'), { iso, registry: state.registry, scorecard: state.scorecard, countries: state.countries, overrides: state.overrides,
          set: state.activeSet, onChange: (ovs) => { state.overrides = ovs; writeState(state); renderAll(); refreshNav(); } });
      } else m.redrawGrid(state.overrides);
    }).catch((e) => showError(`Could not draw the grid: ${e.message}`));
  }
}

/** The compact tree (V4): a rating surface, untouched by motion; the key folds (D2), the squares do not. */
function renderCompactTree() {
  if (REDESIGN) { renderOverviewMap(); return; }
  $('ctree-host').replaceChildren(
    compactTree({ registry: state.registry, nodes: state.view.nodes, overrides: state.overrides, href: (id) => areaHref(iso, id) }),
    fold('Key', h('p', { class: 'ctree-key' }, 'One square per area in the order of the decision tree, colored by its rating; an arrow on a ' +
      'gray square is its lean, toward (↑) or away from (↓) a problem. Hover for the name; click for the evidence. No total.')));
}

// ---------- the three lists (the same bottomLine() as country.mjs; reasons, comparison countries and dissent stay visible, D3) ----------
function areaLink(id, label, cls = '') {
  const a = h('a', { href: areaHref(iso, id), class: cls || null }, label);
  a.addEventListener('click', () => { a.href = areaHref(iso, id); });
  return a;
}
function joinEls(parts) {
  const out = [];
  parts.forEach((p, i) => { if (i) out.push(i === parts.length - 1 ? (parts.length > 2 ? ', and ' : ' and ') : ', '); out.push(...[p].flat()); });
  return out;
}
/** A <gt-fold> disclosure: the summary stays, the body folds (D2); animated by motion.mjs, instant under reduced motion. */
function fold(label, ...body) {
  return h('gt-fold', {}, h('details', { class: 'k-fold' }, h('summary', { class: 'gt-fold-sum' }, label), h('div', { class: 'gt-fold-body' }, ...body)));
}
function renderLists() {
  const bl = bottomLine(plainCtx());
  const c = state.scorecard.country.name;
  const body = $('statements-body'); body.replaceChildren();
  // the first decision, above the lists: a direction at the root's fork, never a rating (FORK_WORDS in common.mjs)
  $('k-fork').replaceChildren(h('strong', {}, 'First decision. '), forkSentence(bl, c, (state.scorecard.top_split || {}).row), ' ', areaLink('N0', 'Why? →', 'bl-why'));
  const ovMark = (id) => (state.overrides[id] ? h('span', { class: 'bl-ov' }, `your override: ${plainTierOf(id, state.overrides[id].tier).toLowerCase()}`) : null);
  const line = (x, text, grade) => h('li', {},
    h('span', { class: 'bl-area' }, REDESIGN ? pictogram(x.id) : null, areaLink(x.id, cap(itemName(x)))), grade ? h('span', { class: 'bl-grade' }, grade) : null,
    robustChip(x.node),
    h('span', {}, text), ovMark(x.id));
  const names = (items) => joinEls(items.map((x) => [areaLink(x.id, x.short), ovMark(x.id)].filter(Boolean)));
  const list = (cls, title, sub) => h('section', { class: `bl-list k-list ${cls}` }, h('h2', {}, title), sub ? h('p', { class: 'bl-sub' }, sub) : null);

  // the overview names the lists as the three answers (G1) and puts the flagged areas first, strongest evidence first (B4)
  const s1 = list('bl-stop', REDESIGN ? 'The data argue against it' : 'Stop arguing about', null);
  const stops = [...bl.ruled.map((x) => ({ x, grade: 'Ruled out' })), ...bl.probNot.map((x) => ({ x, grade: 'Probably not' }))];
  if (stops.length) {
    s1.append(h('ul', {}, stops.map(({ x, grade }) => line(x, `${x.away ? `${cap(x.away.text)}.` : 'Most measures point away from a problem.'}` +
      `${x.counter ? ` But ${x.counter.text}.` : ''}`, grade))));
    if (bl.probNot.length) s1.append(h('p', { class: 'bl-note' }, '“Probably not” is weaker than “ruled out”: do not drop a program on it alone.'));
  } else {
    s1.append(h('p', { class: 'bl-none' }, h('strong', {}, `Nothing yet for ${c}.`), ` ${shareText()}`));
    const away = bl.awayLeans.slice(0, 3);
    if (away.length) s1.append(h('p', { class: 'bl-note' }, 'Leaning away, below the bar (not a verdict): ', ...joinEls(away.map((x) => [areaLink(x.id, x.short)])), '.'));
  }

  const s2 = REDESIGN ? list('bl-look', 'Worth a closer look', 'Strongest evidence first: the most tests agreeing, then the net score.')
    : list('bl-look', 'Look closer', 'Not established: confirm in-country first.');
  const firm = (x) => (x.node.robustness && x.node.robustness.mark === 'holds' ? 0 : 1);
  const look = REDESIGN ? strongestFirst(bl.look) : bl.look.slice().sort((a, b) => firm(a) - firm(b) || (b.node.N ?? 0) - (a.node.N ?? 0));
  if (look.length) {
    s2.append(h('ul', {}, look.map((x) => line(x, x.facts.length ? `${cap(x.facts[0].text)}.` : 'See the evidence card.', x.node.tier === 'likely_binding' ? 'Likely' : null))));
  } else {
    s2.append(h('p', { class: 'bl-none' }, h('strong', {}, `No area stands out for ${c} yet.`)));
    const toward = bl.towardLeans.slice(0, 3);
    if (toward.length) s2.append(h('p', { class: 'bl-note' }, 'Leaning toward a problem, below the bar (not a verdict): ', ...joinEls(toward.map((x) => [areaLink(x.id, x.short)])), '.'));
  }

  const s3 = list('bl-unclear', REDESIGN ? 'Unclear' : 'Can’t settle yet', REDESIGN ? 'Each with its kind and what would settle it.' : null);
  if (!bl.nUnclear) s3.append(h('p', { class: 'bl-none' }, 'Nothing: every area has a rating.'));
  else {
    const g = bl.groups;
    const grp = (items, label, next) => (items.length ? h('li', {}, h('span', { class: 'bl-reason' }, `${label} (${items.length})`), h('span', {}, ...names(items), '. '),
      h('span', { class: 'bl-next' }, next)) : null);
    const elim = g.elimination.map((x) => (x.node.elimination && x.node.elimination.direction !== 'none' ? ` Today it leans ${x.node.elimination.direction === 'toward' ?
      'toward' : 'away from'} a problem.` : '')).join('');
    s3.append(h('ul', {},
      grp(g.oneKind, 'Only one kind of evidence', `Next: a second kind of evidence (a price, a response to change, or firms working around it) would settle it.` +
        `${bl.closest ? ` Of these, ${bl.closest.short} comes nearest to a rating (it leans ${bl.closest.node.N > 0 ? 'toward' : 'away from'} a problem).` : ''}`),
      grp(g.mixed, 'Evidence points both ways', 'Next: check whether it binds for some sectors or regions only.'),
      grp(g.dataGap, `Too little recent data for ${c}`, 'Next: a newer survey or data year would settle it.'),
      grp(g.toolGap, 'Not connected to the tool yet', `Next: a new measure in the tool; no data for ${c} changes it today.`),
      grp(g.sector, 'Needs a sector study', 'Next: sector work.'),
      g.elimination.length ? h('li', {}, h('span', { class: 'bl-reason' }, `Judged by elimination (${g.elimination.length})`), h('span', {}, ...names(g.elimination), '. '),
        h('span', { class: 'bl-next' }, `Self-discovery asks whether firms are held back from trying new products. Next: rule out the other causes of low returns first.${elim} `),
        h('a', { href: areaHref(iso, 'N12') }, 'Read more →')) : null));
    if (bl.firmsTop) {
      const r = bl.firmsTop.r; const m = String(r.name || '').match(/choosing (.+?) as their biggest obstacle/i);
      const what = m ? m[1] : shortName(r).toLowerCase();
      s3.append(h('p', { class: 'bl-note' }, `Firms rank ${what} as their biggest obstacle (${fmt(r.value_ref, 0)}% name it first, ${refSpan(r)}). Complaints alone ` +
        `cannot establish a constraint${bl.firmsTop.toolGap ? ', and the tool has no measure of its cost yet' : ''}, so it is not rated.`));
    }
  }
  if (REDESIGN) body.append(s2, s1, s3); else body.append(s1, s2, s3);
  if (state.view.note) body.append(h('p', { class: 'note' }, state.view.note));
  // explanation folds outside the lists (tenet 6: motion.mjs refuses a fold inside .bl-list, a rating surface)
  $('lists-help').replaceChildren(look.length ? fold('What the tag beside an area means', h('p', { class: 'small muted' }, 'It says whether the area stays on ' +
    'its list under all three readings in the top bar (Cautious, Standard, Exploratory); tap it to see each reading’s rating.')) : '');
}
function shareText() {
  const ix = state.index; if (!ix || !Array.isArray(ix.countries) || !ix.countries.length) return '';
  const none = ix.countries.filter((c) => !Object.entries(c.tiers || {}).some(([id, t]) => !/^N11\./.test(id) && id !== 'N0' && (t === 'ruled_out' || t === 'probably_not'))).length;
  const k = Math.round((none / ix.countries.length) * 10);
  return k >= 3 ? `This is common: about ${k} in 10 countries have nothing on this list. ` : '';
}
function renderOverrides() {
  const box = $('overrides-box'); box.replaceChildren();
  const ovs = Object.entries(state.overrides);
  if (!ovs.length) return;
  const ul = h('ul', { class: 'diff-list' });
  for (const [id, v] of ovs) {
    const n = nodeOf(id);
    ul.append(h('li', {}, h('strong', {}, `${nodeCode(id)} ${short(id)}`), h('span', { class: `tier-badge ${tierClass(n && n.tier)}` }, h('span', {}, `tool: ${plainTierOf(id, n && n.tier)}`)),
      h('span', { class: 'arrow' }, '→'), h('span', { class: `tier-badge ${tierClass(v.tier)}` }, h('span', {}, `you: ${plainTierOf(id, v.tier)}`)), h('span', { class: 'muted' }, v.note),
      areaLink(id, 'Edit', 'btn quiet small'),
      h('button', { class: 'btn quiet small', type: 'button', onclick: () => { delete state.overrides[id]; writeState(state); renderAll(); refreshNav(); } }, 'Remove')));
  }
  box.append(h('div', { class: 'note alert' }, h('strong', {}, 'Your overrides'), ' (your judgment beside the tool’s; in this page’s URL, so the link reproduces them)', ul));
}

/** L2: which of the overview's sections are open by default; nothing else changes with the detail. */
function applyDetail() {
  const analyst = currentDetail() === 'analyst';
  for (const id of ['growth-fold', 'analysts-fold', 'areas-fold']) { const d = /** @type {HTMLDetailsElement | null} */ ($(id)); if (d) d.open = analyst; }
  const a = /** @type {HTMLDetailsElement | null} */ (document.getElementById('assume')); if (a) a.open = analyst;
}

// ---------- the growth question (moved from the retired Areas page, step 3), folded under the overview ----------
function renderGrowth() {
  const sc = state.scorecard; const g = sc.growth_problem || {}; const gn = gNorm(g); const c = sc.country.name;
  const stmt = String(g.statement || '');
  // lead with the question the statement ends on; the top-split reading moves to the analyst panel
  const qm = stmt.match(/The relevant question is therefore:\s*([^.?]*)[.?]/);
  // the Bottom line drops the analyst's qualifier ("when the growth record shows no dominant pattern"); Areas keeps it
  const q = qm ? qm[1].trim() : '';
  $('growth-question').textContent = q ? `The question for ${c}: ${q}?` : '';
  const cleaned = stmt.replace(/\s*Provisional top-split reading:[^()]*(\([^)]*\))?\.?/g, '').trim();
  $('growth-statement').textContent = cleaned || 'No growth problem statement in the file.';
  const read = growthChecks(g, state.registry.params.growth_problem);
  // the year's story, drafted by AI and checked in code, when there is one; else the record from the data alone
  const story = growthStory(state.narrative, sc.meta.snapshot_id);
  $('growth-story').replaceChildren(...(story ? [story] : []));
  $('growth-pattern').replaceChildren(patternChecks(read));
  const series = sc.series || {};
  $('growth-key').replaceChildren(growthChart($('growth-chart'), { level: series['NY.GDP.PCAP.KD'] || [], growth: series['NY.GDP.PCAP.KD.ZG'] || [], g, name: c }));
  $('growth-income').replaceChildren(incomeStrip(incomeRows(g)));
  const { g1, g2, g3, g5, g6, g7, g10, g11, g12 } = gn;
  const cell = (lab, val, sub, na) => h('div', { class: 'stat' }, h('span', { class: 'lab' }, lab), h('span', { class: `val num${na ? ' na' : ''}` }, val), sub ? h('span', { class: 'sub' }, sub) : null);
  const w10 = (g.G1 && g.G1.window_10y) || null;
  const w20 = (g.G1 && g.G1.window_20y) || null;
  const eras = (g.G4 && Array.isArray(g.G4.eras) ? g.G4.eras : []).filter((e) => e && e.mean != null); // rubric 0.3.0
  $('g-grid').replaceChildren(
    cell(`G1 · growth, 10-year avg${w10 ? ` (${w10[0]}–${w10[1]})` : ''}`, g1.avg10 != null ? `${fmt(g1.avg10, 2)}%` : '—', `20-year${w20 ? ` (${w20[0]}–${w20[1]})` : ''} ${fmt(g1.avg20, 2)}% · peers ${fmt(g1.peers10, 2)}% · region ${fmt(g1.region10, 2)}%${g1.years10 && w10 && (g1.years10[0] !== w10[0] || g1.years10[1] !== w10[1]) ? ` · observed ${g1.years10[0]}–${g1.years10[1]}` : ''}`),
    cell('G1 · rank among structural peers', g1.rank != null ? `${g1.rank} of ${g1.n}` : '—', 'by 10-year average growth'),
    cell('G2 · convergence residual', fmtSigned(g2.t, 2), `t · Huber, region dummies${g2.n ? ` · n ${g2.n}` : ''}`),
    cell('G3 · peak year', g3.peakYear ?? '—', g3.yearsSince != null ? `${g3.yearsSince} years ago · ${fmt(g3.shortfall, 1)}% below peak` : ''),
    cell(`G4 · eras since ${eras.length ? eras[0].from : 1990}`, eras.length ? String(eras.length) : 'none',
      eras.map((e) => `${e.from}–${e.to} ${fmt(e.mean, 1)}%`).join(' · '), !eras.length),
    cell('G5 · volatility (s.d., 20y)', fmt(g5.sd, 2), `peers median ${fmt(g5.peers, 2)} · universe pct ${g5.pct == null ? '—' : Math.round(g5.pct)}`),
    cell('G6 · investment residual', fmtSigned(g6.t, 2), `GFCF ${fmt(g6.value, 1)}% of GDP (${g6.year != null ? `${g6.year - 2}–${String(g6.year).slice(2)} average` : '—'}) · private split unavailable`),
    cell('G7 · savings residual', fmtSigned(g7.savings.t, 2), `savings ${fmt(g7.savings.value, 1)}% · CAB ${fmtSigned(g7.cab.value, 1)}% · FDI ${fmt(g7.fdi.value, 1)}%`),
  );
  $('g-context').textContent = `Context — G10 exports residual t ${fmtSigned(g10.exports.t, 2)}, complexity (ECI) residual t ${g10.eci.t == null ? 'not available' : fmtSigned(g10.eci.t, 2)}; G11 unemployment ${fmt(g11.value, 1)}% (t ${fmtSigned(g11.t, 2)}); G12 population ${fmtInt(g12.population)}, urban ${fmt(g12.urban_share, 1)}%, resource rents ${fmt(g12.resource_rents, 1)}% of GDP, ${g12.landlocked ? 'landlocked' : 'coastal'}.`;
}


// ---------- for analysts (moved from the retired Areas page, step 3): comparison countries, ranking stability, provenance ----------
/** Open the analysts' fold at the comparison countries (the assumptions line's "Change the comparison countries" lands here). */
function openComparators() {
  const f = /** @type {HTMLDetailsElement | null} */ ($('analysts-fold')); if (f) f.open = true;
  const s = $('comparators'); if (s) s.scrollIntoView({ block: 'start' });
}
const ordinalWord = (k) => { const v = k % 100; const s = ['th', 'st', 'nd', 'rd']; return `${k}${s[(v - 20) % 10] || s[v] || s[0]}`; };
const snapYearOf = () => snapshotYear();
function renderComparatorsPanel() {
  renderComparators($('comparators-body'), {
    scorecard: state.scorecard, baseline: state.scorecard.nodes, view: state.view, activeSet: state.activeSet, peers: state.peers, countries: state.countries,
    engineStatus: { ok: !!state.engine, message: state.engine ? '' : 'the engine module could not be imported, so an edited list cannot be recomputed here.' },
    lastRecompute: '', minPeers: state.registry.params.peer_gap.min_peers_with_data, nodeShort: short,
    onSwitch: async (set) => { state.activeSet = set; state.peers = null; await applyComparators(state); renderAll(); refreshNav(); },
    onPeers: async (list) => { state.peers = list; await applyComparators(state); renderAll(); refreshNav(); },
    onReset: async () => {
      state.activeSet = state.scorecard.meta.active_comparator_set || 'structural'; state.peers = null; await applyComparators(state); renderAll(); refreshNav();
    },
  });
}
function renderRanking() {
  const rk = state.view.ranking || {}; const body = $('ranking-body'); body.replaceChildren();
  const p = state.registry.params.ranking;
  const draws = rk.bootstrap_draws || p.bootstrap_draws;
  const pTop = rk[`p_top${p.top_k}`] || rk.p_top3 || {};
  $('ranking-sub').textContent = `Ordered by score. Stability comes from ${draws} re-runs that drop some measures (keeping ${Math.round(p.bootstrap_subset_share * 100)}%), swap the comparison sets and move the thresholds by up to ±${Math.round(p.threshold_perturbation * 100)}%. This measures how stable the order is, not the chance that an area is the binding constraint.`;
  if (!(rk.ordered || []).length) { body.append(h('p', { class: 'note' }, 'No area reaches ‘worth a closer look’ under the active comparison countries, so there is nothing to order.')); }
  else {
    const notResampled = new Set(rk.not_resampled || []);
    const tbl = h('table', { class: 'data rank-table' }, h('thead', {}, h('tr', {}, h('th', { class: 'num' }, '#'), h('th', {}, 'Area'), h('th', {}, 'Rating'), h('th', { class: 'num col-score' }, 'Score N × breadth'), h('th', {}, `How often in the top ${p.top_k}`))));
    const tb = h('tbody');
    rk.ordered.forEach((id, i) => {
      const n = nodeOf(id);
      const nr = notResampled.has(id);
      const pv = pTop[id]; const mr = (rk.modal_rank || {})[id];
      const pTxt = pv == null ? '—' : pv >= 0.995 ? `in all ${draws} re-runs` : pv <= 0.005 ? 'in none of the re-runs' : `in ${Math.round(pv * 100)}% of ${draws} re-runs`;
      tb.append(h('tr', {},
        h('td', { class: 'num' }, String(i + 1)),
        h('td', { class: 'node-cell' }, h('button', { class: 'btn quiet small', type: 'button', onclick: () => { location.href = areaHref(iso, id); } }, `${nodeCode(id)} ${short(id)}`), n && n.sub_nodes ? h('span', { class: 'sub' }, `roll-up of ${n.sub_nodes.length} sub-areas${n.rollup_from ? `, rated through ${short(n.rollup_from).toLowerCase()}` : ''}`) : null, h('span', { class: 'sub' }, `N ${fmtSigned(n && n.N)}`)),
        h('td', {}, h('span', { class: `tier-badge ${tierClass(n && n.tier)}` }, h('span', {}, plainTierOf(id, n && n.tier)))),
        h('td', { class: 'num col-score' }, fmt((rk.scores || {})[id], 2)),
        h('td', { title: nr ? 'not resampled: at most 3 families that count, so family subsets are not drawn; comparator sets and thresholds still vary' : `P(top ${p.top_k}) = ${fmt(pv, 2)}` }, `${pTxt}${mr != null ? ` (most often ${ordinalWord(mr)})` : ''}${nr ? '*' : ''}`)));
    });
    tbl.append(tb);
    body.append(h('div', { class: 'table-wrap' }, tbl));
    if ([...notResampled].some((id) => rk.ordered.includes(id))) body.append(h('p', { class: 'small muted', style: 'margin-top:6px' }, '* Not resampled: the area has at most 3 measures that count, so the re-runs keep them all and vary only the comparison set and the thresholds.'));
  }
  if (rk.too_many_likely_binding) body.append(h('p', { class: 'note alert' }, `More than ${p.max_likely_binding_before_flag} areas are rated likely: the protocol flags this and asks the team to revisit the growth question and the comparison sets.`));
  const others = Object.entries(pTop).filter(([id, v]) => v > 0 && !(rk.ordered || []).includes(id)).sort((a, b) => b[1] - a[1]);
  if (others.length) body.append(h('p', { class: 'small muted', style: 'margin-top:10px' }, `Not ordered today but in the top ${p.top_k} in some re-runs: ${others.map(([id, v]) => `${short(id)} (${Math.round(v * 100)}%)`).join(', ')}.`));
  const sens = state.view.sensitivity || state.scorecard.sensitivity || {};
  const lb = sens.load_bearing_families || [];
  if (lb.length) body.append(h('p', { class: 'small muted', style: 'margin-top:6px' }, `Measures a rating depends on (removing one changes it${state.view.setKey === 'custom' ? '; under your edited set' : ''}): ${lb.map((x) => (x.family ? `${x.family.replace(/_/g, ' ')} (${(x.nodes || []).join(', ')})` : `${x.family || x} (${x.node || ''})`)).join('; ')}.`));
}

function renderProvenance() {
  const sc = state.scorecard; const m = sc.meta; const reg = state.registry; const limit = reg.params.recency.staleness_limit_years; const sy = snapYearOf();
  $('provenance-sub').textContent = `Snapshot ${m.snapshot_id}, generated ${m.generated_at || '—'}; rubric ${m.rubric_version}; engine ${m.engine_version}; reference window ${m.reference_window_years || reg.params.snapshot_reference_window_years} years; staleness limit ${limit} years; ${sc.indicators.filter((r) => r.value_ref != null).length} of ${sc.indicators.length} registry indicators have a reference value for ${sc.country.name}. A reference value is the mean of the latest three years in the window where they exist; the year column shows the span.`;
  const body = $('provenance-body'); body.replaceChildren();
  const filter = h('input', { type: 'search', id: 'prov-filter', placeholder: 'Filter by name, id, node or class', 'aria-label': 'Filter indicators', size: '36' });
  body.append(h('div', { class: 'controls', style: 'margin-bottom:10px' }, h('div', { class: 'field' }, h('label', { for: 'prov-filter' }, 'Filter'), filter)));
  const order = { A: 0, B: 1, C: 2, D: 3, X: 4 };
  const rows = sc.indicators.slice().sort((a, b) => (order[a.class] - order[b.class]) || ((a.value_ref == null) - (b.value_ref == null)) || a.id.localeCompare(b.id));
  const tbl = h('table', { class: 'data' }, h('thead', {}, h('tr', {}, h('th', {}, 'Indicator'), h('th', { class: 'num' }, 'Value'), h('th', { class: 'num' }, 'Years'), h('th', {}, 'Source'), h('th', {}, 'Class · test'), h('th', {}, 'Nodes'), h('th', {}, 'Flags'))));
  const tb = h('tbody');
  const draw = () => {
    const q = filter.value.trim().toLowerCase(); tb.replaceChildren();
    for (const r of rows) {
      const hay = `${r.name} ${r.id} ${(r.nodes || []).join(' ')} ${r.class} ${r.family} ${r.source}`.toLowerCase();
      if (q && !hay.includes(q)) continue;
      const flags = [];
      const regInd = reg.indicatorById[r.id] || {};
      const formula = r.formula || regInd.formula || null;
      if (r.value_ref == null && r.stale_year != null) flags.push(h('span', { class: 'flag warn' }, `outside window: newest ${r.stale_year}`));
      else if (r.value_ref == null) flags.push(h('span', { class: 'flag' }, r.source === 'derived' && /unavailable/.test(String(formula || '')) ? 'not available yet' : 'no data in window'));
      else if (isStale(r.year_ref, sy, limit)) flags.push(h('span', { class: 'flag warn' }, `stale: ${sy - r.year_ref} years`));
      if (r.recency_mult != null && r.recency_mult < 1 && r.value_ref != null && r.class !== 'X') flags.push(h('span', { class: 'flag' }, `recency × ${r.recency_mult}`));
      if (r.n_ref != null && r.n_ref > 1) flags.push(h('span', { class: 'flag' }, `${r.n_ref}-year mean`));
      if (r.suppressed) flags.push(h('span', { class: 'flag', title: r.suppressed_note || '' }, `fallback, not scored (${r.fallback_for} available)`));
      if (r.class_note) flags.push(h('span', { class: 'flag warn', title: r.class_note }, `class ${r.class} here (registry ${r.class_registry}): no independent monetary policy`));
      const link = sourceLink(r);
      const multi = r.value_ref != null && r.n_ref != null && r.n_ref > 1;
      tb.append(h('tr', { style: r.value_ref == null ? 'color:var(--muted)' : '' },
        h('td', {}, shortName(r), h('span', { class: 'sub mono' }, r.id)),
        h('td', { class: 'num' }, r.value_ref != null ? `${fmtValue(r, r.value_ref)} ` : r.stale_value != null ? `${fmtValue(r, r.stale_value)} ` : '—', h('span', { class: 'muted small' }, r.value_ref != null || r.stale_value != null ? unitHint(r) : ''), multi ? h('span', { class: 'sub' }, `mean ${refSpan(r)}${r.value != null && r.value !== r.value_ref ? `; ${r.year_ref} alone ${fmtValue(r, r.value)}` : ''}`) : null),
        h('td', { class: 'num' }, r.value_ref != null ? refSpan(r) : r.stale_year != null ? String(r.stale_year) : '—'),
        h('td', {}, link ? h('a', { href: link, target: '_blank', rel: 'noopener' }, sourceLabel(r)) : sourceLabel(r), formula ? h('span', { class: 'sub mono' }, formula) : null),
        h('td', {}, `${r.class} · ${r.test}`),
        h('td', {}, (r.nodes || []).join(' ') || h('span', { class: 'muted' }, 'context')),
        h('td', {}, flags)));
    }
  };
  draw(); filter.addEventListener('input', draw);
  tbl.append(tb); body.append(h('div', { class: 'table-wrap', style: 'max-height:560px;overflow:auto' }, tbl));
  // the kinds of "cannot tell: data gap", registry statements listed apart from true data gaps
  const gapNodes = state.scorecard.nodes.filter((n) => n.tier === 'cannot_tell_data_gap');
  const note = h('div', { class: 'note', style: 'margin-top:16px' });
  const eBelow = String(reg.params.tiers.cannot_tell_data_gap.E_below);
  note.append(h('p', {}, h('strong', {}, `Six kinds of "unclear: data gap" (rubric ${m.rubric_version}).`), ' Two are about this economy: ', h('em', {}, 'data gap'), ` (fewer than ${eBelow} families that count with data in the window, or one for self-discovery, which carries its own floor; or no class A/B family) and `, h('em', {}, 'evidence too old'), ` (the newest class A/B family is older than ${limit} years). Four are statements about the registry, which no amount of data for this economy can change: `, h('em', {}, 'connector not built'), ' (no family computed for the node at all), ', h('em', {}, 'no class A/B evidence in registry'), ' (only class C/D indicators are assigned to the node), ', h('em', {}, 'no class A/B price in registry'), ' (the price test is never observed, so the quantities are shown only), and ', h('em', {}, 'registry coverage'), ` (the registry cannot supply ${eBelow} families that count for the node). Quantities on the price test never count under rubric 0.1.2; they are shown on the cards as shown only.`));
  const econGaps = gapNodes.filter((n) => !isRegistryGap(n.tier_subreason));
  const regGaps = gapNodes.filter((n) => isRegistryGap(n.tier_subreason));
  if (econGaps.length) note.append(h('p', {}, h('strong', {}, 'Data gaps for this economy: '), econGaps.map((n, i) => h('span', {}, i ? '; ' : '', `${nodeCode(n.id)} ${short(n.id)}`, ` — ${reasonClause(n)}`)), '.'));
  if (regGaps.length) {
    const byKind = {};
    for (const n of regGaps) (byKind[n.tier_subreason] = byKind[n.tier_subreason] || []).push(n);
    note.append(h('p', {}, h('strong', {}, 'Registry statements (not data gaps): '), Object.entries(byKind).map(([k, ns], i) => h('span', {}, i ? '; ' : '', h('em', {}, (DATA_GAP_KINDS[k] || {}).label || k), ': ', ns.map((n) => `${nodeCode(n.id)} ${short(n.id)}`).join(', '))), '.'));
  }
  const ul = h('ul', { class: 'small', style: 'margin:6px 0 0' });
  for (const f of reg.connectorsNotBuilt) ul.append(h('li', {}, h('strong', {}, f.family), ` (Class ${f.class}) → ${f.nodes.map((id) => `${nodeCode(id)} ${short(id)}`).join(', ')}: ${f.source}`));
  note.append(h('p', { style: 'margin-top:8px' }, 'Connectors not built in rubric ', m.rubric_version, ':'), ul);
  body.append(note);
}


// ---------- the area cards (D8): the plain sentence first; reasons, what would move it and the field questions fold ----------
function renderCards() {
  const ctx = plainCtx();
  const body = $('cards-body'); body.replaceChildren();
  for (const id of STRIP_AREAS) {
    const n = nodeOf(id); if (!n) continue;
    const ev = evidenceNode(n, state.view.nodes);
    const ov = state.overrides[id];
    const why = whyNotLines(n);
    const moves = whatWouldMove(n, ctx);
    const qs = fieldQuestions(n, state.view.nodes);
    const card = h('article', { class: 'gt-card k-card elev-1', 'data-node': id }, // not data-area: the card's folds may move, its badge may not
      h('div', { class: 'k-card-head' },
        h('h3', {}, areaLink(id, short(id).replace(/\?$/, ''))),
        h('span', { class: `tier-badge ${tierClass(n.tier)}` }, h('span', {}, plainTierOf(id, n.tier))), reasonTag(ev), robustChip(n),
        ov ? h('span', { class: 'small' }, '→ you: ', h('span', { class: `tier-badge ${tierClass(ov.tier)}` }, h('span', {}, plainTierOf(id, ov.tier)))) : null),
      h('p', { class: 'k-card-plain' }, plainSummary(n, ctx, { brief: true })));
    const sub = (title, el) => (el ? [h('h4', { class: 'k-card-h' }, title), el] : []);
    const a = ratingAnatomy(ev, state.registry, { snapshotYear: snapshotYear(), byId: ctx.byId, set: ctx.setKey, fallbackSet: state.activeSet,
      setting: state.view.setting || 'standard', comovement: state.scorecard.comovement || [] });
    const of = ev !== n ? short(ev.id).replace(/\?$/, '').toLowerCase() : '';
    const parts = [...sub('How it adds up', tally(a, { fork: id === 'N0', of, missing: (t) => MISSING_TEST_LABEL[missingTestKind(t, ev.id, state.registry)] })),
      ...sub('Why not higher, why not lower', why),
      ...sub('What would move the rating', moves.length ? h('ul', { class: 'k-card-list' }, moves.map((x) => h('li', {}, x))) : null),
      ...sub('Two days in-country', qs.length ? h('ul', { class: 'k-card-list' }, qs.map((x) => h('li', {}, x))) : null)];
    // a plain <details>, not <gt-fold>: the tally inside is a rating surface, and nothing slides a rating into view (tenet 6)
    if (parts.length) card.append(h('details', { class: 'k-fold' }, h('summary', { class: 'gt-fold-sum' }, 'More'), h('div', { class: 'gt-fold-body' }, ...parts)));
    body.append(card);
  }
}

// ---------- TNFA's view (W8), labeled and apart; its four points fold under the heading (D2) ----------
function renderAssistance() {
  const box = $('assistance-box'); box.replaceChildren();
  const c = state.scorecard.country.name;
  if ((state.scorecard.country.income_group || '') === 'High income') return;
  const bl = bottomLine(plainCtx());
  const list = (items) => englishList(items.map((x) => x.short));
  const stops = [...bl.ruled, ...bl.probNot]; const g = bl.groups;
  const firstGap = g.dataGap.length ? 'measure what is missing for this country first' : g.oneKind.length ? `find a second kind of evidence on ${list(g.oneKind.slice(0, 2))}` : 'start with a field visit';
  box.append(
    h('span', { class: 'kicker' }, 'The New Foreign Assistance’s view · not part of any rating'),
    h('h2', {}, 'What this means for U.S. assistance'),
    fold('Read it',
      h('ul', {},
        h('li', {}, h('strong', {}, 'Choose before spending. '), stops.length ? `Programs aimed at ${list(stops)} need new evidence first: the public data argue against ` +
          `${stops.length === 1 ? 'it' : 'them'} as what holds investment back here.` : `Nothing can be ruled out for ${c} yet, so no area should be assumed not to matter.`),
        h('li', {}, h('strong', {}, 'Look first where the evidence points. '), bl.look.length ? `The public data point first to ${list(bl.look.map((x) => (x.ev !== x.node ?
          { short: x.evShort } : x)))}, which is not established. Check it with ${c}’s government, firms and researchers before anything is designed.`
          : `No area stands out, so the first step is to ${firstGap}.`),
        h('li', {}, h('strong', {}, 'Measure what can’t be settled. '), 'The cheapest next step is often to collect the missing evidence. Each “can’t settle” line above says what that is.'),
        h('li', {}, h('strong', {}, 'Fix what binds, or little changes. '), `Programs that ignore what actually holds growth back in ${c} are unlikely to reduce poverty for long. ` +
          'A reform that leaves the binding constraint in place does little for growth, however sound it is on its own (Hausmann, Rodrik and Velasco, 2005).')),
      h('p', { class: 'small' }, h('a', { href: withData('/growth-test-site/desk/methods.html#mcc') }, 'Why this way of choosing →'), ' ',
        h('a', { href: 'https://thenewforeignassistance.org', target: '_blank', rel: 'noopener', onclick: () => announce('outbound_tnfa') },
          'About The New Foreign Assistance →'))));
}

// ---------- take it further: the memo, the link, and the idea briefing for the reader's own AI (explanation folded, D2) ----------
function memoText() {
  return buildMemo({ scorecard: state.scorecard, view: state.view, registry: state.registry, overrides: state.overrides, activeSet: state.activeSet, peers: state.peers,
    narrative: state.narrative, fcs: state.fcs, countries: state.countries, plain: plainCtx(), setting: state.setting });
}
function renderTools() {
  const body = $('tools-body'); body.replaceChildren();
  const status = h('span', { class: 'small muted', 'aria-live': 'polite' }, '');
  const flash = (msg) => { status.textContent = msg; setTimeout(() => { status.textContent = ''; }, 3000); };
  const title = () => `The Growth Test memo: ${state.scorecard.country.name}`;
  const copyRich = async () => {
    const md = memoText(); const html = memoHTML(md, { title: title() });
    try {
      if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html.body], { type: 'text/html' }), 'text/plain': new Blob([md], { type: 'text/plain' }) })]);
        return 'Copied with formatting: paste into an email or Word.';
      }
      await navigator.clipboard.writeText(md); return 'Copied as plain text.';
    } catch { return 'The browser blocked the clipboard; download the text file instead.'; }
  };
  const print = () => {
    const html = memoHTML(memoText(), { title: title() });
    const w = window.open('', '_blank'); if (!w) return 'The browser blocked the print window; allow pop-ups, or download the file.';
    w.document.open(); w.document.write(html.page); w.document.close(); w.focus(); setTimeout(() => { try { w.print(); } catch { /* the reader can print */ } }, 250);
    return 'Opened the memo for printing.';
  };
  const icon = (name) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'icon lg'); s.setAttribute('aria-hidden', 'true');
    const u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', `/growth-test-site/desk/img/icons.svg#${name}`); s.append(u); return s; };
  const memo = h('div', { class: 'gt-entry elev-1 k-tool' }, icon('book'), h('strong', {}, 'The memo'),
    h('span', { class: 'small muted' }, 'This page as a document.'),
    h('div', { class: 'k-tool-row' },
      h('button', { class: 'btn primary small', type: 'button', onclick: () => copyRich().then(flash), title: 'Copied with formatting, for an email or Word' }, 'Copy for email'),
      h('button', { class: 'btn small', type: 'button', onclick: () => flash(print()) }, 'Print or PDF'),
      h('button', { class: 'btn quiet small', type: 'button', onclick: () => downloadText(`${iso}-memo.md`, memoText()) }, 'Download .md'),
      h('button', { class: 'btn quiet small', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(location.href); flash('Link copied.'); } catch { flash(location.href); } } },
        'Copy link')),
    status);
  const titleIn = h('input', { type: 'text', id: 'idea-title', placeholder: 'For example: Rural mini-grid program', autocomplete: 'off' });
  const ideaIn = h('textarea', { id: 'idea-text', placeholder: 'What it does, for whom and where; roughly how big; how it is meant to raise private investment or growth.' });
  const make = () => buildBriefing({ idea: ideaIn.value, title: titleIn.value, memo: memoText(), view: state.view, scorecard: state.scorecard, registry: state.registry,
    activeSet: state.activeSet, setting: state.setting, pageUrl: location.href.split('#')[0] });
  const ready = () => { if (ideaIn.value.trim()) return true; flash('Describe the idea first.'); ideaIn.focus(); return false; };
  const idea = h('div', { class: 'gt-entry elev-1 k-tool' }, icon('target'), h('strong', {}, 'Test a program idea'),
    h('span', { class: 'small muted' }, 'For the AI assistant you already use.'),
    fold('Describe the idea',
      h('p', { class: 'small muted' }, 'One file holds your idea, the growth-diagnostics method and every piece of evidence on this page; your own AI does the assessment. ' +
        'Nothing is sent anywhere.'),
      h('div', { class: 'briefing-form' }, h('div', { class: 'field' }, h('label', { for: 'idea-title' }, 'Short title (optional)'), titleIn),
        h('div', { class: 'field' }, h('label', { for: 'idea-text' }, 'Your program idea'), ideaIn)),
      h('div', { class: 'briefing-actions' },
        h('button', { class: 'btn primary small', type: 'button', onclick: () => { if (!ready()) return; downloadText(`${iso}-idea-briefing.md`, make()); flash(`Downloaded ${iso}-idea-briefing.md.`); } },
          'Download the briefing file'),
        h('button', { class: 'btn small', type: 'button', onclick: async () => { if (!ready()) return; try { await navigator.clipboard.writeText(make()); flash('Copied: paste it into your AI assistant.'); }
          catch { flash('Copy failed; use Download instead.'); } } }, 'Copy it instead')),
      h('p', { class: 'small muted' }, 'Open your AI assistant, attach or paste the file, and ask it to follow the instructions inside. Read the answer critically: the AI can be wrong, ' +
        'and these ratings are not yet validated.')));
  body.append(memo, idea);
}
main();
