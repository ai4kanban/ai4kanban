import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { DAY, ENDPOINT, EVENTS, LIMITS, TOKEN, UUID } from '../contract.ts'

// The contract is what four senders and this server read instead of each keeping a copy. A
// name or a kind that drifts out of shape here loses a number silently everywhere.

describe('the contract', () => {
  it('spells every event name as a token, and every field as a kind the server can check', () => {
    for (const [name, shape] of Object.entries(EVENTS)) {
      assert.match(name, TOKEN, `${name} is not a token`)
      assert.ok(shape.from === 'app' || shape.from === 'site', `${name} comes from nowhere`)
      for (const [field, kind] of Object.entries(shape.fields)) {
        assert.match(field, TOKEN, `${name}.${field} is not a token`)
        assert.ok(['token', 'count', 'flag', 'id'].includes(kind), `${name}.${field}: ${kind}`)
      }
    }
  })

  it('gives a site event no field that could identify a machine', () => {
    for (const [name, shape] of Object.entries(EVENTS)) {
      if (shape.from !== 'site') continue
      for (const [field, kind] of Object.entries(shape.fields)) {
        assert.notEqual(kind, 'id', `${name}.${field} would identify the visitor`)
        assert.notEqual(field, 'surface', `${name}.${field} is the app's, not the site's`)
      }
    }
  })

  it('carries no field that could hold prose', () => {
    // A token has no spaces and is cut at 64 characters, so no sentence fits in one.
    assert.ok(!TOKEN.test('a card title with spaces'))
    assert.ok(!TOKEN.test('someone@example.com'))
    assert.ok(!TOKEN.test('x'.repeat(65)))
    assert.ok(TOKEN.test('0.8.1'))
    assert.ok(TOKEN.test('claude-code'))
    // A page is `/zh/download`, so a short path is a token too. What keeps a path out is the
    // field list: every field a sender may fill is named here, and none of them is free text.
    assert.ok(TOKEN.test('/zh/download'))
    const named = new Set(Object.values(EVENTS).flatMap((shape) => Object.keys(shape.fields)))
    assert.deepEqual(
      [...named].filter((field) => /path|title|goal|repo|email|note|text/.test(field)),
      [],
    )
  })

  it('answers on its own name, never a workers.dev address', () => {
    for (const address of Object.values(ENDPOINT)) {
      assert.ok(address.startsWith('https://'), address)
      assert.ok(!address.includes('workers.dev'), address)
    }
    assert.notEqual(ENDPOINT.production, ENDPOINT.development)
  })

  it('holds the numbers the privacy page and the senders are written against', () => {
    assert.equal(LIMITS.retentionDays, 90)
    assert.equal(LIMITS.backfillDays, 7)
    assert.equal(LIMITS.requestsPerHour, 600)
    assert.equal(LIMITS.appBatchesPerDay, 1)
  })

  it('recognises an install id and a calendar date, and nothing else', () => {
    assert.ok(UUID.test('0f3a9b1c-2d4e-4f6a-8b1c-2d4e6f8a0b1c'))
    assert.ok(!UUID.test('not-a-uuid'))
    assert.ok(DAY.test('2026-09-05'))
    assert.ok(!DAY.test('2026-09-05T10:00:00Z'))
  })
})
