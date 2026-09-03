// ---- which board this checkout opens (#316) ---------------------------------
//
// One call, made once a command or a board server knows which project it is working on:
// `.ai4kanban.json` at the repository root names a workspace, or it doesn't. A checkout with
// no pointer is a Local board and behaves exactly as it always has — nothing here hydrates,
// locks or uploads on one.
//
// This is the only caller of `setBoardProvider` outside a test. Everything else asks
// `board()` and never learns which kind it got.

import { openCloudBoard, type CloudBoardHandle, type CloudBoardState, type OpenRefusal } from './cloud'
import { readPointer } from '../cloud/pointer'
import { setBoardProvider } from './index'

export type { OpenRefusal }

/** How the board in front of the user stands, for the one notice the app and `akb` both
 *  draw from it. A Local board is never offline and has nothing to say. */
export interface BoardState {
  kind: 'local' | 'cloud'
  offline: boolean
  /** When the copy was last read from the workspace, as an ISO timestamp. Empty on a Local
   *  board and on a Cloud board that has never read one. */
  readAt: string
  workspaceName: string
}

export type OpenBoard =
  | { ok: true; kind: 'local' }
  | { ok: true; kind: 'cloud'; state: CloudBoardState }
  | { ok: false; kind: 'cloud'; reason: OpenRefusal; error: string }

const LOCAL: BoardState = { kind: 'local', offline: false, readAt: '', workspaceName: '' }

/** The Cloud board this process has open, and which checkout it belongs to. Held so a board
 *  server that lives for hours hydrates once rather than on every request. */
let open: { root: string; workspaceId: string; board: CloudBoardHandle } | null = null

/** The checkout whose last open was REFUSED. A refusal is never the process's final answer:
 *  signing in from the app, or Cloud coming back, has to open the board on the next read —
 *  every remedy the refusal names is one the user carries out without restarting anything. */
let refused = ''

/** The attempt in flight, so two readers arriving together share one. A board server takes
 *  requests in parallel, and two hydrations racing would clear and rewrite the same copy. */
let opening: { root: string; work: Promise<OpenBoard> } | null = null

/**
 * Point this process at the board `root` holds.
 *
 * Safe to call again, and meant to be: a Cloud board already open for the same checkout and
 * the same workspace is left exactly as it is, because re-reading it here would be a poll —
 * the copy is refreshed by a write, by a stale refusal, and by `refreshBoard` below. What a
 * repeat call is for is the board that would NOT open.
 */
export function openBoard(root: string): Promise<OpenBoard> {
  if (opening && opening.root === root) return opening.work
  const work = attempt(root)
  opening = { root, work }
  const done = () => {
    if (opening?.work === work) opening = null
  }
  work.then(done, done)
  return work
}

async function attempt(root: string): Promise<OpenBoard> {
  const pointer = readPointer(root)
  if (!pointer) {
    open = null
    refused = ''
    setBoardProvider(null)
    return { ok: true, kind: 'local' }
  }

  if (open && open.root === root && open.workspaceId === pointer.workspace) {
    setBoardProvider(open.board.provider)
    return { ok: true, kind: 'cloud', state: open.board.state() }
  }

  // A retry after a refusal is on the path of every read, so it runs under the same short
  // timeout an offline read does: a service that hangs must not hang the screen.
  const got = await openCloudBoard(root, pointer.workspace, { retry: refused === root })
  if (!got.ok) {
    open = null
    refused = root
    // Nothing is installed on a refusal: a Local provider left in front of a Cloud checkout
    // would read and write the markdown the pointer says to leave alone.
    setBoardProvider(refusing(got.error))
    return { ok: false, kind: 'cloud', reason: got.reason, error: got.error }
  }
  open = { root, workspaceId: pointer.workspace, board: got.board }
  refused = ''
  setBoardProvider(got.board.provider)
  return { ok: true, kind: 'cloud', state: got.board.state() }
}

