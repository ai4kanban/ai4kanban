// ---- `akb raw chats-reviewed` — the memory review's last step (#1322) --------
//
// A conversation is reviewed once. The review marks the ones it was handed with the command
// its task spells out, so a review that never got that far leaves them to be picked again.

import { markChatsReviewed } from '../lib/agent/memory-review'
import { say, warn } from '../lib/io'
import { die } from '../lib/paths'
import type { MoveResult } from '../lib/types'

export function cmdChatsReviewed(keys: string[]): MoveResult {
  if (!keys.length) die('name the conversations to mark, as the review task lists them: card-<id> or discussion-<id>')
  const { marked, unknown, remaining } = markChatsReviewed(keys)
  for (const key of unknown) warn(`no conversation is called ${key} — not marked`)
  say(`marked ${marked.length} conversation${marked.length === 1 ? '' : 's'} reviewed`)
  say(remaining ? '  more are waiting — the board starts the next review itself' : '  none left waiting')
  return { marked, unknown, remaining }
}
