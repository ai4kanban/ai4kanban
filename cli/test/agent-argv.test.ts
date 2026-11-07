// Reading one command line, quotes and all (#550).
//
// A runtime's `command` is a single string that several readers take argv back out of, and
// before this the split was on whitespace alone — so a resolved path with a space in it was
// two arguments, and a bundled path holding one was thrown away rather than used. What is
// held here is that the split and the quoting are each other's inverse: whatever is quoted
// comes back as exactly one word.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { quoteArg, splitCommand } from '../src/lib/agent/argv.ts'

describe('splitting a command line', () => {
  it('splits on whitespace the way it always did', () => {
    assert.deepEqual(splitCommand('codex exec --json'), ['codex', 'exec', '--json'])
    assert.deepEqual(splitCommand('  claude   -p  '), ['claude', '-p'])
    assert.deepEqual(splitCommand(''), [])
    assert.deepEqual(splitCommand('   '), [])
  })

  it('keeps a quoted path whole', () => {
    assert.deepEqual(splitCommand('"C:\\Program Files\\OpenAI\\codex.exe" exec --json'), [
      'C:\\Program Files\\OpenAI\\codex.exe',
      'exec',
      '--json',
    ])
    assert.deepEqual(splitCommand("'/Users/a b/codex' exec"), ['/Users/a b/codex', 'exec'])
  })

  it('takes a quote that opens mid-word', () => {
    assert.deepEqual(splitCommand('--cd="a b" -p'), ['--cd=a b', '-p'])
  })

  it('leaves a backslash alone — it is a path separator here, not an escape', () => {
    assert.deepEqual(splitCommand('C:\\Users\\me\\codex.exe exec'), [
      'C:\\Users\\me\\codex.exe',
      'exec',
    ])
  })

  it('gives an unclosed quote the rest of the line, so something still spawns', () => {
    assert.deepEqual(splitCommand('"C:\\Program Files\\codex.exe exec'), [
      'C:\\Program Files\\codex.exe exec',
    ])
  })

  it('keeps an empty quoted argument', () => {
    assert.deepEqual(splitCommand('codex ""'), ['codex', ''])
  })
})

describe('quoting one argument back', () => {
  it('leaves a plain word exactly as it was', () => {
    assert.equal(quoteArg('codex'), 'codex')
    assert.equal(quoteArg('--sandbox'), '--sandbox')
    assert.equal(quoteArg('/usr/local/bin/codex'), '/usr/local/bin/codex')
  })

  it('quotes anything a split would break up', () => {
    assert.equal(quoteArg('C:\\Program Files\\codex.exe'), '"C:\\Program Files\\codex.exe"')
    assert.equal(quoteArg(''), '""')
  })

  it('round-trips: what it quotes, the split gives back as one word', () => {
    for (const arg of [
      'codex',
      'C:\\Program Files\\OpenAI\\Codex\\bin\\8e55c2dd\\codex.exe',
      '/Users/a b/Applications/ChatGPT.app/Contents/Resources/codex',
      '',
    ]) {
      assert.deepEqual(splitCommand(quoteArg(arg)), arg ? [arg] : [''])
    }
  })

  it('round-trips a whole command line', () => {
    const argv = ['C:\\Program Files\\codex.exe', 'exec', '--json', '-c', 'a.b=true']
    assert.deepEqual(splitCommand(argv.map(quoteArg).join(' ')), argv)
  })
})
