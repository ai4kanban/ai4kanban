#!/usr/bin/env node
// What the product's use came to, read from the daily summaries.
//
//   npm run numbers                 the last 14 days of the real endpoint
//   npm run numbers -- --days 60    a longer run
//   npm run numbers -- --dev        the development copy
//   npm run numbers -- --json       the summaries as they are stored
//
// It reads `daily` and never the events, so a reading costs the same however many events are
// stored — and the days past the retention period have no events left to read anyway. This
// and `npm run numbers:web`, which puts the same summaries on a local page, are the only ways
// to these numbers, and both need the Cloudflare account behind them.

import { copyFrom, query } from './copies.mjs'
import { report } from './report.mjs'

const copy = copyFrom(process.argv)
const asked = Number(process.argv[process.argv.indexOf('--days') + 1]) || 14
const today = new Date().toISOString().slice(0, 10)
const days = Array.from({ length: asked }, (_, back) => shift(today, -back))

const rows = query(
  copy,
  `SELECT day, numbers FROM daily WHERE day >= '${days.at(-1)}' ORDER BY day DESC`,
)
const held = new Map(rows.map((row) => [row.day, JSON.parse(row.numbers)]))

process.stdout.write(
  process.argv.includes('--json')
    ? `${JSON.stringify(Object.fromEntries(held), null, 2)}\n`
    : report(copy.endpoint, days, held),
)

function shift(day, back) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + back * 86_400_000).toISOString().slice(0, 10)
}
