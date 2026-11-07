import asset from '../components/Asset.md'
import compare from '../components/Compare.md'
import storyboard from '../components/Storyboard.md'
import workflow from '../components/Workflow.md'
import { findSpecAgent } from './agents'
import { BoardError } from './io'
import { boardText } from './paths'
import { workflowById, previewMembers, scheduledMembers } from './agent/workflows'

const DOCUMENTS: Record<string, string> = { Asset: asset, Compare: compare, Storyboard: storyboard, Workflow: workflow }

export interface ComponentDoc {
  name: string
  text: string
}

export function agentComponents(
  names: string[],
  documents: Readonly<Record<string, string>> = DOCUMENTS,
): ComponentDoc[] {
  const docs = new Map<string, ComponentDoc>()
  for (const name of new Set(names)) {
    const agent = findSpecAgent(name)
    if (!agent) throw new BoardError(`no agent called "${name}"`, { kind: 'unknown-agent', agent: name })
    for (const component of agent.components) {
      const text = Object.hasOwn(documents, component) ? documents[component] : undefined
      if (!text?.trim()) {
        throw new BoardError(`agent "${name}": unknown component or missing documentation for "${component}"`, {
          kind: 'component-documentation-missing', agent: name, component,
        })
      }
      docs.set(component, { name: component, text: boardText(text) })
    }
  }
  return [...docs.values()]
}

export function workflowComponents(id: string): ComponentDoc[] {
  const flow = workflowById(id)
  if (!flow) throw new BoardError(`no workflow called "${id}"`, { kind: 'unknown-workflow', workflow: id })
  const members = [...previewMembers(flow), ...flow.land, ...scheduledMembers(flow)].map((row) => row.agent)
  return agentComponents(members)
}

export const componentDocsText = (docs: ComponentDoc[]): string => docs.map((doc) => doc.text.trim()).join('\n\n')
