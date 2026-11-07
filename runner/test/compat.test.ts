import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'

import { prepareKanbanSkill } from '../src/kanban-skill'
import { installCommitHook } from '../../cli/src/lib/skill/hook'
import { answerOf, runAkb, type Akb, type Ran } from '../src/akb'
import { builtWorkflow } from '../src/built'
import { BUILDER, draftFolder } from '../../cli/src/lib/shared/board-files'

// The real built akb, driven the way the Runner drives it: every command flow.ts and built.ts
// run, and every field they read. A failure here after an akb change means restore compatibility
// or raise `akbContract` in cli/package.json (docs/deploy.md).

/** Stands in for Claude Code. Its version beats any other copy, and the PATH below has no other. */
const AGENT = `#!${process.execPath}
if (process.argv.includes('--version')) { console.log('999.0.0 (Claude Code)'); process.exit(0) }
const at = process.argv.indexOf('--session-id')
const session_id = at < 0 ? 's1' : process.argv[at + 1]
const say = (line) => console.log(JSON.stringify(line))
say({ type: 'system', subtype: 'init', session_id })
say({ type: 'assistant', session_id, message: { role: 'assistant', content: [{ type: 'text', text: 'Done.' }] } })
say({ type: 'result', subtype: 'success', is_error: false, result: 'Done.', session_id, usage: { input_tokens: 1, output_tokens: 1 }, total_cost_usd: 0.01 })
`

