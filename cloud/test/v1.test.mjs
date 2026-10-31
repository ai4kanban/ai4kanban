// The public API (#2000), the Worker's half: auth, the conventions, validation, uploads, the
// event stream and the OpenAPI document. What the database does with a call is
// test/sql/checks.sql's.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { issuerFor, jwksUrl, resetJwksCache } from '../src/auth.ts'
import worker from '../src/index.ts'
import { ROUTES, SHARED_ROUTES } from '../src/v1/index.ts'
import { DEPRECATED, deprecationHeaders, sha256 } from '../src/v1/http.ts'
import { EventHub } from '../src/v1/stream.ts'
import { untar } from '../src/v1/components.ts'
import { tarOf as packTar } from '../../artifact-sdk/bin/pack.mjs'
import { BUILTIN_WORKFLOWS } from '../src/v1/workflows.ts'
import { fakeBoards } from './fake-board.mjs'

const SUPABASE_URL = 'https://project.supabase.co'
const USER = '11111111-1111-4111-8111-111111111111'
const KEY = 'wck_live-key-for-tests'
const openapi = JSON.parse(readFileSync(new URL('../openapi.json', import.meta.url), 'utf8'))

const realFetch = globalThis.fetch
let keyPair
let calls
let db
let events
let bucket
let pokes
let env
let mails
let resendStatus
let boards

beforeEach(async () => {
  resetJwksCache()
  keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  calls = []
  events = []
  pokes = 0
  mails = []
  resendStatus = 200
  bucket = fakeBucket()
  db = {
    account_for_session: () => ({ admitted: true, handle: 'lin', name: null, avatar_url: null, account_id: USER }),
    // Free, unless a test says otherwise (#2017).
    subscriptions_for: () => [],
    seed_grant_for: () => null,
    trial_for: () => null,
    v1_account_for_key: async ({ p_hash }) =>
      p_hash === (await sha256(KEY)) ? { account_id: USER, handle: 'lin', key_id: 'key_1', key_name: 'CI' } : null,
    v1_list_events: ({ p_after, p_limit }) => {
      const after = events.filter((e) => Number(e.id.slice(4)) > p_after)
      const data = after.slice(0, p_limit)
      return { data, next: after.length > p_limit ? data.at(-1).id : null }
    },
    // One personal workspace, unless a test says otherwise (#2045).
    v1_audience: () => [USER],
    v1_board_of: () => 'ws_1',
    hint_board: () => undefined,
    v1_payer: () => USER,
    v1_take_endings: () => [],
    v1_claim_idempotency: ({ p_key, p_hash }) => {
      const held = replays.get(p_key)
      if (!held) {
        replays.set(p_key, { request_hash: p_hash, status: null, response: null })
        return { claimed: true }
      }
      return { claimed: false, ...held }
    },
    v1_finish_idempotency: ({ p_key, p_status, p_response }) => {
      Object.assign(replays.get(p_key), { status: p_status, response: p_response })
    },
    v1_release_idempotency: ({ p_key }) => {
      replays.delete(p_key)
    },
  }
  const replays = new Map()
  const hubs = new Map()
  env = {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    ARTIFACTS: bucket,
    EVENT_HUBS: {
      idFromName: (name) => name,
      get: (name) => {
        if (!hubs.has(name)) hubs.set(name, new EventHub({}, env))
        const hub = hubs.get(name)
        return {
          fetch: (input, init) => {
            if (String(input).endsWith('/poke')) pokes += 1
            return hub.fetch(new Request(input, init))
          },
        }
      },
    },
  }
  env.BOARDS = boards = fakeBoards(env, (p) => pending.push(p))
  globalThis.fetch = async (url, init) => {
    const address = String(url)
    if (address === jwksUrl(SUPABASE_URL)) return json({ keys: [{ ...jwk, kid: 'k', alg: 'ES256' }] })
    if (address === 'https://api.resend.com/emails') {
      mails.push(JSON.parse(init.body))
      return json({ id: 'mail_1' }, resendStatus)
    }
    const fn = address.split('/rest/v1/rpc/')[1]
    const body = init?.body ? JSON.parse(init.body) : {}
    calls.push({ fn, body })
    if (!(fn in db)) throw new Error(`unexpected call to ${fn}`)
    const answer = await db[fn](body)
    if (answer instanceof Response) return answer
    return answer === undefined ? new Response('') : json(answer)
  }
})

afterEach(() => {
  globalThis.fetch = realFetch
  BUILTIN_WORKFLOWS.length = 0
})

const pending = []
const ctx = { waitUntil: (p) => pending.push(p), passThroughOnException: () => {} }
/** What the Worker handed `waitUntil`, finished: a poke reads the audience first. */
const idle = async () => {
  while (pending.length > 0) await Promise.all(pending.splice(0))
}

async function send(path, init = {}, bearer) {
  const headers = { authorization: `Bearer ${bearer ?? (await token())}`, ...(init.headers ?? {}) }
  const body = init.body !== undefined && typeof init.body !== 'string' && !(init.body instanceof Uint8Array)
    ? JSON.stringify(init.body)
    : init.body
  return worker.fetch(new Request(`https://api.ai4kanban.dev${path}`, { ...init, headers, body }), env, ctx)
}

const callsTo = (fn) => calls.filter((c) => c.fn === fn)

describe('authentication', () => {
  it('takes an API key by its hash and never sends the key itself', async () => {
    db.v1_list_projects = () => ({ data: [], next: null })
    const res = await send('/v1/projects', {}, KEY)
    assert.equal(res.status, 200)
    assert.ok(!JSON.stringify(calls).includes(KEY))
    assert.equal(callsTo('v1_list_projects')[0].body.p_account, USER)
  })

  it('refuses an unknown or revoked key with the one error shape', async () => {
    const res = await send('/v1/projects', {}, 'wck_revoked')
    assert.equal(res.status, 401)
    const { error } = await res.json()
    assert.equal(error.code, 'unauthenticated')
    assert.ok(error.message)
  })

  it('shows a new key once, stores only its hash, and refuses a key making keys', async () => {
    db.v1_create_api_key = ({ p_name, p_prefix }) => ({ id: 'key_2', object: 'api_key', name: p_name, prefix: p_prefix })
    const res = await send('/v1/api-keys', { method: 'POST', body: { name: 'Runner' } })
    assert.equal(res.status, 201)
    const made = await res.json()
    assert.match(made.key, /^wck_[\w-]{43}$/)
    const [{ body }] = callsTo('v1_create_api_key')
    assert.equal(body.p_hash, await sha256(made.key))
    assert.ok(!JSON.stringify(body).includes(made.key))
    assert.equal(made.prefix, made.key.slice(0, 12))

    const byKey = await send('/v1/api-keys', { method: 'POST', body: {} }, KEY)
    assert.equal(byKey.status, 403)
    assert.equal((await byKey.json()).error.code, 'session_required')
  })
})

describe('conventions', () => {
  it('pages with limit and after, and refuses a cursor of the wrong type', async () => {
    db.v1_list_tasks = () => ({ data: [{ id: 'task_2' }], next: 'task_2' })
    const res = await send('/v1/tasks?limit=1&after=task_1&status=running')
    assert.deepEqual(await res.json(), { data: [{ id: 'task_2' }], next: 'task_2' })
    const [{ body }] = callsTo('v1_list_tasks')
    assert.equal(body.p_limit, 1)
    assert.equal(body.p_after, 'task_1')
    assert.equal(body.p_status, 'running')

    assert.equal((await send('/v1/tasks?limit=500')).status, 400)
    assert.equal((await send('/v1/tasks?after=prj_1')).status, 400)
  })

  it('maps the database refusals to not_found and conflict', async () => {
    db.v1_task = () => json({ code: 'AKB20', message: 'No task has this id.' }, 400)
    db.v1_cancel_task = () => json({ code: 'AKB21', message: 'This task has finished.' }, 400)
    const missing = await send('/v1/tasks/task_9')
    assert.equal(missing.status, 404)
    assert.deepEqual(await missing.json(), { error: { code: 'not_found', message: 'No task has this id.' } })
    const finished = await send('/v1/tasks/task_9/cancel', { method: 'POST' })
    assert.equal(finished.status, 409)
    assert.equal((await finished.json()).error.code, 'conflict')
  })

  it('replays a create under the same Idempotency-Key and refuses the key on another body', async () => {
    let made = 0
    db.v1_create_project = ({ p_fields }) => ({ id: `prj_${++made}`, object: 'project', ...p_fields })
    const first = await send('/v1/projects', { method: 'POST', body: { name: 'Site' }, headers: { 'idempotency-key': 'k1' } })
    const again = await send('/v1/projects', { method: 'POST', body: { name: 'Site' }, headers: { 'idempotency-key': 'k1' } })
    assert.equal(first.status, 201)
    assert.equal(again.status, 201)
    assert.equal(again.headers.get('idempotent-replayed'), 'true')
    assert.deepEqual(await again.json(), await first.json())
    assert.equal(made, 1)

    const other = await send('/v1/projects', { method: 'POST', body: { name: 'Other' }, headers: { 'idempotency-key': 'k1' } })
    assert.equal(other.status, 422)
    assert.equal((await other.json()).error.code, 'idempotency_key_reused')
  })

  it('lets a failed create be retried under its key', async () => {
    let tries = 0
    db.v1_create_project = () => (++tries === 1 ? json({ code: 'AKB20', message: 'x' }, 400) : { id: 'prj_1' })
    const init = { method: 'POST', body: { name: 'Site' }, headers: { 'idempotency-key': 'k2' } }
    assert.equal((await send('/v1/projects', init)).status, 404)
    assert.equal((await send('/v1/projects', init)).status, 201)
  })

  it('marks a deprecated endpoint with Deprecation and Sunset', () => {
    DEPRECATED['GET /v1/x'] = { since: '2027-01-01', sunset: '2027-07-01' }
    try {
      const headers = deprecationHeaders('GET /v1/x')
      assert.equal(headers.deprecation, `@${Date.parse('2027-01-01') / 1000}`)
      assert.equal(headers.sunset, 'Thu, 01 Jul 2027 00:00:00 GMT')
      assert.deepEqual(deprecationHeaders('GET /v1/projects'), {})
    } finally {
      delete DEPRECATED['GET /v1/x']
    }
  })

  it('answers a browser preflight and tells the stream it was written to', async () => {
    const pre = await worker.fetch(new Request('https://api.ai4kanban.dev/v1/tasks', { method: 'OPTIONS' }), env, ctx)
    assert.equal(pre.status, 204)
    assert.equal(pre.headers.get('access-control-allow-origin'), '*')
    assert.match(pre.headers.get('access-control-allow-headers'), /idempotency-key/)

    db.v1_create_project = () => ({ id: 'prj_1' })
    await send('/v1/projects', { method: 'POST', body: { name: 'Site' } })
    await idle()
    assert.equal(pokes, 1)
  })
})

describe('validation', () => {
  it('refuses inline artifacts over 256 KB', async () => {
    const version = await send('/v1/artifacts/art_1/versions', { method: 'POST', body: { content: { html: 'x'.repeat(257 * 1024) } } })
    assert.equal(version.status, 413)
    assert.equal(calls.filter((c) => c.fn.startsWith('v1_create')).length, 0)
  })

  it('refuses a workflow in the old fields or with a broken file, naming the file', async () => {
    const old = await send('/v1/workflows', { method: 'POST', body: { name: 'W', checkpoints: [{ key: 'a', title: 'A' }] } })
    assert.equal(old.status, 400)
    assert.match((await old.json()).error.message, /checkpoints is no longer part of a workflow/)
    const files = { 'WORKFLOW.md': '---\nname: W\npreviews: [writer]\n---\n' }
    const missing = await send('/v1/workflows', { method: 'POST', body: { files } })
    assert.equal(missing.status, 400)
    assert.match((await missing.json()).error.message, /^WORKFLOW\.md .*`writer`, which has no agents\/writer\/AGENT\.md/)
    const broken = await send('/v1/workflows/wf_own', { method: 'PATCH', body: { files: { ...files, 'agents/writer/AGENT.md': 'no frontmatter' } } })
    assert.equal(broken.status, 400)
    assert.match((await broken.json()).error.message, /^agents\/writer\/AGENT\.md /)
    const big = await send('/v1/workflows', { method: 'POST', body: { files: { ...files, 'agents/writer/notes.md': 'x'.repeat(257 * 1024) } } })
    assert.equal(big.status, 413)
    assert.equal(calls.filter((c) => c.fn.endsWith('_workflow')).length, 0)
  })
})

describe('task keys (#2034)', () => {
  it('reads and writes a task by its key, and by its id without a lookup', async () => {
    db.v1_task_id = ({ p_prefix, p_number }) => (p_prefix === 'WC' && p_number === 12 ? 'task_12' : json({ code: 'AKB20', message: 'No task has this id.' }, 400))
    db.v1_task = ({ p_id }) => ({ id: p_id, object: 'task', key: 'WC-12' })
    db.v1_update_task = ({ p_id, p_fields }) => ({ id: p_id, object: 'task', ...p_fields })
    db.v1_list_artifacts = () => ({ data: [], next: null })

    assert.deepEqual(await (await send('/v1/tasks/wc-12')).json(), { id: 'task_12', object: 'task', key: 'WC-12' })
    assert.deepEqual(callsTo('v1_task_id')[0].body, { p_account: USER, p_prefix: 'WC', p_number: 12 })
    const moved = await send('/v1/tasks/WC-12', { method: 'PATCH', body: { project: 'prj_2' } })
    assert.equal((await moved.json()).project, 'prj_2')
    assert.equal((await send('/v1/tasks/WC-12/artifacts')).status, 200)
    assert.equal(callsTo('v1_list_artifacts')[0].body.p_task, 'task_12')

    calls.length = 0
    assert.equal((await send('/v1/tasks/task_12')).status, 200)
    assert.equal(callsTo('v1_task_id').length, 0)
    assert.equal((await send('/v1/tasks/WC-99')).status, 404)
    assert.equal((await send('/v1/tasks/WC-0')).status, 400)
  })

  it('takes a project prefix in upper case and refuses one that cannot start a key', async () => {
    db.v1_create_project = ({ p_fields }) => ({ id: 'prj_1', object: 'project', ...p_fields })
    const made = await send('/v1/projects', { method: 'POST', body: { name: 'WildCrane', prefix: 'wc' } })
    assert.equal((await made.json()).prefix, 'WC')
    for (const prefix of ['1A', 'W-C', 'ABCDEFGHIJK']) {
      assert.equal((await send('/v1/projects/prj_1', { method: 'PATCH', body: { prefix } })).status, 400)
    }
  })
})

