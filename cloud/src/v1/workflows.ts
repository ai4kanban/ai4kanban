/**
 * Built-in workflows (#2000): shipped with the Worker, read-only, listed before an account's
 * own. Ids start `wf_builtin_`. The first is added by #2003.
 */

export interface WorkflowDefinition {
  id: string
  name: string
  description: string
  expertise: string
  checkpoints: { key: string; title: string; artifact_type: string | null; question: string; acceptance: string }[]
  memory: { project: { name: string; description: string }[]; user: { name: string; description: string }[] }
}

export const BUILTIN_WORKFLOWS: WorkflowDefinition[] = []

export const isBuiltin = (id: string) => id.startsWith('wf_builtin_')

export const builtinWorkflow = (id: string) => BUILTIN_WORKFLOWS.find((w) => w.id === id)

export const builtinJson = (w: WorkflowDefinition) => ({ ...w, object: 'workflow', builtin: true })
