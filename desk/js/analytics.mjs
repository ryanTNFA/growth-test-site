// @ts-check
// Knowing whether and how the site is used (interface PRD v0.3, 5J), with the reader's consent, and naming ourselves on a
// few links out.
//
// Google Analytics: one loader, the tool's own (J2). It sends to TNFA's GA4 property (J1) and runs ONLY when the page is served
// from growthtest.thenewforeignassistance.org AND the reader has pressed Accept on the consent banner (Ryan, 18 November 2026:
// "a standard consent banner"). Until then nothing is fetched from Google and no cookie is set. A local copy, the replication
// package, GitHub's own address, a preview and the tests send nothing and show no banner. It also stays off, without asking, for
// an automated browser, for a browser that sends Global Privacy Control or Do Not Track, and for anyone who opened a page once
// with ?analytics=off (the team's own testing; ?analytics=on undoes it). The choice is kept in this browser for a year and can
// be changed from the footer. Google's script is the one exception to "no script over the network".
//
// What it records (J3): page views, and the events in EVENTS, each with codes from PARAMS only. What it never records (J4):
// anything a reader types. The page address is sent without the part after #, which carries a reader's own settings and notes;
// event parameters are cut to short codes, so free text cannot ride along. No user ID, no sign-in. The feedback message never
// carries an analytics ID, and "feedback_sent" carries no message id, so a visit cannot be matched to a message (J7).
//
// Other modules do not import this one: they announce an event on the window (announce() in common.mjs) and this module
// listens when it is on. Nothing at module level touches the document, so the rules below run under Node in the tests.
import { h, qs } from './common.mjs';

export const GA_ID = 'G-DY00G9KT05';
export const GA_HOST = 'growthtest.thenewforeignassistance.org';
/** J3: the event names, fixed here; tests/test_analytics.py pins them. */
export const EVENTS = ['country_open', 'area_open', 'detail_change', 'reading_change', 'compare_open', 'export', 'feedback_sent',
  'tour_step', 'outbound_tnfa'];
/** The parameters an event may carry, registered in GA4 as event-scoped custom dimensions: codes and fixed words, never text. */
export const PARAMS = ['iso', 'area', 'detail', 'reading', 'export_type', 'tour_stop'];
export const OPT_OUT_KEY = 'gt-no-analytics';
/** The reader's answer to the banner, kept in this browser: {v: 'granted' | 'denied', at: ISO date}. Asked again after a year. */
export const CONSENT_KEY = 'gt-analytics-consent';
export const CONSENT_DAYS = 365;
const CODE = /^[A-Za-z0-9_.-]{1,40}$/;
const TNFA = /(^|\.)thenewforeignassistance\.org$/;

/**
 * The stored answer: 'granted', 'denied', or null when the reader was never asked or was asked more than a year ago.
 * @param {string | null | undefined} raw the stored value @param {number} [now] milliseconds
 * @returns {'granted' | 'denied' | null}
 */
export function consentState(raw, now = Date.now()) {
  try {
    const o = JSON.parse(raw || 'null');
    if (!o || (o.v !== 'granted' && o.v !== 'denied')) return null;
    const at = Date.parse(o.at);
    return Number.isFinite(at) && now - at <= CONSENT_DAYS * 864e5 && now >= at ? o.v : null;
  } catch { return null; }
}

/**
 * Whether a page on this host may send anything: the published TNFA address, a reader who accepted, and none of the reasons
 * to stay off. @param {{host?: string, webdriver?: boolean, optOut?: boolean, signal?: boolean, consent?: string | null}} [env]
 *   signal: Global Privacy Control or Do Not Track; consent: consentState()
 */
export function analyticsOn({ host = '', webdriver = false, optOut = false, signal = false, consent = null } = {}) {
  return host === GA_HOST && !webdriver && !optOut && !signal && consent === 'granted';
}

/**
 * Whether to show the banner: only where analytics could run and the reader has not answered (or answered over a year ago).
 * @param {{host?: string, webdriver?: boolean, optOut?: boolean, signal?: boolean, consent?: string | null}} [env]
 */
export function shouldAsk({ host = '', webdriver = false, optOut = false, signal = false, consent = null } = {}) {
  return host === GA_HOST && !webdriver && !optOut && !signal && consent === null;
}

/** The page address as it is sent: without the part after #. @param {{origin: string, pathname: string, search: string}} loc */
export function cleanLocation(loc) {
  return `${loc.origin}${loc.pathname}${loc.search}`;
}

