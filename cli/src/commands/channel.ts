// Repurposing a topic's draft for one channel.
//
// `akb channel` with nothing after it lists the channels. `akb channel <name> <id>` writes
// that channel's draft from the topic's `source.md` — a run of its own, with its own log,
// stoppable like anything else, and starting clean.
//
// Repurposing is a step you take, not one that follows the write run on its own: you run it
// once `source.md` reads right. And like `akb spec` it has no `--print` — a draft written in
// the conversation that asked for it is that conversation's opinion of the piece, not a pass
// over what `source.md` actually says.

import fs from 'node:fs'

import { insideRun } from '../lib/agent/flow'
import { titleOf } from '../lib/agent/sessions'
import { startRun } from '../lib/agent/start'
import type { AgentRequest } from '../lib/agent/types'
import { locate } from '../lib/cards'
import { CHANNELS, CHANNEL_NAMES, channelLanguage } from '../lib/channels'
import { draftFile, SOURCE } from '../lib/content'
import { parseFrontmatter } from '../lib/frontmatter'
import { say } from '../lib/io'
import { die, rel, BOARD_FLAG, TODO } from '../lib/paths'
import { solution } from '../lib/solution'
import type { MoveResult } from '../lib/types'
import { followRun, short } from './run'

/** `akb channel`, as its command declares it (lib/cli/agent.ts). */
export interface ChannelOptions {
  channel?: string
  id?: number
  note?: string[]
  notes?: string
  again?: boolean
  follow?: boolean
  print?: boolean
}

export async function cmdChannel(opts: ChannelOptions, program = 'akb'): Promise<MoveResult> {
  // The channels are the marketing solution's whole vocabulary — a product board publishes
  // nothing, so there is nothing here for it to name.
  if (solution() !== 'marketing') {
    die(
      `\`${program} channel\` is the marketing solution's — this board is \`${solution()}\`, and its cards are built, not published.`,
      { kind: 'wrong-solution', solution: solution() },
    )
  }

  // No channel named: say which ones there are, and what each one is written in.
  if (!opts.channel) {
    say(channelList(program))
    return { channels: CHANNEL_NAMES }
  }

  const name = opts.channel.trim().toLowerCase()
  if (!CHANNEL_NAMES.includes(name)) {
    die(`no channel called "${opts.channel}". the channels are: ${CHANNEL_NAMES.join(', ')}.`, {
      kind: 'unknown-channel',
      channels: [opts.channel],
      known: CHANNEL_NAMES,
    })
  }

  if (opts.print === true) {
    die(
      `a repurpose has no --print: it is worth a run of its own precisely because it reads \`source.md\` and not the conversation that asked for it. Run \`${program} channel ${name} ${opts.id ?? '<id>'}\` and it starts on its own.`,
      { kind: 'bad-option' },
    )
  }

  // Typed inside a run. Nothing writes the ask down for later — a repurpose is a step the
  // user takes when `source.md` reads right, and a run that queued one would be deciding
  // that on their behalf.
  if (insideRun()) {
    die(
      `a run does not repurpose a draft — \`${program} channel\` is a step the user takes once \`source.md\` reads right, and nothing writes the ask down for later.`,
      { kind: 'run-refused', action: 'channel' },
    )
  }

  const id = opts.id
  if (id === undefined) die(`say which topic: ${program} channel ${name} <id> [note]`, { kind: 'needs-input' })
  const found = locate(id)
  if (!found || found.kind !== 'file') die(`no topic with id ${id} under ${rel(TODO)}`, { kind: 'card-not-found', id })

  const { meta } = parseFrontmatter(fs.readFileSync(found.target, 'utf8'))
  if (!meta?.channels.some((c) => c.name === name)) {
    die(
      `#${id} does not go to ${name} — its channels are ${meta?.channels.map((c) => c.name).join(', ') || '(none chosen)'}. ` +
        `Add it with \`${program} raw update ${id} --channels <names>\`, lead channel first.`,
      { kind: 'channel-not-chosen', id, channel: name },
    )
  }

  const source = draftFile(found.target, SOURCE)
  if (!fs.existsSync(source)) {
    die(
      `#${id} has no ${rel(source)} yet — there is nothing to repurpose. \`${program} card implement ${id}\` writes it.`,
      { kind: 'no-source-draft', id },
    )
  }

  // A draft is never silently rewritten: a marketing build leaves its files uncommitted, so
  // an edit the user made to this draft is the only copy of it.
  const target = draftFile(found.target, name)
  if (fs.existsSync(target) && opts.again !== true) {
    die(
      `${rel(target)} is already written, and your edits to it are the only copy. Add \`--again\` to replace it.`,
      { kind: 'draft-exists', id, channel: name },
    )
  }

  const notes = noteOf(opts.note ?? [], opts.notes, opts.again === true)
  const req: AgentRequest = { action: 'channel', id, title: titleOf(id), channel: name, notes }
  const started = await startRun(req)
  if ('error' in started) die(started.error, { kind: 'run-refused', action: 'channel' })
  const { run, spawned } = started
  if (!spawned) die(`couldn't start a process to run ${run.sessionId}`, { kind: 'spawn-failed' })
  say(`channel ${name} #${id} → ${rel(target)} — run ${run.sessionId}`)
  say(`  follow it: ${program} run log ${short(run.sessionId)} --follow${BOARD_FLAG}`)
  say(`  stop it:   ${program} run stop ${short(run.sessionId)}${BOARD_FLAG}`)
  if (opts.follow === true) return { sessionId: run.sessionId, ...(await followRun(run.sessionId, '', program)) }
  return { sessionId: run.sessionId, action: 'channel', channel: name, cardId: id, file: rel(target) }
}

// The channels and the language each one's audience reads. That pair is the whole definition
// of a channel: there is no per-channel instruction file, so this list is the whole list.
function channelList(program: string): string {
  const width = Math.max(...CHANNEL_NAMES.map((n) => n.length)) + 4
  return [
    `${program} channel <name> <id> — repurpose a topic's \`source.md\` into one channel's draft.`,
    '',
    'Channels',
    ...CHANNELS.map((c) => `  ${c.name.padEnd(width - 2)}${c.language}`),
    '',
    `A topic goes to the channels its card names — \`${program} raw update <id> --channels <names>\`, lead`,
    'channel first. What makes a draft good is `memory/writing.md` and `memory/writing/`, so a rule',
    'learned on one channel reaches every channel it fits.',
  ].join('\n')
}

// What the run should know, in the user's own words. Everything after the id is the note, so
// it can be typed without quoting; `--notes` is the same thing for a caller building a
// command. `--again` is added to it, because replacing a draft the user may have edited is
// the one thing the run has to be told about the file it is overwriting.
function noteOf(words: string[], flag: string | undefined, again: boolean): string | undefined {
  const typed = words.join(' ').trim() || flag?.trim() || ''
  const replacing = again ? 'The draft is already there and you are replacing it — read it first, and keep what still works.' : ''
  return [typed, replacing].filter(Boolean).join(' ') || undefined
}
