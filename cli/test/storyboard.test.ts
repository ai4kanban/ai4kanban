// A card's storyboard is one JSON script (#963). Its contract is checked by the owner agent's
// own `scripts/validate-storyboard.mjs` (#992); the board only checks the marker and its path.
// The scripts run here the way a session runs them: saved out of the built command and run
// with Node, beside nothing else.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, afterEach, beforeEach, describe, it } from 'node:test'

import { ASSETS, setBoardRoot } from '../src/lib/paths'
import { setBoardProvider } from '../src/lib/board'
import { validateSpec } from '../src/lib/spec-contract'
import { storyboardMarkers } from '../src/lib/storyboard'
import { BUNDLED_AGENT_FILES } from '../src/lib/agents/bundled'
import { move } from './helpers/board'

/** The first 24 bytes of a PNG `width` pixels wide — all the validator reads. */
function png(width: number): Uint8Array {
  const b = new Uint8Array(33)
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
  new DataView(b.buffer).setUint32(16, width)
  new DataView(b.buffer).setUint32(20, 9)
  return b
}

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-storyboard-script-'))
after(() => fs.rmSync(scratch, { recursive: true, force: true }))

/** An agent's script, saved into its own folder the way `akb raw agent-file` hands it out. */
function saved(agent: string): string {
  const file = path.join(scratch, agent, 'scripts', 'validate-storyboard.mjs')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, BUNDLED_AGENT_FILES[`${agent}/scripts/validate-storyboard.mjs`]!)
  return file
}

interface Diagnostic { code: string; pointer: string; line?: number; column?: number }

/** Run a validator on `json` saved in a card folder beside `files`. */
function runner(agent: string, card: number, files: Record<string, Uint8Array>) {
  const script = saved(agent)
  const dir = path.join(scratch, 'assets', String(card))
  const write = (json: string) => {
    fs.rmSync(dir, { recursive: true, force: true })
    for (const [name, bytes] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true })
      fs.writeFileSync(path.join(dir, name), bytes)
    }
    fs.writeFileSync(path.join(dir, 'storyboard.json'), json)
    return path.join(dir, 'storyboard.json')
  }
  const exec = (args: string[]) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' })
  const check = (json: string | null): Diagnostic[] => {
    const file = json === null ? path.join(dir, 'gone.json') : write(json)
    const res = exec([file, '--json'])
    const out = JSON.parse(res.stdout) as Diagnostic[]
    assert.equal(res.status, out.length ? 1 : 0)
    return out
  }
  return { dir, write, exec, check, codes: (json: string | null) => check(json).map((d) => `${d.pointer} ${d.code}`) }
}

/** The fields a script enforces, read out of its source. */
const fieldsOf = (agent: string, name: string): string[] =>
  JSON.parse(new RegExp(`const ${name} = (\\[.*\\])`).exec(BUNDLED_AGENT_FILES[`${agent}/scripts/validate-storyboard.mjs`]!)![1]!.replaceAll("'", '"'))

const example = BUNDLED_AGENT_FILES['scriptwriter/references/storyboard.example.json']!
const schema = JSON.parse(BUNDLED_AGENT_FILES['scriptwriter/references/storyboard.schema.json']!)

/** The example with one change made to its parsed data. */
function edit(change: (data: any) => void, source = example): string {
  const data = JSON.parse(source)
  change(data)
  return JSON.stringify(data, null, 2)
}

