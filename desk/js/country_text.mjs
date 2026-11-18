// @ts-check
// The Bottom line's words, DOM-free (Growth Test PRD D1, D3): the one sentence that answers the page's question, and the
// three lists' areas, both read from bottomLine() in card.mjs. tests/test_desk_pages.py runs this under Node on Kenya's file
// and checks the lists match the engine's statements (ruled out and probably not; worth a closer look; the unclear groups).
import { englishList, cannotTellCode, CANNOT_TELL_PLAIN } from './common.mjs';

/** The area a Bottom line item is named by: a roll-up (micro risk) is named by the sub-area that sets its rating. */
export function itemName(x) { return x.ev !== x.node ? `${x.evShort} (under ${x.short})` : x.short; }

/**
 * The three lists' area ids, in the order the current Bottom line shows them: stop (ruled out, then probably not),
 * look (worth a closer look), unclear (grouped: one kind, mixed, data gap, tool gap, sector study, elimination).
 * @param {any} bl the result of bottomLine()
 * @returns {{stop: string[], look: string[], unclear: string[]}}
 */
export function listAreas(bl) {
  const g = bl.groups;
  return {
    stop: [...bl.ruled, ...bl.probNot].map((x) => x.id),
    look: bl.look.map((x) => x.id),
    unclear: [...g.oneKind, ...g.mixed, ...g.dataGap, ...g.toolGap, ...g.sector, ...g.elimination].map((x) => x.id),
  };
}

/**
 * The one sentence first (D1), in the tool's voice: where the public data point first, what they argue against, and how
 * much they cannot settle. Never a verdict and never "fund this"; the lists below carry the caveats.
 * @param {any} bl the result of bottomLine()
 * @param {string} country the economy's name
 * @returns {string}
 */
export function answerSentence(bl, country) {
  const look = englishList(bl.look.map(itemName));
  const stops = englishList([...bl.ruled, ...bl.probNot].map((x) => x.short));
  const n = bl.nUnclear, total = bl.nAreas;
  const unclear = n === total ? `all ${total} areas are unclear` : `${n} of ${total} areas stay unclear`;
  const fork = forkClause(bl);
  if (bl.look.length && stops.length) {
    return `The public data point first to ${look}, worth a closer look, argue against ${stops}, and cannot settle the other ` +
      `${n} of ${total} areas${fork}.`;
  }
  if (bl.look.length) return `The public data point first to ${look}, worth a closer look; nothing is ruled out for ${country} yet, and ${unclear}${fork}.`;
  if (stops.length) return `The public data argue against ${stops} as what holds investment back in ${country}; no area stands out yet, and ${unclear}${fork}.`;
  return `The public data point to no area and rule none out for ${country} yet: ${unclear}, each for a reason given below${fork}.`;
}

/** The first decision's clause for the one sentence, only when the fork leans: "; at the first fork they lean to costly finance". */
function forkClause(bl) {
  const f = bl.fork; if (!f || !f.side) return '';
  const strong = f.node.tier === 'likely_binding' || f.node.tier === 'ruled_out';
  return `; at the first fork they ${strong ? 'point' : 'lean'} to ${f.side === 'finance' ? 'costly finance' : 'low returns'}`;
}

/** The three quick statistics of the first-decision table, read beside the four tests. */
const QUICK_STATS = {
  finance_supply: { finance: 'agree: a high real lending rate, slow credit growth and low investment', returns: 'point to finance instead: a high real lending rate, slow credit growth and low investment', none: 'point to finance: a high real lending rate, slow credit growth and low investment' },
  low_demand: { finance: 'point to low returns instead: a low real lending rate, slow credit growth and low investment', returns: 'agree: a low real lending rate, slow credit growth and low investment', none: 'point to low returns: a low real lending rate, slow credit growth and low investment' },
  credit_boom_no_investment: 'conflict: credit grew fast without investment following',
  not_investment_constrained: 'question the premise: investment is not low for this income',
  investment_without_finance: 'show investment without bank credit, likely public or foreign-led',
  indeterminate: 'fall between the table’s rows',
};
/**
 * The first decision's own line, above the three lists (D1, D3): which side the four finance tests point to, with the fact that
 * carries it, and whether the three quick statistics agree. A direction, never a rating: both sides of the fork are constraints.
 * @param {any} bl the result of bottomLine()
 * @param {string} country the economy's name
 * @param {string | null | undefined} row the top_split row of the scorecard ('finance_supply', 'low_demand', …)
 * @returns {string}
 */
