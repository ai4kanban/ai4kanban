import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeEach, describe, it } from 'node:test'

import { allow, allowedProjects, keepOnly, refusal, type Where } from '../src/folders'
import { runnerHome, useRunnerHome } from '../src/home'

const mac = (home = '/Users/lin'): Where => ({ platform: 'darwin', home, resolve: (p) => p })
const win = (home = 'C:\\Users\\lin'): Where => ({ platform: 'win32', home, resolve: (p) => p })

describe('a folder picked as a project', () => {
  it('is one folder of the user’s', () => {
    assert.equal(refusal('/Users/lin/code/site', mac()), null)
    assert.equal(refusal('/Volumes/Work/site', mac()), null)
    assert.equal(refusal('D:\\work\\site', win()), null)
    assert.equal(refusal('C:\\Users\\lin\\site', win()), null)
  })

  it('is not the home folder, or one holding it', () => {
    assert.equal(refusal('/Users/lin', mac()), 'home')
    assert.equal(refusal('/Users/lin/', mac()), 'home')
    assert.equal(refusal('/Users', mac()), 'home')
    assert.equal(refusal('c:\\users\\LIN', win()), 'home')
    assert.equal(refusal('C:\\Users', win()), 'home')
  })

  it('is not a whole disk', () => {
    assert.equal(refusal('/', mac()), 'disk')
    assert.equal(refusal('/Volumes/Work', mac()), 'disk')
    assert.equal(refusal('D:\\', win()), 'disk')
    assert.equal(refusal('\\\\server\\share', win()), 'disk')
  })

  it('is not the system’s, or the Runner’s own', () => {
    assert.equal(refusal('/System/Library', mac()), 'system')
    assert.equal(refusal('/Applications', mac()), 'system')
    assert.equal(refusal('/usr/local/src', mac()), 'system')
    assert.equal(refusal('C:\\Windows\\System32', win()), 'system')
    assert.equal(refusal('C:\\Program Files\\x', win()), 'system')
    assert.equal(refusal(path.join(runnerHome(), 'work'), mac()), 'system')
  })

  it('is refused when it is not there', () => {
    assert.equal(refusal('/Users/lin/gone', { ...mac(), resolve: () => null }), 'missing')
  })
})

describe('the allow list', () => {
  beforeEach(() => {
    useRunnerHome()
    fs.rmSync(runnerHome(), { recursive: true, force: true })
  })

  it('only ever loses a folder to Cloud', () => {
    const a = fs.mkdtempSync(path.join(os.tmpdir(), 'a-'))
    const b = fs.mkdtempSync(path.join(os.tmpdir(), 'b-'))
    allow(a)
    allow(b)
    keepOnly([a, '/somewhere/else'])
    assert.deepEqual(allowedProjects(), [fs.realpathSync(a)])
  })
})

