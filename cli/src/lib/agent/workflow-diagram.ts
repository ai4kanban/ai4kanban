// A workflow drawn as rounds of previews, each waiting on an approval, then what lands it and
// what runs on a schedule (#451). No file access: akb and the Cloud Worker share it.

import type { AgentIcon } from '../agents/icon.ts'
import type { SpecAgent } from '../agents/parse.ts'
import { stagesOf, type WorkflowDef } from './workflow-def.ts'

export interface DiagramStep {
  agent: string
  title: { en: string; zh: string }
  icon?: AgentIcon
  /** Planning picks it per card (`akb.when`). */
  optional?: true
}

export interface WorkflowDiagram {
  version: 1
  rounds: DiagramStep[][]
  land: DiagramStep[]
  scheduled: (DiagramStep & { cadence?: string })[]
}

type Agent = Pick<SpecAgent, 'after' | 'i18n'> & Partial<Pick<SpecAgent, 'when' | 'icon'>>

export function workflowDiagram(def: Pick<WorkflowDef, 'previews' | 'land' | 'scheduled'>, agentOf: (name: string) => Agent | null): WorkflowDiagram {
  const step = (name: string): DiagramStep => {
    const agent = agentOf(name)
    const en = agent?.i18n.en?.title || name
    return {
      agent: name,
      title: { en, zh: agent?.i18n.zh?.title || en },
      ...(agent?.icon ? { icon: agent.icon } : {}),
      ...(agent?.when ? { optional: true as const } : {}),
    }
  }
  const previews = def.previews.filter((h) => !h.off).map((h) => h.agent)
  const after = (name: string) => (agentOf(name)?.after ?? []).filter((other) => previews.includes(other))
  return {
    version: 1,
    rounds: stagesOf(previews, after).map((round) => round.map(step)),
    land: def.land.filter((h) => !h.off).map((h) => step(h.agent)),
    scheduled: def.scheduled.map((s) => ({ ...step(s.agent), ...(s.cadence ? { cadence: s.cadence } : {}) })),
  }
}
