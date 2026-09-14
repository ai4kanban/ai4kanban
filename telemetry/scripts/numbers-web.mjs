#!/usr/bin/env node
// The same production numbers as `npm run numbers`, on a page.
//
//   npm run numbers:web              http://127.0.0.1:8788
//   npm run numbers:web -- --port N  another port
//
// A local service and nothing more: it listens on the loopback address only, so no other
// machine can reach it, and it is gone when the process is. It reads the last 90 days of
// production summaries once at startup and works every range out from that, so the way to
// see today's numbers later in the day is to restart it.
//
// Production only. There is no environment switch and no request to the development copy —
// a page that could quietly be showing the wrong copy's numbers is worse than no page.

import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { COPIES, query, serviceRoot } from './copies.mjs'
import { DEFAULT_RANGE, READ_DAYS, RANGES, dashboardOf, rangeOf } from './dashboard.mjs'
import { pageOf } from './page.mjs'

/** What reading the summaries needs. Wrangler takes both from the environment. */
const NEEDED = ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN']
const DEFAULT_PORT = 8788

const copy = COPIES.production
const port = Number(process.argv[process.argv.indexOf('--port') + 1]) || DEFAULT_PORT

credentials()
const held = read()
const today = new Date().toISOString().slice(0, 10)
// Date and time, not a bare clock: a service left running overnight still holds the day it
// started on, and `read 08:12` would not say which day that was. Same shape, and the same
// UTC, as a summary's `written_at` beside it.
const readAt = new Date().toISOString().slice(0, 16).replace('T', ' ')

createServer((request, answer) => {
  const url = new URL(request.url, 'http://127.0.0.1')
  if (url.pathname !== '/') {
    answer.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    answer.end('Not found\n')
    return
  }
  const asked = Number(url.searchParams.get('days'))
  const days = RANGES.includes(asked) ? asked : DEFAULT_RANGE
  const page = pageOf(
    dashboardOf({
      endpoint: copy.endpoint,
      today,
      days,
      held: held.summaries,
      readAt,
      readFailed: held.failed,
    }),
  )
  answer.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
  answer.end(page)
})
  .listen(port, '127.0.0.1', () => {
    process.stdout.write(`\n  AI4Kanban usage — production (${host(copy.endpoint)})\n`)
    process.stdout.write(`  http://127.0.0.1:${port}  — this machine only. Ctrl-C stops it.\n\n`)
  })
  .on('error', (error) => {
    const why =
      error.code === 'EADDRINUSE'
        ? `Port ${port} is already in use. Try: npm run numbers:web -- --port ${port + 1}`
        : error.message
    process.stderr.write(`\n${why}\n\n`)
    process.exit(1)
  })

/**
 * The two credentials, out of `telemetry/.env`. Nothing is started without them: a page that
 * came up and then showed every number as unknown would read as a product nobody uses.
 */
function credentials() {
  const file = join(serviceRoot, '.env')
  if (existsSync(file)) process.loadEnvFile(file)
  const missing = NEEDED.filter((name) => !process.env[name])
  if (missing.length === 0) return

  process.stderr.write(`\ntelemetry/.env is missing ${missing.join(' and ')}.\n\n`)
  process.stderr.write('  This page reads the daily summaries with the Cloudflare account,\n')
  process.stderr.write('  so it needs both of these in telemetry/.env:\n\n')
  for (const name of NEEDED) {
    process.stderr.write(`    ${name.padEnd(24)}${process.env[name] ? 'found' : 'missing'}\n`)
  }
  process.stderr.write('\n  telemetry/.env.example has the template. Nothing was started.\n\n')
  process.exit(1)
}

/**
 * Every summary the ranges can need, in one read. A read that does not come back leaves the
 * page saying so rather than showing zeros — restarting is what tries again.
 */
function read() {
  const from = rangeOf(new Date().toISOString().slice(0, 10), READ_DAYS).at(-1)
  try {
    const rows = query(
      copy,
      `SELECT day, numbers, settled, written_at FROM daily WHERE day >= '${from}' ORDER BY day DESC`,
    )
    return {
      failed: false,
      summaries: new Map(
        rows.map((row) => [
          row.day,
          {
            numbers: JSON.parse(row.numbers),
            settled: row.settled === 1,
            writtenAt: String(row.written_at).slice(0, 16).replace('T', ' '),
          },
        ]),
      ),
    }
  } catch (error) {
    process.stderr.write(`\n  Could not read the production summaries: ${error.message}\n`)
    process.stderr.write('  The page will say so. Restart to try again.\n')
    return { failed: true, summaries: new Map() }
  }
}

const host = (endpoint) => endpoint.replace(/^https?:\/\//, '')