describe('workflows', () => {
  const WORKFLOW = '---\nname: Site\ndescription: Builds pages.\npreviews: [writer]\n---\n'
  const AGENT = '---\nname: writer\ndescription: Writes pages.\n---\n\nWrite the page.\n'
  const FILES = { 'WORKFLOW.md': WORKFLOW, 'agents/writer/AGENT.md': AGENT, 'agents/writer/scripts/check.mjs': 'export {}\n' }

  it('lists built-ins first with their version, refuses changing one, and makes a task on its files', async () => {
    BUILTIN_WORKFLOWS.push({ id: 'wf_builtin_site', name: 'Site', names: { en: 'Site', zh: '网站' }, description: '', lands: false, hash: 'h1', files: FILES })
    db.v1_builtin_versions = ({ p_builtins }) => Object.fromEntries(p_builtins.map((b) => [b.id, 3]))
    db.v1_installed_workflows = () => ['wf_builtin_site']
    db.v1_list_workflows = () => ({ data: [{ id: 'wf_own' }], next: null })
    db.v1_create_task = ({ p_fields, p_workflow }) => ({ id: 'task_1', ...p_fields, workflow: { id: p_workflow.id, version: 3 } })
    const list = await (await send('/v1/workflows')).json()
    assert.deepEqual(list.data.map((w) => w.id), ['wf_builtin_site', 'wf_own'])
    assert.deepEqual(list.data[0], {
      id: 'wf_builtin_site', object: 'workflow', builtin: true, name: 'Site', names: { en: 'Site', zh: '网站' }, description: '', version: 3,
    })
    assert.deepEqual((await (await send('/v1/workflows/wf_builtin_site')).json()).files, FILES)

    assert.equal((await send('/v1/workflows/wf_builtin_site', { method: 'PATCH', body: { files: FILES } })).status, 403)
    assert.equal((await send('/v1/workflows/wf_builtin_site', { method: 'DELETE' })).status, 403)

    const task = await send('/v1/tasks', { method: 'POST', body: { title: 'Landing', workflow: 'wf_builtin_site' } })
    assert.equal(task.status, 201)
    const sent = callsTo('v1_create_task')[0].body.p_workflow
    assert.deepEqual([sent.builtin, sent.hash, sent.files], [true, 'h1', FILES])
  })

  it('saves an own workflow as its files, read from WORKFLOW.md, and makes a task on its id', async () => {
    db.v1_create_workflow = ({ p_fields }) => ({ id: 'wf_own', ...p_fields })
    db.v1_update_workflow = ({ p_fields }) => ({ id: 'wf_own', ...p_fields })
    db.v1_create_task = () => ({ id: 'task_1' })
    const made = await send('/v1/workflows', { method: 'POST', body: { files: FILES } })
    assert.equal(made.status, 201)
    assert.deepEqual(callsTo('v1_create_workflow')[0].body.p_fields,
      { name: 'Site', description: 'Builds pages.', lands: false, files: FILES })
    await send('/v1/workflows/wf_own', { method: 'PATCH', body: { files: { ...FILES, 'agents/writer/AGENT.md': AGENT.replace('pages', 'posts') } } })
    assert.match(callsTo('v1_update_workflow')[0].body.p_fields.files['agents/writer/AGENT.md'], /posts/)
    await send('/v1/tasks', { method: 'POST', body: { title: 'Go', workflow: 'wf_own' } })
    assert.deepEqual(callsTo('v1_create_task')[0].body.p_workflow, { id: 'wf_own', builtin: false })
  })

  it('keeps a new task’s pictures for its first step (#2182)', async () => {
    db.v1_create_task = () => ({ id: 'task_1' })
    const png = (name) => ({ name, type: 'image/png', content: 'aGk=' })
    await send('/v1/tasks', { method: 'POST', body: { title: 'Go', workflow: 'wf_own' } })
    assert.equal(callsTo('v1_create_task')[0].body.p_fields.images, undefined)
    assert.equal((await send('/v1/tasks', { method: 'POST', body: { title: 'Go', workflow: 'wf_own', images: [png('a.png')] } })).status, 201)
    assert.deepEqual(callsTo('v1_create_task')[1].body.p_fields.images, [png('a.png')])
    for (const images of [[png('a'), png('b'), png('c'), png('d'), png('e')], [{ ...png('a'), content: '%' }], 'a.png']) {
      assert.equal((await send('/v1/tasks', { method: 'POST', body: { title: 'Go', workflow: 'wf_own', images } })).status, 400, JSON.stringify(images))
    }
    const huge = { ...png('a'), content: 'A'.repeat(5_600_004) }
    assert.equal((await send('/v1/tasks', { method: 'POST', body: { title: 'Go', workflow: 'wf_own', images: [huge] } })).status, 413)
  })

  it('takes a new task’s card fields as the card’s metadata (#2108)', async () => {
    db.v1_create_task = () => ({ id: 'task_1' })
    const metadata = { priority: 'high', roi: 'low', modules: ['web'], related: ['3'], blocked_by: ['WC-2'] }
    assert.equal((await send('/v1/tasks', { method: 'POST', body: { title: 'Go', workflow: 'wf_own', metadata } })).status, 201)
    assert.deepEqual(callsTo('v1_create_task')[0].body.p_fields.metadata, metadata)
    for (const bad of [{ schedule: { action: 'refine' } }, { priority: 3 }, { blocked_by: 'WC-2' }]) {
      assert.equal((await send('/v1/tasks', { method: 'POST', body: { title: 'Go', workflow: 'wf_own', metadata: bad } })).status, 400, JSON.stringify(bad))
    }
  })

  it('starts a Workflow builder task on one of the workspace’s own workflows, never a built-in (#2004)', async () => {
    BUILTIN_WORKFLOWS.push({ id: 'wf_builtin_workflow_builder', name: 'Workflow builder', names: { en: 'Workflow builder', zh: '搭建工作流' }, description: '', lands: false, hash: 'h1', files: FILES })
    db.v1_create_task = ({ p_fields }) => ({ id: 'task_1', ...p_fields })
    const start = (context) => send('/v1/tasks', { method: 'POST', body: { title: 'Change it', workflow: 'wf_builtin_workflow_builder', run: true, context } })
    assert.equal((await start({ workflow: 'wf_own' })).status, 201)
    assert.deepEqual(callsTo('v1_create_task')[0].body.p_fields.context, { workflow: 'wf_own' })
    const builtin = await start({ workflow: 'wf_builtin_workflow_builder' })
    assert.equal(builtin.status, 403)
    assert.equal((await builtin.json()).error.code, 'read_only')
    assert.equal((await start({ workflow: 'wf_builtin_gone' })).status, 404)
    for (const bad of ['wf_own', { workflow: 'x' }, { workflow: 'wf_own', other: 1 }]) assert.equal((await start(bad)).status, 400, JSON.stringify(bad))
    assert.equal(callsTo('v1_create_task').length, 1)
  })

  it('lists only the official workflows the workspace installed (#2030)', async () => {
    BUILTIN_WORKFLOWS.push(
      { id: 'wf_builtin_site', name: 'Site', names: { en: 'Site', zh: '网站' }, description: '', lands: false, hash: 'h1', files: FILES },
      { id: 'wf_builtin_deck', name: 'Deck', names: { en: 'Deck', zh: '幻灯片' }, description: '', lands: false, hash: 'h2', files: FILES },
    )
    db.v1_builtin_versions = ({ p_builtins }) => Object.fromEntries(p_builtins.map((b) => [b.id, 1]))
    db.v1_installed_workflows = () => ['wf_builtin_deck']
    db.v1_list_workflows = () => ({ data: [{ id: 'wf_own' }], next: null })
    const list = await (await send('/v1/workflows?workspace=ws_team')).json()
    assert.deepEqual(list.data.map((w) => w.id), ['wf_builtin_deck', 'wf_own'])
    assert.equal(callsTo('v1_installed_workflows')[0].body.p_workspace, 'ws_team')

    const market = await (await send('/v1/marketplace/workflows?workspace=ws_team')).json()
    assert.deepEqual(market.data.map((w) => [w.id, w.installed]), [['wf_builtin_site', false], ['wf_builtin_deck', true]])
    assert.equal(market.next, null)
  })

  it('installs and uninstalls an official workflow for a workspace, an owner’s move (#2030)', async () => {
    BUILTIN_WORKFLOWS.push({ id: 'wf_builtin_site', name: 'Site', names: { en: 'Site', zh: '网站' }, description: '', lands: false, hash: 'h1', files: FILES })
    db.v1_builtin_versions = () => ({ wf_builtin_site: 2 })
    db.v1_install_workflow = ({ p_workspace, p_installed }) => ({ workspace: p_workspace ?? 'ws_me', installed: p_installed })
    const installed = await send('/v1/marketplace/workflows/wf_builtin_site/install', { method: 'POST', body: { workspace: 'ws_team' } })
    assert.equal(installed.status, 200)
    assert.deepEqual(await installed.json(), {
      id: 'wf_builtin_site', object: 'workflow', builtin: true, name: 'Site', names: { en: 'Site', zh: '网站' }, description: '', version: 2, installed: true,
    })
    assert.deepEqual(callsTo('v1_install_workflow')[0].body, {
      p_account: USER, p_workspace: 'ws_team', p_workflow: 'wf_builtin_site', p_installed: true, p_daily_write_budget: callsTo('v1_install_workflow')[0].body.p_daily_write_budget,
    })
    const removed = await send('/v1/marketplace/workflows/wf_builtin_site/uninstall', { method: 'POST' })
    assert.equal((await removed.json()).installed, false)
    assert.equal(callsTo('v1_install_workflow')[1].body.p_workspace, null)

    assert.equal((await send('/v1/marketplace/workflows/wf_builtin_gone/install', { method: 'POST' })).status, 404)
    assert.equal((await send('/v1/marketplace/workflows/wf_own/install', { method: 'POST' })).status, 404)
    assert.equal((await send('/v1/marketplace/workflows/wf_builtin_site/install', { method: 'POST', body: { workspace: 'nope' } })).status, 400)
    db.v1_install_workflow = () => json({ code: 'AKB14', message: 'Only an owner of this workspace can do this.' }, 400)
    const member = await send('/v1/marketplace/workflows/wf_builtin_site/install', { method: 'POST' })
    assert.equal(member.status, 403)
    assert.equal((await member.json()).error.code, 'owner_only')
  })

  it('reads the workflow version a task runs on from its project\'s board, written there the first time (#2081)', async () => {
    db.v1_task_workflow = ({ p_task }) => ({ object: 'workflow_version', project: 'prj_1', workflow: 'wf_own', version: 1, task: p_task,
      previews: ['a'], files: { 'WORKFLOW.md': 'Own', 'agents/a/AGENT.md': 'A' } })
    const read = await (await send('/v1/tasks/task_1/workflow')).json()
    assert.equal(read.task, 'task_1')
    assert.ok(!('project' in read) && !('previews' in read))
    assert.deepEqual(read.stages, [])
    assert.deepEqual(read.files, { 'WORKFLOW.md': 'Own', 'agents/a/AGENT.md': 'A' })
    assert.deepEqual(boards.project('prj_1').list('workflows/').map((r) => r.path), ['workflows/wf-own/WORKFLOW.md', 'workflows/wf-own/agents/a/AGENT.md'])
    boards.project('prj_1').commit([{ path: 'workflows/wf-own/WORKFLOW.md', content: 'Edited', base_seq: 1 }])
    assert.equal((await (await send('/v1/tasks/task_1/workflow')).json()).files['WORKFLOW.md'], 'Edited')
  })
})

describe('artifact files', () => {
  it('uploads to R2 and reads the file back through its version', async () => {
    db.v1_create_upload = ({ p_artifact }) => ({ id: 'upl_1', url: '/v1/uploads/upl_1', artifact: p_artifact })
    db.v1_upload_target = () => ({ key: 'artifacts/u/art_1/upl_1', content_type: 'image/png' })
    db.v1_finish_upload = ({ p_size }) => ({ id: 'upl_1', size: p_size, uploaded: true })
    db.v1_artifact_version = () => ({ version: 1, stored: { key: 'artifacts/u/art_1/upl_1', content_type: 'image/png' } })

    const upload = await (await send('/v1/artifacts/art_1/uploads', { method: 'POST', body: { content_type: 'image/png' } })).json()
    assert.equal(upload.max_size, 50 * 1024 * 1024)
    const put = await send(upload.url, { method: 'PUT', body: new Uint8Array([1, 2, 3]) })
    assert.equal(put.status, 200)
    assert.equal((await put.json()).size, 3)

    const meta = await (await send('/v1/artifacts/art_1/versions/1')).json()
    assert.equal(meta.stored, undefined)
    const file = await send('/v1/artifacts/art_1/versions/1/file')
    assert.equal(file.headers.get('content-type'), 'image/png')
    assert.deepEqual([...new Uint8Array(await file.arrayBuffer())], [1, 2, 3])
  })

  it('refuses a single PUT over 50 MB before reading it', async () => {
    db.v1_upload_target = () => ({ key: 'k', content_type: 'image/png', room: 10 * GB })
    const res = await send('/v1/uploads/upl_1', {
      method: 'PUT',
      body: new Uint8Array([1]),
      headers: { 'content-length': String(51 * 1024 * 1024) },
    })
    assert.equal(res.status, 413)
    assert.equal(bucket.objects.size, 0)
  })

  it('sends a large file in parts and completes it', async () => {
    const size = 50 * MB + 3
    db.v1_new_upload_key = () => ({ id: 'upl_big', key: 'artifacts/u/art_1/upl_big' })
    db.v1_create_upload = ({ p_id, p_multipart_id, p_size }) => ({ id: p_id, multipart: p_multipart_id, size: p_size })
    const parts = []
    db.v1_upload_target = () => ({ key: 'artifacts/u/art_1/upl_big', content_type: 'video/mp4', size, multipart_id: 'mp_1', parts, room: GB })
    db.v1_add_upload_part = ({ p_part, p_etag }) => {
      parts.push({ part: p_part, etag: p_etag })
      return { part: p_part }
    }
    db.v1_finish_upload = ({ p_size }) => ({ id: 'upl_big', size: p_size, uploaded: true })

    const res = await send('/v1/artifacts/art_1/uploads', { method: 'POST', body: { content_type: 'video/mp4', size } })
    const upload = await res.json()
    assert.equal(res.status, 201)
    assert.deepEqual(upload.parts, { count: 2, size: 50 * MB, url: '/v1/uploads/upl_big/parts/{part}' })
    assert.equal(callsTo('v1_create_upload')[0].body.p_multipart_id, 'mp_1')

    assert.equal((await send(upload.url, { method: 'POST' })).status, 409)
    assert.equal((await send('/v1/uploads/upl_big/parts/2', { method: 'PUT', body: new Uint8Array(4) })).status, 413)
    assert.equal((await send('/v1/uploads/upl_big/parts/3', { method: 'PUT', body: new Uint8Array(3) })).status, 400)
    assert.equal((await send('/v1/uploads/upl_big/parts/2', { method: 'PUT', body: new Uint8Array(3) })).status, 200)
    assert.equal((await send('/v1/uploads/upl_big/parts/1', { method: 'PUT', body: new Uint8Array(50 * MB) })).status, 200)
    const done = await send(upload.url, { method: 'POST' })
    assert.equal(done.status, 200)
    assert.equal((await done.json()).size, size)
    assert.equal(bucket.objects.get('artifacts/u/art_1/upl_big').byteLength, size)
  })
})

describe('plan quotas (#2017)', () => {
  it('makes a task whatever the plan’s running limit (#2209)', async () => {
    db.v1_create_task = () => ({ id: 'task_1' })
    assert.equal((await send('/v1/tasks', { method: 'POST', body: { title: 'One more', workflow: 'wf_own' } })).status, 201)
    assert.equal('p_max_tasks' in callsTo('v1_create_task')[0].body, false)
  })

  it('refuses a declared file over the plan’s limit before anything is written', async () => {
    const res = await send('/v1/artifacts/art_1/uploads', { method: 'POST', body: { size: 100 * MB + 1 } })
    assert.equal(res.status, 413)
    assert.equal((await res.json()).error.quota, 'file_size')
    assert.equal(callsTo('v1_create_upload').length, 0)
  })

  it('reads no more than the storage left, and takes back a file the account no longer has room for', async () => {
    db.v1_upload_target = () => ({ key: 'k', content_type: 'image/png', room: 2 })
    const res = await send('/v1/uploads/upl_1', { method: 'PUT', body: new Uint8Array(3) })
    assert.equal(res.status, 403)
    assert.equal((await res.json()).error.quota, 'storage')

    db.v1_upload_target = () => ({ key: 'k', content_type: 'image/png', room: 10 })
    db.v1_finish_upload = () => quotaRefusal('storage', GB)
    assert.equal((await send('/v1/uploads/upl_1', { method: 'PUT', body: new Uint8Array(3) })).status, 403)
    assert.deepEqual(bucket.deleted, ['k'])
  })
})

const MB = 1024 * 1024
const GB = 1024 * MB
const quotaRefusal = (quota, limit) =>
  new Response(JSON.stringify({ code: 'AKB23', message: 'used up', details: quota, hint: String(limit) }), { status: 400 })

describe('workspaces (#2045)', () => {
  const OWNER = '33333333-3333-4333-8333-333333333333'

  it('reads, creates, renames and deletes workspaces through their own functions', async () => {
    db.v1_list_workspaces = () => ({ data: [], next: null })
    db.v1_create_workspace = ({ p_fields }) => ({ id: 'ws_1', object: 'workspace', ...p_fields })
    db.v1_update_workspace = ({ p_fields }) => ({ id: 'ws_1', ...p_fields })
    assert.equal((await send('/v1/workspaces')).status, 200)
    assert.equal((await send('/v1/workspaces', { method: 'POST', body: { name: ' Studio ' } })).status, 201)
    assert.deepEqual(callsTo('v1_create_workspace')[0].body.p_fields, { name: 'Studio' })
    assert.equal((await send('/v1/workspaces', { method: 'POST', body: {} })).status, 400)
    assert.equal((await send('/v1/workspaces/ws_1', { method: 'PATCH', body: { name: 'Team' } })).status, 200)
    assert.equal((await send('/v1/workspaces/prj_1', { method: 'PATCH', body: { name: 'Team' } })).status, 400)
  })

  it('deletes a workspace’s files from R2 before its rows, and its projects’ boards after', async () => {
    boards.project('prj_1').commit([{ path: 'todo/1-a.md', content: 'A', base_seq: 0 }])
    db.v1_list_projects = () => ({ data: [{ id: 'prj_1' }], next: null })
    db.v1_workspace_files = () => ({ files: ['artifacts/a/1', 'artifacts/a/2'], multipart: [] })
    db.v1_delete_workspace = () => {
      assert.deepEqual(bucket.deleted, ['artifacts/a/1', 'artifacts/a/2'])
      return { id: 'ws_1', object: 'workspace', deleted: true }
    }
    assert.equal((await send('/v1/workspaces/ws_1', { method: 'DELETE' })).status, 200)
    assert.equal(callsTo('v1_delete_workspace').length, 1)
    assert.deepEqual(boards.project('prj_1').diff(null).files, [])
  })

  it('adds a member by email and changes or removes one by account', async () => {
    db.v1_add_member = ({ p_email }) => ({ object: 'workspace_member', email: p_email, role: 'member' })
    db.v1_update_member = ({ p_role }) => ({ role: p_role })
    db.v1_remove_member = () => ({ deleted: true })
    assert.equal((await send('/v1/workspaces/ws_1/members', { method: 'POST', body: { email: 'Mia@Studio.co' } })).status, 201)
    assert.equal(callsTo('v1_add_member')[0].body.p_email, 'mia@studio.co')
    assert.equal((await send('/v1/workspaces/ws_1/members', { method: 'POST', body: { email: 'mia' } })).status, 400)
    const member = `/v1/workspaces/ws_1/members/${OWNER}`
    assert.equal((await send(member, { method: 'PATCH', body: { role: 'owner' } })).status, 200)
    assert.equal((await send(member, { method: 'PATCH', body: { role: 'guest' } })).status, 400)
    assert.equal((await send('/v1/workspaces/ws_1/members/lin', { method: 'DELETE' })).status, 400)
    assert.equal((await send(member, { method: 'DELETE' })).status, 200)
    assert.deepEqual({ ...callsTo('v1_remove_member')[0].body, p_daily_write_budget: 0 }, { p_account: USER, p_workspace: 'ws_1', p_member: OWNER, p_daily_write_budget: 0 })
  })

  it('lists a workspace’s Runners and removes one by machine (#2134)', async () => {
    db.v1_list_workspace_runners = () => ({ runners: [] })
    db.v1_remove_workspace_runner = () => ({ stop: [], result: { deleted: true } })
    assert.equal((await send('/v1/workspaces/ws_1/runners')).status, 200)
    assert.deepEqual(callsTo('v1_list_workspace_runners')[0].body, { p_account: USER, p_workspace: 'ws_1' })
    assert.equal((await send('/v1/workspaces/ws_1/runners/mac', { method: 'DELETE' })).status, 400)
    assert.deepEqual(await (await send(`/v1/workspaces/ws_1/runners/${OWNER}`, { method: 'DELETE' })).json(), { deleted: true })
    assert.deepEqual({ ...callsTo('v1_remove_workspace_runner')[0].body, p_daily_write_budget: 0 },
      { p_account: USER, p_workspace: 'ws_1', p_machine: OWNER, p_daily_write_budget: 0 })
  })

  it('shares a computer with the workspace and ends the share (#2196)', async () => {
    db.v1_share_runner = ({ p_shared }) => ({ stop: [], result: { shared: p_shared } })
    const share = `/v1/workspaces/ws_1/runners/${OWNER}/share`
    assert.deepEqual(await (await send(share, { method: 'PUT' })).json(), { shared: true })
    assert.deepEqual(await (await send(share, { method: 'DELETE' })).json(), { shared: false })
    assert.deepEqual(callsTo('v1_share_runner').map((c) => [c.body.p_workspace, c.body.p_machine, c.body.p_shared]),
      [['ws_1', OWNER, true], ['ws_1', OWNER, false]])
    assert.equal((await send('/v1/workspaces/ws_1/runners/mac/share', { method: 'PUT' })).status, 400)
    db.v1_resume_task = ({ p_id, p_machine }) => ({ id: p_id, machine: p_machine })
    assert.deepEqual(await (await send('/v1/tasks/task_1/resume', { method: 'POST', body: { machine: OWNER } })).json(), { id: 'task_1', machine: OWNER })
    assert.equal((await send('/v1/tasks/task_1/resume', { method: 'POST', body: { machine: 'mac' } })).status, 400)
  })

  it('reads daily stats over whole days, a year at most, in an IANA zone (#2066)', async () => {
    db.v1_workspace_stats = () => ({ data: [], models: [] })
    const stats = (q) => send(`/v1/workspaces/ws_1/stats?${q}`)
    assert.equal((await stats('from=2026-01-01&to=2026-12-31&tz=Asia/Shanghai')).status, 200)
    assert.equal((await stats('from=2024-01-01&to=2024-12-31')).status, 200)
    assert.deepEqual(callsTo('v1_workspace_stats').map(({ body }) => body), [
      { p_account: USER, p_workspace: 'ws_1', p_from: '2026-01-01', p_to: '2026-12-31', p_tz: 'Asia/Shanghai' },
      { p_account: USER, p_workspace: 'ws_1', p_from: '2024-01-01', p_to: '2024-12-31', p_tz: 'UTC' },
    ])
    for (const q of ['to=2026-01-31', 'from=2026-02-30&to=2026-03-01', 'from=2026-03-02&to=2026-03-01',
      'from=2026-01-01&to=2027-01-01', 'from=2026-01-01&to=2026-01-31&tz=Mars/Base']) {
      assert.equal((await stats(q)).status, 400, q)
    }
    assert.equal(callsTo('v1_workspace_stats').length, 2)
  })

  it('takes the workspace a list reads off the query', async () => {
    db.v1_list_projects = () => ({ data: [], next: null })
    await send('/v1/projects?workspace=ws_1')
    await send('/v1/projects')
    assert.deepEqual(callsTo('v1_list_projects').map((c) => c.body.p_workspace), ['ws_1', null])
    assert.equal((await send('/v1/projects?workspace=nope')).status, 400)
  })

  it('wakes the streams of everyone the write concerns', async () => {
    db.v1_audience = () => [USER, OWNER]
    db.v1_update_project = () => ({ id: 'prj_1' })
    await send('/v1/projects/prj_1', { method: 'PATCH', body: { name: 'x' } })
    await idle()
    assert.equal(pokes, 2)
  })
})

