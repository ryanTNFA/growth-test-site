// @ts-check
// Compare (interface PRD v0.3, D2): two to four economies the reader picks, as columns in the order picked; the areas as rows
// in tree order; each cell one of the three ratings (unclear in its three kinds), its reason on tap with the way to the area's
// page. No totals, no score, no sort across economies: "This is not a ranking of countries." The page reads the snapshot's
// index (every economy's tier for every area), so it loads one small file; the picks live in the link (?isos=KEN,ECU).
import './shell.mjs';
import { initTheme, h, getJSON, dataBase, withData, tierClass, FORK, currentHash, pictogram, readHash, writeHash } from './common.mjs';
import { plainTierOf } from './card.mjs';
import { STRIP_AREAS } from './components/strip.mjs';

initTheme();
const $ = (id) => document.getElementById(id);
const MAX = 4;
/** The three answers' words (G1) for a tier, with unclear's kind; the first decision is a direction. @param {string} id @param {string | null} t */
function answer(id, t) {
  if (id === FORK) return { word: plainTierOf(FORK, t), why: 'The first decision is a direction: both of its sides are constraints.' };
  if (t === 'candidate' || t === 'likely_binding') return { word: 'Worth a closer look', why: t === 'likely_binding' ? 'Likely a main constraint (crimson).' : 'The public data point toward a problem here; not established.' };
  if (t === 'probably_not' || t === 'ruled_out') return { word: 'The data argue against it', why: t === 'ruled_out' ? 'Ruled out (the darker blue).' : 'Probably not the main constraint.' };
  if (t === 'cannot_tell_weak') return { word: 'Unclear', why: 'Evidence too weak: only one kind of evidence, or too little.' };
  if (t === 'cannot_tell_conflicting') return { word: 'Unclear', why: 'Conflicting: the evidence points both ways.' };
  if (t === 'cannot_tell_data_gap') return { word: 'Unclear', why: 'A data gap: too little recent data, or no measure connected yet.' };
  if (t === 'desk_undiagnosable') return { word: 'Unclear', why: 'Needs a sector study: national data cannot read it.' };
  if (t === 'elimination') return { word: 'Unclear', why: 'Judged by elimination of the other causes of low returns.' };
  return { word: 'Not rated', why: 'Not rated in this snapshot.' };
}

async function main() {
  let index;
  try { index = await getJSON(`${dataBase()}/index.json`); } catch (e) { const el = $('page-error'); el.hidden = false; el.textContent = `Could not load the snapshot: ${e.message}.`; return; }
  const [registry] = await Promise.all([getJSON('/growth-test-site/registry/nodes.json', { optional: true })]);
  const regNodes = registry ? (Array.isArray(registry) ? registry : registry.nodes) : [];
  const nameOfArea = (id) => { const r = regNodes.find((n) => n.id === id); return r ? String(r.short).replace(/\?$/, '') : id; };
  const byIso = Object.fromEntries(index.countries.map((c) => [c.iso3, c]));
  const sorted = index.countries.slice().sort((a, b) => a.name.localeCompare(b.name)); // the picker's list is alphabetical, never by rating
  $('cmp-countries').replaceChildren(...sorted.map((c) => h('option', { value: c.name }, c.iso3)));
  /** @type {string[]} */
  let picks = (new URLSearchParams(location.search).get('isos') || '').split(',').map((s) => s.trim().toUpperCase()).filter((s) => byIso[s]);
  picks = [...new Set(picks)].slice(0, MAX);
  const status = (msg) => { $('cmp-status').textContent = msg; };
  const save = () => {
    const q = new URLSearchParams(location.search); if (picks.length) q.set('isos', picks.join(',')); else q.delete('isos');
    writeHash(readHash(), { query: `?${q}` });
  };
  const draw = () => {
    save();
    $('cmp-picked').replaceChildren(...picks.map((iso, i) => h('span', { class: 'cmp-chip', role: 'listitem' }, `${i + 1}. ${byIso[iso].name}`,
      h('button', { type: 'button', class: 'cmp-x', 'aria-label': `Remove ${byIso[iso].name}`, onclick: () => { picks = picks.filter((x) => x !== iso); draw(); } }, '×'))));
    if (picks.length < 2) {
      $('cmp-table').replaceChildren(h('p', { class: 'note' }, picks.length ? 'Add one more economy to compare (two to four).' : 'Add two to four economies to compare.'));
      return;
    }
    const head = h('tr', {}, h('th', { scope: 'col', class: 'cmp-area-h' }, 'Area'), ...picks.map((iso) => h('th', { scope: 'col' },
      h('a', { href: withData(`/growth-test-site/desk/country.html?iso=${iso}`) }, byIso[iso].name))));
    const body = h('tbody');
    for (const id of STRIP_AREAS) {
      body.append(h('tr', {}, h('th', { scope: 'row', class: 'cmp-area' }, pictogram(id), id === FORK ? 'Finance or low returns?' : nameOfArea(id)),
        ...picks.map((iso) => {
          const t = (byIso[iso].tiers || {})[id] || null; const a = answer(id, t);
          return h('td', { class: 'cmp-cell' }, h('details', { class: `cmp-d ${id === FORK ? 'cmp-fork' : tierClass(t)}` },
            h('summary', { class: 'cmp-word' }, a.word),
            h('p', { class: 'cmp-why' }, a.why, ' ', h('a', { href: withData(`/growth-test-site/desk/area.html?iso=${iso}&area=${id}`) + currentHash() }, 'The area’s page →'))));
        })));
    }
    // no totals row, no score, no sort: the rows stay in tree order and the columns in the order picked
    $('cmp-table').replaceChildren(h('table', { class: 'data cmp-t' }, h('caption', { class: 'visually-hidden' },
      `Each area's rating in ${picks.map((x) => byIso[x].name).join(', ')}, in the order of the decision tree. Not a ranking of countries.`),
    h('thead', {}, head), body));
  };
  $('cmp-pick').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = /** @type {HTMLInputElement} */ ($('cmp-add')); const v = input.value.trim().toLowerCase(); if (!v) return;
    const hit = sorted.find((c) => c.name.toLowerCase() === v || c.iso3.toLowerCase() === v) || sorted.find((c) => c.name.toLowerCase().startsWith(v));
    if (!hit) { status('No economy by that name or code.'); return; }
    if (picks.includes(hit.iso3)) { status(`${hit.name} is already here.`); return; }
    if (picks.length >= MAX) { status('Four at most: remove one first.'); return; }
    picks.push(hit.iso3); input.value = ''; status(''); draw();
  });
  const sw = (cls) => h('span', { class: `swatch ${cls}`, 'aria-hidden': 'true' });
  $('cmp-key').replaceChildren(h('span', {}, sw('t-candidate'), 'Worth a closer look'), h('span', {}, sw('t-probably_not'), 'The data argue against it'),
    h('span', {}, 'Unclear: ', sw('t-cannot_tell_weak'), 'evidence too weak ', sw('t-cannot_tell_conflicting'), 'conflicting ', sw('t-cannot_tell_data_gap'), 'data gap'));
  const v = index.snapshot_id; const f = document.getElementById('versions'); if (f) f.textContent = `Public data snapshot ${v} · rubric ${index.rubric_version}.`;
  draw();
}
main();
