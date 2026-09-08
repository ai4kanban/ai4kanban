import fs from 'node:fs'

import { insideRun } from '../lib/agent/flow'
import { startRun } from '../lib/agent/start'
import { titleOf } from '../lib/agent/sessions'
import { locate } from '../lib/cards'
import { CHANNEL_NAMES } from '../lib/channels'
import { draftFile } from '../lib/content'
import { parseFrontmatter } from '../lib/frontmatter'
import { say } from '../lib/io'
import { die, rel } from '../lib/paths'
import { solution } from '../lib/solution'
import type { MoveResult } from '../lib/types'

export async function cmdMarketingVerify(opts: { channel: string; id: number; print?: boolean }): Promise<MoveResult> {
  if (solution() !== 'marketing') die('`akb marketing verify` requires a marketing board.', { kind: 'wrong-solution' })
  if (opts.print) die('The polish loop has no --print: it runs its passes in a fresh session.', { kind: 'bad-option' })
  if (insideRun()) die('A run cannot start the polish loop; the user starts it.', { kind: 'run-refused' })
  const channel = opts.channel.trim().toLowerCase()
  if (!CHANNEL_NAMES.includes(channel)) die(`Unknown channel: ${channel}. Choose ${CHANNEL_NAMES.join(', ')}.`, { kind: 'unknown-channel' })
  const found = locate(opts.id)
  if (!found || found.kind !== 'file') die(`No topic with id ${opts.id}.`, { kind: 'card-not-found' })
  const { meta } = parseFrontmatter(fs.readFileSync(found.target, 'utf8'))
  if (!meta?.channels.some((entry) => entry.name === channel)) {
    die(`#${opts.id} does not go to ${channel}.`, { kind: 'channel-not-chosen' })
  }
  const file = draftFile(found.target, channel)
  if (!fs.existsSync(file)) die(`No draft at ${rel(file)}. Run akb channel ${channel} ${opts.id} first.`, { kind: 'no-channel-draft' })
  const started = await startRun({ action: 'marketing-polish-loop', id: opts.id, title: titleOf(opts.id), channel })
  if ('error' in started) die(started.error, { kind: 'run-refused' })
  if (!started.spawned) die(`Couldn't start polish-loop run ${started.run.sessionId}.`, { kind: 'spawn-failed' })
  say(`verify ${channel} #${opts.id} — run ${started.run.sessionId}`)
  return { sessionId: started.run.sessionId, action: 'marketing-polish-loop', cardId: opts.id, channel }
}
