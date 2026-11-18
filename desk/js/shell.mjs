// @ts-check
// The page shell (Growth Test PRD, Part 6C, C2): the two-row top bar and the footer, the same on every page,
// rendered into the empty <header class="topbar"> and <footer class="foot"> hosts of desk/_template.html.
// Row 1, global: the brand mark (the story), Countries, Analyst View, Self-discovery, Learn, Method, The argument, and a small Display
// menu. Row 2, once a country is chosen: the country with a type-to-search switcher; the tabs Bottom line · Areas · Analyst View ·
// Heat map · Self-discovery; the evidence setting; and the comparison set in use.
// State travels in the URL: every tab link carries the comparison set, edited peers and overrides
// (#set=, #peers=, #o=) read at click time, because the pages rewrite their hash as the user works.
// Import this module first on every page: it mounts synchronously, before initTheme looks for its button.
// The footer carries #versions (pages with data fill it), the Beta sentence, the citation and the affiliation note.
// Beta (13 November 2026): the brand carries a Beta mark, the bar a Feedback button, and any element marked data-feedback
// on any page opens the feedback box (components/feedback.mjs, loaded on the first click).
import { h, withData, qs, getJSON, dataBase, SETTINGS, SETTING_LABEL, SETTING_HINT, currentSetting, HASH, CARRIED_KEYS, readHash,
  setHashKeys, redesignOn, englishList, currentDetail, setDetail, pictogram } from './common.mjs';
import { STRIP_AREAS } from './components/strip.mjs';
import { monthYear } from './country_text.mjs';
import { fillTestMarks } from './components/testmark.mjs';
import './components/elements.mjs'; // <gt-term> and <gt-fold>, on every page (C7)

const PAGE = document.body.dataset.page || '';
// Interface PRD v0.3, step 2: behind the redesign flag the bar is L4's (one row of site links, then the country's name and
// switcher, Overview and the Areas menu) and the reading and the comparison set leave it for the assumptions line (L3).
export const REDESIGN = redesignOn();
if (REDESIGN) document.documentElement.dataset.redesign = 'on';
// L1: the detail is set on the root before anything draws, so a page opens in the reader's detail
document.documentElement.dataset.detail = REDESIGN ? currentDetail() : 'analyst';
// The bar (Growth Test PRD, Part 4, D4; shipped 6 November 2026): Countries, Analyst View, Self-discovery, Learn, Method,
// The argument on every page; the brand mark opens the story (the root page).
const NAME = 'The Growth Test';
// Step 3 of the interface redesign retired Areas, the Heat map and Self-discovery (Part 6): their content lives on the overview
// and on each area's page (area.html), which is a country page too.
export const TABS = [
  { key: 'bottom', label: 'Bottom line', path: '/growth-test-site/desk/country.html' },
  { key: 'charts', label: 'Analyst View', path: '/growth-test-site/desk/evidence.html', analyst: true },
];
const COUNTRY_PAGE_KEYS = new Set([...TABS.map((t) => t.key), 'area']);
const SET_WORDS = { structural: 'similar economies', regional: 'regional neighbors', aspirational: 'faster growers that were once as rich',
  custom: 'your own list' };

let countries = null;
const nameOf = (iso) => { const c = (countries || []).find((x) => x.iso3 === iso); return c ? c.name : iso; };

/** The URL state that follows the user between tabs: only the keys every country page understands. */
export function carriedHash() {
  const p = readHash();
  const keep = new URLSearchParams();
  for (const k of CARRIED_KEYS) if (p.get(k) != null) keep.set(k, p.get(k));
  const s = keep.toString();
  return s ? `#${s}` : '';
}
/** A link to a country tab with the current state; `extra` adds query parameters such as node=. */
export function tabHref(path, iso, extra = '') {
  return withData(`${path}?iso=${encodeURIComponent(iso)}${extra}`) + carriedHash();
}
// a country page writes its economy's code on the body before any module runs (country.html)
const currentIso = () => (qs('iso') || document.body.dataset.iso || '').toUpperCase();

/** The last country viewed (every country page records it on mount); the bar's Analyst View and Self-discovery open it, else Countries. */
export function lastIso() {
  try { return (localStorage.getItem('gt-last-iso') || '').toUpperCase() || null; } catch { return null; }
}
/**
 * Where an area's own page is: area.html, the one home of each area (interface PRD v0.3, 5C; step 3).
 * @param {string} iso @param {string} id
 */