describe('events', () => {
  it('pages the feed by event id', async () => {
    events = [1, 2, 3].map((n) => event(n))
    const page = await (await send('/v1/events?after=evt_1&limit=1')).json()
    assert.deepEqual(page.data.map((e) => e.id), ['evt_2'])
    assert.equal(page.next, 'evt_2')
  })

  it('leaves the v0.11 feed on a sign-in without after', async () => {
    db.list_events = () => ({ events: [], next: null })
    const res = await send('/v1/events')
    assert.deepEqual(await res.json(), { events: [], next: null })
  })

  it('streams from Last-Event-ID and pushes what is written after', async () => {
    events = [1, 2, 3].map((n) => event(n))
    const res = await send('/v1/events/stream', { headers: { 'last-event-id': 'evt_1' } })
    assert.equal(res.headers.get('content-type'), 'text/event-stream; charset=utf-8')
    const reader = res.body.getReader()
    const seen = await readUntil(reader, 'id: evt_3')
    assert.ok(!seen.includes('id: evt_1\n'))
    assert.ok(seen.includes('id: evt_2\nevent: task.updated\n'))

    events.push(event(4))
    db.v1_create_project = () => ({ id: 'prj_1' })
    await send('/v1/projects', { method: 'POST', body: { name: 'Site' } })
    assert.ok((await readUntil(reader, 'id: evt_4')).includes('id: evt_4'))
    await reader.cancel()
  })
})

describe('board files (#2081, #2114)', () => {
  const JOB = '22222222-2222-4222-8222-222222222222'
  const HOME = '33333333-3333-4333-8333-333333333333'
  const OTHER = '44444444-4444-4444-8444-444444444444'
  const CARD = 'todo/1-pricing.md'
  const P1 = 'projects/prj_1/'
  const P2 = 'projects/prj_2/'
  const commit = (files, machine = HOME, project = 'prj_1') =>
    send(`/v1/projects/${project}/board/commits`, { method: 'POST', body: { job: JOB, machine, files } })

  beforeEach(() => {
    db.v1_project = ({ p_id }) => ({ id: p_id, object: 'project', workspace: 'ws_1', general: false })
    db.v1_board_job = ({ p_machine }) => [HOME, OTHER].includes(p_machine) ? { job: JOB, task: 'task_aa' }
      : json({ code: 'AKB21', message: 'This job has ended or moved to another computer.' }, 400)
    db.v1_index_cards = ({ p_cards }) => ({ indexed: p_cards.length })
    db.v1_follow_cards = () => ({ stop: [] })
  })

  it('reads what changed since a seq in one call: the project’s own files and the shared memory, nothing of another project', async () => {
    boards.project('prj_1').commit([{ path: CARD, content: 'A', base_seq: 0 }])
    boards.project('prj_2').commit([{ path: 'todo/2-other.md', content: 'B', base_seq: 0 }])
    boards.of('ws_1').commit([{ path: 'memory/readme.md', content: 'M', base_seq: 0 }])
    assert.deepEqual(await (await send('/v1/projects/prj_1/board?since=1')).json(),
      { head_seq: 3, files: [{ path: 'memory/readme.md', content: 'M', seq: 3 }] })
    assert.deepEqual((await (await send('/v1/projects/prj_1/board')).json()).files.map((f) => f.path), ['memory/readme.md', P1 + CARD])
    assert.equal((await send('/v1/projects/prj_1/board?since=-1')).status, 400)
    db.v1_project = () => json({ code: 'AKB20', message: 'No project has this id.' }, 400)
    assert.equal((await send('/v1/projects/prj_1/board')).status, 404)
  })

  it('writes a job’s files and the shared memory together, indexing the cards by the project’s own paths', async () => {
    const done = await commit([
      { path: P1 + CARD, content: '---\ntitle: Pricing\nstatus: planning\n---\nBody', base_seq: 0 },
      { path: P1 + 'assets/task_aa.json', content: '{"a.png": {"artifact": "art_1"}}', base_seq: 0 },
      { path: P1 + 'memory/agents/planner/decisions.md', content: 'D', base_seq: 0 },
      { path: 'memory/agents/planner/rejected.md', content: 'R', base_seq: 0 },
    ])
    assert.equal(done.status, 200)
    assert.equal((await done.json()).head_seq, 1)
    assert.deepEqual(callsTo('v1_index_cards')[0].body.p_cards, [
      { number: 1, path: CARD, seq: 1, front: { title: 'Pricing', status: 'planning' }, links: { blocked_by: [], related: [], schedule: null } },
      { task: 'task_aa', assets: { 'a.png': { artifact: 'art_1' } } },
    ])
    assert.equal(boards.of('ws_1').read(['memory/agents/planner/rejected.md'])[0].content, 'R')
  })

  it('takes a computer’s write with no job, and brings each task to its card (#59)', async () => {
    const done = await send('/v1/projects/prj_1/board/commits', { method: 'POST', body: { machine: HOME, files: [
      { path: P1 + '.archive/1-pricing.md', content: '---\ntitle: Pricing\nstatus: rejected\nworkflow: wf-mine\nrejected: true\nrejected_reason: Too broad\n---\n', base_seq: 0 },
      { path: P1 + 'memory/readme.md', content: 'M', base_seq: 0 },
    ] } })
    assert.equal(done.status, 200)
    assert.equal(callsTo('v1_board_job')[0].body.p_job, null)
    assert.deepEqual(callsTo('v1_follow_cards')[0].body.p_cards,
      [{ number: 1, archived: true, rejected: true, reason: 'Too broad', workflow: { name: 'wf-mine' }, review: null }])
    db.v1_follow_cards = () => json({ message: 'boom' }, 500)
    assert.equal((await commit([{ path: P1 + CARD, content: 'A', base_seq: 0 }])).status, 200, 'a task that did not follow failed the write')
  })

  it('takes two computers’ writes to different projects of one workspace, and refuses a file both changed', async () => {
    await commit([{ path: P1 + CARD, content: 'A', base_seq: 0 }, { path: 'memory/tone.md', content: 'Plain', base_seq: 0 }])
    assert.equal((await commit([{ path: P2 + 'todo/2-task-bb.md', content: 'B', base_seq: 0 }], OTHER, 'prj_2')).status, 200)
    assert.equal((await commit([{ path: P1 + CARD, content: 'A, here', base_seq: 1 }])).status, 200)
    assert.equal((await commit([{ path: 'memory/tone.md', content: 'Plain, there', base_seq: 1 }], OTHER, 'prj_2')).status, 200)
    const refused = await commit([{ path: P1 + CARD, content: 'A, again', base_seq: 3 }, { path: 'memory/tone.md', content: 'Plain, here', base_seq: 1 }])
    assert.equal(refused.status, 409)
    const body = await refused.json()
    assert.equal(body.error.code, 'version_conflict')
    assert.deepEqual(body.files, [{ path: 'memory/tone.md', content: 'Plain, there', seq: 4 }])
    assert.equal(boards.project('prj_1').read([CARD])[0].content, 'A, here', 'a refused write saved its card')
  })

  it('refuses a job this computer no longer holds, and a file Cloud does not keep, cannot hold or another project owns', async () => {
    const lost = await commit([{ path: P1 + CARD, content: 'A', base_seq: 0 }], '55555555-5555-4555-8555-555555555555')
    assert.equal(lost.status, 409)
    assert.equal((await lost.json()).error.code, 'conflict')
    for (const files of [[{ path: P1 + 'next-id', content: '3', base_seq: 0 }], [{ path: P1 + '../x', content: 'x', base_seq: 0 }],
      [{ path: CARD, content: 'A', base_seq: 0 }], [{ path: P2 + CARD, content: 'A', base_seq: 0 }], [{ path: 'memory/x.png', content: 'x', base_seq: 0 }],
      [{ path: P1 + CARD, content: 'A', base_seq: 0 }, { path: P1 + CARD, content: null, base_seq: 0 }], [{ path: P1 + CARD, content: 'A' }]]) {
      assert.equal((await commit(files)).status, 400, JSON.stringify(files))
    }
    assert.equal((await commit([{ path: P1 + CARD, content: 'x'.repeat(256 * 1024 + 1), base_seq: 0 }])).status, 413)
    assert.deepEqual(boards.of('ws_1').diff(null).files, [])
  })

  describe('a refine scheduled on a card (#124)', () => {
    const front = ({ schedule, blockedBy = '' } = {}) => [
      '---', 'title: Pricing', 'status: todo', `blocked_by: [${blockedBy}]`,
      ...(schedule ? ['schedule:', `  action: ${schedule}`, '  notes: Be brief'] : []), '---', 'Body', '',
    ].join('\n')
    const started = () => callsTo('v1_start_scheduled_refine')
    const held = (path = CARD) => boards.project('prj_1').read([path])[0].content

    beforeEach(() => {
      db.v1_start_scheduled_refine = () => ({ started: true, verb: 'refine' })
      db.v1_card_place = ({ p_task }) => ({ task: p_task, project: 'prj_1', path: CARD, version: 0, metadata: {}, assets: {} })
      db.v1_card = ({ p_task }) => ({ object: 'card', task: p_task, project: 'prj_1', path: CARD, version: 2, metadata: {}, assets: {} })
    })

    it('starts a newly marked card as the push lands, once, and takes the mark off and reindexes', async () => {
      assert.equal((await commit([{ path: P1 + CARD, content: front({ schedule: 'refine' }), base_seq: 0 }])).status, 200)
      assert.deepEqual(started().map((c) => c.body), [{ p_project: 'prj_1', p_number: 1, p_notes: 'Be brief', p_machine: HOME }])
      assert.doesNotMatch(held(), /schedule:/)
      assert.equal(callsTo('v1_index_cards').at(-1).body.p_cards[0].links.schedule, null)
    })

    it('starts a card a PUT newly marked, on no computer in particular', async () => {
      boards.project('prj_1').commit([{ path: CARD, content: front(), base_seq: 0 }])
      const saved = await send('/v1/tasks/task_aa/card', { method: 'PUT', body: { body: front({ schedule: 'refine' }), base_version: 1 } })
      assert.equal(saved.status, 200)
      assert.deepEqual(started().map((c) => c.body.p_machine), [null])
      assert.doesNotMatch((await saved.json()).body, /schedule:/)
      assert.doesNotMatch(held(), /schedule:/)
    })

    it('leaves a mark the card already had, in place or moved, and any other action', async () => {
      db.v1_start_scheduled_refine = () => ({ started: false })
      const marked = front({ schedule: 'refine' })
      await commit([{ path: P1 + CARD, content: marked, base_seq: 0 }])
      calls.length = 0
      await commit([{ path: P1 + CARD, content: marked + 'More', base_seq: 1 }])
      assert.equal(started().length, 0, 'a mark already there started')
      await commit([{ path: P1 + CARD, content: null, base_seq: 2 }, { path: P1 + 'todo/1-group/1-pricing.md', content: marked, base_seq: 0 }])
      assert.equal(started().length, 0, 'a moved card started')
      await commit([{ path: P1 + 'todo/5-next.md', content: front({ schedule: 'implement' }), base_seq: 0 }])
      assert.equal(started().length, 0, 'another action started')
      await commit([{ path: P1 + '.archive/6-gone.md', content: marked, base_seq: 0 }])
      assert.equal(started().length, 0, 'an archived card started')
    })

    it('keeps the mark of a card the database would not start', async () => {
      db.v1_start_scheduled_refine = () => ({ started: false })
      const blocked = front({ schedule: 'refine', blockedBy: '2' })
      await commit([{ path: P1 + CARD, content: blocked, base_seq: 0 }])
      assert.equal(started().length, 1)
      assert.equal(held(), blocked)
    })

    it('keeps the mark and the write when the start fails', async () => {
      db.v1_start_scheduled_refine = () => json({ message: 'boom' }, 500)
      const marked = front({ schedule: 'refine' })
      assert.equal((await commit([{ path: P1 + CARD, content: marked, base_seq: 0 }])).status, 200)
      assert.equal(held(), marked)
    })
  })

  describe('a blocker taken off a card marked for a refine (#149)', () => {
    const front = ({ blockedBy = '', schedule = 'refine' } = {}) => [
      '---', 'title: Pricing', 'status: todo', `blocked_by: [${blockedBy}]`,
      'schedule:', `  action: ${schedule}`, '  notes: Be brief', '---', 'Body', '',
    ].join('\n')
    const released = () => callsTo('v1_release_scheduled_refine')
    const held = (path = CARD) => boards.project('prj_1').read([path])[0].content
    const seed = async (blockedBy = '2, 3') => {
      await commit([{ path: P1 + CARD, content: front({ blockedBy }), base_seq: 0 }])
      calls.length = 0
    }

    beforeEach(() => {
      db.v1_start_scheduled_refine = () => ({ started: false })
      db.v1_release_scheduled_refine = () => ({ started: true, verb: 'refine' })
      db.v1_card_place = ({ p_task }) => ({ task: p_task, project: 'prj_1', path: CARD, version: 0, metadata: {}, assets: {} })
      db.v1_card = ({ p_task }) => ({ object: 'card', task: p_task, project: 'prj_1', path: CARD, version: 2, metadata: {}, assets: {} })
    })

    it('starts the card once as the push lands, and takes the mark off and reindexes', async () => {
      await seed('2')
      assert.equal((await commit([{ path: P1 + CARD, content: front(), base_seq: 1 }])).status, 200)
      assert.deepEqual(released().map((c) => c.body), [{ p_project: 'prj_1', p_number: 1, p_notes: 'Be brief' }])
      assert.equal(callsTo('v1_start_scheduled_refine').length, 0)
      assert.doesNotMatch(held(), /schedule:/)
      assert.equal(callsTo('v1_index_cards').at(-1).body.p_cards[0].links.schedule, null)
    })

    it('starts the card a PUT took a blocker off', async () => {
      await seed('2')
      const saved = await send('/v1/tasks/task_aa/card', { method: 'PUT', body: { body: front(), base_version: 1 } })
      assert.equal(saved.status, 200)
      assert.equal(released().length, 1)
      assert.doesNotMatch((await saved.json()).body, /schedule:/)
    })

    it('leaves the deciding to the database when other blockers stay', async () => {
      db.v1_release_scheduled_refine = () => ({ started: false })
      await seed()
      const left = front({ blockedBy: '3' })
      await commit([{ path: P1 + CARD, content: left, base_seq: 1 }])
      assert.equal(released().length, 1)
      assert.equal(held(), left)
    })

    it('keeps the mark and the write when the start fails', async () => {
      db.v1_release_scheduled_refine = () => json({ message: 'boom' }, 500)
      await seed('2')
      const freed = front()
      assert.equal((await commit([{ path: P1 + CARD, content: freed, base_seq: 1 }])).status, 200)
      assert.equal(held(), freed)
    })

    it('starts nothing when blocked_by lost nothing, the card moved or the action is not refine', async () => {
      await seed('2')
      const same = front({ blockedBy: '2' })
      await commit([{ path: P1 + CARD, content: same + 'More', base_seq: 1 }])
      assert.equal(released().length, 0, 'an unchanged list started')
      const grown = front({ blockedBy: '2, 3' })
      await commit([{ path: P1 + CARD, content: grown, base_seq: 2 }])
      assert.equal(released().length, 0, 'a list that grew started')
      await commit([{ path: P1 + CARD, content: null, base_seq: 3 }, { path: P1 + 'todo/1-group/1-pricing.md', content: grown, base_seq: 0 }])
      assert.equal(released().length, 0, 'a moved card started')
      await commit([{ path: P1 + '.archive/5-gone.md', content: same, base_seq: 0 }])
      await commit([{ path: P1 + '.archive/5-gone.md', content: null, base_seq: 1 }, { path: P1 + 'todo/5-gone.md', content: front(), base_seq: 0 }])
      assert.equal(released().length, 0, 'a card back from the archive started')
      await commit([{ path: P1 + 'todo/6-open.md', content: same, base_seq: 0 }])
      await commit([{ path: P1 + 'todo/6-open.md', content: null, base_seq: 1 }, { path: P1 + '.archive/6-open.md', content: front(), base_seq: 0 }])
      assert.equal(released().length, 0, 'a card leaving the board started')
      await commit([{ path: P1 + 'todo/7-next.md', content: front({ blockedBy: '2', schedule: 'implement' }), base_seq: 0 }])
      await commit([{ path: P1 + 'todo/7-next.md', content: front({ schedule: 'implement' }), base_seq: 1 }])
      assert.equal(released().length, 0, 'another action started')
    })
  })

  it('hints the Runners of the projects a change touched, naming the computer that pushed it (#103)', async () => {
    db.v1_card_place = ({ p_task }) => ({ task: p_task, project: 'prj_1', path: CARD, version: 0, metadata: {}, assets: {} })
    db.v1_card = ({ p_task }) => ({ object: 'card', task: p_task, project: 'prj_1', path: CARD, version: 1, metadata: {}, assets: {} })
    const hints = async () => {
      await idle()
      return callsTo('hint_board').splice(0).map((c) => c.body)
    }
    await commit([{ path: P1 + CARD, content: 'A', base_seq: 0 }])
    assert.deepEqual(await hints(), [{ p_workspace: 'ws_1', p_projects: ['prj_1'], p_head: 1, p_machine: HOME }])
    calls.length = 0
    assert.equal((await send('/v1/tasks/task_aa/card', { method: 'PUT', body: { body: 'From the page', base_version: 1 } })).status, 200)
    assert.deepEqual((await hints()).map((h) => [h.p_projects, h.p_head, h.p_machine]), [[['prj_1'], 2, null]], 'a card saved on the page')
    calls.length = 0
    await commit([{ path: 'memory/tone.md', content: 'Plain', base_seq: 0 }])
    assert.deepEqual((await hints()).map((h) => h.p_projects), [null], 'shared memory is every project’s')
    calls.length = 0
    assert.equal((await commit([{ path: P1 + CARD, content: 'Stale', base_seq: 0 }])).status, 409)
    await commit([{ path: 'memory/tone.md', content: 'Plain', base_seq: 3 }])
    assert.deepEqual(await hints(), [], 'a refused write and one that changed nothing')
    db.hint_board = () => json({ message: 'boom' }, 500)
    assert.equal((await commit([{ path: P1 + CARD, content: 'B', base_seq: 2 }])).status, 200, 'a failed hint failed the write')
    await idle()
  })

  it('keeps a card saved on the page and a job’s push to it apart: the later one is refused, not lost', async () => {
    db.v1_card_place = ({ p_task }) => ({ task: p_task, project: 'prj_1', path: CARD, version: 0, metadata: {}, assets: {} })
    db.v1_card = ({ p_task }) => ({ object: 'card', task: p_task, project: 'prj_1', path: CARD, version: 1, metadata: {}, assets: {} })
    const saved = await send('/v1/tasks/task_aa/card', { method: 'PUT', body: { body: 'From the page', base_version: 0 } })
    assert.equal(saved.status, 200)
    assert.deepEqual(await saved.json(), { object: 'card', task: 'task_aa', version: 1, metadata: {}, assets: {}, body: 'From the page' })
    assert.equal(boards.of('ws_1').read([P1 + CARD])[0].content, 'From the page')
    const pushed = await commit([{ path: P1 + CARD, content: 'From the job', base_seq: 0 }])
    assert.equal(pushed.status, 409)
    assert.equal((await pushed.json()).files[0].content, 'From the page')
    assert.equal((await send('/v1/tasks/task_aa/card', { method: 'PUT', body: { body: 'Late', base_version: 0 } })).status, 409)
  })

  it('imports a board: tasks in order, cards of new ones and files written, Cloud’s shared memory kept, review set (#2123)', async () => {
    boards.of('ws_1').commit([{ path: 'memory/tone.md', content: 'Cloud’s', base_seq: 0 }])
    db.v1_import_tasks = ({ p_cards }) => ({ cards: p_cards.map((c, i) => ({ ref: c.ref, task: `task_${c.number}`, number: c.number, carded: i === 0 })), next: 4 })
    db.v1_task_workflow = () => json({ code: 'AKB20', message: 'No task has this id.' }, 400)
    db.v1_import_reviews = ({ p_reviews }) => p_reviews.length
    const card = (ref, number, path, extra = {}) => ({ ref, number, path, title: `Card ${ref}`, workflow: 'wf_own',
      body: `---\ntitle: Card ${ref}\nstatus: ready\n---\nBody`, ...extra })
    const res = await send('/v1/projects/prj_1/import', { method: 'POST', body: {
      board: 'b1',
      cards: [card(10, 1, 'todo/1-a.md'), card(12, 2, 'todo/2-grp/root.md', { review: true }),
        card(13, 3, 'todo/2-grp/3-sub.md', { review: { question: 'Which?', options: ['A', 'B'], position: 1 } })],
      files: [{ path: P1 + 'memory/readme.md', content: 'Shipped' }, { path: 'memory/tone.md', content: 'Local' }, { path: P1 + 'config.md', content: '' }],
    } })
    assert.equal(res.status, 200, await res.clone().text())
    assert.deepEqual(await res.json(), { cards: [{ ref: 10, task: 'task_1', number: 1 }, { ref: 12, task: 'task_2', number: 2 },
      { ref: 13, task: 'task_3', number: 3 }], kept: ['memory/tone.md'], next: 4 })
    assert.deepEqual(callsTo('v1_import_tasks')[0].body.p_cards[1], { ref: 12, number: 2, title: 'Card 12', workflow: 'wf_own' })
    assert.deepEqual(callsTo('v1_import_tasks')[0].body.p_workflows, { wf_own: { id: 'wf_own', builtin: false } })
    const ws = boards.of('ws_1')
    assert.equal(ws.read([P1 + 'todo/1-a.md']).length, 0, 'a card already written was written again')
    assert.equal(ws.read([P1 + 'todo/2-grp/3-sub.md'])[0].content.endsWith('Body'), true)
    assert.equal(ws.read(['memory/tone.md'])[0].content, 'Cloud’s')
    assert.equal(ws.read([P1 + 'memory/readme.md'])[0].content, 'Shipped')
    assert.deepEqual(callsTo('v1_index_cards')[0].body.p_cards.map((c) => [c.number, c.parent]), [[2, undefined], [3, 2]])
    assert.deepEqual(callsTo('v1_import_reviews')[0].body.p_reviews, [{ task: 'task_2', review: null },
      { task: 'task_3', review: { question: 'Which?', options: ['A', 'B'], position: 1 } }])

    for (const body of [{ board: 'b1', cards: [card(1, 2, 'todo/1-a.md')] }, { board: 'b1', cards: [card(1, 1, '.archive/1-a.md')] },
      { board: 'b1', cards: [card(1, 1, 'todo/1-a.md', { body: '```\nopen' })] }, { cards: [] },
      { board: 'b1', files: [{ path: P1 + 'todo/4-x.md', content: 'x' }] }, { board: 'b1', files: [{ path: P2 + 'memory/x.md', content: 'x' }] },
      { board: 'b1', cards: Array.from({ length: 51 }, (_, i) => card(i + 1, i + 1, `todo/${i + 1}-a.md`)) }]) {
      assert.ok([400, 413].includes((await send('/v1/projects/prj_1/import', { method: 'POST', body })).status), JSON.stringify(body).slice(0, 120))
    }
  })

  it('has no memory routes: memory is board files', async () => {
    assert.equal((await send('/v1/memories')).status, 404)
    assert.equal((await send('/v1/memories', { method: 'POST', body: { scope: 'workspace', name: 'a.md', body: 'x' } })).status, 404)
  })

  it('counts a project’s open triage items from its board', async () => {
    boards.project('prj_1').commit([{ path: 'triage/a.md', content: '---\ntitle: A\n---\n', base_seq: 0 },
      { path: 'triage/dismissed/b.md', content: '---\ntitle: B\n---\n', base_seq: 0 }])
    db.v1_project = ({ p_id }) => ({ id: p_id, object: 'project', workspace: 'ws_1', counts: { tasks: 2 } })
    assert.deepEqual((await (await send('/v1/projects/prj_1')).json()).counts, { tasks: 2, triage: 1 })
  })

  it('deletes a project’s files and nothing else, and stops its tasks’ runs', async () => {
    boards.project('prj_1').commit([{ path: CARD, content: 'A', base_seq: 0 }, { path: 'assets/task_aa.json', content: '{}', base_seq: 0 },
      { path: 'memory/readme.md', content: 'M', base_seq: 0 }])
    boards.project('prj_2').commit([{ path: 'todo/2-other.md', content: 'B', base_seq: 0 }])
    boards.of('ws_1').commit([{ path: 'memory/tone.md', content: 'Plain', base_seq: 0 }])
    const stopped = []
    env.RUN_LOGS = { idFromName: (name) => name, get: (name) => ({ fetch: async (url) => (stopped.push([name, String(url)]), new Response(null, { status: 204 })) }) }
    db.v1_delete_project = () => ({ id: 'prj_1', object: 'project', deleted: true, stop: ['job_1'] })
    const done = await send('/v1/projects/prj_1', { method: 'DELETE' })
    assert.deepEqual(await done.json(), { id: 'prj_1', object: 'project', deleted: true })
    assert.deepEqual(boards.of('ws_1').diff(null).files.map((f) => f.path), ['memory/tone.md', 'projects/prj_2/todo/2-other.md'])
    await idle()
    assert.deepEqual(stopped, [['job_1', 'https://run-log/stop']])
    delete env.RUN_LOGS
  })

  it('moves a task’s card to its new project in one write, under the number it has there', async () => {
    boards.project('prj_1').commit([{ path: CARD, content: 'A', base_seq: 0 }])
    db.v1_card = () => ({ project: 'prj_1', path: CARD })
    db.v1_update_task = () => ({ id: 'task_aa', project: 'prj_2', key: 'SITE-7' })
    assert.equal((await send('/v1/tasks/task_aa', { method: 'PATCH', body: { project: 'prj_2' } })).status, 200)
    assert.deepEqual(boards.of('ws_1').diff(1).files.map((f) => [f.path, f.content, f.seq]), [[P1 + CARD, null, 2], [P2 + 'todo/7-pricing.md', 'A', 2]])
    assert.deepEqual(callsTo('v1_index_cards').at(-1).body.p_cards.map((e) => [e.number, e.path]), [[7, 'todo/7-pricing.md']])
  })

  it('moves each project’s old board and the parked memory into its workspace’s once, with the service key alone', async () => {
    boards.of('prj_1').commit([{ path: CARD, content: '---\ntitle: A\n---\n', base_seq: 0 }, { path: 'memory/readme.md', content: 'Own', base_seq: 0 }])
    let parked = {
      projects: ['prj_1', 'prj_un'],
      files: [{ path: 'memory/tone.md', content: 'Plain' }, { path: 'projects/prj_un/memory/tone.md', content: 'Plain' }],
    }
    db.v1_board_move = () => parked
    db.v1_board_moved = ({ p_cards }) => {
      parked = { projects: [], files: [] }
      return { indexed: p_cards.length }
    }
    const post = (key) => worker.fetch(new Request('https://api.ai4kanban.dev/internal/workspaces/ws_1/board-move', {
      method: 'POST', headers: { authorization: `Bearer ${key}` } }), env, ctx)
    assert.equal((await post('nope')).status, 401)
    assert.deepEqual(await (await post('service-role')).json(), { files: 4 })
    assert.deepEqual(callsTo('v1_board_moved')[0].body.p_cards, [{ project: 'prj_1', number: 1, path: CARD, seq: 1 }])
    assert.deepEqual(boards.of('ws_1').diff(null).files.map((f) => [f.path, f.content]), [
      ['memory/tone.md', 'Plain'], [P1 + 'memory/readme.md', 'Own'], [P1 + CARD, '---\ntitle: A\n---\n'], ['projects/prj_un/memory/tone.md', 'Plain']])
    assert.deepEqual(await (await post('service-role')).json(), { files: 0 }, 'a second run moved again')
    assert.equal(boards.of('ws_1').diff(null).head_seq, 1, 'a second run wrote again')
  })
})

