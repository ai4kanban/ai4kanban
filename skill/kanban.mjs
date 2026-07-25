#!/usr/bin/env node
// Kanban board bookkeeping. The ONLY sanctioned writer of docs/kanban/next-id.
//
// Handles the id-touching moves so the board stays consistent:
//   init    — scaffold a fresh docs/kanban/ board (folders, the umbrella memory set, config.md)
//   memory-init — lazily scaffold a module's memory path with the five-file set
//   create  — allocate task id(s); with --title, also write the card's frontmatter + index it
//   update  — rewrite a card's frontmatter (priority/roi/links/questions, move track, rename)
//   tag     — set/clear the [user]/[agent] tag on one open question (auto-refine triage)
//   migrate — convert old bold-header cards to the frontmatter meta format
//   archive — move a finished task's file/folder into docs/kanban/.archive/, strip its
//             README entry, record "completed"
//   reject  — same, but delete the file/folder, record "rejected"
//   run     — record one run of a recurring task (+1 completed); keep the card
//
// It is the ONLY sanctioned writer of a card's frontmatter — Write/Edit are for the body
// only. It also keeps docs/kanban/metrics.csv (one row per day: completed, created, rejected).
//
// Usage:
//   node kanban.mjs init [track...]                     scaffold docs/kanban/ (folders, umbrella memory set, config.md)
//   node kanban.mjs memory-init <module>                lazily scaffold memory/<module>/ with the five-file set
//   node kanban.mjs create [--count N]                  allocate N ids (default 1), print them
//   node kanban.mjs create --title T --track K [opts]   scaffold one card (frontmatter + body template + index)
//   node kanban.mjs update <id> [opts]                  rewrite a card's frontmatter / move / rename
//   node kanban.mjs tag <id> <n> <user|agent|none>      set/clear the tag on the nth open question
//   node kanban.mjs migrate [--dry-run]                 convert old bold-header cards to frontmatter
//   node kanban.mjs archive <id>                        finish task <id> (move card to .archive/ + README + metric)
//   node kanban.mjs reject  <id>                        reject task <id> (delete card + README + metric)
//   node kanban.mjs run     <id>                        record one run of recurring task <id> (+1 completed, card kept)
//   node kanban.mjs peek                                print the current next-id (no bump)
//   node kanban.mjs metrics                             print the metrics CSV

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Released version of the skill. Do NOT hand-edit — it's stamped from the repo's root
// VERSION file by scripts/sync-version.mjs (the one number for the whole repo; see
// PUBLISHING.md). It's baked in because this file is copied into installed projects away
// from the manifests. `version` prints this; the install/update prompt also writes a
// `.version` stamp (source SHA + date) next to the script for `git log` deltas — printed
// here too when present.
const SKILL_VERSION = '0.2.0'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
// The board lives at <repo>/docs/kanban. Every command runs from the repo root (SKILL.md
// says so), so the working directory IS the repo root — this holds whether the script is a
// copy under .claude/skills/kanban/ or read-only in a plugin cache. Deriving the root from
// cwd (not from where this file sits) is what lets `/plugin install` + `kanban init` work
// with nothing copied into the project.
const REPO_ROOT = process.cwd()
const KANBAN = path.join(REPO_ROOT, 'docs', 'kanban')
const TODO = path.join(KANBAN, 'todo')
const ARCHIVE = path.join(KANBAN, '.archive')
const NEXT_ID = path.join(KANBAN, 'next-id')
const README = path.join(TODO, 'README.md')
const METRICS = path.join(KANBAN, 'metrics.csv')
const MODULES_MD = path.join(KANBAN, 'modules.md')
const CONFIG = path.join(KANBAN, 'config.md')

function die(msg) {
  console.error(`kanban: ${msg}`)
  process.exit(1)
}

function readNextId() {
  if (!fs.existsSync(NEXT_ID)) die(`missing ${rel(NEXT_ID)}`)
  const value = fs.readFileSync(NEXT_ID, 'utf8').trim()
  if (!/^\d+$/.test(value)) die(`${rel(NEXT_ID)} is not a plain number: "${value}"`)
  return Number(value)
}

function writeNextId(value) {
  fs.writeFileSync(NEXT_ID, `${value}\n`)
}

const SELF = fileURLToPath(import.meta.url)
const rel = (p) => path.relative(REPO_ROOT, p) || p

// ---- metrics ---------------------------------------------------------------

const COLUMNS = ['completed', 'created', 'rejected']

function today() {
  return new Date().toISOString().slice(0, 10)
}

function bumpMetric(kind, amount = 1) {
  const day = today()
  let rows = []
  if (fs.existsSync(METRICS)) {
    rows = fs
      .readFileSync(METRICS, 'utf8')
      .trim()
      .split('\n')
      .slice(1) // drop header
      .filter(Boolean)
      .map((line) => {
        const [date, ...counts] = line.split(',')
        const row = { date }
        COLUMNS.forEach((c, i) => (row[c] = Number(counts[i] || 0)))
        return row
      })
  }
  let row = rows.find((r) => r.date === day)
  if (!row) {
    row = { date: day, completed: 0, created: 0, rejected: 0 }
    rows.push(row)
  }
  row[kind] += amount
  const out = ['date,' + COLUMNS.join(',')]
  for (const r of rows) out.push([r.date, ...COLUMNS.map((c) => r[c])].join(','))
  fs.writeFileSync(METRICS, out.join('\n') + '\n')
}

// ---- locate a task by id ---------------------------------------------------

function walkMd(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walkMd(full, acc)
    else if (entry.name.endsWith('.md')) acc.push(full)
  }
  return acc
}

function walkDirs(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const full = path.join(dir, entry.name)
    acc.push(full)
    walkDirs(full, acc)
  }
  return acc
}

const idPrefix = (name) => {
  const m = name.match(/^(\d+)-/)
  return m ? Number(m[1]) : null
}

// Returns { kind: 'group'|'file', target, rel } or null.
//   group  — an id-prefixed folder holding a root.md tracking card; target is the folder.
//            found at any depth, so a recurring folder-task (its card plus sibling docs)
//            resolves the same way a top-level group root does.
//   file   — a single card (standalone or a group's subtask); target is the file.
function locate(id) {
  const groupDir = walkDirs(TODO).find(
    (d) => idPrefix(path.basename(d)) === id && fs.existsSync(path.join(d, 'root.md')),
  )
  if (groupDir) {
    return { kind: 'group', target: groupDir, rel: path.relative(TODO, groupDir) }
  }
  const hit = walkMd(TODO).find((f) => idPrefix(path.basename(f)) === id)
  if (hit) return { kind: 'file', target: hit, rel: path.relative(TODO, hit) }
  return null
}