export function areaHref(iso, id) {
  return tabHref('/growth-test-site/desk/area.html', iso, `&area=${encodeURIComponent(id)}`);
}

/**
 * L4: the site row. On a country page "Countries" leaves it, since the country's switcher does that job (Ryan, 18 November:
 * nine controls on a country page, B6).
 * @param {(href: string, label: string, key: string) => HTMLElement} link @param {boolean} onCountry
 */
function barItemsV3(link, onCountry) {
  const last = lastIso();
  return [onCountry ? null : link('/growth-test-site/desk/countries.html', 'Countries', 'countries'),
    link(last ? `/growth-test-site/desk/evidence.html?iso=${encodeURIComponent(last)}` : '/growth-test-site/desk/countries.html', 'Explore the data', 'charts'),
    link('/growth-test-site/desk/methods.html', 'Method', 'methods'), link('/growth-test-site/desk/standard.html', 'The argument', 'standard')].filter(Boolean);
}

/** The Part 4 bar items. */
function barItems(link) {
  const last = lastIso();
  const withIso = (path) => (last ? `${path}?iso=${encodeURIComponent(last)}` : '/growth-test-site/desk/countries.html');
  return [link('/growth-test-site/desk/countries.html', 'Countries', 'countries'), link(withIso('/growth-test-site/desk/evidence.html'), 'Analyst View', 'charts'),
    link('/growth-test-site/desk/methods.html', 'Method', 'methods'), link('/growth-test-site/desk/standard.html', 'The argument', 'standard')];
}

function row1() {
  const menu = h('details', { class: 'nav-menu' },
    h('summary', {}, 'Display'),
    h('div', { class: 'nav-menu-body' }, h('button', { id: 'theme-toggle', class: 'btn quiet small', type: 'button' }, 'Theme: Auto')));
  const link = (href, label, key) => h('a', { href: withData(href), 'aria-current': PAGE === key ? 'page' : null }, label);
  const items = barItems(link);
  return h('div', { class: 'nav-global' },
    h('div', { class: 'wrap' },
      h('a', { class: 'brand', href: withData('/growth-test-site/desk/') }, h('img', { class: 'brand-logo', src: '/growth-test-site/desk/img/tnfa-logo.webp',
        alt: 'The New Foreign Assistance', width: '72', height: '36' }), h('strong', {}, NAME),
        h('span', { class: 'beta-chip', title: 'Beta: the ratings are uncalibrated and may be wrong' }, 'Beta')),
      h('nav', { class: 'topnav', 'aria-label': 'Site' }, ...items, menu,
        h('button', { class: 'btn quiet small fb-open', type: 'button', 'data-feedback': '' }, 'Feedback'))));
}

/**
 * L4, row 1: the brand, Countries (not on a country page), Explore the data, Method, The argument and the detail control. Feedback
 * is in the footer of every page and in each area's "Does this look right?" (Ryan, 18 November); the theme switch is in the footer.
 * @param {boolean} onCountry
 */
function row1v3(onCountry) {
  const link = (href, label, key) => h('a', { href: withData(href), 'aria-current': PAGE === key ? 'page' : null }, label);
  return h('div', { class: 'nav-global' },
    h('div', { class: 'wrap' },
      h('a', { class: 'brand', href: withData('/growth-test-site/desk/') }, h('img', { class: 'brand-logo', src: '/growth-test-site/desk/img/tnfa-logo.webp',
        alt: 'The New Foreign Assistance', width: '72', height: '36' }), h('strong', {}, NAME),
        h('span', { class: 'beta-chip', title: 'Beta: the ratings are uncalibrated and may be wrong' }, 'Beta')),
      h('nav', { class: 'topnav', 'aria-label': 'Site' }, ...barItemsV3(link, onCountry), detailControl())));
}

/** L1: one control in the bar, "Detail: Plain / Analyst"; a press switches it, and every page redraws on 'desk-detail'. */
function detailControl() {
  const label = (d) => `Detail: ${d === 'analyst' ? 'Analyst' : 'Plain'}`;
  const b = h('button', { class: 'btn quiet small detail-btn', type: 'button', id: 'detail-btn',
    'aria-pressed': currentDetail() === 'analyst' ? 'true' : 'false',
    title: 'Plain shows the answer and folds the rest; Analyst opens every measure, class, score and the rule detail. The ratings are the same.' },
  label(currentDetail()));
  b.addEventListener('click', () => {
    const next = currentDetail() === 'analyst' ? 'plain' : 'analyst';
    setDetail(next); b.textContent = label(next); b.setAttribute('aria-pressed', next === 'analyst' ? 'true' : 'false');
  });
  return b;
}

