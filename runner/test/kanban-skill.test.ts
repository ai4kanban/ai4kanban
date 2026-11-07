import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, it } from 'node:test'

import note from '../../skill/SKILL.md'
import { prepareKanbanSkill } from '../src/kanban-skill'

let root: string
const skill = (folder = '.claude') => path.join(root, folder, 'skills/kanban')
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-skill-')) })
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }) })

it('两份技能同源且内容不变时不改写', () => {
  prepareKanbanSkill(root)
  for (const folder of ['.claude', '.agents']) {
    const file = path.join(skill(folder), 'SKILL.md')
    assert.equal(fs.readFileSync(file, 'utf8'), `${note.trimEnd()}\n\n<!-- ai4kanban managed -->\n`)
    const stamp = fs.statSync(file).mtimeMs
    prepareKanbanSkill(root)
    assert.equal(fs.statSync(file).mtimeMs, stamp)
  }
})

it('只刷新带产品标记的正文，保留旧配置与其他文件', () => {
  fs.mkdirSync(skill(), { recursive: true })
  fs.writeFileSync(path.join(skill(), 'SKILL.md'), '<!-- ai4kanban 0.1.0 -->\n旧技能')
  fs.writeFileSync(path.join(skill(), 'config.md'), '用户配置')
  prepareKanbanSkill(root)
  assert.match(fs.readFileSync(path.join(skill(), 'SKILL.md'), 'utf8'), /name: kanban/)
  assert.equal(fs.readFileSync(path.join(skill(), 'config.md'), 'utf8'), '用户配置')
})

it('用户自有技能可直接使用，缺少正文时明确报错', () => {
  fs.mkdirSync(skill(), { recursive: true })
  assert.throws(() => prepareKanbanSkill(root), /无法准备.*缺少可读/)
  fs.writeFileSync(path.join(skill(), 'SKILL.md'), '用户技能')
  prepareKanbanSkill(root)
  assert.equal(fs.readFileSync(path.join(skill(), 'SKILL.md'), 'utf8'), '用户技能')
})

it('不覆盖目录、正文或父目录上的符号链接', () => {
  for (const kind of ['folder', 'file', 'parent']) {
    const target = path.join(root, kind)
    fs.mkdirSync(target)
    fs.writeFileSync(path.join(target, 'SKILL.md'), '<!-- ai4kanban 0.1.0 -->\n用户链接')
    if (kind === 'folder') {
      fs.mkdirSync(path.dirname(skill()), { recursive: true })
      fs.symlinkSync(target, skill())
    } else if (kind === 'file') {
      fs.mkdirSync(skill(), { recursive: true })
      fs.symlinkSync(path.join(target, 'SKILL.md'), path.join(skill(), 'SKILL.md'))
    } else {
      fs.mkdirSync(path.join(target, 'skills/kanban'), { recursive: true })
      fs.writeFileSync(path.join(target, 'skills/kanban/SKILL.md'), '用户链接')
      fs.symlinkSync(target, path.join(root, '.claude'))
    }
    prepareKanbanSkill(root)
    assert.equal(fs.readFileSync(path.join(target, 'SKILL.md'), 'utf8'), '<!-- ai4kanban 0.1.0 -->\n用户链接')
    fs.rmSync(path.join(root, '.claude'), { recursive: true, force: true })
  }
})

it('写入路径不可用时拒绝启动', () => {
  fs.writeFileSync(path.join(root, '.claude'), '不是目录')
  assert.throws(() => prepareKanbanSkill(root), /无法准备/)
})

it('两种插件发行目录保留 discuss-goal 并携带同源 kanban 技能', () => {
  for (const host of ['claude-code', 'codex']) {
    const skills = path.resolve(process.env.RUNNER_DIST!, '../../plugins', host, 'skills')
    assert.equal(fs.readFileSync(path.join(skills, 'kanban/SKILL.md'), 'utf8'), note)
    assert.equal(fs.readFileSync(path.join(skills, 'discuss-goal/SKILL.md'), 'utf8').split('---\n').slice(2).join('---\n').trim(), fs.readFileSync(path.resolve(process.env.RUNNER_DIST!, '../../cli/src/guide/discuss-goal.md'), 'utf8').trim())
    assert.deepEqual(fs.readdirSync(path.join(skills, 'kanban')), ['SKILL.md'])
  }
})
