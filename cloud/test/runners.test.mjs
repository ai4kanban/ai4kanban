import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'

import { PG_FOLDER_TAKEN, PG_RUNNER_ELSEWHERE, refusalFor } from '../src/db.ts'
import { addFolder, dispatchJob, dispatchReview, jobEvents, listAlerts, moveJob, registerRunner, report, requestAgent, routeRunner } from '../src/runners.ts'
import { periodicAgents } from '../src/runner-agents.ts'

// The Worker's half of the Local Runner (#2001): the shape of a request and the protocol
// check. One Runner per account and one claim per job are the migration's (test/sql).

const OWNER = { accountId: '11111111-1111-4111-8111-111111111111', subject: 'x', handle: 'a', name: null, avatarUrl: null, expiresAt: 0 }
const MACHINE = '44444444-4444-4444-8444-444444444444'
const ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' }

function fakeDatabase(answer) {
  const calls = []
  mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ fn: String(url).split('/rpc/')[1], args: JSON.parse(init.body) })
    const fn = String(url).split('/rpc/')[1]
    return new Response(JSON.stringify(typeof answer === 'function' ? answer(fn) : answer), { status: 200, headers: { 'content-type': 'application/json' } })
  })
  return calls
}

const register = (over = {}) =>
  registerRunner(ENV, OWNER, { machineId: MACHINE, machineName: 'studio', protocol: 11, version: '0.1.0', ...over })

