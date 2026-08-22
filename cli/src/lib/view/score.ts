// ---- the planning scores, as a chart reads them -----------------------------
//
// `docs/kanban/record.csv` holds what board moves saw as they ran (../record.ts). This is
// the release-by-release view a chart draws from it: three percentages per window, the
// counts each one came from, and the cards that contributed.
//
// Three things the reader has to get right. A window is decided by file order — the lines
// between one `release-closed` line and the one before it — and never by a date, so two
// releases closed on the same day are still two windows. A series below its evidence floor
// has no percentage at all, because a zero there would read as a score of nothing rather
// than as too little evidence. And a file we can't read is reported as an error, never as
// a board that has planned nothing.
//
// Nothing is saved: every figure here is worked out from the record on each read, so a
// second copy of a score cannot disagree with the evidence it came from.

import { readFacts, recordFile, type Fact } from '../record'
import { readReleases } from '../releases'
import {
  SCORE_SERIES,
  type ScoreResult,
  type ScoreSeries,
  type ScoreSeriesKey,
  type ScoreWindow,
} from './types'

/** What a window needs before a series is drawn (#222): 20 question closures, 20 calls, 10
 *  decided proposals. */
export const SCORE_FLOORS: Record<ScoreSeriesKey, number> = {
  details: 20,
  decisions: 20,
  proposals: 10,
}

/** The name of the open window on a board with no release open. */
export const CURRENT_WINDOW = 'Current'

const LABELS: Record<ScoreSeriesKey, { series: string; hit: string; miss: string }> = {
  details: { series: 'Details settled', hit: 'board', miss: 'you' },
  decisions: { series: 'Decisions that stood', hit: 'stood', miss: 'overruled' },
  proposals: { series: 'Proposals built', hit: 'built', miss: 'dropped' },
}

/** One series' evidence while a window is being counted: the two numbers of the formula,
 *  and every card that put something into either of them. */
interface Tally {
  hit: number
  miss: number
  cards: Set<number>
}

const blank = (): Record<ScoreSeriesKey, Tally> =>
  Object.fromEntries(SCORE_SERIES.map((key) => [key, { hit: 0, miss: 0, cards: new Set<number>() }])) as Record<
    ScoreSeriesKey,
    Tally
  >

/** Add one line's evidence to the window it falls in. A line that carries nothing any series
 *  counts — a question moved to `verify:`, a card nobody proposed, a decision count of zero —
 *  is passed over, and its card is not named as a contributor either. */
function count(tally: Record<ScoreSeriesKey, Tally>, fact: Fact): void {
  const card = fact.card
  const add = (key: ScoreSeriesKey, side: 'hit' | 'miss', by = 1) => {
    if (by <= 0) return
    tally[key][side] += by
    if (card !== null) tally[key].cards.add(card)
  }
  switch (fact.event) {
    case 'question-closed':
      // `verify` is a question that moved to a hand-check, not one anybody answered.
      if (fact.detail === 'board') add('details', 'hit')
      else if (fact.detail === 'user') add('details', 'miss')
      break
    case 'decisions-stood':
      add('decisions', 'hit', whole(fact.detail))
      break
    case 'decisions-overruled':
      add('decisions', 'miss', whole(fact.detail))
      break
    // A card the board proposed and we then built, or dropped. `asked` is somebody's
    // request rather than the board's proposal, and a card with no recorded origin is
    // counted on neither side.
    case 'card-archived':
      if (fact.detail === 'proposed') add('proposals', 'hit')
      break
    case 'card-rejected':
      if (fact.detail === 'proposed') add('proposals', 'miss')
      break
  }
}

function whole(detail: string): number {
  const n = Number(detail)
  return Number.isInteger(n) && n > 0 ? n : 0
}

function series(tally: Record<ScoreSeriesKey, Tally>): ScoreSeries[] {
  return SCORE_SERIES.map((key) => {
    const { hit, miss, cards } = tally[key]
    const evidence = hit + miss
    const floor = SCORE_FLOORS[key]
    const words = LABELS[key]
    return {
      key,
      label: words.series,
      percent: evidence >= floor ? Math.round((hit / evidence) * 100) : null,
      counts: [
        { label: words.hit, value: hit },
        { label: words.miss, value: miss },
      ],
      evidence,
      floor,
      cards: [...cards].sort((a, b) => a - b),
    }
  })
}

/** Every closed release window in close order, then the window still open. */
export function readScoreView(): ScoreResult {
  let facts: Fact[]
  let open: string
  try {
    facts = readFacts()
    // The release being planned now is the first one still open in `releases.md` — that
    // file is in ship order, so its top line is the version this window's evidence
    // belongs to.
    open = readReleases()[0] ?? CURRENT_WINDOW
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `Could not read ${recordFile()} — ${why}` }
  }

  const windows: ScoreWindow[] = []
  let tally = blank()
  for (const fact of facts) {
    if (fact.event === 'release-closed') {
      windows.push({ release: fact.detail, open: false, series: series(tally) })
      tally = blank()
      continue
    }
    count(tally, fact)
  }

  windows.push({ release: open, open: true, series: series(tally) })

  return { ok: true, view: { windows, empty: facts.length === 0 } }
}
