// ---- recurring cards, retired (#1414) --------------------------------------
//
// Repeating work is a workflow's scheduled agent now. This module turns the cards an older
// board still carries under `todo/recurring/` into those agents, by copying what each says.

import fs from 'node:fs'
import path from 'node:path'

import { adoptMemoryPruneCadence } from './agent/settings'
import { ROLE_NAMES } from './agent/roles'
import { DEFAULT_WORKFLOW, adoptWorkflowScheduled, workflowById } from './agent/workflows'
import { specAgentCatalog } from './agents/catalog'
import { AGENT_NAME } from './agents/parse'
import { parseCadence, parseStamp } from './cadence'
import { LEGACY_RECURRING, dropCrossRefs, idPrefix } from './cards'
import { parseFrontmatter } from './frontmatter'
import { readLanguage } from './machine/settings'
import { AGENTS, TODO, rel } from './paths'
import { hasOptions, openOf, parseQuestion } from './questions'
import { stripReadmeRefs } from './readme'
import { addToInbox } from './signals/add'
import type { RecurringMigration } from './view/types'
import { yamlScalar } from './yaml'

const PRUNE_SLUG = 'prune-the-memory'
const FETCH_SLUG = 'fetch-triage-items'
const AGENT_FILE = 'AGENT.md'

const recurringDir = (): string => path.join(TODO, LEGACY_RECURRING)

/**
 * Take the old "Prune the memory" card off a board, once (#514).
 *
 * Pruning is the Memory pruner agent, so the card goes and whatever cadence it carried is
 * kept beside the agent — never switched on: a pass rewrites every memory file.
 *
 * Returns the file it removed, or null when this board has no such card.
 */
export function migratePruneMemoryCard(): string | null {
  const dir = recurringDir()
  let names: string[]
  try {
    names = fs.readdirSync(dir)
  } catch {
    return null
  }
  const name = names.find((entry) => entry.endsWith(`-${PRUNE_SLUG}.md`))
  if (!name) return null
  const file = path.join(dir, name)
  try {
    const { meta } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
    const cadence = (meta as unknown as Record<string, unknown> | null)?.cadence
    if (typeof cadence === 'string') adoptMemoryPruneCadence(cadence)
  } catch {
    // an unreadable card still goes: what is being removed is the job, not the file's words
  }
  fs.rmSync(file, { force: true })
  return rel(file)
}

// ---- cards into scheduled agents -------------------------------------------

interface LegacyCard {
  id: number
  slug: string
  /** The card's own file. */
  file: string
  /** Its folder, when the card is `<id>-<slug>/root.md` with its working files beside it. */
  folder?: string
}

/** Whether this board still carries a recurring card to migrate. */
export function recurringCardsLeft(): boolean {
  try {
    return legacyCards().length > 0
  } catch {
    return false
  }
}

function legacyCards(): LegacyCard[] {
  const dir = recurringDir()
  if (!fs.existsSync(dir)) return []
  const cards: LegacyCard[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const id = idPrefix(entry.name)
    if (id === null) continue
    const full = path.join(dir, entry.name)
    const slug = entry.name.replace(/\.md$/, '').replace(/^\d+-?/, '')
    if (entry.isFile() && entry.name.endsWith('.md')) cards.push({ id, slug, file: full })
    else if (entry.isDirectory() && fs.existsSync(path.join(full, 'root.md'))) {
      cards.push({ id, slug, file: path.join(full, 'root.md'), folder: full })
    }
  }
  return cards.sort((a, b) => a.id - b.id)
}

/** Move everything in `from` into `to`, folder by folder. A file already there is left where
 *  it was, so nothing is overwritten. */
function mergeInto(from: string, to: string, skip: string[] = []): void {
  fs.mkdirSync(to, { recursive: true })
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (skip.includes(entry.name)) continue
    const source = path.join(from, entry.name)
    const target = path.join(to, entry.name)
    if (!fs.existsSync(target)) fs.renameSync(source, target)
    else if (entry.isDirectory() && fs.statSync(target).isDirectory()) mergeInto(source, target)
  }
  if (isEmpty(from)) fs.rmSync(from, { recursive: true, force: true })
}

const isEmpty = (dir: string): boolean => fs.readdirSync(dir).every((name) => name === '.DS_Store')

/** The working folders beside the cards go to `agents/`, under their own names. */
function moveSideFolders(): void {
  const dir = recurringDir()
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || idPrefix(entry.name) !== null) continue
    const from = path.join(dir, entry.name)
    if (isEmpty(from)) fs.rmSync(from, { recursive: true, force: true })
    else mergeInto(from, path.join(AGENTS, entry.name))
  }
}

const SECTION = /^##\s+(.+?)\s*$/

/** A card body as its opening paragraph and its `##` sections, each verbatim. */
function sections(body: string): { lead: string; byTitle: Map<string, string> } {
  const lines = body.split('\n')
  const first = lines.findIndex((line) => SECTION.test(line))
  const lead = (first < 0 ? lines : lines.slice(0, first)).join('\n').trim()
  const byTitle = new Map<string, string>()
  let title = ''
  let fenced = false
  for (const line of first < 0 ? [] : lines.slice(first)) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced
    const heading = fenced ? null : line.match(SECTION)
    if (heading) {
      title = heading[1]!
      if (!byTitle.has(title)) byTitle.set(title, '')
    } else byTitle.set(title, `${byTitle.get(title)}${line}\n`)
  }
  return { lead, byTitle }
}