describe('registering a Runner', () => {
  it('sends the machine, its runtimes and the service’s own lease', async () => {
    const calls = fakeDatabase({})
    await register({
      runtimes: [
        { name: 'codex', installed: true, loggedIn: false, path: '/usr/bin/codex' },
        { name: 'claude-code', installed: false },
        { name: 'kimi', installed: true },
        { name: 'gemini', installed: true },
        { name: 'codex', installed: false },
      ],
      leaseSeconds: 99_999,
    })
    assert.equal(calls[0].fn, 'register_runner')
    assert.equal(calls[0].args.p_machine, MACHINE)
    assert.deepEqual(calls[0].args.p_runtimes, [
      { name: 'codex', installed: true, loggedIn: false },
      { name: 'claude-code', installed: false },
      { name: 'kimi', installed: true },
    ])
    assert.equal(calls[0].args.p_lease_seconds, 900)
    assert.equal(calls[0].args.p_notify, false)
  })

  it('keeps the models each connector offers, capped (#2087)', async () => {
    const calls = fakeDatabase({})
    const many = Array.from({ length: 50 }, (_, i) => ({ id: `m${i}`, name: `M${i}` }))
    await register({
      runtimes: [
        { name: 'codex', installed: true, models: [{ id: 'gpt-a', name: 'GPT-A' }, { id: 'gpt-a', name: 'Again' }, { id: '' }, { id: 'gpt-b' }, 'x'] },
        { name: 'claude-code', installed: true, models: many },
      ],
    })
    const [codex, claude] = calls[0].args.p_runtimes
    assert.deepEqual(codex.models, [{ id: 'gpt-a', name: 'GPT-A' }, { id: 'gpt-b', name: 'gpt-b' }])
    assert.equal(claude.models.length, 40)
  })

  it('keeps what each connector takes as a form draws it, and which keys the Runner holds (#2135)', async () => {
    const calls = fakeDatabase({})
    await register({
      runtimes: [{ name: 'codex', installed: true, settings: [
        { key: 'provider', label: 'Provider', kind: 'provider', defaultProvider: 'subscription', flags: ['x'],
          providers: [{ id: 'endpoint', label: 'Endpoint', blurb: 'A gateway.', needs: ['baseUrl', 'apiKey'], env: { A: '1' } }] },
        { key: 'apiKey', label: 'Key', kind: 'secret', env: 'OPENAI_API_KEY' },
        { key: 'bad key', label: 'X', kind: 'text' },
        { key: 'mode', label: 'Mode', kind: 'radio' },
      ] }],
      secrets: { rt_1: ['apiKey', 'apiKey', 7], nope: ['apiKey'], rt_2: [] },
    })
    assert.deepEqual(calls[0].args.p_runtimes[0].settings, [
      { key: 'provider', label: 'Provider', kind: 'provider', defaultProvider: 'subscription',
        providers: [{ id: 'endpoint', label: 'Endpoint', blurb: 'A gateway.', needs: ['baseUrl', 'apiKey'] }] },
      { key: 'apiKey', label: 'Key', kind: 'secret' },
    ])
    assert.equal(calls[1].fn, 'report_runner_secrets')
    assert.deepEqual(calls[1].args.p_secrets, { rt_1: ['apiKey'] })
  })

  it('hands a key job\'s keys to the Runner that claimed it, and nothing else (#2135)', async () => {
    const calls = fakeDatabase((fn) => (fn === 'runner_job_payers' ? [] : { claimed: true, job: { id: 'j', secret: true } }))
    const claimed = await moveJob(ENV, OWNER, 'j', 'claim', { machineId: MACHINE })
    assert.deepEqual(calls.map((c) => c.fn), ['runner_job_payers', 'claim_runner_job', 'take_runner_secrets'])
    assert.equal(claimed.job.secret, true)
    const plain = fakeDatabase((fn) => (fn === 'runner_job_payers' ? [] : { claimed: true, job: { id: 'j', secret: false } }))
    await moveJob(ENV, OWNER, 'j', 'claim', { machineId: MACHINE })
    assert.deepEqual(plain.map((c) => c.fn), ['runner_job_payers', 'claim_runner_job'])
  })

  it('claims with the running limit of the plan paying for the job (#2209)', async () => {
    const payer = '55555555-5555-4555-8555-555555555555'
    const calls = fakeDatabase((fn) => (fn === 'runner_job_payers' ? [payer] : fn === 'subscriptions_for' ? [] : fn === 'claim_runner_job' ? { claimed: false } : null))
    await moveJob(ENV, OWNER, 'j', 'claim', { machineId: MACHINE })
    assert.equal(calls[0].args.p_job, 'j')
    assert.deepEqual(calls.find((c) => c.fn === 'claim_runner_job').args.p_running_limits, { [payer]: 3 })
  })

  it('says whether this computer shows notifications', async () => {
    const calls = fakeDatabase({})
    await register({ notify: true })
    assert.equal(calls[0].args.p_notify, true)
  })

  it('refuses an old protocol before reaching the database', async () => {
    const calls = fakeDatabase({})
    await assert.rejects(register({ protocol: 10 }), (e) => e.code === 'runner_outdated' && /Restart/.test(e.message))
    await assert.rejects(register({ protocol: undefined }), (e) => e.code === 'runner_outdated')
    assert.equal(calls.length, 0)
  })

  it('carries the database’s sentence naming the computer already connected', () => {
    const refusal = refusalFor({ code: PG_RUNNER_ELSEWHERE, message: 'Your WildCrane Runner is already connected on studio.' }, 400)
    assert.equal(refusal.code, 'runner_elsewhere')
    assert.match(refusal.message, /studio/)
  })
})

