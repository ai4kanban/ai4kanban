// ---- `akb raw discussion` — the discussions a board is holding (#496) -------
//
// A board holds many discussions at once, each with its own transcript, agent session and
// plans. These are the moves over the list itself; what is said in one is `akb chat`.

import {
  archiveDiscussion,
  asDiscussion,
  listDiscussions,
  startDiscussion,
  titleDiscussion,
} from '../lib/agent/discussions'
import { insideDiscussion } from '../lib/agent/env'
import { say } from '../lib/io'
import { die } from '../lib/paths'
import type { DiscussionTarget } from '../lib/agent/types'
import type { MoveResult } from '../lib/types'

export interface DiscussionOptions {
  /** Which discussion the move is about. Left off, it is the one this turn is answering. */
  id?: string
  title?: string
}

export function cmdDiscussion(args: string[], opts: DiscussionOptions): MoveResult {
  const sub = (args[0] ?? '').trim()
  if (sub === 'new') return discussionNew()
  if (sub === 'list') return discussionList()
  if (sub === 'title') return discussionTitle(opts)
  if (sub === 'archive') return discussionArchive(opts)
  die(`\`discussion ${sub || '<move>'}\` is not a discussion move. Try \`discussion list\`.`, {
    kind: 'unknown-move',
    move: `discussion ${sub}`,
  })
}

function discussionNew(): MoveResult {
  const target = startDiscussion()
  say(target)
  say('  nothing is written until the first message — say something into it with `akb chat --discussion`')
  return { discussion: target }
}

function discussionList(): MoveResult {
  const rows = listDiscussions()
  if (!rows.length) say('no discussions going.')
  for (const row of rows) {
    const marks = [`${row.messages} message${row.messages === 1 ? '' : 's'}`]
    if (row.answering) marks.push('answering')
    if (row.plan) marks.push(row.plan)
    say(`${row.target}  ${row.name || '(unnamed)'}  — ${marks.join(' · ')}`)
  }
  return { discussions: rows }
}

function discussionTitle(opts: DiscussionOptions): MoveResult {
  const target = targetOf(opts)
  const title = (opts.title ?? '').trim()
  if (!title) die('--title must not be empty')
  titleDiscussion(target, title)
  say(`the discussion is now called "${title}".`)
  return { discussion: target, title }
}

function discussionArchive(opts: DiscussionOptions): MoveResult {
  const target = targetOf(opts)
  const done = archiveDiscussion(target)
  if ('error' in done) die(done.error, { kind: 'card-not-found' })
  say('taken out of the list — its transcript is still on this machine.')
  for (const gone of done.plans) say(`  dropped ${gone}`)
  return { discussion: target, archived: true, plans: done.plans }
}

// Which discussion a move is about: the one named, else the one this turn is answering.
function targetOf(opts: DiscussionOptions): DiscussionTarget {
  const named = (opts.id ?? '').trim() || insideDiscussion() || ''
  const target = named && asDiscussion(named)
  if (!target) {
    die(
      named
        ? `"${named}" is not a discussion of this board's. \`discussion list\` says which there are.`
        : 'no discussion named, and this is not running inside one. Name it with --id.',
      { kind: 'bad-option' },
    )
  }
  return target
}
