#!/usr/bin/env node
// npx wildcrane-artifact-sdk publish [dir]
//
// Reads `wildcrane.component.json` in dir, packs every other file into a gzipped tar and
// publishes it as that version, with WILDCRANE_API_KEY.

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

import { MANIFEST, filesOf, tarOf } from './pack.mjs'

const API = (process.env.WILDCRANE_API_URL || 'https://api.ai4kanban.dev').replace(/\/+$/, '')

/** @param {string} path @param {{ method: string, headers: Record<string, string>, body: BodyInit }} init */
async function api(path, init) {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${process.env.WILDCRANE_API_KEY}`, ...init.headers },
  })
  const body = await r.json().catch(() => null)
  if (!r.ok) throw new Error(body?.error?.message ?? `${r.status} ${r.statusText}`)
  return body
}

/** @param {string} dir */
async function publish(dir) {
  if (!process.env.WILDCRANE_API_KEY) throw new Error('Set WILDCRANE_API_KEY to an API key of your account.')
  let manifest
  try {
    manifest = JSON.parse(readFileSync(join(dir, MANIFEST), 'utf8'))
  } catch (e) {
    throw new Error(`Cannot read ${join(dir, MANIFEST)}: ${e instanceof Error ? e.message : e}`)
  }
  const paths = filesOf(dir)
  if (!paths.includes('index.html')) throw new Error(`${dir} has no index.html.`)
  const bundle = gzipSync(tarOf(paths.map((p) => [p, readFileSync(join(dir, p))])))
  const { name, version, ...rest } = manifest
  const made = await api('/v1/components', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, version, manifest: rest }),
  })
  await api(made.upload.url, { method: 'PUT', headers: { 'content-type': 'application/gzip' }, body: bundle })
  console.log(`Published ${name}@${version} (${paths.length} files) — draws ${made.types.join(', ')}.`)
}

const [command, dir = '.'] = process.argv.slice(2)
if (command !== 'publish') {
  console.log('Usage: npx wildcrane-artifact-sdk publish [dir]')
  process.exit(command ? 1 : 0)
}
publish(resolve(dir)).catch((e) => {
  console.error(`publish: ${e.message}`)
  process.exit(1)
})