describe('dispatching a job', () => {
  const dispatch = (body) => dispatchJob(ENV, OWNER, { runtime: 'codex', prompt: 'Build it', ...body })

  it('takes a runtime, a project, a prompt and attachments', async () => {
    const calls = fakeDatabase({})
    await dispatch({ project: 'prj_site', attachments: [{ name: 'brief.md', content: 'aGk=' }] })
    assert.equal(calls[0].fn, 'dispatch_runner_job')
    assert.equal(calls[0].args.p_project, 'prj_site')
    assert.deepEqual(calls[0].args.p_attachments, [{ name: 'brief.md', content: 'aGk=' }])
  })

  it('names the task a job belongs to, or none', async () => {
    const calls = fakeDatabase({})
    await dispatch({ task: 'task_1' })
    await dispatch({})
    assert.deepEqual(calls.map((c) => c.args.p_task), ['task_1', null])
    await assert.rejects(dispatch({ task: 'nope' }), (e) => e.code === 'bad_request')
  })

  it('takes a task job’s stage: a finished plan job submits its draft (#2040)', async () => {
    const calls = fakeDatabase({})
    await dispatch({ task: 'task_1', stage: 'plan' })
    await dispatch({ task: 'task_1' })
    assert.deepEqual(calls.map((c) => c.args.p_stage), ['plan', null])
    await assert.rejects(dispatch({ task: 'task_1', stage: 'review' }), (e) => e.code === 'bad_request')
    await assert.rejects(dispatch({ stage: 'plan' }), (e) => e.code === 'bad_request')
  })

  it('runs in the Runner’s own folder when no project is named', async () => {
    const calls = fakeDatabase({})
    await dispatch({})
    assert.equal(calls[0].args.p_project, null)
  })

  it('refuses what the Runner could not run, without touching the database', async () => {
    const calls = fakeDatabase({})
    for (const body of [
      { runtime: 'gemini' },
      { prompt: '  ' },
      { project: '/Users/me/site' },
      { attachments: [{ name: '../x', content: '' }] },
      { attachments: [{ name: 'a', content: 'not base64!' }] },
      { attachments: Array.from({ length: 6 }, () => ({ name: 'a', content: '' })) },
    ]) {
      await assert.rejects(dispatch(body), (e) => e.code === 'bad_request', JSON.stringify(body))
    }
    assert.equal(calls.length, 0)
  })
})

describe('a review of chat memory (#2065)', () => {
  const TASK = 'task_0190ab0000000000000000000000000a'
  const PROJECT = 'prj_0190ab0000000000000000000000000b'

  it('names this computer, the project, its tasks and the runtime', async () => {
    const calls = fakeDatabase({})
    await dispatchReview(ENV, OWNER, { machineId: MACHINE, project: PROJECT, tasks: [TASK], runtime: 'codex', model: 'gpt-5' })
    assert.equal(calls[0].fn, 'dispatch_runner_review')
    assert.deepEqual(calls[0].args, {
      p_subject: OWNER.accountId, p_machine: MACHINE, p_project: PROJECT, p_tasks: [TASK], p_runtime: 'codex', p_model: 'gpt-5',
      p_daily_write_budget: calls[0].args.p_daily_write_budget,
    })
  })

  it('refuses no tasks, a bad task id and an unknown runtime, without touching the database', async () => {
    const calls = fakeDatabase({})
    const review = (over) => dispatchReview(ENV, OWNER, { machineId: MACHINE, project: PROJECT, tasks: [TASK], runtime: 'codex', ...over })
    await assert.rejects(review({ tasks: [] }))
    await assert.rejects(review({ tasks: ['x'] }))
    await assert.rejects(review({ runtime: 'gemini' }))
    assert.equal(calls.length, 0)
  })
})

