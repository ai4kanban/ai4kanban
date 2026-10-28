// The built-in product video workflow (#822, #1057, #2154): the script and rehearsal, then the
// film, each approved, then its cover as it lands; and the `<board-state>` path constant.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { useBoard, resolveBoard } from '../src/lib/board-cli.ts'
import { findSpecAgent } from '../src/lib/agents/index.ts'
import { printFlow } from '../src/lib/agent/flow.ts'
import { buildAsk, buildPrompt } from '../src/lib/agent/prompts.ts'
import { refinementRequest } from '../src/lib/agent/refine.ts'
import { agentForRun } from '../src/lib/agent/runner.ts'
import { landAgents, previewStages, workflowById, workflowProblems } from '../src/lib/agent/workflows.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { boardText, setBoardRoot } from '../src/lib/paths.ts'
import type { AgentRequest } from '../src/lib/agent/types.ts'
import { move } from './helpers/board.ts'

let root = ''
const kanban = (): string => path.join(root, 'docs', 'kanban')

beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'akb-video-')))
  fs.mkdirSync(path.join(root, '.git'), { recursive: true })
  fs.mkdirSync(path.join(kanban(), 'todo'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'next-id'), '1\n')
  fs.writeFileSync(path.join(kanban(), 'todo', 'README.md'), '# Tasks\n\n## Tasks\n')
  fs.writeFileSync(path.join(kanban(), 'config.md'), '# Configuration\n\n- **Project** — a project.\n')
  setBoardRoot(root)
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

// What `akb card <action> --print` prints; a refine prints the pass it would start.
const printed = (action: 'refine' | 'implement', id: number): string => {
  const req: AgentRequest | { error: string } = action === 'refine' ? refinementRequest({ action: 'refine', id }) : { action, id }
  if ('error' in req) throw new Error(req.error)
  const sink = startCollecting()
  try {
    printFlow(req)
    return sink.out.join('\n')
  } finally {
    stopCollecting()
  }
}

const videoCard = async (): Promise<number> =>
  (await move(root, ['create', '--title', 'Show the board', '--workflow', 'hyperframes-video'])).id as number

describe('the hyperframes-video workflow', () => {
  it('previews the script and rehearsal, then the film, and lands with its cover', () => {
    const flow = workflowById('hyperframes-video')!
    assert.deepEqual([flow.name, flow.builtIn, flow.needsArtifact], ['Product video', true, true])
    assert.deepEqual(previewStages(flow, ['scriptwriter', 'demo-rehearser', 'hyperframes-editor']), [['scriptwriter', 'demo-rehearser'], ['hyperframes-editor']])
    assert.deepEqual(landAgents(flow).map((h) => h.agent), ['cover-designer'])
    assert.deepEqual(workflowProblems('hyperframes-video'), [])
  })

  it('is planned by the board’s planner, which asks the scriptwriter for the script', async () => {
    const id = await videoCard()
    assert.equal(agentForRun({ action: 'clarify', id, refineRound: 1 }), 'planner')
    const first = printed('refine', id)
    assert.match(first, /<spec-agents>[\s\S]*`scriptwriter`[\s\S]*When: always[\s\S]*`demo-rehearser`[\s\S]*`hyperframes-editor`/)
    assert.doesNotMatch(first, /ui-designer|tech-stack-advisor|`cover-designer`/)
    await move(root, ['update', String(id), '--previews', 'scriptwriter,hyperframes-editor'])
    const refine = printed('refine', id)
    assert.doesNotMatch(refine, /`hyperframes-editor`/)
    assert.match(refine, /stage\s+1 of 2/)
  })

  it('keeps its agents off a coding card', async () => {
    const coding = (await move(root, ['create', '--title', 'Fix the header'])).id as number
    for (const action of ['refine', 'implement'] as const) assert.doesNotMatch(printed(action, coding), /scriptwriter|hyperframes-editor/)
    assert.doesNotMatch(buildPrompt({ action: 'implement', id: coding }), /hyperframes-editor/)
  })

  it('tells planning what its last approval does', async () => {
    const id = await videoCard()
    assert.match(printed('refine', id), /the card is built and landed, then archived/)
    const deck = (await move(root, ['create', '--title', 'Pitch', '--workflow', 'slide-deck'])).id as number
    assert.match(printed('refine', deck), /The last Approve archives the card/)
    const coding = (await move(root, ['create', '--title', 'Fix the header'])).id as number
    assert.match(printed('refine', coding), /the card is built and landed, then archived/)
  })
})

describe('the <board-state> path constant', () => {
  it('spells the asset folder in the video editor’s prompt', async () => {
    const id = await videoCard()
    const editor = buildAsk({ action: 'spec', id, specAgent: 'hyperframes-editor' })
    assert.match(editor, /`\.akb\/boards\/docs\/kanban\/assets\/<card id>\/`/)
    assert.doesNotMatch(editor, /<board-state>/)
  })

  it("leaves ui-designer's prompt as it read before", () => {
    const body = findSpecAgent('ui-designer')!.body
    assert.match(body, /<board-state>\/assets/)
    const before = body.split('<board-state>/assets').join('docs/kanban/.assets')
    assert.equal(boardText(body), boardText(before))
    assert.match(boardText(body), /`\.akb\/boards\/docs\/kanban\/assets\/<card id>\/`/)
  })

  it("names another board's own state folder", () => {
    const marketing = path.join(root, 'marketing', 'kanban')
    fs.mkdirSync(path.join(marketing, 'todo'), { recursive: true })
    fs.writeFileSync(path.join(marketing, 'config.md'), '# Configuration\n')
    useBoard(resolveBoard('list', { board: marketing, dir: null, cwd: root, installHint: '' }), false)
    assert.equal(
      boardText('<board-state>/assets and docs/kanban/memory and docs/kanban/.assets'),
      '.akb/boards/marketing/kanban/assets and marketing/kanban/memory and .akb/boards/marketing/kanban/assets',
    )
  })
})
