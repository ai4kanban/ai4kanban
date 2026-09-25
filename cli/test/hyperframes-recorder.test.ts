// The recorder `hyperframes-editor` ships (#993). A video task writes its environment and its
// per-shot actions; connecting, sampling, encoding, checking and remembering what is already
// recorded are this one file's, so no second task writes them again.
//
// The end-to-end part drives a real headless Chrome through ffmpeg and is skipped where either
// is missing — the rest of the file still covers the contract around it.

import assert from 'node:assert/strict'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'

import { BUNDLED_AGENT_FILES } from '../src/lib/agents/bundled.ts'
import { findSpecAgent } from '../src/lib/agents/index.ts'

let project = ''
let recorder = ''

const CHROME = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p))
const has = (tool: string): boolean => spawnSync(tool, ['-version'], { stdio: 'ignore' }).status === 0
const canRecord = Boolean(CHROME) && has('ffmpeg') && has('ffprobe')

/** Run the recorder inside the throwaway project, as a task would. */
const run = (...args: string[]): { status: number; out: string; err: string } => {
  const done = spawnSync(process.execPath, [recorder, ...args], { cwd: project, encoding: 'utf8' })
  return { status: done.status ?? 1, out: done.stdout ?? '', err: done.stderr ?? '' }
}

const ledger = (): Record<string, { status: string; output?: string; sampledFps?: number; reason?: string }> =>
  JSON.parse(fs.readFileSync(path.join(project, '.record', 'ledger.json'), 'utf8')).shots

before(() => {
  project = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'akb-record-')))
  recorder = path.join(project, 'record.mjs')
  fs.writeFileSync(recorder, BUNDLED_AGENT_FILES['hyperframes-editor/record.mjs']!)
})

after(() => {
  try {
    fs.rmSync(project, { recursive: true, force: true })
  } catch {
    // The browser's own profile folder may still be closing; the temp folder goes either way.
  }
})

