// A triage item as a board file (#2107), as akb keeps one (cli/src/lib/signals/inbox.ts): where it
// sits is its state, its fields are frontmatter and its words the body. Shared by the Worker and
// the Runner.

import { unquote, yamlScalar } from '../../cli/src/lib/yaml.ts'

export type TriageState = 'open' | 'dismissed' | 'carded'

const ITEM = /^triage\/(?:(dismissed|archived)\/)?([^/]+)\.md$/

/** An item's state and file name by its path in the project's board; null for any other file. */
export function itemAt(path: string): { state: TriageState; name: string } | null {
  const m = ITEM.exec(path)
  if (!m) return null
  return { state: m[1] === 'dismissed' ? 'dismissed' : m[1] === 'archived' ? 'carded' : 'open', name: m[2]! }
}

export const itemPath = (state: TriageState, name: string) =>
  state === 'open' ? `triage/${name}.md` : `triage/${state === 'dismissed' ? 'dismissed' : 'archived'}/${name}.md`

/** Every path one item may sit at. */
export const itemPaths = (name: string) => (['open', 'dismissed', 'carded'] as const).map((s) => itemPath(s, name))

/** An item's id: its project and its file name, which a move never changes. */
export const triageId = (project: string, name: string) => `tri_${project.replace(/^prj_/, '')}_${name}`

export function ofTriageId(id: unknown): { project: string; name: string } | null {
  const m = typeof id === 'string' ? /^tri_([0-9a-z]+)_([^/\\\s]{1,200})$/.exec(id) : null
  return m ? { project: `prj_${m[1]}`, name: m[2]! } : null
}

export interface ItemFile {
  fields: Record<string, string>
  body: string
}

/** The fields and words of an item file; null for a file that is not one. */
export function readItemFile(content: string): ItemFile | null {
  const lines = content.split('\n')
  if (lines[0]?.trim() !== '---') return null
  const close = lines.indexOf('---', 1)
  if (close < 0) return null
  const fields: Record<string, string> = {}
  for (const line of lines.slice(1, close)) {
    const m = /^([a-z_]+):\s*(.*)$/.exec(line)
    if (m) fields[m[1]!] = unquote(m[2]!).trim()
  }
  return { fields, body: lines.slice(close + 1).join('\n').trim() }
}

export function itemFileText(fields: Record<string, string>, body: string): string {
  return `${['---', ...Object.entries(fields).map(([k, v]) => `${k}: ${yamlScalar(v)}`), '---'].join('\n')}\n\n${body.trim()}\n`
}

/** Fields added, replaced or (with null) removed, everything else as it was written. */
export function stampItem(content: string, fields: Record<string, string | null>): string {
  const lines = content.split('\n')
  const close = lines.indexOf('---', 1)
  if (close < 0) return content
  const kept = lines.slice(1, close).filter((line) => {
    const key = /^([a-z_]+):/.exec(line)
    return !key || fields[key[1]!] === undefined
  })
  const added = Object.entries(fields).flatMap(([k, v]) => (v === null ? [] : [`${k}: ${yamlScalar(v)}`]))
  return ['---', ...kept, ...added, ...lines.slice(close)].join('\n')
}

const pad = (n: number) => String(n).padStart(2, '0')

/** akb's stamp, `YYYY-MM-DD HH:MM`, in UTC. */
export const stampOf = (d: Date) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`

/** A stamp as an instant; a stamp with no zone is read as UTC. Null for none. */
export function stampTime(stamp: string | undefined): number | null {
  if (!stamp) return null
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(:\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(stamp.trim())
  if (!m) return null
  const at = Date.parse(`${m[1]}T${m[2]}${m[3] ?? ':00'}${m[4] ?? 'Z'}`)
  return Number.isNaN(at) ? null : at
}

/** An akb workflow name as Cloud's id: a built-in's (`coding` → `wf_builtin_coding`), or a
 *  workspace's own by its folder (`wf-0190ab` → `wf_0190ab`). */
export const cloudWorkflowOf = (name: string) =>
  /^wf-/.test(name) ? name.replace('-', '_') : `wf_builtin_${name.replace(/-/g, '_')}`

/** A free file name for an item, from its title: akb's slug, numbered past one taken. */
export function itemName(title: string, taken: (name: string) => boolean): string {
  const stem = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 56).replace(/-+$/, '') || 'item'
  let name = stem
  for (let n = 2; taken(name); n++) name = `${stem}-${n}`
  return name
}
