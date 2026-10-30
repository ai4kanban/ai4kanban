// The pricing page (#2017): served with no sign-in, in the visitor's language, every number
// from src/quota.ts.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import worker from '../src/index.ts'
import { renderPricing } from '../src/pricing.ts'

const ENV = { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-role' }
const ctx = { waitUntil: () => {}, passThroughOnException: () => {} }
const get = (path, headers = {}) => worker.fetch(new Request(`https://api.ai4kanban.dev${path}`, { headers }), ENV, ctx)

describe('the pricing page', () => {
  it('answers in the language asked for, then the browser’s', async () => {
    assert.match(await (await get('/pricing?lang=en')).text(), /Plans and /)
    assert.match(await (await get('/pricing', { 'accept-language': 'zh-CN,zh;q=0.9' })).text(), /方案与/)
    const res = await get('/pricing')
    assert.equal(res.headers.get('content-type'), 'text/html; charset=utf-8')
    assert.match(await res.text(), /<html lang="en">/)
  })

  it('shows both plans’ limits, and no Studio', () => {
    const html = renderPricing('zh', 'https://project.supabase.co')
    for (const shown of ['3 个', '10 个', '1 GB', '20 GB', '100 MB', '7 天', '30 天', '$19', '到期删除任务、历史和预览']) {
      assert.ok(html.includes(shown), shown)
    }
    assert.equal((html.match(/data-checkout=/g) ?? []).length, 2)
    assert.ok(!/studio|waitlist/i.test(html))
  })

  it('shows Pro’s credits per use, by tier, from src/credits.ts (#87)', () => {
    const zh = renderPricing('zh', 'https://project.supabase.co')
    // Each rate on the wide table and Pro's phone plan.
    for (const shown of ['标准 160 · 高质 270', '经济 230 · 标准 320 · 高质 769']) assert.equal(zh.split(shown).length - 1, 2, shown)
    assert.ok(zh.includes('语音合成（每分钟积分）'))
    assert.ok(renderPricing('en', 'https://x').includes('Standard 160 · Premium 270'))
  })

  it('never lets an injected value out of its script', () => {
    const html = renderPricing('en', 'https://x.supabase.co/</script><b>')
    assert.ok(!html.includes('</script><b>'))
  })
})