// If `file` is a subtask nested inside a group task, return that group's root.md
// (the nearest ancestor folder holding one). Null for a standalone card. Used so
// archiving a subtask can tick it off in the group's tracking card.
function enclosingGroupRoot(file) {
  let dir = path.dirname(file)
  while (dir.startsWith(TODO) && dir !== TODO) {
    const root = path.join(dir, 'root.md')
    if (fs.existsSync(root) && root !== file) return root
    dir = path.dirname(dir)
  }
  return null
}

// Reflect a subtask's fate in its group's root.md ## Todo. `action` is 'tick' (archive:
// flip `- [ ] … #id` to `- [x]`) or 'strike' (reject: wrap the item text in ~~…~~, leaving
// the box). Matches the first bullet whose text references `#id` — `#id\b` keeps #1 from
// matching #14 — and skips a line already in the target state. Returns true if a line
// changed, false if there's no matching subtask line to mark.
function markSubtask(rootFile, id, action) {
  const lines = fs.readFileSync(rootFile, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (action === 'tick') {
      const re = new RegExp(`^(\\s*[-*]\\s*\\[) \\](.*#${id}\\b)`)
      if (re.test(line)) {
        lines[i] = line.replace(re, '$1x]$2')
        fs.writeFileSync(rootFile, lines.join('\n'))
        return true
      }
    } else {
      // strike: a bullet (with or without a checkbox) referencing #id, not already struck
      const re = new RegExp(`^(\\s*[-*]\\s+(?:\\[[ xX]\\]\\s+)?)(.*#${id}\\b.*)$`)
      const m = line.match(re)
      if (m && !m[2].includes('~~')) {
        lines[i] = `${m[1]}~~${m[2]}~~`
        fs.writeFileSync(rootFile, lines.join('\n'))
        return true
      }
    }
  }
  return false
}

// ---- strip README entries --------------------------------------------------

const isTableRow = (line) => /^\s*\|/.test(line)
const isBulletStart = (line) => /^\s*[-*] /.test(line)
const bulletIndent = (line) => line.match(/^(\s*)/)[1].length

// Removes every README entry that LINKS the task's own path. Cross-mentions of the id
// as bare `#id` text in other cards' prose carry no link, so they are left untouched.
// A single-line bullet or table row drops on its own; a multi-line group bullet drops
// with its wrapped continuation lines.
function stripReadmeRefs(target) {
  if (!fs.existsSync(README)) return []
  const needle = target.kind === 'group' ? `](${target.rel}/` : `](${target.rel})`
  const lines = fs.readFileSync(README, 'utf8').split('\n')
  const out = []
  const removed = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.includes(needle) && (isTableRow(line) || isBulletStart(line))) {
      removed.push(line.trim())
      if (isBulletStart(line)) {
        const indent = bulletIndent(line)
        i++
        // consume wrapped continuation lines (indented deeper, not a new bullet)
        while (
          i < lines.length &&
          lines[i].trim() !== '' &&
          !isBulletStart(lines[i]) &&
          !/^\s*#/.test(lines[i]) &&
          !isTableRow(lines[i]) &&
          bulletIndent(lines[i]) > indent
        ) {
          i++
        }
      } else {
        i++ // table row
      }
      continue
    }
    out.push(line)
    i++
  }
  if (removed.length) fs.writeFileSync(README, out.join('\n'))
  return removed
}

// ---- flags + validation (guards against hallucinated meta) -----------------

// Minimal flag parser. `--key value` sets a string; a repeated `--key` builds an
// array; a `--key` with no following value (or followed by another `--`) is a
// boolean. An unknown flag is a hard error so a mistyped/hallucinated option can't
// be silently ignored.
function parseFlags(args, allowed) {
  const flags = {}
  const positional = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      if (allowed && !allowed.includes(key)) {
        die(`unknown option "--${key}". allowed: ${allowed.map((f) => '--' + f).join(', ')}`)
      }
      const next = args[i + 1]
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true
      } else {
        if (flags[key] === undefined) flags[key] = next
        else if (Array.isArray(flags[key])) flags[key].push(next)
        else flags[key] = [flags[key], next]
        i++
      }
    } else {
      positional.push(a)
    }
  }
  return { flags, positional }
}

function slugify(s) {
  const out = String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
  return out || 'task'
}

const LEVELS = ['high', 'med', 'low']

function validLevel(v, name) {
  if (!LEVELS.includes(v)) die(`--${name} must be one of ${LEVELS.join(' | ')} (got "${v}")`)
}

// The stages a card can rest in, in order: `todo` (raw), `ready` (plan concrete,
// no open questions, someone could start now), `implementing`. `reject`/`archive`
// take the card off the board, so they are not statuses — a live run's action is
// tracked in the UI registry, not here. A missing status reads as `todo`, so cards
// written before this field still parse.
const STATUSES = ['todo', 'ready', 'implementing']

function validStatus(v) {
  if (!STATUSES.includes(v)) die(`--status must be one of ${STATUSES.join(' | ')} (got "${v}")`)
}

function trackNames() {
  return fs
    .readdirSync(TODO, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
}

function validTrack(track) {
  const dir = path.join(TODO, track)
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    die(
      `unknown track "${track}". existing tracks: ${trackNames().join(', ') || '(none)'}. ` +
        `make the folder first or pick one of these — don't invent a track.`,
    )
  }
}

// The module map (docs/kanban/modules.md) lists the project's parts, one per line,
// each led by its **bolded name**. Parse just that bolded name at the front of a line —
// nothing else on the line. Returns null when there's no map yet (a pre-map install), so
// callers can skip the field instead of failing.
function moduleNames() {
  if (!fs.existsSync(MODULES_MD)) return null
  const names = []
  for (const line of fs.readFileSync(MODULES_MD, 'utf8').split('\n')) {
    const m = line.match(/^\s*[-*]\s+\*\*([^*]+)\*\*/)
    if (m) names.push(m[1].trim())
  }
  return names
}

// Split a --modules value (repeatable and/or comma-separated) into a clean name list.
function parseModuleList(raw) {
  return (Array.isArray(raw) ? raw : [raw])
    .flatMap((s) => String(s).split(','))
    .map((s) => s.trim())
    .filter(Boolean)
}

// Validate tags against the module map, the same way --track checks the track folders.
// No map yet → the field is skipped (returns []), not an error, so a pre-map install still
// works. An unknown name is a hard error whose message lists the known names and says how
// to add one — that message is the whole refresh path, so a new module gets on the map the
// moment someone tags a card with it.
function validModules(mods) {
  const known = moduleNames()
  if (known === null) {
    if (mods.length) warn(`no ${rel(MODULES_MD)} yet — skipping --modules ${mods.join(', ')}.`)
    return []
  }
  const unknown = mods.filter((mod) => !known.includes(mod))
  if (unknown.length) {
    die(
      `unknown module(s): ${unknown.join(', ')}. known modules: ${known.join(', ') || '(none)'}. ` +
        `if this really is a new part of the project, add a line to ${rel(MODULES_MD)} first ` +
        `(\`- **<name>** — <what it is>.\`), then tag the card — that line is how the map grows.`,
    )
  }
  return mods
}

