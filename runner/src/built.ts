// A Workflow builder task (#2004): the workflow it writes is `workflows/<draft>/` on the task's
// board, with its agents inside, and a job finds the agents in the board's `agents/`, where akb
// reads them. The card's first job places the draft — a new one with a name and no agents,
// a change as the workflow is now. After every job its agents go back into the folder, akb's
// checks run, and the files go to Cloud with the report, which the approval saves.

import fs from 'node:fs'
import path from 'node:path'

import { BUILDER, draftFolder } from '../../cli/src/lib/shared/board-files.ts'
import { WORKFLOW_FILE, checkWorkflowFiles, type WorkflowFiles } from '../../cli/src/lib/shared/workflow-files.ts'
import { parseWorkflowFile, type WorkflowDef } from '../../cli/src/lib/agent/workflow-def'
import { yamlScalar } from '../../cli/src/lib/yaml'
import type * as api from './api'
import { answerOf, runAkb, type Akb } from './akb'
import { filesUnder, type TaskFolder } from './task-folder'

export const isBuilder = (ws: Pick<TaskFolder, 'workflow'>) => ws.workflow === BUILDER

const draftDir = (ws: TaskFolder) => path.join(ws.board, 'workflows', draftFolder(ws.task))

/** The line the card names its workflow folder with, for the agent alone. */
export const draftLine = (ws: TaskFolder) =>
  `<!-- workflow folder: ${path.relative(ws.cwd, draftDir(ws)).split(path.sep).join('/')}/ -->`

const skeleton = (name: string) =>
  ['---', `name: ${/\s#/.test(name) ? JSON.stringify(name) : yamlScalar(name)}`, 'needsArtifact: false', '---', ''].join('\n')

export async function placeDraft(ws: TaskFolder, read: Pick<typeof api, 'readTask' | 'readWorkflow'>): Promise<api.Call<void>> {
  const dir = draftDir(ws)
  if (fs.existsSync(path.join(dir, WORKFLOW_FILE))) return { ok: true, value: undefined }
  const task = await read.readTask(ws.task)
  if (!task.ok) return task
  let files: WorkflowFiles = { [WORKFLOW_FILE]: skeleton(task.value.title.trim() || 'Untitled') }
  const changes = task.value.context?.workflow
  if (changes) {
    const held = await read.readWorkflow(changes)
    if (!held.ok) return held
    files = held.value.files
  }
  for (const [name, text] of Object.entries(files)) {
    const file = path.resolve(dir, name)
    if (!file.startsWith(dir + path.sep)) continue
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, text)
  }
  return { ok: true, value: undefined }
}

/** Everyone the workflow names. */
const named = (def: WorkflowDef) => [...new Set([...def.previews, ...def.land, ...def.scheduled].map((h) => h.agent))]

export type Built = { ok: true; files: WorkflowFiles } | { ok: false; reason: string }

/** The draft as it stands, with its agents, once akb finds nothing wrong with it; null for any
 *  other task. */
export async function builtWorkflow(ws: TaskFolder, akb: Akb): Promise<Built | null> {
  if (!isBuilder(ws)) return null
  const fail = (problem: string): Built => ({ ok: false, reason: `The workflow has a problem: ${problem}` })
  const id = draftFolder(ws.task)
  const dir = draftDir(ws)
  let source: string
  try {
    source = fs.readFileSync(path.join(dir, WORKFLOW_FILE), 'utf8')
  } catch {
    return fail(`workflows/${id}/${WORKFLOW_FILE} is missing.`)
  }
  const read = parseWorkflowFile(id, source, `workflows/${id}/${WORKFLOW_FILE}`)
  if ('problem' in read) return fail(read.problem)
  const names = named(read.def)
  const run = async <T>(args: string[]) =>
    answerOf<T>(await runAkb(akb, [...args, '--json', '--board', ws.board], { cwd: ws.cwd, board: ws.board }))
  // Each agent from the board's `agents/`, else the copy the draft came with, else the board's
  // built-in one (an official agent such as `builder`).
  const agents = path.join(dir, 'agents')
  for (const old of fs.existsSync(agents) ? fs.readdirSync(agents) : []) {
    if (!names.includes(old)) fs.rmSync(path.join(agents, old), { recursive: true, force: true })
  }
  for (const name of names) {
    const from = path.join(ws.board, 'agents', name)
    const to = path.join(agents, name)
    if (fs.existsSync(from)) {
      fs.rmSync(to, { recursive: true, force: true })
      fs.cpSync(from, to, { recursive: true })
    } else if (!fs.existsSync(path.join(to, 'AGENT.md'))) {
      const own = await run<{ text?: string }>(['raw', 'agent-file', name, 'AGENT.md'])
      if (own?.text) {
        fs.mkdirSync(to, { recursive: true })
        fs.writeFileSync(path.join(to, 'AGENT.md'), own.text)
      }
    }
  }
  const files = Object.fromEntries(filesUnder(dir).map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')]))
  const checked = checkWorkflowFiles(files)
  if (!checked.ok) return fail(`${checked.file} ${checked.reason}.`)

  const list = await run<{ workflows?: { id: string; problems?: string[] }[]; problems?: string[] }>(['workflow', 'list'])
  const spec = await run<{ problems?: string[] }>(['previews'])
  if (!list?.workflows || !spec) return fail('akb could not check it.')
  const problems = [
    ...(list.workflows.find((w) => w.id === id)?.problems ?? []),
    ...(list.problems ?? []).filter((p) => p.includes(`workflows/${id}/`)),
    ...(spec.problems ?? []).filter((p) => names.some((n) => p.includes(`agents/${n}/`))),
  ]
  return problems.length ? fail(problems.join(' ')) : { ok: true, files }
}
