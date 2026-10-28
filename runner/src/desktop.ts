// The Runner inside the desktop app (#2005). The app's shell (runner/desktop/) draws the
// windows, the menu bar and the notifications; this side signs in and talks to Cloud. They
// speak one JSON object per line: events out on stdout, commands in on stdin. Any other line
// on stdout is a log line.

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

import { cloudEndpoints } from '../../cli/src/lib/cloud/config'
import { clearSession, readSession } from '../../cli/src/lib/cloud/session'
import * as api from './api'
import { clearAkb } from './cache'
import { startRunner, type Runner, type Stop } from './connect'
import { allow, disallow, keepOnly, refusal } from './folders'
import { machineId, machineName } from './home'
import { isChinese, t, type Lines } from './i18n'
import type { Holder } from './lock'
import { EXIT_OUTDATED, VERSION } from './protocol'
import { detectRuntimes } from './runtimes'
import { signIn } from './signin'

/** Raised when an event or a command changes meaning. The shell checks it on `hello`. */
export const DESKTOP_PROTOCOL = 1

const POLL_MS = 60_000
const RETRY_MS = 60_000

export const WEB_URL = () => (process.env.WILDCRANE_WEB_URL || 'https://app.wildcrane.ai').replace(/\/+$/, '')

export const taskUrl = (task: string) => `${WEB_URL()}/tasks/${encodeURIComponent(task)}`

export type Command =
  | { cmd: 'signIn' }
  | { cmd: 'cancelSignIn' }
  | { cmd: 'signOut' }
  /** Whether notifications show here: the app's switch, and the system's permission. */
  | { cmd: 'notify'; on: boolean }
  | { cmd: 'refresh' }
  | { cmd: 'read'; alert: string }
  /** With `project`, that existing project placed in the folder (#2022). */
  | { cmd: 'addFolder'; path: string; project?: string }
  | { cmd: 'removeFolder'; project: string }
  | { cmd: 'folderNotify'; project: string; on: boolean }
  /** Read the plan again — settings was opened. */
  | { cmd: 'plan' }
  /** Pro starts with its trial when one is due; anything else opens Creem's checkout. */
  | { cmd: 'checkout'; item: 'pro' | 'storage' }
  | { cmd: 'quit' }

