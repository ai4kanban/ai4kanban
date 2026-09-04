// `akb guide [<topic>]` — the flows, asked for by name.
//
// A printed flow already carries the guides its action needs, so this is for the topics no
// action maps to: how the board works at all, the module map, setup, updating, the local
// UI. It is also the door back for an agent that was pointed at one guide
// from inside another.

import { findGuide, GUIDE_NAMES, guideList } from '../lib/guide'
import { say } from '../lib/io'
import { die } from '../lib/paths'
import type { MoveResult } from '../lib/types'
import { nearestMove } from '../lib/board-cli'

export function cmdGuide(topic: string | undefined, program = 'akb'): MoveResult {
  const name = topic?.trim()
  if (!name) {
    say(guideList(program))
    return { guides: GUIDE_NAMES }
  }
  const guide = findGuide(name)
  if (!guide) {
    const guess = nearestMove(name, GUIDE_NAMES)
    die(
      `no guide called "${name}".${guess ? ` Did you mean \`${program} guide ${guess}\`?` : ''} \`${program} guide\` lists them.`,
      { kind: 'unknown-guide', guide: name },
    )
  }
  say(guide.text.trimEnd())
  return { guide: guide.name, text: guide.text }
}
