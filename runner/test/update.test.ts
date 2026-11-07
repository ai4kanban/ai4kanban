import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { after, before, beforeEach, describe, it } from 'node:test'

import { akbHome, bundledAkb } from '../src/akb'
import { akbVersionDir, currentAkb, followAkb, readAkbState, sweepAkb } from '../src/akb-version'
import { IDLE_MS } from '../src/cache'
import { runnerHome, useRunnerHome } from '../src/home'
import { acceptAlphaUpdates, saveAlphaUpdates } from '../src/preferences'
import { launch, readState } from '../src/launcher'
import { AKB_CONTRACT } from '../src/protocol'
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

interface PublishedAkb {
  contract?: number
  /** What `--version` prints; the version itself when left out. */
  says?: string
  exit?: number
  corrupt?: boolean
}

let published: Record<string, Published> = {}
let akbs: Record<string, PublishedAkb> = {}
let akbAsked = 0
let target: string | null = null
let alphaTarget: string | null = null
let rollback = 0
let onDownload = () => {}
let restartable = true
let registryUp = true
let server: http.Server
let own: { version: string; entry: string }

before(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url!, 'http://x')
    if (url.pathname === '/v1/runner/version') {
      const alpha = url.searchParams.get('alpha') === 'true' && alphaTarget !== null
      return void res.end(JSON.stringify({ version: alpha ? alphaTarget : target, restartable, alpha, rollback }))
    }
    if (!registryUp) return void res.writeHead(503).end()
    const akbMeta = /^\/wildcrane\/(.+)$/.exec(url.pathname)
    const akbTgz = /^\/akb-tarballs\/(.+)\.tgz$/.exec(url.pathname)
    if (akbMeta || akbTgz) {
      const version = decodeURIComponent((akbMeta ?? akbTgz)![1]!)
      const pkg = akbs[version]
      if (!pkg) return void res.writeHead(404).end()
      const tar = tarball({
        'package/package.json': JSON.stringify({ version, akbContract: pkg.contract ?? AKB_CONTRACT }),
        'package/bin/ai4kanban.mjs': `console.log(${JSON.stringify(`wildcrane ${pkg.says ?? version}`)}); process.exit(${pkg.exit ?? 0})`,
      })
      if (akbTgz) return void res.end(tar)
      akbAsked++
      const { port } = server.address() as AddressInfo
      return void res.end(JSON.stringify({
        dist: { tarball: `http://127.0.0.1:${port}/akb-tarballs/${version}.tgz`, integrity: `sha512-${crypto.createHash('sha512').update(pkg.corrupt ? Buffer.from('other') : tar).digest('base64')}` },
      }))
    }
    const meta = /^\/wildcrane-runner\/(.+)$/.exec(url.pathname)
    const tgz = /^\/tarballs\/(.+)\.tgz$/.exec(url.pathname)
    const version = decodeURIComponent((meta ?? tgz)?.[1] ?? '')
    const pkg = published[version]
    if (!pkg) return void res.writeHead(404).end()
    const tar = tarball({ 'package/package.json': '{}', 'package/dist/runner.mjs': runnerScript(pkg.script) })
    if (tgz) { onDownload(); return void res.end(tar) }
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
  process.env.WILDCRANE_UPDATE_MS = '25'
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
  akbs = {}
  akbAsked = 0
  target = null
  registryUp = true
  restartable = true
  alphaTarget = null
  rollback = 0
  onDownload = () => {}
})

const ran = () => fs.readFileSync(path.join(runnerHome(), 'ran'), 'utf8').trim().split('\n')

