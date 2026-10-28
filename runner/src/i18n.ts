// The few lines the Runner prints, in Chinese or English after the system language.

import type { Holder } from './lock'

const ZH_HOLDER: Record<Holder, string> = { 'claude-code': 'Claude Code', codex: 'Codex', terminal: '本机终端', desktop: 'WildCrane 桌面端' }
const EN_HOLDER: Record<Holder, string> = { 'claude-code': 'Claude Code', codex: 'Codex', terminal: 'the terminal', desktop: 'the WildCrane desktop app' }

const ZH = {
  signIn: (url: string) => `请在浏览器中登录 WildCrane：\n${url}`,
  signedIn: () => '已登录',
  signInFailed: (why: string) => `登录未完成：${why}`,
  connected: (machine: string) => `已连接（${machine}），等待任务`,
  running: (count: number) => `正在运行 ${count} 个任务`,
  reconnecting: () => '已断开，正在重连…',
  elsewhere: (machine: string) => `你的 Runner 已在「${machine}」上连接。请先在那台电脑上退出，再在这里启动。`,
  outdated: () => '此版本已过旧，请重启以更新。',
  refused: (why: string) => `WildCrane 拒绝了连接：${why}`,
  updated: (version: string) => `已更新到 ${version}`,
  rolledBack: (version: string) => `新版本未能启动，已退回 ${version}`,
  nodeTooOld: (range: string) => `新版本需要 Node ${range}，请升级 Node。本次继续使用当前版本。`,
  waitingHere: (holder?: Holder) => {
    const who = holder ? ZH_HOLDER[holder] : '本机另一个程序'
    return `${who}已在运行一个 WildCrane 实例，负责接收所有运行任务。当前实例已暂停，${who}关闭后将由当前实例接替。`
  },
  stopped: () => '已停止',
  reviewTitle: () => '待你审核',
  reviewBody: (task: string) => `「${task}」待审核`,
  doneTitle: () => '任务已完成',
  failedTitle: () => '任务失败',
  commentTitle: (task: string) => `「${task}」有新评论`,
  commentBody: (who: string, text: string) => `${who}：${text}`,
}

export type Lines = typeof ZH

const EN: Lines = {
  signIn: (url) => `Sign in to WildCrane in your browser:\n${url}`,
  signedIn: () => 'Signed in',
  signInFailed: (why) => `Sign-in did not finish: ${why}`,
  connected: (machine) => `Connected (${machine}) — waiting for tasks`,
  running: (count) => `Running ${count} ${count === 1 ? 'task' : 'tasks'}`,
  reconnecting: () => 'Disconnected — reconnecting…',
  elsewhere: (machine) => `Your Runner is already connected on "${machine}". Quit it there first, then start it here.`,
  outdated: () => 'This version is out of date. Restart to update.',
  refused: (why) => `WildCrane refused the connection: ${why}`,
  updated: (version) => `Updated to ${version}`,
  rolledBack: (version) => `The new version did not start — back on ${version}`,
  nodeTooOld: (range) => `The new version needs Node ${range}. Update Node; running the current version for now.`,
  waitingHere: (holder) => {
    const who = holder ? EN_HOLDER[holder] : 'another app on this computer'
    return `${who[0]!.toUpperCase()}${who.slice(1)} is already running a WildCrane instance that takes all run tasks. This instance is paused and takes over when ${who} closes.`
  },
  stopped: () => 'Stopped',
  reviewTitle: () => 'Needs your review',
  reviewBody: (task) => `"${task}" is ready for review`,
  doneTitle: () => 'Task finished',
  failedTitle: () => 'Task failed',
  commentTitle: (task) => `New comment on ${task}`,
  commentBody: (who, text) => `${who}: ${text}`,
}

export function isChinese(env: NodeJS.ProcessEnv = process.env): boolean {
  const lang = env.LC_ALL || env.LC_MESSAGES || env.LANG || Intl.DateTimeFormat().resolvedOptions().locale
  return /^zh/i.test(lang ?? '')
}

export const linesFor = (chinese: boolean): Lines => (chinese ? ZH : EN)

export const t: Lines = linesFor(isChinese())

let last = ''

/** Print a status line, once per change. */
export function status(line: string): void {
  if (line === last) return
  last = line
  process.stdout.write(`${line}\n`)
}