describe("scriptwriter's storyboard script", () => {
  const frames: Record<string, Uint8Array> = { 's1.png': png(1280), 's2.png': png(640) }
  const { codes, check, exec, write } = runner('scriptwriter', 963, frames)

  it('accepts the shipped example, spoken and unvoiced shots alike', () => {
    assert.deepEqual(check(example), [])
    const res = exec([write(example)])
    assert.equal(res.status, 0)
    assert.match(res.stdout, /valid/)
  })

  it('keeps the schema to the fields the script enforces', () => {
    assert.deepEqual(schema.required, fieldsOf('scriptwriter', 'ROOT_FIELDS'))
    assert.deepEqual(schema.$defs.shot.required, fieldsOf('scriptwriter', 'SHOT_FIELDS'))
    assert.deepEqual(schema.$defs.shot.properties.frames.items.required, fieldsOf('scriptwriter', 'FRAME_FIELDS'))
  })

  it('names a missing voiceover or action instead of assuming silence', () => {
    assert.deepEqual(codes(edit((d) => { delete d.shots[0].voiceover; delete d.shots[1].action })), ['/shots/0/voiceover missing-field', '/shots/1/action missing-field'])
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

  it('refuses another version, no shots, slides and a file that is not there', () => {
    assert.deepEqual(codes(edit((d) => { d.version = 2 })), ['/version unsupported-version'])
    assert.deepEqual(codes(edit((d) => { d.shots = [] })), ['/shots no-shots'])
    assert.deepEqual(codes(edit((d) => { d.slides = [] })), ['/slides unknown-field'])
    assert.deepEqual(codes(null), [' file-missing'])
  })

  it('places a syntax error by line and column', () => {
    const [d] = check('{\n  "version": 1,\n  "shots": [,]\n}')
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
    for (const bad of ['https://x.test/a.png', '.assets/850/s1.png', '.assets/963/../s1.png', '.assets/963/s1.svg', '.assets/963/.s1.png', '.assets/963/previews/s1.png']) {
      assert.deepEqual(src(bad), ['/shots/0/frames/0/src frame-path'], bad)
    }
    assert.deepEqual(src('.assets/963/gone.png'), ['/shots/0/frames/0/src frame-missing'])
    frames['wide.png'] = png(1281)
    frames['junk.png'] = new Uint8Array([1, 2, 3])
    assert.deepEqual(src('.assets/963/wide.png'), ['/shots/0/frames/0/src frame-too-wide'])
    assert.deepEqual(src('.assets/963/junk.png'), ['/shots/0/frames/0/src frame-unreadable'])
    assert.deepEqual(codes(edit((d) => { d.shots[0].frames = [] })), [])
    assert.deepEqual(codes(edit((d) => { d.shots[0].frames.push(d.shots[0].frames[0], d.shots[0].frames[0]) })), ['/shots/0/frames frame-count'])
    assert.deepEqual(codes(edit((d) => { delete d.shots[1].frames })), ['/shots/1/frames missing-field'])
  })

  it('writes diagnostics a session can act on, and passes once the file is fixed', () => {
    const file = write(edit((d) => { delete d.shots[0].action }))
    const res = exec([file])
    assert.equal(res.status, 1)
    assert.match(res.stderr, /\/shots\/0\/action \[missing-field\]: found no value; expected a non-blank string/)
    assert.equal(exec([write(example)]).status, 0)
    assert.equal(exec([]).status, 2)
  })
})

describe("deck-planner's storyboard script", () => {
  const slidesExample = BUNDLED_AGENT_FILES['deck-planner/references/slides.example.json']!
  const slidesSchema = JSON.parse(BUNDLED_AGENT_FILES['deck-planner/references/slides.schema.json']!)
  const { codes } = runner('deck-planner', 969, { 'previews/cover.png': png(1280), 'previews/results.png': png(1280) })
  const slideCodes = (change: (data: any) => void) => codes(edit(change, slidesExample))

  it('accepts the shipped example: pages with no timing, previews in a subfolder', () => {
    assert.deepEqual(codes(slidesExample), [])
  })

  it('keeps the schema to the fields the script enforces', () => {
    assert.deepEqual(slidesSchema.required, fieldsOf('deck-planner', 'ROOT_FIELDS'))
    assert.deepEqual(slidesSchema.$defs.slide.required, fieldsOf('deck-planner', 'SLIDE_FIELDS'))
  })

  it('refuses shot fields, bad IDs and a missing preview field', () => {
    const got = slideCodes((d) => {
      d.slides[0].start = 0
      d.slides[1].id = 'cover'
      d.slides[1].copy = ['']
      delete d.slides[1].preview
    })
    for (const want of ['/slides/0/start unknown-field', '/slides/1/id duplicate-id', '/slides/1/copy/0 invalid-value', '/slides/1/preview missing-field']) {
      assert.ok(got.includes(want), want)
    }
    assert.deepEqual(slideCodes((d) => { d.slides[0].id = 'S1' }), ['/slides/0/id invalid-value'])
    assert.deepEqual(slideCodes((d) => { d.shots = [] }), ['/shots unknown-field'])
  })

  it('names a missing preview and never lets a path climb', () => {
    assert.deepEqual(slideCodes((d) => { d.slides[0].preview.src = '.assets/969/previews/gone.png' }), ['/slides/0/preview/src frame-missing'])
    assert.deepEqual(slideCodes((d) => { d.slides[0].preview.src = '.assets/969/previews/../../x.png' }), ['/slides/0/preview/src frame-path'])
    assert.deepEqual(slideCodes((d) => { d.slides = [] }), ['/slides no-slides'])
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
    fs.mkdirSync(path.join(ASSETS, '1'), { recursive: true })
    fs.writeFileSync(path.join(ASSETS, '1', 'storyboard.json'), example)
  })
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

  it('leaves the JSON contract to the agent: a broken script still validates', async () => {
    fs.writeFileSync(path.join(ASSETS, '1', 'storyboard.json'), edit((d) => { delete d.shots[0].voiceover }))
    assert.deepEqual(validateSpec(file, card(tag), 1), [])
    assert.equal((await move(root, ['validate', '1'])).valid, true)
  })

  it('refuses a marker whose file is not in the card folder', () => {
    fs.rmSync(path.join(ASSETS, '1', 'storyboard.json'))
    assert.deepEqual(validateSpec(file, card(tag), 1).map((e) => e.rule), ['storyboard-src'])
  })

  it('refuses a marker naming another card or sharing its paragraph', () => {
    assert.deepEqual(validateSpec(file, card('<Storyboard src=".assets/2/storyboard.json" />'), 1).map((e) => e.rule), ['storyboard-src'])
    assert.ok(validateSpec(file, card(`${tag}\nprose`), 1).some((e) => e.rule === 'storyboard-block'))
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

  it('leaves a card without a marker to the old rules', () => {
    fs.rmSync(path.join(ASSETS, '1'), { recursive: true })
    assert.deepEqual(validateSpec(file, card('`<Storyboard src=".assets/1/storyboard.json" />`'), 1), [])
  })
})
