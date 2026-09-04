// ---- the channels a topic goes to ------------------------------------------
//
// One topic goes to several channels, and each wants a different shape — often a different
// language — of the same piece. Which channels those are lives in the card's own
// frontmatter, so it travels with the card, survives a restart and is what a screen draws:
//
//   channels:
//     - x                        <- chosen, nothing written for it yet
//     - name: xiaohongshu
//       status: published
//       url: "https://..."
//
// Order is meaning: the FIRST entry is the lead channel, the one `source.md` is written
// for. Every other chosen channel is a repurposing of it (`akb channel <name> <id>`).
//
// A channel is a name and a language, and that pair is the whole definition — there is no
// per-channel instruction file. What makes a draft good is `memory/writing.md` and
// `memory/writing/`, so a rule learned on one channel reaches every channel it fits; the
// cost is that a fifth channel is a change to `akb` rather than a file on a board.
//
// This module is the FIELD — the four names, how it reads, and how it is written back. The
// run that fills a channel's draft is `commands/channel.ts`.

import { die } from './paths'
import { yamlScalar, unquote } from './yaml'
import type { CardChannel, ChannelStatus } from './view/types'

/** The channels a topic can go to, each with the language its audience reads. */
export const CHANNELS: { name: string; language: string }[] = [
  { name: 'x', language: 'English' },
  { name: 'linkedin', language: 'English' },
  { name: 'reddit', language: 'English' },
  { name: 'xiaohongshu', language: 'Chinese' },
]

export const CHANNEL_NAMES = CHANNELS.map((c) => c.name)

/** The steps a channel's draft moves along, in order. */
export const CHANNEL_STATUSES: ChannelStatus[] = ['draft', 'ready', 'scheduled', 'published']

/** The language that channel's audience reads, or empty for a name that is not one. */
export const channelLanguage = (name: string): string =>
  CHANNELS.find((c) => c.name === name)?.language ?? ''

/** One status as the card writes it, or null for anything else — which reads as a channel
 *  chosen with nothing written for it yet. */
export function asChannelStatus(raw: unknown): ChannelStatus | null {
  const text = String(raw ?? '').trim().toLowerCase()
  return CHANNEL_STATUSES.find((s) => s === text) ?? null
}

/** One channel from whatever shape it arrived in, or null when it names no channel we
 *  have. An unknown name drops out rather than being kept: nothing can write it, and a
 *  screen drawing a tab for it would be drawing a tab that does nothing. */
export function normalizeChannel(raw: unknown): CardChannel | null {
  const fields = typeof raw === 'string' ? { name: raw } : (raw as Record<string, unknown> | null)
  if (!fields || typeof fields !== 'object') return null
  const name = String(fields.name ?? '').trim().toLowerCase()
  if (!CHANNEL_NAMES.includes(name)) return null
  const url = typeof fields.url === 'string' ? fields.url.trim() : ''
  return { name, status: asChannelStatus(fields.status) ?? '', url }
}

/** The whole list, in the order it was written, with a name repeated kept only once. */
export function normalizeChannels(raw: unknown): CardChannel[] {
  const items = Array.isArray(raw) ? raw : raw === undefined || raw === null || raw === '' ? [] : [raw]
  const out: CardChannel[] = []
  for (const item of items) {
    const channel = normalizeChannel(item)
    if (channel && !out.some((c) => c.name === channel.name)) out.push(channel)
  }
  return out
}

/** Read the indented block under a `channels:` line. Two shapes side by side, the way
 *  `questions:` carries two: a bare name is a chosen channel with nothing written for it,
 *  and a block carries the status and the URL. */
export function parseChannelsBlock(lines: string[]): CardChannel[] {
  const out: unknown[] = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.match(/^\s*-\s+(.*)$/)
    if (!m) continue
    const head = m[1]!
    const opened = head.match(/^name:\s*(.*)$/)
    if (!opened) {
      out.push(unquote(head))
      continue
    }
    const fields: Record<string, string> = { name: unquote(opened[1]!) }
    // This channel's own fields, until the next `- ` item starts the following one.
    while (i + 1 < lines.length && !/^\s*-\s/.test(lines[i + 1]!)) {
      const field = lines[i + 1]!.match(/^\s*([A-Za-z_]+):\s*(.*)$/)
      i++
      if (field) fields[field[1]!] = unquote(field[2]!)
    }
    out.push(fields)
  }
  return normalizeChannels(out)
}

/** The frontmatter lines for a card's channels — none at all on a card that names none, so
 *  every product card and every unanswered topic keeps the frontmatter it always had. */
export function serializeChannels(channels: CardChannel[] | undefined): string[] {
  const list = normalizeChannels(channels)
  if (!list.length) return []
  const out = ['channels:']
  for (const c of list) {
    // A channel with nothing written for it is its name and no more: a `status: ""` line
    // would read as a status the board writes, and it is not one.
    if (!c.status && !c.url) {
      out.push(`  - ${c.name}`)
      continue
    }
    out.push(`  - name: ${c.name}`)
    out.push(`    status: ${c.status}`)
    if (c.url) out.push(`    url: ${yamlScalar(c.url)}`)
  }
  return out
}

/** The list `--channels` asks for, keeping what the card already knows about each channel
 *  that stays: a reorder must not throw away a published URL. An unknown name is a hard
 *  error naming the four, the way an unknown module names the map. */
export function chooseChannels(names: string[], current: CardChannel[]): CardChannel[] {
  const asked = names.map((n) => n.trim().toLowerCase()).filter(Boolean)
  const unknown = asked.filter((n) => !CHANNEL_NAMES.includes(n))
  if (unknown.length) {
    die(`unknown channel(s): ${unknown.join(', ')}. the channels are: ${CHANNEL_NAMES.join(', ')}.`, {
      kind: 'unknown-channel',
      channels: unknown,
      known: CHANNEL_NAMES,
    })
  }
  const out: CardChannel[] = []
  for (const name of asked) {
    if (out.some((c) => c.name === name)) continue
    out.push(current.find((c) => c.name === name) ?? { name, status: '', url: '' })
  }
  return out
}