describe('the agents page (#2106)', () => {
  const CODING = {
    'WORKFLOW.md': '---\nname: Coding\npreviews:\n  - agent: software-planner\n  - agent: ui-designer\n  - agent: copywriting\n    off: true\nland: [builder]\nscheduled:\n  - agent: qa-manager\n---\n',
    'agents/software-planner/AGENT.md': '---\nname: software-planner\ndescription: Plans.\nakb:\n  i18n:\n    zh:\n      title: 软件规划师\n---\nPlan.',
    'agents/ui-designer/AGENT.md': '---\nname: ui-designer\ndescription: Designs.\nakb:\n  when: A card has a screen.\n---\nDesign.',
    'agents/copywriting/AGENT.md': '---\nname: copywriting\ndescription: Writes.\n---\nWrite.',
    'agents/qa-manager/AGENT.md': '---\nname: qa-manager\ndescription: Tests.\n---\nTest.',
  }
  const board = () => boards.project('prj_1')
  const file = (p) => board().read([p])[0]?.content ?? null
  const agents = async () => (await send('/v1/projects/prj_1/agents')).json()
  let schedules = []

  beforeEach(() => {
    BUILTIN_WORKFLOWS.push({ id: 'wf_builtin_coding', name: 'Coding', names: { en: 'Coding', zh: '软件开发' }, description: '', lands: true, hash: 'h1', files: CODING })
    db.v1_project = ({ p_id }) => ({ id: p_id, object: 'project', workspace: 'ws_1' })
    db.v1_project_write = () => null
    db.v1_installed_workflows = () => ['wf_builtin_coding']
    db.v1_agent_runs = () => [{ agent: 'prune-memory', workflow: null, at: '2026-10-26T08:00:00.000Z', status: 'failed', last_success: '2026-10-20T08:00:00.000Z' }]
    db.v1_run_agent = () => true
    schedules = []
    db.v1_agent_schedules = () => schedules
    db.v1_set_agent_schedules = ({ p_rows }) => {
      for (const r of p_rows) {
        schedules = schedules.filter((s) => s.agent !== r.agent || s.workflow !== r.workflow)
        if (!r.on || r.cadence !== null) schedules.push(r)
      }
      return null
    }
    board().commit([
      { path: 'workflows/wf-builtin-coding/WORKFLOW.md', content: CODING['WORKFLOW.md'], base_seq: 0 },
      { path: 'workflows/wf-0190ab/WORKFLOW.md', content: '---\nname: Blog\npreviews: [blog-planner, blog-writer]\n---\n', base_seq: 0 },
      { path: 'workflows/wf-0190ab/agents/blog-planner/AGENT.md', content: '---\nname: blog-planner\ndescription: Plans posts.\n---\nPlan.', base_seq: 0 },
      { path: 'workflows/wf-0190ab/agents/blog-writer/AGENT.md', content: '---\nname: blog-writer\ndescription: Writes posts.\nakb:\n  after: [blog-planner]\n---\nWrite.', base_seq: 0 },
      { path: 'workflows/task-0190cd/WORKFLOW.md', content: '---\nname: Draft\n---\n', base_seq: 0 },
      { path: 'rules/builder.md', content: 'Use pnpm.\n', base_seq: 0 },
    ])
  })

  it('lists the workflows the board holds, built-ins first, each with its previews and their approvals, what lands it and its scheduled agents, and the board’s own scheduled agents', async () => {
    const got = await agents()
    assert.deepEqual(got.workflows.map((w) => [w.id, w.builtin, w.previews, w.stages, w.land, w.scheduled]), [
      ['wf_builtin_coding', true, ['software-planner', 'ui-designer'], [['software-planner', 'ui-designer']], ['builder'], ['qa-manager']],
      ['wf_0190ab', false, ['blog-planner', 'blog-writer'], [['blog-planner'], ['blog-writer']], [], []],
    ])
    assert.deepEqual(got.board, ['proposer', 'project-writer', 'dismissal-reviewer', 'memory-pruner'])
    const by = Object.fromEntries(got.data.map((a) => [a.agent, a]))
    assert.deepEqual(by['software-planner'].title, { zh: '软件规划师' })
    assert.deepEqual(by['software-planner'].description, { en: 'Plans.' })
    assert.equal(by.builder.rule, 'Use pnpm.')
    assert.equal(by.builder.schedule, null)
    assert.deepEqual(by['qa-manager'].schedule, { on: true, cadence: 'auto', default: 'auto', last_success: null })
    assert.deepEqual(by['memory-pruner'].last_run, { at: '2026-10-26T08:00:00.000Z', status: 'failed' })
    assert.equal(by['memory-pruner'].schedule.last_success, '2026-10-20T08:00:00.000Z')
  })

  it('names the previews a shared card draws, by language: a built-in’s even before install, a project’s own, none for a nameless one (#34)', async () => {
    board().commit([
      { path: 'workflows/wf-0190ab/agents/brief/AGENT.md', content: '---\nname: brief\ndescription: Briefs.\nakb:\n  i18n:\n    zh:\n      title: 简报\n---\nBrief.', base_seq: 0 },
      { path: 'todo/7-a.md', content: '---\ntitle: A\n---\n\n## By `ui-designer` agent\n\nx\n\n## By `brief` agent\n\ny\n\n## By `stranger` agent\n\nz\n', base_seq: 0 },
    ])
    db.v1_shared = () => ({ artifacts: [], card: { project: 'prj_1', path: 'todo/7-a.md', version: 1 } })
    const res = await worker.fetch(new Request('https://api.ai4kanban.dev/v1/shared/tok_abcdefghijklmnopqrstuvwxyz0123456789'), env, ctx)
    assert.deepEqual((await res.json()).names, { 'ui-designer': { en: 'UI design', zh: '界面设计' }, brief: { zh: '简报' } })
  })

  it('lists an installed built-in before a task writes its folder, and saves its rules (#2170)', async () => {
    board().commit([{ path: 'workflows/wf-builtin-coding/WORKFLOW.md', content: null, base_seq: 1 }])
    db.v1_project = ({ p_id }) => ({ id: p_id, object: 'project', workspace: 'ws_team' })
    const got = await agents()
    assert.deepEqual(got.workflows.map((w) => [w.id, w.previews]), [['wf_builtin_coding', ['software-planner', 'ui-designer']], ['wf_0190ab', ['blog-planner', 'blog-writer']]])
    assert.equal(callsTo('v1_installed_workflows')[0].body.p_workspace, 'ws_team')
    assert.equal((await send('/v1/projects/prj_1/workflows/wf_builtin_coding/rule', { method: 'PUT', body: { rule: 'Titles in English.' } })).status, 200)
    assert.equal(file('rules/workflows/coding.md'), 'Titles in English.\n')
    assert.equal((await send('/v1/projects/prj_1/agents/qa-manager', { method: 'PUT', body: { rule: 'Smoke only.' } })).status, 200)
    assert.equal(file('rules/qa-manager.md'), 'Smoke only.\n')

    db.v1_installed_workflows = () => []
    assert.deepEqual((await agents()).workflows.map((w) => w.id), ['wf_0190ab'], 'an uninstalled one is not listed')
  })

  it('writes a rule on the board and a schedule in Cloud, by job, clears them, and refuses what is not one', async () => {
    const put = (agent, body) => send(`/v1/projects/prj_1/agents/${agent}`, { method: 'PUT', body })
    const saved = await put('software-planner', { rule: '  List files first.  ' })
    assert.equal(saved.status, 200)
    assert.equal((await saved.json()).rule, 'List files first.')
    assert.equal(file('rules/software-planner.md'), 'List files first.\n')
    assert.equal((await put('builder', { rule: '' })).status, 200)
    assert.equal(file('rules/builder.md'), null)

    assert.deepEqual((await (await put('memory-pruner', { schedule: { on: true, cadence: '1d at 09:30' } })).json()).schedule,
      { on: true, cadence: '1d at 09:30', default: 'auto', last_success: '2026-10-20T08:00:00.000Z' })
    await put('qa-manager', { schedule: { on: false, cadence: 'auto' } })
    assert.deepEqual(schedules, [
      { agent: 'prune-memory', workflow: null, on: true, cadence: '1d at 09:30' },
      { agent: 'qa-manager', workflow: 'wf_builtin_coding', on: false, cadence: null },
    ])
    assert.equal((await agents()).data.find((a) => a.agent === 'qa-manager').schedule.on, false)
    assert.equal(file('schedules.md'), null, 'the schedule went on the board')
    await put('memory-pruner', { schedule: { on: true, cadence: 'AUTO' } })
    await put('qa-manager', { schedule: { on: true, cadence: 'auto' } })
    assert.deepEqual(schedules, [], 'defaults were kept')

    assert.equal((await put('builder', { schedule: { on: false, cadence: 'auto' } })).status, 400)
    assert.equal((await put('qa-manager', { schedule: { on: true, cadence: 'every hour' } })).status, 400)
    assert.equal((await put('qa-manager', {})).status, 400)
    assert.equal((await put('nobody', { rule: 'x' })).status, 404)
    assert.equal((await put('Bad_Name', { rule: 'x' })).status, 404)
    db.v1_project_write = () => json({ code: 'AKB20', message: 'No project has this id.' }, 400)
    assert.equal((await put('builder', { rule: 'x' })).status, 404)
  })

  it('writes a workflow’s rule on the board under akb’s name for it, clears it, and refuses what is not one (#2166)', async () => {
    const put = (workflow, body) => send(`/v1/projects/prj_1/workflows/${workflow}/rule`, { method: 'PUT', body })
    assert.deepEqual((await agents()).workflows.map((w) => w.rule), ['', ''])
    const saved = await put('wf_builtin_coding', { rule: '  Titles in English.  ' })
    assert.equal(saved.status, 200)
    assert.equal((await saved.json()).rule, 'Titles in English.')
    assert.equal(file('rules/workflows/coding.md'), 'Titles in English.\n')
    await put('wf_0190ab', { rule: 'Short posts.' })
    assert.equal(file('rules/workflows/wf-0190ab.md'), 'Short posts.\n')
    assert.deepEqual((await agents()).workflows.map((w) => w.rule), ['Titles in English.', 'Short posts.'])
    assert.equal((await put('wf_builtin_coding', { rule: '' })).status, 200)
    assert.equal(file('rules/workflows/coding.md'), null)

    assert.equal((await put('wf_builtin_coding', {})).status, 400)
    assert.equal((await put('wf_builtin_coding', { rule: 3 })).status, 400)
    assert.equal((await put('wf_nobody', { rule: 'x' })).status, 404)
    assert.equal((await put('task_0190cd', { rule: 'x' })).status, 404)
    db.v1_project_write = () => json({ code: 'AKB20', message: 'No project has this id.' }, 400)
    assert.equal((await put('wf_0190ab', { rule: 'x' })).status, 404)
    assert.equal(file('rules/workflows/wf-0190ab.md'), 'Short posts.\n')
  })

  it('moves a project’s schedules.md into Cloud by job, in every workflow listing the agent, and drops the file', async () => {
    board().commit([{ path: 'schedules.md', content: '# Schedules\n\n- proposer: off\n- memory-pruner: on, 3d\n- qa-manager: on, auto\n- nobody: off\n', base_seq: 0 }])
    db.move_agent_schedules = () => null
    const post = (key) => worker.fetch(new Request('https://api.ai4kanban.dev/internal/projects/prj_1/schedules-move', {
      method: 'POST', headers: { authorization: `Bearer ${key}` } }), env, ctx)
    assert.equal((await post('nope')).status, 401)
    assert.deepEqual(await (await post('service-role')).json(), { agents: 3 })
    assert.deepEqual(callsTo('move_agent_schedules')[0].body.p_rows, [
      { agent: 'reflect', workflow: null, on: false, cadence: null },
      { agent: 'prune-memory', workflow: null, on: true, cadence: '3d' },
      { agent: 'qa-manager', workflow: 'wf_builtin_coding', on: true, cadence: null },
    ])
    assert.equal(file('schedules.md'), null)
    assert.deepEqual(await (await post('service-role')).json(), { agents: 0 }, 'a second run moved again')
  })

  it('runs a scheduled agent now, a board one as its periodic job', async () => {
    const run = (agent) => send(`/v1/projects/prj_1/agents/${agent}/run`, { method: 'POST' })
    assert.deepEqual(await (await run('memory-pruner')).json(), { agent: 'memory-pruner', queued: true })
    assert.deepEqual(await (await run('qa-manager')).json(), { agent: 'qa-manager', queued: true })
    assert.deepEqual(callsTo('v1_run_agent').map((c) => [c.body.p_agent, c.body.p_workflow]), [['prune-memory', null], ['qa-manager', 'wf_builtin_coding']])
    assert.equal((await run('builder')).status, 400)
  })
})

