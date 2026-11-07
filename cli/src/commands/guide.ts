// 按主题读取指南，供直接查询或指南之间的引用使用。

import { findGuide, guideList, guideNames } from '../lib/guide'
import { say } from '../lib/io'
import { die } from '../lib/paths'
import type { MoveResult } from '../lib/types'
import { nearestMove } from '../lib/board-cli'

export function cmdGuide(topic: string | undefined, program = 'akb'): MoveResult {
  const name = topic?.trim()
  if (!name) {
    say(guideList(program))
    return { guides: guideNames() }
  }
  const guide = findGuide(name)
  if (!guide) {
    const guess = nearestMove(name, guideNames())
    die(
      `no guide called "${name}".${guess ? ` Did you mean \`${program} guide ${guess}\`?` : ''} \`${program} guide\` lists them.`,
      { kind: 'unknown-guide', guide: name },
    )
  }
  say(guide.text.trimEnd())
  return { guide: guide.name, text: guide.text }
}
