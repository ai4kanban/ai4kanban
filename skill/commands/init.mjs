// ---- init ------------------------------------------------------------------
//
// Scaffolding a fresh board (and re-running as the repair step for a board made by an
// older version), plus `memory-init` for a single module's memory path.

import fs from 'node:fs'
import path from 'node:path'

import { die, warn, rel, writeNextId, SKILL_DIR, KANBAN, TODO, README, CONFIG, KANBAN_GITIGNORE, MODULES_MD, RELEASES, MEMORY, GOAL, SETUP_CHECKLIST } from '../lib/paths.mjs'
import { unquote } from '../lib/yaml.mjs'
import { moduleNames, MODULE_NAME_RE } from '../lib/validate.mjs'
import { writeReleasesIfMissing } from '../lib/releases.mjs'
import { scaffoldMemoryPath, scaffoldProjectMemory } from '../lib/memory.mjs'
import { nextSetupStep, writeSetupChecklist } from '../lib/setup.mjs'

// Default tracks when `init` is run with no track args. Swap by passing your own,
// e.g. `init growth validation building`. Keep in step with the SKILL.md defaults.
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
  const template = path.join(SKILL_DIR, 'config.md')
  if (!fs.existsSync(template)) die(`missing config template at ${template}`)
  fs.mkdirSync(KANBAN, { recursive: true })
  fs.copyFileSync(template, CONFIG)
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
// The rule goes in the board's own ignore file, never the repo's root one. An existing
// file gets the line added, not replaced: comments, order and every other rule in it are
// the user's. The line is written exactly as the UI writes it, so neither one adds it twice.
const IGNORE_BLOCK = `# The board's API keys — never commit them.
.env
`

function writeGitignoreIfMissing() {
  fs.mkdirSync(KANBAN, { recursive: true })
  if (!fs.existsSync(KANBAN_GITIGNORE)) {
    fs.writeFileSync(KANBAN_GITIGNORE, IGNORE_BLOCK)
    return true
  }
  const text = fs.readFileSync(KANBAN_GITIGNORE, 'utf8')
  if (text.split('\n').some((line) => line.trim() === '.env')) return false
  const separator = !text || text.endsWith('\n') ? '' : '\n'
  fs.writeFileSync(KANBAN_GITIGNORE, `${text}${separator}${IGNORE_BLOCK}`)
  return true
}

export function cmdInit(args) {
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
    const added = [
      writeConfigIfMissing() && rel(CONFIG),
      writeModulesIfMissing() && rel(MODULES_MD),
      writeReleasesIfMissing() && rel(RELEASES),
      writeGitignoreIfMissing() && rel(KANBAN_GITIGNORE),
    ].filter(Boolean)
    // The project-wide memory, then every module already on the map, so a board whose map
    // is filled in is fully repaired by this one command. A map seeded blank a line above
    // names nothing yet — those paths are made once the map is written.
    const scaffolded = []
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
    // A board made before the `reviewed:` field gets it here, seeded weak.
    const goalRepaired = ensureGoalReviewed()
    console.log(
      added.length
        ? `board already exists at ${rel(KANBAN)}/ — added the missing ${added.join(', ')} (safe to re-run)`
        : `board already exists at ${rel(KANBAN)}/ — ${scaffolded.length || goalRepaired ? 'board files all present' : 'nothing to do'} (safe to re-run)`,
    )
    for (const s of scaffolded) console.log(`  memory path ${rel(s.dir)}/ — ${s.fresh ? 'created' : `added ${s.made.join(', ')}`}`)
    if (goalRepaired) console.log(`  added \`reviewed: weak\` to ${rel(GOAL)} — the agent judges the goal and edits the field`)
    if (added.includes(rel(MODULES_MD))) {
      console.log(`  next: fill in ${rel(MODULES_MD)} (see "The module map"), then re-run init for the memory paths`)
    }
    return
  }
  fs.mkdirSync(path.join(TODO, 'blockers'), { recursive: true })
  for (const t of tracks) fs.mkdirSync(path.join(TODO, t), { recursive: true })
  fs.writeFileSync(README, boardReadme(tracks))
  scaffoldProjectMemory()
  writeConfigIfMissing()
  writeModulesIfMissing()
  writeReleasesIfMissing()
  writeGitignoreIfMissing()
  writeNextId(1)
  // Setup's remaining steps, written now so a user who installs and stops there still
  // opens the board onto a list of what is left instead of one that looks finished.
  writeSetupChecklist()
  console.log(`initialised board at ${rel(KANBAN)}/`)
  console.log(`  tracks: ${tracks.join(', ')}`)
  console.log(`  setup's remaining steps are in ${rel(SETUP_CHECKLIST)} — \`setup-done <step>\` ticks one`)
  const next = nextSetupStep()
  if (next) console.log(`  next: \`${next.name}\` (${next.owner}) — ${next.text}`)
}

export function cmdMemoryInit(module) {
  if (!module) die('memory-init needs a module name (its bolded name in modules.md)')
  if (!MODULE_NAME_RE.test(module)) {
    die(`bad module name "${module}" — use letters, digits, and dashes (a folder name)`)
  }
  const done = scaffoldMemoryPath(module)
  if (!done) console.log(`${rel(path.join(MEMORY, module))}/ already has the full set — nothing to do`)
  else if (done.fresh) console.log(`created memory path ${rel(done.dir)}/ with the four-file set`)
  else console.log(`filled in missing files in ${rel(done.dir)}/: ${done.made.join(', ')}`)
}

// ---- goal review -----------------------------------------------------------
//
// `goal.md`'s frontmatter carries one machine-readable field: `reviewed: strong | good | weak`
// — whether the goal is clear enough to plan from. The agent judges and edits the field
// itself; this script only seeds it (`init`'s scaffold and repair), never sets a judged
// value. Reading never fails: a missing file, a missing field, or a bad value all count
// as `weak`, and the board keeps working either way.

const GOAL_REVIEW_VALUES = ['strong', 'good', 'weak']

// The value as written, or null when the file has no valid field — the init repair
// reads null as "add the field"; everyone else reads it as weak.
function readGoalReviewFrom(text) {
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  const line = fm && fm[1].match(/^reviewed:[ \t]*(.+?)[ \t]*$/m)
  const v = line && unquote(line[1])
  return GOAL_REVIEW_VALUES.includes(v) ? v : null
}

// Set the field without disturbing the rest of the file: replace the `reviewed:` line
// in place, add it to a frontmatter block that lacks it, or open a new block on a file
// that has none. The goal text itself is never touched.
function writeGoalReviewInto(text, value) {
  const fm = text.match(/^---\r?\n([\s\S]*?\r?\n)---/)
  if (!fm) return `---\nreviewed: ${value}\n---\n\n${text}`
  const inner = /^reviewed:.*$/m.test(fm[1])
    ? fm[1].replace(/^reviewed:.*$/m, () => `reviewed: ${value}`)
    : `reviewed: ${value}\n${fm[1]}`
  return `---\n${inner}---${text.slice(fm[0].length)}`
}

// The `reviewed:` field arrived after boards existed. `init`'s repair pass adds it to a
// goal.md that lacks it — seeded `weak`, exactly what the missing field already reads
// as — and never touches a value that's set, so a judged goal survives a re-run.
function ensureGoalReviewed() {
  if (!fs.existsSync(GOAL)) return false
  const text = fs.readFileSync(GOAL, 'utf8')
  if (readGoalReviewFrom(text)) return false
  fs.writeFileSync(GOAL, writeGoalReviewInto(text, 'weak'))
  return true
}
