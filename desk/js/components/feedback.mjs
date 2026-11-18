// @ts-check
// Feedback, built into the page (Beta, 13 November 2026). Three ways in, one message format, one receiver (feedback/Code.gs):
//   a Feedback button on every page (shell.mjs) and any element marked data-feedback: a note, with a screenshot if wanted;
//   "Does this look right?" on every rating card (card.mjs): one tap, with a sentence if wanted;
//   "Send this reading to the team" beside an override (card.mjs): the reader's own rating and the reason they gave.
// Every message carries where the reader was (the page address holds the country, the area, the reading and the comparison
// set) so nobody has to describe it. Nothing is sent until the reader presses a button; there are no cookies and no tracking.
// Nothing at module level touches the document, so the message builders run under Node in the tests.
import { h, readHash, HASH } from '../common.mjs';
import { FEEDBACK_ENDPOINT, FEEDBACK_EMAIL } from '../feedback_config.mjs';

export const KINDS = ['note', 'rating_check', 'reading'];
export const ANSWERS = [['yes', 'Yes'], ['no', 'No'], ['unsure', 'Not sure']];
const MAX_NOTE = 4000;
const SHOT_MAX_PX = 1600;
const clip = (v, n = 200) => (v == null ? '' : String(v).trim().slice(0, n));