/** The Cloud board this process has open, or null on a Local one. What a run reaches for
 *  when it holds a card, stands the copy's refresh down, and uploads at its close (#398);
 *  nothing else asks, because nothing else has to know which kind of board it is on. */
export const cloudHandle = (): CloudBoardHandle | null => open?.board ?? null

/** How the board this process has open stands right now. */
export function boardState(): BoardState {
  if (!open) return LOCAL
  const state = open.board.state()
  return {
    kind: 'cloud',
    offline: state.offline,
    readAt: state.readAt,
    workspaceName: state.workspaceName,
  }
}

/**
 * Re-read the whole workspace — the user asking, never a timer.
 *
 * A Local board answers `true` and does nothing: there is no copy to refresh, and a caller
 * that had to know which kind of board it was on would be a caller that knows too much.
 */
export async function refreshBoard(): Promise<{ ok: boolean; error?: string }> {
  if (!open) return { ok: true }
  const read = await open.board.refresh()
  return read.ok ? { ok: true } : { ok: false, error: read.error }
}

// ---- a board that would not open --------------------------------------------

/**
 * The provider a checkout gets when its pointer names a workspace this machine cannot
 * reach: every operation answers with the one line saying why.
 *
 * It exists so that a screen or a command that goes on and asks for the board anyway is told
 * the reason rather than being handed the markdown left in the checkout — which is exactly
 * what "the pointer wins over board markdown left beside it" has to mean when the workspace
 * is out of reach.
 */
function refusing(error: string): import('./contract').BoardProvider {
  const no = () => Promise.reject(new Error(error))
  const refused = () => Promise.resolve({ ok: false as const, kind: 'refused' as const, error })
  return {
    kind: 'cloud',
    readBoard: no,
    boardStamp: () => Promise.resolve(''),
    readCard: () => Promise.resolve(null),
    readCards: () => Promise.resolve([]),
    // The archive is the whole of its screen, so an empty list would read as a board that
    // finished no work rather than as one nothing can be read from (#380).
    readArchive: no,
    readArchivedCard: () => Promise.resolve(null),
    readReleases: () => Promise.resolve([]),
    readModules: () => Promise.resolve([]),
    readGoalText: () => Promise.resolve(''),
    readMemoryFile: () => Promise.resolve(null),
    readMemoryModules: () => Promise.resolve([]),
    readSetupState: () => Promise.resolve(null),
    readSetupDraft: no,
    readMetricsView: () => Promise.resolve({ ok: false, error }),
    readScoreView: () => Promise.resolve({ ok: false, error }),
    fillPlan: () => Promise.resolve({ fill: [], skipped: [] }),
    closePlan: () => Promise.resolve({ left: [], shipped: 0 }),
    dropPlan: () => Promise.resolve({ archived: [], left: [] }),
    nextWork: () => Promise.resolve([]),
    lease: () => Promise.resolve({ ok: false, error }),
    releaseLease: () => Promise.resolve(),
    patchCard: refused,
    setStatus: refused,
    setSchedule: refused,
    addVerify: refused,
    dropVerify: refused,
    appendQuestion: refused,
    archiveCard: refused,
    rejectCard: refused,
    setCardsRelease: () => Promise.resolve({ moved: 0, failed: [], error }),
    newRelease: refused,
    setReleaseGoal: refused,
    closeRelease: refused,
    dropRelease: refused,
    saveGoal: refused,
    saveProject: () => Promise.resolve({ ok: false, error }),
    finishSetupStep: refused,
    saveMemoryFile: refused,
    readFlowRules: () => Promise.resolve([]),
    saveFlowRule: refused,
    deliveryRules: () => Promise.resolve({}),
    recordRun: refused,
    listDeliveries: () => Promise.resolve([]),
    activeDelivery: () => Promise.resolve(undefined),
    deliveryPlan: () => Promise.resolve({ commitMode: 'auto' }),
    deliveryDiff: () => Promise.resolve(null),
    cancelDelivery: refused,
    discardDelivery: refused,
    approveDelivery: refused,
    runMove: refused,
    readMove: no,
  }
}