// Ids must be plain numbers already allocated (< ceiling). Rejects invented ids
// like #999 that were never handed out.
function parseIdList(raw, name, ceiling) {
  const parts = (Array.isArray(raw) ? raw : [raw])
    .flatMap((s) => String(s).split(','))
    .map((s) => s.trim().replace(/^#/, ''))
    .filter(Boolean)
  return parts.map((p) => {
    if (!/^\d+$/.test(p)) die(`--${name} takes task ids (numbers), got "${p}"`)
    const n = Number(p)
    if (n < 1 || n >= ceiling) {
      die(`--${name} points at #${n}, not a real task id (ids so far go up to ${ceiling - 1}). don't invent ids.`)
    }
    return n
  })
}

// ---- frontmatter read/write ------------------------------------------------

function yamlScalar(s) {
  s = String(s)
  if (s === '') return '""'
  // Quote anything that could confuse a YAML reader; otherwise keep it plain.
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(s) || /:\s/.test(s) || /[\n"]/.test(s) || /^\s|\s$/.test(s)) {
    return JSON.stringify(s)
  }
  return s
}

function serializeFrontmatter(m) {
  const out = ['---']
  out.push(`title: ${yamlScalar(m.title)}`)
  out.push(`track: ${yamlScalar(m.track)}`)
  out.push(`priority: ${m.priority}`)
  out.push(`roi: ${m.roi}`)
  out.push(`status: ${STATUSES.includes(m.status) ? m.status : 'todo'}`)
  out.push(`blocked_by: [${(m.blocked_by || []).join(', ')}]`)
  out.push(`related: [${(m.related || []).join(', ')}]`)
  out.push(`modules: [${(m.modules || []).join(', ')}]`)
  if (!m.questions || m.questions.length === 0) out.push('questions: []')
  else {
    out.push('questions:')
    for (const q of m.questions) out.push(`  - ${yamlScalar(q)}`)
  }
  out.push('---')
  return out.join('\n')
}

function unquote(v) {
  v = String(v).trim()
  if (v.startsWith('"') && v.endsWith('"')) {
    try {
      return JSON.parse(v)
    } catch {
      return v.slice(1, -1)
    }
  }
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1)
  return v
}

// Parse the leading `--- ... ---` block into a meta object; returns the rest as body.
// Only needs to read what this script (and `migrate`) write.
function parseFrontmatter(text) {
  const lines = text.split('\n')
  if (lines[0].trim() !== '---') return { meta: null, body: text }
  let i = 1
  const fm = []
  while (i < lines.length && lines[i].trim() !== '---') {
    fm.push(lines[i])
    i++
  }
  if (i >= lines.length) return { meta: null, body: text }
  const meta = {}
  for (let j = 0; j < fm.length; j++) {
    const m = fm[j].match(/^([A-Za-z_]+):\s*(.*)$/)
    if (!m) continue
    const key = m[1]
    const val = m[2]
    if (val === '') {
      const items = []
      while (j + 1 < fm.length && /^\s*-\s+/.test(fm[j + 1])) {
        items.push(unquote(fm[j + 1].replace(/^\s*-\s+/, '')))
        j++
      }
      meta[key] = items
    } else if (val.startsWith('[')) {
      const inner = val.slice(1, val.lastIndexOf(']'))
      meta[key] = inner.split(',').map((s) => s.trim()).filter(Boolean).map(unquote)
    } else {
      meta[key] = unquote(val)
    }
  }
  for (const k of ['blocked_by', 'related']) {
    if (Array.isArray(meta[k])) {
      meta[k] = meta[k].map((x) => Number(String(x).replace(/^#/, ''))).filter((n) => Number.isInteger(n))
    } else {
      meta[k] = []
    }
  }
  if (!Array.isArray(meta.questions)) meta.questions = meta.questions ? [meta.questions] : []
  // modules is an optional string list; a card written before this field parses as [].
  if (!Array.isArray(meta.modules)) meta.modules = []
  return { meta, body: lines.slice(i + 1).join('\n') }
}

// ---- question tags ---------------------------------------------------------
//
// An open question may lead with a tag token — `[user] ...` or `[agent] ...` —
// saying who owns it: the human (a judgment call it can't decide) or the agent
// (one auto-refine answers itself). No token means untagged: freshly raised, not
// yet triaged. The tag lives in the string; parseQuestion splits it off,
// formatQuestion puts it back. Kept in step with parseQuestion in
// kanban-ui/lib/questions.ts.
const QUESTION_TAGS = ['user', 'agent']

function parseQuestion(raw) {
  const m = String(raw).match(/^\[(user|agent)\]\s+([\s\S]*)$/)
  return m ? { tag: m[1], text: m[2] } : { tag: null, text: String(raw) }
}

function formatQuestion(tag, text) {
  return tag ? `[${tag}] ${text}` : text
}

// Warn (don't fail) when a question leads with a `[...]` token that isn't a known
// tag — almost always a typo like `[users]` that would silently read as text.
function warnBadQuestionTags(questions) {
  for (const q of questions) {
    const m = String(q).match(/^\[([^\]]+)\]\s/)
    if (m && !QUESTION_TAGS.includes(m[1].toLowerCase())) {
      warn(`question tag "[${m[1]}]" isn't recognised — use [user] or [agent] (or no tag). Stored as literal text.`)
    }
  }
}

// A todo item in any accepted form: `- [ ]`, `- []`, `- [x]`, `* [X]`, … — the shape
// counts, not the literal string.
const TODO_ITEM = /^[ \t]*[-*+][ \t]*\[[ xX]?\]/m

function defaultBody() {
  return [
    '<one short line: what to do and why it matters.>',
    '',
    '## Scope',
    '- <the concrete steps>',
    '',
    '## Todo',
    '- [ ] every task must have todos — replace this line with the real steps.',
    '',
  ].join('\n')
}

// ---- README index entries --------------------------------------------------

const readmeHeadingFor = (track) => (track === 'blockers' ? 'Blockers' : track)

// Insert a card's bullet under its track heading, replacing a `_(none)_` placeholder
// or appending after the section's last bullet. Adds the section if it's missing.
function addReadmeRef(track, id, title, relPath) {
  if (!fs.existsSync(README)) return false
  const link = relPath.split(path.sep).join('/')
  const bullet = `- [#${id} ${title}](${link})`
  const heading = `## ${readmeHeadingFor(track)}`
  let lines = fs.readFileSync(README, 'utf8').split('\n')
  const hi = lines.findIndex((l) => l.trim().toLowerCase() === heading.toLowerCase())
  if (hi === -1) {
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop()
    lines.push('', heading, '', bullet)
    fs.writeFileSync(README, lines.join('\n') + '\n')
    return true
  }
  let end = hi + 1
  while (end < lines.length && !/^##\s/.test(lines[end])) end++
  const noneRel = lines.slice(hi + 1, end).findIndex((l) => l.trim() === '_(none)_')
  if (noneRel !== -1) {
    lines[hi + 1 + noneRel] = bullet
  } else {
    let lastBullet = -1
    for (let k = hi + 1; k < end; k++) if (/^\s*-\s/.test(lines[k])) lastBullet = k
    const at = lastBullet !== -1 ? lastBullet + 1 : lines[hi + 1] === '' ? hi + 2 : hi + 1
    lines.splice(at, 0, bullet)
  }
  fs.writeFileSync(README, lines.join('\n'))
  return true
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Fix a README link to task #id in place, after a subtask rename or retitle. A
// subtask's only README line is the nested bullet under its group root, so the
// bullet keeps its position — only the link text and target change. No-op when
// the README doesn't link the card.
function repointReadmeLink(id, oldRel, newRel, title) {
  if (!fs.existsSync(README)) return false
  const oldLink = oldRel.split(path.sep).join('/')
  const newLink = newRel.split(path.sep).join('/')
  const linkRe = new RegExp(`\\[#${id}\\b[^\\]]*\\]\\(${escapeRegex(oldLink)}\\)`)
  const lines = fs.readFileSync(README, 'utf8').split('\n')
  let changed = false
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes(`](${oldLink})`)) continue
    const next = linkRe.test(lines[i])
      ? lines[i].replace(linkRe, () => `[#${id} ${title}](${newLink})`)
      : lines[i].split(`](${oldLink})`).join(`](${newLink})`)
    if (next !== lines[i]) {
      lines[i] = next
      changed = true
    }
  }
  if (changed) fs.writeFileSync(README, lines.join('\n'))
  return changed
}

// ---- init ------------------------------------------------------------------

// Default tracks when `init` is run with no track args. Swap by passing your own,
// e.g. `init growth validation building`. Keep in step with the SKILL.md defaults.
const DEFAULT_TRACKS = ['feature', 'bug', 'research']

// The memory file set — the same five files fill a memory path at either level: the board
// root (the umbrella memory, covering the whole project) and each module's own path at
// `memory/<module>/`. Each starter is a short header that tells the next reader what the
// file is for; the flows fill in the rest over time. Plain language, to match the skill.
const MEMORY_SET = {
  'readme.md': `# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

_(nothing recorded yet — the first finished task fills it in.)_
`,
  'goal.md': `# Goal

The direction, in the user's own words — where this is headed. One short statement. The
user owns this file; the agent seeds it but does not invent the goal.

_(not filled in yet — the user writes this.)_
`,
  'decisions.md': `# Decisions

Settled answers to cards' open questions, grouped by topic. Keep only **user-facing**
calls that guide future planning — what a user can see, do, or would care about.
Internal detail stays on the card.
`,
  'redesign.md': `# Redesign

Design mistakes to avoid when writing a card, grouped by topic. One entry each: the
mistake, then the design we actually want. Read before writing or reviewing a card.
`,
  'rejected.md': `# Rejected

Ideas we turned down, grouped by topic. One line each: the idea, and why we said no. Read
before proposing so you don't re-suggest them.
`,
}

function boardReadme(tracks) {
  const sections = ['## Blockers', '', '_(none)_', '']
  for (const t of tracks) sections.push(`## ${t}`, '', '_(none)_', '')
  return `# Board

Open tasks for the kanban board. One card per file. Ids are global and never reused —
the number at the front of a filename is the task id.

Blockers gate the next milestone; clear them first. Everything else sits under a track.

${sections.join('\n')}`
}

// Seed the per-project config at docs/kanban/config.md from the blank template shipped
// beside this script. The config lives WITH the board (not in the skill folder) so a
// read-only plugin cache still yields an editable, per-project file. Idempotent: it never
// overwrites a config that's already there, so a filled-in config survives a re-run.
function writeConfigIfMissing() {
  if (fs.existsSync(CONFIG)) return false
  const template = path.join(SCRIPT_DIR, 'config.md')
  if (!fs.existsSync(template)) die(`missing config template at ${template}`)
  fs.mkdirSync(KANBAN, { recursive: true })
  fs.copyFileSync(template, CONFIG)
  return true
}

function cmdInit(args) {
  const tracks = args.length ? args : DEFAULT_TRACKS
  for (const t of tracks) {
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(t)) {
      die(`bad track name "${t}" — use letters, digits, and dashes (a folder name)`)
    }
  }
  if (fs.existsSync(KANBAN)) {
    // An existing board still needs docs/kanban/config.md if it predates the move out of
    // the skill folder — add it, but never touch a config that's already filled in.
    const added = writeConfigIfMissing()
    console.log(
      added
        ? `board already exists at ${rel(KANBAN)}/ — added the missing ${rel(CONFIG)} (safe to re-run)`
        : `board already exists at ${rel(KANBAN)}/ — nothing to do (safe to re-run)`,
    )
    return
  }
  fs.mkdirSync(path.join(TODO, 'blockers'), { recursive: true })
  for (const t of tracks) fs.mkdirSync(path.join(TODO, t), { recursive: true })
  fs.writeFileSync(README, boardReadme(tracks))
  for (const [name, body] of Object.entries(MEMORY_SET)) {
    fs.writeFileSync(path.join(KANBAN, name), body)
  }
  writeConfigIfMissing()
  writeNextId(1)
  console.log(`initialised board at ${rel(KANBAN)}/`)
  console.log(`  tracks: ${tracks.join(', ')}`)
  console.log(`  next: fill the Configuration in ${rel(CONFIG)}, then \`create\` your first task`)
}

// Lazily scaffold a module's memory path with the five-file set. A module has no folder
// until its first write; the writing flow (propose, reject, redesign, resolve)
// runs this first, then writes into the file it needs. Idempotent: creates only what's
// missing, so it's safe to call before every write. Keyed by the module's bolded name in
// modules.md — passed verbatim as the folder name.
function cmdMemoryInit(module) {
  if (!module) die('memory-init needs a module name (its bolded name in modules.md)')
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(module)) {
    die(`bad module name "${module}" — use letters, digits, and dashes (a folder name)`)
  }
  const dir = path.join(KANBAN, 'memory', module)
  const existed = fs.existsSync(dir)
  fs.mkdirSync(dir, { recursive: true })
  const made = []
  for (const [name, body] of Object.entries(MEMORY_SET)) {
    const file = path.join(dir, name)
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, body)
      made.push(name)
    }
  }
  if (!existed) console.log(`created memory path ${rel(dir)}/ with the five-file set`)
  else if (made.length) console.log(`filled in missing files in ${rel(dir)}/: ${made.join(', ')}`)
  else console.log(`${rel(dir)}/ already has the full set — nothing to do`)
}