describe('a project on this computer', () => {
  it('names the folder and the computer', async () => {
    const calls = fakeDatabase({})
    await addFolder(ENV, OWNER, { machineId: MACHINE, name: ' site ', path: '/Users/me/site' })
    assert.equal(calls[0].fn, 'add_project_folder')
    assert.equal(calls[0].args.p_machine, MACHINE)
    assert.equal(calls[0].args.p_name, 'site')
    assert.equal(calls[0].args.p_path, '/Users/me/site')
  })

  it('refuses a folder that is not an absolute path', async () => {
    const calls = fakeDatabase({})
    for (const path of ['relative/dir', '', 'C:', '/a\0b']) {
      await assert.rejects(addFolder(ENV, OWNER, { machineId: MACHINE, name: 'x', path }), (e) => e.code === 'bad_request', path)
    }
    await addFolder(ENV, OWNER, { machineId: MACHINE, name: 'x', path: 'C:\\Users\\me\\site' })
    assert.equal(calls.length, 1)
  })

  it('places an existing project, and names the one already holding the folder', async () => {
    const calls = fakeDatabase({})
    const project = 'prj_0192c4f1a2b3c4d5e6f7a8b9c0d1'
    await addFolder(ENV, OWNER, { machineId: MACHINE, name: 'x', path: '/Users/me/docs', project })
    assert.equal(calls[0].args.p_project, project)
    await assert.rejects(addFolder(ENV, OWNER, { machineId: MACHINE, name: 'x', path: '/a', project: 'nope' }), (e) => e.code === 'bad_request')
    const taken = refusalFor({ code: PG_FOLDER_TAKEN, details: 'Website' }, 400)
    assert.equal(taken.code, 'folder_taken')
    assert.equal(taken.project, 'Website')
  })
})

describe('the alerts a Runner shows', () => {
  it('lists comment alerts only to a Runner that asks for them', async () => {
    const calls = fakeDatabase([])
    await listAlerts(ENV, OWNER, new URL(`https://api/v1/runner/alerts?machine=${MACHINE}`))
    await listAlerts(ENV, OWNER, new URL(`https://api/v1/runner/alerts?machine=${MACHINE}&comments=1`))
    assert.equal(calls[0].fn, 'list_desktop_alerts')
    assert.deepEqual(calls.map((c) => c.args.p_comments), [false, true])
    assert.equal(calls[1].args.p_machine, MACHINE)
  })
})

describe('the version a launcher asks for', () => {
  it('answers without a sign-in, bucketed by machine', async () => {
    const calls = fakeDatabase({ version: '1.2.0' })
    const response = await routeRunner(
      new Request(`https://api/v1/runner/version?machine=${MACHINE}`),
      ENV,
      new URL(`https://api/v1/runner/version?machine=${MACHINE}`),
      'version',
    )
    assert.deepEqual(await response.json(), { version: '1.2.0' })
    assert.equal(calls[0].fn, 'runner_version')
    assert.equal(calls[0].args.p_machine, MACHINE)
  })
})

describe('a finished job’s report (#2027)', () => {
  it('keeps a discussion’s ideas, each checked (#2073)', () => {
    const ideas = report({ ideas: [
      { id: 'new_1', title: ' Pricing ', outcome: 'A page.', acceptance: ['Tiers', ' ', 3], workflow: 'wf_builtin_slide_deck', start: true },
      { id: 'idea_1', dropped: true },
      { id: 'idea_2', title: 'Blog', workflow: 'coding', start: 'yes' },
      { id: 'a b', title: 'Bad id' },
      { id: 'new_2', title: '  ' },
      'x',
    ] }).ideas
    assert.deepEqual(ideas, [
      { id: 'new_1', title: 'Pricing', outcome: 'A page.', acceptance: ['Tiers'], workflow: 'wf_builtin_slide_deck', start: true },
      { id: 'idea_1', title: '', outcome: '', acceptance: [], workflow: 'wf_builtin_coding', dropped: true },
      { id: 'idea_2', title: 'Blog', outcome: '', acceptance: [], workflow: 'wf_builtin_coding' },
    ])
    assert.equal(report({ ideas: 'x' }).ideas, undefined)
  })

  it('keeps the reply, a plain session id and a whole context reading', () => {
    assert.deepEqual(report({ reply: 'Two tiers.', session: 'th_1', context: { used: 38000, limit: 200000 } }),
      { reply: 'Two tiers.', session: 'th_1', context: { used: 38000, limit: 200000 } })
    assert.deepEqual(report({ session: 'a b', context: { used: 5 } }), {})
    assert.equal(report(undefined), null)
    assert.equal(report({ reply: 'x'.repeat(70000) }).reply.length, 60000)
  })

  it('keeps a flow job’s card and its open question (#2020)', () => {
    assert.deepEqual(report({ reply: 'Planned.', card: 12, review: { question: ' Which tier? ', options: ['One', ' Two '], position: 2 } }),
      { reply: 'Planned.', card: 12, review: { question: 'Which tier?', options: ['One', 'Two'], position: 2 } })
    const bad = [
      { card: 0 }, { card: 1.5 }, { card: '3' },
      { review: { question: '', options: ['a'], position: 1 } },
      { review: { question: 'q', options: [], position: 1 } },
      { review: { question: 'q', options: Array(9).fill('a'), position: 1 } },
      { review: { question: 'q', options: ['a'], position: 0 } },
      { review: 'q' },
    ]
    for (const held of bad) assert.deepEqual(report(held), {}, JSON.stringify(held))
  })

  it('keeps whole token counts and a cost (#2048)', () => {
    const usage = { input: 10, cacheCreation: 0, cacheRead: 300, output: 5 }
    assert.deepEqual(report({ usage: { ...usage, extra: 1 }, costUsd: 0.42 }), { usage, costUsd: 0.42 })
    const bad = [{ usage: { ...usage, output: -1 } }, { usage: { input: 1 } }, { costUsd: -1 }, { costUsd: '0.4' }, { costUsd: Infinity }]
    for (const held of bad) assert.deepEqual(report(held), {}, JSON.stringify(held))
  })
})

