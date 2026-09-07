import fs from 'node:fs'

import { insideRun } from '../lib/agent/flow'
import { startRun } from '../lib/agent/start'
import { titleOf } from '../lib/agent/sessions'
import { writingVerification } from '../lib/agent/writing-verification'
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
  if (opts.print) die('Verification has no --print: every verifier starts in a fresh session.', { kind: 'bad-option' })
  if (insideRun()) die('A run cannot start verification; the user starts it and the board drives the loop.', { kind: 'run-refused' })
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
  const started = await startRun({
    action: 'marketing-verify', id: opts.id, title: titleOf(opts.id), channel, verification: writingVerification(),
  })
  if ('error' in started) die(started.error, { kind: 'run-refused' })
  if (!started.spawned) die(`Couldn't start verification run ${started.run.sessionId}.`, { kind: 'spawn-failed' })
  say(`verify ${channel} #${opts.id} — run ${started.run.sessionId}`)
  return { sessionId: started.run.sessionId, action: 'marketing-verify', cardId: opts.id, channel }
}