/** The twelve areas and the first decision, in tree order, for the Areas menu; names come from the registry when it arrives. */
let areaNames = /** @type {Record<string, string>} */ ({});
/** Micro risk's sub-areas, in the registry's order, and the names the menu shows until the registry arrives. */
const MICRO_SUBS = ['N11.property', 'N11.corruption', 'N11.taxes', 'N11.regulation', 'N11.crime', 'N11.policy'];
const MENU_NAMES = /** @type {Record<string, string>} */ ({ N9: 'Geography', 'N11.property': 'Property rights', 'N11.corruption': 'Corruption',
  'N11.taxes': 'Taxes', 'N11.regulation': 'Regulation', 'N11.crime': 'Crime', 'N11.policy': 'Policy uncertainty' });
/** L4, row 2: the country's name with its switcher, Overview, and Areas (a menu of the twelve). Compare joins at step 5. */
function row2v3(iso) {
  const ov = h('a', { class: 'tab', 'data-tab': 'bottom', href: tabHref('/growth-test-site/desk/country.html', iso), 'aria-current': PAGE === 'bottom' ? 'page' : null },
    'Overview');
  ov.addEventListener('click', () => { ov.href = tabHref('/growth-test-site/desk/country.html', currentIso() || iso); });
  const list = h('ul', { class: 'areas-menu-list' });
  // Ryan, 18 November 2026: micro risk's six sub-areas are each one tap away, listed under it; geography (context, not rated) has
  // its page too, after land, where the tree has it
  const item = (id, sub = false) => h('li', {}, h('a', { class: sub ? 'sub' : null, href: areaHref(currentIso() || iso, id) },
    sub ? '' : pictogram(id) || '', areaNames[id] || MENU_NAMES[id] || id));
  const fill = () => list.replaceChildren(...STRIP_AREAS.flatMap((id) => [item(id),
    ...(id === 'N8' ? [item('N9')] : id === 'N11' ? MICRO_SUBS.map((s) => item(s, true)) : [])]));
  fill();
  const menu = h('details', { class: 'nav-menu areas-menu' }, h('summary', { 'aria-current': PAGE === 'area' ? 'page' : null }, 'Areas'),
    h('div', { class: 'nav-menu-body' }, list));
  menu.addEventListener('toggle', () => {
    if (!menu.open) return;
    fill();
    if (!Object.keys(areaNames).length) getJSON('/growth-test-site/registry/nodes.json', { optional: true }).then((r) => {
      const ns = r && (Array.isArray(r) ? r : r.nodes);
      if (ns) { areaNames = Object.fromEntries(ns.map((n) => [n.id, String(n.short || n.id).replace(/\?$/, '')])); fill(); }
    });
  });
  const { input, datalist } = switcher();
  return h('div', { class: 'nav-country' },
    h('div', { class: 'wrap' },
      h('div', { class: 'nav-country-id' }, h('span', { class: 'nav-country-name', id: 'nav-country-name' }, iso), input, datalist),
      h('nav', { class: 'tabs', 'aria-label': 'Country views' }, ov, menu, compareLink(iso))));
}

/** D2: Compare, from the country's row, starting from this economy. */
function compareLink(iso) {
  const a = h('a', { class: 'tab', 'data-tab': 'compare', href: withData(`/growth-test-site/desk/compare.html?isos=${encodeURIComponent(iso)}`) + carriedHash(),
    'aria-current': PAGE === 'compare' ? 'page' : null }, 'Compare');
  a.addEventListener('click', () => { a.href = withData(`/growth-test-site/desk/compare.html?isos=${encodeURIComponent(currentIso() || iso)}`) + carriedHash(); });
  return a;
}

