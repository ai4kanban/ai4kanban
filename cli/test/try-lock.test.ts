import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, it, mock } from 'node:test'

import { tryLock } from '../src/lib/lock.ts'

let root: string
let dir: string

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-try-lock-'))
  dir = path.join(root, 'landing')
})

afterEach(() => {
  mock.restoreAll()
  fs.rmSync(root, { recursive: true, force: true })
})

function abandoned(): string {
  const child = spawnSync(process.execPath, ['-e', ''])
  assert.equal(child.status, 0)
  const token = `${child.pid}-${randomUUID()}`
  fs.mkdirSync(dir)
  fs.writeFileSync(path.join(dir, token), '')
  return token
}

it('recovers a dead owner without leaving a recovery marker', () => {
  abandoned()
  const release = tryLock(dir)
  assert.ok(release)
  assert.equal(tryLock(dir), undefined)
  release()
  assert.deepEqual(fs.readdirSync(root), [])
})

it('does not delete a replacement acquired after the stale-owner check', () => {
  const old = abandoned()
  const replacement = `${process.pid}-${randomUUID()}`
  const unlink = fs.unlinkSync
  mock.method(fs, 'unlinkSync', (file: fs.PathLike) => {
    if (file === path.join(dir, old)) {
      // Another contender recovers and acquires between our read and cleanup.
      fs.rmSync(dir, { recursive: true })
      fs.mkdirSync(dir)
      fs.writeFileSync(path.join(dir, replacement), '')
    }
    return unlink(file)
  })
  assert.equal(tryLock(dir), undefined)
  assert.deepEqual(fs.readdirSync(dir), [replacement])
})

it('recovers when cleanup dies after removing the owner token', () => {
  const token = abandoned()
  fs.unlinkSync(path.join(dir, token))
  const release = tryLock(dir)
  assert.ok(release)
  release()
  assert.deepEqual(fs.readdirSync(root), [])
})

it('cannot release a newer claim from the same process', () => {
  const first = tryLock(dir)!
  first()
  const second = tryLock(dir)!
  first()
  assert.equal(tryLock(dir), undefined)
  second()
})

it('publishes only after initialization, so a competing claim stays protected', () => {
  const write = fs.writeFileSync
  let competing: (() => void) | undefined
  let entered = false
  mock.method(fs, 'writeFileSync', (...args: Parameters<typeof fs.writeFileSync>) => {
    if (!entered) {
      entered = true
      competing = tryLock(dir)
    }
    return write(...args)
  })
  assert.equal(tryLock(dir), undefined)
  assert.ok(competing)
  competing()
})
