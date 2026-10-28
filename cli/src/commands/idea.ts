// The ideas of a WildCrane idea conversation (#2073). The Runner hands a discussion job a file
// holding the conversation's ideas and the workspace's installed workflows (`KANBAN_IDEAS`);
// these moves edit it, and the Runner reports it back to Cloud when the job ends.

import fs from 'node:fs'

import { say } from '../lib/io'
import { die } from '../lib/paths'
import type { MoveResult } from '../lib/types'

export interface IdeaOptions {
  id?: string
  title?: string
  bodyFile?: string
  workflow?: string
}

export interface IdeaWorkflow {
  id: string
  name: string
  description?: string
}

export interface Idea {
  id: string
  title: string
  outcome: string
  acceptance: string[]
  workflow: string
  task?: string | null
  start?: boolean
  dropped?: boolean
}

interface IdeasFile {
  workflows: IdeaWorkflow[]
  ideas: Idea[]
}

const MAX_IDEAS = 10
const DEFAULT_WORKFLOW = 'wf_builtin_coding'

export const ideasFile = (): string | null => process.env.KANBAN_IDEAS || null

function load(): { file: string; held: IdeasFile } {
  const file = ideasFile()
  if (!file) die('Ideas exist only inside a WildCrane idea conversation.')
  const held = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<IdeasFile>
  return { file, held: { workflows: held.workflows ?? [], ideas: held.ideas ?? [] } }
}

/** A built-in's short name, as `akb workflow list` shows it: `wf_builtin_slide_deck` → `slide-deck`. */
export const shortWorkflowId = (id: string) =>
  id.startsWith('wf_builtin_') ? id.slice('wf_builtin_'.length).replace(/_/g, '-') : id

function workflowOf(held: IdeasFile, asked: string): string {
  const wanted = asked.trim()
  const found = held.workflows.find((w) => w.id === wanted || shortWorkflowId(w.id) === wanted)
  if (!found) die(`No workflow \`${wanted}\` here. It has: ${held.workflows.map((w) => shortWorkflowId(w.id)).join(', ')}.`)
  return found.id
}

const fallbackWorkflow = (held: IdeasFile) =>
  held.workflows.find((w) => w.id === DEFAULT_WORKFLOW)?.id ?? held.workflows[0]?.id ?? DEFAULT_WORKFLOW

/** The body split as Cloud keeps it: `## Done when` items are the acceptance, the rest the outcome. */
export function splitBody(text: string): { outcome: string; acceptance: string[] } {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const at = lines.findIndex((l) => /^##\s+done when\s*$/i.test(l.trim()))
  if (at < 0) return { outcome: text.trim(), acceptance: [] }
  const rest = lines.slice(at + 1)
  const end = rest.findIndex((l) => /^#{1,2}\s/.test(l))
  const section = end < 0 ? rest : rest.slice(0, end)
  const acceptance = section.map((l) => l.trim().replace(/^([-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?/, '').trim()).filter(Boolean)
  const outcome = [...lines.slice(0, at), ...(end < 0 ? [] : rest.slice(end))].join('\n').trim()
  return { outcome, acceptance }
}

function readBody(bodyFile: string | undefined): { outcome: string; acceptance: string[] } {
  if (!bodyFile) die('--body-file is required; write the idea in a writable temporary file first.')
  const text = fs.readFileSync(bodyFile, 'utf8')
  if (!text.trim()) die('The idea must not be empty.')
  return splitBody(text)
}

const open = (idea: Idea) => !idea.dropped && !idea.task

function named(held: IdeasFile, id: string | undefined): Idea {
  const idea = held.ideas.find((i) => i.id === id?.trim() && !i.dropped)
  if (!idea) die(`--id must name an idea of this conversation: ${held.ideas.filter((i) => !i.dropped).map((i) => i.id).join(', ') || 'none yet'}.`)
  return idea
}

export function cmdIdea(args: string[], opts: IdeaOptions): MoveResult {
  const sub = args[0] ?? ''
  const { file, held } = load()
  const write = () => fs.writeFileSync(file, `${JSON.stringify(held, null, 2)}\n`)

  if (sub === 'new') {
    const title = opts.title?.trim()
    if (!title) die('--title must not be empty')
    if (held.ideas.filter(open).length >= MAX_IDEAS) die(`A conversation holds at most ${MAX_IDEAS} ideas; drop one first.`)
    const body = readBody(opts.bodyFile)
    const workflow = opts.workflow ? workflowOf(held, opts.workflow) : fallbackWorkflow(held)
    const id = `new_${held.ideas.filter((i) => i.id.startsWith('new_')).length + 1}`
    held.ideas.push({ id, title, ...body, workflow, task: null })
    write()
    say(`Saved idea ${id}: ${title} (${shortWorkflowId(workflow)}).`)
    return { id, title, workflow }
  }

  const idea = named(held, opts.id)
  if (idea.task) die(`${idea.id} is already a task; it no longer changes here.`)
  if (sub === 'save') {
    if (opts.title !== undefined) {
      if (!opts.title.trim()) die('--title must not be empty')
      idea.title = opts.title.trim()
    }
    if (opts.bodyFile !== undefined) Object.assign(idea, readBody(opts.bodyFile))
    if (opts.workflow !== undefined) idea.workflow = workflowOf(held, opts.workflow)
    write()
    say(`Saved idea ${idea.id}: ${idea.title} (${shortWorkflowId(idea.workflow)}).`)
    return { id: idea.id, title: idea.title, workflow: idea.workflow }
  }
  if (sub === 'drop') {
    idea.dropped = true
    write()
    say(`Dropped idea ${idea.id}.`)
    return { id: idea.id, dropped: true }
  }
  if (sub === 'start') {
    idea.start = true
    write()
    say(`Idea ${idea.id} starts as a task when this turn ends.`)
    return { id: idea.id, start: true }
  }
  die('Use idea new, save, drop or start.')
}

/** `akb workflow list` inside an idea conversation: the workspace's installed workflows. */
export function cmdIdeaWorkflows(): MoveResult {
  const { held } = load()
  for (const w of held.workflows) {
    say(`${shortWorkflowId(w.id)}  ${w.name}`)
    if (w.description && w.description !== w.name) say(`  ${w.description}`)
  }
  return { workflows: held.workflows.map((w) => ({ ...w, id: shortWorkflowId(w.id) })) }
}
