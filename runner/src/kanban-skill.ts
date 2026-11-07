import fs from 'node:fs'
import path from 'node:path'

import note from '../../skill/SKILL.md'
import { SKILL_FOLDERS } from './task-folder'

const CONTENT = `${note.trimEnd()}\n\n<!-- ai4kanban managed -->\n`
const MANAGED = /^<!-- ai4kanban \S+ -->$/m

/** 只刷新受管理正文；旧配置及其他文件留在原处。 */
export function prepareKanbanSkill(root: string): void {
  for (const folder of SKILL_FOLDERS) {
    const dir = path.join(root, folder)
    const file = path.join(dir, 'SKILL.md')
    try {
      let linked = false
      let at = root
      for (const name of `${folder}/SKILL.md`.split('/')) {
        at = path.join(at, name)
        if (fs.lstatSync(at, { throwIfNoEntry: false })?.isSymbolicLink()) linked = true
      }
      const held = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
      const exists = fs.lstatSync(dir, { throwIfNoEntry: false }) !== undefined
      if (linked || (exists && !MANAGED.test(held ?? ''))) {
        if (!held?.trim()) throw new Error('用户自有目录或符号链接中缺少可读的 SKILL.md')
        continue
      }
      if (held !== CONTENT) {
        fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(file, CONTENT)
      }
    } catch (e) {
      throw new Error(`无法准备 ${folder}：${e instanceof Error ? e.message : String(e)}`)
    }
  }
}
