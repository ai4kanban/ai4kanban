import fs from 'node:fs'
import path from 'node:path'

import { MEMORY, rel } from '../paths'
import { solution } from '../solution'
import type { AgentRequest, RunRecord, WritingVerification } from './types'

export const MAX_WRITING_PASSES = 3

/** Shared writing.md is additional to each reader's six-file allowance. */
export function writingVerification(pass = 1): WritingVerification {
  const files: string[] = []
  const visit = (dir: string): void => {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, entry.name)
      if (entry.isDirectory()) visit(file)
      else if (entry.isFile() && entry.name.endsWith('.md')) files.push(rel(file))
    }
  }
  visit(path.join(MEMORY, 'writing'))
  const groups: string[][] = Array.from({ length: Math.max(1, Math.ceil(files.length / 6)) }, () => [])
  files.forEach((file, i) => groups[i % groups.length].push(file))
  return { pass, groups, index: 0, reports: [] }
}

export function readVerification(raw: unknown): WritingVerification | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const v = raw as WritingVerification
  if (!Number.isInteger(v.pass) || v.pass < 1 || v.pass > MAX_WRITING_PASSES
    || !Array.isArray(v.groups) || !v.groups.length
    || !v.groups.every((group) => Array.isArray(group) && group.length <= 6 && group.every((file) => typeof file === 'string'))
    || !Number.isInteger(v.index) || v.index < 0 || v.index >= v.groups.length
    || !Array.isArray(v.reports) || !v.reports.every((report) => typeof report === 'string')) return undefined
  return v
}

/** Readers run in separate sessions; the last reader hands their merged report to the writer. */
export function afterWritingVerification(run: RunRecord): { next?: AgentRequest; report?: string } {
  const v = run.verification
  if (solution() !== 'marketing' || !v || run.cardId === null || !run.channel) return {}
  if (run.status !== 'done' && run.status !== 'error') return {}
  const base = { id: run.cardId, channel: run.channel, flowId: run.flowId ?? run.sessionId }
  if (run.action === 'marketing-fix') {
    if (run.status !== 'done' || v.pass >= MAX_WRITING_PASSES) return {}
    return { next: { ...base, action: 'marketing-verify', verification: writingVerification(v.pass + 1) } }
  }
  if (run.action !== 'marketing-verify') return {}
  const result = run.result?.trim()
  const reports = [...v.reports, ...(result && result !== 'PASS' ? [result] : [])]
  if (v.index + 1 < v.groups.length) {
    return { next: { ...base, action: 'marketing-verify', verification: { ...v, index: v.index + 1, reports } } }
  }
  const report = reports.join('\n\n') || undefined
  if (!report || v.pass >= MAX_WRITING_PASSES) return { report }
  return {
    report,
    next: { ...base, action: 'marketing-fix', notes: report, verification: { ...v, reports: [] } },
  }
}
