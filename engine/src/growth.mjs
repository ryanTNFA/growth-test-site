// growth.mjs — Stage 0 statistics (G1–G7, G10–G12) and the Growth Problem Statement.
// Pure ES module: no Node built-ins. Windows and classification bounds from params.growth_problem.
import { isNum, mean, median, sd, percentileRank, huberIRLS } from './stats.mjs';
import { yearsOf } from './reference.mjs';
import { MIN_REGION_SIZE_FOR_DUMMY } from './icr.mjs';
import { TOP_SPLIT_LABELS, RATE_SOURCES } from './topsplit.mjs';

const GROWTH = 'NY.GDP.PCAP.KD.ZG';
const LEVEL = 'NY.GDP.PCAP.KD';
const PPP = 'NY.GDP.PCAP.PP.KD';

/** |t| below this reads "at expectation": it would print as 0.0 standard deviations anyway (v0.1.1, C6). */
export const AT_EXPECTATION_ABS_T = 0.05;

function cmp(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function f1(x) {
  return isNum(x) ? (Math.round(x * 10) / 10).toFixed(1) : 'n/a';
}

// ---------------------------------------------------------------------------
// Country names in prose (v0.1.1, engine-run-issues C6). The World Bank short names are
// kept everywhere else; only the statement uses these forms.
// ---------------------------------------------------------------------------

/** Names that take the definite article in running text. */
export const THE_NAMES = new Set([
  'Philippines',
  'Gambia',
  'Bahamas',
  'Netherlands',
  'United States',
  'United Kingdom',
  'Comoros',
  'Maldives',
  'Marshall Islands',
  'Solomon Islands',
  'Czech Republic',
  'Dominican Republic',
  'Central African Republic',
  'Democratic Republic of Congo',
  'Republic of Congo',
  'United Arab Emirates',
  'Kyrgyz Republic',
  'Slovak Republic',
  'Lao PDR',
  'Isle of Man',
  'West Bank and Gaza',
]);

/** World Bank comma-form names rewritten for prose (with the article where it belongs). */
export const PROSE_NAMES = {
  'Bahamas, The': 'the Bahamas',
  'Gambia, The': 'the Gambia',
  'Congo, Dem. Rep.': 'the Democratic Republic of Congo',
  'Congo, Rep.': 'the Republic of Congo',
  'Egypt, Arab Rep.': 'Egypt',
  'Iran, Islamic Rep.': 'Iran',
  'Korea, Rep.': 'the Republic of Korea',
  "Korea, Dem. People's Rep.": "the Democratic People's Republic of Korea",
  'Micronesia, Fed. Sts.': 'the Federated States of Micronesia',
  'Somalia, Fed. Rep.': 'Somalia',
  'Venezuela, RB': 'Venezuela',
  'Yemen, Rep.': 'Yemen',
  'Puerto Rico (US)': 'Puerto Rico',
};

/**
 * The form of a country name used mid-sentence: the explicit map first; then "the" for the
 * names in THE_NAMES and for any name containing "Republic", "Islands" or "States"; otherwise
 * the name as given. Never used at the start of a sentence.
 */
export function proseName(name) {
  if (!name) return name;
  if (Object.prototype.hasOwnProperty.call(PROSE_NAMES, name)) return PROSE_NAMES[name];
  if (/^the\s/i.test(name)) return name;
  if (THE_NAMES.has(name) || /\b(Republic|Islands|States)\b/.test(name)) return `the ${name}`;
  return name;
}

/**
 * Average of the observations in the n calendar years ending at endYear
 * (endYear − n + 1 .. endYear). Requires at least half of the years; returns
 * {mean, n_years, n_obs, years: [first, last]} with mean null when too few.
 */
export function windowAverage(byYear, endYear, n) {
  const vals = [];
  let first = null;
  let last = null;
  for (let y = endYear - n + 1; y <= endYear; y++) {
    const v = byYear && byYear[y];
    if (!isNum(v)) continue;
    vals.push(v);
    if (first === null) first = y;
    last = y;
  }
  const enough = vals.length >= Math.ceil(n / 2);
  return { mean: enough ? mean(vals) : null, n_years: n, n_obs: vals.length, years: first === null ? null : [first, last] };
}

/** Sample sd of the observations in the n calendar years ending at endYear (needs at least half). */
export function windowSd(byYear, endYear, n) {
  const vals = [];
  for (let y = endYear - n + 1; y <= endYear; y++) {
    const v = byYear && byYear[y];
    if (isNum(v)) vals.push(v);
  }
  return { sd: vals.length >= Math.ceil(n / 2) && vals.length >= 2 ? sd(vals) : null, n_obs: vals.length };
}

/** Peak-to-date of a level series: {peak_year, peak_value, latest_year, latest_value, years_since_peak, shortfall_pct}. */
export function peakToDate(byYear) {
  const years = yearsOf(byYear);
  if (!years.length) return null;
  let peakYear = years[0];
  for (const y of years) if (byYear[y] > byYear[peakYear]) peakYear = y;
  const latest = years[years.length - 1];
  const peak = byYear[peakYear];
  return {
    peak_year: peakYear,
    peak_value: peak,
    latest_year: latest,
    latest_value: byYear[latest],
    years_since_peak: latest - peakYear,
    shortfall_pct: peak > 0 ? (100 * (peak - byYear[latest])) / peak : null,
    series_start: years[0],
  };
}

/**
 * The first year income per person reached roughly today's level (within tolerancePct percent below the latest
 * value): {year, years_since, below_series_start}. below_series_start is true when the first year of the record
 * was strictly above today's level, so income is lower now than when the record begins (rubric 0.3.0).
 */
export function levelFirstReached(byYear, tolerancePct) {
  const years = yearsOf(byYear);
  if (!years.length) return null;
  const latest = years[years.length - 1];
  const now = byYear[latest];
  if (!isNum(now) || now <= 0) return null;
  const floor = now * (1 - tolerancePct / 100);
  const year = years.find((y) => byYear[y] >= floor);
  return { year, years_since: latest - year, below_series_start: byYear[years[0]] > now, series_start: years[0] };
}

/**
 * The growth record in eras (rubric 0.3.0, replacing the single break across the whole series): the least-squares
 * partition of growth since startYear into at most maxBreaks + 1 eras, each holding at least minYears observations,
 * keeping the largest number of breaks for which every era differs from the one before by at least minChange
 * points. One bad year (2020) cannot be an era of its own. Workbook 4.3 asks for Bai-Perron or Kar-Pritchett-Raihan-
 * Sen breaks; this is that partition with a fixed minimum size and a minimum shift in place of a test statistic.
 * Returns {eras: [{from, to, mean, n_obs}], n_obs}.
 */
export function growthEras(byYear, { startYear, endYear, minYears, minChange, maxBreaks }) {
  const years = yearsOf(byYear).filter((y) => y >= startYear && (endYear == null || y <= endYear));
  const v = years.map((y) => byYear[y]);
  const n = v.length;
  if (n < minYears) return { eras: [], n_obs: n };
  const P = [0];
  const Q = [0];
  for (let i = 0; i < n; i++) {
    P.push(P[i] + v[i]);
    Q.push(Q[i] + v[i] * v[i]);
  }
  const mean = (i, j) => (P[j] - P[i]) / (j - i);
  const cost = (i, j) => Q[j] - Q[i] - ((P[j] - P[i]) * (P[j] - P[i])) / (j - i);
  const era = (i, j) => ({ from: years[i], to: years[j - 1], mean: mean(i, j), n_obs: j - i });
  const most = Math.min(maxBreaks, Math.floor(n / minYears) - 1);
  for (let k = most; k >= 1; k--) {
    // best[s][j]: the least cost of v[0..j) in s + 1 eras; cut[s][j]: where the last of them starts
    const best = [];
    const cut = [];
    for (let s = 0; s <= k; s++) {
      best.push(new Array(n + 1).fill(Infinity));
      cut.push(new Array(n + 1).fill(-1));
    }
    for (let j = minYears; j <= n; j++) best[0][j] = cost(0, j);
    for (let s = 1; s <= k; s++) {
      for (let j = (s + 1) * minYears; j <= n; j++) {
        for (let i = s * minYears; i <= j - minYears; i++) {
          const c = best[s - 1][i] + cost(i, j);
          if (c < best[s][j]) {
            best[s][j] = c;
            cut[s][j] = i;
          }
        }
      }
    }
    if (!Number.isFinite(best[k][n])) continue;
    const bounds = [n];
    for (let s = k, j = n; s >= 1; s--) {
      j = cut[s][j];
      bounds.unshift(j);
    }
    bounds.unshift(0);
    const eras = [];
    for (let e = 0; e + 1 < bounds.length; e++) eras.push(era(bounds[e], bounds[e + 1]));
    if (eras.every((x, e) => e === 0 || Math.abs(x.mean - eras[e - 1].mean) >= minChange)) return { eras, n_obs: n };
  }
  return { eras: [era(0, n)], n_obs: n };
}

/**
 * G4 from the eras: the eras themselves, and, for the fields the Scorecard has always carried, the latest break
 * (the first year of the last era, against the era before it); reported when there are at least two eras.
 */
export function erasBlock(byYear, endYear, gp) {
  const r = growthEras(byYear, {
    startYear: gp.eras_start_year,
    endYear,
    minYears: gp.eras_min_years,
    minChange: gp.eras_min_change_pp,
    maxBreaks: gp.eras_max_breaks,
  });
  const out = {
    method: `eras since ${gp.eras_start_year}: least-squares breaks, each era at least ${gp.eras_min_years} years, each at least ${gp.eras_min_change_pp} points from the one before`,
    start_year: gp.eras_start_year,
    eras: r.eras,
    reported: r.eras.length >= 2,
    break_year: null,
    mean_before: null,
    mean_after: null,
    change_pp: null,
    n_obs: r.n_obs,
  };
  if (out.reported) {
    const a = r.eras[r.eras.length - 2];
    const b = r.eras[r.eras.length - 1];
    out.break_year = b.from;
    out.mean_before = a.mean;
    out.mean_after = b.mean;
    out.change_pp = b.mean - a.mean;
    out.direction = out.change_pp < 0 ? 'deceleration' : 'acceleration';
  }
  return out;
}

/**
 * Simplified single-break test on a growth series (rubric 0.1 to 0.2.9; kept for reference, no longer called): the
 * split year maximizing |mean(after) − mean(before)| with both segments holding at least minSegment observations;
 * reported only if the change ≥ minChange percentage points.
 */
export function singleBreak(byYear, minSegment, minChange) {
  const years = yearsOf(byYear);
  const vals = years.map((y) => byYear[y]);
  const n = vals.length;
  const out = { method: 'single-break simplified', reported: false, break_year: null, mean_before: null, mean_after: null, change_pp: null, n_obs: n };
  if (n < 2 * minSegment) return out;
  const prefix = [0];
  for (let i = 0; i < n; i++) prefix.push(prefix[i] + vals[i]);
  let best = null;
  for (let s = minSegment; s <= n - minSegment; s++) {
    const before = prefix[s] / s;
    const after = (prefix[n] - prefix[s]) / (n - s);
    const diff = after - before;
    if (!best || Math.abs(diff) > Math.abs(best.diff)) best = { s, before, after, diff };
  }
  if (!best) return out;
  out.break_year = years[best.s];
  out.mean_before = best.before;
  out.mean_after = best.after;
  out.change_pp = best.diff;
  out.reported = Math.abs(best.diff) >= minChange;
  out.direction = best.diff < 0 ? 'deceleration' : 'acceleration';
  return out;
}

/**
 * Universe-level Stage 0 inputs, computed once per run:
 *   g10/g20 per economy, sd over the volatility window, and the convergence regression
 *   (Huber, 10-year average growth on log initial GDP per capita PPP with region dummies).
 */
export function growthUniverse({ series, countries, params, snapshotYear }) {
  const gp = params.growth_problem;
  const [w10, w20] = gp.growth_windows_years;
  const growth = series[GROWTH] || {};
  const ppp = series[PPP] || {};
  // v0.1.2: the windows end at the latest year with any growth observation in the universe
  // (window_anchor = latest_observed_year), not at the snapshot year, for which no economy has
  // data; so "10 years" means 2016–2025 on a 2026 snapshot, not nine observations 2017–2025.
  let endYear = snapshotYear;
  if ((gp.window_anchor || 'latest_observed_year') === 'latest_observed_year') {
    let latest = null;
    const uni = new Set(countries.map((c) => c.iso3));
    for (const [iso3, byYear] of Object.entries(growth)) {
      if (!uni.has(iso3)) continue;
      for (const y of yearsOf(byYear)) if (y <= snapshotYear && (latest === null || y > latest)) latest = y;
    }
    if (latest !== null) endYear = latest;
  }
  const g10 = {};
  const g20 = {};
  const g10prior = {};
  const vol = {};
  for (const c of countries) {
    const g = growth[c.iso3];
    g10[c.iso3] = windowAverage(g, endYear, w10);
    g20[c.iso3] = windowAverage(g, endYear, w20);
    // rubric 0.3.0: the decade before the last, so a slowdown compares two decades that do not overlap
    g10prior[c.iso3] = windowAverage(g, endYear - w10, w10);
    vol[c.iso3] = windowSd(g, endYear, gp.volatility_window_years);
  }
  const initialYear = endYear - w10;
  const rows = [];
  // rows in iso3 order so the normal equations sum deterministically whatever the input order
  for (const c of countries.slice().sort((a, b) => cmp(a.iso3, b.iso3))) {
    const y = g10[c.iso3].mean;
    const p = ppp[c.iso3] && ppp[c.iso3][initialYear];
    if (!isNum(y) || !isNum(p) || p <= 0) continue;
    rows.push({ iso3: c.iso3, y, x: Math.log(p), region: c.region || '(none)' });
  }
  /** @type {{ok: boolean, n: number, reason?: string, [key: string]: any}} */
  let convergence = { ok: false, n: rows.length, reason: 'too_few_countries' };
  if (rows.length >= params.icr.min_countries) {
    const counts = {};
    for (const r of rows) counts[r.region] = (counts[r.region] || 0) + 1;
    const eligible = Object.keys(counts)
      .filter((rg) => counts[rg] >= MIN_REGION_SIZE_FOR_DUMMY)
      .sort((a, b) => counts[b] - counts[a] || cmp(a, b));
    const dummies = eligible.slice(1);
    const X = rows.map((r) => [1, r.x, ...dummies.map((rg) => (r.region === rg ? 1 : 0))]);
    const fit = huberIRLS(
      X,
      rows.map((r) => r.y),
      { k: params.icr.huber_k, maxIterations: params.icr.max_iterations },
    );
    if (fit) {
      const per = {};
      rows.forEach((r, i) => {
        per[r.iso3] = { residual: fit.residuals[i], t: fit.residuals[i] / fit.scale };
      });
      convergence = {
        ok: true,
        n: rows.length,
        initial_year: initialYear,
        coefficient_log_initial_income: fit.beta[1],
        r2: fit.r2,
        scale: fit.scale,
        region_dummies: dummies,
        reference_region: eligible[0] || null,
        per,
      };
    } else {
      convergence = { ok: false, n: rows.length, reason: 'singular_design' };
    }
  }
  const volValues = countries.map((c) => vol[c.iso3].sd).filter(isNum);
  return {
    g10,
    g20,
    g10prior,
    vol,
    vol_values: volValues,
    convergence,
    windows: {
      w10,
      w20,
      volatility: gp.volatility_window_years,
      end_year: endYear,
      anchor: gp.window_anchor || 'latest_observed_year',
      span_10y: [endYear - w10 + 1, endYear],
      span_20y: [endYear - w20 + 1, endYear],
      span_prior_10y: [endYear - 2 * w10 + 1, endYear - w10],
      span_volatility: [endYear - gp.volatility_window_years + 1, endYear],
    },
  };
}

function medianOver(table, isoList, pick) {
  return median(isoList.map((iso3) => (table[iso3] ? pick(table[iso3]) : null)));
}

function pct(x) {
  return isNum(x) ? Math.round(x) : null;
}

// ---------------------------------------------------------------------------
// Classification (v0.1.1 bounds; params.growth_problem)
// ---------------------------------------------------------------------------

/**
 * How the peak-to-date record reads against the collapse bounds:
 *   at_peak | recent_dip (age < collapse_min_peak_age_years) | collapse (age within
 *   [collapse_min_peak_age_years, collapse_max_peak_age_years] and shortfall ≥
 *   collapse_min_shortfall_pct) | too_old | too_shallow | old_and_shallow | none.
 */
export function assessPeak(G3, gp) {
  if (!G3 || !isNum(G3.years_since_peak)) return { collapse: false, status: 'none' };
  const age = G3.years_since_peak;
  const short = G3.shortfall_pct;
  if (age === 0) return { collapse: false, status: 'at_peak' };
  if (age < gp.collapse_min_peak_age_years) return { collapse: false, status: 'recent_dip' };
  const tooOld = age > gp.collapse_max_peak_age_years;
  const tooShallow = !isNum(short) || short < gp.collapse_min_shortfall_pct;
  if (!tooOld && !tooShallow) return { collapse: true, status: 'collapse' };
  return { collapse: false, status: tooOld && tooShallow ? 'old_and_shallow' : tooOld ? 'too_old' : 'too_shallow' };
}

/** The growth patterns in the order the rules are tried (rubric 0.3.0), then the two fallbacks. */
export const GROWTH_PATTERNS = [
  'collapse_recovery', 'slowdown', 'acceleration', 'volatile', 'growing', 'never_recovered', 'high_income_pace', 'stuck', 'steady',
  'not_classifiable', 'mixed',
];

/**
 * Classification rules in order (rubric 0.3.0; v0.1.1 for collapse, volatile and growing):
 *   collapse_recovery peak age in [collapse_min_peak_age_years (8), collapse_max_peak_age_years (30)]
 *                     and shortfall ≥ collapse_min_shortfall_pct (10) (first since 0.3.0: an economy still well below a
 *                     recent peak has a bigger problem than its last decade's pace)
 *   slowdown          the last decade's average ≤ the decade before's − slowdown_min_drop_pp (2; two decades that do
 *                     not overlap, where 0.2.9 compared the 10- and 20-year averages, which needed a 3-point fall)
 *   acceleration      the last decade's average ≥ the decade before's + acceleration_min_rise_pp (2) and
 *                     ≥ acceleration_min_growth_pct (2): growth has sped up (Hausmann, Pritchett and Rodrik's word)
 *   volatile          G5 universe percentile > volatile_min_universe_percentile (75)
 *   growing           10-year average ≥ growing_min_growth_pct (3), or convergence t ≥
 *                     growing_alt_min_convergence_t (1.0) and 10-year average ≥ growing_alt_min_growth_pct (2)
 *   never_recovered   peak older than collapse_max_peak_age_years (30) and shortfall ≥ never_recovered_min_shortfall_pct (20)
 *   high_income_pace  a high-income economy growing at least high_income_pace_min_growth_pct (0) a year
 *   stuck             10-year average < stuck_max_growth_pct (1.5)
 *   steady            10-year average from stuck_max_growth_pct to growing_min_growth_pct (1.5 to 3)
 *   not_classifiable  no 10-year average and none of the rules above fired
 *   mixed             otherwise (cannot happen once the 10-year average exists; kept as the defensive fallback)
 * Returns {classification, rule, peak} where rule says which condition fired.
 */
export function classifyGrowthProblem({ avg10, avg20 = null, avgPrior10 = null, convergenceT, G3, volatilityPercentile, highIncome = false }, gp) {
  const peak = assessPeak(G3, gp);
  if (peak.collapse) {
    return {
      classification: 'collapse_recovery',
      rule: `peak ${G3.peak_year} is ${G3.years_since_peak} years old (within ${gp.collapse_min_peak_age_years}–${gp.collapse_max_peak_age_years}) and the shortfall ${f1(G3.shortfall_pct)} percent ≥ ${gp.collapse_min_shortfall_pct}`,
      peak,
    };
  }
  if (isNum(avg10) && isNum(avgPrior10) && avg10 <= avgPrior10 - gp.slowdown_min_drop_pp) {
    return { classification: 'slowdown', rule: `10-year average ${f1(avg10)} ≤ the decade before's ${f1(avgPrior10)} − ${gp.slowdown_min_drop_pp}`, peak };
  }
  if (isNum(avg10) && isNum(avgPrior10) && avg10 >= avgPrior10 + gp.acceleration_min_rise_pp && avg10 >= gp.acceleration_min_growth_pct) {
    return {
      classification: 'acceleration',
      rule: `10-year average ${f1(avg10)} ≥ the decade before's ${f1(avgPrior10)} + ${gp.acceleration_min_rise_pp} and ≥ ${gp.acceleration_min_growth_pct}`,
      peak,
    };
  }
  if (isNum(volatilityPercentile) && volatilityPercentile > gp.volatile_min_universe_percentile) {
    return { classification: 'volatile', rule: `growth sd at the ${Math.round(volatilityPercentile)}th percentile of all economies > ${gp.volatile_min_universe_percentile}`, peak };
  }
  if (isNum(avg10) && avg10 >= gp.growing_min_growth_pct) {
    return { classification: 'growing', rule: `10-year average ${f1(avg10)} ≥ ${gp.growing_min_growth_pct}`, peak };
  }
  if (isNum(avg10) && isNum(convergenceT) && convergenceT >= gp.growing_alt_min_convergence_t && avg10 >= gp.growing_alt_min_growth_pct) {
    return {
      classification: 'growing',
      rule: `convergence residual t ${f1(convergenceT)} ≥ ${gp.growing_alt_min_convergence_t} and 10-year average ${f1(avg10)} ≥ ${gp.growing_alt_min_growth_pct}`,
      peak,
    };
  }
  if (G3 && isNum(G3.years_since_peak) && G3.years_since_peak > gp.collapse_max_peak_age_years && isNum(G3.shortfall_pct) && G3.shortfall_pct >= gp.never_recovered_min_shortfall_pct) {
    return {
      classification: 'never_recovered',
      rule: `peak ${G3.peak_year} is ${G3.years_since_peak} years old (> ${gp.collapse_max_peak_age_years}) and the shortfall ${f1(G3.shortfall_pct)} percent ≥ ${gp.never_recovered_min_shortfall_pct}`,
      peak,
    };
  }
  if (!isNum(avg10)) {
    return { classification: 'not_classifiable', rule: 'no 10-year average growth, and no rule that needs none of it fired', peak };
  }
  if (highIncome && avg10 >= gp.high_income_pace_min_growth_pct) {
    return { classification: 'high_income_pace', rule: `high income and 10-year average ${f1(avg10)} ≥ ${gp.high_income_pace_min_growth_pct}`, peak };
  }
  if (avg10 < gp.stuck_max_growth_pct) {
    return { classification: 'stuck', rule: `10-year average ${f1(avg10)} < ${gp.stuck_max_growth_pct}`, peak };
  }
  if (avg10 < gp.growing_min_growth_pct) {
    return { classification: 'steady', rule: `10-year average ${f1(avg10)} from ${gp.stuck_max_growth_pct} to under ${gp.growing_min_growth_pct}`, peak };
  }
  return { classification: 'mixed', rule: 'no dominant pattern: none of the rules fired', peak };
}

/**
 * Stage 0 statistics and statement for one economy.
 *   uni: growthUniverse(...); country: countries.json entry; sets: comparator sets;
 *   icr(id): the Scorecard ICR block for an indicator; ref(id): reference record;
 *   topSplit: the top-split result (its row is quoted as the provisional reading).
 */
export function growthProblem({ uni, country, series, refs, features, sets, icr, params, snapshotYear, topSplit = null, regionMembers = [] }) {
  const iso3 = country.iso3;
  const gp = params.growth_problem;
  const structural = (sets.structural && sets.structural.members) || [];
  const g10 = uni.g10[iso3] || { mean: null };
  const g20 = uni.g20[iso3] || { mean: null };
  const g10p = (uni.g10prior && uni.g10prior[iso3]) || { mean: null, years: null, n_obs: 0 };
  const peers10 = structural.map((m) => (uni.g10[m] ? uni.g10[m].mean : null)).filter(isNum);
  const allG10 = [g10.mean, ...peers10].filter(isNum).sort((a, b) => b - a);
  const rank = isNum(g10.mean) ? allG10.indexOf(g10.mean) + 1 : null;
  const win = uni.windows || {};
  const G1 = {
    avg_10y: g10.mean,
    avg_20y: g20.mean,
    years_10y: g10.years,
    years_20y: g20.years,
    window_10y: win.span_10y || null,
    window_20y: win.span_20y || null,
    window_end_year: win.end_year ?? null,
    n_obs_10y: g10.n_obs,
    n_obs_20y: g20.n_obs,
    avg_prior_10y: g10p.mean,
    years_prior_10y: g10p.years,
    window_prior_10y: win.span_prior_10y || null,
    n_obs_prior_10y: g10p.n_obs,
    structural_median_10y: medianOver(uni.g10, structural, (x) => x.mean),
    structural_median_20y: medianOver(uni.g20, structural, (x) => x.mean),
    region_median_10y: medianOver(uni.g10, regionMembers, (x) => x.mean),
    region_median_20y: medianOver(uni.g20, regionMembers, (x) => x.mean),
    rank_in_structural: rank,
    structural_n: allG10.length,
  };
  const conv = uni.convergence;
  const G2 = conv.ok
    ? {
        t: conv.per[iso3] ? conv.per[iso3].t : null,
        residual_pp: conv.per[iso3] ? conv.per[iso3].residual : null,
        n: conv.n,
        initial_year: conv.initial_year,
        coefficient_log_initial_income: conv.coefficient_log_initial_income,
        method: 'Huber regression of 10-year average growth on log initial GDP per capita (PPP) with region dummies',
      }
    : { t: null, residual_pp: null, n: conv.n, reason: conv.reason };
  const level = (series[LEVEL] || {})[iso3];
  const G3 = peakToDate(level);
  if (G3) {
    const lf = levelFirstReached(level, gp.level_reached_tolerance_pct);
    G3.level_first_reached = lf ? lf.year : null;
    G3.years_since_level_first_reached = lf ? lf.years_since : null;
    G3.below_series_start = lf ? lf.below_series_start : null;
  }
  const growthSeries = (series[GROWTH] || {})[iso3];
  const G4 = erasBlock(growthSeries, win.end_year ?? null, gp);
  const volRec = uni.vol[iso3] || { sd: null };
  const G5 = {
    sd: volRec.sd,
    window_years: gp.volatility_window_years,
    window: win.span_volatility || null,
    n_obs: volRec.n_obs,
    structural_median_sd: medianOver(uni.vol, structural, (x) => x.sd),
    universe_percentile: isNum(volRec.sd) ? percentileRank(uni.vol_values, volRec.sd) : null,
  };
  const lvl = (id) => {
    const r = refs[id] && refs[id][iso3];
    return r && r.available ? { value_ref: r.value_ref, year_ref: r.year_ref } : { value_ref: null, year_ref: null };
  };
  const block = (id) => ({ id, ...lvl(id), icr: icr(id) });
  const inv = block('NE.GDI.FTOT.ZS');
  const G6 = { ...inv, private_split: 'unavailable in prototype (IMF Investment and Capital Stock Dataset not ingested)' };
  const G7 = { savings: block('NY.GNS.ICTR.ZS'), current_account: block('BN.CAB.XOKA.GD.ZS'), fdi: block('BX.KLT.DINV.WD.GD.ZS') };
  const G10 = { exports: block('NE.EXP.GNFS.ZS'), complexity: block('ECI_HS92') };
  const G11 = block('SL.UEM.TOTL.ZS');
  const f = features[iso3] || {};
  const G12 = {
    population: f.population ?? null,
    urban_share: lvl('SP.URB.TOTL.IN.ZS').value_ref,
    resource_rents: f.resource_rents ?? null,
    landlocked: country.landlocked ? 1 : 0,
    region: country.region || null,
    income_group: country.income_group || null,
  };

  const cls = classifyGrowthProblem(
    {
      avg10: g10.mean,
      avg20: g20.mean,
      avgPrior10: g10p.mean,
      convergenceT: G2.t,
      G3,
      volatilityPercentile: G5.universe_percentile,
      highIncome: country.income_group === 'High income',
    },
    gp,
  );
  if (G3) G3.assessment = cls.peak.status;

  const statement = buildStatement({ country, classification: cls.classification, peak: cls.peak, G1, G2, G3, G4, G5, G6, G7, G10, topSplit, gp });
  return { G1, G2, G3, G4, G5, G6, G7, G10, G11, G12, classification: cls.classification, classification_rule: cls.rule, statement };
}

/**
 * "GDP per capita is about where it was in 2006": said when the first year income reached roughly today's level is
 * at least level_line_min_years ago (rubric 0.3.0).
 */
function levelSentence(G3, gp) {
  const g = gp || {};
  if (!G3 || !isNum(G3.level_first_reached) || !isNum(G3.years_since_level_first_reached)) return null;
  if (G3.years_since_level_first_reached < (g.level_line_min_years ?? 5)) return null;
  const y = G3.level_first_reached;
  if (G3.below_series_start) return `GDP per capita is lower than in ${y}, the first year of the record.`;
  if (y === G3.series_start) return `GDP per capita is about where it was in ${y}, the first year of the record.`;
  return `GDP per capita is about where it first was in ${y}.`;
}

/** The eras since the start year in one sentence, or the absence of any lasting shift. */
function erasSentence(G4, gp) {
  if (!G4 || !Array.isArray(G4.eras) || !G4.eras.length) return null;
  const e = G4.eras;
  if (e.length === 1) {
    const shift = gp && isNum(gp.eras_min_change_pp) ? gp.eras_min_change_pp : 2;
    return `Growth since ${e[0].from} shows no lasting shift of ${shift} points or more: it averaged ${f1(e[0].mean)} percent a year over ${e[0].from}–${e[0].to}.`;
  }
  const items = e.map((x, i) => `${x.from}–${x.to} at ${f1(x.mean)}${i === 0 ? ' percent a year' : ''}`);
  const list = items.length === 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
  return `Since ${e[0].from} growth has run in ${e.length === 2 ? 'two' : e.length === 3 ? 'three' : 'four'} eras: ${list}.`;
}

/** "X standard deviations above/below expectation", or "at expectation" when |t| < AT_EXPECTATION_ABS_T. */
function sdClause(t, tail = 'expectation') {
  const a = Math.abs(t);
  if (a < AT_EXPECTATION_ABS_T) return `at ${tail}`;
  return `${f1(a)} standard deviation${f1(a) === '1.0' ? '' : 's'} ${t < 0 ? 'below' : 'above'} ${tail}`;
}

function sdPhrase(t, what) {
  if (!isNum(t)) return `${what} relative to expectation given income cannot be computed`;
  return `${what} is ${sdClause(t, 'expectation given income')}`;
}

function peakSentence(G3, peak, classification, gp) {
  if (!G3 || !peak) return null;
  const g = gp || {};
  switch (peak.status) {
    case 'at_peak':
      return `GDP per capita is at its peak to date (${G3.latest_year}).`;
    case 'collapse':
      // For collapse_recovery the opening clause already states the peak; otherwise say it plainly.
      return classification === 'collapse_recovery' ? null : `GDP per capita peaked in ${G3.peak_year} and is ${f1(G3.shortfall_pct)} percent below that peak.`;
    case 'too_old':
      // never_recovered: the opening clause states the peak, and here the old peak is the problem, not context
      if (classification === 'never_recovered') return null;
      return `GDP per capita peaked in ${G3.peak_year}, ${G3.years_since_peak} years ago, and is ${f1(G3.shortfall_pct)} percent below that peak; a peak older than ${g.collapse_max_peak_age_years} years is context here, not the growth problem.`;
    case 'too_shallow':
      return `GDP per capita peaked in ${G3.peak_year} and is ${f1(G3.shortfall_pct)} percent below that peak, a shortfall under ${g.collapse_min_shortfall_pct} percent that is context, not the growth problem.`;
    case 'old_and_shallow':
      return `GDP per capita peaked in ${G3.peak_year}, ${G3.years_since_peak} years ago, and is ${f1(G3.shortfall_pct)} percent below that peak; the peak is older than ${g.collapse_max_peak_age_years} years and the shortfall under ${g.collapse_min_shortfall_pct} percent, so this is context, not the growth problem.`;
    case 'recent_dip':
    default:
      return `GDP per capita peaked in ${G3.peak_year} and is ${f1(G3.shortfall_pct)} percent below that peak.`;
  }
}

export function buildStatement({ country, classification, peak = null, G1, G2, G3, G4, G5, G6, G7, G10, topSplit, gp = null }) {
  const name = proseName(country.name || country.iso3);
  const pk = peak || (G3 ? assessPeak(G3, gp || { collapse_min_peak_age_years: 8, collapse_max_peak_age_years: 30, collapse_min_shortfall_pct: 10 }) : null);
  let problem;
  const before = isNum(G1.avg_prior_10y) ? f1(G1.avg_prior_10y) : null;
  switch (classification) {
    case 'slowdown':
      problem = `a slowdown${G4 && G4.reported && G4.direction === 'deceleration' ? ` since ${G4.break_year}` : ' over the last decade'} (${f1(G1.avg_10y)} percent a year over the last decade against ${before} in the decade before)`;
      break;
    case 'acceleration':
      problem = `growth that has sped up, from ${before} percent a year in the decade before to ${f1(G1.avg_10y)} in the last decade; the question is whether it lasts`;
      break;
    case 'never_recovered':
      problem = `income that never recovered: GDP per capita is still ${f1(G3.shortfall_pct)} percent below its ${G3.peak_year} peak, ${G3.years_since_peak} years on`;
      break;
    case 'stuck':
      problem = `growth too slow to catch up: ${f1(G1.avg_10y)} percent a year over the last decade${before != null ? ` (${before} in the decade before)` : ''}`;
      break;
    case 'steady':
      problem = `steady but moderate growth: ${f1(G1.avg_10y)} percent a year over the last decade${before != null ? ` (${before} in the decade before)` : ''}, short of the pace that closes income gaps quickly`;
      break;
    case 'high_income_pace': {
      const peers = isNum(G1.structural_median_10y) ? ` (structural-peer median ${f1(G1.structural_median_10y)})` : '';
      problem = `the modest pace of a high-income economy: ${f1(G1.avg_10y)} percent a year over the last decade${peers}; growth diagnostics is built for economies far from the income frontier, so its readings here call for care`;
      break;
    }
    case 'not_classifiable':
      problem = 'not classifiable from the available growth record (no 10-year average growth)';
      break;
    case 'collapse_recovery':
      problem = `a collapse after the ${G3.peak_year} peak in GDP per capita, still ${f1(G3.shortfall_pct)} percent below it after ${G3.years_since_peak} years`;
      break;
    case 'volatile': {
      const pctl = gp && isNum(gp.volatile_min_universe_percentile) ? gp.volatile_min_universe_percentile : 75;
      problem = `high volatility (growth standard deviation ${f1(G5.sd)} over ${G5.window_years} years, above the ${pctl}th percentile of all economies)`;
      break;
    }
    case 'growing': {
      const conv = isNum(G2.t) && Math.abs(G2.t) >= AT_EXPECTATION_ABS_T && G2.t > 0 ? `, ${f1(G2.t)} standard deviations above the convergence expectation` : '';
      const peers = isNum(G1.structural_median_10y) ? ` (structural-peer median ${f1(G1.structural_median_10y)})` : ' (no structural-peer median)';
      problem = `not a growth collapse: growth is ${f1(G1.avg_10y)} percent a year${conv}${peers}; the question is whether it is sustained and reaching the poor (inclusion is not assessed in the prototype)`;
      break;
    }
    case 'mixed':
      problem = isNum(G1.avg_10y)
        ? `mixed, with no dominant pattern: growth of ${f1(G1.avg_10y)} percent a year over the last decade is neither a slowdown against the 20-year record, nor a recent collapse, nor unusually volatile, nor fast by the rubric's rules`
        : 'not classifiable from the available growth record (no 10-year average growth)';
      break;
    default:
      problem = 'a persistent low level of growth';
  }
  const parts = [];
  parts.push(`The growth problem in ${name} is ${problem}.`);
  const conv = isNum(G2.t) ? sdClause(G2.t, 'the convergence expectation') : 'with no convergence residual available';
  const rankTxt = isNum(G1.rank_in_structural) ? ` and ranked ${G1.rank_in_structural} of ${G1.structural_n} among structural peers` : '';
  // v0.1.2: name the actual span (the windows end at the latest observed year) and branch on availability
  const span = (w, obs, n) => {
    const s = Array.isArray(w) ? `${w[0]}–${w[1]}` : `the last ${n} years`;
    const partial = Array.isArray(obs) && Array.isArray(w) && (obs[0] !== w[0] || obs[1] !== w[1]) ? ` (observed ${obs[0]}–${obs[1]})` : '';
    return `${s}${partial}`;
  };
  if (isNum(G1.avg_10y)) {
    const twenty = isNum(G1.avg_20y) ? `${span(G1.window_20y, G1.years_20y, 20)}: ${f1(G1.avg_20y)}` : 'no 20-year average: fewer than half the years observed';
    const peers = isNum(G1.structural_median_10y) ? `structural-peer median ${f1(G1.structural_median_10y)}` : 'no structural-peer median';
    parts.push(`GDP per capita growth over ${span(G1.window_10y, G1.years_10y, 10)} averaged ${f1(G1.avg_10y)} percent a year (${twenty}; ${peers}), ${conv}${rankTxt}.`);
  } else {
    parts.push(`No 10-year average of GDP per capita growth is available (fewer than half of ${span(G1.window_10y, null, 10)} observed), so the growth record cannot be compared with the convergence expectation or with peers.`);
  }
  const ps = peakSentence(G3, pk, classification, gp);
  if (ps) parts.push(ps);
  const ls = levelSentence(G3, gp);
  if (ls) parts.push(ls);
  const es = erasSentence(G4, gp);
  if (es) parts.push(es);
  const invT = G6.icr ? G6.icr.t : null;
  parts.push(
    `${sdPhrase(invT, 'Investment (gross fixed capital formation to GDP)')}${isNum(G6.value_ref) ? ` at ${f1(G6.value_ref)} percent of GDP` : ''}; the private-public split is ${G6.private_split}.`,
  );
  const savT = G7.savings.icr ? G7.savings.icr.t : null;
  const ca = G7.current_account.value_ref;
  const fdi = G7.fdi.value_ref;
  parts.push(
    `${sdPhrase(savT, 'Gross savings')}${isNum(ca) ? `; the current account balance is ${f1(ca)} percent of GDP` : ''}${isNum(fdi) ? ` and net FDI inflows are ${f1(fdi)} percent of GDP` : ''}.`,
  );
  parts.push('Structural change (G9) is not computed in the prototype.');
  const expT = G10.exports.icr ? G10.exports.icr.t : null;
  const eciT = G10.complexity.icr ? G10.complexity.icr.t : null;
  parts.push(
    `${sdPhrase(expT, 'Exports to GDP')}${isNum(eciT) ? `, and economic complexity is ${sdClause(eciT)} (the complexity gap)` : ''}.`,
  );
  let question;
  switch (classification) {
    case 'acceleration':
      question = 'what lifted growth in the last decade, and what could stop it';
      break;
    case 'never_recovered':
      question = `why has GDP per capita not regained its ${G3.peak_year} level, ${G3.years_since_peak} years on`;
      break;
    case 'stuck':
      question = 'why has growth stayed too slow to catch up, and what keeps investment from lifting it';
      break;
    case 'steady':
      question = 'what would it take for growth to run faster than it has';
      break;
    case 'high_income_pace':
      question = 'what limits productivity growth in an economy already near the income frontier';
      break;
    case 'not_classifiable':
      question = 'what holds back faster growth, which the growth record is too short to say';
      break;
    case 'slowdown':
      question = `why has growth slowed${G4 && G4.reported && G4.direction === 'deceleration' ? ` since ${G4.break_year}` : ' over the last decade'}, and what stopped investment from sustaining it`;
      break;
    case 'collapse_recovery':
      question = `why has investment and output not recovered since the ${G3.peak_year} peak`;
      break;
    case 'volatile':
      question = 'what drives the volatility of growth and why investment does not translate into sustained growth';
      break;
    case 'growing':
      question = 'whether current growth can be sustained and what would make it reach more of the population';
      break;
    case 'mixed':
      question =
        isNum(invT) && invT <= -0.5
          ? 'why is private investment low given income when the growth record shows no dominant pattern'
          : 'what holds back faster growth when neither the growth record nor investment shows a dominant pattern';
      break;
    default:
      question = isNum(invT) && invT <= -0.5 ? 'why is private investment so low given income' : 'why is growth low despite investment near expectation';
  }
  parts.push(`The relevant question is therefore: ${question}.`);
  if (topSplit && topSplit.row) {
    const label = topSplit.label || TOP_SPLIT_LABELS[topSplit.row] || topSplit.row.replace(/_/g, ' ');
    const s = topSplit.stats || {};
    const src = topSplit.rate_source;
    const fallback = src && src !== RATE_SOURCES[0] ? ' (CPI-deflated lending rate; the WDI real rate is missing in the window)' : '';
    const items = [];
    if (isNum(s.real_rate_t)) items.push(`real lending rate t = ${f1(s.real_rate_t)}${fallback}`);
    if (isNum(s.credit_growth)) items.push(`real private credit growth ${f1(s.credit_growth)} percent`);
    if (isNum(s.investment_t)) items.push(`investment t = ${f1(s.investment_t)}`);
    const missing = (topSplit.missing || []).map((k) => ({ real_rate_t: 'the real lending rate', credit_growth: 'real private credit growth', investment_t: 'the investment residual' }[k] || k));
    const detail = items.length ? items.join(', ') : 'no statistic available';
    const gap = missing.length ? `; not available: ${missing.join(', ')}` : '';
    parts.push(`Provisional top-split reading: ${label} (${detail}${gap}).`);
  }
  return parts.join(' ');
}

export { GROWTH as GROWTH_SERIES_ID, LEVEL as LEVEL_SERIES_ID, pct as _pct };