/** A short id the receiver uses to drop a message that arrives twice. */
export function newId() {
  const r = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${r}`;
}

/**
 * Where the reader is, read from the page: its address (which holds the country, area, reading and comparison set), the
 * country's name as the bar shows it, the rubric line in the footer, and the window size. All of it is on screen already.
 * @returns {Record<string, string>}
 */
export function pageContext() {
  if (typeof document === 'undefined') return {};
  const text = (id) => { const el = document.getElementById(id); return el ? clip(el.textContent, 120) : ''; };
  const hash = readHash();                            // common.mjs is the only reader of the URL hash (C4)
  const rubric = /rubric\s+([0-9.]+)/i.exec(text('versions') || document.body.textContent || '');
  return {
    page: clip(location.href, 600),
    country: text('nav-country-name'),
    reading: hash.get(HASH.setting) || 'standard',
    compared_with: hash.get(HASH.peers) != null ? 'custom' : (hash.get(HASH.set) || 'structural'),
    rubric: rubric ? rubric[1] : '',
    screen: `${window.innerWidth}x${window.innerHeight}`,
    user_agent: clip(navigator.userAgent, 300),
  };
}

/**
 * The message the receiver gets. `fields` may carry answer, note, reply_to, area, area_name, tool_rating, their_rating,
 * screenshot (a data URL) and website (the trap field a person never fills).
 * @param {string} kind @param {Record<string, any>} [fields] @param {Record<string, string>} [ctx] @param {string} [id]
 */
export function buildPayload(kind, fields = {}, ctx = pageContext(), id = newId()) {
  if (!KINDS.includes(kind)) throw new Error(`unknown feedback kind: ${kind}`);
  const out = { id, kind, ...ctx };
  for (const k of ['answer', 'reply_to', 'area', 'area_name', 'tool_rating', 'their_rating', 'website']) {
    const v = clip(fields[k]);
    if (v) out[k] = v;
  }
  const note = clip(fields.note, MAX_NOTE);
  if (note) out.note = note;
  if (typeof fields.screenshot === 'string' && fields.screenshot.startsWith('data:image/')) out.screenshot = fields.screenshot;
  return out;
}

/**
 * Send one message. The body goes as text/plain so the browser asks no permission first. If the browser will not show the
 * reply across sites, the message is sent again without asking to read it; the receiver drops the second copy by its id.
 * @param {Record<string, any>} payload
 * @param {{endpoint?: string, fetchFn?: typeof fetch}} [opts]
 * @returns {Promise<{ok: boolean, reason?: string, unconfirmed?: boolean}>}
 */
export async function sendFeedback(payload, { endpoint = FEEDBACK_ENDPOINT, fetchFn = globalThis.fetch } = {}) {
  if (!endpoint) return { ok: false, reason: 'not_connected' };
  const body = JSON.stringify(payload);
  const headers = { 'Content-Type': 'text/plain;charset=utf-8' };
  try {
    const r = await fetchFn(endpoint, { method: 'POST', body, headers, redirect: 'follow' });
    const j = await r.json().catch(() => null);
    if (j && j.ok) return { ok: true };
    if (j) return { ok: false, reason: j.error || 'server' };
    return r.ok ? { ok: true, unconfirmed: true } : { ok: false, reason: 'server' };
  } catch {
    try {
      await fetchFn(endpoint, { method: 'POST', body, headers, mode: 'no-cors' });
      return { ok: true, unconfirmed: true };
    } catch {
      return { ok: false, reason: 'network' };
    }
  }
}

/** The same details as an email, for when the receiver is not connected or a message will not send. @param {Record<string, any>} p */
export function mailtoHref(p) {
  const about = [p.country, p.area_name, p.tool_rating].filter(Boolean).join(' · ');
  const lines = [p.note || '', '', p.answer ? `Does this look right? ${p.answer}` : '', p.their_rating ? `My rating: ${p.their_rating}` : '',
    about ? `About: ${about}` : '', `Page: ${p.page || ''}`, p.rubric ? `Rubric ${p.rubric}` : ''].filter((x, i) => x || i === 1);
  const subject = `The Growth Test (Beta): feedback${about ? ` on ${about}` : ''}`;
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
}

// ---------- screenshots: attached, pasted, or one frame of this tab; resized in the browser before anything is sent ----------

/** An image file or blob as a JPEG data URL no wider or taller than SHOT_MAX_PX. @param {Blob} blob @returns {Promise<string>} */
async function shrinkImage(blob) {
  const bmp = await createImageBitmap(blob);
  return frameToDataUrl(bmp, bmp.width, bmp.height);
}
/** @param {CanvasImageSource} src @param {number} w @param {number} hgt */
function frameToDataUrl(src, w, hgt) {
  const k = Math.min(1, SHOT_MAX_PX / Math.max(w, hgt));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * k);
  canvas.height = Math.round(hgt * k);
  const g = canvas.getContext('2d');
  if (!g) throw new Error('no canvas');
  g.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
}
const canCapture = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function';
/** One frame of what the reader chooses to share (the browser asks them which tab or window), then the capture stops. */
async function captureFrame() {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  try {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    return frameToDataUrl(video, video.videoWidth, video.videoHeight);
  } finally {
    for (const t of stream.getTracks()) t.stop();
  }
}

// ---------- the box ----------

const TITLES = { note: 'Tell us what looks off', rating_check: 'Why does this look wrong, or right?', reading: 'Send your reading to the team' };
const SENT = 'Sent. Thank you: someone at The New Foreign Assistance reads every one.';

/**
 * Open the feedback box. `opts.kind` is 'note' by default; `opts.fields` carries what the caller already knows (the area,
 * the tool's rating, the reader's answer or rating); `opts.note` pre-fills the text. `opts.title`, `opts.label` and
 * `opts.placeholder` reword the box for a caller with a narrower question (a data source for an empty test); the message
 * and its fields are the same.
 * @param {{kind?: string, fields?: Record<string, any>, note?: string, title?: string, label?: string, placeholder?: string}} [opts]
 */
export function openFeedback(opts = {}) {
  const kind = opts.kind || 'note';
  const fields = { ...(opts.fields || {}) };
  const ctx = pageContext();
  const about = [ctx.country, fields.area_name, fields.tool_rating].filter(Boolean).join(' · ');
  let shot = '';
  let capturing = false;                              // the box closes for a moment so it is not in the picture
  for (const old of document.querySelectorAll('dialog.fb-dialog')) old.remove();   // never two boxes
  // close and remove in one step: the dialog's own close event is not relied on (a background tab may delay it)
  const shut = () => { if (dialog.open) dialog.close(); dialog.remove(); };

  const note = h('textarea', { id: 'fb-note', rows: '5', maxlength: String(MAX_NOTE),
    placeholder: opts.placeholder || 'What did you expect, and what did you see instead?' }, opts.note || '');
  const email = h('input', { id: 'fb-email', type: 'email', autocomplete: 'email', placeholder: 'you@example.org' });
  const trap = h('input', { class: 'fb-trap', type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' });
  const status = h('p', { class: 'fb-status small', role: 'status', 'aria-live': 'polite' });
  const preview = h('div', { class: 'fb-shot', hidden: true });
  const setShot = (dataUrl) => {
    shot = dataUrl || '';
    preview.hidden = !shot;
    preview.replaceChildren(...(shot ? [h('img', { src: shot, alt: 'The screenshot you are attaching' }),
      h('button', { class: 'btn quiet small', type: 'button', onclick: () => setShot('') }, 'Remove')] : []));
  };
  const take = async (get) => {
    try { setShot(await get()); status.textContent = ''; } catch { status.textContent = 'That image could not be added. You can still send the note.'; }
  };
  const file = h('input', { id: 'fb-file', class: 'visually-hidden', type: 'file', accept: 'image/*',
    onchange: (e) => { const f = e.target.files && e.target.files[0]; if (f) take(() => shrinkImage(f)); } });
  const send = h('button', { class: 'btn primary', type: 'submit' }, 'Send');
  const cancel = h('button', { class: 'btn quiet', type: 'button', onclick: shut }, 'Cancel');
  const capture = canCapture() ? h('button', { class: 'btn quiet small', type: 'button', onclick: async () => {
    capturing = true;
    dialog.close();
    await take(captureFrame);
    capturing = false;
    dialog.showModal();
  } }, 'Capture this page') : null;

  const form = h('form', { class: 'fb-form', method: 'dialog', onsubmit: async (e) => {
    e.preventDefault();
    const payload = buildPayload(kind, { ...fields, note: note.value, reply_to: email.value, screenshot: shot, website: trap.value }, ctx);
    if (kind === 'note' && !payload.note && !payload.screenshot) { status.textContent = 'Write a line or add a screenshot first.'; return; }
    send.disabled = true;
    status.textContent = 'Sending…';
    const r = await sendFeedback(payload);
    if (r.ok) {
      form.replaceChildren(h('p', { class: 'fb-done' }, SENT), h('div', { class: 'fb-actions' },
        h('button', { class: 'btn primary', type: 'button', onclick: shut }, 'Close')));
      return;
    }
    send.disabled = false;
    status.replaceChildren(r.reason === 'not_connected' ? 'The feedback box is not connected yet. ' : 'That did not send. ',
      h('a', { href: mailtoHref(payload) }, 'Send it as an email instead'), shot ? ' (attach the screenshot yourself).' : '.');
  } },
  h('h2', { id: 'fb-title' }, opts.title || TITLES[kind] || TITLES.note),
  about ? h('p', { class: 'fb-about small' }, 'About: ', h('strong', {}, about)) : null,
  fields.answer ? h('p', { class: 'small' }, 'Your answer: ', h('strong', {}, (ANSWERS.find((a) => a[0] === fields.answer) || [])[1] || fields.answer)) : null,
  h('label', { for: 'fb-note' }, opts.label || (kind === 'note' ? 'Your note' : 'A sentence on why (optional)')), note,
  h('div', { class: 'fb-row' }, capture, h('label', { class: 'btn quiet small', for: 'fb-file' }, 'Attach an image'), file,
    h('span', { class: 'small muted' }, 'or paste one here')),
  preview,
  h('label', { for: 'fb-email' }, 'Email, only if you want a reply (optional)'), email, trap,
  h('p', { class: 'fb-privacy small muted' }, 'We receive what you write, this page’s address and settings, your browser’s name and window size, and ' +
    'the screenshot if you add one. Nothing else, and nothing until you press Send.'),
  status,
  h('div', { class: 'fb-actions' }, send, cancel));

  const dialog = /** @type {HTMLDialogElement} */ (h('dialog', { class: 'fb-dialog', 'aria-labelledby': 'fb-title' }, form));
  dialog.addEventListener('paste', (e) => {
    const item = [...((e.clipboardData && e.clipboardData.items) || [])].find((x) => x.type.startsWith('image/'));
    const blob = item && item.getAsFile();
    if (blob) { e.preventDefault(); take(() => shrinkImage(blob)); }
  });
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); shut(); });   // Esc
  dialog.addEventListener('close', () => { if (!capturing) dialog.remove(); });
  document.body.append(dialog);
  dialog.showModal();
  note.focus();
  return dialog;
}

/**
 * "Does this look right?" for one rating: three buttons. A tap sends the answer at once; the line then offers a sentence.
 * While the receiver is not connected, a tap opens the box with the answer filled in.
 * @param {{area: string, area_name: string, tool_rating: string}} about
 */
export function ratingCheck(about) {
  const line = h('div', { class: 'fb-check', role: 'group', 'aria-label': 'Does this rating look right?' });
  const ask = () => line.replaceChildren(h('span', { class: 'fb-check-q' }, 'Does this look right?'),
    ...ANSWERS.map(([key, label]) => h('button', { class: 'btn quiet small', type: 'button', onclick: () => answer(key, label) }, label)));
  const answer = async (key, label) => {
    const fields = { ...about, answer: key };
    const why = () => openFeedback({ kind: 'rating_check', fields });
    if (!FEEDBACK_ENDPOINT) { why(); return; }
    line.replaceChildren(h('span', { class: 'fb-check-q' }, 'Sending…'));
    const r = await sendFeedback(buildPayload('rating_check', fields));
    line.replaceChildren(h('span', { class: 'fb-check-q' }, r.ok ? `Noted: ${label.toLowerCase()}. Thank you.` : 'That did not send.'),
      h('button', { class: 'btn quiet small', type: 'button', onclick: why }, r.ok ? 'Say why' : 'Try the form'));
  };
  ask();
  return line;
}

/**
 * "Send this reading to the team": the reader's own rating for an area and the reason they wrote, as one message.
 * @param {{area: string, area_name: string, tool_rating: string, their_rating: string, note: string}} reading
 */
export function sendReadingButton(reading) {
  const wrap = h('div', { class: 'fb-check' });
  const btn = h('button', { class: 'btn quiet small', type: 'button', onclick: async () => {
    if (!FEEDBACK_ENDPOINT) { openFeedback({ kind: 'reading', fields: reading, note: reading.note }); return; }
    btn.disabled = true;
    const r = await sendFeedback(buildPayload('reading', reading));
    wrap.replaceChildren(h('span', { class: 'fb-check-q' }, r.ok ? 'Sent to the team. Thank you.' : 'That did not send.'),
      r.ok ? '' : h('button', { class: 'btn quiet small', type: 'button', onclick: () => openFeedback({ kind: 'reading', fields: reading,
        note: reading.note }) }, 'Try the form'));
  } }, 'Send this reading to the team');
  wrap.append(btn, h('span', { class: 'small muted' }, 'Your rating and note go to The New Foreign Assistance; nothing else does.'));
  return wrap;
}
