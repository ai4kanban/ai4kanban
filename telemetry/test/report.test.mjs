import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ALLOWANCE, report } from '../scripts/report.mjs'

// What `npm run numbers` prints. The two things it must never do: print a day it has no
// summary for as zero, and read as if the app numbers were the whole product's use.

const DAYS = ['2026-09-05', '2026-09-04', '2026-09-03']

const summary = (over = {}) => ({
  installs: 61,
  returning_installs: 44,
  boards: 12,
  events: { page_view: 412, download_press: 31, app_open: 88 },
  install_surface: { app: 55, command: 6 },
  install_version: { '0.8.1': 48, '0.8.0': 13 },
  install_country: { US: 22, CN: 14 },
  board: { cards_created: 40, cards_created_asked: 25, cards_created_proposed: 15 },
  usage: { requests: 6_214, rows_written: 18_930, rows_read: 240_000 },
  ...over,
})

describe('the numbers command', () => {
  it('marks a day it has no summary for rather than printing it as zero', () => {
    const held = new Map([['2026-09-05', summary()]])
    const lines = report('https://t.ai4kanban.dev', DAYS, held).split('\n')
    const missing = lines.find((line) => line.startsWith('2026-09-04'))
    assert.ok(missing.includes('—'), missing)
    assert.ok(!/\b0\b/.test(missing), missing)
  })

  it('prints the day table, the download rate and the board totals', () => {
    const held = new Map(DAYS.map((day) => [day, summary()]))
    const out = report('https://t.ai4kanban.dev', DAYS, held)
    assert.match(out, /412/)
    assert.match(out, /7\.5%/)
    assert.match(out, /cards created 120 \(asked 75 · proposed 45\)/)
  })

  it('shows a spread for one day, never added across days', () => {
    const held = new Map(DAYS.map((day) => [day, summary()]))
    const out = report('https://t.ai4kanban.dev', DAYS, held)
    assert.match(out, /Installs on 2026-09-05/)
    assert.match(out, /version {2}.*0\.8\.1 48 · 0\.8\.0 13/)
  })

  it('says how close every day came, not only the busiest', () => {
    const held = new Map([
      ['2026-09-05', summary({ usage: { requests: 1_000, rows_written: 1_000, rows_read: 10 } })],
      ['2026-09-04', summary({ usage: { requests: 90_000, rows_written: 10, rows_read: 10 } })],
      ['2026-09-03', summary({ usage: null })],
    ])
    const lines = report('https://t.ai4kanban.dev', DAYS, held).split('\n')
    const row = (day) => lines.find((line) => line.startsWith(day))
    assert.match(row('2026-09-05'), /1%$/)
    assert.match(row('2026-09-04'), /90%$/)
    // Measured nowhere is not the same as quiet.
    assert.match(row('2026-09-03'), /—$/)
  })

  it('says how close the busiest day came to every allowance', () => {
    const held = new Map([
      ['2026-09-05', summary()],
      ['2026-09-04', summary({ usage: { requests: 90_000, rows_written: 10, rows_read: 10 } })],
    ])
    const out = report('https://t.ai4kanban.dev', DAYS, held)
    assert.match(out, /busiest day 2026-09-04/)
    assert.match(out, /requests {6}90,000 of 100,000 \(90%\)/)
    assert.match(out, /rows read/)
    assert.equal(ALLOWANCE.rows_read, 5_000_000)
  })

  it('says a day recorded no usage rather than showing it as free', () => {
    const held = new Map([['2026-09-05', summary({ usage: null })]])
    assert.match(report('https://t.ai4kanban.dev', DAYS, held), /recorded its own usage/)
  })

  it('says which installs the app numbers cover', () => {
    const out = report('https://t.ai4kanban.dev', DAYS, new Map())
    assert.match(out, /installs with usage reporting on/)
    assert.match(out, /Neither is the whole product's use/)
  })
})
