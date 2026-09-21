// A card's storyboard is one JSON script (#963). The command and the board UI check it with the
// same module, and a run cannot request or accept approval while the file fails.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { ASSETS, setBoardRoot } from '../src/lib/paths'
import { setBoardProvider } from '../src/lib/board'
import { validateSpec } from '../src/lib/spec-contract'
import {
  FRAME_FIELDS, ROOT_FIELDS, SHOT_FIELDS, checkStoryboard, formatDiagnostics, imageWidth, storyboardMarkers,
} from '../src/lib/storyboard'
import { BUNDLED_AGENT_FILES } from '../src/lib/agents/bundled'
import { move, refuses } from './helpers/board'

/** The first 24 bytes of a PNG `width` pixels wide — all the validator reads. */
function png(width: number): Uint8Array {
  const b = new Uint8Array(33)
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
  new DataView(b.buffer).setUint32(16, width)
  new DataView(b.buffer).setUint32(20, 9)
  return b
}

const example = BUNDLED_AGENT_FILES['scriptwriter/references/storyboard.example.json']!
const schema = JSON.parse(BUNDLED_AGENT_FILES['scriptwriter/references/storyboard.schema.json']!)
const frames: Record<string, Uint8Array> = { 's1.png': png(1280), 's2.png': png(640) }
const read = (name: string) => frames[name] ?? null
const check = (source: string | null) => checkStoryboard(source, { file: 'storyboard.json', cardId: 963, read })
const codes = (source: string | null) => check(source).diagnostics.map((d) => `${d.pointer} ${d.code}`)

/** The example with one change made to its parsed data. */
function edit(change: (data: any) => void): string {
  const data = JSON.parse(example)
  change(data)
  return JSON.stringify(data, null, 2)
}

describe('the storyboard contract', () => {
  it('accepts the shipped example, spoken and unvoiced shots alike', () => {
    const { storyboard, diagnostics } = check(example)
    assert.deepEqual(diagnostics, [])
    assert.equal(storyboard!.shots[1]!.voiceover.mode, 'none')
    assert.match(storyboard!.shots[1]!.action, /静止/)
  })

  it('keeps the schema to the fields the validator enforces', () => {
    assert.deepEqual(schema.required, [...ROOT_FIELDS])
    assert.deepEqual(schema.$defs.shot.required, [...SHOT_FIELDS])
    assert.deepEqual(schema.$defs.shot.properties.frames.items.required, [...FRAME_FIELDS])
  })

  it('names a missing voiceover or action instead of assuming silence', () => {
    const got = codes(edit((d) => { delete d.shots[0].voiceover; delete d.shots[1].action }))
    assert.deepEqual(got, ['/shots/0/voiceover missing-field', '/shots/1/action missing-field'])
    assert.equal(check(edit((d) => { delete d.shots[0].voiceover })).storyboard, null)
  })

  it('refuses null, blank, mistyped and unknown values, all in one pass', () => {
    const got = codes(edit((d) => {
      d.shots[0].voiceover.text = '   '
      d.shots[0].details = null
      d.shots[0].start = '0'
      d.shots[1].captions = [42]
      d.shots[1].voiceover.text = 'hello'
      d.shots[1].extra = true
      d.note = 'x'
    }))
    for (const want of [
      '/note unknown-field', '/shots/0/voiceover/text invalid-value', '/shots/0/details invalid-value',
      '/shots/0/start invalid-value', '/shots/1/captions/0 invalid-value', '/shots/1/voiceover/text unknown-field',
      '/shots/1/extra unknown-field',
    ]) assert.ok(got.includes(want), want)
  })

  it('refuses another version, no shots and a file that is not there', () => {
    assert.deepEqual(codes(edit((d) => { d.version = 2 })), ['/version unsupported-version'])
    assert.deepEqual(codes(edit((d) => { d.shots = [] })), ['/shots no-shots'])
    assert.deepEqual(check(edit((d) => { d.shots = [] })).storyboard?.shots, [])
    assert.deepEqual(codes(null), [' file-missing'])
  })

  it('places a syntax error by line and column', () => {
    const [d] = check('{\n  "version": 1,\n  "shots": [,]\n}').diagnostics
    assert.equal(d!.code, 'syntax')
    assert.equal(d!.line, 3)
    assert.ok(d!.column! > 1)
  })

  it('checks IDs and the timeline', () => {
    const got = codes(edit((d) => {
      d.shots[0].start = 1
      d.shots[1].id = 'S1'
      d.shots[1].start = 6
      d.shots[1].end = 6
    }))
    for (const want of ['/shots/0/start timeline-start', '/shots/1/id duplicate-id', '/shots/1/start timeline-gap', '/shots/1/end invalid-time']) {
      assert.ok(got.includes(want), want)
    }
    assert.deepEqual(codes(edit((d) => { d.shots[0].id = 's1' })), ['/shots/0/id invalid-value'])
  })

  it('accepts only same-card images it can read, at most 1280px wide', () => {
    const src = (value: string) => codes(edit((d) => { d.shots[0].frames[0].src = value }))
    for (const bad of ['https://x.test/a.png', 'data:image/png;base64,AA', '.assets/850/s1.png', '.assets/963/../s1.png', '.assets/963/s1.svg', '.assets/963/.s1.png']) {
      assert.deepEqual(src(bad), ['/shots/0/frames/0/src frame-path'], bad)
    }
    assert.deepEqual(src('.assets/963/gone.png'), ['/shots/0/frames/0/src frame-missing'])
    frames['wide.png'] = png(1281)
    frames['junk.png'] = new Uint8Array([1, 2, 3])
    assert.deepEqual(src('.assets/963/wide.png'), ['/shots/0/frames/0/src frame-too-wide'])
    assert.deepEqual(src('.assets/963/junk.png'), ['/shots/0/frames/0/src frame-unreadable'])
    assert.deepEqual(codes(edit((d) => { d.shots[0].frames = [] })), ['/shots/0/frames frame-count'])
    // A missing picture still leaves the script to read.
    assert.ok(check(edit((d) => { d.shots[0].frames[0].src = '.assets/963/gone.png' })).storyboard)
  })

  it('reads widths from each supported format', () => {
    assert.equal(imageWidth(png(800)), 800)
    assert.equal(imageWidth(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x20, 0x03, 1, 0])), 800)
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, 0, 9, 3, 0x20, 3, 0, 0, 0])
    assert.equal(imageWidth(jpeg), 800)
  })

  it('finds a marker only where it stands alone, outside a fence', () => {
    const body = [
      '<Storyboard src=".assets/963/storyboard.json" />', '',
      'Inline `<Storyboard src=".assets/963/x.json" />` stays text.', '',
      '```', '<Storyboard src=".assets/963/y.json" />', '```', '',
      'Prose', '<Storyboard src=".assets/963/z.json" />',
    ].join('\n')
    assert.deepEqual(storyboardMarkers(body), [{ src: '.assets/963/storyboard.json', line: 1 }])
  })

  it('writes diagnostics a session can act on', () => {
    const text = formatDiagnostics('storyboard.json', 963, check(edit((d) => { delete d.shots[0].action })).diagnostics)
    assert.match(text, /akb raw validate 963 --json/)
    assert.match(text, /\/shots\/0\/action \[missing-field\]/)
  })
})

