// The real cloud Worker (src/index.ts) on 127.0.0.1:8796. Supabase's JWKS and RPC are a stand-in
// (RPC really runs as api.<fn>(…) in the throwaway PostgreSQL); Creem's API answers a checkout
// with a stand-in page on this server. `node server.mjs` writes key.json for session.mjs.
import http from 'node:http'
import { spawn } from 'node:child_process'
import fs from 'node:fs'

const Q = '/tmp/qa-cloud-trial'
const PORT = 8796
const BASE = `http://127.0.0.1:${PORT}`
const PG = ['-h', `${Q}/pg`, '-p', '55492', '-U', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1']
const { default: worker } = await import(`${Q}/repo/cloud/src/index.ts`)
const { jwksUrl } = await import(`${Q}/repo/cloud/src/auth.ts`)

const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const pub = await crypto.subtle.exportKey('jwk', kp.publicKey)
fs.writeFileSync(`${Q}/key.json`, JSON.stringify({ priv: await crypto.subtle.exportKey('jwk', kp.privateKey), base: BASE }))

const psql = (sql) => new Promise((resolve) => {
  const p = spawn('psql', PG); let out = '', err = ''
  p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (err += d))
  p.on('close', (code) => resolve({ code, out: out.trim(), err })); p.stdin.end(sql)
})
const sigs = new Map()
async function signature(fn) {
  if (!sigs.has(fn)) {
    const r = await psql(`select json_build_object('names', proargnames, 'types', array(select format_type(t, null) from unnest(proargtypes) t), 'set', proretset) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'api' and p.proname = '${fn.replace(/\W/g, '')}'`)
    sigs.set(fn, r.out ? JSON.parse(r.out.split('\n')[0]) : null)
  }
  return sigs.get(fn)
}
async function rpc(fn, body) {
  const sig = await signature(fn)
  if (!sig) return [404, { code: 'PGRST202', message: `no function api.${fn}` }]
  const j = `$j$${JSON.stringify(body)}$j$::jsonb`
  const args = (sig.names ?? []).map((n, i) => {
    const t = sig.types[i]
    if (!(n in body) || body[n] === null) return `${n} => null::${t}`
    if (t === 'jsonb' || t === 'json') return `${n} => (${j}->'${n}')::${t}`
    if (t.endsWith('[]')) return `${n} => array(select jsonb_array_elements_text(${j}->'${n}'))::${t}`
    return `${n} => (${j}->>'${n}')::${t}`
  })
  const call = `api.${fn}(${args.join(', ')})`
  const r = await psql(sig.set ? `select coalesce(json_agg(t), '[]') from ${call} t` : `select to_json(${call})`)
  if (r.code === 0) return [200, r.out === '' ? null : JSON.parse(r.out)]
  const m = /ERROR:\s+(.*)/.exec(r.err)
  console.error(`rpc ${fn} failed: ${r.err.split('\n')[0]}`)
  return [400, { message: m?.[1] ?? r.err }]
}

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const realFetch = globalThis.fetch
globalThis.fetch = async (url, init = {}) => {
  const address = String(url instanceof Request ? url.url : url)
  if (!address.startsWith('https://test-api.creem.io/')) return realFetch(url, init)
  const path = address.slice(25)
  console.log(`creem ${init.method ?? 'GET'} ${path}`)
  if (path === '/v1/checkouts' && init.method === 'POST') return json(200, { id: 'ch_qa', checkout_url: `${BASE}/creem/checkout` })
  if (path.startsWith('/v1/checkouts?')) return json(200, { id: 'ch_qa', status: 'pending' })
  return json(404, {})
}

const env = {
  SUPABASE_URL: BASE, SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  CREEM_API_KEY: 'creem_test_stand_in', CREEM_WEBHOOK_SECRET: 'stand-in', CREEM_PRODUCT_MONTHLY: 'prod_m', CREEM_PRODUCT_YEARLY: 'prod_y',
}
const ctx = { waitUntil() {}, passThroughOnException() {} }

async function handle(req) {
  const url = new URL(req.url)
  if (req.url === jwksUrl(BASE)) return json(200, { keys: [{ ...pub, kid: 'k', alg: 'ES256' }] })
  if (url.pathname === '/creem/checkout') {
    return new Response('<!doctype html><title>Checkout</title><h1>Creem checkout (stand-in)</h1>', { headers: { 'content-type': 'text/html' } })
  }
  const fn = url.pathname.split('/rest/v1/rpc/')[1]
  if (fn) { const [s, b] = await rpc(fn, await req.json().catch(() => ({}))); return json(s, b) }
  const res = await worker.fetch(req, env, ctx)
  const text = await res.clone().text()
  console.log(`${req.method} ${url.pathname} -> ${res.status}${res.status >= 400 || url.pathname.startsWith('/v1/billing') ? ` ${text.slice(0, 400)}` : ''}`)
  return res
}

http.createServer(async (inc, out) => {
  const chunks = []; for await (const c of inc) chunks.push(c)
  const body = chunks.length ? Buffer.concat(chunks) : undefined
  const req = new Request(`${BASE}${inc.url}`, { method: inc.method, headers: inc.headers, body: ['GET', 'HEAD'].includes(inc.method) ? undefined : body, duplex: 'half' })
  try {
    const res = await handle(req)
    out.writeHead(res.status, Object.fromEntries(res.headers)); out.end(Buffer.from(await res.arrayBuffer()))
  } catch (e) { console.error(e); out.writeHead(500); out.end(String(e)) }
}).listen(PORT, '127.0.0.1', () => console.log(`listening ${BASE}`))
