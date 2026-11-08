// Methods page (front-door PRD W3, level 3): about the prototype, how it is tested, and the method documents,
// rendered from the Markdown in docs/ that build_site.py publishes (DOCS there must list the same files).
import './shell.mjs';
import { initTheme, h, qs, readHash, writeHash, getJSON, loadRegistry, dataBase, tierClass, missingTestKind, missingTestReason, MISSING_TEST_LABEL } from './common.mjs';
import { plainTierOf } from './card.mjs';
import { ratingAnatomy } from './anatomy.mjs';
import { ledger } from './components/ledger.mjs';

initTheme();

export const DOCS = [
  { id: 'how-it-works', title: 'How The Growth Test works', who: 'Plain-language guide for program officers, Hill staff and managers' },
  { id: 'methodology-note', title: 'Methodology Note', who: 'For economists: every formula, threshold and rule, with the code that implements it' },
  { id: 'datasheet-and-model-card', title: 'Datasheet and model card', who: 'What the data are, intended uses and misuses, known limits' },
  { id: 'codebook', title: 'Indicator codebook', who: 'Every indicator: source, evidence class, test and direction' },
];

// the worked ledger: Indonesia's electricity (N5, "probably not"), drawn by the same code as every area's card
async function drawLedger() {
  const host = document.getElementById('ledger-host'); if (!host) return;
  try {
    const [sc, registry] = await Promise.all([getJSON(`${dataBase()}/IDN.json`), loadRegistry()]);
    const node = sc.nodes.find((n) => n.id === 'N5');
    const byId = Object.fromEntries(sc.indicators.map((r) => [r.id, r]));
    const a = ratingAnatomy(node, registry, { snapshotYear: sc.meta.snapshot_year, byId, set: 'structural', setting: 'standard', comovement: sc.comovement || [] });
    const chip = h('span', { class: `tier-badge ${tierClass(node.tier)}` }, h('span', {}, plainTierOf(node.id, node.tier)));
    const lg = ledger(a, { chip, country: sc.country.name, missing: (t) => MISSING_TEST_LABEL[missingTestKind(t, 'N5', registry)],
      why: (t) => missingTestReason(t, 'N5', registry).replace(/^Not computed: /, '') });
    host.replaceChildren(h('p', { class: 'small muted' }, `${sc.country.name} · electricity · snapshot ${sc.meta.snapshot_id}, rubric ${sc.meta.rubric_version}, structural comparators, Standard reading.`), lg || h('p', {}, 'Not scored.'));
  } catch (e) { host.replaceChildren(h('p', { class: 'note' }, `The worked example could not load (${e.message}).`)); }
}
drawLedger();

const list = document.getElementById('doc-list');
const body = document.getElementById('doc-body');

async function show(id, scroll) {
  const doc = DOCS.find((d) => d.id === id);
  if (!doc) return;
  for (const a of list.querySelectorAll('a')) a.setAttribute('aria-current', a.dataset.doc === id ? 'true' : 'false');
  body.replaceChildren(h('p', { class: 'small muted' }, `Loading ${doc.title}…`));
  try {
    const r = await fetch(`/growth-test-site/docs/${id}.md`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const md = await r.text();
    // our own documents, rendered as written; marked is vendored (desk/vendor/marked-12.0.2.min.js, loaded by methods.html)
    body.innerHTML = window.marked ? window.marked.parse(md) : `<pre>${md.replace(/[&<]/g, (c) => (c === '&' ? '&amp;' : '&lt;'))}</pre>`;
    for (const t of body.querySelectorAll('table')) t.outerHTML = `<div class="table-wrap">${t.outerHTML.replace('<table', '<table class="data"')}</div>`;
    const q = new URLSearchParams(location.search); q.set('doc', id);
    writeHash(readHash(), { query: `?${q}` });
    if (scroll) body.scrollIntoView({ block: 'start' });
  } catch (e) {
    body.replaceChildren(h('p', { class: 'note alert' }, `${doc.title} could not be loaded (${e.message}).`));
  }
}

list.replaceChildren(...DOCS.map((d) => h('li', {},
  h('a', { href: `?doc=${d.id}#docs`, 'data-doc': d.id, onclick: (e) => { e.preventDefault(); show(d.id, true); } }, d.title),
  h('span', { class: 'small muted' }, ` ${d.who}`))));
const want = qs('doc');
if (want) show(want, true);