describe('a Workflow builder job’s files (#2004)', () => {
  const JOB = '55555555-5555-4555-8555-555555555555'
  const FILES = {
    'WORKFLOW.md': '---\nname: Report\ndescription: Weekly\npreviews: [writer]\n---\n',
    'agents/writer/AGENT.md': '---\nname: writer\ndescription: Writes it.\n---\n\nWrite it.\n',
  }
  const finish = (workflow) => moveJob(ENV, OWNER, JOB, 'finish', { machineId: MACHINE, outcome: 'done', report: { reply: 'Done.', workflow } })

  it('keeps them, read as a workflow is, before the job ends', async () => {
    const calls = fakeDatabase(true)
    await finish({ files: FILES })
    assert.deepEqual(calls.map((c) => c.fn), ['runner_built_workflow', 'finish_runner_job'])
    assert.deepEqual(calls[0].args.p_built, { name: 'Report', description: 'Weekly', lands: false, files: FILES })
    assert.equal(calls[1].args.p_outcome, 'done')
    assert.equal(calls[1].args.p_report.workflow, undefined)
  })

  it('fails the job with the problem when they do not check', async () => {
    const calls = fakeDatabase(true)
    await finish({ files: { 'WORKFLOW.md': FILES['WORKFLOW.md'] } })
    assert.deepEqual(calls.map((c) => c.fn), ['finish_runner_job'])
    assert.equal(calls[0].args.p_outcome, 'failed')
    assert.match(calls[0].args.p_reason, /^The workflow has a problem: WORKFLOW\.md it previews with `writer`/)
  })
})

describe('a run\'s events (#2059)', () => {
  it('keeps typed events and reads an older Runner\'s text as log', () => {
    assert.deepEqual(jobEvents([
      { seq: 0, text: 'hi' },
      { seq: 1, kind: 'tool_call', data: { toolCallId: 't', title: 'Read', kind: 'read', status: 'pending' } },
    ]), [
      { seq: 0, text: 'hi', kind: 'log' },
      { seq: 1, text: '', kind: 'tool_call', data: { toolCallId: 't', title: 'Read', kind: 'read', status: 'pending' } },
    ])
  })

  it('refuses a kind it does not know and data that is not an object', () => {
    assert.throws(() => jobEvents([{ seq: 0, kind: 'thought', data: {} }]), /one of message/)
    assert.throws(() => jobEvents([{ seq: 0, kind: 'plan', data: [] }]), /data is an object/)
  })
})

