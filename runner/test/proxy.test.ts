import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { it } from 'node:test'

// #415: the Runner's own fetch follows the macOS proxy on every supported Node, from 22.0, and
// drops it once the proxy is turned off, without a restart.

for (const key of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy']) delete process.env[key]
const { followProxy } = await import('../src/proxy')

it('routes fetch through the system proxy and drops it when turned off', { skip: process.platform !== 'darwin' }, async (t) => {
  const seen: string[] = []
  const proxy = http.createServer()
  proxy.on('connect', (req, socket) => {
    seen.push(`CONNECT ${req.url}`)
    if (req.url!.endsWith(':443')) return void socket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n')
    socket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
    socket.once('data', () => socket.end('HTTP/1.1 200 OK\r\nContent-Length: 7\r\nConnection: close\r\n\r\nproxied'))
  })
  await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', resolve))
  t.after(() => proxy.close())
  const { port } = proxy.address() as AddressInfo

  followProxy(() => `<dictionary> {\n  HTTPEnable : 1\n  HTTPPort : ${port}\n  HTTPProxy : 127.0.0.1\n  HTTPSEnable : 1\n  HTTPSPort : ${port}\n  HTTPSProxy : 127.0.0.1\n}`)
  assert.equal(await (await fetch('http://runner.proxy.test/x')).text(), 'proxied')
  await assert.rejects(fetch('https://runner.proxy.test/'))
  assert.deepEqual(seen, ['CONNECT runner.proxy.test:80', 'CONNECT runner.proxy.test:443'])

  followProxy(() => '<dictionary> {\n}')
  await assert.rejects(fetch('http://runner.proxy.test/x'))
  assert.equal(seen.length, 2)
})

// #435: an akb the Runner starts takes the host's proxy through the preload, not Node's own switch.
it('routes a started akb through the host proxy', async (t) => {
  const proxy = http.createServer()
  proxy.on('connect', (_req, socket) => {
    socket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
    socket.once('data', () => socket.end('HTTP/1.1 200 OK\r\nContent-Length: 7\r\nConnection: close\r\n\r\nproxied'))
  })
  await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', resolve))
  t.after(() => proxy.close())
  const { port } = proxy.address() as AddressInfo
  const preload = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'akb-proxy.mjs')
  const env: NodeJS.ProcessEnv = { ...process.env, WILDCRANE_HOST_PROXY: JSON.stringify({ HTTP_PROXY: `http://127.0.0.1:${port}` }) }
  delete env.NODE_USE_ENV_PROXY
  const out = await new Promise<string>((resolve, reject) =>
    execFile(process.execPath, ['--import', pathToFileURL(preload).href, '-e', "fetch('http://akb.proxy.test/').then((r) => r.text()).then(console.log)"], { env }, (e, stdout) => (e ? reject(e) : resolve(stdout))))
  assert.equal(out.trim(), 'proxied')
})
