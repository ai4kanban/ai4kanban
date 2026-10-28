import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { after, before, beforeEach, describe, it } from 'node:test'

import { runnerHome, useRunnerHome } from '../src/home'
import { launch, readState } from '../src/launcher'
import { compare, extract, satisfies, versionDir, versionsDir } from '../src/update'

// The launcher against a stand-in registry and Cloud. Each fake Runner version records that it
// ran, then connects, crashes or hangs.

const CONNECTS = `process.send({ type: 'started' }); process.send({ type: 'connected' }, () => process.exit(0))`
const CRASHES = `process.send({ type: 'started' }, () => process.exit(1))`
const HANGS = `process.send({ type: 'started' }); setInterval(() => {}, 1000)`
const RECORD = `require('fs').appendFileSync(require('path').join(process.env.WILDCRANE_HOME, 'ran'), process.env.WILDCRANE_RUNNER_VERSION + '\\n');`

/** One npm tarball holding `package/dist/runner.mjs`. */
function tarball(files: Record<string, string>): Buffer {
  const blocks: Buffer[] = []
  for (const [name, content] of Object.entries(files)) {
    const body = Buffer.from(content)
    const header = Buffer.alloc(512)
    header.write(name, 0)
    header.write('0000644\0', 100)
    header.write(`${body.length.toString(8).padStart(11, '0')}\0`, 124)
    header.write('0', 156)
    header.write('        ', 148)
    let sum = 0
    for (const b of header) sum += b
    header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148)
    blocks.push(header, body, Buffer.alloc((512 - (body.length % 512)) % 512))
  }
  blocks.push(Buffer.alloc(1024))
  return zlib.gzipSync(Buffer.concat(blocks))
}

const runnerScript = (behaviour: string) => `import { createRequire } from 'node:module'; const require = createRequire(import.meta.url); ${RECORD} ${behaviour}`

interface Published {
  script: string
  node?: string
  corrupt?: boolean
}

let published: Record<string, Published> = {}
let target: string | null = null
let registryUp = true
let server: http.Server
let own: { version: string; entry: string }

before(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url!, 'http://x')
    if (url.pathname === '/v1/runner/version') return void res.end(JSON.stringify({ version: target }))
    if (!registryUp) return void res.writeHead(503).end()
    const meta = /^\/wildcrane-runner\/(.+)$/.exec(url.pathname)
    const tgz = /^\/tarballs\/(.+)\.tgz$/.exec(url.pathname)
    const version = decodeURIComponent((meta ?? tgz)?.[1] ?? '')
    const pkg = published[version]
    if (!pkg) return void res.writeHead(404).end()
    const tar = tarball({ 'package/package.json': '{}', 'package/dist/runner.mjs': runnerScript(pkg.script) })
    if (tgz) return void res.end(tar)
    const integrity = `sha512-${crypto.createHash('sha512').update(pkg.corrupt ? Buffer.from('other') : tar).digest('base64')}`
    const { port } = server.address() as AddressInfo
    res.end(JSON.stringify({
      engines: pkg.node ? { node: pkg.node } : undefined,
      dist: { tarball: `http://127.0.0.1:${port}/tarballs/${version}.tgz`, integrity },
    }))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  process.env.AI4KANBAN_CLOUD_URL = `http://127.0.0.1:${port}`
  process.env.npm_config_registry = `http://127.0.0.1:${port}`
  process.env.WILDCRANE_CONNECT_MS = '300'
})

after(() => new Promise<void>((resolve) => server.close(() => resolve())))

beforeEach(() => {
  useRunnerHome()
  fs.rmSync(runnerHome(), { recursive: true, force: true })
  fs.mkdirSync(runnerHome(), { recursive: true })
  const ownDir = fs.mkdtempSync(path.join(os.tmpdir(), 'own-runner-'))
  own = { version: '1.0.0', entry: path.join(ownDir, 'runner.mjs') }
  fs.writeFileSync(own.entry, runnerScript(CONNECTS))
  published = {}
  target = null
  registryUp = true
})

const ran = () => fs.readFileSync(path.join(runnerHome(), 'ran'), 'utf8').trim().split('\n')