// ---- commands --------------------------------------------------------------

const CREATE_FLAGS = ['title', 'track', 'priority', 'roi', 'blocked-by', 'related', 'modules', 'question', 'slug', 'count', 'no-body']

// Two modes:
//   bare      `create [--count N]`  → allocate ids and print them (group-task setup).
//   card mode `create --title ... --track ...` → allocate ONE id, write the card's
//             frontmatter + a body template, and index it. The script owns the meta;
//             fill the body with your editor and leave the frontmatter alone.
function cmdCreate(args) {
  const { flags, positional } = parseFlags(args, CREATE_FLAGS)
  if (positional.length) die(`create takes options, not positional args (got "${positional.join(' ')}")`)

  if (flags.title === undefined) {
    for (const bad of ['track', 'priority', 'roi', 'blocked-by', 'related', 'modules', 'question', 'slug', 'no-body']) {
      if (flags[bad] !== undefined) die(`--${bad} needs --title (that's card mode). Without --title, create only allocates ids.`)
    }
    const count = flags.count !== undefined ? Number(flags.count) : 1
    if (!Number.isInteger(count) || count < 1) die('--count must be a positive integer')
    const start = readNextId()
    const ids = Array.from({ length: count }, (_, k) => start + k)
    writeNextId(start + count)
    bumpMetric('created', count)
    console.log(ids.join('\n'))
    reconcileBoard()
    return
  }

  // --- card mode ---
  if (flags.count !== undefined) die("--count can't be combined with --title (card mode makes exactly one card)")
  const title = String(flags.title).trim()
  if (!title) die('--title must not be empty')
  if (flags.track === undefined) die('--track is required in card mode (e.g. --track feature)')
  const track = String(flags.track).trim()
  validTrack(track)
  const priority = flags.priority !== undefined ? String(flags.priority) : 'med'
  validLevel(priority, 'priority')
  const roi = flags.roi !== undefined ? String(flags.roi) : 'med'
  validLevel(roi, 'roi')
  const start = readNextId()
  const blocked_by = flags['blocked-by'] !== undefined ? parseIdList(flags['blocked-by'], 'blocked-by', start) : []
  const related = flags.related !== undefined ? parseIdList(flags.related, 'related', start) : []
  const modules = flags.modules !== undefined ? validModules(parseModuleList(flags.modules)) : []
  const questions = flags.question !== undefined ? (Array.isArray(flags.question) ? flags.question : [flags.question]).map(String) : []
  warnBadQuestionTags(questions)
  const slug = slugify(flags.slug !== undefined ? flags.slug : title)
  const fileRel = path.join(track, `${start}-${slug}.md`)
  const file = path.join(TODO, fileRel)
  if (fs.existsSync(file)) die(`${rel(file)} already exists — pick a different --slug`)

  // validation passed → allocate + write
  writeNextId(start + 1)
  bumpMetric('created')
  const meta = { title, track, priority, roi, status: 'todo', blocked_by, related, modules, questions }
  const body = flags['no-body'] ? '' : defaultBody()
  fs.writeFileSync(file, serializeFrontmatter(meta) + '\n\n' + body)
  const indexed = addReadmeRef(track, start, title, fileRel)
  console.log(start)
  console.log(`  wrote ${rel(file)} — frontmatter is set; fill the body with your editor, leave the frontmatter to the script`)
  if (!TODO_ITEM.test(body)) warn(`#${start} has no todos — every task needs a \`- [ ]\` list under ## Todo`)
  if (indexed) console.log(`  indexed under "## ${readmeHeadingFor(track)}"`)
  reconcileBoard()
}

