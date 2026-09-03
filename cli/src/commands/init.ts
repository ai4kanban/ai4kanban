// ---- init ------------------------------------------------------------------
//
// Scaffolding a fresh board (and re-running as the repair step for a board made by an
// older version), plus `memory-init` for a single module's memory path.

import fs from 'node:fs'
import path from 'node:path'

import { die, warn, rel, writeNextId, writeRootIgnoreIfMissing, KANBAN, TODO, README, NEXT_ID, CONFIG, KANBAN_GITIGNORE, MOCKUPS, MOCKUP_IGNORE_LINE, MODULES_MD, RUN_IGNORE_LINES, RELEASES, MEMORY, GOAL, ROOT_GITIGNORE, SETUP_CHECKLIST } from '../lib/paths'
import { CONFIG_TEMPLATE } from '../lib/config-template'
import { say } from '../lib/io'
import { LOCK_IGNORE_LINE } from '../lib/lock'
import { CHAT_IGNORE_LINE } from '../lib/agent/chat'
import { readGoalBody, readGoalReviewFrom, writeGoalReviewInto } from '../lib/view/goal'
import { moduleNames, MODULE_NAME_RE } from '../lib/validate'
import { writeReleasesIfMissing } from '../lib/releases'
import { scaffoldMemoryPath, scaffoldProjectMemory, type Scaffolded } from '../lib/memory'
import { writePruneMemoryCard } from '../lib/recurring'
import { nextSetupStep, writeSetupChecklist, setupUnfinished, findSetupQuestionsCard, writeSetupQuestionsCard } from '../lib/setup'
import type { MoveResult } from '../lib/types'

// Default tracks when `init` is run with no track args. Swap by passing your own,
// e.g. `init growth validation building`. Keep in step with `akb help`'s defaults.
const DEFAULT_TRACKS = ['feature', 'bug', 'research']

// The blank module map. `init` seeds it, the module-map flow fills it in from the repo.
// It ships empty on purpose: only someone who has read the repo can name its parts, and
// a made-up line here would validate a card's --modules tag against a lie. An empty map
// still parses — moduleNames() reads it as "no modules yet", so --modules is a hard error
// naming what's known, which is the prompt to add the line.
const MODULES_TEMPLATE = `# Modules

What this project is made of — one line per module, each led by its **bolded name**, then
what it is and the paths it covers. A module is a part of the product that grows on its
own, judged by meaning, not by folder.

If a line here disagrees with the repo you just read, fix the line.

_(not filled in yet — build the map from the repo before tagging a card.)_
`

function boardReadme(tracks: string[]): string {
  const sections = ['## Blockers', '', '_(none)_', '']
  for (const t of tracks) sections.push(`## ${t}`, '', '_(none)_', '')
  return `# Board

Open tasks for the kanban board. One card per file. Ids are global and never reused —
the number at the front of a filename is the task id.

Blockers gate the next milestone; clear them first. Everything else sits under a track.

${sections.join('\n')}`
}

// Seed the per-project config at docs/kanban/config.md from the blank template this
// command carries. The config lives WITH the board (not in the skill folder) so a
// read-only plugin cache still yields an editable, per-project file. Idempotent: it never
// overwrites a config that's already there, so a filled-in config survives a re-run.
function writeConfigIfMissing() {
  if (fs.existsSync(CONFIG)) return false
  fs.mkdirSync(KANBAN, { recursive: true })
  fs.writeFileSync(CONFIG, CONFIG_TEMPLATE)
  return true
}

// Seed the blank module map. Same contract as the config: idempotent, and it never
// touches a map that's already there, so a filled-in map survives a re-run — that's what
// makes it safe for `init` to double as the repair step for a board made before the map
// existed.
function writeModulesIfMissing() {
  if (fs.existsSync(MODULES_MD)) return false
  fs.mkdirSync(KANBAN, { recursive: true })
  fs.writeFileSync(MODULES_MD, MODULES_TEMPLATE)
  return true
}

