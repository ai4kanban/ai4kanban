// ---- the one read each board screen makes (#374) ----------------------------
//
// A screen used to assemble its own read: the board page called `readBoard`, then the agent
// setting, then the setup instruction, then the skill state; the card page called five more.
// Every one of those was a call into the machine holding `docs/kanban/`, which is what kept
// the screens welded to it.
//
// These are the two shapes instead — what the board screen draws, and what a card page
// draws, each named once. Everything in them is something a `BoardProvider` can answer
// (./contract.ts), so the local server fills them from the folder today and a Cloud read
// fills the same shapes later.
//
// What is NOT here is deliberate: the coding agent, the repository root, the setup
// instruction, the skill state and a mockup on disk are the machine's, not the board's. They
// travel with the actions a caller passes in, and a caller without them draws no control
// that needs one.
//
// This file is pure types and imports nothing that touches a filesystem, so it is copied
// into the board UI by scripts/sync-format.mjs and both sides name one shape.

import type { Board, Card, DeliveryDiff, DeliveryPlan, MemoryModule, Solution } from '../view/types'

/** How the board stands (#316): a folder here, or a copy of a Cloud workspace and whether
 *  that workspace is out of reach.
 *
 *  `readWhen` is the time already spelled by the board's own rules — the strip renders on
 *  the server for the first paint and again in the browser, so the wording has to be one
 *  answer rather than each side's locale. */
export interface BoardStanding {
  kind: 'local' | 'cloud'
  offline: boolean
  workspaceName: string
  /** When the copy was read, as an ISO timestamp. Empty on a Local board. */
  readAt: string
  /** That same time, spelled. Empty when there is nothing to say. */
  readWhen: string
}

/** A board that is simply here, which is what every Local board is. */
export const LOCAL_STANDING: BoardStanding = {
  kind: 'local',
  offline: false,
  workspaceName: '',
  readAt: '',
  readWhen: '',
}

/** What every screen carries whatever it is showing: which board this is, and how it stands. */
export interface ScreenBoard {
  /** What this board is called — the checkout it lives in, or the workspace it is a copy
   *  of. Opaque: it keys what one browser remembers per board (the release on screen, the
   *  cards it has open) and means nothing outside that. */
  id: string
  standing: BoardStanding
  /** What this board's work IS (#411) — the face its cards wear and the block its card page
   *  draws. Read where the board is, so the first paint is already the right screen; a board
   *  whose `config.md` cannot be read, and every hosted board, answers `product`. */
  solution: Solution
}

/** Everything the board screen draws.
 *
 *  `board` and `error` are both here because a board whose rules are missing or too old
 *  cannot be read at all, and the screen says so with the last board that DID read still
 *  under the message. */
export interface BoardScreen extends ScreenBoard {
  board: Board | null
  error: string | null
}

/** Everything a card page draws. The board fields beside the card are the ones the page
 *  itself needs — the ids it may link to, the releases its picker offers, whether the goal
 *  is written, the modules memory is kept for. */
export interface CardScreen extends ScreenBoard {
  card: Card
  openIds: number[]
  releases: string[]
  goalWritten: boolean
  memoryModules: MemoryModule[]
  /** What an Implement click would do from here (#307) — the branch it lands on. */
  plan: DeliveryPlan
  /** What the delivery on this card changed (#305), capped where it was read. Null when
   *  there is nothing to show, and then the delivery block has no **Diff** tab. */
  diff: DeliveryDiff | null
}