describe('tasks run by the Runner (#2020)', () => {
  it('hands a task to the Runner only on run: true', async () => {
    BUILTIN_WORKFLOWS.push({ id: 'wf_builtin_coding', name: 'Coding', names: { en: 'Coding', zh: '软件开发' }, description: '', lands: true, hash: 'h', files: {} })
    db.v1_create_task = ({ p_fields }) => ({ id: 'task_1', ...p_fields })
    await send('/v1/tasks', { method: 'POST', body: { title: 'Go', workflow: 'wf_builtin_coding', run: true } })
    await send('/v1/tasks', { method: 'POST', body: { title: 'Go', workflow: 'wf_builtin_coding', run: false } })
    assert.deepEqual(callsTo('v1_create_task').map((c) => c.body.p_fields.run), [true, undefined])
    assert.equal((await send('/v1/tasks', { method: 'POST', body: { title: 'Go', workflow: 'wf_builtin_coding', run: 'yes' } })).status, 400)
    assert.equal(callsTo('v1_create_task').length, 2)
  })

  it('reads, sends and clears the caller’s own chat, and lists their chats', async () => {
    const chat = { object: 'task_chat', messages: [], status: 'idle' }
    db.v1_task_chat = ({ p_task }) => ({ ...chat, p_task })
    db.v1_task_chat_send = ({ p_task, p_body, p_runtime }) => ({ ...chat, status: 'replying', p_task, p_body, p_runtime })
    db.v1_task_chat_clear = () => chat
    db.v1_list_chats = ({ p_workspace, p_after, p_limit }) => ({ data: [], next: null, p_workspace, p_after, p_limit })
    assert.equal((await (await send('/v1/tasks/task_1/chat')).json()).p_task, 'task_1')
    const sent = await send('/v1/tasks/task_1/chat', { method: 'POST', body: { body: ' Fewer tiers? ' } })
    assert.equal(sent.status, 200)
    assert.deepEqual(await sent.json(), { ...chat, status: 'replying', p_task: 'task_1', p_body: 'Fewer tiers?', p_runtime: null })
    for (const runtime of ['task', 'rt_1']) {
      const res = await send('/v1/tasks/task_1/chat', { method: 'POST', body: { body: 'hi', runtime } })
      assert.equal((await res.json()).p_runtime, runtime)
    }
    for (const runtime of ['codex', 'claude-code', 7]) {
      assert.equal((await send('/v1/tasks/task_1/chat', { method: 'POST', body: { body: 'hi', runtime } })).status, 400, runtime)
    }
    db.v1_task_chat_send = () => json({ code: 'AKB30', message: 'x', details: 'codex', hint: 'signed_out' }, 400)
    const unavailable = await send('/v1/tasks/task_1/chat', { method: 'POST', body: { body: 'hi', runtime: 'task' } })
    assert.equal(unavailable.status, 409)
    assert.deepEqual(
      (({ code, connector, reason }) => ({ code, connector, reason }))((await unavailable.json()).error),
      { code: 'runtime_unavailable', connector: 'codex', reason: 'signed_out' },
    )
    assert.equal((await send('/v1/tasks/task_1/chat', { method: 'DELETE' })).status, 200)
    // Pictures (#2133): alone or with words, at most four, named apart.
    const png = (name) => ({ name, type: 'image/png', content: 'aGk=' })
    db.v1_task_chat_send = ({ p_body, p_images }) => ({ ...chat, p_body, p_images })
    const pictured = await (await send('/v1/tasks/task_1/chat', { method: 'POST', body: { images: [png('a.png'), png('a.png')] } })).json()
    assert.deepEqual([pictured.p_body, pictured.p_images.map((i) => i.name)], ['', ['a.png', 'a-2.png']])
    for (const images of [[png('a.png'), png('b'), png('c'), png('d'), png('e')], [{ ...png('a'), type: 'text/plain' }], [{ ...png('a'), content: '%' }], [png('../a')]]) {
      assert.equal((await send('/v1/tasks/task_1/chat', { method: 'POST', body: { images } })).status, 400, JSON.stringify(images))
    }
    assert.equal((await send('/v1/tasks/task_1/chat', { method: 'POST', body: { body: ' ' } })).status, 400)
    // Stop: a running reply's Runner is told over its log.
    const stopped = []
    env.RUN_LOGS = { idFromName: (name) => name, get: (name) => ({ fetch: async (url) => (stopped.push([name, String(url)]), new Response(null, { status: 204 })) }) }
    db.v1_task_chat_stop = ({ p_task }) => ({ job: 'job_1', result: { ...chat, p_task } })
    assert.deepEqual(await (await send('/v1/tasks/task_1/chat/stop', { method: 'POST' })).json(), { ...chat, p_task: 'task_1' })
    db.v1_task_chat_stop = () => ({ job: null, result: chat })
    await send('/v1/tasks/task_1/chat/stop', { method: 'POST' })
    await idle()
    assert.deepEqual(stopped, [['job_1', 'https://run-log/stop']])
    // A task's run (#2128): stopped the same way, resumed as a plain write.
    db.v1_stop_task = ({ p_id }) => ({ job: 'job_2', result: { id: p_id } })
    assert.deepEqual(await (await send('/v1/tasks/task_1/stop', { method: 'POST' })).json(), { id: 'task_1' })
    db.v1_resume_task = ({ p_id }) => ({ id: p_id, status: 'queued' })
    assert.deepEqual(await (await send('/v1/tasks/task_1/resume', { method: 'POST' })).json(), { id: 'task_1', status: 'queued' })
    // A discarded build (#61) stops its running step the same way.
    db.v1_discard_task = ({ p_id }) => ({ job: 'job_3', result: { id: p_id, status: 'waiting_review' } })
    assert.deepEqual(await (await send('/v1/tasks/task_1/discard', { method: 'POST' })).json(), { id: 'task_1', status: 'waiting_review' })
    await idle()
    assert.deepEqual(stopped.slice(-2), [['job_2', 'https://run-log/stop'], ['job_3', 'https://run-log/stop']])
    delete env.RUN_LOGS
    const list = await (await send('/v1/chats?workspace=ws_2&limit=5&after=task_9')).json()
    assert.deepEqual([list.p_workspace, list.p_after, list.p_limit], ['ws_2', 'task_9', 5])
    assert.equal((await send('/v1/chats?after=x')).status, 400)
  })
})

describe('discussions (#2073)', () => {
  const discussion = { object: 'discussion', id: 'dsc_1', workspace: 'ws_1', ideas: [{ id: 'idea_1', workflow: 'wf_builtin_coding', task: null }] }
  const coding = { id: 'wf_builtin_coding', name: 'Coding', names: { en: 'Coding', zh: '软件开发' }, description: '', lands: true, hash: 'h', files: {} }

  it('starts one with its first message, and reads, sends, clears and deletes it', async () => {
    db.v1_create_discussion = ({ p_fields }) => ({ ...discussion, p_fields })
    db.v1_discussion = ({ p_id }) => ({ ...discussion, id: p_id })
    db.v1_discussion_send = ({ p_id, p_body, p_runtime }) => ({ ...discussion, p_id, p_body, p_runtime })
    db.v1_discussion_clear = () => discussion
    db.v1_delete_discussion = ({ p_id }) => ({ id: p_id, object: 'discussion', deleted: true })
    const made = await send('/v1/discussions', { method: 'POST', body: { body: ' Add a pricing page ', project: 'prj_1', runtime: 'rt_1' } })
    assert.equal(made.status, 201)
    assert.deepEqual((await made.json()).p_fields, { project: 'prj_1', body: 'Add a pricing page', runtime: 'rt_1' })
    for (const body of [{}, { body: ' ' }, { body: 'x', runtime: 'task' }, { body: 'x', project: 'p' }, { body: 'x', workspace: 'w' }]) {
      assert.equal((await send('/v1/discussions', { method: 'POST', body })).status, 400, JSON.stringify(body))
    }
    // Pictures go with the first message (#2182), checked as a chat's.
    const png = (name) => ({ name, type: 'image/png', content: 'aGk=' })
    const pictured = await (await send('/v1/discussions', { method: 'POST', body: { images: [png('a.png'), png('a.png')] } })).json()
    assert.deepEqual(pictured.p_fields, { body: '', images: [png('a.png'), png('a-2.png')] })
    for (const images of [[png('a'), png('b'), png('c'), png('d'), png('e')], [{ ...png('a'), type: 'text/plain' }], [png('../a')]]) {
      assert.equal((await send('/v1/discussions', { method: 'POST', body: { body: 'x', images } })).status, 400, JSON.stringify(images))
    }
    const huge = { ...png('a'), content: 'A'.repeat(5_600_004) }
    assert.equal((await send('/v1/discussions', { method: 'POST', body: { body: 'x', images: [huge] } })).status, 413)
    assert.equal((await (await send('/v1/discussions/dsc_1')).json()).id, 'dsc_1')
    assert.equal((await send('/v1/discussions/task_1')).status, 400)
    const sent = await (await send('/v1/discussions/dsc_1/chat', { method: 'POST', body: { body: 'More' } })).json()
    assert.deepEqual([sent.p_id, sent.p_body, sent.p_runtime], ['dsc_1', 'More', null])
    assert.equal((await send('/v1/discussions/dsc_1/chat', { method: 'POST', body: { body: 'x', runtime: 'task' } })).status, 400)
    assert.equal((await send('/v1/discussions/dsc_1/chat', { method: 'DELETE' })).status, 200)
    assert.equal((await (await send('/v1/discussions/dsc_1', { method: 'DELETE' })).json()).deleted, true)
    db.v1_discussion_send = () => json({ code: 'AKB26', message: 'x', details: 'chat_busy' }, 400)
    assert.equal((await (await send('/v1/discussions/dsc_1/chat', { method: 'POST', body: { body: 'x' } })).json()).error.code, 'chat_busy')
  })

  it('changes and discards an idea', async () => {
    db.v1_update_idea = ({ p_discussion, p_idea, p_workflow }) => ({ p_discussion, p_idea, p_workflow })
    db.v1_drop_idea = ({ p_discussion, p_idea }) => ({ p_discussion, p_idea })
    const changed = await (await send('/v1/discussions/dsc_1/ideas/idea_1', { method: 'PATCH', body: { workflow: 'wf_builtin_slide_deck' } })).json()
    assert.deepEqual(changed, { p_discussion: 'dsc_1', p_idea: 'idea_1', p_workflow: 'wf_builtin_slide_deck' })
    assert.equal((await send('/v1/discussions/dsc_1/ideas/idea_1', { method: 'PATCH', body: { workflow: 'coding' } })).status, 400)
    assert.deepEqual(await (await send('/v1/discussions/dsc_1/ideas/idea_1', { method: 'DELETE' })).json(), { p_discussion: 'dsc_1', p_idea: 'idea_1' })
    db.v1_drop_idea = () => json({ code: 'AKB21', message: 'This idea has already been started.' }, 400)
    assert.equal((await send('/v1/discussions/dsc_1/ideas/idea_1', { method: 'DELETE' })).status, 409)
  })

  it('starts an idea on its workflow', async () => {
    BUILTIN_WORKFLOWS.push(coding)
    db.v1_discussion = () => discussion
    db.v1_start_idea = ({ p_discussion, p_idea, p_project, p_workflow, p_skip_plan }) =>
      ({ id: 'task_1', p_discussion, p_idea, p_project, workflow: p_workflow.id, builtin: p_workflow.builtin, p_skip_plan })
    db.v1_task_workflow = () => json({ code: 'AKB20', message: 'No task has this id.' }, 400)
    const started = await send('/v1/discussions/dsc_1/ideas/idea_1/start', { method: 'POST', body: { project: 'prj_2' } })
    assert.equal(started.status, 201)
    assert.deepEqual(await started.json(), { id: 'task_1', p_discussion: 'dsc_1', p_idea: 'idea_1', p_project: 'prj_2', workflow: 'wf_builtin_coding', builtin: true, p_skip_plan: false })
    const built = await send('/v1/discussions/dsc_1/ideas/idea_1/start', { method: 'POST', body: { skip_plan: true } })
    assert.equal((await built.json()).p_skip_plan, true)
    assert.equal((await send('/v1/discussions/dsc_1/ideas/idea_1/start', { method: 'POST', body: { skip_plan: 'yes' } })).status, 400)
    assert.equal((await send('/v1/discussions/dsc_1/ideas/idea_1/start', { method: 'POST' })).status, 201)
    assert.equal((await send('/v1/discussions/dsc_1/ideas/idea_9/start', { method: 'POST' })).status, 404)
    db.v1_discussion = () => ({ ...discussion, ideas: [{ ...discussion.ideas[0], task: { id: 'task_1', key: 'S-1' } }] })
    assert.equal((await send('/v1/discussions/dsc_1/ideas/idea_1/start', { method: 'POST' })).status, 409)
    assert.equal(callsTo('v1_start_idea').length, 3)
  })

  it('lists after a task or a discussion', async () => {
    db.v1_list_chats = ({ p_after }) => ({ data: [], next: null, p_after })
    assert.equal((await (await send('/v1/chats?after=dsc_9')).json()).p_after, 'dsc_9')
    assert.equal((await (await send('/v1/chats?after=task_9')).json()).p_after, 'task_9')
    assert.equal((await send('/v1/chats?after=prj_9')).status, 400)
  })

  it('starts what a finished reply asked to, and a refusal leaves the rest', async () => {
    BUILTIN_WORKFLOWS.push(coding)
    const machine = '44444444-4444-4444-8444-444444444444'
    db.finish_runner_job = () => ({ finished: true, job: { id: 'j' }, retry: null, discussion: 'dsc_1', start: ['idea_1', 'idea_2'] })
    db.v1_discussion = () => ({ ...discussion, ideas: [discussion.ideas[0], { id: 'idea_2', workflow: 'wf_builtin_coding', task: null }] })
    db.v1_start_idea = ({ p_idea }) => (p_idea === 'idea_1' ? json({ code: 'AKB23', message: 'x', details: 'storage', hint: '3' }, 400) : { id: 'task_2' })
    db.v1_task_workflow = () => json({ code: 'AKB20', message: 'No task has this id.' }, 400)
    const res = await send('/v1/runner/jobs/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/finish', {
      method: 'POST', body: { machineId: machine, outcome: 'done', report: { reply: 'Go.', ideas: [{ id: 'idea_1', title: 'A', start: true }] } },
    })
    assert.deepEqual(await res.json(), { finished: true, job: { id: 'j' }, retry: null })
    assert.deepEqual(callsTo('finish_runner_job')[0].body.p_report.ideas, [{ id: 'idea_1', title: 'A', outcome: '', acceptance: [], workflow: 'wf_builtin_coding', start: true }])
    assert.deepEqual(callsTo('v1_start_idea').map((c) => [c.body.p_idea, c.body.p_project]), [['idea_1', null], ['idea_2', null]])
  })
})