// docs/kanban/.env holds the board's API keys, so it must never reach git — and the only
// thing that can promise that on a board nobody has opened the UI on is `init`. A key
// written into the file by hand is covered from the first day, before anything else runs.
//
// The second line is the write lock (lib/lock.mjs): it exists for the milliseconds a write
// takes, and only outlives that if a process is killed mid-write — exactly when nobody
// should have to think about it.
//
// The rules go in the board's own ignore file, never the repo's root one. An existing file
// gets the missing line added, not replaced: comments, order and every other rule in it are
// the user's. The `.env` line is written exactly as the UI writes it, so neither one adds
// it twice.
const IGNORE_RULES = [
  { line: '.env', comment: "# The board's API keys — never commit them." },
  { line: LOCK_IGNORE_LINE, comment: '# The write lock, held for as long as one command takes.' },
  ...RUN_IGNORE_LINES,
  CHAT_IGNORE_LINE,
  { line: MOCKUP_IGNORE_LINE, comment: '# Drawings of the screens cards change — redrawn, never read back from git.' },
]

// A board made before the folder was dotted keeps its drawings at docs/kanban/mockups/,
// tracked in git. Move them under the ignored name so its cards still draw — the old path
// then shows up as deleted, which is the whole point: mockups leave the repo. A card that
// has a folder on both sides keeps the dotted one, the newer of the two, and the old copy
// goes with the rest: one run, and there is one place mockups live.
function moveMockupsIfOld(): string | null {
  const old = path.join(KANBAN, 'mockups')
  if (!fs.existsSync(old)) return null
  if (!fs.existsSync(MOCKUPS)) {
    fs.renameSync(old, MOCKUPS)
    return rel(MOCKUPS)
  }
  for (const name of fs.readdirSync(old)) {
    const to = path.join(MOCKUPS, name)
    if (!fs.existsSync(to)) fs.renameSync(path.join(old, name), to)
  }
  fs.rmSync(old, { recursive: true, force: true })
  return rel(MOCKUPS)
}

function writeGitignoreIfMissing(): boolean {
  fs.mkdirSync(KANBAN, { recursive: true })
  const text = fs.existsSync(KANBAN_GITIGNORE) ? fs.readFileSync(KANBAN_GITIGNORE, 'utf8') : ''
  const has = (rule: { line: string }): boolean => text.split('\n').some((line) => line.trim() === rule.line)
  const missing = IGNORE_RULES.filter((rule) => !has(rule))
  if (!missing.length) return false
  const block = missing.map((rule) => `${rule.comment}\n${rule.line}\n`).join('')
  const separator = !text || text.endsWith('\n') ? '' : '\n'
  fs.writeFileSync(KANBAN_GITIGNORE, `${text}${separator}${block}`)
  return true
}

// The parts of a board every move needs: the folder the cards live in, its index, and the
// counter that hands out ids. A board can be missing them — a half-finished install, a
// folder someone deleted from — and then every move but this one turns it away. The track
// folders are only made when `todo/` itself is gone: on a board that has one, the tracks
// are whatever it already has, not what this call's arguments happen to say.
function writeSkeletonIfMissing(tracks: string[]): string[] {
  const added: string[] = []
  if (!fs.existsSync(TODO)) {
    fs.mkdirSync(path.join(TODO, 'blockers'), { recursive: true })
    for (const t of tracks) fs.mkdirSync(path.join(TODO, t), { recursive: true })
    added.push(`${rel(TODO)}/`)
  }
  if (!fs.existsSync(README)) {
    fs.writeFileSync(README, boardReadme(tracks))
    added.push(rel(README))
  }
  if (!fs.existsSync(NEXT_ID)) {
    writeNextId(1)
    added.push(rel(NEXT_ID))
  }
  return added
}

