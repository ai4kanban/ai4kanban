import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { it } from 'node:test'
import { installCommitHook } from '../src/lib/skill/hook.ts'

it('removes only the retired managed guard and preserves user hooks', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-hook-'))
  try {
    execFileSync('git', ['init', '-q', dir])
    const hook = path.join(dir, '.git/hooks/pre-commit')
    fs.writeFileSync(hook, '#!/bin/sh\n# ai4kanban commit guard old\nexit 1\n')
    installCommitHook(dir)
    assert.equal(fs.existsSync(hook), false)
    fs.writeFileSync(hook, '#!/bin/sh\necho user\n')
    installCommitHook(dir)
    assert.match(fs.readFileSync(hook, 'utf8'), /echo user/)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
