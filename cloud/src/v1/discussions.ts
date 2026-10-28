/**
 * Ideas drafted in chat (#2073): a discussion's inputs, and starting an idea as a task. The rules
 * live in migrations/0074.
 */

import { call, mutate } from '../db.ts'
import type { Env } from '../env.ts'
import { badRequest, conflict, notFound } from '../errors.ts'
import { readLimits } from '../quota.ts'
import { placeWorkflow } from './board.ts'
import { idOf } from './http.ts'
import { chatInput } from './input.ts'
import { workflowFor } from './workflows.ts'

type Fields = Record<string, unknown>

/** `{ body, runtime? }`: one of the caller's runtime ids; a discussion has no task to follow. */
export function discussionChatInput(body: Fields) {
  if (body.runtime === 'task') throw badRequest('That is not a runtime id.')
  return chatInput(body)
}

export function discussionInput(body: Fields): Fields {
  const { p_body, p_runtime } = discussionChatInput(body)
  return Object.fromEntries(Object.entries({
    workspace: body.workspace == null ? undefined : idOf(body.workspace, 'ws', 'workspace'),
    project: body.project == null ? undefined : idOf(body.project, 'prj', 'project'),
    body: p_body,
    runtime: p_runtime ?? undefined,
  }).filter(([, v]) => v !== undefined))
}

/** `GET /v1/chats`'s `after`: a task or a discussion. */
export const chatCursor = (value: string | null) =>
  value ? idOf(value, value.startsWith('dsc_') ? 'dsc' : 'task', 'cursor') : null

/** `POST /v1/discussions/external`: `{ workspace?, project?, requestId, host? }`. */
export function externalDiscussionInput(body: Fields): Fields {
  if (typeof body.requestId !== 'string' || !body.requestId.trim() || body.requestId.length > 200) {
    throw badRequest('requestId must be a string of 1 to 200 characters.')
  }
  if (body.host != null && body.host !== 'claude-code' && body.host !== 'codex') throw badRequest('host must be claude-code or codex.')
  return Object.fromEntries(Object.entries({
    workspace: body.workspace == null ? undefined : idOf(body.workspace, 'ws', 'workspace'),
    project: body.project == null ? undefined : idOf(body.project, 'prj', 'project'),
    request_id: body.requestId.trim(),
    host: body.host ?? undefined,
  }).filter(([, v]) => v !== undefined))
}

/** `PUT …/draft`: `{ expectedVersion, ideas: [{ id?, title, outcome?, acceptance?, workflow? }] }`. */
export function draftInput(body: Fields): { p_expected_version: number; p_ideas: unknown[] } {
  if (!Number.isInteger(body.expectedVersion)) throw badRequest('expectedVersion must be an integer.')
  if (!Array.isArray(body.ideas)) throw badRequest('ideas must be an array.')
  return { p_expected_version: body.expectedVersion as number, p_ideas: body.ideas }
}

interface Discussion {
  workspace: string
  external?: boolean
  ideas: { id: string; workflow: string; task: { id: string } | null }[]
}

/** As `POST /v1/tasks` with `run: true`, on the idea's workflow, counted against the
 *  workspace's plan. A Claude Code discussion's start names the version it showed, and a retry
 *  answers the task the first one made. */
export async function startIdea(
  env: Env, account: string, discussion: string, idea: string, project: string | null, expectedVersion: number | null = null,
): Promise<{ id: string }> {
  const held = await call<Discussion>(env, 'v1_discussion', { p_account: account, p_id: discussion })
  const found = held.ideas.find((i) => i.id === idea)
  if (!found) throw notFound('No idea has this id.')
  if (found.task && held.external) return call<{ id: string }>(env, 'v1_task', { p_account: account, p_id: found.task.id })
  if (found.task) throw conflict('This idea has already been started.')
  const definition = workflowFor(found.workflow)
  const limits = await readLimits(env, await call<string>(env, 'v1_payer', { p_account: account, p_kind: 'target', p_id: held.workspace }))
  const task = await mutate<{ id: string }>(env, 'v1_start_idea', {
    p_account: account,
    p_discussion: discussion,
    p_idea: idea,
    p_project: project,
    p_workflow: definition,
    p_max_tasks: limits.tasks,
    p_expected_version: expectedVersion,
  })
  await placeWorkflow(env, account, task.id)
  return task
}
