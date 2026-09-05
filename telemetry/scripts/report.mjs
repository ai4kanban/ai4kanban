// What `npm run numbers` prints, as a string. Kept apart from the reading so the shaping can
// be checked without an account: a day with no summary must read as unknown, never as zero.

import { LIMITS } from '../contract.ts'

/** The free plan's daily allowances, which the summary's own counters are read against. */
export const ALLOWANCE = { requests: 100_000, rows_written: 100_000, rows_read: 5_000_000 }

const COLUMNS = [
  ['views', (n) => count(n.events?.page_view)],
  ['presses', (n) => count(n.events?.download_press)],
  ['rate', (n) => rate(n.events?.download_press, n.events?.page_view)],
  ['opens', (n) => count(n.events?.app_open)],
  ['installs', (n) => count(n.installs)],
  ['returning', (n) => count(n.returning_installs)],
  ['boards', (n) => count(n.boards)],
  // Every day says how close it came, not just the busiest one: a day at 90% is the warning,
  // and it is missed if only the worst day in the range is ever printed.
  ['plan', (n) => (n.usage ? `${Math.round(100 * shareOf(n.usage))}%` : '—')],
]

/** The tightest of the day's three allowances, as a fraction of it. */
const shareOf = (usage) =>
  Math.max(...Object.keys(ALLOWANCE).map((of) => (usage[of] ?? 0) / ALLOWANCE[of]))

/**
 * @param endpoint which copy these numbers came from
 * @param days     every day asked for, newest first
 * @param held     day -> the summary stored for it, where there is one
 */
export function report(endpoint, days, held) {
  const from = days.at(-1)
  const to = days[0]
  return (
    `\nAI4Kanban usage — ${endpoint}, ${from} to ${to}\n\n` +
    `${table(days, held)}\n\n` +
    installSpreads(days, held) +
    boardNumbers(days, held, from, to) +
    allowances(days, held) +
    'The app numbers cover installs with usage reporting on, and the site numbers cover\n' +
    "browsers that ran the counter. Neither is the whole product's use. Raw events are kept\n" +
    `${LIMITS.retentionDays} days, so an install away longer than that counts as new again.\n\n`
  )
}

function table(days, held) {
  const head = ['day', ...COLUMNS.map(([name]) => name)]
  const body = days.map((day) => {
    const numbers = held.get(day)
    // A day with no summary is marked, never printed as zero.
    if (!numbers) return [day, ...COLUMNS.map(() => '—')]
    return [day, ...COLUMNS.map(([, read]) => read(numbers))]
  })
  return laidOut([head, ...body])
}

/** Distinct install counts cannot be added across days, so a spread is one day's, never a
 *  range's. The most recent day that has a summary is the one shown. */
function installSpreads(days, held) {
  const day = days.find((one) => held.has(one))
  if (!day) return 'No summary for any day in this range.\n\n'
  const numbers = held.get(day)
  const lines = [
    ['surface', 'install_surface'],
    ['version', 'install_version'],
    ['country', 'install_country'],
  ]
    .map(([label, key]) => `  ${label.padEnd(9)}${spread(numbers[key])}`)
    .join('\n')
  return `Installs on ${day}\n${lines}\n\n`
}

function spread(group) {
  const entries = Object.entries(group ?? {}).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return '—'
  return entries.slice(0, 8).map(([key, n]) => `${key} ${count(n)}`).join(' · ')
}

function boardNumbers(days, held, from, to) {
  const total = {}
  for (const day of days) {
    for (const [counter, n] of Object.entries(held.get(day)?.board ?? {})) {
      total[counter] = (total[counter] ?? 0) + n
    }
  }
  if (Object.keys(total).length === 0) return `Board numbers, ${from} to ${to}\n  —\n\n`
  const at = (name) => count(total[name])
  return (
    `Board numbers, ${from} to ${to}\n` +
    `  cards created ${at('cards_created')} (asked ${at('cards_created_asked')} · ` +
    `proposed ${at('cards_created_proposed')})\n` +
    `  cards completed ${at('cards_completed')} · rejected ${at('cards_rejected')}\n` +
    `  questions closed ${at('questions_closed')} (board ${at('questions_closed_board')} · ` +
    `user ${at('questions_closed_user')} · verify ${at('questions_closed_verify')})\n` +
    `  decisions stood ${at('decisions_stood')} · overruled ${at('decisions_overruled')}\n` +
    `  releases closed ${at('releases_closed')}\n\n`
  )
}

/** What the busiest day came to, broken out — the `plan` column is each day's own share. */
function allowances(days, held) {
  let worst = null
  for (const day of days) {
    const usage = held.get(day)?.usage
    if (!usage) continue
    const share = shareOf(usage)
    if (!worst || share > worst.share) worst = { day, usage, share }
  }
  if (!worst) return 'Free plan\n  no day in this range recorded its own usage\n\n'
  const line = (label, of) =>
    `  ${label.padEnd(14)}${count(worst.usage[of])} of ${count(ALLOWANCE[of])} ` +
    `(${Math.round((100 * (worst.usage[of] ?? 0)) / ALLOWANCE[of])}%)`
  return (
    `Free plan, busiest day ${worst.day}\n` +
    `${line('requests', 'requests')}\n` +
    `${line('rows written', 'rows_written')}\n` +
    `${line('rows read', 'rows_read')}\n\n`
  )
}

function laidOut(grid) {
  const widths = grid[0].map((_, column) =>
    Math.max(...grid.map((row) => String(row[column]).length)),
  )
  return grid
    .map((row) =>
      row
        .map((cell, column) =>
          column === 0
            ? String(cell).padEnd(widths[column])
            : String(cell).padStart(widths[column] + 3),
        )
        .join(''),
    )
    .join('\n')
}

const count = (n) => (typeof n === 'number' ? n.toLocaleString('en-US') : '0')

const rate = (presses, views) =>
  views ? `${((100 * (presses ?? 0)) / views).toFixed(1)}%` : '—'
