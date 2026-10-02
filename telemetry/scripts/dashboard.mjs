// What the page shows, worked out from the daily summaries and nothing else. Kept apart from
// the reading and from the HTML so it can be checked without an account: the one thing it
// must never do is turn a day it has no summary for into a zero.
//
// The site block reuses `report.mjs`'s own cells, so the page and `npm run numbers` divide
// the same views by the same presses.

import { RATE_PAGES, cellsOf, languagesOf, summed } from './report.mjs'

/** The ranges the page offers, in days. */
export const RANGES = [7, 14, 30, 90]
/** What it opens on. */
export const DEFAULT_RANGE = 14
/** How far back the service reads at startup — every range has to fit inside it. */
export const READ_DAYS = Math.max(...RANGES)

/** Cloud's hosted capabilities, as `cloud.ai_calls` names them and as the page does. */
export const AI_CAPABILITIES = [
  ['judge', 'Jev triage'],
  ['speech', 'Narration'],
  ['image', 'Cover image'],
]
/** Pro's price per month in US dollars; yearly is billed at $120. */
const MONTHLY_PRICE = { monthly: 15, yearly: 10 }
/** A user's Jev cost past this many times the median is marked. */
export const JEV_OUTLIER = 5

/** The four numbers the overview carries, newest-day value first and the range behind it. */
const TILES = [
  ['installs', 'Active installs', (n) => n.installs],
  ['first_runs', 'First runs', (n) => firstRunsOf(n)],
  ['returning', 'Returning installs', (n) => n.returning_installs],
  ['boards', 'Active boards', (n) => n.boards],
]

/** The day table's columns, in the order they are read. */
const COLUMNS = [
  ['runs started', (n) => n.events?.run_started],
  ['finished', (n) => n.events?.run_finished],
  ['failed', (n) => n.events?.run_failed, 'fail'],
  ['cards created', (n) => n.board?.cards_created],
  ['cards done', (n) => n.board?.cards_completed],
  ['questions closed', (n) => n.board?.questions_closed],
]

/** The day table's headings, in the order the cells come back. */
export const DAY_COLUMNS = COLUMNS.map(([label]) => label)

/** A day's first runs. `first_run_surface` counts installs per surface, and one machine
 *  reports its first run once, so its values add up to the day itself. */
const firstRunsOf = (numbers) =>
  Object.values(numbers.first_run_surface ?? {}).reduce((all, n) => all + n, 0)

const shift = (day, by) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + by * 86_400_000).toISOString().slice(0, 10)

export const rangeOf = (today, days) =>
  Array.from({ length: days }, (_, back) => shift(today, -back))

/**
 * Everything the page draws, as plain data.
 *
 * @param endpoint    which copy these numbers came from
 * @param today       the day the page is being read on
 * @param days        how many days back this view covers
 * @param held        day -> { numbers, settled, writtenAt }, as far back as was read
 * @param readAt      when the service read the summaries
 * @param readFailed  the read did not come back — every number is unknown until a restart
 * @param ai          Cloud's hosted AI calls: `{ rows, users }`, or `{ failed: why }` when not read
 */
export function dashboardOf({ endpoint, today, days, held, readAt, readFailed = false, ai = null }) {
  const range = rangeOf(today, days)
  const before = rangeOf(shift(today, -days), days)
  // Today is still taking events, so it is never the day a headline number is read off and
  // never part of an average: a part-finished day beside whole ones reads as a collapse.
  const whole = range.filter((day) => day !== today)
  const latest = whole.find((day) => held.has(day)) ?? null
  const summary = latest ? held.get(latest) : null
  // The spread is a shape rather than a level, so a part-finished day still answers it — and
  // it is the day `npm run numbers` reads its own spread off, which is what makes the two
  // reconcile.
  const newest = range.find((day) => held.has(day)) ?? null

  return {
    endpoint,
    days,
    ranges: RANGES,
    from: range.at(-1),
    to: range[0],
    readAt,
    readFailed,
    through: latest,
    writtenAt: summary?.writtenAt ?? null,
    // The day being read is still taking events until the job closes it, so it is marked
    // rather than compared against a whole day.
    openToday: held.get(today) ? !held.get(today).settled : true,
    overview: overview(range, whole, before, held, latest),
    daily: daily(range, held),
    site: site(range, held),
    spread: spread(newest, newest ? held.get(newest) : null),
    ai: aiCost(range, ai),
  }
}

/** A tile a day: the latest day's own number, how the range compares with the one before it,
 *  and every day in the range for the sparkline. */
function overview(range, whole, before, held, latest) {
  return TILES.map(([key, label, read]) => {
    const series = [...range]
      .reverse()
      .map((day) => ({ day, value: value(read, held.get(day)) }))
    return {
      key,
      label,
      value: latest ? value(read, held.get(latest)) : null,
      delta: delta(whole, before, held, read),
      series,
    }
  })
}

/** This range's daily average against the one before it, over the days that have a summary.
 *  Null when either side has none — an average of nothing is not a fall. */
function delta(range, before, held, read) {
  const mean = (days) => {
    const known = days.map((day) => value(read, held.get(day))).filter((n) => n !== null)
    if (known.length === 0) return null
    return known.reduce((all, n) => all + n, 0) / known.length
  }
  const now = mean(range)
  const then = mean(before)
  if (now === null || then === null || then === 0) return null
  return Math.round((100 * (now - then)) / then)
}

