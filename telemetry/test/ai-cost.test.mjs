import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import { withCloudEnv } from '../scripts/ai-cost.mjs'

describe('the Cloud credentials the AI cost section reads with', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'ai-cost-')), '.env')
  writeFileSync(
    file,
    'SUPABASE_PROJECT_REF="ref-cloud"\nSUPABASE_ACCESS_TOKEN="token-cloud"\nPADDLE_API_KEY="not-ours"\n',
  )

  it('takes both from cloud/.env when neither is set, and nothing else', () => {
    assert.deepEqual(withCloudEnv({ HOME: '/h' }, file), {
      HOME: '/h',
      SUPABASE_PROJECT_REF: 'ref-cloud',
      SUPABASE_ACCESS_TOKEN: 'token-cloud',
    })
  })

  it('keeps a value that is already set', () => {
    const env = withCloudEnv({ SUPABASE_PROJECT_REF: 'ref-own' }, file)
    assert.equal(env.SUPABASE_PROJECT_REF, 'ref-own')
    assert.equal(env.SUPABASE_ACCESS_TOKEN, 'token-cloud')
  })

  it('leaves the environment alone when there is no cloud/.env', () => {
    const env = { HOME: '/h' }
    assert.equal(withCloudEnv(env, join(tmpdir(), 'no-such-dir', '.env')), env)
  })
})
