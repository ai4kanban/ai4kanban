// A card's sources, resolved (#1306): each ref turned into something the card page can link,
// and the plan or triage item behind one read out whole. A ref whose target cannot be read
// here — another machine's plan, a card that is gone — is dropped rather than drawn dead.

import fs from 'node:fs'
import path from 'node:path'

import { locate, locateArchived } from './cards'
import { parseFrontmatter } from './frontmatter'
import { planHeading, readPlan, type PlanFile } from './plans'
import { readAllDismissed, readArchived, readInbox } from './signals/inbox'
import { legacySourceRefs, parseSourceRef, type SourceRef } from './source'
import type { Meta } from './types'
import type { Signal, SourceDocument, SourceLink } from './view/types'

// A plan by its id, in `plans/` or `plans/archive/`: `readPlan` follows the id, not the name.
function planById(id: number): PlanFile | null {
  const found = readPlan(`plans/${id}-.md`)
  return found?.text.trim() ? found : null
}

const planLink = (id: number): SourceLink | null => {
  const plan = planById(id)
  return plan && { kind: 'plan', ref: String(id), title: planHeading(plan.text) }
}

function cardLink(id: number): SourceLink | null {
  const open = locate(id)
  const found = open ?? locateArchived(id)
  if (!found) return null
  try {
    const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
    const title = parseFrontmatter(fs.readFileSync(file, 'utf8')).meta?.title ?? ''
    return { kind: 'card', ref: String(id), title, ...(open ? {} : { archived: true }) }
  } catch {
    return null
  }
}

function urlLink(url: string): SourceLink {
  let host = url
  try {
    host = new URL(url).host
  } catch {
    // drawn under the address itself
  }
  return { kind: 'url', ref: url, title: host }
}

// Every item triage holds, wherever it sits — not the 30-day window History draws.
const everyItem = (): Signal[] => [...readInbox(), ...readArchived(), ...readAllDismissed()]

// One link per item: its original link, else the card that prompted it, else the item.
function itemLink(item: Signal): SourceLink {
  if (item.url) return urlLink(item.url)
  const said = item.meta.find((pair) => pair.key === 'source')?.value.trim() ?? ''
  const named = /^#(\d+)$/.exec(said)
  const card = named ? cardLink(Number(named[1])) : null
  return card ?? { kind: 'triage', ref: item.sourceId, title: item.title }
}

function link(ref: SourceRef, items: () => Signal[]): SourceLink | null {
  if (ref.kind === 'plan') return planLink(ref.id)
  if (ref.kind === 'card') return cardLink(ref.id)
  if (ref.kind === 'url') return urlLink(ref.url)
  const item = items().find((signal) => path.basename(signal.relPath) === ref.file)
  return item ? itemLink(item) : null
}

/** Where a card came from, as its page links it. `source:` and `triage:` first; a card with
 *  neither — or whose item is gone — is read off its old `## Source`. */
export function cardSources(meta: Pick<Meta, 'source' | 'triage'>, body: string): SourceLink[] {
  let held: Signal[] | null = null
  const items = () => (held ??= everyItem())
  const out: SourceLink[] = []
  const put = (found: SourceLink | null) => {
    if (found && !out.some((have) => have.kind === found.kind && have.ref === found.ref)) out.push(found)
  }
  for (const raw of meta.source) {
    const ref = parseSourceRef(raw)
    if (ref) put(link(ref, items))
  }
  if (meta.triage) {
    const item = items().find((signal) => signal.sourceId === meta.triage)
    if (item) put(itemLink(item))
  }
  if (!meta.source.length && !out.length) for (const ref of legacySourceRefs(body)) put(link(ref, items))
  return out
}

/** The ids of the plans a card names, in `source:` or its old `## Source`. */
export function plansNamed(meta: Pick<Meta, 'source'>, body: string): number[] {
  const refs = [...meta.source.map(parseSourceRef), ...legacySourceRefs(body)]
  return refs.filter((ref): ref is { kind: 'plan'; id: number } => ref?.kind === 'plan').map((ref) => ref.id)
}

// The plan or item behind one link, whole.
function readSourceDocument(source: SourceLink): SourceDocument | null {
  if (source.kind === 'plan') {
    const plan = planById(Number(source.ref))
    if (!plan) return null
    const title = planHeading(plan.text)
    // The heading is the dialog's own title, so it is not drawn twice.
    const text = title ? plan.text.replace(/^\s*#\s+.*\n?/, '') : plan.text
    return { title, text: text.trim(), url: '' }
  }
  if (source.kind !== 'triage') return null
  const item = everyItem().find((signal) => signal.sourceId === source.ref)
  return item ? { title: item.title, text: item.summary, url: item.url } : null
}

/** What one of a card's links opens (#1306). The card names the document: a kind and ref
 *  the card does not carry reads nothing, so no caller's path is ever opened. */
export function readCardSource(cardId: number, kind: string, ref: string): SourceDocument | null {
  const found = locate(cardId) ?? locateArchived(cardId)
  if (!found) return null
  try {
    const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
    const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
    const source = meta && cardSources(meta, body).find((one) => one.kind === kind && one.ref === ref)
    return source ? readSourceDocument(source) : null
  } catch {
    return null
  }
}