const value = (read, entry) => {
  if (!entry) return null
  const n = read(entry.numbers)
  return typeof n === 'number' ? n : null
}

function daily(range, held) {
  return range.map((day) => {
    const entry = held.get(day)
    return {
      day,
      known: Boolean(entry),
      cells: COLUMNS.map(([, read, tone]) => ({
        tone: tone ?? null,
        value: entry ? (read(entry.numbers) ?? 0) : null,
      })),
    }
  })
}

/** Views, presses and the rate over the two pages that carry a download button, per page and
 *  per language. Event counts rather than machines, so the days in the range add up. */
function site(range, held) {
  const summaries = range.map((day) => held.get(day)?.numbers).filter(Boolean)
  const cells = cellsOf(summaries)
  // The two pages are always listed, with unknown cells when no day in the range has a
  // summary: a rate page missing from the table would read as a page nobody opened.
  const pages = RATE_PAGES
  // Busiest language first: a language with three views is noise, not a finding.
  const languages = languagesOf(cells).sort(
    (a, b) => summed(cells, pages, [b]).views - summed(cells, pages, [a]).views,
  )
  const known = cells.size > 0
  const row = (label, only) => {
    const whole = summed(cells, only, languages)
    return {
      page: label,
      views: known ? whole.views : null,
      presses: known ? whole.presses : null,
      rate: known ? rateOf(whole) : null,
      byLanguage: languages.map((language) => rateOf(summed(cells, only, [language]))),
    }
  }
  return {
    languages,
    // These are a sum over the days that have a summary, not over the range asked for. A
    // 90-day total added up from twenty days is a number that reads as a collapse unless the
    // block says how many days went into it.
    knownDays: summaries.length,
    rows: [...pages.map((page) => row(page, [page])), row('all', pages)],
  }
}

const rateOf = ({ presses, views }) => (views ? (100 * presses) / views : null)

/** One day's spread, never a range's: distinct install counts cannot be added across days
 *  without counting the same machine twice. */
function spread(day, summary) {
  if (!summary) return null
  const bars = (group) => {
    const entries = Object.entries(group ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 8)
    const most = entries[0]?.[1] ?? 0
    return entries.map(([key, n]) => ({ key, n, share: most ? n / most : 0 }))
  }
  return {
    day,
    columns: [
      { label: 'Surface', bars: bars(summary.numbers.install_surface) },
      { label: 'Version', bars: bars(summary.numbers.install_version) },
      { label: 'Country', bars: bars(summary.numbers.install_country) },
    ],
  }
}

/**
 * What the hosted AI calls in the range cost, per capability and per user. A read that did not
 * come back is `{ unavailable: why }`, never a table of zeros.
 */
function aiCost(range, ai) {
  if (!ai || ai.failed) return { unavailable: ai?.failed ?? 'Cloud was not read.' }
  const from = range.at(-1)
  const to = range[0]
  const rows = ai.rows.filter((row) => row.day >= from && row.day <= to)
  const blank = () => ({ calls: 0, failed: 0, cost: 0, unknown: 0, credits: 0 })
  const add = (into, row) => {
    into.calls += Number(row.calls)
    into.failed += Number(row.failed)
    into.cost += Number(row.cost)
    into.unknown += Number(row.cost_unknown)
    into.credits += Number(row.credits)
  }

  const total = new Map(AI_CAPABILITIES.map(([key]) => [key, blank()]))
  const perUser = new Map()
  for (const row of rows) {
    if (!total.has(row.capability)) continue
    add(total.get(row.capability), row)
    if (!perUser.has(row.user_id)) perUser.set(row.user_id, new Map(AI_CAPABILITIES.map(([key]) => [key, blank()])))
    add(perUser.get(row.user_id).get(row.capability), row)
  }

  const jev = [...perUser.values()].filter((by) => by.get('judge').calls > 0).map((by) => by.get('judge').cost)
  const typical = median(jev)
  const account = new Map(ai.users.map((user) => [user.user_id, user]))
  const users = [...perUser].map(([id, by]) => {
    const all = [...by.values()]
    const cost = all.reduce((sum, one) => sum + one.cost, 0)
    const revenue = revenueOf(account.get(id), from, range.length)
    return {
      user: account.get(id)?.email ?? id,
      by: AI_CAPABILITIES.map(([key]) => ({ calls: by.get(key).calls, cost: by.get(key).cost })),
      cost,
      credits: all.reduce((sum, one) => sum + one.credits, 0),
      revenue,
      // A gifted Pro pays nothing, so there is no revenue to hold the cost against.
      ratio: revenue > 0 ? cost / revenue : null,
      flagged: typical > 0 && by.get('judge').cost > JEV_OUTLIER * typical,
    }
  })
  users.sort((a, b) => b.cost - a.cost)

  return {
    capabilities: AI_CAPABILITIES.map(([key, label]) => {
      const one = total.get(key)
      return { key, label, ...one, perCredit: one.credits > 0 ? one.cost / one.credits : null }
    }),
    users,
  }
}

/** Revenue accrued over the range: the plan's monthly price × days / 30. Nothing for a user
 *  with no subscription paying in the range — Pro by a grant alone. */
function revenueOf(user, from, days) {
  const price = MONTHLY_PRICE[user?.period]
  if (!price) return 0
  const paying = user.renewing || (user.period_end && user.period_end >= from)
  return paying ? (price * days) / 30 : 0
}

function median(numbers) {
  if (numbers.length === 0) return 0
  const sorted = [...numbers].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
