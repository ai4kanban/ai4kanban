// ---- README index entries --------------------------------------------------
//
// The board index at docs/kanban/todo/README.md: adding a card's bullet, stripping
// it when the card leaves, and repointing a link after a rename.

import fs from 'node:fs'
import path from 'node:path'

import { README } from './paths'
import type { Found } from './types'

const isTableRow = (line: string): boolean => /^\s*\|/.test(line)
const isBulletStart = (line: string): boolean => /^\s*[-*] /.test(line)
const bulletIndent = (line: string): number => line.match(/^(\s*)/)![1]!.length

// Removes every README entry that LINKS the task's own path. Cross-mentions of the id
// as bare `#id` text in other cards' prose carry no link, so they are left untouched.
// A single-line bullet or table row drops on its own; a multi-line group bullet drops
// with its wrapped continuation lines.
export function stripReadmeRefs(target: Pick<Found, 'kind' | 'rel'>): string[] {
  if (!fs.existsSync(README)) return []
  const needle = target.kind === 'group' ? `](${target.rel}/` : `](${target.rel})`
  const lines = fs.readFileSync(README, 'utf8').split('\n')
  const out: string[] = []
  const removed: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    if (line.includes(needle) && (isTableRow(line) || isBulletStart(line))) {
      removed.push(line.trim())
      if (isBulletStart(line)) {
        const indent = bulletIndent(line)
        i++
        // consume wrapped continuation lines (indented deeper, not a new bullet)
        while (
          i < lines.length &&
          lines[i]!.trim() !== '' &&
          !isBulletStart(lines[i]!) &&
          !/^\s*#/.test(lines[i]!) &&
          !isTableRow(lines[i]!) &&
          bulletIndent(lines[i]!) > indent
        ) {
          i++
        }
      } else {
        i++ // table row
      }
      continue
    }
    out.push(line)
    i++
  }
  if (removed.length) fs.writeFileSync(README, out.join('\n'))
  return removed
}

/** The one section every card is indexed under — `todo/` is flat, so the index is too. */
export const TASKS_HEADING = 'Tasks'

// Insert a card's bullet under the index heading, replacing a `_(none)_` placeholder
// or appending after the section's last bullet. Adds the section if it's missing.
export function addReadmeRef(id: number, title: string, relPath: string): boolean {
  if (!fs.existsSync(README)) return false
  const link = relPath.split(path.sep).join('/')
  const bullet = `- [#${id} ${title}](${link})`
  const heading = `## ${TASKS_HEADING}`
  let lines = fs.readFileSync(README, 'utf8').split('\n')
  const hi = lines.findIndex((l) => l.trim().toLowerCase() === heading.toLowerCase())
  if (hi === -1) {
    while (lines.length && lines[lines.length - 1]!.trim() === '') lines.pop()
    lines.push('', heading, '', bullet)
    fs.writeFileSync(README, lines.join('\n') + '\n')
    return true
  }
  let end = hi + 1
  while (end < lines.length && !/^##\s/.test(lines[end]!)) end++
  const noneRel = lines.slice(hi + 1, end).findIndex((l) => l.trim() === '_(none)_')
  if (noneRel !== -1) {
    lines[hi + 1 + noneRel] = bullet
  } else {
    let lastBullet = -1
    for (let k = hi + 1; k < end; k++) if (/^\s*-\s/.test(lines[k]!)) lastBullet = k
    const at = lastBullet !== -1 ? lastBullet + 1 : lines[hi + 1] === '' ? hi + 2 : hi + 1
    lines.splice(at, 0, bullet)
  }
  fs.writeFileSync(README, lines.join('\n'))
  return true
}

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Fix a README link to task #id in place, after a subtask rename or retitle. A
// subtask's only README line is the nested bullet under its group root, so the
// bullet keeps its position — only the link text and target change. No-op when
// the README doesn't link the card.
export function repointReadmeLink(id: number, oldRel: string, newRel: string, title: string): boolean {
  if (!fs.existsSync(README)) return false
  const oldLink = oldRel.split(path.sep).join('/')
  const newLink = newRel.split(path.sep).join('/')
  const linkRe = new RegExp(`\\[#${id}\\b[^\\]]*\\]\\(${escapeRegex(oldLink)}\\)`)
  const lines = fs.readFileSync(README, 'utf8').split('\n')
  let changed = false
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]!.includes(`](${oldLink})`)) continue
    const next = linkRe.test(lines[i]!)
      ? lines[i]!.replace(linkRe, () => `[#${id} ${title}](${newLink})`)
      : lines[i]!.split(`](${oldLink})`).join(`](${newLink})`)
    if (next !== lines[i]) {
      lines[i] = next
      changed = true
    }
  }
  if (changed) fs.writeFileSync(README, lines.join('\n'))
  return changed
}
