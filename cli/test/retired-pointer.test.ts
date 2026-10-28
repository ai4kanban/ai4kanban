// A checkout still carrying `.ai4kanban.json` opens its local board and says the pointer
// does nothing now (#2046).

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'

import { runBoard } from '../src/lib/board-cli.ts'

const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'akb-retired-pointer-')))
after(() => fs.rmSync(root, { recursive: true, force: true }))

async function listed(): Promise<{ code: number; answer: Record<string, unknown> }> {
  const out: string[] = []
  const write = process.stdout.write.bind(process.stdout)
  process.stdout.write = ((chunk: string) => (out.push(String(chunk)), true)) as typeof process.stdout.write
  try {
    const code = await runBoard(['list', '--json'], { program: 'akb raw', cwd: root })
    return { code, answer: JSON.parse(out.join('')) }
  } finally {
    process.stdout.write = write
  }
}

describe('a checkout with a retired Cloud pointer', () => {
  it('opens docs/kanban/ and warns once', async () => {
    fs.mkdirSync(path.join(root, '.git'))
    fs.mkdirSync(path.join(root, 'docs', 'kanban', 'todo'), { recursive: true })
    fs.writeFileSync(path.join(root, 'docs', 'kanban', 'config.md'), '# Configuration\n')
    fs.writeFileSync(path.join(root, '.ai4kanban.json'), `${JSON.stringify({ version: 1, workspace: 'w-1' })}\n`)

    const { code, answer } = await listed()

    assert.equal(code, 0)
    assert.equal(answer.board, path.join(root, 'docs', 'kanban'))
    const warnings = (answer.warnings ?? []) as string[]
    assert.equal(warnings.filter((w) => w.includes('.ai4kanban.json')).length, 1)
  })
})
