// What an OpenCode run reports back. The stream gives the tokens, the cost and the session
// id; the model comes from `opencode export` afterwards, which is the part worth pinning —
// one spawn, only once the stream has ended, and a blank whenever the answer doesn't come.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'

import { createOpencodeStreamRenderer } from '../src/lib/agent/wire/opencode-stream.ts'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-opencode-'))

after(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

const SESSION = 'ses_f88767927ffetGmIMELlwYntke'

// What `opencode export` prints: the session as JSON on stdout, cut down to the one field
// the board reads.
const EXPORT = JSON.stringify({
  info: { id: SESSION, model: { id: 'glm-5.3', providerID: 'zai-coding-plan', variant: 'default' } },
  messages: [],
})

/** A stand-in for the CLI, in a folder of its own, that writes down every call it gets. */
function stub(body: string, name = 'opencode'): string {
  const home = fs.mkdtempSync(path.join(tmp, 'bin-'))
  const bin = path.join(home, name)
  fs.writeFileSync(bin, `#!/bin/sh\necho "$@" >> "${path.join(home, 'calls')}"\n${body}\n`)
  fs.chmodSync(bin, 0o755)
  return bin
}

function calls(bin: string): string[] {
  let raw = ''
  try {
    raw = fs.readFileSync(path.join(path.dirname(bin), 'calls'), 'utf8').trim()
  } catch {
    // Never run, so never written.
  }
  return raw ? raw.split('\n') : []
}

const printsExport = `cat <<'JSON'\n${EXPORT}\nJSON`

// A short run: one thing said, then the step that closes it.
const STREAM = [
  JSON.stringify({ type: 'step_start', sessionID: SESSION, part: {} }),
  JSON.stringify({ type: 'text', sessionID: SESSION, part: { text: 'pong' } }),
  JSON.stringify({
    type: 'step_finish',
    sessionID: SESSION,
    part: { cost: 0.0123, tokens: { input: 11440, output: 1, cache: { read: 8, write: 2 } } },
  }),
].join('\n')

function run(binary?: string) {
  const renderer = createOpencodeStreamRenderer(tmp, binary)
  renderer.push(STREAM)
  renderer.flush()
  return renderer
}

describe('an opencode run', () => {
  it('names the model the session ran on', () => {
    const bin = stub(printsExport)
    assert.equal(run(bin).model?.(), 'zai-coding-plan/glm-5.3')
    assert.deepEqual(calls(bin), [`export ${SESSION}`])
  })

  it('reports its tokens, its cost and the session to resume by', () => {
    const renderer = run()
    assert.equal(renderer.result(), 'pong')
    assert.equal(renderer.resumeId?.(), SESSION)
    assert.equal(renderer.costUsd?.(), 0.0123)
    assert.deepEqual(renderer.usage?.(), { input: 11440, cacheCreation: 2, cacheRead: 8, output: 1 })
  })

  it('asks the CLI once, however often the runner asks', () => {
    const bin = stub(printsExport)
    const renderer = run(bin)
    renderer.model?.()
    renderer.model?.()
    assert.equal(calls(bin).length, 1)
  })

  it('asks nothing while the stream is still running', () => {
    const bin = stub(printsExport)
    const renderer = createOpencodeStreamRenderer(tmp, bin)
    renderer.push(STREAM)
    assert.equal(renderer.model?.(), undefined)
    assert.deepEqual(calls(bin), [])
  })

  it('shows a blank when the export fails', () => {
    const bin = stub('echo "Error: Session not found" >&2\nexit 1')
    assert.equal(run(bin).model?.(), undefined)
  })

  it('leaves a command line whose binary is not an opencode alone', () => {
    const bin = stub(printsExport, 'npx')
    assert.equal(run(bin).model?.(), undefined)
    assert.deepEqual(calls(bin), [])
  })
})