const UPDATE_FLAGS = ['title', 'track', 'priority', 'roi', 'status', 'blocked-by', 'related', 'modules', 'question', 'clear-questions', 'slug']

// Rewrite a card's frontmatter. Also the sanctioned way to move a card between tracks
// (--track moves the file + fixes the index) or rename it (--slug). Body is untouched.
function cmdUpdate(args) {
  const { flags, positional } = parseFlags(args, UPDATE_FLAGS)
  const id = Number(positional[0])
  if (!Number.isInteger(id)) die('need a numeric task id: update <id> [--field value ...]')
  const found = locate(id)
  if (!found) die(`no task with id ${id} under ${rel(TODO)}`)
  const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
  if (!meta) die(`${rel(file)} has no frontmatter — run \`migrate\` first`)

  const changes = []
  if (flags.title !== undefined) {
    const t = String(flags.title).trim()
    if (!t) die('--title must not be empty')
    meta.title = t
    changes.push('title')
  }
  if (flags.priority !== undefined) {
    validLevel(String(flags.priority), 'priority')
    meta.priority = String(flags.priority)
    changes.push('priority')
  }
  if (flags.roi !== undefined) {
    validLevel(String(flags.roi), 'roi')
    meta.roi = String(flags.roi)
    changes.push('roi')
  }
  if (flags.status !== undefined) {
    validStatus(String(flags.status))
    meta.status = String(flags.status)
    changes.push('status')
  }
  const ceiling = readNextId()
  if (flags['blocked-by'] !== undefined) {
    meta.blocked_by = parseIdList(flags['blocked-by'], 'blocked-by', ceiling)
    changes.push('blocked_by')
  }
  if (flags.related !== undefined) {
    meta.related = parseIdList(flags.related, 'related', ceiling)
    changes.push('related')
  }
  if (flags.modules !== undefined) {
    meta.modules = validModules(parseModuleList(flags.modules))
    changes.push('modules')
  }
  if (flags['clear-questions']) {
    meta.questions = []
    changes.push('questions')
  }
  if (flags.question !== undefined) {
    meta.questions = (Array.isArray(flags.question) ? flags.question : [flags.question]).map(String)
    warnBadQuestionTags(meta.questions)
    changes.push('questions')
  }

  // A `ready` card has no open questions by definition (see STATUSES). Adding one
  // means the plan is no longer settled, so drop it back to `todo`. This holds the
  // invariant no matter who adds the question (refine review, resolve, the UI).
  if (meta.questions.length > 0 && meta.status === 'ready') {
    meta.status = 'todo'
    changes.push('status→todo (open questions)')
  }

  // A card's track is the folder its file sits in — right for a standalone card
  // (skill/06 → skill), a group subtask (<group>/skill/21 → skill), a blocker,
  // and a recurring card alike. A group root's own folder is the group, not a
  // track, so its frontmatter value stands.
  const curRel = path.relative(TODO, file)
  const curTrack = found.kind === 'group' ? meta.track : path.basename(path.dirname(file))
  const isSubtask = found.kind === 'file' && enclosingGroupRoot(file) !== null
  let newTrack = curTrack
  if (flags.track !== undefined) {
    if (found.kind === 'group') die('moving a group task between tracks by script is not supported — move the folder by hand')
    if (isSubtask) die('moving a group subtask between tracks by script is not supported — move the file by hand')
    newTrack = String(flags.track).trim()
    validTrack(newTrack)
  }
  let base = path.basename(file)
  if (flags.slug !== undefined) {
    if (found.kind === 'group') die('renaming a group root by script is not supported')
    base = `${id}-${slugify(flags.slug)}.md`
  }
  meta.track = newTrack
  // Only a standalone card can change folders (--track). A subtask and a group
  // root stay in their own folder; --slug at most renames the file there.
  const standalone = found.kind === 'file' && !isSubtask
  const destRel = standalone ? path.join(newTrack, base) : path.join(path.dirname(curRel), base)
  const dest = path.join(TODO, destRel)
  const moving = dest !== file
  if (moving && fs.existsSync(dest)) die(`${rel(dest)} already exists`)

  fs.writeFileSync(file, serializeFrontmatter(meta) + '\n' + body)
  if (moving) fs.renameSync(file, dest)
  if (isSubtask) {
    // A subtask never owns a top-level README entry — fix its nested bullet in place.
    if (moving || changes.includes('title')) repointReadmeLink(id, curRel, destRel, meta.title)
    if (moving) changes.push(`renamed → ${destRel.split(path.sep).join('/')}`)
  } else if (moving) {
    stripReadmeRefs({ kind: 'file', rel: curRel })
    addReadmeRef(newTrack, id, meta.title, destRel)
    changes.push(`moved → ${destRel.split(path.sep).join('/')}`)
  } else if (changes.includes('title')) {
    stripReadmeRefs({ kind: 'file', rel: curRel })
    addReadmeRef(curTrack, id, meta.title, curRel)
  }
  console.log(`updated #${id}: ${changes.join(', ') || '(nothing changed)'}`)
}

