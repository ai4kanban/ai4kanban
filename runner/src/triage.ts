// The rejection review's files (#2067). Triage items are board files, synced with the board
// (#2107); before a task is planned, the synced `dismissed/` and `archived/` are moved aside and
// only the rejections and dismissals Cloud has not learned are laid out, as akb keeps them, for
// `akb review-dismissals`.

import fs from 'node:fs'
import path from 'node:path'

import { formatStamp } from '../../cli/src/lib/cadence'
import { derivedSourceId } from '../../cli/src/lib/signals/identity'
import { yamlScalar } from '../../cli/src/lib/yaml'
import { slugify } from '../../cli/src/lib/slug'
import { workflowName } from '../../cloud/src/board-files.ts'
import * as api from './api'

const triageDir = (board: string) => path.join(board, 'triage')
/** Where the review's rejected tasks go: under `.archive/`, where akb reads them, in a folder no sync keeps. */
const rejectedDir = (board: string) => path.join(board, '.archive', '.sync')
const SCRATCH = ['dismissed', 'archived']

const stamp = (at: string | null) => formatStamp(at ? new Date(at) : new Date())

function slugOf(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 56).replace(/-+$/, '') || 'item'
}

function freeName(dir: string, title: string): string {
  const stem = slugOf(title)
  let name = `${stem}.md`
  for (let n = 2; fs.existsSync(path.join(dir, name)); n++) name = `${stem}-${n}.md`
  return name
}

/** One item as akb writes it; its source id is the one `akb triage add` derives from its words. */
function itemText(item: api.Triage, fields: Record<string, string> = {}): string {
  const lines = [
    '---',
    `source_id: ${yamlScalar(derivedSourceId(`${item.title}\n${item.text.trim()}`))}`,
    `title: ${yamlScalar(item.title)}`,
    `collected_at: ${yamlScalar(stamp(item.created_at))}`,
    `imported_at: ${yamlScalar(stamp(item.created_at))}`,
    ...Object.entries(fields).map(([k, v]) => `${k}: ${yamlScalar(v)}`),
    '---',
  ]
  return `${lines.join('\n')}\n\n${item.text.trim()}\n`
}

function writeItem(dir: string, item: api.Triage, fields: Record<string, string> = {}): string {
  fs.mkdirSync(dir, { recursive: true })
  const name = freeName(dir, item.title)
  fs.writeFileSync(path.join(dir, name), itemText(item, item.workflow ? { workflow: workflowName(item.workflow), ...fields } : fields))
  return name
}

/** What a review was handed, to mark learned once it is sent back. */
export interface Laid {
  tasks: string[]
  triage: string[]
}

/** The rejections and dismissals laid out as akb keeps them: a rejected task as an archived card,
 *  a dismissal in `triage/dismissed/`, a restored item in `triage/archived/`. */
export function layOut(board: string, rejections: { tasks: api.Rejection[]; triage: api.Triage[] }): Laid {
  clearLaid(board)
  const dir = rejectedDir(board)
  fs.mkdirSync(dir, { recursive: true })
  for (const t of rejections.tasks) {
    fs.writeFileSync(path.join(dir, `${t.number}-${slugify(t.title)}.md`), [
      '---', `title: ${yamlScalar(t.title)}`, 'status: todo', 'rejected: true', `rejected_reason: ${yamlScalar(t.reason)}`,
      `rejected_at: ${yamlScalar(stamp(t.cancelled_at))}`, 'rejected_by: user', '---', '', t.request.trim(), '',
    ].join('\n'))
  }
  for (const item of rejections.triage) {
    const sub = path.join(triageDir(board), item.state === 'dismissed' ? 'dismissed' : 'archived')
    const fields: Record<string, string> = item.state === 'dismissed'
      ? { dismissed_at: stamp(item.dismissed_at), dismissed_by: 'user', ...(item.dismissed_reason ? { dismissed_reason: item.dismissed_reason } : {}) }
      : {}
    writeItem(sub, item, fields)
  }
  return { tasks: rejections.tasks.map((t) => t.id), triage: rejections.triage.map((i) => i.id) }
}

/** Never sent back: none of it is the project's. The synced folders come back from the base. */
export function clearLaid(board: string): void {
  fs.rmSync(rejectedDir(board), { recursive: true, force: true })
  for (const sub of SCRATCH) fs.rmSync(path.join(triageDir(board), sub), { recursive: true, force: true })
}
