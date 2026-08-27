// ---- setup-done + setup-status ---------------------------------------------
//
// The two commands over `docs/kanban/setup-checklist.md`: tick one box as a setup step
// finishes, and read how far setup got. See lib/setup.ts for the file itself.

import { die, rel, SETUP_CHECKLIST } from '../lib/paths'
import { say } from '../lib/io'
import { findSetupQuestionsCard, nextSetupStep, readSetupChecklist, SETUP_STEPS, tickSetupStep } from '../lib/setup'
import type { MoveResult } from '../lib/types'

const names = (): string => SETUP_STEPS.map((s) => s.name).join(', ')

function sayNext(): void {
  const next = nextSetupStep()
  if (next) say(`  next: \`${next.name}\` (${next.owner}) — ${next.text}`)
}

export function cmdSetupDone(args: string[]): MoveResult {
  const name = args[0]
  if (!name) die(`setup-done needs a step name — one of: ${names()}`)
  const result = tickSetupStep(name)
  if (result.missing) {
    say(`no ${rel(SETUP_CHECKLIST)} — this board is already set up, nothing to tick`)
    return { step: name, setup_finished: true, ticked: false }
  }
  if (result.unknown) die(`no setup step called "${name}" — this board's checklist holds: ${names()}`, 'unknown-setup-step')
  const answer = {
    step: name,
    ticked: !result.already,
    done: result.done,
    total: result.total,
    setup_finished: Boolean(result.finished),
    next: nextSetupStep()?.name ?? null,
  }
  if (result.already) {
    say(`\`${name}\` was already ticked — ${result.done}/${result.total} done`)
    sayNext()
    return answer
  }
  if (result.finished) {
    say(`ticked \`${name}\` — ${result.done}/${result.total} done, setup finished`)
    say(`  removed ${rel(SETUP_CHECKLIST)}: a board without it is a board that is set up`)
    const card = result.questionsCard
    if (card && card.kept) {
      say(`  questions card #${card.id} holds ${card.questions} open question${card.questions === 1 ? '' : 's'} — the user answers them through the resolve flow`)
    } else if (card) {
      say(`  removed the empty questions card #${card.id} — setup settled everything itself`)
    }
    return answer
  }
  say(`ticked \`${name}\` — ${result.done}/${result.total} done`)
  sayNext()
  return answer
}

export function cmdSetupStatus(): MoveResult {
  const steps = readSetupChecklist()
  if (!steps) {
    say('setup is finished — this board has no checklist')
    return { setup_finished: true, steps: [] }
  }
  const done = steps.filter((s) => s.done).length
  say(`setup is unfinished — ${done}/${steps.length} done (${rel(SETUP_CHECKLIST)})`)
  for (const s of steps) say(`  [${s.done ? 'x' : ' '}] ${s.name} (${s.owner}) — ${s.text}`)
  const card = findSetupQuestionsCard()
  if (card) {
    say(
      `  questions card: #${card.id} (${card.questions} open) — \`update-questions ${card.id} --append "[user] .." --recommended-option ".." --option ".."\` adds a call you can't settle`,
    )
  }
  return {
    setup_finished: false,
    done,
    total: steps.length,
    next: nextSetupStep()?.name ?? null,
    steps,
    questions_card: card ? { id: card.id, questions: card.questions } : null,
  }
}
