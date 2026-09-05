#!/usr/bin/env node
// A release-day burst against the development copy.
//
//   npm run burst                      1,000 requests
//   npm run burst -- --requests 5000   the most this is allowed to send
//
// Bounded on purpose. The day's allowance belongs to the account, not to a Worker, so the
// development copy spends the same 100,000 requests the real endpoint does; 5,000 is enough
// to hold the 1,000-a-minute ceiling for several minutes and 5% of the day. The real
// endpoint is refused outright — learning where the free plan gives out must not cost a real
// day of numbers.

import { randomUUID } from 'node:crypto'

import { LIMITS, VERSION } from '../contract.ts'
import { COPIES } from './copies.mjs'

const CAP = 5_000
const AT_ONCE = 25

const asked = Number(process.argv[process.argv.indexOf('--requests') + 1]) || 1_000
if (process.argv.includes('--production')) {
  process.stderr.write('burst: the real endpoint is never load-tested. Use the development copy.\n')
  process.exit(1)
}
const requests = Math.min(asked, CAP)
if (asked > CAP) process.stdout.write(`burst: capped at ${CAP} requests.\n`)

const endpoint = `${COPIES.development.endpoint}/v1/batch`
const day = new Date().toISOString().slice(0, 10)
const answers = new Map()
let sent = 0

const started = Date.now()
await Promise.all(Array.from({ length: AT_ONCE }, sender))
const seconds = (Date.now() - started) / 1000

process.stdout.write(`\nburst: ${requests} requests to ${endpoint} in ${seconds.toFixed(1)}s\n`)
process.stdout.write(`  ${(requests / seconds).toFixed(0)} a second\n`)
for (const [status, n] of [...answers].sort()) process.stdout.write(`  ${status}  ${n}\n`)
process.stdout.write(
  `\n202 is taken, 429 is the ${LIMITS.requestsPerHour}-an-hour limit answering this one` +
    ' address.\n\n',
)

async function sender() {
  while (sent < requests) {
    sent += 1
    const install = randomUUID()
    const body = JSON.stringify({
      v: VERSION,
      install,
      events: [
        { id: randomUUID(), name: 'app_open', day, surface: 'app', version: '0.8.1', os: 'darwin', arch: 'arm64', first_run: true },
        { id: randomUUID(), name: 'app_day', day, surface: 'app', version: '0.8.1' },
      ],
    })
    try {
      const answer = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      })
      answers.set(answer.status, (answers.get(answer.status) ?? 0) + 1)
    } catch {
      answers.set('failed', (answers.get('failed') ?? 0) + 1)
    }
  }
}