/**
 * An event's parameters, cut to the fixed list and to short codes; null for a name outside EVENTS.
 * @param {string} name @param {Record<string, any>} [params] @returns {Record<string, string> | null}
 */
export function eventParams(name, params = {}) {
  if (!EVENTS.includes(name)) return null;
  /** @type {Record<string, string>} */
  const out = {};
  for (const k of PARAMS) if (typeof params[k] === 'string' && CODE.test(params[k])) out[k] = params[k];
  return out;
}

// ---------- links out that name us (Ryan, 18 November 2026) ----------
/** The host of an absolute web address, lower case, or '' for anything else. @param {string} href */
const hostOf = (href) => { const m = /^https?:\/\/([^/?#:]+)/i.exec(String(href)); return m ? m[1].toLowerCase() : ''; };
/** Partners whose own analytics should see where a reader came from, beyond the Method page's data-provider tiles. */
export const UTM_PARTNER_HOSTS = ['growthlab.hks.harvard.edu', 'atlas.hks.harvard.edu', 'www.cgdev.org'];
/**
 * A link out, labeled with where it came from. A data provider's tile and the partners above are labeled. A link to TNFA's
 * own site is never labeled (Ryan, 18 November 2026): the tool and the site share one analytics property, where a label on a
 * link between them would overwrite how the reader first arrived, and a label kept "for now" is one nobody remembers to
 * remove. The outbound_tnfa event counts those clicks instead. Every other link (a study's DOI, an indicator's source) is
 * left exactly as it is.
 * @param {string} href @param {{place?: string, tile?: boolean}} [o] place: where on the site the link sits
 */
export function outboundHref(href, { place = '', tile = false } = {}) {
  const host = hostOf(href);
  if (!host || TNFA.test(host) || !(tile || UTM_PARTNER_HOSTS.includes(host))) return href;
  if (/[?&]utm_source=/.test(href)) return href;
  // the address is taken apart by hand: the site's path guard keeps the URL constructor out of the page modules
  const at = href.indexOf('#');
  const hash = at < 0 ? '' : href.slice(at);
  let base = at < 0 ? href : href.slice(0, at);
  if (/^https?:\/\/[^/?]+$/i.test(base)) base += '/';
  const label = 'utm_source=growthtest&utm_medium=referral&utm_campaign=growth-test-sources' +
    `${place && CODE.test(place) ? `&utm_content=${place}` : ''}`;
  return `${base}${base.includes('?') ? '&' : '?'}${label}${hash}`;
}

/**
 * Label the links out that are on the page when it is drawn (the footer, the story, the Method page's tiles), and count a
 * reader's way back to TNFA. @param {ParentNode} root @param {string} place the page's key, as utm_content
 */
export function tagOutbound(root, place) {
  for (const a of /** @type {NodeListOf<HTMLAnchorElement>} */ (root.querySelectorAll('a[href^="http"]'))) {
    const raw = a.getAttribute('href') || '';
    const next = outboundHref(raw, { place, tile: !!a.closest('.src-tile') });
    if (next !== raw) a.setAttribute('href', next);
    const host = hostOf(raw);
    if (TNFA.test(host) && host !== GA_HOST) a.addEventListener('click', () => track('outbound_tnfa', {}));
  }
}

// ---------- the loader ----------
let started = false;
let loaded = false;
let pageIso = '';
/** Send one event, if analytics is on and the name is on the list. @param {string} name @param {Record<string, any>} [params] */
export function track(name, params = {}) {
  if (!started) return false;
  const p = eventParams(name, { iso: pageIso, ...params });
  if (!p) return false;
  /** @type {any} */ (window).gtag('event', name, p);
  return true;
}

/** Whether this address is the one that is measured; the footer says so there (J5). */
export const analyticsHere = () => typeof location !== 'undefined' && location.hostname === GA_HOST;

/** What this browser says about being measured, read once. */
function environment() {
  let optOut = false; let consent = null;
  try {
    const flag = qs('analytics');
    if (flag === 'off') localStorage.setItem(OPT_OUT_KEY, '1');
    if (flag === 'on') localStorage.removeItem(OPT_OUT_KEY);
    optOut = localStorage.getItem(OPT_OUT_KEY) === '1';
    consent = consentState(localStorage.getItem(CONSENT_KEY));
  } catch { /* storage may be unavailable: the reader is asked on each page, and nothing runs without an answer */ }
  const nav = /** @type {any} */ (navigator);
  return { host: location.hostname, webdriver: nav.webdriver === true, optOut, consent,
    signal: nav.globalPrivacyControl === true || nav.doNotTrack === '1' };
}

/** Keep the reader's answer for a year. @param {'granted' | 'denied'} v */
function remember(v) {
  try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ v, at: new Date().toISOString() })); } catch { /* asked again next page */ }
}