describe('the launcher', () => {
  it('runs its own version when Cloud names none', async () => {
    assert.equal(await launch(own), 0)
    assert.deepEqual(ran(), ['1.0.0'])
  })

  it('updates to the version Cloud names, and keeps it once it connects', async () => {
    published['1.1.0'] = { script: CONNECTS }
    target = '1.1.0'
    assert.equal(await launch(own), 0)
    assert.deepEqual(ran(), ['1.1.0'])
    assert.deepEqual(readState().good, ['1.1.0'])
    assert.ok(fs.existsSync(path.join(versionDir('1.1.0'), 'dist', 'runner.mjs')))
  })

  it('removes the versions folder from before bin/ once a version there connects (#2147)', async () => {
    const legacy = path.join(runnerHome(), 'runner', '0.4.0')
    fs.mkdirSync(legacy, { recursive: true })
    assert.equal(await launch(own), 0)
    assert.ok(fs.existsSync(legacy), 'removed while starting a version from elsewhere')
    published['1.1.0'] = { script: CONNECTS }
    target = '1.1.0'
    assert.equal(await launch(own), 0)
    assert.equal(fs.existsSync(path.join(runnerHome(), 'runner')), false)
    assert.ok(versionDir('1.1.0').startsWith(path.join(runnerHome(), 'bin', 'runner')))
  })

  it('falls back to the version before when the new one crashes, and never tries it again', async () => {
    published['1.1.0'] = { script: CRASHES }
    target = '1.1.0'
    assert.equal(await launch(own), 0)
    assert.deepEqual(ran(), ['1.1.0', '1.0.0'])
    assert.deepEqual(readState().bad, ['1.1.0'])
    assert.equal(await launch(own), 0)
    assert.deepEqual(ran(), ['1.1.0', '1.0.0', '1.0.0'])
  })

  it('falls back when the new one never connects', async () => {
    published['1.1.0'] = { script: HANGS }
    target = '1.1.0'
    assert.equal(await launch(own), 0)
    assert.deepEqual(ran(), ['1.1.0', '1.0.0'])
  })

  it('discards a download whose sha512 does not match', async () => {
    published['1.1.0'] = { script: CONNECTS, corrupt: true }
    target = '1.1.0'
    assert.equal(await launch(own), 0)
    assert.deepEqual(ran(), ['1.0.0'])
    assert.ok(!fs.existsSync(versionDir('1.1.0')))
  })

  it('starts the current version when the download fails', async () => {
    target = '1.1.0'
    registryUp = false
    assert.equal(await launch(own), 0)
    assert.deepEqual(ran(), ['1.0.0'])
  })

  it('stays on the current version when the new one needs a newer Node', async () => {
    published['1.1.0'] = { script: CONNECTS, node: '>=99' }
    target = '1.1.0'
    assert.equal(await launch(own), 0)
    assert.deepEqual(ran(), ['1.0.0'])
  })

  it('keeps the two newest versions that connected', async () => {
    for (const version of ['1.1.0', '1.2.0', '1.3.0']) {
      published[version] = { script: CONNECTS }
      target = version
      await launch(own)
    }
    assert.deepEqual(readState().good, ['1.3.0', '1.2.0'])
    assert.deepEqual(fs.readdirSync(versionsDir()).filter((f) => f !== 'state.json').sort(), ['1.2.0', '1.3.0'])
  })

  it('rolls back when Cloud names an older version again', async () => {
    published['1.2.0'] = { script: CONNECTS }
    published['1.1.0'] = { script: CONNECTS }
    target = '1.2.0'
    await launch(own)
    target = '1.1.0'
    await launch(own)
    assert.deepEqual(ran(), ['1.2.0', '1.1.0'])
  })
})

describe('reading a release', () => {
  it('reads the ranges `engines.node` uses', () => {
    assert.ok(satisfies('18.19.0', '>=18.0.0'))
    assert.ok(!satisfies('16.20.0', '>=18'))
    assert.ok(satisfies('20.1.0', '^18 || ^20'))
    assert.ok(satisfies('22.3.0', '>=20 <23'))
    assert.ok(!satisfies('23.0.0', '>=20 <23'))
    assert.ok(satisfies('18.5.1', '18.x'))
    assert.ok(!satisfies('18.0.0', 'nonsense'))
    assert.ok(compare('1.10.0', '1.9.0') > 0)
  })

  it('refuses a tarball that writes outside its folder', () => {
    const into = fs.mkdtempSync(path.join(os.tmpdir(), 'extract-'))
    const tar = zlib.gunzipSync(tarball({ 'package/../../evil.txt': 'x' }))
    assert.throws(() => extract(tar, into), /refusing/)
  })
})