// Set (or clear) the tag on one open question, so the auto-refine loop can hand a
// question to the human without rewriting the whole list. `n` is the question's
// 1-based position; `tag` is user | agent | none (none strips any tag). Reads and
// rewrites the frontmatter through the same path as `update`, so byte layout and
// group-root handling stay identical.
function cmdTag(args) {
  const [idRaw, nRaw, tagRaw] = args
  const id = Number(idRaw)
  if (!Number.isInteger(id)) die('need a numeric task id: tag <id> <n> <user|agent|none>')
  const n = Number(nRaw)
  if (!Number.isInteger(n) || n < 1) die('need a 1-based question number: tag <id> <n> <user|agent|none>')
  const tag = String(tagRaw || '').toLowerCase()
  if (tag !== 'none' && !QUESTION_TAGS.includes(tag)) {
    die(`tag must be one of ${QUESTION_TAGS.join(' | ')} | none (got "${tagRaw}")`)
  }
  const found = locate(id)
  if (!found) die(`no task with id ${id} under ${rel(TODO)}`)
  const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
  if (!meta) die(`${rel(file)} has no frontmatter — run \`migrate\` first`)
  if (n > meta.questions.length) {
    die(`#${id} has ${meta.questions.length} open question(s) — there's no question ${n} to tag.`)
  }
  const { text } = parseQuestion(meta.questions[n - 1])
  meta.questions[n - 1] = formatQuestion(tag === 'none' ? null : tag, text)
  fs.writeFileSync(file, serializeFrontmatter(meta) + '\n' + body)
  console.log(`tagged #${id} question ${n} as ${tag === 'none' ? '(untagged)' : `[${tag}]`}: ${text}`)
}

// ---- migrate old cards to frontmatter --------------------------------------

