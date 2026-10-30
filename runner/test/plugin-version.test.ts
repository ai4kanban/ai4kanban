import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { after, before, beforeEach, describe, it } from 'node:test'

import { checkReleased, forgetReleased, newerOf, pluginInfo, pluginVersion, releasedOf } from '../src/plugin-version'

// The panel's plugin version and the newer release it offers (#119).

const manifest = (url: string) => JSON.stringify({ plugins: [{ name: 'wildcrane', source: { source: 'archive', url } }] })
const RELEASE = (v: string) => `https://github.com/ai4kanban/ai4kanban/releases/download/plugin-v${v}/wildcrane-plugin.zip`

describe('plugin version', () => {
  it('reads the released version from the archive URL', () => {
    assert.equal(releasedOf(manifest(RELEASE('0.1.5'))), '0.1.5')
    assert.equal(releasedOf(manifest('https://example.com/wildcrane-plugin.zip')), null)
    assert.equal(releasedOf(JSON.stringify({ plugins: [{ name: 'other', source: { url: RELEASE('9.0.0') } }] })), null)
    assert.equal(releasedOf('<html>rate limited</html>'), null)
  })

  it('offers only a newer version', () => {
    assert.equal(newerOf('0.1.4', '0.1.5'), '0.1.5')
    assert.equal(newerOf('0.1.9', '0.1.10'), '0.1.10')
    assert.equal(newerOf('0.1.4', '0.1.4'), null)
    assert.equal(newerOf('0.2.0', '0.1.9'), null)
    assert.equal(newerOf(null, '0.1.5'), null)
    assert.equal(newerOf('0.1.4', null), null)
  })

  it("reads the plugin's own version, null without one", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wc-plugin-'))
    assert.equal(pluginVersion(root), null)
    fs.mkdirSync(path.join(root, '.claude-plugin'))
    fs.writeFileSync(path.join(root, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'wildcrane', version: '0.1.2' }))
    assert.equal(pluginVersion(root), '0.1.2')
  })
})

describe('the released version', () => {
  let server: http.Server
  let answer: { status: number; body: string }
  let hits = 0
  let url = ''
  const saved = { root: process.env.CLAUDE_PLUGIN_ROOT }

  before(async () => {
    server = http.createServer((_req, res) => {
      hits++
      res.writeHead(answer.status).end(answer.body)
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/marketplace.json`
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wc-plugin-'))
    fs.mkdirSync(path.join(root, '.claude-plugin'))
    fs.writeFileSync(path.join(root, '.claude-plugin', 'plugin.json'), JSON.stringify({ version: '0.1.4' }))
    process.env.CLAUDE_PLUGIN_ROOT = root
  })
  after(async () => {
    process.env.CLAUDE_PLUGIN_ROOT = saved.root
    await new Promise((r) => server.close(r))
  })
  beforeEach(() => {
    forgetReleased()
    hits = 0
  })

  it('offers a newer release and keeps it for 6 hours', async () => {
    answer = { status: 200, body: manifest(RELEASE('0.1.5')) }
    await checkReleased(url)
    assert.deepEqual(pluginInfo(), { version: '0.1.4', latest: '0.1.5' })
    await checkReleased(url, Date.now() + 60 * 60_000)
    assert.equal(hits, 1)
    await checkReleased(url, Date.now() + 7 * 60 * 60_000)
    assert.equal(hits, 2)
  })

  it('answers null when the request fails or the manifest cannot be read', async () => {
    answer = { status: 500, body: '' }
    await checkReleased(url)
    assert.equal(pluginInfo().latest, null)
    forgetReleased()
    answer = { status: 200, body: 'not json' }
    await checkReleased(url)
    assert.equal(pluginInfo().latest, null)
    forgetReleased()
    await checkReleased('http://127.0.0.1:9/marketplace.json')
    assert.deepEqual(pluginInfo(), { version: '0.1.4', latest: null })
  })
})
