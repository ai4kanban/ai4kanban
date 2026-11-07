// 卡片预览引用的文件：与 Runner 上传共用 SDK 的依赖收集，在会话结束前报出缺失、越界和不符合声明的内容。

import fs from 'node:fs'
import path from 'node:path'

import { collect } from '../../../artifact-sdk/src/internal/collect'
import { referenceText } from './dress-page'
import { ASSETS, KANBAN, MOCKUPS, rel } from './paths'
import type { ContractError } from './spec-contract'

/** A path the card or one of its files names, as the Runner will look it up for upload. */
function resolver(card: string, id: number) {
  const roots = [KANBAN, path.join(ASSETS, String(id)), path.join(MOCKUPS, String(id))]
  const real = (p: string) => (fs.existsSync(p) ? fs.realpathSync(p) : p)
  const inside = (p: string) => roots.some((root) => p.startsWith(real(root) + path.sep))
  return (src: string, owner: string) => {
    if (/^[a-z][\w+.-]*:/i.test(src) || src.startsWith('#') || src.startsWith('//')) return null
    if (path.isAbsolute(src)) throw new Error('an absolute path; name it relative to the file')
    const held = /^\.(assets|mockups)\//.exec(src)
    const file = held ? path.resolve(held[1] === 'assets' ? ASSETS : MOCKUPS, src.slice(held[0].length)) : path.resolve(path.dirname(owner), src)
    if (!inside(path.resolve(file)) || (fs.existsSync(file) && !inside(fs.realpathSync(file)))) throw new Error(`outside this card's files (${rel(KANBAN)}, .assets/${id}/)`)
    if (!fs.statSync(file, { throwIfNoEntry: false })?.isFile()) throw new Error('no such file')
    return { key: fs.realpathSync(file), file }
  }
}

/** Every file the card's previews reach is there, inside the card's files, and holds what its
 *  type declares. The tags' own paths are the tag rules' to check. */
export function validatePreviewFiles(card: string, id: number, text: string): ContractError[] {
  const resolve = resolver(card, id)
  const errors: ContractError[] = []
  const graph = collect(text, card, {
    resolve: (src, owner) => {
      if (owner !== card) return resolve(src, owner)
      try { return resolve(src, owner) } catch { return null }
    },
    read: referenceText,
    retained: () => [],
  })
  for (const node of graph) {
    for (const p of node.problems) {
      errors.push({ file: rel(node.file ?? card), line: p.line ?? 1, rule: 'preview-file', message: `${p.at ? `${p.at}: ` : ''}${p.src}: ${p.message}. Fix the reference or add the file.` })
    }
  }
  return errors
}