// Pull meta out of the old bold-line header. Missing fields fall back to safe
// defaults (empty lists, med level) rather than guessing.
function extractOldMeta(text, file) {
  const grab = (re) => {
    const m = text.match(re)
    return m ? m[1].trim() : null
  }
  const folderTrack = path.relative(TODO, file).split(path.sep)[0]
  const title = grab(/^#\s+(.+)$/m) || slugify(path.basename(file, '.md').replace(/^\d+-/, '')).replace(/-/g, ' ')
  const track = (grab(/\*\*Track:\*\*\s*([^·|\n]+?)\s*(?:·|\||\n|$)/) || folderTrack).toLowerCase()
  const norm = (v) => {
    v = (v || '').toLowerCase()
    return LEVELS.includes(v) ? v : 'med'
  }
  const ids = (raw) => (raw && !/none/i.test(raw) ? (raw.match(/\d+/g) || []).map(Number) : [])
  return {
    title,
    track,
    priority: norm(grab(/\*\*Priority:\*\*\s*([^·|\n]+?)\s*(?:·|\||\n|$)/)),
    roi: norm(grab(/\*\*ROI:\*\*\s*([^·|\n]+?)\s*(?:·|\||\n|$)/)),
    status: 'todo',
    blocked_by: ids(grab(/\*\*Blocked by:\*\*\s*([^·|\n]+?)\s*(?:·|\||\n|$)/)),
    related: ids(grab(/\*\*Related:\*\*\s*([^·|\n]+?)\s*(?:·|\||\n|$)/)),
    questions: [],
  }
}

// Drop the leading H1 + bold meta lines; keep the body below them.
function stripOldHeader(text) {
  const lines = text.split('\n')
  let lastMeta = -1
  for (let k = 0; k < lines.length && k < 8; k++) {
    if (/^#\s/.test(lines[k]) || /^\*\*(Track|Priority|ROI|Blocked by|Related):\*\*/.test(lines[k])) lastMeta = k
  }
  const rest = lines.slice(lastMeta + 1)
  while (rest.length && rest[0].trim() === '') rest.shift()
  return rest.join('\n')
}

function cmdMigrate(args) {
  const { flags } = parseFlags(args, ['dry-run', 'dry'])
  const dry = !!(flags['dry-run'] || flags.dry)
  const files = walkMd(TODO).filter((f) => path.basename(f) !== 'README.md')
  let changed = 0
  let skipped = 0
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8')
    if (text.trimStart().startsWith('---')) {
      skipped++
      continue
    }
    const meta = extractOldMeta(text, file)
    const out = serializeFrontmatter(meta) + '\n\n' + stripOldHeader(text).replace(/^\n+/, '')
    if (dry) console.log(`would migrate ${rel(file)}  (track=${meta.track} priority=${meta.priority} roi=${meta.roi})`)
    else {
      fs.writeFileSync(file, out.endsWith('\n') ? out : out + '\n')
      console.log(`migrated ${rel(file)}`)
    }
    changed++
  }
  console.log(`\n${dry ? '(dry run) ' : ''}${changed} card(s) ${dry ? 'to migrate' : 'migrated'}, ${skipped} already frontmatter`)
}

// Where a finished card goes. It sits next to `todo/`, not inside it: everything that
// walks the board reads every folder under `todo/` without skipping dot-names, so an
// archive folder there would show up as a track column and finished cards would look
// open. Flat — no track subfolders — because ids are never reused so names never
// collide, and each card still names its track in its own frontmatter. Nothing reads
// this folder; it is a git history store, not part of the memory set.
function archiveDest(found) {
  const dest = path.join(ARCHIVE, path.basename(found.target))
  // Only reachable if someone moved a file here by hand. Never overwrite finished work.
  if (fs.existsSync(dest)) die(`${rel(dest)} already exists — move it aside first, then archive again`)
  return dest
}

function cmdRemove(id, metric) {
  if (!Number.isInteger(id)) die('need a numeric task id')
  const found = locate(id)
  if (!found) die(`no task with id ${id} under ${rel(TODO)}`)
  // Archive keeps the card (moved out of todo/), reject deletes it. Resolve the
  // destination before anything is written, so a name clash fails with the board
  // untouched rather than half-updated.
  const dest = metric === 'completed' ? archiveDest(found) : null
  const removedRefs = stripReadmeRefs(found)
  // A subtask's fate is reflected in its group's root.md ## Todo, so the tracking card
  // stays accurate after the subtask file is gone: archive ticks it done, reject strikes
  // it out. Warn if the subtask isn't listed there, so the stale checklist gets noticed.
  const groupRoot = found.kind === 'file' ? enclosingGroupRoot(found.target) : null
  let marked = null
  if (groupRoot) {
    const action = metric === 'completed' ? 'tick' : 'strike'
    if (markSubtask(groupRoot, id, action)) marked = action
    else warn(`#${id} isn't listed in ${rel(groupRoot)} ## Todo — nothing to ${action === 'tick' ? 'tick off' : 'strike out'}.`)
  }
  if (dest) {
    fs.mkdirSync(ARCHIVE, { recursive: true })
    fs.renameSync(found.target, dest)
  } else if (found.kind === 'group') {
    fs.rmSync(found.target, { recursive: true, force: true })
  } else {
    fs.rmSync(found.target)
  }
  bumpMetric(metric)
  const what = found.kind === 'group' ? `folder ${found.rel}/` : `file ${found.rel}`
  if (dest) console.log(`archived #${id}: moved ${what} → ${rel(dest)}${found.kind === 'group' ? '/' : ''}`)
  else console.log(`rejected #${id}: removed ${what}`)
  if (removedRefs.length) console.log(`  dropped ${removedRefs.length} README entry(ies)`)
  else console.log('  no README entry (subtask or untracked)')
  if (marked) console.log(`  ${marked === 'tick' ? 'ticked' : 'struck'} #${id} in ${rel(groupRoot)}`)
}

// A recurring task never archives — each run bumps "completed" but the card stays,
// so its ## Process can be refined toward less human effort on the next run. Recurring
// cards live in the `recurring/` folder, parallel to the track folders; the guard keys
// off that so a one-shot task can't be run.
function isRecurringCard(found) {
  return found.rel.split(path.sep)[0] === 'recurring'
}

// Print the installed version. SKILL_VERSION is the released number baked into this file;
// `.version` (written by the install/update prompt) adds the source SHA + date it came from,
// so an update can `git log <sha>..HEAD` to summarise what changed.
function cmdVersion() {
  console.log(`kanban skill ${SKILL_VERSION}`)
  const stamp = path.join(SCRIPT_DIR, '.version')
  if (fs.existsSync(stamp)) {
    console.log(fs.readFileSync(stamp, 'utf8').trim())
  } else {
    console.log('  (no .version stamp — installed before versioning, or a source checkout)')
  }
}

function cmdRun(id) {
  if (!Number.isInteger(id)) die('need a numeric task id')
  const found = locate(id)
  if (!found) die(`no task with id ${id} under ${rel(TODO)}`)
  if (!isRecurringCard(found)) {
    die(`#${id} is not recurring (${found.rel} is not under recurring/). Use \`archive\` for one-shot tasks.`)
  }
  bumpMetric('completed')
  console.log(`ran #${id}: +1 completed (card kept — recurring)`)
  console.log('  next: fold this run into the card\'s ## Process; log unrepeatable asks in its open-questions file')
  reconcileBoard()
}

// ---- board integrity (run after create/run) --------------------------------
//
// A safety net for cards moved, renamed, or removed by hand (Write/Edit/mv instead of
// the script), which leaves the README index and cross-references stale. It NEVER fails
// the command — the id was already handed out and the board change already happened, so
// a broken link must not block it. Warnings go to stderr so `create`'s stdout (the id)
// stays clean for callers. It does two things:
//   • repoints a README link whose target file vanished but whose id still has a card
//     elsewhere on disk (a hand-move/rename) — the only auto-fix, and
//   • warns about what it can't safely repair: an index entry for an id with no card, a
//     top-level card with no index entry, or a blocked_by/related pointing at a task
//     that's no longer on the board.
function warn(msg) {
  console.error(`kanban: warning — ${msg}`)
}

// A README entry links a card as `[#id title](relpath)`. Grab the id and the path.
const README_LINK = /\[#(\d+)\b[^\]]*\]\(([^)]+)\)/

// Every task id that still has a card on disk (standalone, subtask, or group root).
function liveIds() {
  const ids = new Set()
  for (const file of walkMd(TODO)) {
    const base = path.basename(file)
    if (base === 'README.md') continue
    const id = base === 'root.md' ? idPrefix(path.basename(path.dirname(file))) : idPrefix(base)
    if (id != null) ids.add(id)
  }
  return ids
}

// Cards that OWN a top-level README entry: a group root, or a card directly in a track
// folder. Nested subtasks are only optionally indexed, so they aren't required here.
function indexableCards() {
  const out = []
  for (const dir of walkDirs(TODO)) {
    const id = idPrefix(path.basename(dir))
    if (id != null && fs.existsSync(path.join(dir, 'root.md'))) {
      out.push({ id, rel: path.join(path.relative(TODO, dir), 'root.md').split(path.sep).join('/') })
    }
  }
  for (const file of walkMd(TODO)) {
    const base = path.basename(file)
    if (base === 'README.md' || base === 'root.md') continue
    const relTODO = path.relative(TODO, file)
    const segs = relTODO.split(path.sep)
    if (segs.length !== 2) continue // nested subtask — optional
    if (segs[0] === 'recurring') continue // recurring cards aren't board-index tasks
    const id = idPrefix(base)
    if (id != null) out.push({ id, rel: segs.join('/') })
  }
  return out
}

// Repoint stale README links to where the id actually lives now; warn on the rest.
function reconcileReadmeLinks() {
  const lines = fs.readFileSync(README, 'utf8').split('\n')
  const indexed = new Set()
  let fixed = 0
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(README_LINK)
    if (!m) continue
    const id = Number(m[1])
    const linkPath = m[2]
    indexed.add(id)
    if (fs.existsSync(path.join(TODO, linkPath))) continue // link is live
    const found = locate(id)
    if (!found) {
      warn(`README links #${id} → ${linkPath}, but no card with that id exists (removed by hand?). Drop the entry or restore the file.`)
      continue
    }
    const want = (found.kind === 'group' ? path.join(found.rel, 'root.md') : found.rel).split(path.sep).join('/')
    if (want === linkPath) continue
    lines[i] = lines[i].replace(`(${linkPath})`, `(${want})`)
    warn(`README link #${id} pointed at missing ${linkPath} → repointed to ${want}.`)
    fixed++
  }
  if (fixed) fs.writeFileSync(README, lines.join('\n'))
  for (const c of indexableCards()) {
    if (!indexed.has(c.id)) {
      warn(`card ${c.rel} (#${c.id}) is not in the README index. Add it under its track heading.`)
    }
  }
}

// Flag blocked_by/related that point at a task no longer on the board.
function reconcileCrossRefs() {
  const live = liveIds()
  for (const file of walkMd(TODO)) {
    const base = path.basename(file)
    if (base === 'README.md') continue
    const ownerId = base === 'root.md' ? idPrefix(path.basename(path.dirname(file))) : idPrefix(base)
    if (ownerId == null) continue
    const { meta } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
    if (!meta) continue
    for (const field of ['blocked_by', 'related']) {
      for (const ref of meta[field] || []) {
        if (!live.has(ref)) {
          warn(`#${ownerId} ${field} #${ref}, which is no longer on the board (archived/rejected?). Fix it with \`update ${ownerId}\`.`)
        }
      }
    }
  }
}

function reconcileBoard() {
  if (!fs.existsSync(README)) return
  reconcileReadmeLinks()
  reconcileCrossRefs()
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2)
  switch (cmd) {
    case 'init':
      return cmdInit(rest)
    case 'memory-init':
      return cmdMemoryInit(rest[0])
    case 'create':
      return cmdCreate(rest)
    case 'update':
      return cmdUpdate(rest)
    case 'tag':
      return cmdTag(rest)
    case 'migrate':
      return cmdMigrate(rest)
    case 'archive':
      return cmdRemove(Number(rest[0]), 'completed')
    case 'reject':
      return cmdRemove(Number(rest[0]), 'rejected')
    case 'run':
      return cmdRun(Number(rest[0]))
    case 'peek':
      return console.log(readNextId())
    case 'version':
    case '--version':
    case '-v':
      return cmdVersion()
    case 'metrics':
      return console.log(fs.existsSync(METRICS) ? fs.readFileSync(METRICS, 'utf8').trim() : '(no metrics yet)')
    case 'help':
    case '-h':
    case '--help':
    case undefined:
      return console.log(HELP)
    default: {
      const guess = nearestCommand(cmd)
      const hint = guess ? ` Did you mean \`${guess}\`?` : ''
      console.error(`kanban: unknown command "${cmd}".${hint}\n`)
      console.error(HELP)
      process.exit(1)
    }
  }
}

