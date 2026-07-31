// ---- create / update / update-questions / tag ------------------------------
//
// The commands that write a live card's frontmatter. The script owns the meta;
// Write/Edit are for the body only.

import fs from 'node:fs'
import path from 'node:path'

import { die, warn, rel, readNextId, writeNextId, TODO } from '../lib/paths.mjs'
import { bumpMetric } from '../lib/metrics.mjs'
import { parseFlags, slugify, validLevel, validStatus, validTrack, validModules, parseModuleList, parseIdList } from '../lib/validate.mjs'
import { QUESTION_TAGS, parseQuestion, formatQuestion, warnBadQuestionTags, collectQuestions, parseQuestionOps, parseQuestionPositions } from '../lib/questions.mjs'
import { serializeFrontmatter, parseFrontmatter } from '../lib/frontmatter.mjs'
import { locate, enclosingGroupRoot } from '../lib/cards.mjs'
import { readmeHeadingFor, addReadmeRef, stripReadmeRefs, repointReadmeLink } from '../lib/readme.mjs'
import { reconcileBoard } from '../lib/reconcile.mjs'

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

const CREATE_FLAGS = ['title', 'track', 'priority', 'roi', 'blocked-by', 'related', 'modules', 'question', 'option', 'mode', 'recommended-option', 'slug', 'count', 'no-body']

// Two modes:
//   bare      `create [--count N]`  → allocate ids and print them (group-task setup).
//   card mode `create --title ... --track ...` → allocate ONE id, write the card's
//             frontmatter + a body template, and index it. The script owns the meta;
//             fill the body with your editor and leave the frontmatter alone.
export function cmdCreate(args) {
  const { flags, positional, order } = parseFlags(args, CREATE_FLAGS)
  if (positional.length) die(`create takes options, not positional args (got "${positional.join(' ')}")`)

  if (flags.title === undefined) {
    for (const bad of ['track', 'priority', 'roi', 'blocked-by', 'related', 'modules', 'question', 'option', 'mode', 'recommended-option', 'slug', 'no-body']) {
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
  const questions = collectQuestions(order)
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

const UPDATE_FLAGS = ['title', 'track', 'priority', 'roi', 'status', 'blocked-by', 'related', 'modules', 'slug']

// Rewrite a card's frontmatter fields. Also the sanctioned way to move a card between
// tracks (--track moves the file + fixes the index) or rename it (--slug). Body is
// untouched, and so is the question list — that's cmdUpdateQuestions' job.
export function cmdUpdate(args) {
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
  // A `ready` card has no open questions by definition (see STATUSES). Open questions
  // mean the plan is not settled, so a `--status ready` with them pending lands as
  // `todo`. This holds the invariant no matter who set the status.
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

// Patch a card's open-question list. Every op edits in place — append one, rewrite
// one by position, drop answered ones, clear the list — so handing a single question
// to the user never means re-passing its siblings (wholesale rewrites silently lost
// options that weren't re-typed). Ops apply in the order they were typed, and a
// position is read against the list as it stands when its op runs.
export function cmdUpdateQuestions(args) {
  const [idRaw, ...rest] = args
  const id = Number(idRaw)
  if (!Number.isInteger(id)) die('need a numeric task id: update-questions <id> [ops]')
  const ops = parseQuestionOps(rest)
  const found = locate(id)
  if (!found) die(`no task with id ${id} under ${rel(TODO)}`)
  const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
  if (!meta) die(`${rel(file)} has no frontmatter — run \`migrate\` first`)

  const changes = []
  for (const op of ops) {
    if (op.kind === 'clear') {
      meta.questions = []
      changes.push('cleared')
    } else if (op.kind === 'drop') {
      const ns = parseQuestionPositions(op.ns, meta.questions.length, 'drop')
      meta.questions = meta.questions.filter((_, i) => !ns.includes(i + 1))
      changes.push(`dropped ${ns.join(',')}`)
    } else if (op.kind === 'append') {
      meta.questions.push(op.question)
      changes.push('appended')
    } else {
      const [n] = parseQuestionPositions(String(op.n), meta.questions.length, 'update')
      meta.questions[n - 1] = op.question
      changes.push(`rewrote ${n}`)
    }
  }
  warnBadQuestionTags(meta.questions)
  // The same invariant cmdUpdate holds: a `ready` card has no open questions.
  if (meta.questions.length > 0 && meta.status === 'ready') {
    meta.status = 'todo'
    changes.push('status→todo (open questions)')
  }
  fs.writeFileSync(file, serializeFrontmatter(meta) + '\n' + body)
  console.log(`updated #${id} questions: ${changes.join(', ')} (${meta.questions.length} open)`)
}

// Set (or clear) the tag on open questions, so the auto-refine loop can hand a
// batch of questions to the human in one call without rewriting the whole list.
// `nRaw` is one 1-based position or a comma-separated list (`1,2,3`); `tag` is
// user | none (none strips any tag). Reads and rewrites the frontmatter
// through the same path as `update`, so byte layout and group-root handling stay
// identical.
export function cmdTag(args) {
  const [idRaw, nRaw, tagRaw] = args
  const id = Number(idRaw)
  if (!Number.isInteger(id)) die('need a numeric task id: tag <id> <n[,n...]> <user|none>')
  const ns = String(nRaw || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(Number)
  if (ns.length === 0 || ns.some((n) => !Number.isInteger(n) || n < 1)) {
    die('need one or more 1-based question numbers: tag <id> <n[,n...]> <user|none>')
  }
  const tag = String(tagRaw || '').toLowerCase()
  if (tag !== 'none' && !QUESTION_TAGS.includes(tag)) {
    die(`tag must be one of ${QUESTION_TAGS.join(' | ')} | none (got "${tagRaw}")`)
  }
  const found = locate(id)
  if (!found) die(`no task with id ${id} under ${rel(TODO)}`)
  const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
  if (!meta) die(`${rel(file)} has no frontmatter — run \`migrate\` first`)
  const over = ns.find((n) => n > meta.questions.length)
  if (over !== undefined) {
    die(`#${id} has ${meta.questions.length} open question(s) — there's no question ${over} to tag.`)
  }
  for (const n of ns) {
    const q = meta.questions[n - 1]
    const { text } = parseQuestion(q.text)
    q.text = formatQuestion(tag === 'none' ? null : tag, text)
  }
  fs.writeFileSync(file, serializeFrontmatter(meta) + '\n' + body)
  const label = tag === 'none' ? '(untagged)' : `[${tag}]`
  console.log(`tagged #${id} question${ns.length > 1 ? 's' : ''} ${ns.join(', ')} as ${label}`)
}
