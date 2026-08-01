// ---- the setup checklist ---------------------------------------------------
//
// Setup keeps its own steps in `docs/kanban/setup-checklist.md`. The file's presence is
// the flag: it is there while setup is unfinished, and the tick that closes the last box
// deletes it. So a board with no file is a board that is set up — which is what keeps
// boards made before this file existed quiet.
//
// The script owns the file the way it owns the rest of the board's state: it writes it
// once, when a fresh board is scaffolded, and each setup step ticks its own box by name.
// Nobody hand-edits it, so the local UI can rely on its shape.

import fs from 'node:fs'

import { CONFIG, rel, SETUP_CHECKLIST } from './paths.mjs'

// The steps, in the order setup runs them. `owner` says who does the step — `script` is
// already done by the time the file is written, `agent` needs a run in the user's coding
// harness, `you` is the user's own (the local UI's goal editor is the one such step). The
// UI reads the owner to decide whether to show a button or the line to copy into a
// harness; it never learns the names of the steps themselves.
export const SETUP_STEPS = [
  { name: 'install', owner: 'script', text: 'Install the skill and scaffold the board.' },
  { name: 'config', owner: 'agent', text: 'Fill in `docs/kanban/config.md` from what the repo says.' },
  { name: 'goal', owner: 'you', text: 'Write the project goal in `docs/kanban/memory/goal.md`.' },
  { name: 'decisions', owner: 'agent', text: 'Settle `docs/kanban/memory/decisions.md` from the goal.' },
  { name: 'modules', owner: 'agent', text: 'Write `docs/kanban/modules.md` and every module\'s memory path.' },
  { name: 'tasks', owner: 'agent', text: 'Create the first tasks.' },
]

// The boxes install itself finishes. They are written ticked, so a user who installs and
// stops there opens the UI onto a bar that says what is actually left.
const DONE_AT_INSTALL = ['install']

const HEADER = `# Setup checklist

Setup's own steps, in order. Each step ticks its box when it finishes; the tick that closes
the last box deletes this file, so a board without it is a board that is set up.

The guide for each step is the skill's \`references/setup.md\` — start at the first
unticked box and follow it in order.

The script writes this file — \`kanban.mjs setup-done <step>\` ticks one box. Don't edit it
by hand: the local board UI reads its shape to show how far setup got and what comes next.

`

const line = (step, done) => `- [${done ? 'x' : ' '}] \`${step.name}\` (${step.owner}) — ${step.text}`

const LINE_RE = /^- \[([ xX])\][ \t]+`([a-z][a-z0-9-]*)`[ \t]+\((script|agent|you)\)[ \t]+—[ \t]+(.+?)[ \t]*$/

/** True while setup is unfinished — the one test every flow uses. */
export function setupUnfinished() {
  return fs.existsSync(SETUP_CHECKLIST)
}

/** The checklist as a list of steps, or null when there is none (setup is done). */
export function readSetupChecklist() {
  if (!setupUnfinished()) return null
  const steps = []
  for (const raw of fs.readFileSync(SETUP_CHECKLIST, 'utf8').split('\n')) {
    const m = raw.match(LINE_RE)
    if (m) steps.push({ done: m[1] !== ' ', name: m[2], owner: m[3], text: m[4] })
  }
  return steps
}

// Write the checklist. Only the fresh scaffold calls this: repairing an older board must
// never plant one, or a board set up long ago would start asking to be set up again.
export function writeSetupChecklist() {
  const body = SETUP_STEPS.map((s) => line(s, DONE_AT_INSTALL.includes(s.name))).join('\n')
  fs.writeFileSync(SETUP_CHECKLIST, `${HEADER}${body}\n`)
}

/**
 * Tick one box by name. Returns what happened, for the command to report:
 *   { missing: true }                       — no checklist; this board is already set up
 *   { unknown: true }                       — no such step in this board's checklist
 *   { already: true, done, total }          — that box was ticked before
 *   { ok: true, done, total, finished }     — ticked; `finished` means the file is gone
 */
export function tickSetupStep(name) {
  if (!setupUnfinished()) return { missing: true }
  const text = fs.readFileSync(SETUP_CHECKLIST, 'utf8')
  const lines = text.split('\n')
  let found = null
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(LINE_RE)
    if (!m || m[2] !== name) continue
    found = { index: i, done: m[1] !== ' ' }
    break
  }
  if (!found) return { unknown: true }
  const steps = readSetupChecklist()
  const total = steps.length
  if (found.done) return { already: true, done: steps.filter((s) => s.done).length, total }
  lines[found.index] = lines[found.index].replace(/^- \[ \]/, '- [x]')
  const done = steps.filter((s) => s.done).length + 1
  // The last tick deletes the file rather than leaving a fully ticked list behind: kept,
  // it would be clutter that also contradicts the flag.
  if (done >= total) {
    fs.rmSync(SETUP_CHECKLIST)
    swapConfigGateForDone()
    return { ok: true, done, total, finished: true }
  }
  fs.writeFileSync(SETUP_CHECKLIST, lines.join('\n'))
  return { ok: true, done, total, finished: false }
}

// The config's first entry is the setup gate. Left on a finished board it reads wrong —
// a set-up board telling agents to go finish setup — so the tick that finishes setup
// swaps the whole bullet for this line. A config without the bullet is left alone.
const CONFIG_SETUP_DONE = '- **Setup** — this board is set up; plan and create cards freely.'

function swapConfigGateForDone() {
  if (!fs.existsSync(CONFIG)) return
  const lines = fs.readFileSync(CONFIG, 'utf8').split('\n')
  const start = lines.findIndex((l) => l.startsWith('- **Setup gate**'))
  if (start === -1) return
  let end = start + 1
  while (end < lines.length && /^\s+\S/.test(lines[end])) end++
  lines.splice(start, end - start, CONFIG_SETUP_DONE)
  fs.writeFileSync(CONFIG, lines.join('\n'))
}

/** The first unticked step — what setup does next. Null when there is no checklist. */
export function nextSetupStep() {
  const steps = readSetupChecklist()
  return steps ? steps.find((s) => !s.done) || null : null
}

/** The one line every flow prints when it stops because setup is unfinished. */
export function setupUnfinishedMessage() {
  const next = nextSetupStep()
  const where = rel(SETUP_CHECKLIST)
  return next
    ? `setup isn't finished — ${where} is still waiting on \`${next.name}\` (${next.owner}): ${next.text}`
    : `setup isn't finished — see ${where}`
}