describe('runtimes (#2074)', () => {
  it('checks a runtime\'s fields before the database sees them', async () => {
    db.v1_create_runtime = ({ p_fields }) => ({ id: 'rt_1', ...p_fields })
    db.v1_update_runtime = ({ p_id, p_fields }) => ({ id: p_id, ...p_fields })
    const runner = '00000000-0000-4000-8000-000000000001'
    const made = await send('/v1/runtimes', { method: 'POST', body: { name: ' Light ', runner, connector: 'claude-code', model: 'claude-haiku-4-5' } })
    assert.equal(made.status, 201)
    assert.deepEqual(callsTo('v1_create_runtime')[0].body.p_fields, { name: 'Light', runner, connector: 'claude-code', model: 'claude-haiku-4-5' })
    for (const body of [
      { runner, connector: 'codex' }, { name: 'X', runner, connector: 'gpt' }, { name: 'X', runner }, { name: 'X', runner, connector: 'codex', model: 'a b' },
      { name: 'X', runner, connector: 'codex', model: '$(rm)' }, { name: 'X', connector: 'codex' }, { name: 'X', runner: 'mac', connector: 'codex' },
      { name: 'X', runner, connector: 'codex', settings: { apiKey: 'sk' } }, { name: 'X', runner, connector: 'codex', settings: { args: 'a\nb' } },
      { name: 'X', runner, connector: 'codex', secrets: { token: 'x' } },
    ]) {
      assert.equal((await send('/v1/runtimes', { method: 'POST', body })).status, 400, JSON.stringify(body))
    }
    await send('/v1/runtimes/rt_1', { method: 'PATCH', body: { model: '' } })
    assert.deepEqual(callsTo('v1_update_runtime')[0].body.p_fields, { model: null })
    assert.equal((await send('/v1/runtimes/rt_1', { method: 'PATCH', body: {} })).status, 400)
    assert.equal((await send('/v1/runtimes/rt_1', { method: 'PATCH', body: { name: ' ' } })).status, 400)
    assert.equal((await send('/v1/runtimes/task_1', { method: 'DELETE' })).status, 400)
    assert.equal(callsTo('v1_create_runtime').length, 1)
  })

  it('saves all eight connectors and their settings, an empty one dropped (#2135)', async () => {
    db.v1_create_runtime = ({ p_fields }) => ({ id: 'rt_1', ...p_fields })
    db.v1_update_runtime = ({ p_id, p_fields }) => ({ id: p_id, ...p_fields })
    for (const connector of ['claude-code', 'codex', 'cursor', 'opencode', 'kimi', 'dsh', 'zcode', 'grok']) {
      assert.equal((await send('/v1/runtimes', { method: 'POST', body: { name: connector, runner: '00000000-0000-4000-8000-000000000001', connector } })).status, 201, connector)
    }
    await send('/v1/runtimes/rt_1', { method: 'PATCH', body: { settings: { provider: 'endpoint', baseUrl: ' https://llm.acme/v1 ', reasoning: '' } } })
    assert.deepEqual(callsTo('v1_update_runtime')[0].body.p_fields, { settings: { provider: 'endpoint', baseUrl: 'https://llm.acme/v1' } })
  })

  it('hands a key to the runtime\'s Runner in a job, never into the runtime (#2135)', async () => {
    db.v1_create_runtime = ({ p_fields }) => ({ id: 'rt_1', ...p_fields })
    db.v1_set_runtime_secrets = () => ({ job: 'job-1' })
    db.v1_runtime_test = () => ({ outcome: 'done', reason: null, elapsed_ms: null })
    db.v1_list_runtimes = () => ({ data: [{ id: 'rt_1', secretsSet: ['apiKey'] }] })
    const made = await send('/v1/runtimes', { method: 'POST', body: { name: 'Gate', runner: '00000000-0000-4000-8000-000000000001', connector: 'codex', secrets: { apiKey: ' sk-1 ' } } })
    assert.equal(made.status, 201)
    assert.deepEqual(await made.json(), { id: 'rt_1', secretsSet: ['apiKey'] })
    assert.ok(!JSON.stringify(callsTo('v1_create_runtime')).includes('sk-1'))
    assert.deepEqual(callsTo('v1_set_runtime_secrets')[0].body.p_secrets, { apiKey: 'sk-1' })
    // A key alone changes nothing else; null clears it; a Runner that never took it is offline.
    db.v1_update_runtime = () => assert.fail('nothing else changed')
    await send('/v1/runtimes/rt_1', { method: 'PATCH', body: { secrets: { apiKey: null } } })
    assert.deepEqual(callsTo('v1_set_runtime_secrets')[1].body.p_secrets, { apiKey: null })
    db.v1_runtime_test = () => ({ outcome: 'failed', reason: 'timeout', elapsed_ms: null })
    const late = await send('/v1/runtimes/rt_1', { method: 'PATCH', body: { secrets: { apiKey: 'sk-2' } } })
    assert.equal((await late.json()).error.code, 'runner_offline')
    assert.equal(late.status, 409)
  })

  it('refuses Global default\'s rename as conflict', async () => {
    db.v1_update_runtime = () => json({ code: 'AKB21', message: 'Global default cannot be renamed.' }, 400)
    assert.equal((await send('/v1/runtimes/rt_1', { method: 'PATCH', body: { name: 'Mine' } })).status, 409)
  })

  it('starts a task on a runtime id', async () => {
    BUILTIN_WORKFLOWS.push({ id: 'wf_builtin_coding', name: 'Coding', names: { en: 'Coding', zh: '软件开发' }, description: '', lands: true, hash: 'h', files: {} })
    db.v1_create_task = ({ p_fields }) => ({ id: 'task_1', ...p_fields })
    await send('/v1/tasks', { method: 'POST', body: { title: 'Go', workflow: 'wf_builtin_coding', run: true, runtime: 'rt_1' } })
    assert.equal(callsTo('v1_create_task')[0].body.p_fields.runtime, 'rt_1')
    assert.equal((await send('/v1/tasks', { method: 'POST', body: { title: 'Go', workflow: 'wf_builtin_coding', runtime: 'claude' } })).status, 400)
  })

  it('answers a test once the Runner reported it', async () => {
    db.v1_test_runtime = () => ({ job: 'job-1', connector: 'codex', model: null })
    let polls = 0
    db.v1_runtime_test = () => (++polls < 2 ? null : { outcome: 'failed', reason: 'signed_out', elapsed_ms: 900 })
    const res = await send('/v1/runtimes/rt_1/test', { method: 'POST' })
    assert.deepEqual(await res.json(), {
      object: 'runtime_test', runtime: 'rt_1', connector: 'codex', model: null, result: 'signed_out', elapsed_ms: 900, message: null,
    })
    db.v1_runtime_test = () => ({ outcome: 'failed', reason: 'model not found', elapsed_ms: 1200 })
    const failed = await (await send('/v1/runtimes/rt_1/test', { method: 'POST' })).json()
    assert.deepEqual([failed.result, failed.message], ['failed', 'model not found'])
  })
})

describe('rejections and triage (#2067)', () => {
  it('passes a cancel’s reason, and none without a body', async () => {
    db.v1_cancel_task = ({ p_id, p_reason }) => ({ id: p_id, cancel_reason: p_reason })
    await send('/v1/tasks/task_1/cancel', { method: 'POST' })
    await send('/v1/tasks/task_1/cancel', { method: 'POST', body: { reason: '  Too broad ' } })
    await send('/v1/tasks/task_1/cancel', { method: 'POST', body: { reason: '   ' } })
    assert.deepEqual(callsTo('v1_cancel_task').map((c) => c.body.p_reason), [null, 'Too broad', null])
    assert.equal((await send('/v1/tasks/task_1/cancel', { method: 'POST', body: { reason: 'x'.repeat(2001) } })).status, 413)
    assert.equal((await send('/v1/tasks/task_1/cancel', { method: 'POST', body: { reason: 3 } })).status, 400)
  })

  /** The Postgres side of triage (#2107): who writes, and the events; the files are the board's. */
  const triageDb = () => {
    db.v1_triage_write = ({ p_project }) => ({ workspace: 'ws_1', project: p_project ?? 'prj_g' })
    db.v1_triage_scope = () => ({ workspace: 'ws_1' })
    db.v1_triage_emit = () => undefined
    db.v1_card_tasks = ({ p_cards }) => p_cards.map((c) => ({ ...c, task: `task_${c.number}` }))
  }
  const file = (path, project = 'prj_1') => boards.project(project).read([path])[0]?.content

  it('keeps a proposal, a dismissal and a restore as board files', async () => {
    triageDb()
    const made = await send('/v1/triage', { method: 'POST', body: { title: ' Dark mode ', text: 'Add it', project: 'prj_1', source_task: 'task_1', workflow: 'wf_builtin_coding' } })
    assert.equal(made.status, 201)
    const item = await made.json()
    assert.deepEqual([item.id, item.state, item.workflow, item.source_task, item.text], ['tri_1_dark-mode', 'open', 'wf_builtin_coding', 'task_1', 'Add it'])
    assert.equal(callsTo('v1_triage_write')[0].body.p_workflow, 'wf_builtin_coding')
    assert.match(file('triage/dark-mode.md'), /^---\nsource_id: derived-[0-9a-f]{16}\ntitle: Dark mode\nworkflow: coding\nsource_task: task_1\n/)
    const again = await (await send('/v1/triage', { method: 'POST', body: { title: 'Dark mode', text: 'Add it', project: 'prj_1', workflow: 'wf_builtin_coding' } })).json()
    assert.equal(again.id, item.id)
    assert.equal(boards.project('prj_1').list('triage/').length, 1)
    assert.equal((await (await send('/v1/triage', { method: 'POST', body: { title: 'Dark mode', text: 'Other', workflow: 'wf_builtin_coding' } })).json()).id, 'tri_g_dark-mode')
    assert.deepEqual(callsTo('v1_triage_emit').map((c) => c.body.p_type), ['triage.created', 'triage.created'])
    assert.equal((await send('/v1/triage', { method: 'POST', body: { title: 'No workflow' } })).status, 400)
    assert.equal((await send('/v1/triage', { method: 'POST', body: { text: 'no title' } })).status, 400)
    assert.equal((await send('/v1/triage', { method: 'POST', body: { title: 't', source_task: 'WC-1', workflow: 'wf_builtin_coding' } })).status, 400)

    await send(`/v1/triage/${item.id}/dismiss`, { method: 'POST' })
    assert.equal(file('triage/dark-mode.md'), undefined)
    assert.match(file('triage/dismissed/dark-mode.md'), /dismissed_by: user/)
    assert.doesNotMatch(file('triage/dismissed/dark-mode.md'), /dismissed_reason/)
    const dismissed = await (await send(`/v1/triage/${item.id}/dismiss`, { method: 'POST', body: { reason: 'Not our users' } })).json()
    assert.deepEqual([dismissed.id, dismissed.state, dismissed.dismissed_reason], [item.id, 'dismissed', 'Not our users'])
    assert.equal((await send(`/v1/triage/${item.id}/dismiss`, { method: 'POST', body: { reason: 3 } })).status, 400)
    assert.equal((await send('/v1/triage/task_1/restore', { method: 'POST' })).status, 400)
    assert.equal((await send('/v1/triage/tri_1_nothing/restore', { method: 'POST' })).status, 404)
    const restored = await (await send(`/v1/triage/${item.id}/restore`, { method: 'POST' })).json()
    assert.deepEqual([restored.state, restored.dismissed_reason], ['open', null])
    assert.doesNotMatch(file('triage/dark-mode.md'), /dismissed_|restored_at/)
    assert.equal((await send(`/v1/triage/${item.id}/restore`, { method: 'POST' })).status, 409)
  })

  it('lists the files by state, a page at a time, newest moved first on asking', async () => {
    triageDb()
    const at = (stamp) => `---\nsource_id: s\ntitle: T\nimported_at: "2026-10-01 08:00"\n${stamp}\n---\n\nWords\n`
    boards.project('prj_1').commit([
      { path: 'triage/waiting.md', content: at('collected_at: x'), base_seq: 0 },
      { path: 'triage/dismissed/older.md', content: at('dismissed_at: "2026-10-02 08:00"'), base_seq: 0 },
      { path: 'triage/archived/newer.md', content: at('archived_at: "2026-10-03 08:00"\ncard_id: 4'), base_seq: 0 },
      { path: 'triage/files/shot.md', content: 'not an item', base_seq: 0 },
    ])
    boards.project('prj_2').commit([{ path: 'triage/other.md', content: at('x: y'), base_seq: 0 }])
    assert.equal((await send('/v1/triage?state=gone')).status, 400)
    assert.equal((await send('/v1/triage?state=open,gone')).status, 400)
    assert.equal((await send('/v1/triage?order=newest')).status, 400)
    const open = await (await send('/v1/triage?project=prj_1&state=open&workspace=ws_1')).json()
    assert.deepEqual(open.data.map((i) => i.id), ['tri_1_waiting'])
    assert.deepEqual(callsTo('v1_triage_scope')[0].body, { p_account: callsTo('v1_triage_scope')[0].body.p_account, p_workspace: 'ws_1', p_project: 'prj_1' })
    const first = await (await send('/v1/triage?project=prj_1&state=dismissed,carded&order=desc&limit=1')).json()
    assert.deepEqual([first.data.map((i) => i.id), first.next], [['tri_1_newer'], 'tri_1_newer'])
    assert.equal(first.data[0].task, 'task_4')
    const last = await (await send(`/v1/triage?project=prj_1&state=dismissed,carded&order=desc&limit=1&after=${first.next}`)).json()
    assert.deepEqual([last.data.map((i) => i.id), last.next], [['tri_1_older'], null])
    const all = await (await send('/v1/triage')).json()
    assert.deepEqual(all.data.map((i) => i.id).sort(), ['tri_1_newer', 'tri_1_older', 'tri_1_waiting', 'tri_2_other'])
  })

  it('makes a task of an item, and marks what the review learned', async () => {
    triageDb()
    BUILTIN_WORKFLOWS.push({ id: 'wf_builtin_coding', name: 'Coding', names: { en: 'Coding', zh: '软件开发' }, description: '', lands: true, hash: 'h', files: {} })
    db.v1_create_task = ({ p_fields }) => ({ id: 'task_7', key: 'WC-7', ...p_fields })
    const item = await (await send('/v1/triage', { method: 'POST', body: { title: 'Dark mode', project: 'prj_1', workflow: 'wf_builtin_coding' } })).json()
    const other = await (await send('/v1/triage', { method: 'POST', body: { title: 'Light mode', project: 'prj_1', workflow: 'wf_builtin_coding' } })).json()
    await send('/v1/tasks', { method: 'POST', body: { title: 'Go', workflow: 'wf_builtin_coding', triage: item.id } })
    assert.deepEqual([callsTo('v1_create_task')[0].body.p_fields.project, callsTo('v1_create_task')[0].body.p_fields.triage], ['prj_1', undefined])
    assert.match(file('triage/archived/dark-mode.md'), /card_id: 7\narchived_at: .*\ntask: task_7/)
    assert.equal((await send('/v1/tasks', { method: 'POST', body: { title: 'Go', workflow: 'wf_builtin_coding', triage: item.id } })).status, 409)
    assert.equal((await send(`/v1/triage/${item.id}/dismiss`, { method: 'POST' })).status, 409)
    assert.equal((await send('/v1/tasks', { method: 'POST', body: { title: 'Go', workflow: 'wf_builtin_coding', triage: 'x' } })).status, 400)
    await send('/v1/tasks', { method: 'POST', body: { title: 'Go', workflow: 'wf_builtin_coding', triage: other.id, run: true, skip_plan: true } })
    assert.equal(callsTo('v1_create_task')[1].body.p_fields.skip_plan, true)
    assert.equal((await send('/v1/tasks', { method: 'POST', body: { title: 'Go', workflow: 'wf_builtin_coding', skip_plan: true } })).status, 400)
    // Made of an agent's item, the task is that agent's, from the item's task (#95).
    boards.project('prj_1').commit([{ path: 'triage/qa.md', content: '---\ntitle: Stutter\nagent: qa-manager\nsource_task: task_3\n---\n', base_seq: 0 }])
    const qa = (await (await send('/v1/triage?project=prj_1')).json()).data.find((i) => i.title === 'Stutter')
    assert.equal(qa.agent, 'qa-manager')
    await send('/v1/tasks', { method: 'POST', body: { title: 'Go', workflow: 'wf_builtin_coding', triage: qa.id, source_context: { agent: 'planner' } } })
    assert.deepEqual(callsTo('v1_create_task')[2].body.p_fields.source_context, { agent: 'qa-manager', task: 'task_3' })

    // Dismissed by the user, it waits; learned, it leaves; restored, the review withdraws it.
    const third = await (await send('/v1/triage', { method: 'POST', body: { title: 'Sepia', project: 'prj_1', workflow: 'wf_builtin_coding' } })).json()
    await send(`/v1/triage/${third.id}/dismiss`, { method: 'POST', body: { reason: 'No' } })
    db.v1_list_rejections = ({ p_workspace }) => ({ object: 'rejections', workspace: p_workspace ?? 'ws_1', tasks: [] })
    db.v1_rejections_reviewed = ({ p_tasks }) => p_tasks.length
    const waiting = await (await send('/v1/rejections?workspace=ws_1')).json()
    assert.deepEqual([waiting.workspace, waiting.triage.map((i) => i.id)], ['ws_1', [third.id]])
    const marked = await send('/v1/rejections/reviewed', { method: 'POST', body: { tasks: ['task_1'], triage: [third.id, 'tri_1_gone'] } })
    assert.deepEqual(await marked.json(), { tasks: 1, triage: 1 })
    assert.match(file('triage/dismissed/sepia.md'), /reviewed_at: /)
    assert.deepEqual((await (await send('/v1/rejections')).json()).triage, [])
    await send(`/v1/triage/${third.id}/restore`, { method: 'POST' })
    assert.match(file('triage/sepia.md'), /restored_at: /)
    assert.deepEqual((await (await send('/v1/rejections')).json()).triage.map((i) => [i.id, i.state]), [[third.id, 'open']])
    await send('/v1/rejections/reviewed', { method: 'POST', body: { triage: [third.id] } })
    assert.doesNotMatch(file('triage/sepia.md'), /restored_at|reviewed_at/)
    assert.equal((await send('/v1/rejections/reviewed', { method: 'POST', body: { tasks: 'task_1' } })).status, 400)
    assert.equal((await send('/v1/rejections/reviewed', { method: 'POST', body: { triage: ['task_1'] } })).status, 400)
  })
})

