// Stands in for Supabase's query API with a local PostgreSQL, so the page's own query runs
// against sample rows. Preload it: node --import ./stand-in.mjs …; PGHOST and PGPORT name the cluster.
import { spawnSync } from 'node:child_process'

const real = globalThis.fetch
globalThis.fetch = async (url, init) => {
  if (!String(url).startsWith('https://api.supabase.com/v1/projects/')) return real(url, init)
  const run = spawnSync('psql', ['-U', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1', '-c', JSON.parse(init.body).query], {
    encoding: 'utf8',
  })
  if (run.status !== 0) return new Response(run.stderr, { status: 400 })
  return Response.json([{ ai: JSON.parse(run.stdout) }])
}
