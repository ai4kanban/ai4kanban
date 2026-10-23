// The public API (#2000), the Worker's half: auth, the conventions, validation, uploads, the
// event stream and the OpenAPI document. What the database does with a call is
// test/sql/checks.sql's.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { issuerFor, jwksUrl, resetJwksCache } from '../src/auth.ts'
import worker from '../src/index.ts'
import { ROUTES } from '../src/v1/index.ts'
import { DEPRECATED, deprecationHeaders, sha256 } from '../src/v1/http.ts'
import { EventHub } from '../src/v1/stream.ts'
import { BUILTIN_WORKFLOWS } from '../src/v1/workflows.ts'

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

beforeEach(async () => {
  resetJwksCache()
  keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  calls = []
  events = []
  pokes = 0
  bucket = fakeBucket()
  db = {
    account_for_session: () => ({ admitted: true, handle: 'lin', name: null, avatar_url: null, account_id: USER }),
    v1_account_for_key: async ({ p_hash }) =>
      p_hash === (await sha256(KEY)) ? { account_id: USER, handle: 'lin', key_id: 'key_1', key_name: 'CI' } : null,
    v1_list_events: ({ p_after, p_limit }) => {
      const after = events.filter((e) => Number(e.id.slice(4)) > p_after)
      const data = after.slice(0, p_limit)
      return { data, next: after.length > p_limit ? data.at(-1).id : null }
    },
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
  globalThis.fetch = async (url, init) => {
    const address = String(url)
    if (address === jwksUrl(SUPABASE_URL)) return json({ keys: [{ ...jwk, kid: 'k', alg: 'ES256' }] })
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

const ctx = { waitUntil: () => {}, passThroughOnException: () => {} }

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
    assert.equal(pokes, 1)
  })
})

describe('validation', () => {
  it('refuses memory over 64 KB and inline artifacts over 256 KB', async () => {
    const memory = await send('/v1/memories', { method: 'POST', body: { scope: 'user', name: 'n', body: 'x'.repeat(65 * 1024) } })
    assert.equal(memory.status, 413)
    const version = await send('/v1/artifacts/art_1/versions', { method: 'POST', body: { content: { html: 'x'.repeat(257 * 1024) } } })
    assert.equal(version.status, 413)
    assert.equal(calls.filter((c) => c.fn.startsWith('v1_create')).length, 0)
  })

  it('refuses a workflow with duplicate checkpoint keys, and project memory with no project', async () => {
    const wf = await send('/v1/workflows', {
      method: 'POST',
      body: { name: 'W', checkpoints: [{ key: 'a', title: 'A' }, { key: 'a', title: 'B' }] },
    })
    assert.equal(wf.status, 400)
    const mem = await send('/v1/memories', { method: 'POST', body: { scope: 'project', name: 'n' } })
    assert.equal(mem.status, 400)
  })
})

describe('workflows', () => {
  it('lists built-ins first, refuses changing one, and copies it into a new task', async () => {
    BUILTIN_WORKFLOWS.push({
      id: 'wf_builtin_site', name: 'Site', description: '', expertise: 'Build it.',
      checkpoints: [{ key: 'draft', title: 'Draft', artifact_type: 'web-page', question: '', acceptance: '' }],
      memory: { project: [], user: [] },
    })
    db.v1_list_workflows = () => ({ data: [{ id: 'wf_own' }], next: null })
    db.v1_create_task = ({ p_fields, p_workflow }) => ({ id: 'task_1', ...p_fields, workflow: p_workflow })
    const list = await (await send('/v1/workflows')).json()
    assert.deepEqual(list.data.map((w) => w.id), ['wf_builtin_site', 'wf_own'])
    assert.equal(list.data[0].builtin, true)

    assert.equal((await send('/v1/workflows/wf_builtin_site', { method: 'PATCH', body: { name: 'X' } })).status, 403)
    assert.equal((await send('/v1/workflows/wf_builtin_site', { method: 'DELETE' })).status, 403)

    const task = await send('/v1/tasks', { method: 'POST', body: { title: 'Landing', workflow: 'wf_builtin_site' } })
    assert.equal(task.status, 201)
    assert.equal((await task.json()).workflow.expertise, 'Build it.')
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

  it('refuses a file over 50 MB before reading it', async () => {
    db.v1_upload_target = () => ({ key: 'k', content_type: 'image/png' })
    const res = await send('/v1/uploads/upl_1', {
      method: 'PUT',
      body: new Uint8Array([1]),
      headers: { 'content-length': String(51 * 1024 * 1024) },
    })
    assert.equal(res.status, 413)
    assert.equal(bucket.objects.size, 0)
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

describe('openapi.json', () => {
  it('documents every route, and every documented route exists', async () => {
    const routes = ROUTES.map(([method, path]) => `${method} ${path}`).sort()
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
    async delete() {},
    async list() {
      return { objects: [], truncated: false }
    },
  }
}

async function token() {
  const now = Math.floor(Date.now() / 1000)
  const claims = { sub: USER, iss: issuerFor(SUPABASE_URL), aud: 'authenticated', exp: now + 3600 }
  const input = `${b64u(JSON.stringify({ alg: 'ES256', kid: 'k' }))}.${b64u(JSON.stringify(claims))}`
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, new TextEncoder().encode(input))
  return `${input}.${b64uBytes(new Uint8Array(signature))}`
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const b64u = (text) => b64uBytes(new TextEncoder().encode(text))

const b64uBytes = (bytes) =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
