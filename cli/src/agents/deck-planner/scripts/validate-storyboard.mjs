#!/usr/bin/env node
// Check a slide deck storyboard against references/slides.schema.json.
//
//   node scripts/validate-storyboard.mjs <card asset folder>/storyboard.json [--json]
//
// Runtime: Node 18 or later, nothing else. Save it from a built-in agent with
// `akb raw agent-file deck-planner scripts/validate-storyboard.mjs > validate-storyboard.mjs`.
// Previews are `.assets/<card id>/<path>` paths, read from the JSON's own folder, which is
// named after the card; subfolders such as `previews/` are allowed. Exits 0 when the file
// passes; otherwise prints one line per problem (or a JSON array with --json) and exits 1.
// Exit 2 is a usage error.

import fs from 'node:fs'
import path from 'node:path'

const VERSION = 1
const ROOT_FIELDS = ['version', 'slides']
const SLIDE_FIELDS = ['id', 'title', 'copy', 'notes', 'layout', 'assets', 'preview']
const FRAME_FIELDS = ['src', 'alt']
const FRAME_TYPES = ['png', 'jpg', 'jpeg', 'webp', 'gif']
const MAX_FRAME_WIDTH = 1280
const SLIDE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/
const SEGMENT = /^(?!\.)[^/\\]+$/

/** The file name a same-card `.assets/<card>/<name>` path points at, or why it may not. */
function assetName(src, card) {
  const expected = `.assets/${card}/<file>.{${FRAME_TYPES.join(',')}} in this card's asset folder`
  if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return { expected, actual: `an external address ${JSON.stringify(src)}` }
  const parts = src.split('/')
  if (parts[0] !== '.assets' || parts.length < 3) return { expected, actual: JSON.stringify(src) }
  if (parts[1] !== card) return { expected, actual: `another card's folder ${JSON.stringify(parts[1])}` }
  if (!parts.slice(2).every((part) => SEGMENT.test(part))) return { expected, actual: JSON.stringify(src) }
  const name = parts.slice(2).join('/')
  const ext = name.split('.').pop().toLowerCase()
  if (!name.includes('.') || !FRAME_TYPES.includes(ext)) return { expected, actual: `file type ${JSON.stringify(name.includes('.') ? ext : '')}` }
  return { name }
}

/** Width in pixels read from a PNG, GIF, JPEG or WebP header — null when it is none of them. */
function imageWidth(b) {
  const u16be = (i) => (b[i] << 8) | b[i + 1]
  const u16le = (i) => b[i] | (b[i + 1] << 8)
  const ascii = (i, n) => String.fromCharCode(...b.subarray(i, i + n))
  if (b.length >= 24 && b[0] === 0x89 && ascii(1, 3) === 'PNG') return ((b[16] << 24) >>> 0) + (b[17] << 16) + (b[18] << 8) + b[19]
  if (b.length >= 10 && ascii(0, 4) === 'GIF8') return u16le(6)
  if (b.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const chunk = ascii(12, 4)
    if (chunk === 'VP8 ') return u16le(26) & 0x3fff
    if (chunk === 'VP8L') return 1 + (((b[22] & 0x3f) << 8) | b[21])
    if (chunk === 'VP8X') return 1 + (b[24] | (b[25] << 8) | (b[26] << 16))
    return null
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null
      const marker = b[i + 1]
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return u16be(i + 7)
      i += 2 + u16be(i + 2)
    }
  }
  return null
}

function describe(value) {
  if (value === undefined) return 'no value'
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'an array'
  if (typeof value === 'string') return value.trim() ? `the string ${JSON.stringify(value.length > 40 ? `${value.slice(0, 40)}…` : value)}` : 'a blank string'
  if (typeof value === 'object') return 'an object'
  return `${typeof value} ${JSON.stringify(value)}`
}

/** Where JSON text first goes wrong: a strict read that stops at the first bad character. */
function syntaxOffset(src) {
  let i = 0
  const ws = () => { while (/\s/.test(src[i] ?? '')) i++ }
  const fail = () => { throw i }
  const string = () => {
    i++
    while (i < src.length && src[i] !== '"') {
      if (src[i] < ' ') fail()
      i += src[i] === '\\' ? 2 : 1
    }
    if (i >= src.length) fail()
    i++
  }
  const value = () => {
    ws()
    const c = src[i]
    if (c === '{' || c === '[') {
      const close = c === '{' ? '}' : ']'
      i++; ws()
      if (src[i] === close) { i++; return }
      for (;;) {
        if (c === '{') { ws(); if (src[i] !== '"') fail(); string(); ws(); if (src[i] !== ':') fail(); i++ }
        value(); ws()
        if (src[i] === ',') { i++; continue }
        if (src[i] === close) { i++; return }
        fail()
      }
    }
    if (c === '"') return string()
    const m = /^(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(src.slice(i))
    if (!m) fail()
    i += m[0].length
  }
  try {
    value(); ws()
    return i < src.length ? i : src.length
  } catch (at) {
    return typeof at === 'number' ? at : src.length
  }
}

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v) => typeof v === 'string' && v.trim() !== ''

/** A file inside `dir`, symlinks resolved — null when absent or when it leads out. */
function inside(dir, name) {
  try {
    const root = fs.realpathSync(dir)
    const real = fs.realpathSync(path.join(dir, name))
    return real.startsWith(root + path.sep) && fs.statSync(real).isFile() ? real : null
  } catch {
    return null
  }
}

