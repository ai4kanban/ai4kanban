import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, it } from 'node:test'

import { readPlan } from '../src/lib/plans.ts'
import { PLANS, setBoardRoot } from '../src/lib/paths.ts'

let root = ''
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-plan-'))
  fs.mkdirSync(path.join(root, 'docs', 'kanban'), { recursive: true })
  setBoardRoot(root)
  fs.mkdirSync(PLANS, { recursive: true })
})
afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

it('follows a plan renamed under the same id', () => {
  fs.writeFileSync(path.join(PLANS, '465-new-name.md'), '# New\n')
  fs.writeFileSync(path.join(PLANS, '466-other.md'), '# Other\n')
  const got = readPlan('plans/465-old-name.md')
  assert.equal(got?.path, 'plans/465-new-name.md')
  assert.equal(got?.text, '# New\n')
})

it('keeps the path when nothing with that id exists yet', () => {
  const got = readPlan('plans/465-old-name.md')
  assert.deepEqual(got, { path: 'plans/465-old-name.md', text: '', lines: 0 })
})