export function emit(event: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(event)}\n`)
}

const COMMENT_CHARS = 100

/** What a notification says, in the system's language. */
export function notice(alert: api.Alert, lines: Lines = t): { title: string; body: string } {
  if (alert.kind === 'review') return { title: lines.reviewTitle(), body: lines.reviewBody(alert.task_title) }
  if (alert.kind === 'comment') {
    const chars = Array.from((alert.comment?.body ?? '').replace(/\s+/g, ' ').trim())
    const text = chars.length > COMMENT_CHARS ? `${chars.slice(0, COMMENT_CHARS).join('')}…` : chars.join('')
    const who = alert.comment?.author.handle || alert.comment?.author.email || ''
    return { title: lines.commentTitle(alert.task_title), body: lines.commentBody(who, text) }
  }
  return { title: alert.kind === 'done' ? lines.doneTitle() : lines.failedTitle(), body: alert.task_title }
}

/** An app opened from the Finder gets the system's bare PATH, which holds neither Codex nor
 *  Claude Code; the user's login shell knows where they are. */
function loginPath(): void {
  if (process.platform !== 'darwin') return
  const shell = process.env.SHELL || '/bin/zsh'
  const got = spawnSync(shell, ['-ilc', 'printf "\\n%s" "$PATH"'], { encoding: 'utf8', timeout: 5_000 })
  const found = got.status === 0 ? got.stdout.split('\n').pop()?.trim() : ''
  if (found) process.env.PATH = [...new Set([...found.split(':'), ...(process.env.PATH ?? '').split(':')])].filter(Boolean).join(':')
}

export async function runDesktop(tell: (message: unknown) => void): Promise<number> {
  loginPath()
  const id = machineId()
  emit({ type: 'hello', protocol: DESKTOP_PROTOCOL, version: VERSION, lang: isChinese() ? 'zh' : 'en', web: WEB_URL() })

  let runner: Runner | null = null
  let signing: AbortController | null = null
  let notify = false
  let folders: api.Folder[] = []
  let lastInbox = ''
  let inboxTimer: ReturnType<typeof setTimeout> | null = null
  let poller: ReturnType<typeof setInterval> | null = null
  const shown = new Set<string>()
  /** What the session loop does next: go round again (signed in or out), quit, or stop. */
  let wake: (why: 'again' | 'quit' | Stop) => void = () => {}

  const readInbox = () => {
    if (inboxTimer) clearTimeout(inboxTimer)
    inboxTimer = setTimeout(async () => {
      const inbox = await api.readInbox()
      if (!inbox.ok) return
      const items = (list: api.InboxItem[]) => list.map((i) => ({ ...i, url: taskUrl(i.task) }))
      const next = JSON.stringify({ type: 'inbox', review: items(inbox.value.review), running: items(inbox.value.running) })
      if (next === lastInbox) return
      lastInbox = next
      process.stdout.write(`${next}\n`)
    }, 200)
  }

  const readAlerts = async () => {
    const list = await api.listAlerts(id)
    if (!list.ok) return
    for (const alert of list.value.alerts) {
      if (shown.has(alert.id)) continue
      shown.add(alert.id)
      if (notify) emit({ type: 'notify', id: alert.id, ...notice(alert), url: taskUrl(alert.task) })
      await api.showAlert(id, alert.id)
    }
  }

  const readFolders = async () => {
    const list = await api.listFolders(id)
    if (!list.ok) return
    folders = list.value.folders
    for (const dir of keepOnly(folders.map((f) => f.path))) clearAkb(dir)
    emit({ type: 'folders', folders })
    const elsewhere = await api.listElsewhere(id)
    if (elsewhere.ok) emit({ type: 'elsewhere', projects: elsewhere.value.projects })
  }

  const readProfile = async () => {
    const session = readSession()
    const profile = await api.readProfile()
    const held = profile.ok ? profile.value.session : {}
    emit({
      type: 'account',
      name: held.name || held.handle || session?.name || session?.handle || '',
      email: held.email || session?.email || '',
      avatar: held.avatarUrl || session?.avatarUrl || '',
    })
  }

  const readPlan = async () => {
    const read = await api.readPlan()
    if (!read.ok) return
    const { billing, quota } = read.value
    // Paying, or on a grant: what may buy a storage pack. The trial alone may not.
    const paying = billing.plan === 'pro' && (!billing.trialEnd || !!billing.grantEnd || billing.state !== 'free')
    emit({
      type: 'plan',
      plan: billing.plan,
      paying,
      limits: quota.limits,
      used: quota.used,
      pricing: `${cloudEndpoints().api}/pricing?lang=${isChinese() ? 'zh' : 'en'}`,
    })
  }

  const readAll = () => {
    void readProfile()
    void readFolders()
    void readPlan()
    void readAlerts()
    readInbox()
  }

  const onConnected = () => {
    tell({ type: 'connected' })
    emit({ type: 'connection', state: 'connected', machine: machineName() })
    readAll()
  }

  /** Another Runner here runs the jobs (lock.ts): the panel still shows what needs the user. */
  const onWaiting = (holder?: Holder) => {
    tell({ type: 'waiting' })
    emit({ type: 'connection', state: 'paused', ...(holder ? { holder } : {}) })
    readAll()
  }

  const handle = async (command: Command) => {
    switch (command.cmd) {
      case 'signIn': {
        if (signing || readSession()) return
        signing = new AbortController()
        const failure = await signIn({ signal: signing.signal, onUrl: (url) => emit({ type: 'signin', state: 'waiting', url }) })
        signing = null
        if (failure) emit({ type: 'signin', state: failure.why === 'cancelled' ? 'needed' : 'failed', why: failure.why })
        else {
          emit({ type: 'signin', state: 'done' })
          wake('again')
        }
        return
      }
      case 'cancelSignIn':
        return signing?.abort()
      case 'signOut':
        await runner?.close()
        runner = null
        clearSession()
        lastInbox = ''
        return wake('again')
      case 'notify':
        notify = command.on
        return runner?.renew()
      case 'refresh':
        readInbox()
        return void readAlerts()
      case 'read':
        await api.readAlert(command.alert)
        return readInbox()
      case 'addFolder': {
        const project = command.project
        const why = refusal(command.path)
        if (why) return emit({ type: 'folderRefused', why, project })
        const real = fs.realpathSync(command.path)
        const added = await api.addFolder(id, path.basename(real) || real, real, project)
        if (!added.ok) {
          const taken = added.code === 'folder_taken'
          return emit({ type: 'folderRefused', why: taken ? 'taken' : 'failed', project, ...(taken ? { taken: added.project } : {}) })
        }
        allow(real)
        return readFolders()
      }
      case 'removeFolder': {
        const held = folders.find((f) => f.project === command.project)
        const removed = await api.removeFolder(id, command.project)
        if (removed.ok && held) for (const dir of disallow(held.path)) clearAkb(dir)
        return readFolders()
      }
      case 'folderNotify':
        await api.setFolderNotify(id, command.project, command.on)
        return readFolders()
      case 'plan':
        return readPlan()
      case 'checkout': {
        const plan = await api.readPlan()
        if (command.item === 'pro' && plan.ok && plan.value.billing.mayTrial) {
          const started = await api.startTrial()
          if (!started.ok) return emit({ type: 'checkout', failed: true })
          return readPlan()
        }
        const opened = await api.checkout(command.item)
        return emit(opened.ok ? { type: 'checkout', url: opened.value.url } : { type: 'checkout', failed: true })
      }
      case 'quit':
        await runner?.close()
        return wake('quit')
    }
  }

  readline.createInterface({ input: process.stdin }).on('line', (line) => {
    let command: Command
    try {
      command = JSON.parse(line) as Command
    } catch {
      return
    }
    void handle(command)
  })
  process.stdin.on('end', () => void handle({ cmd: 'quit' }))
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => void handle({ cmd: 'quit' }))

  for (;;) {
    const next = new Promise<'again' | 'quit' | Stop>((resolve) => (wake = resolve))
    if (!readSession()) {
      emit({ type: 'signin', state: 'needed' })
      const why = await next
      if (why === 'quit') return 0
      continue
    }

    tell({ type: 'started' })
    emit({ type: 'connection', state: 'connecting' })
    runner = startRunner({
      registration: async () => ({ machineId: id, machineName: machineName(), version: VERSION, runtimes: await detectRuntimes(true) }),
      kind: 'desktop',
      notify: () => notify,
      onConnected,
      onWaiting,
      onDisconnected: () => emit({ type: 'connection', state: 'reconnecting' }),
      onHint: (payload) => {
        if (payload.alertId || !payload.taskId) void readAlerts()
        if (!payload.jobId) readInbox()
      },
    })
    poller = setInterval(() => {
      readInbox()
      void readAlerts()
    }, POLL_MS)
    void runner.stopped.then(wake)

    const why = await next
    if (poller) clearInterval(poller)
    if (why === 'quit') return 0
    if (why === 'again') continue
    runner = null
    if (why.reason === 'outdated') return EXIT_OUTDATED
    emit({ type: 'connection', state: why.reason, ...(why.reason === 'elsewhere' ? { machine: why.machine } : {}) })
    const again = new Promise<'again' | 'quit' | Stop>((resolve) => (wake = resolve))
    const retry = setTimeout(() => wake('again'), RETRY_MS)
    const after = await again
    clearTimeout(retry)
    if (after === 'quit') return 0
  }
}
