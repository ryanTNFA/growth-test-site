// @ts-check
// Two areas carry no rating: coordination (it needs sector work) and geography (context, not a removable constraint). Their
// pages were a shell: a chip and one sentence. Each now opens with the idea from the research, why the tool gives no rating,
// what to ask in the country, and where to read more (18 November 2026). This is the tool's voice: it describes an idea
// and the debate around it and recommends nothing. Coordination is written with care. The research that names the problem is
// also wary of governments choosing sectors, and the page says both; nothing here reads as "pick the national sectors".
// Every study in a reading list was checked against its publisher's or Crossref's record before it was listed, and each note
// says only what the study's abstract or text supports.
import { h, fmt } from './common.mjs';

/** @typedef {{cite: string, href: string, note: string}} Reading */
/**
 * @typedef {{kicker: string, title: string, paras: Array<[string, string]>, askTitle: string, ask: string[], readTitle: string,
 *   reading: Reading[]}} AreaNote
 */

/** @type {Record<string, AreaNote>} */
export const AREA_NOTES = {
  N13: {
    kicker: 'The idea, from the research',
    title: 'When an activity needs something no single firm can supply',
    paras: [
      ['Some investments pay only together.', 'A flower exporter needs a cold chain, air freight and a plant-health inspector. None of ' +
        'those pays without the growers, and the growers do not pay without them. Each waits for the others, so nothing is built, though the ' +
        'whole would be profitable. Economists have described this since the 1940s.'],
      ['What is missing is usually specific, and often public.', 'A standard, a certification, a customs procedure, a regulator who answers, ' +
        'a road to one valley. These differ from one activity to the next, so no general reform supplies them, and a firm cannot buy them at ' +
        'any price.'],
      ['It is not a case for choosing national sectors.', 'The same research is wary of that answer. Governments know less than firms about ' +
        'what is missing, support is hard to withdraw once given, and country-wide traps that only a big push can break turn out to be rare. ' +
        'Whether subsidies aimed at chosen sectors pay off is still contested. What several of these authors propose instead starts from ' +
        'firms that already exist: they name what stops them, requests are screened in the open, and support that does not work ends. That ' +
        'rests on case studies more than on measured results, and it still means choosing which requests to answer.'],
      ['Why there is no rating here.', 'National statistics can hint at exposure, but they cannot see a missing cold chain. So the tool ' +
        'gives no rating and says why: this area needs work in the country, sector by sector, with the firms themselves.'],
    ],
    askTitle: 'What to ask in the country',
    ask: [
      'Which activities thrive in similar economies and are absent here, though the general conditions look alike?',
      'What do firms in a promising activity say they cannot buy at any price?',
      'Do several firms name the same missing input without being prompted?',
      'Who would have to act for it to appear: one office, or five that do not talk to each other?',
      'When earlier support for a sector failed, did it end?',
    ],
    readTitle: 'Where to read more',
    reading: [
      { cite: 'Rosenstein-Rodan (1943), “Problems of Industrialisation of Eastern and South-Eastern Europe”, Economic Journal 53',
        href: 'https://doi.org/10.2307/2226317',
        note: 'Where the idea starts: an essay arguing for planned, joint investment. It offers no evidence.' },
      { cite: 'Murphy, Shleifer and Vishny (1989), “Industrialization and the Big Push”, Journal of Political Economy 97(5)',
        href: 'https://doi.org/10.1086/261641', note: 'The formal model: such a trap is possible, under specific conditions.' },
      { cite: 'Hausmann, Klinger and Wagner (2008), “Doing Growth Diagnostics in Practice: A ‘Mindbook’”, CID Working Paper 177',
        href: 'https://www.hks.harvard.edu/centers/cid/publications/faculty-working-papers/doing-growth-diagnostics-practice',
        note: 'The field guide to the method. It concedes that the method can miss coordination problems.' },
      { cite: 'Rodrik (2004), “Industrial Policy for the Twenty-First Century”, Harvard Kennedy School working paper',
        href: 'https://www.hks.harvard.edu/publications/industrial-policy-twenty-first-century',
        note: 'Coordination problems are specific to an activity. Argues for dialogue with firms over subsidies, and names where planning failed.' },
      { cite: 'Hausmann, Rodrik and Sabel (2008), “Reconfiguring Industrial Policy”, CID Working Paper 168',
        href: 'https://www.hks.harvard.edu/centers/cid/publications/faculty-working-papers/reconfiguring-industrial-policy',
        note: 'Firms name the obstacle and the state supplies the missing public input; the test is whether it lets losers go. ' +
          'It also discusses larger bets.' },
      { cite: 'Harrison and Rodríguez-Clare (2010), “Trade, Foreign Investment, and Industrial Policy for Developing Countries”, ' +
        'Handbook of Development Economics 5',
        href: 'https://doi.org/10.1016/B978-0-444-52944-2.00001-X',
        note: 'A survey: little support for tariffs and subsidies; proposes cooperation on specific inputs where a country already has an edge.' },
      { cite: 'Pack and Saggi (2006), “Is There a Case for Industrial Policy? A Critical Survey”, World Bank Research Observer 21(2)',
        href: 'https://doi.org/10.1093/wbro/lkl001',
        note: 'The skeptical survey: little evidence that activist policy explains industrial successes.' },
      { cite: 'Krueger (1990), “Government Failures in Development”, Journal of Economic Perspectives 4(3)',
        href: 'https://doi.org/10.1257/jep.4.3.9', note: 'Why finding a market failure does not mean a government will fix it.' },
      { cite: 'Kraay and McKenzie (2014), “Do Poverty Traps Exist? Assessing the Evidence”, Journal of Economic Perspectives 28(3)',
        href: 'https://doi.org/10.1257/jep.28.3.127', note: 'Country-wide traps of the big-push kind turn out to be rare.' },
      { cite: 'Juhász, Lane and Rodrik (2024), “The New Economics of Industrial Policy”, Annual Review of Economics 16',
        href: 'https://doi.org/10.1146/annurev-economics-081023-024638',
        note: 'A recent survey that reads the newer studies as more favorable. The debate is not settled.' },
    ],
  },
  N9: {
    kicker: 'Context, from the research',
    title: 'What a country cannot change, and what it can change around it',
    paras: [
      ['Geography sets costs.', 'Distance from markets, no coast, a hot climate and rough terrain raise the cost of trading and of staying ' +
        'healthy. Landlocked countries trade far less than coastal ones, and a large part of the reason is infrastructure, their own and ' +
        'their transit neighbors’, not distance alone.'],
      ['How much it decides is debated.', 'One line of research finds that climate, disease and access to the sea shape incomes directly. ' +
        'Another finds that geography works mostly through the institutions history left behind. What a location is worth also changes as ' +
        'transport gets cheaper. Either way it is not fate: Switzerland has no coast, Singapore sits near the equator, and neither is large.'],
      ['Size and resources cut both ways.', 'Small countries are not poorer or slower-growing on average, but they have more at stake in open ' +
        'trade, because the home market is small. Resource wealth has gone both ways too: it raises the stakes of how revenue is managed, ' +
        'and the record holds a few successes and more failures.'],
      ['Why the tool treats it as context.', 'No reform moves a coastline, so geography is not rated as a constraint. It enters every ' +
        'comparison instead: each measure is read against what a country’s income, population, resource wealth and access to the sea ' +
        'predict, and the similar economies it is compared with are chosen on the same facts.'],
    ],
    askTitle: 'What is movable around it',
    ask: [
      'Transport corridors and border procedures, including the neighbor’s: for a landlocked exporter the neighbor’s port is its port.',
      'Regional agreements that widen a small home market.',
      'Disease control, where climate makes illness a standing cost.',
      'The rules for saving and spending resource revenue.',
      'Which exports suit the location: goods worth a lot for their weight, and services, travel better from far away.',
    ],
    readTitle: 'Where to read more',
    reading: [
      { cite: 'Gallup, Sachs and Mellinger (1999), “Geography and Economic Development”, International Regional Science Review 22(2)',
        href: 'https://doi.org/10.1177/016001799761012334', note: 'The case that location and climate shape incomes directly.' },
      { cite: 'Rodrik, Subramanian and Trebbi (2004), “Institutions Rule”, Journal of Economic Growth 9(2)',
        href: 'https://doi.org/10.1023/B:JOEG.0000031425.72248.85',
        note: 'The reply: once institutions are counted, geography’s direct effect is weak and its indirect effect strong.' },
      { cite: 'Henderson, Squires, Storeygard and Weil (2018), “The Global Distribution of Economic Activity”, Quarterly Journal of Economics 133(1)',
        href: 'https://doi.org/10.1093/qje/qjx030',
        note: 'Geography explains much of where activity sits, and which features matter depends on when transport got cheap.' },
      { cite: 'Limão and Venables (2001), “Infrastructure, Geographical Disadvantage, Transport Costs, and Trade”, World Bank Economic Review 15(3)',
        href: 'https://doi.org/10.1093/wber/15.3.451',
        note: 'Transport costs depend on infrastructure as well as geography, most of all for landlocked countries.' },
      { cite: 'Donaldson (2018), “Railroads of the Raj”, American Economic Review 108(4–5)',
        href: 'https://doi.org/10.1257/aer.20101199', note: 'Lower transport costs raised trade and real income in colonial India.' },
      { cite: 'Alesina, Spolaore and Wacziarg (2005), “Trade, Growth and the Size of Countries”, Handbook of Economic Growth 1B',
        href: 'https://doi.org/10.1016/S1574-0684(05)01023-3',
        note: 'A survey of how market size affects growth, and why small countries have the larger stake in trade.' },
      { cite: 'Bleakley (2010), “Malaria Eradication in the Americas”, American Economic Journal: Applied Economics 2(2)',
        href: 'https://doi.org/10.1257/app.2.2.1',
        note: 'Children spared malaria earned more as adults: a real effect, though not the main cause of income gaps.' },
      { cite: 'Venables (2016), “Using Natural Resources for Development: Why Has It Proven So Difficult?”, Journal of Economic Perspectives 30(1)',
        href: 'https://doi.org/10.1257/jep.30.1.161', note: 'Turning resource wealth into growth needs a chain of decisions to go right.' },
      { cite: 'World Bank (2009), World Development Report 2009: Reshaping Economic Geography',
        href: 'https://doi.org/10.1596/978-0-8213-7607-2',
        note: 'Growth is uneven across places; the report argues for integration over spreading activity out.' },
    ],
  },
};