describe('a project\'s periodic agents (#2068)', () => {
  const held = {
    since: '2026-10-01T00:00:00Z',
    builtins: ['wf_builtin_coding'],
    workflows: [],
    runs: [{ agent: 'describe-project', workflow: null, lastSuccess: '2026-10-20T00:00:00Z', attempts: [] }],
    completedAt: '2026-10-19T00:00:00Z',
    reflectWaiting: true,
    dismissalsWaiting: false,
    schedules: [],
  }

  it('lists the board\'s own and the workflow\'s scheduled agents, with what is new for each', () => {
    const agents = Object.fromEntries(periodicAgents(held).map((a) => [a.workflow ? `${a.workflow}/${a.name}` : a.name, a]))
    assert.equal(agents.reflect.newWork, true)
    assert.equal(agents['describe-project'].newWork, false, 'nothing finished since it last passed')
    assert.equal(agents['review-dismissals'].newWork, false)
    assert.equal(agents['prune-memory'].since, held.since)
    assert.equal(agents['prune-memory'].fallback, '7d')
    const qa = agents['wf_builtin_coding/qa-manager']
    assert.equal(qa.reads, 'archived-cards')
    assert.equal(qa.newWork, true)
    assert.equal(qa.cadence, 'auto')
  })

  it('takes what the agents page set, by job: a cadence over the default, and one switched off is never listed (#2138)', () => {
    const schedules = [
      { agent: 'prune-memory', workflow: null, on: true, cadence: '3d' },
      { agent: 'reflect', workflow: null, on: false, cadence: null },
      { agent: 'qa-manager', workflow: 'wf_builtin_coding', on: true, cadence: '1d at 09:30' },
    ]
    const agents = Object.fromEntries(periodicAgents({ ...held, schedules }).map((a) => [a.name, a]))
    assert.equal(agents['prune-memory'].cadence, '3d')
    assert.equal(agents.reflect, undefined, 'a switched-off agent was listed')
    assert.equal(agents['describe-project'].cadence, 'auto')
    assert.equal(agents['qa-manager'].cadence, '1d at 09:30')
    const off = [{ agent: 'qa-manager', workflow: 'wf_builtin_coding', on: false, cadence: null }]
    assert.equal(periodicAgents({ ...held, schedules: off }).some((a) => a.name === 'qa-manager'), false)
    const elsewhere = [{ agent: 'qa-manager', workflow: 'wf_other', on: false, cadence: null }]
    assert.equal(periodicAgents({ ...held, schedules: elsewhere }).some((a) => a.name === 'qa-manager'), true, 'another workflow’s switch applied')
  })

  it('asks for a board agent, or a workflow\'s by its id', async () => {
    const calls = fakeDatabase(null)
    try {
      await requestAgent(ENV, OWNER, { machineId: MACHINE, project: 'prj_1', agent: 'reflect', seen: null })
      await requestAgent(ENV, OWNER, { machineId: MACHINE, project: 'prj_1', agent: 'qa-manager', workflow: 'wf_builtin_coding', seen: '2026-10-20T00:00:00Z' })
      assert.deepEqual(calls.map((c) => [c.fn, c.args.p_agent, c.args.p_workflow]), [
        ['request_agent_job', 'reflect', null],
        ['request_agent_job', 'qa-manager', 'wf_builtin_coding'],
      ])
      await assert.rejects(requestAgent(ENV, OWNER, { machineId: MACHINE, project: 'prj_1', agent: 'qa-manager' }), /does not run on its own/)
      await assert.rejects(requestAgent(ENV, OWNER, { machineId: MACHINE, project: 'prj_1', agent: 'reflect', seen: 'soon' }), /is a time/)
    } finally {
      mock.restoreAll()
    }
  })
})
