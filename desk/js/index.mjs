// @ts-check
// The root page: the story (Growth Test PRD, Part 10), the scrolling front door in six beats. The copy is
// static HTML (index.html), so the first paint needs nothing from here. This module mounts the Long View after first paint
// (beat 1, drawing itself once per session; static under reduced motion), wires the two country searches (D5: a country is
// one click from the first screen), and marks the question the reader is on in the rail of the three questions (interface
// PRD E8 b). The beats' ease-in is plain CSS (motion.css, E8 c), so a browser without scroll timelines, or a reader who asked
// for less motion, sees the static page; nothing here moves anything.
import './shell.mjs';
import { initTheme, h, getJSON, dataBase, withData } from './common.mjs';

initTheme();

// ---------- beat 1: the Long View, after first paint, drawn once per session ----------
const DRAWN = 'gt-longview-drawn';
const drawn = () => { try { return sessionStorage.getItem(DRAWN) === '1'; } catch { return false; } };
const markDrawn = () => { try { sessionStorage.setItem(DRAWN, '1'); } catch { /* storage may be unavailable */ } };
const host = document.getElementById('longview');
// after first paint: a macrotask (requestAnimationFrame never fires while the tab is in the background, and the chart must still arrive)
setTimeout(() => {
  import('./longview.mjs')
    .then((m) => m.mountLongView(host, { autoplay: !drawn() }))
    .then(() => { markDrawn(); if (host) { host.removeAttribute('aria-busy'); host.classList.add('ready'); } })
    .catch((e) => { console.error(e); if (host) host.hidden = true; });
}, 0);

// ---------- the country search (beats 1 and 6): the list loads on first touch, a typed ISO code works without it ----------
/** @type {Array<{iso3: string, name: string}> | null} */
let countries = null;
let loading = null;
function loadCountries() {
  if (!loading) loading = getJSON(`${dataBase()}/countries.json`, { optional: true }).then((cs) => {
    countries = (cs || []).slice().sort((a, b) => a.name.localeCompare(b.name));
    const dl = document.getElementById('gt-countries');
    if (dl) dl.replaceChildren(...countries.map((c) => h('option', { value: c.name }, c.iso3)));
    return countries;
  });
  return loading;
}
function find(q) {
  const v = q.trim().toLowerCase(); if (!v) return null;
  const hit = (countries || []).find((c) => c.name.toLowerCase() === v || c.iso3.toLowerCase() === v) ||
    (countries || []).find((c) => c.name.toLowerCase().startsWith(v));
  if (hit) return hit.iso3;
  return /^[a-z]{3}$/.test(v) ? v.toUpperCase() : null; // an ISO3 code typed before the list arrives
}
for (const form of /** @type {NodeListOf<HTMLFormElement>} */ (document.querySelectorAll('form.gt-ask, form.gt-entry'))) {
  const input = /** @type {HTMLInputElement | null} */ (form.querySelector('input[data-ask]'));
  if (!input) continue;
  for (const ev of ['focus', 'pointerenter']) input.addEventListener(ev, () => { loadCountries(); }, { once: true });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await loadCountries();
    const iso = find(input.value);
    if (!iso) { input.setCustomValidity('No economy by that name or code.'); input.reportValidity(); return; }
    location.href = withData(`/growth-test-site/desk/country.html?iso=${encodeURIComponent(iso)}`);
  });
  input.addEventListener('input', () => input.setCustomValidity(''));
}

// ---------- the rail of the three questions (E8 b): the beat in the middle of the window names its questions ----------
const rail = document.querySelector('.q-rail');
const railBeats = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('.story-argument .beat[data-q]')]);
/** @param {string} qs the beat's questions, "1", "1 2 3" or "" */
function markQuestions(qs) {
  if (!rail) return;
  const on = new Set(qs.split(/\s+/).filter(Boolean));
  for (const li of rail.querySelectorAll('li[data-q]')) {
    const here = on.has(li.getAttribute('data-q') || '');
    li.classList.toggle('on', here);
    if (here) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
  }
  rail.classList.toggle('many', on.size > 1);
}
if (rail && railBeats.length && 'IntersectionObserver' in window) {
  // a thin band across the middle of the window: the beat crossing it is the one being read
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) markQuestions(/** @type {HTMLElement} */ (e.target).dataset.q || '');
  }, { rootMargin: '-45% 0px -50% 0px' });
  for (const b of railBeats) io.observe(b);
}
