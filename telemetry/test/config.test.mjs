import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { ENDPOINT } from '../contract.ts'
import { DATASET } from '../src/usage.ts'
import { COPIES } from '../scripts/copies.mjs'

// The contract names the address a sender posts to, wrangler.jsonc names the address the
// Worker answers on, and the commands name the database behind each. A drift between them
// sends the numbers somewhere nobody is reading.

const config = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8')

describe('the deployed shape', () => {
  it('answers on the addresses the contract sends to', () => {
    for (const address of Object.values(ENDPOINT)) {
      assert.ok(config.includes(new URL(address).hostname), address)
    }
  })

  it('never falls back to a workers.dev address, which blockers drop', () => {
    assert.ok(config.includes('"workers_dev": false'))
    assert.ok(!config.includes('workers.dev"'))
  })

  it('names the databases and the dataset the commands read', () => {
    for (const copy of Object.values(COPIES)) assert.ok(config.includes(copy.database), copy.database)
    assert.ok(config.includes(DATASET))
  })

  it('runs one schedule per copy, in the last hour of the UTC day', () => {
    const crons = [...config.matchAll(/"crons": \["(\d+) (\d+) \* \* \*"\]/g)]
    assert.equal(crons.length, 2)
    for (const [, , hour] of crons) assert.equal(hour, '23')
  })
})