/** The type-to-search switcher, shared by both bars. */
function switcher() {
  const input = h('input', { type: 'search', id: 'nav-country', list: 'nav-countries', placeholder: 'Switch country…', autocomplete: 'off',
    'aria-label': 'Switch country: type a name or ISO code' });
  const datalist = h('datalist', { id: 'nav-countries' });
  const go = () => {
    const v = input.value.trim().toLowerCase(); if (!v || !countries) return;
    const hit = countries.find((c) => c.name.toLowerCase() === v || c.iso3.toLowerCase() === v) || countries.find((c) => c.name.toLowerCase().startsWith(v));
    if (!hit) return;
    // peers and overrides belong to one country; the comparison-set choice and the evidence setting carry over
    const cur = readHash();
    const keep = new URLSearchParams();
    for (const k of [HASH.set, HASH.setting]) if (cur.get(k)) keep.set(k, cur.get(k));
    const path = location.pathname.replace(/\/$/, '/index.html');
    // an area's page switches to the same area in the other economy
    const area = PAGE === 'area' ? new URLSearchParams(location.search).get('area') : null;
    const page = PAGE === 'area' || TABS.some((t) => path.endsWith(t.path.split('/').pop())) ? location.pathname : '/growth-test-site/desk/country.html';
    location.href = withData(`${page}?iso=${hit.iso3}${area ? `&area=${encodeURIComponent(area)}` : ''}`) + (keep.toString() ? `#${keep}` : '');
  };
  input.addEventListener('change', go);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  return { input, datalist };
}

// ---------- L3: the assumptions in one line, under the country's name; it opens the reading switch and the comparison set ----------
/** @type {{members: string[], kind: string, snapshotId: string, custom: boolean} | null} */
let assumptions = null;
/**
 * A country page tells the line what it has loaded: the comparison countries in force, their kind and the data date.
 * @param {{members: string[], kind: string, snapshotId: string, custom?: boolean}} info
 */
export function setAssumptions(info) { assumptions = { custom: false, ...info }; renderAssumptions(); }
function assumptionsLine(iso) {
  const sum = h('summary', { class: 'assume-sum', id: 'assume-sum' });
  const members = h('p', { class: 'assume-members', id: 'assume-members' });
  const change = h('a', { href: tabHref('/growth-test-site/desk/country.html', iso, '&section=comparators') }, 'Change the comparison countries');
  change.addEventListener('click', () => { change.href = tabHref('/growth-test-site/desk/country.html', currentIso() || iso, '&section=comparators'); });
  return h('details', { class: 'assume', id: 'assume' }, sum,
    h('div', { class: 'assume-panel' },
      h('div', { class: 'assume-row' }, settingSwitch()),
      h('div', { class: 'assume-row' }, members, change),
      h('p', { class: 'assume-row small muted' }, 'Standard is the only reading to cite. The theme switch is at the foot of every page.')));
}
function renderAssumptions() {
  const sum = document.getElementById('assume-sum'); if (!sum) return;
  const p = readHash();
  const set = p.get(HASH.peers) != null ? 'custom' : (p.get(HASH.set) || 'structural');
  const a = assumptions;
  const n = a ? a.members.length : null;
  const kind = a && a.kind ? a.kind : SET_WORDS[set] || set;
  const setting = currentSetting();
  sum.replaceChildren(h('span', {}, `${SETTING_LABEL[setting]} reading`), ' · ', h('span', {}, `${n != null ? `${n} ` : ''}${kind}`),
    a && a.snapshotId ? ` · public data to ${monthYear(a.snapshotId)}` : '',
    setting !== 'standard' ? h('strong', { class: 'assume-off' }, ' · not the one to cite') : '');
  const m = document.getElementById('assume-members');
  if (m) m.textContent = a && a.members.length ? `Compared with ${n} ${kind}: ${englishList(a.members)}.` : `Compared with ${kind}.`;
}

const isCurrentTab = (key) => PAGE === key;
function row2(iso) {
  const tab = (t) => {
    const a = h('a', { class: 'tab', 'data-tab': t.key, href: tabHref(t.path, iso), 'aria-current': isCurrentTab(t.key) ? 'page' : null }, t.label);
    // the page may have changed its hash or its country since the bar was drawn
    a.addEventListener('click', () => { a.href = tabHref(t.path, currentIso() || iso); });
    return a;
  };
  const input = h('input', { type: 'search', id: 'nav-country', list: 'nav-countries', placeholder: 'Switch country…', autocomplete: 'off',
    'aria-label': 'Switch country: type a name or ISO code' });
  const list = h('datalist', { id: 'nav-countries' });
  const go = () => {
    const v = input.value.trim().toLowerCase(); if (!v || !countries) return;
    const hit = countries.find((c) => c.name.toLowerCase() === v || c.iso3.toLowerCase() === v) || countries.find((c) => c.name.toLowerCase().startsWith(v));
    if (!hit) return;
    // peers and overrides belong to one country; the comparison-set choice and the evidence setting carry over
    const cur = readHash();
    const keep = new URLSearchParams();
    for (const k of [HASH.set, HASH.setting]) if (cur.get(k)) keep.set(k, cur.get(k));
    const path = location.pathname.replace(/\/$/, '/index.html');
    const page = TABS.some((t) => path.endsWith(t.path.split('/').pop())) ? location.pathname : '/growth-test-site/desk/country.html';
    location.href = withData(`${page}?iso=${hit.iso3}`) + (keep.toString() ? `#${keep}` : '');
  };
  input.addEventListener('change', go);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  // the comparison set in use; it links to where it can be changed (Areas, comparison countries)
  const setNote = h('a', { class: 'nav-set small', id: 'nav-set', href: tabHref('/growth-test-site/desk/country.html', iso, '&section=comparators') });
  setNote.addEventListener('click', () => { setNote.href = tabHref('/growth-test-site/desk/country.html', currentIso() || iso, '&section=comparators'); });
  return h('div', { class: 'nav-country' },
    h('div', { class: 'wrap' },
      h('div', { class: 'nav-country-id' }, h('span', { class: 'nav-country-name', id: 'nav-country-name' }, iso), input, list),
      h('nav', { class: 'tabs', 'aria-label': 'Country views' },
        // Part 4: "For analysts" is no longer a label beside the tabs; the bar's first row carries the analyst's items
        ...TABS.map(tab)),
      h('div', { class: 'nav-meta' }, settingSwitch(), setNote)));
}

