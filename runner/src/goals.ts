// 读取新旧协议；临时文件沿用 ideas 字段，供旧 CLI 原地编辑。
import fs from 'node:fs'
import path from 'node:path'
import type * as api from './api'
import type { Goal, Job } from './api'
import { runnerHome } from './home'

export function goalsOf<T>(held: { goals?: T[]; ideas?: T[] }): T[] {
  if (held.goals !== undefined && held.ideas !== undefined && JSON.stringify(held.goals) !== JSON.stringify(held.ideas)) throw new Error('goals and ideas do not match.')
  const goals = held.goals ?? held.ideas
  if (!Array.isArray(goals)) throw new Error('The goals array is missing or invalid.')
  return goals
}

export const goalsFileOf = (job: Pick<Job, 'id'>) => path.join(runnerHome(), 'ideas', `${job.id}.json`)

export async function writeGoals(job: Job & { discussion: NonNullable<Job['discussion']> }, list: typeof api.listWorkflows): Promise<{ file: string } | { error: string }> {
  let goals: Goal[]
  try { goals = goalsOf(job.discussion) } catch (e) { return { error: String(e) } }
  const workflows: api.Workflow[] = []
  let after: string | null = null
  do {
    const page = await list(job.discussion.workspace, after)
    if (!page.ok) return { error: page.error }
    for (const w of page.value.data) workflows.push({ ...w, id: w.id, name: w.names ? `${w.names.en} / ${w.names.zh}` : w.name, ...(w.description ? { description: w.description } : {}) })
    after = page.value.next
  } while (after)
  const file = goalsFileOf(job)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify({ workspace: job.discussion.workspace, workflows, ideas: goals }, null, 2)}\n`)
  return { file }
}

export function readGoals(file: string): Goal[] | undefined {
  try { return goalsOf(JSON.parse(fs.readFileSync(file, 'utf8'))) }
  catch { return undefined }
  finally { fs.rmSync(file, { force: true }) }
}