describe('the agent ships it', () => {
  it('names it among its own files, to be saved with `akb raw agent-file`', () => {
    assert.deepEqual(findSpecAgent('hyperframes-editor')!.files, ['record.mjs'])
  })

  it('is a runnable script, not a description of one', () => {
    const text = BUNDLED_AGENT_FILES['hyperframes-editor/record.mjs']!
    assert.match(text, /^#!\/usr\/bin\/env node/)
    assert.match(text, /record\.config\.mjs/)
    assert.match(text, /shots\/<id>\.mjs/)
  })
})

describe('what a task writes', () => {
  it('scaffolds the two files a task owns, and nothing else', () => {
    const said = run('--init')
    assert.equal(said.status, 0, said.err)
    assert.ok(fs.existsSync(path.join(project, 'record.config.mjs')))
    assert.ok(fs.existsSync(path.join(project, 'shots', 'S1.mjs')))
    assert.match(fs.readFileSync(path.join(project, 'shots', 'S1.mjs'), 'utf8'), /async take\(ctx\)/)
  })

  it('leaves a file that is already there alone', () => {
    fs.writeFileSync(path.join(project, 'shots', 'S1.mjs'), 'export default { async take() {} }\n')
    assert.match(run('--init').out, /already here/)
    assert.equal(fs.readFileSync(path.join(project, 'shots', 'S1.mjs'), 'utf8'), 'export default { async take() {} }\n')
  })

  it('says which shots it has when asked for one it does not', () => {
    const said = run('S9')
    assert.equal(said.status, 2)
    assert.match(said.err, /no shot file for `S9`.*This project has: S1/s)
  })

  it('refuses to guess at a missing config', () => {
    const said = run('--config=nowhere.mjs')
    assert.equal(said.status, 2)
    assert.match(said.err, /--init/)
  })

  it('says where the browser should be, rather than failing somewhere inside CDP', () => {
    // Port 9 discards whatever reaches it and answers nothing, so this is a browser that is
    // not there whatever else the machine happens to be running.
    fs.writeFileSync(path.join(project, 'nobody.config.mjs'), "export default { browser: 'http://127.0.0.1:9' }\n")
    const said = run('--config=nobody.config.mjs')
    assert.equal(said.status, 2)
    assert.match(said.err, /no browser answering at http:\/\/127\.0\.0\.1:9.*--remote-debugging-port=9/s)
  })
})

describe('recording, resuming and retaking', { skip: canRecord ? false : 'needs Chrome, ffmpeg and ffprobe' }, () => {
  let chrome: ReturnType<typeof spawn> | null = null
  const port = 9000 + (process.pid % 900)
  const page = (body: string): string => `data:text/html,${encodeURIComponent(`<style>body{margin:0;background:#111}#b{width:80px;height:80px;background:#dd4f1e;animation:m 1s linear infinite}@keyframes m{to{transform:translateX(600px)}}</style><div id=b></div>${body}`)}`

  before(async () => {
    const profile = path.join(project, '.chrome')
    chrome = spawn(CHROME!, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--headless=new', '--no-first-run', '--no-default-browser-check'], { stdio: 'ignore' })
    for (let tries = 0; tries < 60; tries += 1) {
      const up = await fetch(`http://127.0.0.1:${port}/json/version`).then(() => true).catch(() => false)
      if (up) return
      await new Promise((r) => setTimeout(r, 250))
    }
    throw new Error('Chrome did not open its debugging port')
  })

  after(async () => {
    chrome?.kill()
    await new Promise((r) => setTimeout(r, 500))
  })

  const shot = (id: string, body: string, extra = ''): void =>
    fs.writeFileSync(
      path.join(project, 'shots', `${id}.mjs`),
      `export default {
  output: '${id.toLowerCase()}.mp4',
  expect: { seconds: [0.5, 12], fps: 0.2 },
  async reset(ctx) { await ctx.go(${JSON.stringify(page(body))}) },
  async check(ctx) { await ctx.until('!!document.querySelector("#b")') },
  async take(ctx) { await ctx.sleep(2000) },
${extra}}
`,
    )

  before(() => {
    fs.writeFileSync(
      path.join(project, 'record.config.mjs'),
      `export default {
  browser: 'http://127.0.0.1:${port}',
  viewport: { width: 320, height: 180, dpr: 1 },
  fps: 12,
  ready: 'document.readyState === "complete"',
  settle: 100,
  out: 'out',
}
`,
    )
    fs.rmSync(path.join(project, 'shots'), { recursive: true, force: true })
    fs.mkdirSync(path.join(project, 'shots'))
    shot('S1', '<p>one</p>')
    shot('S2', '<p>two</p>')
  })

  it('records every shot the config names, keeping the raw frames beside the file', () => {
    const said = run()
    assert.equal(said.status, 0, said.err + said.out)
    for (const id of ['s1', 's2']) assert.ok(fs.existsSync(path.join(project, 'out', `${id}.mp4`)), `${id}.mp4`)
    const frames = path.join(project, '.record', 'S1-source')
    assert.ok(fs.readdirSync(frames).some((f) => f.endsWith('.jpg')))
    assert.ok(fs.existsSync(path.join(frames, 'timestamps.json')))
    assert.equal(ledger().S1!.status, 'ok')
  })

  it('reports the rate it really sampled at, not the rate it encoded at', () => {
    const frames = path.join(project, '.record', 'S1-source')
    const capture = JSON.parse(fs.readFileSync(path.join(frames, 'capture.json'), 'utf8'))
    const timestamps = JSON.parse(fs.readFileSync(path.join(frames, 'timestamps.json'), 'utf8')) as number[]
    // The rate is counted off the frames that were really taken and how long the take ran.
    assert.equal(capture.frames, timestamps.length)
    assert.ok(Math.abs(capture.sampledFps - timestamps.length / capture.sampledSeconds) < 0.1, JSON.stringify(capture))
    assert.equal(capture.sampledFps, ledger().S1!.sampledFps)
    // The encode is 12 fps whatever the machine managed, so the file's own rate proves nothing.
    const encoded = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', path.join(project, 'out', 's1.mp4')], { encoding: 'utf8' }).trim().replace(/,$/, '')
    assert.equal(encoded, '12/1')
  })

  it('does the same take twice for nothing, so a resumed run only finishes what is left', () => {
    const before = fs.statSync(path.join(project, 'out', 's1.mp4')).mtimeMs
    assert.match(run().out, /S1 — already recorded, unchanged/)
    assert.equal(fs.statSync(path.join(project, 'out', 's1.mp4')).mtimeMs, before)
  })

  it('redoes a shot whose actions changed, and leaves its neighbour alone', () => {
    const untouched = fs.statSync(path.join(project, 'out', 's2.mp4')).mtimeMs
    shot('S1', '<p>one, again</p>')
    const said = run()
    assert.match(said.out, /S1 — s1\.mp4/)
    assert.match(said.out, /S2 — already recorded, unchanged/)
    assert.equal(fs.statSync(path.join(project, 'out', 's2.mp4')).mtimeMs, untouched)
  })

  it('redoes a shot whose file went missing', () => {
    fs.rmSync(path.join(project, 'out', 's2.mp4'))
    assert.match(run('S2').out, /S2 — s2\.mp4/)
    assert.ok(fs.existsSync(path.join(project, 'out', 's2.mp4')))
  })

  it('retakes on the user\'s word alone, with nothing about the shot changed', () => {
    const before = fs.statSync(path.join(project, 'out', 's1.mp4')).mtimeMs
    assert.match(run('S1', '--force').out, /S1 — s1\.mp4/)
    assert.notEqual(fs.statSync(path.join(project, 'out', 's1.mp4')).mtimeMs, before)
  })

  it('keeps the old file and says why when a take fails its checks', () => {
    const kept = fs.readFileSync(path.join(project, 'out', 's2.mp4'))
    fs.writeFileSync(
      path.join(project, 'shots', 'S2.mjs'),
      `export default {
  output: 's2.mp4',
  expect: { seconds: [30, 40], fps: 0.2 },
  async reset(ctx) { await ctx.go(${JSON.stringify(page('<p>two</p>'))}) },
  async take(ctx) { await ctx.sleep(900) },
}
`,
    )
    const said = run('S2')
    assert.equal(said.status, 1)
    assert.match(said.err, /S2 — FAILED: checks failed — duration/)
    assert.deepEqual(fs.readFileSync(path.join(project, 'out', 's2.mp4')), kept)
    assert.equal(ledger().S2!.status, 'failed')
    assert.equal(fs.readdirSync(path.join(project, '.record')).filter((f) => f.endsWith('.tmp.mp4')).length, 0)
  })

  it('stops the shot whose starting state is wrong, and records the rest of the batch', () => {
    fs.writeFileSync(
      path.join(project, 'shots', 'S2.mjs'),
      `export default {
  output: 's2.mp4',
  async reset(ctx) { await ctx.go(${JSON.stringify(page('<p>two</p>'))}) },
  async check(ctx) { await ctx.until('!!document.querySelector("#never")', 900) },
  async take(ctx) { await ctx.sleep(600) },
}
`,
    )
    const said = run('--force')
    assert.equal(said.status, 1)
    assert.match(said.err, /S2 — FAILED: check: timed out/)
    assert.match(said.out, /S1 — s1\.mp4/)
    assert.match(said.out, /1\/2 recorded, 1 failed/)
  })

  it('lands a take on the scripted timeline without flattering how fast it sampled', () => {
    // 1.4s of real take marked onto a 6s script: the file runs to the script, the frames keep
    // the times they were taken at, and the rate is still counted on those 1.4 seconds.
    fs.writeFileSync(
      path.join(project, 'shots', 'S4.mjs'),
      `export default {
  output: 's4.mp4',
  expect: { seconds: [5.5, 6.5], fps: 0.2 },
  async reset(ctx) { await ctx.go(${JSON.stringify(page('<p>four</p>'))}) },
  async take(ctx) { await ctx.sleep(700); ctx.mark(3); await ctx.sleep(700); ctx.mark(6) },
}
`,
    )
    const said = run('S4')
    assert.equal(said.status, 0, said.err + said.out)
    const seconds = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(project, 'out', 's4.mp4')], { encoding: 'utf8' }).trim())
    assert.ok(seconds > 5.5 && seconds < 6.5, `${seconds}s`)

    const frames = path.join(project, '.record', 'S4-source')
    const capture = JSON.parse(fs.readFileSync(path.join(frames, 'capture.json'), 'utf8'))
    const timestamps = JSON.parse(fs.readFileSync(path.join(frames, 'timestamps.json'), 'utf8')) as number[]
    assert.ok(capture.sampledSeconds < 3, `sampled over ${capture.sampledSeconds}s of a ${capture.duration}s file`)
    assert.ok(timestamps[timestamps.length - 1]! <= capture.sampledSeconds + 0.01, 'the timestamps are the retimed ones')
    assert.ok(Math.abs(capture.sampledFps - capture.frames / capture.sampledSeconds) < 0.1, JSON.stringify(capture))
    assert.ok(capture.sampledFps > (capture.frames / capture.duration) * 2, 'the rate was counted on the file, not on the take')

    // Nothing filmed before the first mark is piled onto the first instant and dropped.
    const kept = fs.readFileSync(path.join(frames, 'frames.ffconcat'), 'utf8').match(/^file /gm)!.length - 1
    assert.ok(kept >= capture.frames - 3, `${kept} of ${capture.frames} frames reached the file`)
  })

  it('lists what is ready, what is stale and what never ran', () => {
    fs.writeFileSync(path.join(project, 'shots', 'S3.mjs'), 'export default { async take(ctx) { await ctx.sleep(10) } }\n')
    const said = run('--list')
    assert.match(said.out, /S1 +ready/)
    assert.match(said.out, /S2 +failed/)
    assert.match(said.out, /S3 +never recorded/)
  })
})
