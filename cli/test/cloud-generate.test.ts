// `akb cloud image` and `akb cloud tts` (#1119): the messages and exit codes the scripts they
// replaced answered with — 1 for a refusal an agent relays to the user, 2 for a usage error.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { runAgent } from '../src/lib/agent-cli.ts'
import { writeSession } from '../src/lib/cloud/session.ts'
import { restoreMachineHome } from './helpers/board.ts'

const SUPABASE = 'https://project.supabase.co'
const API = 'https://api.example.test'

let home = ''
const realFetch = globalThis.fetch
let sent: { url: string; body: unknown }[] = []

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-generate-'))
  process.env.AI4KANBAN_HOME = home
  process.env.AI4KANBAN_SUPABASE_URL = SUPABASE
  process.env.AI4KANBAN_CLOUD_URL = API
  sent = []
})

afterEach(() => {
  globalThis.fetch = realFetch
  fs.rmSync(home, { recursive: true, force: true })
  restoreMachineHome()
  delete process.env.AI4KANBAN_SUPABASE_URL
  delete process.env.AI4KANBAN_CLOUD_URL
})

function signIn(): void {
  writeSession({
    version: 1,
    supabaseUrl: SUPABASE,
    accessToken: 'token-1',
    refreshToken: 'refresh-1',
    expiresAt: Date.now() + 60 * 60 * 1000,
    subject: '11111111-1111-4111-8111-111111111111',
  })
}

function answer(res: () => Response): void {
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    sent.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null })
    return res()
  }) as typeof fetch
}

const refusal = (status: number, code: string) => () =>
  new Response(JSON.stringify({ error: { code, message: code } }), { status })

/** Run it, holding stdout and stderr aside. */
async function akb(argv: string[]): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = []
  const err: string[] = []
  const [log, error] = [console.log, console.error]
  console.log = (line: unknown) => void out.push(String(line))
  console.error = (line: unknown) => void err.push(String(line))
  try {
    const code = await runAgent(argv, { program: 'akb', cwd: home })
    return { code, out: out.join('\n'), err: err.join('\n') }
  } finally {
    console.log = log
    console.error = error
  }
}

describe('akb cloud image / tts', () => {
  it('exits 2 with the usage line when an option or the prompt is missing', async () => {
    for (const [argv, problem] of [
      [['cloud', 'image', '--out', 'a.png', 'a cat'], 'Missing --aspect.'],
      [['cloud', 'image', '--aspect', '16:9', 'a cat'], 'Missing --out.'],
      [['cloud', 'image', '--aspect', '16:9', '--out', 'a.png'], 'Missing the prompt.'],
      [['cloud', 'tts', '--out', 'a.wav', 'hi'], 'Missing --voice.'],
      [['cloud', 'tts', '--voice', 'Ava', '--out', 'a.wav'], 'Missing the text to speak.'],
    ] as const) {
      const { code, err } = await akb([...argv])
      assert.equal(code, 2, argv.join(' '))
      assert.match(err, new RegExp(`^${problem}\\nusage: akb cloud ${argv[1]} `))
    }
  })

  it('exits 2 for a reference that is not an image', async () => {
    const { code, err } = await akb(['cloud', 'image', '--aspect', '1:1', '--ref', 'x.gif', '--out', 'a.png', 'cat'])
    assert.equal(code, 2)
    assert.match(err, /--ref x\.gif: use a PNG, JPEG or WebP file\./)
  })

  it('exits 1 when signed out, in both languages, offering the fallback', async () => {
    answer(() => assert.fail('nothing is sent while signed out'))
    const { code, err } = await akb(['cloud', 'tts', '--voice', 'Ava', '--out', 'a.wav', 'hi'])
    assert.equal(code, 1)
    assert.match(err, /^未登录 AI4Kanban Cloud/)
    assert.match(err, /Not signed in to AI4Kanban Cloud/)
    assert.match(err, /npx hyperframes tts --list/)
  })

  it('exits 1 without Pro, naming what Pro unlocks', async () => {
    signIn()
    answer(refusal(403, 'pro_required'))
    const image = await akb(['cloud', 'image', '--aspect', '16:9', '--out', 'a.png', 'a cat'])
    assert.equal(image.code, 1)
    assert.match(image.err, /生成封面是 Pro 功能/)
    assert.match(image.err, /lay out the cover from existing material/)
    const tts = await akb(['cloud', 'tts', '--voice', 'Ava', '--out', 'a.wav', 'hi'])
    assert.equal(tts.code, 1)
    assert.match(tts.err, /Hosted voices are a Pro feature/)
  })

  it('exits 1 when the credits are used up, and 2 when Cloud refuses the request', async () => {
    signIn()
    answer(refusal(402, 'credits_used_up'))
    const spent = await akb(['cloud', 'tts', '--voice', 'Ava', '--out', 'a.wav', 'hi'])
    assert.equal(spent.code, 1)
    assert.match(spent.err, /本月积分已用完/)
    answer(refusal(400, 'Unknown voice.'))
    const bad = await akb(['cloud', 'tts', '--voice', 'Nobody', '--out', 'a.wav', 'hi'])
    assert.equal(bad.code, 2)
    assert.match(bad.err, /^Unknown voice\.\nusage: akb cloud tts /)
  })

  it('writes the file and names it with the model', async () => {
    signIn()
    const ref = path.join(home, 'shot.png')
    fs.writeFileSync(ref, 'png')
    answer(() => new Response('image-bytes', { headers: { 'x-model': 'model-x' } }))
    const out = path.join(home, 'covers', 'a.png')
    const { code, out: said } = await akb(['cloud', 'image', '--aspect', '16:9', '--ref', ref, '--out', out, 'a', 'cat'])
    assert.equal(code, 0)
    assert.equal(fs.readFileSync(out, 'utf8'), 'image-bytes')
    assert.equal(said, `${out} (model-x)`)
    assert.deepEqual(sent, [
      {
        url: `${API}/v1/image`,
        body: { prompt: 'a cat', aspect: '16:9', references: [`data:image/png;base64,${Buffer.from('png').toString('base64')}`] },
      },
    ])
  })
})
