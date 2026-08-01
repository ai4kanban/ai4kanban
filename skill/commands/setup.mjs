// ---- setup-done + setup-status ---------------------------------------------
//
// The two commands over `docs/kanban/setup-checklist.md`: tick one box as a setup step
// finishes, and read how far setup got. See lib/setup.mjs for the file itself.

import { die, rel, SETUP_CHECKLIST } from '../lib/paths.mjs'
import { nextSetupStep, readSetupChecklist, SETUP_STEPS, tickSetupStep } from '../lib/setup.mjs'

const names = () => SETUP_STEPS.map((s) => s.name).join(', ')

function sayNext() {
  const next = nextSetupStep()
  if (next) console.log(`  next: \`${next.name}\` (${next.owner}) — ${next.text}`)
}

export function cmdSetupDone(args) {
  const name = args[0]
  if (!name) die(`setup-done needs a step name — one of: ${names()}`)
  const result = tickSetupStep(name)
  if (result.missing) {
    console.log(`no ${rel(SETUP_CHECKLIST)} — this board is already set up, nothing to tick`)
    return
  }
  if (result.unknown) die(`no setup step called "${name}" — this board's checklist holds: ${names()}`)
  if (result.already) {
    console.log(`\`${name}\` was already ticked — ${result.done}/${result.total} done`)
    sayNext()
    return
  }
  if (result.finished) {
    console.log(`ticked \`${name}\` — ${result.done}/${result.total} done, setup finished`)
    console.log(`  removed ${rel(SETUP_CHECKLIST)}: a board without it is a board that is set up`)
    return
  }
  console.log(`ticked \`${name}\` — ${result.done}/${result.total} done`)
  sayNext()
}

export function cmdSetupStatus() {
  const steps = readSetupChecklist()
  if (!steps) {
    console.log('setup is finished — this board has no checklist')
    return
  }
  const done = steps.filter((s) => s.done).length
  console.log(`setup is unfinished — ${done}/${steps.length} done (${rel(SETUP_CHECKLIST)})`)
  for (const s of steps) console.log(`  [${s.done ? 'x' : ' '}] ${s.name} (${s.owner}) — ${s.text}`)
}
