// ---- a card's storyboard: one JSON script, checked the same way everywhere (#963) --------------
//
//   <Storyboard src=".assets/963/storyboard.json" />
//
// The tag stands alone in its paragraph; the JSON beside it is the only copy of the shots. The
// command and the board UI both check it with this module, so a file one accepts the other draws.
// No filesystem here: a caller hands `checkStoryboard` the text and a reader for the frames.

export const STORYBOARD_VERSION = 1
export const ROOT_FIELDS = ['version', 'shots'] as const
export const SHOT_FIELDS = ['id', 'start', 'end', 'voiceover', 'action', 'captions', 'details', 'frames'] as const
export const FRAME_FIELDS = ['src', 'alt'] as const
export const FRAME_TYPES = ['png', 'jpg', 'jpeg', 'webp', 'gif'] as const
export const MAX_FRAME_WIDTH = 1280

export type Voiceover = { mode: 'none' } | { mode: 'spoken'; text: string; source: string }
export interface StoryboardFrame { src: string; alt: string }
export interface StoryboardShot {
  id: string
  start: number
  end: number
  voiceover: Voiceover
  action: string
  captions: string[]
  details: string
  frames: StoryboardFrame[]
}
export interface Storyboard { version: 1; shots: StoryboardShot[] }

export interface StoryboardDiagnostic {
  /** The JSON file, as the caller named it. */
  file: string
  code: string
  /** JSON Pointer to the value at fault — `/shots/0/voiceover`; empty for the whole file. */
  pointer: string
  expected: string
  actual: string
  /** Set on a syntax error. */
  line?: number
  column?: number
}

const TAG = /^<Storyboard\b([^<>]*?)\/>$/
const SRC_ATTR = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/
const SEGMENT = /^(?!\.)[^/\\]+$/
const SHOT_ID = /^S[1-9][0-9]*$/
const EPSILON = 1e-9

/** The `src` of a block that is exactly one `<Storyboard … />` tag — `null` for anything else. */
export function storyboardTag(raw: string): string | null {
  const m = TAG.exec(raw.trim())
  if (!m) return null
  const src = SRC_ATTR.exec(m[1]!)
  return src ? (src[1] ?? src[2])! : null
}

