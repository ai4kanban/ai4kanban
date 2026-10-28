import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { PG_NOT_YOURS, PG_WRITE_BUDGET_EXCEEDED, refusalFor } from '../src/db.ts'
import { secondsUntilNextUtcDay } from '../src/errors.ts'

describe('refusalFor', () => {
  it('turns the write budget into a refusal a client can show', () => {
    const refusal = refusalFor({ code: PG_WRITE_BUDGET_EXCEEDED }, 400)

    assert.equal(refusal.code, 'daily_write_budget_reached')
    assert.equal(refusal.status, 429)
    assert.match(refusal.message, /not saved/)
    assert.ok(refusal.retryAfterSeconds > 0)
  })

  it('turns a read-only database into a storage refusal, not a conflict', () => {
    for (const code of ['25006', '53100']) {
      const refusal = refusalFor({ code }, 400)

      assert.equal(refusal.code, 'storage_limit_reached')
      assert.equal(refusal.status, 507)
      assert.match(refusal.message, /not saved/)
    }
  })

  it('turns a row belonging to another account into its own refusal', () => {
    const refusal = refusalFor({ code: PG_NOT_YOURS }, 400)

    assert.equal(refusal.code, 'not_yours')
    assert.equal(refusal.status, 403)
  })

  it('says nothing specific about anything else', () => {
    assert.equal(refusalFor({ code: '42P01', message: 'no such table' }, 400).code, 'service_unavailable')
  })
})

describe('secondsUntilNextUtcDay', () => {
  it('counts to the next UTC midnight', () => {
    assert.equal(secondsUntilNextUtcDay(Date.UTC(2026, 7, 26, 23, 59, 0)), 60)
    assert.equal(secondsUntilNextUtcDay(Date.UTC(2026, 7, 26, 0, 0, 0)), 24 * 60 * 60)
  })
})
