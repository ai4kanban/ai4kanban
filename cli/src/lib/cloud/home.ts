// ---- where a card's live decision lives (#364) -------------------------------
//
// An event used to name the BOARD — a row a machine mints per checkout path and stamps with
// one account (./boards.ts). For a Cloud checkout that is the wrong thing to key on: the same
// workspace opened on two machines is two board rows, so one card raised two live decisions,
// and a browser that knows only a workspace id could find neither.
//
// So a checkout carrying a pointer raises its events against the WORKSPACE, and every other
// checkout goes on raising them against its board id exactly as it always has. One of the two
// is set and never both, which is the shape the service stores.
//
// Nothing here reaches the network or reads the board: it is the pointer this checkout
// commits (./pointer.ts) and the record this machine keeps of its copies (./copy.ts).

import { REPO_ROOT } from '../paths'
import type { CloudBoard } from './boards'
import { readBoardCopy } from './copy'
import { readPointer } from './pointer'

/** Which of the two an event belongs to. Exactly one is ever non-empty. */
export interface EventHome {
  boardId: string
  workspaceId: string
}

/**
 * The home this checkout publishes into.
 *
 * `root` is the project the board sits in — a Cloud checkout keeps its pointer at the
 * repository root, because on one `docs/kanban/` is a git-ignored copy of the workspace.
 */
export function eventHome(board: CloudBoard, root = REPO_ROOT): EventHome {
  const workspace = root ? readPointer(root)?.workspace : undefined
  return workspace ? { boardId: '', workspaceId: workspace } : { boardId: board.id, workspaceId: '' }
}

/** Whether an event Cloud handed back is one of this home's. Both halves are compared, so a
 *  workspace event never matches the board record sitting beside it on the same machine. */
export const inHome = (event: { boardId?: string; workspaceId?: string }, home: EventHome): boolean =>
  (event.boardId ?? '') === home.boardId && (event.workspaceId ?? '') === home.workspaceId

/**
 * This machine's node in a workspace, which is what claims that workspace's work.
 *
 * A board attaches one server; a workspace has as many machines as its members registered, and
 * each of them may take a decision up. The node row is minted when the machine first opens the
 * workspace (#316) and written down beside the copy it holds.
 */
export const workspaceNodeFor = (root = REPO_ROOT): string =>
  (root && readBoardCopy(root)?.nodeId) || ''