describe('openapi.json', () => {
  it('documents every route, and every documented route exists', async () => {
    const routes = [...ROUTES, ...SHARED_ROUTES].map(([method, path]) => `${method} ${path}`).sort()
    const documented = Object.entries(openapi.paths)
      .flatMap(([path, ops]) => Object.keys(ops).map((m) => `${m.toUpperCase()} ${path}`))
      .sort()
    assert.deepEqual(documented, routes)
    assert.equal(openapi.openapi, '3.1.0')
  })

  it('is served with no sign-in', async () => {
    const res = await worker.fetch(new Request('https://api.ai4kanban.dev/v1/openapi.json'), env, ctx)
    assert.equal(res.status, 200)
    assert.equal((await res.json()).openapi, '3.1.0')
  })
})

describe('card review (#2019, #2103)', () => {
  const SHARE = 'tok_abcdefghijklmnopqrstuvwxyz0123456789'
  const REVIEWER = '22222222-2222-4222-8222-222222222222'
  const sharedSend = async (path, init = {}, bearer) =>
    worker.fetch(new Request(`https://api.ai4kanban.dev/v1/shared/${SHARE}${path}`, {
      ...init,
      headers: { ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), ...(init.headers ?? {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }), env, ctx)
  const refusal = (code, details) => () => json({ code, message: 'x', details }, 400)

  it('keeps comments from API keys, in the routes and in the feed', async () => {
    const byKey = await send('/v1/tasks/task_1/comments', { method: 'POST', body: { body: 'Hi' } }, KEY)
    assert.equal(byKey.status, 403)
    assert.equal((await byKey.json()).error.code, 'session_required')
    assert.equal((await send('/v1/tasks/task_1/comments', {}, KEY)).status, 403)

    db.v1_create_comment = ({ p_body, p_author }) => ({ id: 'cmt_1', body: p_body, author: p_author })
    const made = await send('/v1/tasks/task_1/comments', { method: 'POST', body: { body: 'Hi' } })
    assert.equal(made.status, 201)
    assert.deepEqual((await made.json()).author, { kind: 'user', handle: 'lin' })
    assert.equal((await send('/v1/tasks/task_1/comments', { method: 'POST', body: { body: '  ' } })).status, 400)

    await send('/v1/events?after=', {}, KEY)
    await send('/v1/events?after=')
    const [byKeyFeed, bySignIn] = callsTo('v1_list_events')
    assert.deepEqual(byKeyFeed.body.p_hidden, ['comment.created'])
    assert.deepEqual(bySignIn.body.p_hidden, [])
  })

  it('streams a key no comments and a sign-in everything, version events included', async () => {
    events = [
      { ...event(1), type: 'card.updated' },
      { ...event(2), type: 'comment.created' },
      { ...event(3), type: 'review.updated' },
    ]
    const filter = db.v1_list_events
    db.v1_list_events = (args) => {
      const page = filter(args)
      return { ...page, data: page.data.filter((e) => !(args.p_hidden ?? []).includes(e.type)) }
    }
    const keyed = (await send('/v1/events/stream', {}, KEY)).body.getReader()
    const seen = await readUntil(keyed, 'id: evt_3')
    assert.ok(seen.includes('event: card.updated'))
    assert.ok(!seen.includes('comment.created'))
    await keyed.cancel()
    const signedIn = (await send('/v1/events/stream')).body.getReader()
    assert.ok((await readUntil(signedIn, 'id: evt_3')).includes('event: comment.created'))
    await signedIn.cancel()
  })

  it('shows a share link once and keeps only its hash', async () => {
    db.v1_create_share_link = ({ p_fields }) => ({ id: 'shr_1', object: 'share_link', ...p_fields })
    const res = await send('/v1/tasks/task_1/share-links', { method: 'POST', body: {} })
    assert.equal(res.status, 201)
    const link = await res.json()
    const token = link.url.replace('https://app.wildcrane.ai/s/', '')
    assert.match(token, /^[\w-]{43}$/)
    const [{ body }] = callsTo('v1_create_share_link')
    assert.equal(body.p_hash, await sha256(token))
    assert.ok(!JSON.stringify(body).includes(token))
    assert.deepEqual(body.p_fields, {})

    env.APP_URL = 'https://staging.test/'
    const staged = await (await send('/v1/tasks/task_1/share-links', { method: 'POST', body: { access: 'link' } }, KEY)).json()
    assert.ok(staged.url.startsWith('https://staging.test/s/'))
    delete env.APP_URL

    for (const bad of [{ access: 'anyone' }, { access: 'link', expires_in_days: 31 }]) {
      assert.equal((await send('/v1/tasks/task_1/share-links', { method: 'POST', body: bad })).status, 400, JSON.stringify(bad))
    }
    assert.equal((await send('/v1/share-links/shr_1', { method: 'PATCH', body: {} })).status, 400)
  })

  it('invites and removes a task’s guests by email', async () => {
    db.v1_add_guest = ({ p_task, p_email }) => ({ guest: { object: 'guest', task: p_task, email: p_email }, invite: null })
    db.v1_remove_guest = ({ p_task, p_email }) => ({ object: 'guest', task: p_task, email: p_email, deleted: true })
    db.v1_list_guests = () => ({ data: [], next: null })
    const added = await send('/v1/tasks/task_1/guests/Ana%40Studio.co', { method: 'PUT' })
    assert.equal(added.status, 200)
    assert.deepEqual(callsTo('v1_add_guest')[0].body, { p_account: USER, p_task: 'task_1', p_email: 'ana@studio.co', p_share_hash: null, p_daily_write_budget: callsTo('v1_add_guest')[0].body.p_daily_write_budget })
    await idle()
    assert.equal(pokes, 1)
    assert.equal((await send('/v1/tasks/task_1/guests/ana%40studio.co', { method: 'DELETE' })).status, 200)
    assert.equal((await send('/v1/tasks/task_1/guests')).status, 200)
    assert.equal((await send('/v1/tasks/task_1/guests/nope', { method: 'PUT' })).status, 400)
    assert.equal(callsTo('v1_add_guest').length, 1)
  })

  it('emails a new guest the link being shared, once, and says whether it went', async () => {
    const SHARE = 'tok_abcdefghijklmnopqrstuvwxyz'
    const guest = { object: 'guest', task: 'task_1', email: 'ana@studio.co', created_at: '2026-10-25T00:00:00.000Z' }
    const invite = { inviter: '陈雪', title: '官网首页改版', expires_at: '2026-11-01T08:00:00.000Z' }
    let answer = { guest, invite }
    db.v1_add_guest = () => answer
    env.RESEND_API_KEY = 're_test'
    const put = (body) => send('/v1/tasks/task_1/guests/ana%40studio.co', { method: 'PUT', body })

    const sent = await put({ share_token: SHARE, lang: 'zh' })
    assert.equal(sent.status, 200)
    assert.deepEqual(await sent.json(), { ...guest, mail: 'sent' })
    assert.equal(callsTo('v1_add_guest')[0].body.p_share_hash, await sha256(SHARE))
    assert.ok(!JSON.stringify(calls).includes(SHARE))
    assert.equal(mails.length, 1)
    assert.deepEqual(mails[0].to, ['ana@studio.co'])
    assert.equal(mails[0].subject, '陈雪 邀请你审核「官网首页改版」')
    assert.ok(mails[0].text.includes(`打开审核 https://app.wildcrane.ai/s/${SHARE}`))
    assert.ok(mails[0].text.includes('链接 11 月 1 日前有效'))
    assert.ok(mails[0].html.includes(`href="https://app.wildcrane.ai/s/${SHARE}"`) && mails[0].html.includes('lang="zh"'))

    answer = { guest, invite: { ...invite, inviter: 'Alex <Chen>' } }
    await put({ share_token: SHARE })
    assert.equal(mails[1].subject, 'Alex <Chen> invited you to review "官网首页改版"')
    assert.ok(mails[1].text.includes('The link works until Nov 1.') && mails[1].html.includes('Alex &#60;Chen&#62;'))

    answer = { guest, invite: null }
    assert.equal((await (await put({ share_token: SHARE })).json()).mail, null)
    assert.equal((await (await put()).json()).mail, null)
    assert.equal(callsTo('v1_add_guest').at(-1).body.p_share_hash, null)
    assert.equal(mails.length, 2)

    answer = { guest, invite }
    resendStatus = 500
    const failed = await put({ share_token: SHARE })
    assert.equal(failed.status, 200)
    assert.equal((await failed.json()).mail, 'failed')
    delete env.RESEND_API_KEY
    assert.equal((await (await put({ share_token: SHARE })).json()).mail, 'failed')
    assert.equal(mails.length, 3)

    db.v1_add_guest = () => json({ code: 'AKB28', message: 'That share link is not an open link of this task.' }, 400)
    const refused = await put({ share_token: SHARE })
    assert.equal(refused.status, 400)
    for (const bad of [{ share_token: 'short' }, { share_token: 7 }, { share_token: SHARE, lang: 'fr' }]) {
      assert.equal((await put(bad)).status, 400, JSON.stringify(bad))
    }
    assert.equal(mails.length, 3)
  })

  it('opens a shared review by the token’s hash, signed in or not, never by key', async () => {
    db.v1_shared = () => ({
      role: 'reviewer',
      artifacts: [{ id: 'art_1', versions: [{ version: 2, file: { size: 3, content_type: 'text/html' } }, { version: 1, file: null }] }],
    })
    const open = await sharedSend('')
    assert.equal(open.status, 200)
    assert.equal((await open.json()).artifacts[0].versions[0].file.url, `/v1/shared/${SHARE}/artifacts/art_1/versions/2/file`)
    assert.deepEqual(callsTo('v1_shared')[0].body, { p_hash: await sha256(SHARE), p_subject: null, p_email: null })
    assert.equal(callsTo('account_for_session').length, 0)

    await sharedSend('', {}, await token({ sub: REVIEWER, email: 'Ana@Studio.co' }))
    assert.deepEqual(callsTo('v1_shared')[1].body, { p_hash: await sha256(SHARE), p_subject: REVIEWER, p_email: 'ana@studio.co' })
    assert.equal(callsTo('account_for_session').length, 0, 'admission was checked')

    assert.equal((await sharedSend('', {}, KEY)).status, 401)
    assert.equal((await sharedSend('', {}, 'not-a-token')).status, 401)
    const short = await worker.fetch(new Request('https://api.ai4kanban.dev/v1/shared/abc'), env, ctx)
    assert.equal(short.status, 404)
    assert.equal((await short.json()).error.code, 'link_invalid')
  })

  it('names every way a link refuses', async () => {
    const cases = [
      ['AKB24', 'invalid', 404, 'link_invalid'],
      ['AKB24', 'expired', 410, 'link_expired'],
      ['AKB24', 'revoked', 410, 'link_revoked'],
      ['AKB25', 'sign_in_required', 401, 'sign_in_required'],
      ['AKB25', 'not_invited', 403, 'not_invited'],
    ]
    for (const [code, details, status, name] of cases) {
      db.v1_shared = refusal(code, details)
      const res = await sharedSend('')
      assert.equal(res.status, status, name)
      assert.equal((await res.json()).error.code, name)
    }
  })

  it('writes through a link for invited reviewers only, decides for members only, and tells the owner’s streams', async () => {
    db.v1_shared_comment = ({ p_body }) => ({ workspace: 'ws_1', result: { id: 'cmt_1', body: p_body } })
    const bearer = await token({ sub: REVIEWER, email: 'ana@studio.co' })
    const made = await sharedSend('/comments', { method: 'POST', body: { body: 'Close' } }, bearer)
    assert.equal(made.status, 201)
    assert.deepEqual(await made.json(), { id: 'cmt_1', body: 'Close' })
    await idle()
    assert.equal(pokes, 1)

    db.v1_shared_comment = refusal('AKB25', 'view_only')
    const viewer = await sharedSend('/comments', { method: 'POST', body: { body: 'Hi' } })
    assert.equal(viewer.status, 403)
    assert.equal((await viewer.json()).error.code, 'view_only')

    assert.equal((await sharedSend('/decisions', { method: 'POST', body: { review_revision: 2 } }, bearer)).status, 400)
    assert.equal((await sharedSend('/decisions', { method: 'POST', body: { text: '  ', review_revision: 2 } }, bearer)).status, 400)
    assert.equal((await sharedSend('/decisions', { method: 'POST', body: { picked: 0 } }, bearer)).status, 400)
    assert.equal(callsTo('v1_shared_decide').length, 0)

    db.v1_shared_decide = refusal('AKB26', 'review_outdated')
    const stale = await sharedSend('/decisions', { method: 'POST', body: { picked: 0, review_revision: 1 } }, bearer)
    assert.equal(stale.status, 409)
    assert.equal((await stale.json()).error.code, 'review_outdated')
    assert.deepEqual(
      (({ p_picked, p_text, p_revision }) => ({ p_picked, p_text, p_revision }))(callsTo('v1_shared_decide')[0].body),
      { p_picked: 0, p_text: null, p_revision: 1 },
    )
    db.v1_shared_decide = refusal('AKB26', 'card_missing')
    assert.equal((await (await sharedSend('/decisions', { method: 'POST', body: { text: 'Redo', review_revision: 0 } }, bearer)).json()).error.code, 'card_missing')
    db.v1_shared_decide = refusal('AKB25', 'owner_only')
    const guest = await sharedSend('/decisions', { method: 'POST', body: { picked: 0, review_revision: 2 } }, bearer)
    assert.equal(guest.status, 403)
    assert.equal((await guest.json()).error.code, 'owner_only')
  })

  it('chats for the owner only, and tells the owner’s streams', async () => {
    const owner = await token({ sub: USER, email: 'lin@x.co' })
    const chat = { object: 'task_chat', messages: [], status: 'idle' }
    db.v1_shared_chat = () => chat
    db.v1_shared_chat_send = ({ p_body, p_runtime }) => ({ workspace: 'ws_1', result: { ...chat, status: 'replying', p_body, p_runtime } })
    db.v1_shared_chat_clear = () => ({ workspace: 'ws_1', result: chat })
    assert.deepEqual(await (await sharedSend('/chat', {}, owner)).json(), chat)
    const sent = await sharedSend('/chat', { method: 'POST', body: { body: ' Fewer tiers? ', runtime: 'rt_1' } }, owner)
    assert.equal(sent.status, 201)
    assert.deepEqual(await sent.json(), { ...chat, status: 'replying', p_body: 'Fewer tiers?', p_runtime: 'rt_1' })
    const cleared = await sharedSend('/chat', { method: 'DELETE' }, owner)
    assert.equal(cleared.status, 200)
    await idle()
    assert.equal(pokes, 2)
    await sharedSend('/chat', { method: 'POST', body: { body: 'hi' } }, owner)
    assert.equal(callsTo('v1_shared_chat_send').at(-1).body.p_runtime, null)
    for (const bad of [{ body: ' ', runtime: 'task' }, { body: 'hi', runtime: 'codex' }]) {
      assert.equal((await sharedSend('/chat', { method: 'POST', body: bad }, owner)).status, 400, JSON.stringify(bad))
    }

    const cases = [
      ['v1_shared_chat', 'GET', 'AKB25', 'owner_only', 403],
      ['v1_shared_chat_send', 'POST', 'AKB25', 'owner_only', 403],
      ['v1_shared_chat_clear', 'DELETE', 'AKB25', 'owner_only', 403],
      ['v1_shared_chat_send', 'POST', 'AKB26', 'chat_busy', 409],
      ['v1_shared_chat_send', 'POST', 'AKB26', 'runner_offline', 409],
      ['v1_shared_chat_clear', 'DELETE', 'AKB26', 'chat_busy', 409],
    ]
    for (const [fn, method, code, detail, status] of cases) {
      db[fn] = refusal(code, detail)
      const res = await sharedSend('/chat', method === 'POST' ? { method, body: { body: 'hi', runtime: 'task' } } : { method }, owner)
      assert.equal(res.status, status, `${fn} ${detail}`)
      assert.equal((await res.json()).error.code, detail)
    }
  })

  it('reads files of the link’s task only', async () => {
    await bucket.put('artifacts/u/art_1/upl_1', new Uint8Array([7]))
    db.v1_shared_file = ({ p_artifact }) =>
      p_artifact === 'art_1'
        ? { stored: { key: 'artifacts/u/art_1/upl_1', content_type: 'image/png' } }
        : json({ code: 'AKB20', message: 'No artifact version under review has this id.' }, 400)
    const file = await sharedSend('/artifacts/art_1/versions/1/file')
    assert.equal(file.headers.get('content-type'), 'image/png')
    assert.deepEqual([...new Uint8Array(await file.arrayBuffer())], [7])
    assert.equal((await sharedSend('/artifacts/art_9/versions/1/file')).status, 404)
  })

  it('checks a card before it is saved, and the choice put to a reviewer', async () => {
    db.v1_card_place = ({ p_task }) => ({ task: p_task, project: 'prj_1', path: 'todo/1-task-1.md', version: 0, metadata: {}, assets: {} })
    db.v1_index_cards = () => ({ indexed: 1 })
    db.v1_card = ({ p_task }) => ({ object: 'card', task: p_task, project: 'prj_1', path: 'todo/1-task-1.md', version: 1, metadata: {}, assets: {} })
    const card = '# Pricing\n\n<Asset src=".assets/a.html" />\n\n<!-- agent -->\n\n## Todo\n- [ ] Build\n'
    const saved = await send('/v1/tasks/task_1/card', {
      method: 'PUT',
      body: { body: card, base_version: 0, metadata: { modules: ['web'], invented: 'x' }, assets: { '.assets/a.html': { artifact: 'art_1' } } },
    }, KEY)
    assert.equal(saved.status, 200)
    assert.equal(boards.project('prj_1').read(['todo/1-task-1.md'])[0].content, card)
    assert.deepEqual(callsTo('v1_index_cards')[0].body.p_cards[0].metadata, { modules: ['web'] })
    assert.deepEqual(JSON.parse(boards.project('prj_1').read(['assets/task_1.json'])[0].content), { '.assets/a.html': { artifact: 'art_1' } })
    for (const bad of [
      { body: card },
      { body: '```js\nopen', base_version: 0 },
      { body: 'a\n<!-- agent -->\nb\n<!-- agent -->', base_version: 0 },
      { body: 'a', base_version: 0, assets: { 'b.png': { artifact: 'art_1' } } },
      { body: 'b.png', base_version: 0, assets: { 'b.png': { artifact: 'task_1' } } },
    ]) {
      assert.equal((await send('/v1/tasks/task_1/card', { method: 'PUT', body: bad })).status, 400, JSON.stringify(bad))
    }
    assert.equal((await send('/v1/tasks/task_1/card', { method: 'PUT', body: { body: '````\n```\n````', base_version: 1 } })).status, 200)
    assert.equal((await (await send('/v1/tasks/task_1/card', {}, KEY)).json()).body, '````\n```\n````')
    db.v1_card = () => json({ code: 'AKB20', message: 'No such card.' }, 400)
    assert.equal((await send('/v1/tasks/task_2/card')).status, 404)

    // #2064: blockers and a schedule go into the frontmatter, the blockers as their numbers.
    db.v1_card = ({ p_task }) => ({ object: 'card', task: p_task, project: 'prj_1', path: 'todo/1-task-1.md', version: 3, metadata: {}, assets: {} })
    db.v1_card_numbers = ({ p_refs }) => p_refs.map((r) => Number(r.replace(/^WC-/, '')))
    const front = '---\ntitle: Pricing\npriority: high\nroi: high\nstatus: todo\nblocked_by: []\nrelated: []\nmodules: []\nquestions: []\n---\n\n# Pricing\n'
    const linked = await send('/v1/tasks/task_1/card', {
      method: 'PUT',
      body: { body: front, base_version: 2, metadata: { blocked_by: ['WC-3'], schedule: { action: 'implement', notes: 'Go' }, priority: 'high' } },
    }, KEY)
    assert.equal(linked.status, 200)
    const held = boards.project('prj_1').read(['todo/1-task-1.md'])[0].content
    assert.match(held, /^blocked_by: \[3\]$/m)
    assert.match(held, /^schedule:\n {2}action: implement\n {2}notes: Go$/m)
    const entry = callsTo('v1_index_cards').at(-1).body.p_cards[0]
    assert.deepEqual(entry.metadata, { priority: 'high' })
    assert.deepEqual(entry.links, { blocked_by: [3], related: [], schedule: { action: 'implement', notes: 'Go' } })
    for (const metadata of [{ schedule: { action: 'ship' } }, { blocked_by: 'WC-3' }]) {
      assert.equal((await send('/v1/tasks/task_1/card', { method: 'PUT', body: { body: front, base_version: 3, metadata } })).status, 400, JSON.stringify(metadata))
    }
    assert.equal((await send('/v1/tasks/task_1/card', { method: 'PUT', body: { body: 'No frontmatter', base_version: 3, metadata: { blocked_by: [] } } })).status, 400)

    db.v1_update_review = ({ p_task, p_fields }) => ({ object: 'review', task: p_task, ...p_fields })
    const options = [{ label: 'Go', approve: true }, { label: 'Simplify' }]
    const bound = await send('/v1/tasks/task_1/review', { method: 'PATCH', body: { options } }, KEY)
    assert.equal(bound.status, 200)
    assert.deepEqual((await bound.json()).options, [{ label: 'Go', approve: true }, { label: 'Simplify', approve: false }])
    for (const bad of [{}, { card_version: 1 }, { options: [{ label: 'A' }] }, { options: [{ label: 'A', approve: true }, { label: 'B', approve: true }] }]) {
      assert.equal((await send('/v1/tasks/task_1/review', { method: 'PATCH', body: bad })).status, 400, JSON.stringify(bad))
    }

    db.v1_update_review = () => json({ code: 'AKB20', message: 'No such task.' }, 400)
    assert.equal((await send('/v1/tasks/task_2/review', { method: 'PATCH', body: { question: 'Ship it?' } })).status, 404)
    db.v1_create_decision = refusal('AKB26', 'review_outdated')
    const stale = await send('/v1/tasks/task_1/decisions', { method: 'POST', body: { decision: 'approve', review_revision: 1 } })
    assert.equal(stale.status, 409)
    assert.equal(callsTo('v1_create_decision')[0].body.p_fields.review_revision, 1)
  })
})

const event = (n) => ({ id: `evt_${n}`, object: 'event', type: 'task.updated', created_at: '2026-10-24T00:00:00.000Z', data: {} })

async function readUntil(reader, marker) {
  let text = ''
  const decoder = new TextDecoder()
  while (!text.includes(marker)) {
    const { value, done } = await reader.read()
    if (done) break
    text += decoder.decode(value)
  }
  return text
}

describe('artifact components (#2006)', () => {
  const SHARE = 'tok_abcdefghijklmnopqrstuvwxyz0123456789'
  const HASH = 'ab'.repeat(16)
  const manifest = { title: { en: 'Subtitles', zh: '字幕' }, types: ['@lin/subtitles'] }
  const publish = (body, bearer) => send('/v1/components', { method: 'POST', body }, bearer)

  it('publishes a version and hands back where its bundle goes', async () => {
    db.v1_create_component = ({ p_name, p_version }) => ({ id: 'cmp_1', object: 'component_version', name: p_name, version: p_version })
    const res = await publish({ name: 'subtitles', version: '1.0.0', manifest: { ...manifest, name: 'subtitles', extra: 1 } }, KEY)
    assert.equal(res.status, 201)
    const made = await res.json()
    assert.equal(made.upload.url, '/v1/components/subtitles/versions/1.0.0/bundle')
    assert.equal(made.upload.max_size, 10 * 1024 * 1024)
    assert.deepEqual(callsTo('v1_create_component')[0].body.p_manifest, manifest)
  })

  it('creates an artifact of a component type', async () => {
    db.v1_create_artifact = () => ({ id: 'art_1', object: 'artifact' })
    const create = (type) => send('/v1/tasks/task_1/artifacts', { method: 'POST', body: { type } }, KEY)
    assert.equal((await create('@lin/subtitles')).status, 201)
    assert.equal(callsTo('v1_create_artifact')[0].body.p_fields.type, '@lin/subtitles')
    for (const bad of ['@Lin/subtitles', '@lin/', 'lin/subtitles', '@lin/a/b']) assert.equal((await create(bad)).status, 400, bad)
  })

  it('refuses a built-in name and a malformed manifest before the database', async () => {
    for (const body of [
      { name: 'html', version: '1.0.0', manifest },
      { name: 'Subs', version: '1.0.0', manifest },
      { name: 'subs', version: '1', manifest },
      { name: 'subs', version: '1.0.0', manifest: { ...manifest, title: 'Subtitles' } },
      { name: 'subs', version: '1.0.0', manifest: { ...manifest, types: ['subtitles'] } },
      { name: 'subs', version: '1.0.0', manifest: { ...manifest, types: [] } },
      { name: 'subs', version: '1.0.0', manifest: { ...manifest, name: 'other' } },
      { name: 'subs', version: '1.0.0', manifest: { ...manifest, schema: [] } },
    ]) {
      assert.equal((await publish(body)).status, 400, JSON.stringify(body))
    }
    assert.equal(callsTo('v1_create_component').length, 0)
  })

  it('unpacks a bundle into the version\'s own folder, and refuses one too large or without index.html', async () => {
    db.v1_component_upload_target = () => ({ stored: HASH })
    db.v1_finish_component = ({ p_size }) => ({ object: 'component_version', uploaded: true, size: p_size })
    const put = (body) => send('/v1/components/subtitles/versions/1.0.0/bundle', { method: 'PUT', body })
    const ok = await put(tarOf({ 'index.html': '<p>hi</p>', './assets/app.js': 'go()' }))
    assert.equal(ok.status, 200)
    assert.equal((await ok.json()).size, 13)
    assert.deepEqual([...bucket.objects.keys()].sort(), [`components/${HASH}/assets/app.js`, `components/${HASH}/index.html`])

    const zipped = new Uint8Array(await new Response(new Blob([tarOf({ 'index.html': 'z' })]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer())
    assert.equal((await put(zipped)).status, 200)

    assert.equal((await put(tarOf({ 'main.js': 'x' }))).status, 400)
    assert.equal((await put(tarOf({ 'index.html': 'x', '../up.js': 'x' }))).status, 400)
    const big = await put(tarOf({ 'index.html': 'x', 'big.bin': new Uint8Array(10 * 1024 * 1024) }))
    assert.equal(big.status, 413)
    assert.equal(callsTo('v1_finish_component').length, 2)
  })

  it('takes a version\'s files out of R2 when it is removed', async () => {
    db.v1_delete_component_version = () => ({ object: 'component_version', deleted: true, stored: HASH })
    bucket.objects.set(`components/${HASH}/index.html`, new Uint8Array(1))
    bucket.list = async ({ prefix }) => ({ objects: [...bucket.objects.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false })
    const res = await send('/v1/components/subtitles/versions/1.0.0', { method: 'DELETE' })
    assert.deepEqual(await res.json(), { object: 'component_version', deleted: true })
    assert.equal(bucket.objects.size, 0)
  })

  it('answers the review page the version\'s address, never its row', async () => {
    db.v1_shared_component = () => ({ object: 'component_version', name: 'subtitles', version: '1.0.0', stored: HASH })
    const res = await worker.fetch(new Request(`https://api.ai4kanban.dev/v1/shared/${SHARE}/components/subtitles/1.0.0`), env, ctx)
    assert.deepEqual(await res.json(), { object: 'component_version', name: 'subtitles', version: '1.0.0', url: `https://${HASH}.wildcraneusercontent.com/` })
    db.v1_shared_component = () => json({ code: 'AKB20', message: 'This component has been removed.' }, 400)
    const removed = await worker.fetch(new Request(`https://api.ai4kanban.dev/v1/shared/${SHARE}/components/subtitles/1.0.0`), env, ctx)
    assert.equal(removed.status, 404)
  })

  it('answers a member the component their artifact version pinned', async () => {
    db.v1_artifact_component = () => ({ object: 'component_version', name: 'subtitles', version: '1.0.0', stored: HASH })
    const res = await send('/v1/artifacts/art_1/versions/2/component')
    assert.deepEqual(await res.json(), { object: 'component_version', name: 'subtitles', version: '1.0.0', url: `https://${HASH}.wildcraneusercontent.com/` })
    assert.deepEqual(callsTo('v1_artifact_component').at(-1).body, { p_account: USER, p_artifact: 'art_1', p_version: 2 })
    db.v1_artifact_component = () => json({ code: 'AKB20', message: 'This component has been removed.' }, 400)
    assert.equal((await send('/v1/artifacts/art_1/versions/2/component')).status, 404)
  })

  it('serves a bundle with no network and no embedding but the review page and Web', async () => {
    bucket.objects.set(`components/${HASH}/index.html`, new TextEncoder().encode('<p>hi</p>'))
    const res = await worker.fetch(new Request(`https://${HASH}.wildcraneusercontent.com/`), env, ctx)
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-type'), 'text/html; charset=utf-8')
    const csp = res.headers.get('content-security-policy')
    assert.match(csp, /default-src 'self'/)
    assert.match(csp, /connect-src 'none'/)
    assert.match(csp, /frame-ancestors https:\/\/app\.wildcrane\.ai$/)
    assert.equal(await res.text(), '<p>hi</p>')
    assert.equal((await worker.fetch(new Request(`https://${HASH}.wildcraneusercontent.com/../x`), env, ctx)).status, 404)
    assert.equal((await worker.fetch(new Request(`https://nothex.wildcraneusercontent.com/`), env, ctx)).status, 404)
    assert.equal((await worker.fetch(new Request(`https://${HASH}.wildcraneusercontent.com/v1/tasks`), env, ctx)).status, 404)
    assert.equal(calls.length, 0)
  })

  it('reads what publish packs, a long path included', () => {
    const long = `${'d/'.repeat(60)}index.js`
    const files = untar(tarOf({ 'index.html': 'x', [long]: 'y' }))
    assert.equal(new TextDecoder().decode(files.get(long)), 'y')
  })
})

/** The bundle `npx wildcrane-artifact-sdk publish` sends. */
const tarOf = (files) =>
  packTar(Object.entries(files).map(([name, body]) => [name, typeof body === 'string' ? new TextEncoder().encode(body) : body]))

function fakeBucket() {
  const objects = new Map()
  return {
    objects,
    async get(key) {
      const bytes = objects.get(key)
      if (!bytes) return null
      return { size: bytes.byteLength, body: new Blob([bytes]).stream(), arrayBuffer: async () => bytes }
    },
    async put(key, value) {
      objects.set(key, value)
    },
    deleted: [],
    async delete(keys) {
      for (const key of [keys].flat()) {
        objects.delete(key)
        this.deleted.push(key)
      }
    },
    async list() {
      return { objects: [], truncated: false }
    },
    async createMultipartUpload(key) {
      return this.resumeMultipartUpload(key, 'mp_1')
    },
    resumeMultipartUpload(key, uploadId) {
      const parts = (multiparts[uploadId] ??= new Map())
      return {
        key,
        uploadId,
        async uploadPart(partNumber, value) {
          parts.set(partNumber, value)
          return { partNumber, etag: `e${partNumber}` }
        },
        async complete(done) {
          const chunks = done.sort((a, b) => a.partNumber - b.partNumber).map((p) => parts.get(p.partNumber))
          const out = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0))
          let at = 0
          for (const c of chunks) {
            out.set(c, at)
            at += c.byteLength
          }
          objects.set(key, out)
        },
        async abort() {},
      }
    },
  }
}

const multiparts = {}

async function token(extra = {}) {
  const now = Math.floor(Date.now() / 1000)
  const claims = { sub: USER, iss: issuerFor(SUPABASE_URL), aud: 'authenticated', exp: now + 3600, ...extra }
  const input = `${b64u(JSON.stringify({ alg: 'ES256', kid: 'k' }))}.${b64u(JSON.stringify(claims))}`
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, new TextEncoder().encode(input))
  return `${input}.${b64uBytes(new Uint8Array(signature))}`
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const b64u = (text) => b64uBytes(new TextEncoder().encode(text))

const b64uBytes = (bytes) =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