describe('a card that points at a storyboard', () => {
  let root: string
  let file: string
  const card = (tag: string) => `---
title: A video
priority: med
roi: high
status: todo
release: ""
blocked_by: []
related: []
modules: []
questions: []
---

The brief.

## Worth noting

## By \`scriptwriter\` agent

- **Brief**: one line.

${tag}

<!-- agent -->

## Scope
A requirement.

## Todo
- [ ] Implement it.

## Decided by the agent
`
  const tag = '<Storyboard src=".assets/1/storyboard.json" />'

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-storyboard-'))
    setBoardRoot(root)
    setBoardProvider(null)
    file = path.join(root, 'docs/kanban/todo/1-video.md')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, card(tag))
    fs.writeFileSync(path.join(root, 'docs/kanban/next-id'), '2\n')
    fs.writeFileSync(path.join(path.dirname(file), 'README.md'), '# Tasks\n\n- [ ] #1 [A video](1-video.md)\n')
    const dir = path.join(ASSETS, '1')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'storyboard.json'), example.replaceAll('.assets/963/', '.assets/1/'))
    fs.writeFileSync(path.join(dir, 's1.png'), png(1280))
    fs.writeFileSync(path.join(dir, 's2.png'), png(640))
  })
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

  it('passes with a complete script and its frames', async () => {
    assert.deepEqual(validateSpec(file, card(tag), 1), [])
    assert.equal((await move(root, ['validate', '1'])).valid, true)
  })

  it('fails validate until the file is fixed, then passes', async () => {
    const json = path.join(ASSETS, '1', 'storyboard.json')
    const good = fs.readFileSync(json, 'utf8')
    fs.writeFileSync(json, edit((d) => { delete d.shots[0].voiceover }).replaceAll('.assets/963/', '.assets/1/'))
    const errors = validateSpec(file, card(tag), 1)
    assert.equal(errors[0]!.rule, 'storyboard')
    assert.equal(errors[0]!.pointer, '/shots/0/voiceover')
    await refuses(root, ['validate', '1'], /\/shots\/0\/voiceover \[missing-field\]/)
    fs.writeFileSync(json, good)
    assert.equal((await move(root, ['validate', '1'])).valid, true)
  })

  it('refuses a frame that links out of the card folder', () => {
    const outside = path.join(root, 'outside.png')
    fs.writeFileSync(outside, png(100))
    fs.rmSync(path.join(ASSETS, '1', 's1.png'))
    fs.symlinkSync(outside, path.join(ASSETS, '1', 's1.png'))
    assert.deepEqual(validateSpec(file, card(tag), 1).map((e) => e.code), ['frame-missing'])
  })

  it('refuses a marker naming another card or sharing its paragraph', () => {
    assert.deepEqual(validateSpec(file, card('<Storyboard src=".assets/2/storyboard.json" />'), 1).map((e) => e.rule), ['storyboard-src'])
    assert.ok(validateSpec(file, card(`${tag}\nprose`), 1).some((e) => e.rule === 'storyboard-block'))
  })

  it('leaves a card without a marker to the old rules', () => {
    fs.rmSync(path.join(ASSETS, '1'), { recursive: true })
    assert.deepEqual(validateSpec(file, card('`<Storyboard src=".assets/1/storyboard.json" />`'), 1), [])
  })
})