/**
 * The evidence setting (front-door PRD W4): three named readings, never a slider. Standard is the default and the
 * only citable reading. The choice lives in the link (#setting=) and pages redraw on the 'desk-setting' event.
 */
function settingSwitch() {
  const cur = currentSetting();
  const group = h('div', { class: 'setting-switch', role: 'group', 'aria-label': 'Evidence setting' },
    h('span', { class: 'setting-label' }, 'Reading'),
    ...SETTINGS.map((s) => h('button', { type: 'button', class: 'setting-btn', 'data-setting': s, 'aria-pressed': s === cur ? 'true' : 'false',
      title: SETTING_HINT[s] }, SETTING_LABEL[s])),
    h('a', { class: 'setting-help small', href: withData('/growth-test-site/desk/methods.html#settings'), title: 'What the three readings are' }, 'What’s this?'));
  group.addEventListener('click', (e) => {
    const b = e.target instanceof Element ? /** @type {HTMLElement | null} */ (e.target.closest('button[data-setting]')) : null; if (!b) return;
    const s = b.dataset.setting;
    setHashKeys({ [HASH.setting]: s === 'standard' ? null : s }); // writeHash tells the bar (desk-hash)
    for (const x of /** @type {NodeListOf<HTMLElement>} */ (group.querySelectorAll('button[data-setting]'))) {
      x.setAttribute('aria-pressed', x.dataset.setting === s ? 'true' : 'false');
    }
    window.dispatchEvent(new CustomEvent('desk-setting', { detail: { setting: s } }));
  });
  return group;
}

/** Redraw the country line: name, the comparison set in use, and the tab links (pages call this when they switch country). */
export function refreshNav() {
  const iso = currentIso();
  const name = document.getElementById('nav-country-name');
  if (name) name.textContent = nameOf(iso);
  // V2: the page shell paints the ISO code at once; swap in the name as soon as the country list is here, until the page
  // module writes its own title (it removes data-country-title or overwrites the text)
  if (countries) for (const el of document.querySelectorAll('[data-country-title]')) {
    if (el.textContent.startsWith(iso)) el.textContent = el.textContent.replace(iso, nameOf(iso));
    if (document.title.startsWith(`${iso} ·`)) document.title = document.title.replace(iso, nameOf(iso));
  }
  for (const a of /** @type {NodeListOf<HTMLAnchorElement>} */ (document.querySelectorAll('.nav-country ' +
    'a.tab'))) { const t = TABS.find((x) => x.key === a.dataset.tab); if (t) a.href = tabHref(t.path,
    iso); }
  const p = readHash();
  const set = p.get(HASH.peers) != null ? 'custom' : (p.get(HASH.set) || 'structural');
  for (const b of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.setting-btn'))) b.setAttribute('aria-pressed',
    b.dataset.setting === currentSetting() ? 'true' : 'false');
  const note = document.getElementById('nav-set');
  if (note) note.textContent = `Compared with ${SET_WORDS[set] || set}`;
  renderAssumptions();
  // back and forward may change the detail in the link
  if (REDESIGN) {
    const d = currentDetail(); document.documentElement.dataset.detail = d;
    const b = document.getElementById('detail-btn');
    if (b) { b.textContent = `Detail: ${d === 'analyst' ? 'Analyst' : 'Plain'}`; b.setAttribute('aria-pressed', d === 'analyst' ? 'true' : 'false'); }
  }
}