export function cmdInit(args: string[]): MoveResult {
  const tracks = args.length ? args : DEFAULT_TRACKS
  for (const t of tracks) {
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(t)) {
      die(`bad track name "${t}" — use letters, digits, and dashes (a folder name)`)
    }
  }
  if (fs.existsSync(KANBAN)) {
    // Re-running `init` is the repair step for a board made by an older version: it adds
    // whatever that version never wrote — docs/kanban/config.md if the board predates the
    // move out of the skill folder, modules.md if it predates the module map, releases.md
    // if it predates releases, the .gitignore that keeps the keys file out of git if it
    // predates that — and never touches any of them once they're filled in. The
    // release list arrives empty even when cards already name a version: reading the ids
    // off them would invent a ship order nobody chose. `release list` names those ids
    // instead, so the user adds back the ones they meant.
    //
    // The setup checklist is deliberately NOT among them. It is written once, by the
    // scaffold below; a board that was set up long ago has no file and must stay quiet,
    // and planting one here would tell that user to finish a setup that finished months ago.
    //
    // Nor is the "Prune the memory" recurring card, for the same kind of reason: deleting
    // it is how a board opts out of the job, and a repair that re-added it would undo that
    // choice on every re-run.
    const added: string[] = [
      ...writeSkeletonIfMissing(tracks),
      writeConfigIfMissing() && rel(CONFIG),
      writeModulesIfMissing() && rel(MODULES_MD),
      writeReleasesIfMissing() && rel(RELEASES),
      writeGitignoreIfMissing() && rel(KANBAN_GITIGNORE),
      writeRootIgnoreIfMissing() && rel(ROOT_GITIGNORE),
    ].filter(Boolean) as string[]
    // A board still mid-setup gets the questions card if it was made before the card
    // existed — same test as everything else about setup: the checklist file says so.
    if (setupUnfinished() && !findSetupQuestionsCard()) {
      const track = tracks.find((t) => fs.existsSync(path.join(TODO, t))) || tracks[0]!
      fs.mkdirSync(path.join(TODO, track), { recursive: true })
      const card = writeSetupQuestionsCard(track)
      if (card) added.push(rel(card.file))
    }
    // The project-wide memory, then every module already on the map, so a board whose map
    // is filled in is fully repaired by this one command. A map seeded blank a line above
    // names nothing yet — those paths are made once the map is written.
    const scaffolded: Scaffolded[] = []
    const project = scaffoldProjectMemory()
    if (project) scaffolded.push(project)
    for (const m of moduleNames() || []) {
      // A hand-written map can carry a name no folder can take. Warn and skip rather than
      // die: one odd line shouldn't stop the rest of the repair.
      if (!MODULE_NAME_RE.test(m)) {
        warn(`skipping module "${m}" — a name needs letters, digits, and dashes to be a folder`)
        continue
      }
      const done = scaffoldMemoryPath(m)
      if (done) scaffolded.push(done)
    }
    // A goal written by an older version: the seeded text goes, and a goal with words in
    // it stops reading as one nobody wrote.
    const goalRepaired = repairGoal()
    const movedMockups = moveMockupsIfOld()
    say(
      added.length
        ? `board already exists at ${rel(KANBAN)}/ — added the missing ${added.join(', ')} (safe to re-run)`
        : `board already exists at ${rel(KANBAN)}/ — ${scaffolded.length || goalRepaired ? 'board files all present' : 'nothing to do'} (safe to re-run)`,
    )
    for (const s of scaffolded) say(`  memory path ${rel(s.dir)}/ — ${s.fresh ? 'created' : `added ${s.made.join(', ')}`}`)
    if (goalRepaired) say(`  ${rel(GOAL)}: ${goalRepaired} — the agent judges the goal and edits the field`)
    if (movedMockups) say(`  moved the mockups to ${movedMockups}/ — they are out of git now, so commit the old path as deleted`)
    if (added.includes(rel(MODULES_MD))) {
      say(`  next: fill in ${rel(MODULES_MD)} (see "The module map"), then re-run init for the memory paths`)
    }
    return { board: rel(KANBAN), created: false, added, memory_paths: scaffolded.map((s) => rel(s.dir)) }
  }
  fs.mkdirSync(path.join(TODO, 'blockers'), { recursive: true })
  for (const t of tracks) fs.mkdirSync(path.join(TODO, t), { recursive: true })
  fs.writeFileSync(README, boardReadme(tracks))
  scaffoldProjectMemory()
  writeConfigIfMissing()
  writeModulesIfMissing()
  writeReleasesIfMissing()
  writeGitignoreIfMissing()
  writeRootIgnoreIfMissing()
  writeNextId(1)
  // Setup's remaining steps, written now so a user who installs and stops there still
  // opens the board onto a list of what is left instead of one that looks finished.
  writeSetupChecklist()
  // The questions card comes right after `next-id` is seeded, so it takes id 1 and sorts
  // on top. Setup's steps append every call they can't settle to it as they run.
  const questionsCard = writeSetupQuestionsCard(tracks[0]!)
  // The one job every board starts with, in `recurring/` beside the track folders. It
  // ships with no cadence, so nothing runs until someone asks for it.
  const pruneCard = writePruneMemoryCard()
  say(`initialised board at ${rel(KANBAN)}/`)
  say(`  tracks: ${tracks.join(', ')}`)
  say(`  setup's remaining steps are in ${rel(SETUP_CHECKLIST)} — \`setup-done <step>\` ticks one`)
  if (questionsCard) say(`  questions card: #${questionsCard.id} — setup appends the calls it can't settle here`)
  if (pruneCard) say(`  recurring card: #${pruneCard.id} ${rel(pruneCard.file)} — prunes the memory; runs only when you run it`)
  const next = nextSetupStep()
  if (next) say(`  next: \`${next.name}\` (${next.owner}) — ${next.text}`)
  return { board: rel(KANBAN), created: true, tracks, next: next?.name ?? null }
}