describe('the akb the Runner carries (#171)', () => {
  const akb: Akb = {
    command: process.execPath,
    args: [path.join(process.env.RUNNER_DIST ?? '', 'akb', 'bin', 'ai4kanban.mjs')],
    version: '0.0.0-test',
    shim: '',
  }
  const held = process.env.PATH
  let project = ''
  let board = ''

  const raw = (args: string[]) => runAkb(akb, args, { cwd: project, board })
  const onBoard = (args: string[]) => {
    const at = args.includes('--') ? args.indexOf('--') : args.length
    return raw([...args.slice(0, at), '--board', board, ...args.slice(at)])
  }
  const ok = (ran: Ran) => assert.equal(ran.code, 0, ran.last)
  /** Refused for what it was asked, not for how: the words and the `error` the Runner reads. */
  const refused = (ran: Ran, words: RegExp) => {
    assert.notEqual(ran.code, 0)
    const answer = answerOf<{ ok?: boolean; error?: { message?: string; kind?: string } }>(ran)
    assert.equal(answer?.ok, false, ran.last)
    assert.equal(typeof answer?.error?.kind, 'string')
    assert.match(answer?.error?.message ?? '', words)
  }
  const follow = ['--follow', '--events', '--json']
  /** An agent's run, followed: the events it passes on and the fields of its ending. */
  const finishes = (ran: Ran) => {
    ok(ran)
    const answer = answerOf<{ ok?: boolean; result?: string; sessionId?: string; agentSession?: string }>(ran)
    assert.equal(answer?.ok, true, ran.last)
    assert.equal(answer?.result, 'Done.')
    assert.match(ran.out, /^\{"kind":"message","data":\{"text":"Done\."\}\}$/m)
    return answer!
  }

  before(() => {
    project = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'compat-')))
    board = path.join(project, '.akb', 'kanban')
    akb.shim = path.join(project, 'shim')
    fs.mkdirSync(board, { recursive: true })
    const bin = path.join(project, 'agent-bin')
    fs.mkdirSync(bin)
    fs.writeFileSync(path.join(bin, 'claude'), AGENT, { mode: 0o755 })
    process.env.PATH = [bin, '/usr/bin', '/bin'].join(path.delimiter)
    spawnSync('git', ['init', '-q', project])
    spawnSync('git', ['-C', project, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init'])
  })

  after(() => {
    process.env.PATH = held
    fs.rmSync(project, { recursive: true, force: true })
  })

  it('sets a board up as a job does', async () => {
    ok(await onBoard(['raw', 'init']))
    assert.ok(fs.existsSync(path.join(board, 'config.md')))
    prepareKanbanSkill(project)
    assert.deepEqual(installCommitHook(project, board), {})
    for (const folder of ['.claude', '.agents']) {
      assert.match(fs.readFileSync(path.join(project, folder, 'skills', 'kanban', 'SKILL.md'), 'utf8'), /<!-- ai4kanban \S+ -->\s*$/)
    }
    ok(await onBoard(['agent', 'use', 'claude-code']))
    ok(await onBoard(['agent', 'set', 'model', 'opus']))
    ok(await onBoard(['agent', 'set', 'model']))
    ok(await onBoard(['agent', 'set', 'args', '--', '--verbose']))
    ok(await onBoard(['agent', 'set', 'args']))
  })

  it('packs a drafted workflow landing with the built-in builder (#494)', async () => {
    const ws = { task: 'task_9', cloudTask: 'task_9', board, cwd: project, project, number: 9, workflow: BUILDER }
    const dir = path.join(board, 'workflows', draftFolder(ws.task))
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'WORKFLOW.md'), '---\nname: Site\nneedsArtifact: false\nland: [builder]\n---\n')
    const built = await builtWorkflow(ws, akb)
    assert.ok(built?.ok, built && !built.ok ? built.reason : '')
    assert.match(built.files['agents/builder/AGENT.md']!, /^name: builder$/m)
  })

  it('makes a card with the task’s number, keeps a retry to that card, and names what it refuses', async () => {
    const body = path.join(project, 'request.md')
    fs.writeFileSync(body, 'Two tiers.\n\n## Worth noting\n- Monthly leads.\n\n<!-- agent -->\n\n## Scope\n- Pricing.\n\n## Todo\n- [ ] Build it\n\n## Decided by the agent\n- Two.\n')
    const create = ['raw', 'create', '--title', 'Pricing', '--workflow', 'coding', '--body-file', body, '--id', '2', '--priority', 'med', '--json']
    for (let i = 0; i < 2; i++) {
      const made = await onBoard(create)
      ok(made)
      assert.equal(answerOf<{ id?: number }>(made)?.id, 2)
    }
    assert.ok(fs.existsSync(path.join(board, 'todo', '2-pricing.md')))
    refused(await onBoard([...create.slice(0, 8), '--id', '3', '--modules', 'nowhere', '--json']), /nowhere/)
  })

  it('creates a card with the preview choices sent by Runner', async () => {
    const create = ['raw', 'create', '--title', 'Article', '--workflow', 'blog-post', '--json']
    ok(await onBoard([...create, '--id', '9', '--previews', 'blog-writer,blog-planner']))
    assert.match(fs.readFileSync(path.join(board, 'todo', '9-article.md'), 'utf8'), /previews: \[blog-planner, blog-writer\]/)
    ok(await onBoard([...create, '--id', '10', '--previews', '']))
    assert.match(fs.readFileSync(path.join(board, 'todo', '10-article.md'), 'utf8'), /previews: \[\]/)
    refused(await onBoard([...create, '--id', '11', '--previews', 'missing-agent']), /missing-agent/)
  })

  it('answers the workflow checks', async () => {
    const list = answerOf<{ workflows?: { id: string; problems?: string[] }[]; problems?: string[] }>(await onBoard(['workflow', 'list', '--json']))
    assert.ok(list?.workflows?.some((w) => w.id === 'coding'))
    const spec = answerOf<{ problems?: string[] }>(await onBoard(['previews', '--json']))
    assert.ok(Array.isArray(spec?.problems))
  })

  it('runs an agent on a card and on the board, and lists what it spent', async () => {
    const started = Date.now()
    assert.equal(typeof finishes(await onBoard(['card', 'refine', '2', ...follow])).agentSession, 'string')
    finishes(await onBoard(['card', 'revise', '2', ...follow, '--', 'Shorter.']))
    finishes(await onBoard(['card', 'resolve', '2', ...follow, '--', 'Yes.']))
    finishes(await onBoard(['reflect', '--cards', '2', ...follow]))
    finishes(await onBoard(['prune-memory', ...follow]))
    finishes(await onBoard(['review-dismissals', ...follow]))

    const listed = answerOf<{ runs?: { sessionId: string; status?: string; startedAt?: number; result?: string; usage?: { input: number; cacheCreation: number; cacheRead: number; output: number }; costUsd?: number }[] }>(
      await onBoard(['run', 'list', '--card', '2', '--all', '--json']))
    const run = listed?.runs?.at(-1)
    assert.ok(run, 'no run was listed')
    assert.equal(typeof run.sessionId, 'string')
    assert.equal(run.status, 'done')
    assert.ok((run.startedAt ?? 0) >= started)
    assert.equal(run.result, 'Done.')
    assert.equal(run.usage?.output, 1)
    assert.ok(run.costUsd === undefined || typeof run.costUsd === 'number')
    ok(await onBoard(['run', 'list', '--all', '--json']))
    assert.notEqual((await onBoard(['run', 'stop', 'nobody'])).code, 0)
  })

  it('gives a reflection the scheduled agents it is told, or else the ones the workflows list (#277)', async () => {
    const body = path.join(project, 'done.md')
    fs.writeFileSync(body, 'Done.\n\n## Worth noting\n\n<!-- agent -->\n\n## Scope\n- Done.\n\n## Todo\n- [x] Done\n\n## Decided by the agent\n')
    ok(await onBoard(['raw', 'create', '--title', 'Done', '--workflow', 'coding', '--body-file', body, '--id', '3', '--priority', 'med', '--json']))
    ok(await onBoard(['raw', 'archive', '3']))
    const printed = async (env?: NodeJS.ProcessEnv) => {
      const ran = await runAkb(akb, ['reflect', '--cards', '3', '--print', '--board', board], { cwd: project, board, env })
      ok(ran)
      return ran.out
    }
    assert.match(await printed(), /<scheduled-agents>\n\s*qa-manager — /)
    assert.match(await printed({ AI4KANBAN_SCHEDULED_AGENTS: 'qa-manager,gone' }), /<scheduled-agents>\n\s*qa-manager — .*\n\s*<\/scheduled-agents>/)
    assert.doesNotMatch(await printed({ AI4KANBAN_SCHEDULED_AGENTS: '' }), /<scheduled-agents>\n/)
  })

  it('builds a card, and leaves the delivery the Runner reads', async () => {
    const ran = await onBoard(['card', 'implement', '2', ...follow])
    assert.notEqual(ran.code, 0, 'an unregistered result must remain unfinished')
    const answer = answerOf<{ error?: { delivery?: { id?: string } } }>(ran)
    const id = answer?.error?.delivery?.id
    assert.equal(typeof id, 'string')
    const held = JSON.parse(fs.readFileSync(path.join(board, 'deliveries', `${id}.json`), 'utf8')) as { deliveryId?: string; cardId?: number; status?: string; steps?: { step?: string }[] }
    assert.equal(held.deliveryId, id)
    assert.equal(held.cardId, 2)
    assert.equal(typeof held.status, 'string')
    assert.ok(held.steps?.every((s) => typeof s.step === 'string'))
  })

  it('takes every other verb a job sends', async () => {
    refused(await onBoard(['delivery', 'resume', 'gone', '--json']), /no delivery/)
    refused(await onBoard(['delivery', 'cancel', 'gone', '--json']), /no delivery/)
    refused(await onBoard(['agent', 'run', 'coding', 'nobody', ...follow]), /nobody/)
    ok(await onBoard(['review-memory', '--task', 'task_1:2', ...follow]))
  })
})
