import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { withSystemProxy } from '../src/lib/agent/proxy.ts'

const configured = `<dictionary> {
  HTTPEnable : 1
  HTTPProxy : proxy.example
  HTTPPort : 8080
  HTTPSEnable : 1
  HTTPSProxy : secure.example
  HTTPSPort : 8443
  SOCKSEnable : 1
  SOCKSProxy : ::1
  SOCKSPort : 1080
  ExceptionsList : <array> {
    0 : localhost
    1 : *.example.org
  }
}`

describe('后台代理', () => {
  it('继承系统已启用的手动代理与绕过列表', () => {
    assert.deepEqual(withSystemProxy({}, 'darwin', () => configured), {
      HTTP_PROXY: 'http://proxy.example:8080', HTTPS_PROXY: 'http://secure.example:8443',
      ALL_PROXY: 'socks5://[::1]:1080', NO_PROXY: 'localhost,.example.org',
    })
  })

  it('显式环境变量优先，包括空值；不探测系统或覆盖选择', () => {
    for (const key of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy']) {
      for (const value of ['', 'http://chosen.example:1234']) {
        const env = { [key]: value, NO_PROXY: 'kept' }
        assert.deepEqual(withSystemProxy(env, 'darwin', () => { throw new Error('不得读取') }), env)
      }
    }
  })

  it('保留显式绕过列表，不修改原环境', () => {
    const env = { no_proxy: 'chosen', PATH: '/bin' }
    const out = withSystemProxy(env, 'darwin', () => configured)
    assert.equal(out.no_proxy, 'chosen')
    assert.equal(out.NO_PROXY, undefined)
    assert.deepEqual(env, { no_proxy: 'chosen', PATH: '/bin' })
  })

  it('未启用、无效、读取失败或其他平台保持直连', () => {
    for (const raw of ['', configured.replaceAll('Enable : 1', 'Enable : 0'), 'HTTPEnable : 1\nHTTPProxy : bad/host\nHTTPPort : 8080', 'HTTPEnable : 1\nHTTPProxy : proxy.example\nHTTPPort : 70000']) {
      assert.deepEqual(withSystemProxy({}, 'darwin', () => raw), {})
    }
    assert.deepEqual(withSystemProxy({}, 'darwin', () => { throw new Error('失败') }), {})
    assert.deepEqual(withSystemProxy({}, 'linux', () => configured), {})
  })
})
