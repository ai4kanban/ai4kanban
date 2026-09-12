import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { CASE_ENDPOINT, ENDPOINT, FEEDBACK_ENDPOINT } from '../contract.ts'
import { DATASET } from '../src/usage.ts'
import { COPIES } from '../scripts/copies.mjs'

// The contract names the address a sender posts to, wrangler.jsonc names the address the
// Worker answers on, and the commands name the database behind each. A drift between them
// sends the numbers somewhere nobody is reading.

const config = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8')

describe('the deployed shape', () => {
  it('answers on the addresses the contract sends to', () => {
    for (const address of [ENDPOINT, FEEDBACK_ENDPOINT, CASE_ENDPOINT].flatMap((e) => Object.values(e))) {
      assert.ok(config.includes(new URL(address).hostname), address)
    }
  })

  it('never falls back to a workers.dev address, which blockers drop', () => {
    assert.ok(config.includes('"workers_dev": false'))
    assert.ok(!config.includes('workers.dev"'))
  })

  it('names the databases, both buckets and the dataset the commands read', () => {
    for (const copy of Object.values(COPIES)) {
      assert.ok(config.includes(`"database_name": "${copy.database}"`), copy.database)
      assert.ok(config.includes(`"bucket_name": "${copy.bucket}"`), copy.bucket)
      // The cases bucket (#628) is what `forget:case` deletes a submission out of, so a
      // command naming one the Worker does not write would report a deletion that never was.
      assert.ok(config.includes(`"bucket_name": "${copy.cases}"`), copy.cases)
    }
    assert.ok(config.includes(DATASET))
  })

  it('runs one schedule per copy, in the last hour of the UTC day', () => {
    const crons = [...config.matchAll(/"crons": \["(\d+) (\d+) \* \* \*"\]/g)]
    assert.equal(crons.length, 2)
    for (const [, , hour] of crons) assert.equal(hour, '23')
  })
})