/** Every tag standing alone in its paragraph, outside fenced blocks, with its 1-based line. */
export function storyboardMarkers(body: string): { src: string; line: number }[] {
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  const found: { src: string; line: number }[] = []
  let fence: string | null = null
  lines.forEach((line, i) => {
    const delimiter = /^ {0,3}(`{3,}|~{3,})/.exec(line)
    if (fence) {
      if (delimiter && delimiter[1]![0] === fence[0] && delimiter[1]!.length >= fence.length) fence = null
      return
    }
    if (delimiter) { fence = delimiter[1]!; return }
    const src = storyboardTag(line)
    if (src !== null && !lines[i - 1]?.trim() && !lines[i + 1]?.trim()) found.push({ src, line: i + 1 })
  })
  return found
}

/** The file name a same-card `.assets/<card>/<name>` path points at, or why it may not. */
export function assetName(src: string, cardId: number, exts: readonly string[]): { name: string } | { expected: string; actual: string } {
  const expected = `.assets/${cardId}/<file>.${exts.length === 1 ? exts[0] : `{${exts.join(',')}}`} in this card's asset folder`
  if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return { expected, actual: `an external address ${JSON.stringify(src)}` }
  const parts = src.split('/')
  if (parts[0] !== '.assets' || parts.length !== 3) return { expected, actual: JSON.stringify(src) }
  if (parts[1] !== String(cardId)) return { expected, actual: `another card's folder ${JSON.stringify(parts[1])}` }
  const name = parts[2]!
  if (!SEGMENT.test(name)) return { expected, actual: JSON.stringify(src) }
  const ext = name.split('.').pop()!.toLowerCase()
  if (!name.includes('.') || !exts.includes(ext)) return { expected, actual: `file type ${JSON.stringify(name.includes('.') ? ext : '')}` }
  return { name }
}

/** Width in pixels read from a PNG, GIF, JPEG or WebP header — `null` when it is none of them. */
export function imageWidth(b: Uint8Array): number | null {
  const u16be = (i: number) => (b[i]! << 8) | b[i + 1]!
  const u16le = (i: number) => b[i]! | (b[i + 1]! << 8)
  const ascii = (i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n))
  if (b.length >= 24 && b[0] === 0x89 && ascii(1, 3) === 'PNG') return ((b[16]! << 24) >>> 0) + (b[17]! << 16) + (b[18]! << 8) + b[19]!
  if (b.length >= 10 && ascii(0, 4) === 'GIF8') return u16le(6)
  if (b.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const chunk = ascii(12, 4)
    if (chunk === 'VP8 ') return u16le(26) & 0x3fff
    if (chunk === 'VP8L') return 1 + (((b[22]! & 0x3f) << 8) | b[21]!)
    if (chunk === 'VP8X') return 1 + (b[24]! | (b[25]! << 8) | (b[26]! << 16))
    return null
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null
      const marker = b[i + 1]!
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return u16be(i + 7)
      i += 2 + u16be(i + 2)
    }
  }
  return null
}

/** What is wrong with a frame's bytes — `null` for a readable image no wider than allowed. */
export function frameProblem(bytes: Uint8Array | null): { code: string; actual: string } | null {
  if (!bytes) return { code: 'frame-missing', actual: 'no such file' }
  const width = imageWidth(bytes)
  if (width === null || width <= 0) return { code: 'frame-unreadable', actual: 'not a PNG, JPEG, WebP or GIF image' }
  if (width > MAX_FRAME_WIDTH) return { code: 'frame-too-wide', actual: `${width}px wide` }
  return null
}

function describe(value: unknown): string {
  if (value === undefined) return 'no value'
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'an array'
  if (typeof value === 'string') return value.trim() ? `the string ${JSON.stringify(value.length > 40 ? `${value.slice(0, 40)}…` : value)}` : 'a blank string'
  if (typeof value === 'object') return 'an object'
  return `${typeof value} ${JSON.stringify(value)}`
}

/** Where JSON text first goes wrong. Engines disagree on whether their message says, so the
 *  place is found here: a strict recursive read that stops at the first bad character. */
function syntaxOffset(src: string): number {
  let i = 0
  const ws = () => { while (/\s/.test(src[i] ?? '')) i++ }
  const fail = (): never => { throw i }
  const value = (): void => {
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
    i += m![0].length
  }
  const string = () => {
    i++
    while (i < src.length && src[i] !== '"') {
      if (src[i]! < ' ') fail()
      i += src[i] === '\\' ? 2 : 1
    }
    if (i >= src.length) fail()
    i++
  }
  try {
    value(); ws()
    return i < src.length ? i : src.length
  } catch (at) {
    return typeof at === 'number' ? at : src.length
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''

/** Parse and check one storyboard. `read` returns a frame's bytes by file name, or `null` when
 *  there is no such file inside the card's folder; leave it out to skip the file checks. The
 *  storyboard comes back whenever its structure is sound, so a missing frame still draws. */
export function checkStoryboard(
  source: string | null,
  { file, cardId, read }: { file: string; cardId: number; read?: (name: string) => Uint8Array | null },
): { storyboard: Storyboard | null; diagnostics: StoryboardDiagnostic[] } {
  const diagnostics: StoryboardDiagnostic[] = []
  const add = (code: string, pointer: string, expected: string, actual: string) => diagnostics.push({ file, code, pointer, expected, actual })
  if (source === null) {
    add('file-missing', '', 'the storyboard JSON file', 'no such file')
    return { storyboard: null, diagnostics }
  }
  let data: unknown
  try {
    data = JSON.parse(source.replace(/^﻿/, ''))
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e)
    const before = source.slice(0, syntaxOffset(source.replace(/^\uFEFF/, ''))).split('\n')
    diagnostics.push({ file, code: 'syntax', pointer: '', expected: 'valid JSON with no comments or code fences', actual: why, line: before.length, column: before[before.length - 1]!.length + 1 })
    return { storyboard: null, diagnostics }
  }

  const fields = (value: Record<string, unknown>, pointer: string, allowed: readonly string[]) => {
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) add('unknown-field', `${pointer}/${key}`, `only ${allowed.join(', ')}`, `an unknown field ${JSON.stringify(key)}`)
    }
  }
  const required = (value: Record<string, unknown>, pointer: string, key: string, expected: string, ok: (v: unknown) => boolean) => {
    const v = value[key]
    if (ok(v)) return true
    add(v === undefined ? 'missing-field' : 'invalid-value', `${pointer}/${key}`, expected, describe(v))
    return false
  }
  const nonblank = 'a non-blank string'

  if (!isObject(data)) {
    add('invalid-value', '', 'an object with version and shots', describe(data))
    return { storyboard: null, diagnostics }
  }
  fields(data, '', ROOT_FIELDS)
  if (data.version !== undefined && typeof data.version === 'number' && data.version !== STORYBOARD_VERSION) {
    add('unsupported-version', '/version', `version ${STORYBOARD_VERSION}`, describe(data.version))
  } else {
    required(data, '', 'version', `the number ${STORYBOARD_VERSION}`, (v) => v === STORYBOARD_VERSION)
  }
  const shots = data.shots
  if (!required(data, '', 'shots', 'an array of shots in play order', Array.isArray)) return { storyboard: null, diagnostics }
  const list = shots as unknown[]
  if (!list.length) add('no-shots', '/shots', 'at least one shot', 'an empty array')

  const ids = new Map<string, number>()
  let previousEnd: number | null = null
  list.forEach((shot, i) => {
    const at = `/shots/${i}`
    if (!isObject(shot)) { add('invalid-value', at, 'a shot object', describe(shot)); previousEnd = null; return }
    fields(shot, at, SHOT_FIELDS)
    if (required(shot, at, 'id', 'a shot ID such as "S1"', (v) => typeof v === 'string' && SHOT_ID.test(v))) {
      const id = shot.id as string
      if (ids.has(id)) add('duplicate-id', `${at}/id`, 'an ID no other shot uses', `${JSON.stringify(id)}, already used at /shots/${ids.get(id)}/id`)
      else ids.set(id, i)
    }
    const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
    const hasStart = required(shot, at, 'start', 'a start time in seconds', finite)
    const hasEnd = required(shot, at, 'end', 'an end time in seconds', finite)
    const start = shot.start as number
    const end = shot.end as number
    if (hasStart && hasEnd && end <= start) add('invalid-time', `${at}/end`, `a time after start (${start})`, String(end))
    if (hasStart) {
      if (i === 0 && Math.abs(start) > EPSILON) add('timeline-start', `${at}/start`, 'the first shot to start at 0', String(start))
      if (i > 0 && previousEnd !== null && Math.abs(start - previousEnd) > EPSILON) add('timeline-gap', `${at}/start`, `the previous shot's end (${previousEnd})`, String(start))
    }
    previousEnd = hasEnd ? end : null

    const voiceover = shot.voiceover
    if (required(shot, at, 'voiceover', '{"mode":"none"} or {"mode":"spoken","text":…,"source":…}', isObject)) {
      const v = voiceover as Record<string, unknown>
      const vat = `${at}/voiceover`
      if (v.mode === 'none') fields(v, vat, ['mode'])
      else if (v.mode === 'spoken') {
        fields(v, vat, ['mode', 'text', 'source'])
        required(v, vat, 'text', `${nonblank}: the exact spoken lines`, text)
        required(v, vat, 'source', `${nonblank}: the voice source`, text)
      } else required(v, vat, 'mode', '"none" or "spoken"', () => false)
    }
    required(shot, at, 'action', `${nonblank}: what changes, or what deliberately stays still`, text)
    if (required(shot, at, 'captions', 'an array of exact caption strings, or [] for none', Array.isArray)) {
      ;(shot.captions as unknown[]).forEach((c, k) => { if (!text(c)) add('invalid-value', `${at}/captions/${k}`, nonblank, describe(c)) })
    }
    required(shot, at, 'details', `${nonblank}: layout, framing, typography, sound, motion and transition`, text)
    if (required(shot, at, 'frames', 'an array of one or two frames: start, then end', Array.isArray)) {
      const frames = shot.frames as unknown[]
      if (frames.length < 1 || frames.length > 2) add('frame-count', `${at}/frames`, 'one or two frames', `${frames.length} frames`)
      frames.forEach((frame, k) => {
        const fat = `${at}/frames/${k}`
        if (!isObject(frame)) { add('invalid-value', fat, 'an object with src and alt', describe(frame)); return }
        fields(frame, fat, FRAME_FIELDS)
        required(frame, fat, 'alt', `${nonblank} describing the picture`, text)
        if (!required(frame, fat, 'src', `${nonblank}: the image path`, text)) return
        const named = assetName(frame.src as string, cardId, FRAME_TYPES)
        if (!('name' in named)) { add('frame-path', `${fat}/src`, named.expected, named.actual); return }
        if (!read) return
        const problem = frameProblem(read(named.name))
        if (problem) add(problem.code, `${fat}/src`, `a readable image at most ${MAX_FRAME_WIDTH}px wide`, problem.actual)
      })
    }
  })
  // A missing picture or no shots yet still leaves a script to draw; anything else does not.
  const drawable = new Set(['frame-missing', 'frame-unreadable', 'frame-too-wide', 'no-shots'])
  const structural = diagnostics.some((d) => !drawable.has(d.code))
  return { storyboard: structural ? null : (data as unknown as Storyboard), diagnostics }
}

/** One diagnostic on one line — where, then what is wrong and what is wanted. */
export function formatDiagnostic(d: StoryboardDiagnostic): string {
  const where = d.line ? `line ${d.line}, column ${d.column}` : d.pointer || '(file)'
  return `${where} [${d.code}]: found ${d.actual}; expected ${d.expected}.`
}

/** What goes back to the session that wrote the file: every problem and how to re-check. */
export function formatDiagnostics(file: string, cardId: number, diagnostics: readonly StoryboardDiagnostic[]): string {
  return [
    `The storyboard ${file} for #${cardId} failed validation. Fix every item in that same file, then run \`akb raw validate ${cardId} --json\` until it passes:`,
    ...diagnostics.map((d) => `- ${formatDiagnostic(d)}`),
  ].join('\n')
}