export function forkSentence(bl, country, row) {
  const f = bl.fork; if (!f || !f.node) return '';
  const t = f.node.tier; const strong = t === 'likely_binding' || t === 'ruled_out';
  let lead;
  if (f.side === 'finance') lead = `For ${country}, the four finance tests ${strong ? 'point to costly finance' : 'lean to costly finance (not established)'}${f.toward ? `: ${f.toward.text}` : ''}.`;
  else if (f.side === 'returns') lead = `For ${country}, the four finance tests ${strong ? 'point to low returns' : 'lean to low returns (moderate confidence)'}: finance looks cheap and available${f.away ? `, ${f.away.text}` : ''}.`;
  else { const code = cannotTellCode(f.node); lead = `For ${country}, the four finance tests cannot tell which side${code ? ` (${CANNOT_TELL_PLAIN[code].label})` : ''}.`; }
  const qs = row && QUICK_STATS[row]; const q = typeof qs === 'string' ? qs : qs ? qs[f.side || 'none'] : null;
  return q ? `${lead} The three quick statistics ${q}.` : lead;
}

// ---------- the country overview (interface PRD v0.3, 5B and E9 c), DOM-free so tests can sweep every economy ----------

/** An area's name inside a sentence: the sub-area that sets a roll-up's rating, lowercased unless it starts with an acronym. */
export function headlineName(x) {
  const s = x.ev !== x.node ? x.evShort : x.short;
  return String(s).replace(/\?$/, '').replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase());
}

/**
 * B4: the flagged areas, strongest evidence first: the number of tests that agree, then the net score. Ordering inside one
 * economy only; countries, sectors and programs are never ranked.
 * @param {any[]} look bottomLine().look
 */
export function strongestFirst(look) {
  const C = (x) => (x.ev && x.ev.C) ?? (x.node && x.node.C) ?? 0;
  const N = (x) => (x.ev && x.ev.N) ?? (x.node && x.node.N) ?? 0;
  return look.slice().sort((a, b) => C(b) - C(a) || N(b) - N(a));
}

/**
 * B1: the answer block's headline, at most fourteen words and at most two areas named; where nothing is flagged it says so.
 * Never "fund", "should" or "the binding constraint is" (tests/test_desk_pages.py).
 * @param {any} bl the result of bottomLine()
 * @param {string} country
 */
export function overviewHeadline(bl, country) {
  const look = strongestFirst(bl.look);
  if (!look.length) return `No area stands out for ${country} yet.`;
  const named = look.slice(0, 2).map(headlineName);
  const rest = look.length - named.length;
  const WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  return `Look first at ${englishList(named)}${rest ? `, then ${WORDS[rest] || rest} more` : ''}.`;
}

/**
 * B1: the three counts, in equal type: worth a closer look, the data argue against, unclear. They come from the same
 * bottomLine() as the lists, so the overview can never count differently from the engine's tiers.
 * @param {any} bl
 * @returns {{look: number, against: number, unclear: number}}
 */
export function overviewCounts(bl) {
  return { look: bl.look.length, against: bl.ruled.length + bl.probNot.length, unclear: bl.nUnclear };
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** "2026-10-24" → "October 2026". */
export function monthYear(snapshotId) {
  const m = String(snapshotId || '').match(/^(\d{4})-(\d{2})/);
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : String(snapshotId || '');
}

/** B1: the caveat line, never folded (tenet 2). */
export function caveatLine(snapshotId) {
  return `Not established: a first read of public data to ${monthYear(snapshotId)}.`;
}

/**
 * E9 c: the transition the reading is about, from the growth problem the engine already classifies. Three transitions:
 * getting out of a collapse, speeding up, keeping an acceleration going. A rich economy's modest pace is its own case.
 */
export const TRANSITION = {
  collapse_recovery: 'getting out of a collapse', never_recovered: 'getting out of a collapse',
  stuck: 'speeding up', steady: 'speeding up', slowdown: 'speeding up again', volatile: 'speeding up and holding it',
  acceleration: 'keeping an acceleration going', growing: 'keeping an acceleration going',
  high_income_pace: 'keeping growth going at a high income',
};

/**
 * E9 c: one line under the answer: the transition, and that what binds one transition need not bind another. Null where the
 * growth record names no pattern (too few years, or none fits).
 * @param {string | null | undefined} classification growth_problem.classification
 * @param {string} meaning the pattern's meaning in words (growth_read.mjs PATTERN)
 */
export function transitionLine(classification, meaning) {
  const t = TRANSITION[String(classification || '')];
  if (!t) return null;
  return `The question here is ${t}: ${meaning}. What binds one transition need not bind another.`;
}
