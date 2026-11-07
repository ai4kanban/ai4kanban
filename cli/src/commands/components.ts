import { agentComponents, workflowComponents, componentDocsText } from '../lib/components'
import { say } from '../lib/io'
import { die } from '../lib/paths'
import type { MoveResult } from '../lib/types'

export function cmdComponents(opts: { agent?: string; workflow?: string; docs?: boolean }): MoveResult {
  if (!!opts.agent === !!opts.workflow) die('choose exactly one of --agent or --workflow', { kind: 'invalid-usage' })
  const docs = opts.agent ? agentComponents([opts.agent]) : workflowComponents(opts.workflow!)
  say(docs.map((doc) => doc.name).join('\n') || '(none)')
  if (opts.docs && docs.length) say(`\n${componentDocsText(docs)}`)
  return { components: docs.map((doc) => doc.name), ...(opts.docs ? { docs } : {}) }
}