const COMMANDS = ['init', 'memory-init', 'create', 'update', 'tag', 'migrate', 'archive', 'reject', 'run', 'peek', 'version', 'metrics', 'help']

const HELP = `kanban — the only sanctioned writer of docs/kanban/next-id.

Usage: node ${rel(SELF)} <command> [args]

  init [track...]      scaffold docs/kanban/ (folders, the umbrella memory set, and a blank
                       config.md); tracks default to feature bug research. On an existing
                       board it only adds config.md if it's missing (safe to re-run).
  memory-init <module> lazily scaffold docs/kanban/memory/<module>/ with the five-file set
                       (readme, goal, decisions, redesign, rejected). Idempotent —
                       run it before the first write to a module's memory.
  create [--count N]   allocate N task ids (default 1), advance next-id, print them
  create --title T --track K [opts]
                       scaffold ONE card: write its frontmatter + a body template, index it.
                       opts: --priority high|med|low (default med), --roi high|med|low
                       (default med), --blocked-by 1,2, --related 3, --modules skill,site
                       (validated against modules.md), --question "..." (repeatable),
                       --slug my-slug, --no-body.
                       The script owns the frontmatter — fill only the body by hand.
  update <id> [opts]   rewrite a card's frontmatter (same opts as create, plus
                       --status todo|ready|implementing and --clear-questions).
                       --track moves the card + fixes the index; --slug renames it.
                       Body is left untouched. A question may carry a leading
                       [user]/[agent] tag saying who owns it.
  tag <id> <n> <t>     set the tag on the nth open question (1-based): user | agent
                       | none (none strips it). Used by the auto-refine loop to
                       hand a question to the human without rewriting the list.
  migrate [--dry-run]  convert old bold-header cards to frontmatter; missing meta falls
                       back to empty / med. Skips cards that already have frontmatter.
  archive <id>         finish task <id>: move its file/folder into docs/kanban/.archive/,
                       strip its README entry, count completed
  reject  <id>         reject task <id>: same, but delete the file/folder, count rejected
  run     <id>         record one run of recurring task <id>: +1 completed, card kept (no archive)
  peek                 print the current next-id (no bump)
  version              print the installed skill version (+ source stamp if present)
  metrics              print docs/kanban/metrics.csv
  help                 show this

Never edit next-id or metrics.csv by hand — let the script write them. Never hand-write a
card's frontmatter — use create/update. Write/Edit are only for the card body.`

// Levenshtein-based suggestion so a mistyped command auto-corrects to the closest match.
function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[a.length][b.length]
}

function nearestCommand(input) {
  let best = null
  let bestDist = Infinity
  for (const c of COMMANDS) {
    const d = editDistance(input, c)
    if (d < bestDist) [best, bestDist] = [c, d]
  }
  // Only suggest when it's a plausible typo, not a wildly different word.
  return bestDist <= Math.max(2, Math.ceil(best.length / 2)) ? best : null
}

main()