/**
 * The consent banner: a bar at the foot of the window with two buttons of equal weight. Nothing is fetched from Google and no
 * cookie is set unless the reader presses Accept. `store` false draws it for review only (?consent=preview on any address).
 * @param {{store?: boolean}} [o] @returns {HTMLElement}
 */
export function showConsent({ store = true } = {}) {
  for (const old of document.querySelectorAll('.consent')) old.remove();
  const answer = (/** @type {'granted' | 'denied'} */ v) => {
    if (store) remember(v);
    bar.remove();
    if (!store) return;
    /** @type {any} */ (window)[`ga-disable-${GA_ID}`] = v !== 'granted'; // Google's own switch: stops sending at once
    if (v === 'granted') begin(); else started = false;
  };
  const bar = h('section', { class: 'consent', role: 'region', 'aria-label': 'Analytics consent' },
    h('div', { class: 'consent-in' },
      h('p', { class: 'consent-text' }, h('strong', {}, 'May we count your visit? '),
        'With your consent this site uses Google Analytics to see which pages and features people use. It sets cookies in your browser. ' +
        'Nothing you type is sent, and feedback stays anonymous. ',
        h('a', { href: 'https://policies.google.com/technologies/partner-sites', target: '_blank', rel: 'noopener' },
          'How Google uses that information')),
      h('div', { class: 'consent-actions' },
        h('button', { class: 'btn', type: 'button', onclick: () => answer('denied') }, 'Decline'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => answer('granted') }, 'Accept'))));
  document.body.append(bar);
  return bar;
}

/** Load Google's script and send the page view and the page's own events. Only ever called after consent. */
function begin() {
  started = true;
  if (loaded) return; // accepted, declined and accepted again: the script and the listeners are set up once
  loaded = true;
  const w = /** @type {any} */ (window);
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag() { w.dataLayer.push(arguments); }; // Google's own queue, as its snippet writes it
  w.gtag('js', new Date());
  // no automatic page view: the one sent here carries the address without the part after #
  w.gtag('config', GA_ID, { send_page_view: false, page_location: cleanLocation(location) });
  w.gtag('event', 'page_view', { page_location: cleanLocation(location), page_title: document.title });
  const load = () => {
    if (document.querySelector('script[data-gt-analytics]')) return;
    const s = document.createElement('script');
    s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`; s.setAttribute('data-gt-analytics', '');
    document.head.append(s);
  };
  if (document.readyState === 'complete') load(); else window.addEventListener('load', load, { once: true });

  // what the page itself says: which country, area or comparison was opened
  const page = document.body.dataset.page || '';
  pageIso = (qs('iso') || (qs('isos') || '').split(',')[0] || '').toUpperCase();
  if (page === 'bottom' && pageIso) track('country_open');
  if (page === 'area' && pageIso) track('area_open', { area: qs('area') || '' });
  if (page === 'compare') track('compare_open');
  // what the reader does: the events other modules already announce on the window
  window.addEventListener('desk-detail', (e) => track('detail_change', { detail: /** @type {CustomEvent} */ (e).detail.detail }));
  window.addEventListener('desk-setting', (e) => track('reading_change', { reading: /** @type {CustomEvent} */ (e).detail.setting }));
  window.addEventListener('gt-track', (e) => { const d = /** @type {CustomEvent} */ (e).detail || {}; track(d.name, d); });
}

/**
 * On every page: start measuring where the reader has accepted, ask where they have not answered, and do nothing anywhere
 * else. Returns 'on', 'asked' or 'off'.
 */
export function startAnalytics() {
  if (started || typeof window === 'undefined') return started ? 'on' : 'off';
  if (qs('consent') === 'preview') { showConsent({ store: false }); return 'off'; } // the banner alone, for review on any address
  const env = environment();
  if (analyticsOn(env)) { begin(); return 'on'; }
  if (shouldAsk(env)) { showConsent(); return 'asked'; }
  return 'off';
}

/** The footer's "Change your choice": ask again, whatever was answered before. */
export function reopenConsent() {
  try { localStorage.removeItem(CONSENT_KEY); } catch { /* nothing stored */ }
  showConsent();
}
