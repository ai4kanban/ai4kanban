// An idea conversation's reply (#2073): the conversation's ideas and the workspace's installed
// workflows go in a file the agent's `akb raw idea` and `akb workflow list` read
// (`KANBAN_IDEAS`), and what the reply left there goes back in its report.

import fs from 'node:fs'
import path from 'node:path'

import type * as api from './api'
import type { Idea, Job } from './api'
import { runnerHome } from './home'

export const ideasFileOf = (job: Pick<Job, 'id'>) => path.join(runnerHome(), 'ideas', `${job.id}.json`)

/** Write the file for this job; an error when the workspace's workflows could not be read. */
export async function writeIdeas(
  job: Job & { discussion: NonNullable<Job['discussion']> },
  list: typeof api.listWorkflows,
): Promise<{ file: string } | { error: string }> {
  const workflows: { id: string; name: string; description?: string }[] = []
  let after: string | null = null
  do {
    const page = await list(job.discussion.workspace, after)
    if (!page.ok) return { error: page.error }
    for (const w of page.value.data) workflows.push({ id: w.id, name: w.names ? `${w.names.en} / ${w.names.zh}` : w.name, ...(w.description ? { description: w.description } : {}) })
    after = page.value.next
  } while (after)
  const file = ideasFileOf(job)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify({ workflows, ideas: job.discussion.ideas }, null, 2)}\n`)
  return { file }
}

/** Every idea as the reply left it, and the file gone. */
export function readIdeas(file: string): Idea[] | undefined {
  try {
    return (JSON.parse(fs.readFileSync(file, 'utf8')) as { ideas?: Idea[] }).ideas
  } catch {
    return undefined
  } finally {
    fs.rmSync(file, { force: true })
  }
}