describe('the launcher', () => {
  it('Alpha defaults off, persists opt-in and follows subsequent Alphas, with default fallback', async () => {
    target = '1.0.0'; alphaTarget = '1.1.0'
    published['1.1.0'] = { script: CONNECTS }; published['1.2.0'] = { script: CONNECTS }
    assert.equal(acceptAlphaUpdates(), false)
    await launch(own); assert.deepEqual(ran(), ['1.0.0'])
    saveAlphaUpdates(true); await launch(own)
    alphaTarget = '1.2.0'; await launch(own)
    alphaTarget = null; target = '1.2.0'; await launch(own)
    assert.deepEqual(ran(), ['1.0.0', '1.1.0', '1.2.0', '1.2.0'])
  })

  it('Alpha opt-out waits across restarts until default catches up; explicit withdrawals still roll back', async () => {
    target = '1.0.0'; alphaTarget = '1.2.0'
    published['1.2.0'] = { script: CONNECTS }; published['1.3.0'] = { script: CONNECTS }
    saveAlphaUpdates(true); await launch(own)
    alphaTarget = null; await launch(own)
    saveAlphaUpdates(false); await launch(own); await launch(own)
    saveAlphaUpdates(true); await launch(own); saveAlphaUpdates(false)
    target = '1.2.0'; await launch(own)
    target = '1.3.0'; await launch(own)
    assert.deepEqual(ran(), ['1.2.0', '1.2.0', '1.2.0', '1.2.0', '1.2.0', '1.2.0', '1.3.0'])
    saveAlphaUpdates(true); alphaTarget = '1.4.0'; published['1.4.0'] = { script: CONNECTS }; await launch(own)
    saveAlphaUpdates(false); alphaTarget = null; rollback++; await launch(own)
    assert.equal(ran().at(-1), '1.3.0')
  })

  it('rechecks opt-in after startup download and refuses a withdrawn Alpha', async () => {
    target = '1.0.0'; alphaTarget = '1.1.0'; published['1.1.0'] = { script: CONNECTS }
    saveAlphaUpdates(true); onDownload = () => saveAlphaUpdates(false)
    await launch(own); assert.deepEqual(ran(), ['1.0.0'])
    saveAlphaUpdates(true); alphaTarget = '1.2.0'; published['1.2.0'] = { script: CONNECTS }
    onDownload = () => { alphaTarget = null }
    await launch(own); assert.deepEqual(ran(), ['1.0.0', '1.0.0'])
  })

  it('does not hand off when opt-in changes during an online download or same-version promotion', async () => {
    fs.writeFileSync(own.entry, runnerScript(`
      process.send({ type: 'connected' });
      process.on('message', () => process.exit(99));
      setTimeout(() => process.exit(0), 180);
    `))
    target = '1.0.0'; saveAlphaUpdates(true)
    published['1.1.0'] = { script: CONNECTS }
    onDownload = () => saveAlphaUpdates(false)
    await launch(own, { onMessage: m => { if (m.type === 'connected') alphaTarget = '1.1.0' } })
    assert.deepEqual(ran(), ['1.0.0'])
    saveAlphaUpdates(true); alphaTarget = '1.0.0'
    await launch(own, { onMessage: m => { if (m.type === 'connected') { alphaTarget = null; target = '1.0.0' } } })
    assert.deepEqual(ran(), ['1.0.0', '1.0.0'])
  })

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

  it('旧云端没有更新交接能力时保持原进程', async () => {
    restartable = false
    fs.writeFileSync(own.entry, runnerScript(`
      process.send({ type: 'started' }); process.send({ type: 'connected' });
      process.on('message', () => process.exit(99));
      setTimeout(() => process.exit(0), 250);
    `))
    published['1.1.0'] = { script: CONNECTS }
    const going = launch(own)
    setTimeout(() => { target = '1.1.0' }, 60)
    assert.equal(await going, 0)
    assert.deepEqual(ran(), ['1.0.0'])
  })

  it('在线下载后要求旧进程保存并退出，才启动新版', async () => {
    fs.writeFileSync(own.entry, runnerScript(`
      process.send({ type: 'started' }); process.send({ type: 'connected' });
      process.on('message', (m) => {
        if (m.type === 'update') {
          require('fs').writeFileSync(require('path').join(process.env.WILDCRANE_HOME, 'saved'), 'yes');
          process.exit(12);
        }
      });
    `))
    published['1.1.0'] = { script: `
      if (!require('fs').existsSync(require('path').join(process.env.WILDCRANE_HOME, 'saved'))) process.exit(1);
      ${CONNECTS}
    ` }
    const going = launch(own)
    setTimeout(() => { target = '1.1.0' }, 80)
    assert.equal(await going, 0)
    assert.deepEqual(ran(), ['1.0.0', '1.1.0'])
  })

  it('在线下载失败时保持原进程，网络恢复后更新；新版崩溃回退', async () => {
    fs.writeFileSync(own.entry, runnerScript(`
      process.send({ type: 'started' }); process.send({ type: 'connected' });
      if (require('fs').existsSync(require('path').join(process.env.WILDCRANE_HOME, 'saved'))) process.exit(0);
      process.on('message', (m) => {
        if (m.type === 'update') {
          require('fs').writeFileSync(require('path').join(process.env.WILDCRANE_HOME, 'saved'), 'yes');
          process.exit(12);
        }
      });
    `))
    published['1.1.0'] = { script: CRASHES }
    registryUp = false
    const going = launch(own)
    setTimeout(() => { target = '1.1.0' }, 50)
    setTimeout(() => {
      assert.deepEqual(ran(), ['1.0.0'])
      registryUp = true
    }, 200)
    assert.equal(await going, 0)
    assert.deepEqual(ran(), ['1.0.0', '1.1.0', '1.0.0'])
    assert.deepEqual(readState().bad, ['1.1.0'])
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

describe('following the akb Cloud names (#171)', () => {
  const bundled = () => bundledAkb().args.at(-1)
  const on = async (version: string) => {
    akbs[version] = {}
    await followAkb({ version })
    assert.equal(readAkbState().current, version)
  }

  it('runs the bundled akb until Cloud names one, then the one it named', async () => {
    assert.equal(currentAkb().args.at(-1), bundled())
    await on('1.1.0')
    const akb = currentAkb()
    assert.equal(akb.version, '1.1.0')
    assert.equal(akb.args.at(-1), path.join(akbVersionDir('1.1.0'), 'bin', 'ai4kanban.mjs'))
    assert.equal(akb.shim, path.join(akbVersionDir('1.1.0'), 'shim'))
    assert.deepEqual(fs.readdirSync(akbHome()).sort(), ['1.1.0', 'state.json'])
  })

  it('downloads only when the version changes', async () => {
    await on('1.1.0')
    await followAkb({ version: '1.1.0' })
    assert.equal(akbAsked, 1)
  })

  it('goes back to the bundled akb on null, or when Cloud names that version', async () => {
    await on('1.1.0')
    await followAkb({ version: null })
    assert.equal(currentAkb().args.at(-1), bundled())
    await on('1.1.0')
    await followAkb({ version: '0.0.0-test' })
    assert.equal(currentAkb().args.at(-1), bundled())
  })

  it('follows a rollback to an older version', async () => {
    await on('1.2.0')
    await on('1.1.0')
    assert.equal(currentAkb().version, '1.1.0')
  })

  it('stays where it is with no answer, an unreachable registry or a corrupt download, and tries again', async () => {
    await on('1.1.0')
    await followAkb(undefined)
    assert.equal(currentAkb().version, '1.1.0')
    registryUp = false
    await followAkb({ version: '1.2.0' })
    assert.equal(currentAkb().version, '1.1.0')
    registryUp = true
    akbs['1.2.0'] = { corrupt: true }
    await followAkb({ version: '1.2.0' })
    assert.equal(currentAkb().version, '1.1.0')
    assert.ok(!fs.existsSync(akbVersionDir('1.2.0')))
    await on('1.2.0')
  })

  it('never switches to a version of another contract, or one that does not answer, and never tries it again', async () => {
    await on('1.1.0')
    akbs['2.0.0'] = { contract: AKB_CONTRACT + 1 }
    akbs['2.1.0'] = { says: '9.9.9' }
    akbs['2.2.0'] = { exit: 3 }
    for (const version of ['2.0.0', '2.1.0', '2.2.0']) await followAkb({ version })
    assert.deepEqual(readAkbState(), { current: '1.1.0', bad: ['2.0.0', '2.1.0', '2.2.0'] })
    const asked = akbAsked
    await followAkb({ version: '2.0.0' })
    assert.equal(akbAsked, asked)
    assert.equal(currentAkb().version, '1.1.0')
  })

  it('takes the bundled akb when the current version is gone or of another contract', async () => {
    await on('1.1.0')
    const manifest = path.join(akbVersionDir('1.1.0'), 'package.json')
    const held = fs.readFileSync(manifest, 'utf8')
    fs.writeFileSync(manifest, JSON.stringify({ akbContract: AKB_CONTRACT + 1 }))
    assert.equal(currentAkb().args.at(-1), bundled())
    fs.writeFileSync(manifest, held)
    assert.equal(currentAkb().version, '1.1.0')
    fs.rmSync(akbVersionDir('1.1.0'), { recursive: true })
    assert.equal(currentAkb().args.at(-1), bundled())
  })

  it('does not switch when Cloud moved on while it downloaded', async () => {
    akbs['1.1.0'] = {}
    const going = followAkb({ version: '1.1.0' })
    await followAkb({ version: null })
    await going
    assert.equal(readAkbState().current, null)
  })

  it('ignores a version that is not one', async () => {
    await followAkb({ version: '../../evil' })
    assert.equal(akbAsked, 0)
    assert.equal(fs.existsSync(akbHome()), false)
  })

  it('removes what was not chosen for 7 days, never the current version or the old shim', async () => {
    await on('1.1.0')
    await on('1.2.0')
    fs.writeFileSync(path.join(akbHome(), 'akb'), '#!/bin/sh\n')
    fs.mkdirSync(path.join(akbHome(), 'bundled-0.0.0-old'))
    const later = Date.now() + IDLE_MS + 60_000
    sweepAkb(Date.now())
    assert.ok(fs.existsSync(akbVersionDir('1.1.0')), 'a recent version went')
    sweepAkb(later)
    assert.deepEqual(fs.readdirSync(akbHome()).sort(), ['1.2.0', 'akb', 'state.json'])
  })

  it('counts a choice as use', async () => {
    await on('1.1.0')
    const old = new Date(Date.now() - IDLE_MS)
    fs.utimesSync(akbVersionDir('1.1.0'), old, old)
    currentAkb()
    assert.ok(Date.now() - fs.statSync(akbVersionDir('1.1.0')).mtimeMs < 60_000)
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
