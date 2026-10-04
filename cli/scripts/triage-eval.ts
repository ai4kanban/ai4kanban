// Measure Jev's triage answers against what became of the items a board has already sorted.
// Bundled and run by triage-eval.mjs; asks Cloud once per item, as a signed-in Pro account.

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { ARCHIVE, REPO_ROOT, setBoardRoot } from '../src/lib/paths'
import { readAllDismissed, readArchived, readInbox } from '../src/lib/signals/inbox'
import { ask, fromProposer, judgementState, openCards, questionsFor, verdictOf, type Answer, type Asks } from '../src/lib/signals/judge'
import type { Signal } from '../src/lib/view/types'

const args = process.argv.slice(2)
const dirAt = args.indexOf('--dir')
setBoardRoot(dirAt >= 0 ? args[dirAt + 1]! : process.cwd())

type Truth = 'kept' | 'ignored' | 'waiting'
const TRUTHS: Truth[] = ['kept', 'ignored', 'waiting']
const NAMES: Record<Truth, string> = { kept: 'kept as a card', ignored: 'ignored, or its card rejected', waiting: 'still waiting' }

const cards = openCards()
const open = new Set(cards.map((card) => card.id))
const archived = fs.existsSync(ARCHIVE) ? fs.readdirSync(ARCHIVE) : []
const rejected = (id: number): boolean => {
  const file = archived.find((name) => name.startsWith(`${id}-`))
  return file !== undefined && /^rejected: true$/m.test(fs.readFileSync(path.join(ARCHIVE, file), 'utf8'))
}
const truthOf = (item: Signal, where: Truth): Truth =>
  where === 'kept' && item.cardId !== null && !open.has(item.cardId) && rejected(item.cardId) ? 'ignored' : where

// The item as it was when first judged: what sorting wrote onto it since would give the answer away.
const AS_COLLECTED = new Set(['source_id', 'title', 'collected_at', 'imported_at', 'meta', 'url', 'source_type'])
function asCollected(item: Signal): string {
  const text = fs.readFileSync(path.join(REPO_ROOT, item.relPath), 'utf8')
  const parts = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!parts) return text
  let keeping = false
  const kept = parts[1]!.split('\n').filter((line) => {
    const key = line.match(/^([a-z_]+):/)?.[1]
    if (key) keeping = AS_COLLECTED.has(key)
    return keeping
  })
  return `---\n${kept.join('\n')}\n---\n\n${parts[2]!.trim()}\n`
}

const items: { item: Signal; truth: Truth }[] = [
  ...readArchived().map((item) => ({ item, truth: truthOf(item, 'kept') })),
  ...readAllDismissed().map((item) => ({ item, truth: 'ignored' as Truth })),
  ...readInbox().map((item) => ({ item, truth: 'waiting' as Truth })),
].filter(({ item }) => item.contentKept)

async function answersOf(item: Signal, asks: Asks): Promise<Record<string, Answer | undefined>> {
  // Its own card is not a duplicate of it.
  const questions = questionsFor(cards.filter((card) => card.id !== item.cardId), asks)
  const state = { ...judgementState(item, questions).state, item: asCollected(item) }
  const key = createHash('sha256').update(JSON.stringify({ state, questions })).digest('hex').slice(0, 16)
  const cache = path.join(os.tmpdir(), 'akb-triage-eval', `${key}.json`)
  if (fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, 'utf8'))
  const answers = await ask({ state, questions }, item.sourceId)
  fs.mkdirSync(path.dirname(cache), { recursive: true })
  fs.writeFileSync(cache, JSON.stringify(answers))
  return answers
}

const judged: { truth: Truth; asks: Asks; answers: Record<string, Answer | undefined> }[] = []
const queue = [...items]
await Promise.all(
  Array.from({ length: 4 }, async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      try {
        const asks: Asks = fromProposer(next.item) ? 'proposer' : 'all'
        judged.push({ truth: next.truth, asks, answers: await answersOf(next.item, asks) })
      } catch (e) {
        console.error(e instanceof Error ? e.message : String(e))
      }
    }
  }),
)

const ENDS = { plan: 'card', 'plan-without-refine': 'card', skip: 'ignore', 'human-review': 'hold' } as const
console.log(`\n${judged.length} items — what the lines in judge.ts make of each, against what became of it\n`)
console.log(`${''.padEnd(32)}card  ignore  hold`)
for (const truth of TRUTHS) {
  const ends = { card: 0, ignore: 0, hold: 0 }
  for (const one of judged) if (one.truth === truth) ends[ENDS[verdictOf(one.answers, one.asks).verdict]]++
  console.log(`${NAMES[truth].padEnd(32)}${String(ends.card).padStart(4)}${String(ends.ignore).padStart(8)}${String(ends.hold).padStart(6)}`)
}

const BANDS: [number, number][] = [[0, 0.2], [0.2, 0.5], [0.5, 0.8], [0.8, 0.9], [0.9, 1.01]]
const yes = (answer?: Answer): number => answer?.probabilities?.yes ?? 0
const ODDS: Record<string, (answers: Record<string, Answer | undefined>) => number> = {
  worth: (a) => yes(a.worth),
  supported: (a) => yes(a.supported),
  rejected: (a) => yes(a.rejected),
  duplicate: (a) => (a.duplicate && a.duplicate.choice !== 'none' ? 1 - (a.duplicate.probabilities?.none ?? 1) : 0),
  needsUser: (a) => yes(a.needsUser),
  small: (a) => yes(a.small),
}
console.log('\nkept / ignored, by how likely Jev said yes\n')
console.log(`${''.padEnd(12)}${BANDS.map(([lo, hi]) => `${lo}–${Math.min(hi, 1)}`.padStart(10)).join('')}`)
for (const [name, odds] of Object.entries(ODDS)) {
  const cells = BANDS.map(([lo, hi]) => {
    const inBand = judged.filter((one) => odds(one.answers) >= lo && odds(one.answers) < hi)
    return `${inBand.filter((one) => one.truth === 'kept').length}/${inBand.filter((one) => one.truth === 'ignored').length}`.padStart(10)
  })
  console.log(`${name.padEnd(12)}${cells.join('')}`)
}
