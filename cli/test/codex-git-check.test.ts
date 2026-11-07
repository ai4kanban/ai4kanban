// Codex refuses to start outside a git repo unless told to skip the check (#911).

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'

import { harnessByName } from '../src/lib/agent/harnesses/index.ts'

const CODEX = harnessByName('codex')!
const SKIP = '--skip-git-repo-check'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-codex-git-'))
const plain = fs.mkdirSync(path.join(root, 'plain'), { recursive: true })!
const repo = fs.mkdirSync(path.join(root, 'repo'), { recursive: true })!
spawnSync('git', ['init', '-q'], { cwd: repo })

after(() => fs.rmSync(root, { recursive: true, force: true }))

describe('codex outside a git repo', () => {
  it('skips the git check in a plain folder, on a run and a resume', () => {
    assert.ok(CODEX.extraArgs(['codex', 'exec'], 's', plain).includes(SKIP))
    assert.ok(CODEX.resumeArgs(['codex', 'exec'], 't', plain).includes(SKIP))
  })

  it('leaves it out inside a git repo', () => {
    assert.ok(!CODEX.extraArgs(['codex', 'exec'], 's', repo).includes(SKIP))
    assert.ok(!CODEX.resumeArgs(['codex', 'exec'], 't', repo).includes(SKIP))
  })

  it('never repeats one the command already names', () => {
    assert.ok(!CODEX.extraArgs(['codex', 'exec', SKIP], 's', plain).includes(SKIP))
  })
})