/**
 * Geography's own line for one economy: the facts every comparison controls for, as the engine holds them (comparators.mjs:
 * population, resource rents, landlocked). Null when the scorecard carries none.
 * @param {{name?: string, features?: {log_population?: number | null, resource_rents?: number | null, landlocked?: number | null}} | null} country
 * @returns {string | null}
 */
export function geographyFacts(country) {
  const f = country && country.features;
  if (!f) return null;
  const pop = f.log_population != null ? Math.exp(f.log_population) : null;
  const people = pop == null ? '' : pop >= 1e6 ? `about ${fmt(pop / 1e6, pop >= 1e7 ? 0 : 1)} million people` : `about ${fmt(pop / 1e3, 0)} thousand people`;
  const parts = [f.landlocked == null ? '' : f.landlocked ? 'landlocked' : 'has a coast', people,
    f.resource_rents != null ? `natural-resource rents of ${fmt(f.resource_rents, 1)}% of GDP` : ''].filter(Boolean);
  return parts.length ? `${country.name || 'This economy'} in the comparisons: ${parts.join('; ')}.` : null;
}

/**
 * The note for an area that carries no rating, or null for every other area.
 * @param {string} id the area @param {{country?: any}} [o] the scorecard's country block, for geography's own line
 * @returns {HTMLElement | null}
 */
export function areaNote(id, { country = null } = {}) {
  const n = AREA_NOTES[id];
  if (!n) return null;
  const facts = id === 'N9' ? geographyFacts(country) : null;
  return h('div', {},
    h('span', { class: 'kicker' }, n.kicker), h('h2', { id: 'ar-note-h' }, n.title),
    facts ? h('p', { class: 'ar-note-facts' }, facts) : null,
    h('div', { class: 'prose sd-prose' }, n.paras.map(([lead, text]) => h('p', {}, h('strong', {}, lead), ` ${text}`))),
    h('h3', {}, n.askTitle), h('ul', { class: 'ar-note-ask' }, n.ask.map((q) => h('li', {}, q))),
    n.reading.length ? h('h3', {}, n.readTitle) : null,
    n.reading.length ? h('ul', { class: 'ar-note-read' }, n.reading.map((r) => h('li', {},
      h('a', { href: r.href, target: '_blank', rel: 'noopener' }, r.cite), ' ', h('span', { class: 'muted' }, r.note)))) : null);
}