export function cmdMemoryInit(module: string | undefined): MoveResult {
  if (!module) die('memory-init needs a module name (its bolded name in modules.md)')
  if (!MODULE_NAME_RE.test(module)) {
    die(`bad module name "${module}" — use letters, digits, and dashes (a folder name)`, {
      kind: 'bad-module-name',
      module,
    })
  }
  const done = scaffoldMemoryPath(module)
  if (!done) say(`${rel(path.join(MEMORY, module))}/ already has the full set — nothing to do`)
  else if (done.fresh) say(`created memory path ${rel(done.dir)}/ with the four-file set`)
  else say(`filled in missing files in ${rel(done.dir)}/: ${done.made.join(', ')}`)
  return { module, dir: rel(done ? done.dir : path.join(MEMORY, module)), made: done ? done.made : [] }
}

// ---- goal review -----------------------------------------------------------
//
// `goal.md` carries one machine-readable field — `reviewed:` — and reading it, writing it,
// and telling a seeded body from a real goal all live in `lib/view/goal.ts`, next to the
// goal reader every front end uses. What is left here is the repair itself.

// Bring an older board's `goal.md` up to date, without ever touching a goal the user
// wrote. Three repairs, all mechanical:
//
//   - a body that is still the seeded block is emptied — it was never a goal, and it is
//     text the user would have to delete before writing their own,
//   - a goal with words in it gets `reviewed: pending` unless the agent already judged it
//     `good` or `strong`, so an upgrade never leaves an already-written goal asking to be
//     written. The next propose run re-judges it,
//   - a goal with nothing in it gets `reviewed: weak`, which is what a missing field
//     already reads as.
//
// Returns what it did, for `init` to report; null when there was nothing to repair.
function repairGoal(): string | null {
  if (!fs.existsSync(GOAL)) return null
  const text = fs.readFileSync(GOAL, 'utf8')
  const { body, seeded, written } = readGoalBody(text)
  const current = readGoalReviewFrom(text)
  const value = written ? (current === 'good' || current === 'strong' ? current : 'pending') : 'weak'
  if (!seeded && value === current) return null
  const kept = seeded ? text.slice(0, text.length - body.length) : text
  fs.writeFileSync(GOAL, writeGoalReviewInto(kept, value))
  if (seeded) return 'cleared the seeded text — the goal starts empty, in the user\'s own words'
  return `set \`reviewed: ${value}\``
}
