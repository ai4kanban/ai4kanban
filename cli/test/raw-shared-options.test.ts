// `--board`, `--dir` and `--json` typed before `raw` work as if typed after it (#2102).

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'

import { rawArgv, runBoard } from '../src/lib/board-cli.ts'
import { forgetMachineState } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-raw-shared-'))
const board = path.join(root, 'docs', 'kanban')
fs.mkdirSync(path.join(board, 'todo'), { recursive: true })
fs.writeFileSync(path.join(board, 'config.md'), '# Config\n')
after(() => {
  forgetMachineState(root)
  fs.rmSync(root, { recursive: true, force: true })
})

async function run(argv: string[]): Promise<{ code: number; out: string; err: string }> {
  const moved = rawArgv(argv)
  assert.ok(moved, `\`${argv.join(' ')}\` is a raw line`)
  const out: string[] = []
  const err: string[] = []
  const wasLog = console.log
  const wasError = console.error
  const wasWrite = process.stdout.write
  console.log = (line: unknown) => void out.push(String(line))
  console.error = (line: unknown) => void err.push(String(line))
  process.stdout.write = ((chunk: unknown) => (out.push(String(chunk)), true)) as typeof process.stdout.write
  try {
    return { code: await runBoard(moved, { program: 'akb raw', cwd: os.tmpdir() }), out: out.join('\n'), err: err.join('\n') }
  } finally {
    console.log = wasLog
    console.error = wasError
    process.stdout.write = wasWrite
  }
}

describe('shared options before raw', () => {
  before(async () => {
    const made = await run(['raw', 'create', '--title', 'A card', '--id', '1', '--board', board])
    assert.equal(made.code, 0, made.err)
  })

  it('runs a move with --board before raw', async () => {
    const { code, err } = await run(['--board', board, 'raw', 'update', '1', '--status', 'ready'])
    assert.equal(code, 0, err)
    const card = fs.readdirSync(path.join(board, 'todo')).find((f) => f.startsWith('1-'))!
    assert.match(fs.readFileSync(path.join(board, 'todo', card), 'utf8'), /^status: ready$/m)
  })

  it('reads --dir= and --json in any order', async () => {
    const { code, out } = await run([`--dir=${root}`, '--json', 'raw', 'validate', '1'])
    assert.equal(code, 0, out)
    assert.equal(JSON.parse(out.trim().split('\n').pop()!).ok, true)
  })

  it('prints raw help after --board', async () => {
    const { code, out } = await run(['--board', board, 'raw', 'help'])
    assert.equal(code, 0)
    assert.match(out, /create/)
  })

  it('leaves other commands to the outer tree', () => {
    assert.equal(rawArgv(['--board', board, 'card', 'implement', '1']), null)
    assert.equal(rawArgv(['--verbose', 'raw', 'help']), null)
    assert.deepEqual(rawArgv(['raw', 'help']), ['help'])
  })
})
