// How long a run may say nothing before the board ends it (#394).
//
// What is asked here: a board that has never said reads as 10 minutes, `0` is the way to
// switch the watchdog off and survives a round trip, only a changed value is written down,
// and a file nobody can parse still ends hung runs rather than leaving them holding a card.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { SILENCE_MINUTES, setSilenceMinutes, silenceMinutes } from '../src/lib/agent/settings.ts'
import { setBoardRoot } from '../src/lib/paths.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-silence-'))
const kanban = path.join(root, 'docs', 'kanban')
const config = path.join(kanban, 'ui.config.json')

const write = (text: string): void => {
  fs.mkdirSync(kanban, { recursive: true })
  fs.writeFileSync(config, text)
}

const saved = (): Record<string, unknown> => JSON.parse(fs.readFileSync(config, 'utf8'))

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  fs.mkdirSync(kanban, { recursive: true })
  setBoardRoot(root)
})

after(() => fs.rmSync(root, { recursive: true, force: true }))

describe('the silence limit', () => {
  it('is ten minutes on a board that has never said', () => {
    assert.equal(SILENCE_MINUTES, 10)
    assert.equal(silenceMinutes(), 10)
  })

  it('holds what was saved', () => {
    assert.deepEqual(setSilenceMinutes(25), { ok: true })
    assert.equal(silenceMinutes(), 25)
    assert.equal(saved().silenceMinutes, 25)
  })

  it('switches the watchdog off at 0, which is written down like any other answer', () => {
    assert.deepEqual(setSilenceMinutes(0), { ok: true })
    assert.equal(silenceMinutes(), 0)
    assert.equal(saved().silenceMinutes, 0)
  })

  it('writes nothing down for the default, so a board back at 10 reads as untouched', () => {
    setSilenceMinutes(25)
    assert.deepEqual(setSilenceMinutes(SILENCE_MINUTES), { ok: true })
    assert.equal(silenceMinutes(), 10)
    assert.equal('silenceMinutes' in saved(), false)
  })

  it('leaves every other setting where it is', () => {
    write(JSON.stringify({ harness: 'codex', autoCommit: false }))
    setSilenceMinutes(3)
    assert.deepEqual(saved(), { harness: 'codex', autoCommit: false, silenceMinutes: 3 })
  })

  it('refuses anything that is not a whole number of minutes', () => {
    for (const bad of [-1, 1.5, Number.NaN]) {
      assert.equal(setSilenceMinutes(bad).ok, false)
    }
    assert.equal(silenceMinutes(), 10)
  })

  it('reads a hand-edited fraction as written — nothing here needs rounding', () => {
    write(JSON.stringify({ silenceMinutes: 0.05 }))
    assert.equal(silenceMinutes(), 0.05)
  })

  it('falls back to the default on a value that means nothing, and on a broken file', () => {
    write(JSON.stringify({ silenceMinutes: 'ten' }))
    assert.equal(silenceMinutes(), 10)
    write(JSON.stringify({ silenceMinutes: -5 }))
    assert.equal(silenceMinutes(), 10)
    write('{ not json')
    assert.equal(silenceMinutes(), 10)
  })
})
