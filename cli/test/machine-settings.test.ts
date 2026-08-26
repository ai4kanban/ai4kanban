// The language this machine works in (#334).
//
// What is asked here: the setting is one machine's and not one board's, a missing,
// damaged or unknown answer reads as English, and saving keeps whatever else the file
// holds rather than dropping a setting this build has never heard of.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { readLanguage, setLanguage, settingsFile } from '../src/lib/machine/settings.ts'

let home = ''

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-machine-'))
  process.env.AI4KANBAN_HOME = home
})

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true })
  delete process.env.AI4KANBAN_HOME
})

const write = (text: string): void => {
  fs.mkdirSync(home, { recursive: true })
  fs.writeFileSync(settingsFile(), text)
}

describe('the machine settings', () => {
  it('lives beside the Cloud session, outside every board', () => {
    assert.equal(settingsFile(), path.join(home, 'settings.json'))
  })

  it('reads as English until the machine says otherwise', () => {
    assert.equal(readLanguage(), 'en')
  })

  it('holds what was saved', () => {
    assert.deepEqual(setLanguage('zh'), { ok: true })
    assert.equal(readLanguage(), 'zh')
    assert.deepEqual(JSON.parse(fs.readFileSync(settingsFile(), 'utf8')), { language: 'zh' })
  })

  it('reads a damaged file as English rather than failing', () => {
    write('{ "language": "zh"')
    assert.equal(readLanguage(), 'en')
  })

  it('reads a language this build does not know as English', () => {
    write(JSON.stringify({ language: 'kl' }))
    assert.equal(readLanguage(), 'en')
  })

  it('refuses to save one', () => {
    const saved = setLanguage('kl' as never)
    assert.equal(saved.ok, false)
    assert.match(saved.error ?? '', /not a language/)
  })

  it('keeps settings a later release added', () => {
    write(JSON.stringify({ language: 'en', theme: 'dark' }))
    setLanguage('zh')
    assert.deepEqual(JSON.parse(fs.readFileSync(settingsFile(), 'utf8')), { language: 'zh', theme: 'dark' })
  })
})