/** The footer, the same on every page: the data vintage (filled by pages that have one), the Beta sentence, the citation and the affiliation note. */
function footer() {
  return h('div', { class: 'wrap' },
    h('p', { id: 'versions' }),
    h('p', {},
      `${NAME} is in Beta, by The New Foreign Assistance: its ratings are uncalibrated and may be wrong. Overrides and comparator edits live ` +
        'in the page URL and go nowhere unless you choose to send one. This tool never recommends funding; it states what the public evidence ' +
        'can and cannot support. ',
      h('button', { class: 'btn quiet small', type: 'button', 'data-feedback': '' }, 'Tell us what looks off')),
    // R6: the DOI record's own title follows at the next tagged release
    h('p', { id: 'cite-as' }, 'Cite as: Moore, Ryan A., and The New Foreign Assistance, ', h('em', {}, 'The Growth Test'), ', ',
      h('a', { href: 'https://doi.org/10.5281/zenodo.23924472' }, 'doi:10.5281/zenodo.23924472'),
      ' (the DOI resolves to the latest release; each release has its own). Code Apache 2.0; documents and derived data CC BY 4.0.'),
    REDESIGN ? h('p', {}, h('button', { id: 'theme-toggle', class: 'btn quiet small', type: 'button' }, 'Theme: Auto')) : '',
    h('p', { class: 'small muted', id: 'affiliation' },
      `${NAME} is not affiliated with or endorsed by the Growth Lab at Harvard Kennedy School, the Observatory of Economic Complexity or the ` +
        'Millennium Challenge Corporation. It reimplements methods published in the research literature (Hausmann, Rodrik and Velasco; Hausmann and Rodrik; ' +
        'Hidalgo, Hausmann and coauthors) and uses public data, credited where used. See the ',
      h('a', { href: 'https://atlas.hks.harvard.edu/', target: '_blank', rel: 'noopener' },
        'Atlas of Economic Complexity'), ' for the Growth Lab’s own tools.'));
}

/** Beta: every element marked data-feedback opens the feedback box; the component loads on the first press. No document-level listener (C4). */
function wireFeedback() {
  const open = (e) => {
    e.preventDefault();
    import('./components/feedback.mjs').then((m) => m.openFeedback()).catch((err) => console.error(err));
  };
  for (const el of document.querySelectorAll('[data-feedback]')) el.addEventListener('click', open);
}

function mount() {
  fillTestMarks(); // the four tests' marks on the static pages (<span data-tmark="price">)
  const foot = document.querySelector('footer.foot');
  if (foot && !foot.childElementCount) foot.replaceChildren(footer());
  const header = document.querySelector('header.topbar');
  if (!header) { wireFeedback(); return; }
  const iso = currentIso();
  const showCountry = !!iso && COUNTRY_PAGE_KEYS.has(PAGE);
  if (showCountry) { try { localStorage.setItem('gt-last-iso', iso); } catch { /* the bar falls back to the Countries page */ } }
  if (REDESIGN) {
    header.replaceChildren(row1v3(showCountry), showCountry ? row2v3(iso) : '');
    header.classList.add('two-row', 'v3');
    if (showCountry) {
      // L3: under the country's name on the page (a page may hold a host for it), else at the top of main
      const line = assumptionsLine(iso);
      const host = document.getElementById('assume-host');
      const main = document.querySelector('main');
      if (host) host.replaceChildren(line); else if (main) main.prepend(h('div', { class: 'assume-wrap' }, line));
    }
  } else header.replaceChildren(row1(), showCountry ? row2(iso) : '');
  header.classList.add('two-row');
  wireFeedback();
  if (!showCountry) return;
  refreshNav();
  window.addEventListener('hashchange', refreshNav); // back and forward
  window.addEventListener('desk-hash', refreshNav); // every writeHash (common.mjs), since replaceState fires no event
  getJSON(`${dataBase()}/countries.json`, { optional: true }).then((cs) => {
    countries = (cs || []).slice().sort((a, b) => a.name.localeCompare(b.name));
    const dl = document.getElementById('nav-countries');
    if (dl) dl.replaceChildren(...countries.map((c) => h('option', { value: c.name }, c.iso3)));
    refreshNav();
  });
}
mount();
// The tour came down in step 2 of the interface redesign (PRD v0.3, E3); Learn leaves the bar until it is rebuilt.
