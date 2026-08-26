// The language this machine works in (#334).
//
// What is asked here: the setting is one machine's and not one board's, a missing,
// damaged or unknown answer reads as English, and saving keeps whatever else the file
// holds rather than dropping a setting this build has never heard of.
//
// And what the desktop app's first-launch guess rests on (#339): a machine that has never
// said is told apart from one that picked English, and a BCP 47 tag the system hands over
// either names a language this build has or names none at all.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { languageChosen, readLanguage, setLanguage, settingsFile } from '../src/lib/machine/settings.ts'
import { languageForTag } from '../src/lib/machine/types.ts'

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

  it('tells a machine that has never said from one that picked English', () => {
    assert.equal(languageChosen(), false)
    setLanguage('en')
    assert.equal(languageChosen(), true)
  })

  it('counts a language this build cannot read as said, so no app guesses over a newer one', () => {
    write(JSON.stringify({ language: 'kl' }))
    assert.equal(readLanguage(), 'en')
    assert.equal(languageChosen(), true)
  })

  it('keeps settings a later release added', () => {
    write(JSON.stringify({ language: 'en', theme: 'dark' }))
    setLanguage('zh')
    assert.deepEqual(JSON.parse(fs.readFileSync(settingsFile(), 'utf8')), { language: 'zh', theme: 'dark' })
  })
})

describe('the language a system tag reads as', () => {
  it('takes the tag on its own', () => {
    assert.equal(languageForTag('en'), 'en')
    assert.equal(languageForTag('zh'), 'zh')
  })

  it('reads any Chinese as the Simplified copy, the only one this build has', () => {
    assert.equal(languageForTag('zh-Hans-CN'), 'zh')
    assert.equal(languageForTag('zh-Hant-TW'), 'zh')
  })

  it('ignores the region and the case', () => {
    assert.equal(languageForTag('en-GB'), 'en')
    assert.equal(languageForTag('ZH-hant'), 'zh')
  })

  it('answers nothing for a language this build has no copy for, rather than English', () => {
    assert.equal(languageForTag('fr-FR'), null)
    assert.equal(languageForTag(''), null)
  })
})
