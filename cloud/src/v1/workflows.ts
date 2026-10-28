/**
 * Built-in workflows (#2040): packed from cli/src at build time (scripts/builtin-workflows.mjs),
 * read-only, listed before an account's own. Ids start `wf_builtin_`. A version is numbered
 * by the database the first time its files are used.
 */

import { notFound } from '../errors.ts'
import builtins from './builtin-workflows.json' with { type: 'json' }
import type { WorkflowFiles } from './workflow-files.ts'

export interface BuiltinWorkflow {
  id: string
  name: string
  names: { en: string; zh: string }
  description: string
  lands: boolean
  /** What tells one version of its files from another. */
  hash: string
  files: WorkflowFiles
}

export const BUILTIN_WORKFLOWS = builtins as unknown as BuiltinWorkflow[]

export const isBuiltin = (id: string) => id.startsWith('wf_builtin_')

export const builtinWorkflow = (id: string) => BUILTIN_WORKFLOWS.find((w) => w.id === id)

export const builtinJson = ({ id, name, names, description }: BuiltinWorkflow, version: number) =>
  ({ id, object: 'workflow', builtin: true, name, names, description, version })

/** What a task is made on: a built-in's files, recorded as a version the first time they are
 *  used, or the id of the account's own, whose current version the database reads. */
export function workflowFor(wf: string): Record<string, unknown> {
  const builtin = builtinWorkflow(wf)
  if (builtin) return { ...builtin, builtin: true }
  if (isBuiltin(wf)) throw notFound('No workflow has this id.')
  return { id: wf, builtin: false }
}
