import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { withCreationLock } from './creation-lock'
import type { NewTask } from '../cloud/tasks'
import { BoardError } from '../io'
import { KANBAN, REPO_ROOT } from '../paths'
import { projectStateDir } from '../machine/project'
import { readLanguage } from '../machine/settings'
import { archiveInboxItem, readArchived, readAllDismissed, readInbox } from '../signals/inbox'

export function creationError(error: string, triage?: string): string {
  const zh = readLanguage() === 'zh'
  const messages: Record<string, [string, string]> = {
    'The run ended without creating a card.': ['No cards were created.', '未创建卡片。'],
    'Cannot access this task. Check your account and task access in WildCrane, then try again.': ['Cannot access this task. Check your account and task access in WildCrane, then try again.', '无法访问此任务。请在 WildCrane 中确认账号和任务权限后重试。'],
    'This task does not exist. Start a new task from the WildCrane web app.': ['This task does not exist. Start a new task from the WildCrane web app.', '此任务不存在。请从 WildCrane 网页发起新任务。'],
    'Card creation failed.': ['Card creation failed.', '创建卡片失败。'],
    'This machine is not signed in to Cloud.': ['Not signed in to WildCrane. Sign in to WildCrane, then try again.', '未登录 WildCrane。请先在 WildCrane 登录后重试。'],
    'Cloud sign-in has expired. Sign in again.': ['Your WildCrane sign-in has expired. Sign in again, then try again.', 'WildCrane 登录已过期。请重新登录后重试。'],
    'This board is not linked to a Cloud project.': ['This folder is not linked to a WildCrane project. Link it to a project, then try again.', '当前目录尚未关联 WildCrane 项目。请关联项目后重试。'],
    'The project link is invalid or names multiple projects.': ['The project link is invalid or conflicting. Check this folder’s project link, then try again.', '项目关联无效或存在冲突。请检查当前目录的项目关联后重试。'],
    'The source task conflicts with this board’s project link.': ['The project link is invalid or conflicting. Check this folder’s project link, then try again.', '项目关联无效或存在冲突。请检查当前目录的项目关联后重试。'],
    'This build of WildCrane carries no Cloud project to sign in against.': ['WildCrane is not configured here. Complete the connection setup, then try again.', '此处尚未配置 WildCrane 连接。请完成连接配置后重试。'],
  }
  const unreachable = error.startsWith('Cloud could not be reached:')
  if (unreachable) error = triage
    ? (zh ? '无法连接 Cloud。' : 'Cloud could not be reached.')
    : (zh ? '无法连接 WildCrane。请检查网络后重试。' : 'Could not reach WildCrane. Check your connection and try again.')
  else error = messages[error]?.[zh ? 1 : 0] ?? error
  if (!triage || error.includes(`Original item remains in triage: ${triage}.`) || error.includes(`原条目仍在 triage：${triage}。`)) return error
  return `${error}\n\n${zh
    ? `原条目仍在 triage：${triage}。${unreachable ? '连接恢复后可重试。' : '解决原因后可重试。'}`
    : `Original item remains in triage: ${triage}. ${unreachable ? 'Retry when connected.' : 'Fix the cause and retry.'}`}`
}

/** 固定请求内容和幂等键，Cloud 返回后先记账，再落卡。 */
export function creationReceipt(request: string, slot: string): string {
  const hash = crypto.createHash('sha256').update(`${request}\n${slot}`).digest('hex')
  return path.join(projectStateDir(KANBAN, REPO_ROOT), 'creations', `${hash}.json`)
}

export type CreationJournal = { said: NewTask; made?: { task: { id: string; key: string; project: string }; number: number } }

export function readCreation(file: string, said: NewTask): CreationJournal {
  return withCreationLock(() => {
    try {
      const held = JSON.parse(fs.readFileSync(file, 'utf8')) as CreationJournal
      if (!held.said || typeof held.said.title !== 'string') throw new Error('Invalid creation journal')
      return held
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      const held = { said }
      saveCreation(file, held)
      return held
    }
  })
}

export function saveCreation(file: string, journal: CreationJournal): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temp = `${file}.${crypto.randomUUID()}.tmp`
  fs.writeFileSync(temp, JSON.stringify(journal))
  fs.renameSync(temp, file)
}

export function archiveCreation(source: string, id: number): void {
  if (readArchived().some((s) => s.sourceId === source && s.cardId === id)) return
  try {
    const archived = archiveInboxItem(source, id)
    if (!archived.ok) throw new Error(archived.error)
  } catch (error) {
    throw new BoardError(creationError(error instanceof Error ? error.message : String(error), source), { kind: 'refused' })
  }
}

export function triageFile(sourceId: string): string {
  const found = [...readInbox(), ...readAllDismissed(), ...readArchived()].find((s) => s.sourceId === sourceId.trim())
  if (!found) throw new BoardError(`nothing in triage is ${sourceId}`, { kind: 'refused' })
  return path.basename(found.relPath, '.md')
}
