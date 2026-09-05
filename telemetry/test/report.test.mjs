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
  // 400 views over the two pages that carry a button; the other 12 are the docs and the blog.
  page_view_seen: { '/ en': 300, '/ zh': 40, '/download en': 50, '/download zh': 10, '/blog en': 12 },
  download_press_seen: { '/ en': 15, '/ zh': 1, '/download en': 14, '/download zh': 1 },
  download_press_place: { hero: 12, start: 4, download: 13, builds: 2 },
  download_press_arch: { arm: 20, x86: 9, unknown: 2 },
  download_press_version: { '0.8.1': 31 },
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

  it('prints the day table and the board totals', () => {
    const held = new Map(DAYS.map((day) => [day, summary()]))
    const out = report('https://t.ai4kanban.dev', DAYS, held)
    assert.match(out, /cards created 120 \(asked 75 · proposed 45\)/)
  })

  it("counts the day's rate over the pages that carry a button, not every page", () => {
    const held = new Map([['2026-09-05', summary()]])
    const row = report('https://t.ai4kanban.dev', DAYS, held)
      .split('\n')
      .find((line) => line.startsWith('2026-09-05'))
    // 400 views and 31 presses, not the 412 the blog and the docs bring.
    assert.match(row, /400/)
    assert.match(row, /7\.8%/)
    assert.ok(!row.includes('412'), row)
  })

  it('reads the rate per page, per language, and per language on one page', () => {
    const held = new Map(DAYS.map((day) => [day, summary()]))
    const out = report('https://t.ai4kanban.dev', DAYS, held)
    assert.match(out, /Download rate, 2026-09-03 to 2026-09-05/)
    // Per page: 1,020 views of the landing page over three days, 48 presses.
    assert.match(out, /\/ +1,020 +48 +4\.7%/)
    assert.match(out, /\/download +180 +45 +25\.0%/)
    assert.match(out, /all +1,200 +93 +7\.8%/)
    // Per language, and then that language on each page.
    assert.match(out, /en +1,050 +87 +8\.3% +5\.0% +28\.0%/)
    assert.match(out, /zh +150 +6 +4\.0% +2\.5% +10\.0%/)
  })

  it('marks the rate rather than printing it when no day counted the site', () => {
    const held = new Map([['2026-09-05', summary({ page_view_seen: {}, download_press_seen: {} })]])
    assert.match(report('https://t.ai4kanban.dev', DAYS, held), /Download rate[^\n]*\n {2}—/)
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

  it('says which installs the app numbers cover, and which readers the site numbers do', () => {
    const out = report('https://t.ai4kanban.dev', DAYS, new Map())
    assert.match(out, /installs with usage reporting on/)
    assert.match(out, /browsers that ran the counter on the two pages/)
    assert.match(out, /no bot is filtered out/)
  })
})