/** The `AGENT.md` one card becomes: the card's own words under an agent's frontmatter. */
function agentText(name: string, title: string, body: string): string {
  const { lead, byTitle } = sections(body)
  const process = byTitle.get('Process')?.trim()
  if (!process) throw new Error('it has no `## Process`, so there is nothing for an agent to do')
  const state = byTitle.get('Run state')?.trim()
  const text = [
    '---',
    `name: ${name}`,
    `description: ${yamlScalar((lead || title).replace(/\s+/g, ' '))}`,
    'akb:',
    '  hook: schedule',
    '  i18n:',
    `    ${readLanguage()}:`,
    `      title: ${yamlScalar(title)}`,
    '---',
    '',
    ...(lead ? [lead, ''] : []),
    ...(state ? ['## Run state', '', state, ''] : []),
    '## Process',
    '',
    process,
    '',
  ].join('\n')
  return text.split(`todo/${LEGACY_RECURRING}/`).join('agents/')
}

/** The name the agent takes: the card's slug, or the slug and the card's id when another
 *  agent has it. A folder holding the very file this would write is the card's own, from a
 *  pass that stopped before the card was deleted. */
function agentName(card: LegacyCard, text: (name: string) => string): string {
  const slug = card.slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'task'
  const known = new Set([...specAgentCatalog().agents.map((a) => a.name), ...ROLE_NAMES])
  for (const name of [slug, `${slug}-${card.id}`]) {
    if (!AGENT_NAME.test(name)) continue
    const file = path.join(AGENTS, name, AGENT_FILE)
    const written = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
    if (written === text(name)) return name
    if (written === null && !known.has(name)) return name
  }
  throw new Error(`the agent names \`${slug}\` and \`${slug}-${card.id}\` are both taken`)
}

/** Every open question becomes a triage item naming the agent. One already there is left. */
function questionsToTriage(meta: { questions: Parameters<typeof openOf>[0] }, agent: string): void {
  for (const q of openOf(meta.questions)) {
    const options = hasOptions(q) ? `\n\n${q.options.map((o) => `- ${o}`).join('\n')}` : ''
    const { text } = parseQuestion(q.text)
    addToInbox({ title: text, text: `${text}${options}`, source: `agent ${agent}` })
  }
}

function removeCard(card: LegacyCard): void {
  dropCrossRefs(card.id)
  const target = card.folder ?? card.file
  stripReadmeRefs({ kind: card.folder ? 'group' : 'file', rel: path.relative(TODO, target).split(path.sep).join('/') })
  fs.rmSync(target, { recursive: true, force: true })
}

function migrateCard(card: LegacyCard): RecurringMigration['agents'][number] {
  const { meta, body } = parseFrontmatter(fs.readFileSync(card.file, 'utf8'))
  if (!meta) throw new Error('its frontmatter cannot be read')
  const raw = meta as unknown as Record<string, unknown>
  const said = (key: string): string => (typeof raw[key] === 'string' ? (raw[key] as string).trim() : '')
  const cadence = parseCadence(said('cadence')) ? said('cadence') : ''
  const lastRun = parseStamp(said('last_run')) ? said('last_run') : ''
  const flow = workflowById(meta.workflow) ?? workflowById(DEFAULT_WORKFLOW)
  if (!flow) throw new Error('this board has no workflow to put it in')

  const text = (name: string): string => agentText(name, meta.title || card.slug, body)
  const name = agentName(card, text)
  const dir = path.join(AGENTS, name)
  const file = path.join(dir, AGENT_FILE)
  const madeDir = !fs.existsSync(dir)
  const wrote = !fs.existsSync(file)
  try {
    fs.mkdirSync(dir, { recursive: true })
    if (wrote) fs.writeFileSync(file, text(name))
    const adopted = adoptWorkflowScheduled(flow.id, name, { cadence, lastRun })
    if (!adopted.ok) throw new Error(adopted.error)
    questionsToTriage(meta, name)
  } catch (e) {
    // No half an agent: the card stays, and the next pass starts it over.
    if (madeDir) fs.rmSync(dir, { recursive: true, force: true })
    else if (wrote) fs.rmSync(file, { force: true })
    throw e
  }
  if (card.folder) mergeInto(card.folder, dir, ['root.md'])
  removeCard(card)
  return { card: rel(card.file), agent: name, workflow: flow.name, on: !!cadence, cadence }
}

/**
 * Turn every recurring card into a scheduled agent of its workflow, and delete the card.
 *
 * Safe to run again: a card that failed is still there and is tried again, and once none is
 * left there is nothing to do. The caller holds the board lock.
 */
export function migrateRecurringCards(): RecurringMigration {
  const done: RecurringMigration = { agents: [], removed: [], failed: [] }
  const dir = recurringDir()
  if (!fs.existsSync(dir)) return done
  migratePruneMemoryCard()
  moveSideFolders()
  for (const card of legacyCards()) {
    try {
      if (card.slug === FETCH_SLUG) {
        removeCard(card)
        done.removed.push(rel(card.file))
      } else done.agents.push(migrateCard(card))
    } catch (e) {
      done.failed.push({ card: rel(card.file), why: e instanceof Error ? e.message : String(e) })
    }
  }
  if (isEmpty(dir)) fs.rmSync(dir, { recursive: true, force: true })
  return done
}

/** One line per card, as `akb update` prints them. */
export function recurringMigrationLines(done: RecurringMigration): string[] {
  return [
    ...done.agents.map(
      (one) =>
        `${one.card} is now the scheduled agent \`${one.agent}\` in the ${one.workflow} workflow — ` +
        (one.on ? `on, cadence ${one.cadence}` : 'off: it had no cadence, so it runs only when you run it'),
    ),
    ...done.removed.map((card) => `removed ${card} — write a scheduled agent to pull triage items on a cadence (\`akb guide write-agent\`)`),
    ...done.failed.map((one) => `could not turn ${one.card} into a scheduled agent: ${one.why}. It is left as it was and tried again next time`),
  ]
}
