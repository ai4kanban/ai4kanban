// Finding the `akb` on PATH (#1986): it is asked `--version`, since `akb version` exits 1.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, it } from 'node:test'

import { readCommandState } from '../src/lib/skill/install.ts'
import { SKILL_VERSION } from '../src/version.ts'

const PATH = process.env.PATH

function fakeAkb(version: string): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-path-'))
  const bin = path.join(dir, 'akb')
  fs.writeFileSync(bin, `#!/bin/sh\n[ "$1" = "--version" ] || exit 1\necho ${version}\n`, { mode: 0o755 })
  process.env.PATH = `${dir}${path.delimiter}${PATH}`
}

describe('the akb on PATH', { skip: process.platform === 'win32' }, () => {
  afterEach(() => {
    process.env.PATH = PATH
  })

  it('reads the current version as up to date', () => {
    fakeAkb(SKILL_VERSION)
    const state = readCommandState()
    assert.equal(state.onPath, SKILL_VERSION)
    assert.equal(state.behind, false)
  })

  it('reads an older version as behind, not missing', () => {
    fakeAkb('0.8.0')
    const state = readCommandState()
    assert.equal(state.onPath, '0.8.0')
    assert.equal(state.behind, true)
  })
})
