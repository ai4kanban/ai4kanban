import fs from 'node:fs'
import path from 'node:path'
import { CHATS_DIR, KANBAN, PLANS } from '../paths'
import { planTitle } from '../plans'
import { chatPlan, readChat, setChatPlan } from './chat'
import type { ChatTarget } from './types'

/** Explicit migration: never overwrite a different local body or guess between discussions. */
export function migratePlans(): number {
  const legacy = path.join(KANBAN, 'plans')
  const files: { from: string; rel: string; text: string }[] = []
  for (const prefix of ['', 'archive/']) {
    const dir = path.join(legacy, prefix)
    if (!fs.existsSync(dir)) continue
    for (const name of fs.readdirSync(dir)) {
      if (!/^\d+-[^/]+\.md$/.test(name)) continue
      const from = path.join(dir, name)
      if (!fs.lstatSync(from).isFile()) continue
      const rel = `${prefix}${name}`
      const text = fs.readFileSync(from, 'utf8')
      const to = path.join(PLANS, rel)
      if (fs.existsSync(to) && fs.readFileSync(to, 'utf8') !== text) {
        throw new Error(`Migration conflict: ${to}. Both copies were kept.`)
      }
      files.push({ from, rel, text })
    }
  }
  const chats = fs.existsSync(CHATS_DIR) ? fs.readdirSync(CHATS_DIR).filter(n => n.endsWith('.json')).map(n => {
    const raw = JSON.parse(fs.readFileSync(path.join(CHATS_DIR, n), 'utf8')) as { cardId: ChatTarget }
    return readChat(raw.cardId)
  }).filter(c => c !== null) : []
  for (const file of files) {
    const to = path.join(PLANS, file.rel)
    fs.mkdirSync(path.dirname(to), { recursive: true })
    if (!fs.existsSync(to)) fs.copyFileSync(file.from, to, fs.constants.COPYFILE_EXCL)
    const rel = `plans/${file.rel}`
    const linked = chats.some(c => c.plans?.some(p => p.path === rel))
    if (!linked && !file.rel.startsWith('archive/')) {
      const matches = chats.filter(c => c.messages.some(m => m.text.includes(rel)))
      if (matches.length === 1 && !chatPlan(matches[0]!)) {
        const result = setChatPlan(matches[0]!.cardId, rel, planTitle(file.text))
        if ('error' in result) throw new Error(result.error)
      }
    }
    fs.unlinkSync(file.from)
  }
  for (const dir of [path.join(legacy, 'archive'), legacy]) {
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir)
  }
  return files.length
}
