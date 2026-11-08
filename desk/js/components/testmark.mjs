// @ts-check
// The four tests' marks (Ryan, 8 November 2026: make "test 1, test 2, test 3, test 4" more intuitive and memorable,
// with something visual rather than a different font, called out where the tests matter without overdoing it). One
// small glyph per test on the icon sprite's 24-unit grid, drawn as inline paths so a chart that carries one still
// carries it when downloaded:
//   1 price          a price tag: is it expensive, or rationed?
//   2 changes        a line that turns up after a dashed marker: when it changed, did investment move?
//   3 circumvention  a path that arcs over a block: are firms paying to get around it?
//   4 camels         a camel: do the activities that need it least do best? (camels thrive where water is scarce)
// testMark() is the badge (the glyph in a soft disc) set before a test's name; fillTestMarks() fills the static pages'
// placeholders (<span data-tmark="price">); glyphGroup() draws the badge inside an SVG chart in literal colours.
// Self-contained (no import from common.mjs), so shell.mjs can fill every page's placeholders without an import cycle.

const SVG = 'http://www.w3.org/2000/svg';

/** @typedef {{d: string, dash?: string}} Stroke */
/** @type {Record<string, Stroke[]>} */
export const GLYPH = {
  price: [
    { d: 'M3.5 11.6V4.6a1.1 1.1 0 0 1 1.1-1.1h7l8.4 8.4a1.6 1.6 0 0 1 0 2.2l-6.6 6.6a1.6 1.6 0 0 1-2.2 0z' },
    { d: 'M9.8 8.2a1.6 1.6 0 1 1-3.2 0a1.6 1.6 0 1 1 3.2 0z' },
  ],
  changes: [
    { d: 'M10.5 3.5v17', dash: '1.5 2.5' },
    { d: 'M3 17.5h7.5l9-9' },
    { d: 'M14.5 8.5h5v5' },
  ],
  circumvention: [
    { d: 'M10 21v-5.5h4V21' },
    { d: 'M3 21C3 7 21 7 21 19.5' },
    { d: 'M18.4 17.3l2.6 2.7 2.4-2.8' },
  ],
  camels: [
    { d: 'M2.5 13c.4-5.6 5.2-6.6 6.4-2.6 1-4.6 5.4-4.6 6.2-.4.6-1.6 1.4-3.6 2.2-4.6.4-.5 1-.6 1.6-.6h1.6c.5 0 .9.3 1 .8l.3 1.1-2.3.6-2.6 '
      + '5.9c-.3.6-.8.9-1.4.9H4.2c-1 0-1.7-.5-1.7-1.1z' },
    { d: 'M5.2 14.2V21M7.6 14.2V21M13 14.2V21M15.4 14.2V21' },
  ],
};

/** What each glyph shows, for a tooltip or a legend. */
export const GLYPH_WORDS = {
  price: 'a price tag',
  changes: 'a line that turns up after a change',
  circumvention: 'a path around a block',
  camels: 'a camel, which thrives where water is scarce',
};

/** @param {string} tag @param {Record<string, string | number>} attrs */
function el(tag, attrs) {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

/** The glyph's strokes, appended to an SVG parent. @param {Element} parent @param {string} key */
function strokes(parent, key) {
  for (const s of GLYPH[key] || []) parent.append(el('path', s.dash ? { d: s.d, 'stroke-dasharray': s.dash } : { d: s.d }));
  return parent;
}

/**
 * The bare glyph as an <svg>, styled by the .tglyph rule (stroke in the current colour).
 * @param {string} key a test key: price, changes, circumvention or camels
 */
export function testGlyph(key) {
  return strokes(el('svg', { class: 'tglyph', viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' }), key);
}

/**
 * The badge set before a test's name: the glyph in a soft disc. Decorative: the name beside it says which test.
 * @param {string} key @param {string} [extra] more classes (lg for the home page's list)
 */
export function testMark(key, extra = '') {
  const span = document.createElement('span');
  span.className = `tmark${extra ? ` ${extra}` : ''}`;
  span.dataset.test = key;
  span.setAttribute('aria-hidden', 'true');
  span.append(testGlyph(key));
  return span;
}

/** Fill every <span data-tmark="key"> placeholder under root that is still empty. @param {ParentNode} [root] */
export function fillTestMarks(root = document) {
  for (const ph of /** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll('[data-tmark]'))) {
    if (ph.childElementCount) continue;
    const key = ph.dataset.tmark || '';
    if (!GLYPH[key]) continue;
    ph.classList.add('tmark');
    ph.dataset.test = key;
    ph.setAttribute('aria-hidden', 'true');
    ph.append(testGlyph(key));
  }
}

/**
 * The badge inside an SVG chart, centred on (cx, cy), in literal colours so a downloaded chart keeps it.
 * @param {string} key @param {{cx: number, cy: number, size: number, disc: string, ink: string}} o
 */
export function glyphGroup(key, { cx, cy, size, disc, ink }) {
  const g = el('g', { class: 'tmark-svg', 'aria-hidden': 'true' });
  g.append(el('circle', { cx, cy, r: size / 2, fill: disc }));
  const s = (size * 0.68) / 24;
  const inner = el('g', {
    transform: `translate(${(cx - 12 * s).toFixed(2)},${(cy - 12 * s).toFixed(2)}) scale(${s.toFixed(4)})`,
    fill: 'none', stroke: ink, 'stroke-width': (1.9).toFixed(1), 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  });
  g.append(strokes(inner, key));
  return g;
}