/** Every problem with one storyboard file, as `{ file, code, pointer, expected, actual }`. */
function validate(file) {
  const diagnostics = []
  const add = (code, pointer, expected, actual) => diagnostics.push({ file, code, pointer, expected, actual })
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    add('file-missing', '', 'the storyboard JSON file', 'no such file')
    return diagnostics
  }
  const dir = path.dirname(path.resolve(file))
  const card = path.basename(dir)
  const source = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  let data
  try {
    data = JSON.parse(source)
  } catch (e) {
    const before = source.slice(0, syntaxOffset(source)).split('\n')
    diagnostics.push({ file, code: 'syntax', pointer: '', expected: 'valid JSON with no comments or code fences', actual: e.message, line: before.length, column: before[before.length - 1].length + 1 })
    return diagnostics
  }

  const fields = (value, pointer, allowed) => {
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) add('unknown-field', `${pointer}/${key}`, `only ${allowed.join(', ')}`, `an unknown field ${JSON.stringify(key)}`)
    }
  }
  const required = (value, pointer, key, expected, ok) => {
    const v = value[key]
    if (ok(v)) return true
    add(v === undefined ? 'missing-field' : 'invalid-value', `${pointer}/${key}`, expected, describe(v))
    return false
  }
  const nonblank = 'a non-blank string'

  if (!isObject(data)) {
    add('invalid-value', '', 'an object with version and slides', describe(data))
    return diagnostics
  }
  fields(data, '', ROOT_FIELDS)
  if (typeof data.version === 'number' && data.version !== VERSION) add('unsupported-version', '/version', `version ${VERSION}`, describe(data.version))
  else required(data, '', 'version', `the number ${VERSION}`, (v) => v === VERSION)
  if (!required(data, '', 'slides', 'an array of slides in page order', Array.isArray)) return diagnostics
  if (!data.slides.length) add('no-slides', '/slides', 'at least one slide', 'an empty array')

  const frameAt = (frame, at) => {
    if (!isObject(frame)) { add('invalid-value', at, 'an object with src and alt', describe(frame)); return }
    fields(frame, at, FRAME_FIELDS)
    required(frame, at, 'alt', `${nonblank} describing the picture`, text)
    if (!required(frame, at, 'src', `${nonblank}: the image path`, text)) return
    const named = assetName(frame.src, card)
    if (!('name' in named)) { add('frame-path', `${at}/src`, named.expected, named.actual); return }
    const real = inside(dir, named.name)
    const expected = `a readable image at most ${MAX_FRAME_WIDTH}px wide`
    if (!real) { add('frame-missing', `${at}/src`, expected, 'no such file'); return }
    const width = imageWidth(fs.readFileSync(real))
    if (width === null || width <= 0) add('frame-unreadable', `${at}/src`, expected, 'not a PNG, JPEG, WebP or GIF image')
    else if (width > MAX_FRAME_WIDTH) add('frame-too-wide', `${at}/src`, expected, `${width}px wide`)
  }

  const strings = (value, at, key, expected) => {
    if (required(value, at, key, expected, Array.isArray)) {
      value[key].forEach((c, k) => { if (!text(c)) add('invalid-value', `${at}/${key}/${k}`, nonblank, describe(c)) })
    }
  }

  const ids = new Map()
  data.slides.forEach((slide, i) => {
    const at = `/slides/${i}`
    if (!isObject(slide)) { add('invalid-value', at, 'a slide object', describe(slide)); return }
    fields(slide, at, SLIDE_FIELDS)
    if (required(slide, at, 'id', 'a stable lowercase slide ID such as "cover"', (v) => typeof v === 'string' && SLIDE_ID.test(v))) {
      if (ids.has(slide.id)) add('duplicate-id', `${at}/id`, 'an ID no other slide uses', `${JSON.stringify(slide.id)}, already used at /slides/${ids.get(slide.id)}/id`)
      else ids.set(slide.id, i)
    }
    required(slide, at, 'title', nonblank, text)
    strings(slide, at, 'copy', 'an array of the exact text on the slide, or [] for none')
    required(slide, at, 'notes', 'the speaker notes, or "" for none', (v) => typeof v === 'string')
    required(slide, at, 'layout', `${nonblank}: the recipe layout this slide uses`, text)
    strings(slide, at, 'assets', 'an array of the images, charts and files the slide uses, or [] for none')
    if (required(slide, at, 'preview', 'an object with src and alt', isObject)) frameAt(slide.preview, `${at}/preview`)
  })
  return diagnostics
}

function formatDiagnostic(d) {
  const where = d.line ? `line ${d.line}, column ${d.column}` : d.pointer || '(file)'
  return `${d.file}: ${where} [${d.code}]: found ${d.actual}; expected ${d.expected}.`
}

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith('--'))
if (!file) {
  process.stderr.write('usage: node validate-storyboard.mjs <storyboard.json> [--json]\n')
  process.exit(2)
}
const diagnostics = validate(file)
if (args.includes('--json')) process.stdout.write(`${JSON.stringify(diagnostics, null, 2)}\n`)
else if (diagnostics.length) {
  process.stderr.write(`${file} failed validation. Fix every item in that same file, then run this script again:\n`)
  process.stderr.write(diagnostics.map((d) => `- ${formatDiagnostic(d)}\n`).join(''))
} else process.stdout.write(`${file}: valid\n`)
process.exit(diagnostics.length ? 1 : 0)
