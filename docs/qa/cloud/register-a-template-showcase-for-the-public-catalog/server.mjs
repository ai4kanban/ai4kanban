// The real cloud Worker (src/index.ts) on 127.0.0.1, its Supabase replaced by a stand-in:
// JWKS from a local key, and /rest/v1/rpc/<fn> run as api.<fn>(…) in the throwaway PostgreSQL.
// R2 is an in-memory bucket that answers ranges. Writes the key to key.json so mint.mjs can sign sessions.
import http from 'node:http'
import { spawn } from 'node:child_process'
import fs from 'node:fs'

const PORT = 8794
const BASE = `http://127.0.0.1:${PORT}`
const PG = ['-h', '/tmp/qa-cloud-cat/pg', '-p', '55474', '-U', 'postgres', '-At', '-v', 'VERBOSITY=verbose', '-v', 'ON_ERROR_STOP=1']
const { default: worker } = await import('/tmp/qa-cloud-cat/repo/cloud/src/index.ts')
const { jwksUrl } = await import('/tmp/qa-cloud-cat/repo/cloud/src/auth.ts')

const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const pub = await crypto.subtle.exportKey('jwk', kp.publicKey)
fs.writeFileSync('/tmp/qa-cloud-cat/key.json', JSON.stringify({ priv: await crypto.subtle.exportKey('jwk', kp.privateKey), base: BASE }))

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
  }).filter((a, i) => (sig.names[i] in body) || true)
  const call = `api.${fn}(${args.join(', ')})`
  const sql = sig.set ? `select coalesce(json_agg(t), '[]') from ${call} t` : `select to_json(${call})`
  const r = await psql(sql)
  if (r.code === 0) return [200, r.out === '' ? null : JSON.parse(r.out)]
  const m = /ERROR:\s+(\w{5}): (.*)/.exec(r.err)
  const detail = /DETAIL:\s+(.*)/.exec(r.err)
  console.error(`rpc ${fn} failed: ${r.err.split('\n')[0]}`)
  return [400, { code: m?.[1], message: m?.[2] ?? r.err, details: detail?.[1] ?? null }]
}

const bucket = (() => {
  const objects = new Map()
  return {
    async get(key, opts) {
      const b = objects.get(key); if (!b) return null
      const m = /bytes=(\d+)-(\d*)/.exec(opts?.range?.get?.('range') ?? '')
      if (!m) return { size: b.byteLength, body: new Blob([b]).stream(), arrayBuffer: async () => b }
      const offset = +m[1], end = m[2] ? +m[2] : b.byteLength - 1, part = b.slice(offset, end + 1)
      return { size: b.byteLength, range: { offset, length: part.byteLength }, body: new Blob([part]).stream() }
    },
    async put(key, value) { objects.set(key, value instanceof Uint8Array ? value : new Uint8Array(await new Response(value).arrayBuffer())) },
    async delete(keys) { for (const k of [keys].flat()) objects.delete(k) },
    async list({ prefix }) { return { objects: [...objects.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false } },
  }
})()
const env = { SUPABASE_URL: BASE, SUPABASE_SERVICE_ROLE_KEY: 'service-role', TEMPLATES: bucket }
const ctx = { waitUntil() {}, passThroughOnException() {} }
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

async function handle(req) {
  const url = new URL(req.url)
  if (req.url === jwksUrl(BASE)) return json(200, { keys: [{ ...pub, kid: 'k', alg: 'ES256' }] })
  const fn = url.pathname.split('/rest/v1/rpc/')[1]
  if (fn) { const [s, b] = await rpc(fn, await req.json().catch(() => ({}))); return json(s, b) }
  const res = await worker.fetch(req, env, ctx)
  console.log(`${req.method} ${url.pathname}${url.search} -> ${res.status}`)
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
