// A bare `akb` or `akb raw` prints its help and succeeds, like `--help` (#1491).

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'

import { runAgent } from '../src/lib/agent-cli.ts'
import { runBoard } from '../src/lib/board-cli.ts'

const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-bare-help-'))
after(() => fs.rmSync(cwd, { recursive: true, force: true }))

async function captured(work: () => Promise<number>): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = []
  const err: string[] = []
  const wasLog = console.log
  const wasError = console.error
  console.log = (line: unknown) => void out.push(String(line))
  console.error = (line: unknown) => void err.push(String(line))
  try {
    return { code: await work(), out: out.join('\n'), err: err.join('\n') }
  } finally {
    console.log = wasLog
    console.error = wasError
  }
}

describe('a command with no subcommand', () => {
  it('bare akb prints its help and exits 0', async () => {
    const { code, out, err } = await captured(() => runAgent([], { program: 'akb', cwd }))
    assert.equal(code, 0)
    assert.match(out, /Usage:/)
    assert.match(out, /Commands:/)
    assert.equal(err, '')
  })

  it('bare akb raw prints its help and exits 0', async () => {
    const { code, out, err } = await captured(() => runBoard([], { program: 'akb raw', cwd }))
    assert.equal(code, 0)
    assert.match(out, /Usage:/)
    assert.match(out, /create/)
    assert.equal(err, '')
  })

  it('an unknown command still refuses', async () => {
    const { code, err } = await captured(() => runAgent(['nosuch'], { program: 'akb', cwd }))
    assert.notEqual(code, 0)
    assert.match(err, /unknown command/)
  })
})
