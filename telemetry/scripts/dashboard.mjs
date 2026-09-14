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
 */
export function dashboardOf({ endpoint, today, days, held, readAt, readFailed = false }) {
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
