// A stand-in for Cloud's /v1/runner routes, holding the migration's rules in memory: one
// Runner per account, a job claimed once, a lapsed lease refused. It also holds one project's
// board files (#2081, #2114) and one task's artifacts, for the task folder (#2037).
// A job's log arrives over a WebSocket, as the job's `RunLog` takes it (#2085), and so does
// the Runner's presence when `presence` is on (#2163).

import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import type { AddressInfo, Socket } from 'node:net'

export interface FakeJob {
  id: string
  runtime: 'claude-code' | 'codex' | 'cursor' | 'opencode' | 'kimi' | 'dsh' | 'zcode' | 'grok'
  runtimeId?: string | null
  model?: string | null
  settings?: Record<string, string> | null
  test?: boolean
  secret?: boolean
  secrets?: Record<string, string | null> | null
  projectDir: string | null
  project?: string | null
  task?: string | null
  number?: number | null
  workflow?: string | null
  resume?: string | null
  fork?: boolean
  transcript?: string | null
  flow?: { verb: string; workflow: string; card?: number; text?: string; title?: string; resume?: boolean; skip_plan?: boolean; metadata?: Record<string, unknown> } | null
  discussion?: { id: string; workspace: string; ideas: Record<string, unknown>[] } | null
  chat?: { message: string; body: string } | null
  review?: { tasks: string[] } | null
  agent?: { name: string; workflow?: string; tasks?: { id: string; number: number }[] } | null
  prompt: string
  languageLine?: string
  attachments: { name: string; content: string }[]
  state: 'waiting' | 'claimed' | 'finished'
  machine?: string
  outcome?: string
  reason?: string
  report?: Record<string, unknown>
  events: { seq: number; text: string; kind?: string; data?: Record<string, unknown> }[]
  claims: number
  leaseLost?: boolean
  /** Its chat asked it to stop, said on the next renewal (#2133). */
  stop?: boolean
  /** The Runner said its log is complete. */
  logEnded?: boolean
  /** Whether the log was complete when the job finished. */
  finishedLogEnded?: boolean
}

export interface FakeAlert {
  id: string
  kind: 'review' | 'done' | 'failed' | 'comment'
  task: string
  task_title: string
  phase: number | null
  comment?: { id: string; author: { email?: string; handle?: string | null }; body: string } | null
  shown?: boolean
  read?: boolean
}

type Send = (status: number, value: unknown) => void
const BYTES = Symbol('bytes')

export interface FakeTask {
  artifacts: Map<string, Buffer[]>
  /** The workflow version the task runs on (#2040); none for a task made before. */
  workflow?: { workflow: string; version: number; files: Record<string, string>; builtin?: boolean }
  title?: string
  request?: string
  context?: { workflow?: string }
}

export interface FakeTriage {
  id: string
  project: string
  title: string
  text: string
  source_task: string | null
  workflow?: string | null
  state: 'open' | 'dismissed' | 'carded'
  dismissed_reason: string | null
  dismissed_at: string | null
  created_at: string
}

export class FakeCloud {
  task: FakeTask = { artifacts: new Map() }
  /** The workspace's own workflows' files, by id (#2004). */
  workflows: Record<string, Record<string, string>> = {}
  /** What the workspace's rejection review has not learned, and each batch marked learned. */
  rejections: { tasks: Record<string, unknown>[]; triage: FakeTriage[] } = { tasks: [], triage: [] }
  reviewed: { tasks: string[]; triage: string[] }[] = []
  /** The workspace's board (#2114): each file with the `seq` it was last written at; null once
   *  deleted. `prj_1`'s files under `projects/prj_1/`, the shared memory under `memory/`. */
  board = new Map<string, { content: string | null; seq: number }>()
  head = 0
  /** `METHOD /path` of every task folder call, in order. */
  log: string[] = []
  /** Runs just before the next board write lands, as another writer would. */
  beforeNextCommit: (() => void) | null = null
  /** Every call fails as if Cloud could not be reached. */
  offline = false
  uploads = new Map<string, Buffer>()
  /** The type each artifact was made with. */
  types = new Map<string, string>()
  jobs = new Map<string, FakeJob>()
  runner: { machineId: string; machineName: string; live: boolean; notify?: boolean } | null = null
  alerts: FakeAlert[] = []
  folders: { project: string; name: string; path: string; notify: boolean; machine: string }[] = []
  /** The account's projects with no folder anywhere yet (#2022). */
  others: { project: string; name: string; workspace: string; workspace_name: string; personal: boolean }[] = []
  /** Claude Code and Codex sessions' discussions, by the session they were opened for. */
  discussions: { id: string; request: string; project: string | null }[] = []
  inbox: { review: unknown[]; running: unknown[] } = { review: [], running: [] }
  /** This computer's running and queued tasks (#18), and every stop asked for. */
  machineTasks: Record<string, unknown>[] = []
  stops: string[] = []
  /** The archived tasks whose chat this computer answered last (#2065). */
  chats: { task: string; project: string }[] = []
  /** Each task's chat as Cloud keeps it (#2110); a task with none answers 404. */
  taskChats: Record<string, { id: string; role: 'user' | 'agent'; body: string; created_at: string }[]> = {}
  /** Every review asked for. */
  reviews: { project: string; tasks: string[]; runtime: string; model: string | null }[] = []
  /** The project's periodic agents as Cloud answers them (#2068), and every one asked for. */
  periodic: Record<string, unknown>[] = []
  asked: { project: string; agent: string; workflow: string | null; seen: string | null }[] = []
  registrations = 0
  /** Which keys the Runner said it holds, on its last register. */
  secrets: unknown
  runtimes: unknown = null
  protocol = 0
  minProtocol = 1
  version: string | null = null
  /** Whether a page watches the log, as the log object tells the Runner. */
  watched = false
  /** Answer the log's end with nothing, as a log object that went away would. */
  silentEnd = false
  /** Every log connection opened, open or not. */
  logs: { job: string; protocol: string | undefined; after: number; sent: unknown[]; socket: Socket }[] = []
  /** Answer the presence route (#2163); off, it is a Cloud from before it. */
  presence = false
  /** Every presence connection asked for, answered or not, and the pings each sent. */
  presences: { machine: string | null; protocol: string | undefined; pings: number; socket: Socket | null }[] = []
  private server: http.Server | null = null
  port = 0

  async start(port = 0): Promise<void> {
    this.server = http.createServer((req, res) => void this.handle(req, res))
    this.server.on('upgrade', (req, socket: Socket) => this.upgrade(req, socket))
    await new Promise<void>((resolve) => this.server!.listen(port, '127.0.0.1', resolve))
    this.port = (this.server!.address() as AddressInfo).port
    process.env.AI4KANBAN_CLOUD_URL = `http://127.0.0.1:${this.port}`
  }

  async stop(): Promise<void> {
    const server = this.server
    this.server = null
    server?.closeAllConnections()
    for (const log of this.logs) log.socket.destroy()
    for (const p of this.presences) p.socket?.destroy()
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()))
  }

  /** Written as another computer or the page would, to `prj_1`'s files: one new `seq` for all of them. */
  put(files: Record<string, string | null>, root = 'projects/prj_1/'): void {
    this.head++
    for (const [p, content] of Object.entries(files)) this.board.set(root + p, { content, seq: this.head })
  }

  /** The same, to the workspace's shared memory: `memory/<name>`. */
  putShared(files: Record<string, string | null>): void {
    this.put(files, '')
  }

  /** Ask a job to stop over its log (#2133). */
  stopOverLog(job: string): void {
    for (const log of this.logs) if (log.job === job && !log.socket.destroyed) frame(log.socket, { type: 'stop' })
  }

  /** Tell every open log connection whether a page watches. */
  watch(on: boolean): void {
    this.watched = on
    for (const log of this.logs) if (!log.socket.destroyed) frame(log.socket, { type: 'watched', on })
  }

  private upgrade(req: http.IncomingMessage, socket: Socket): void {
    const url = new URL(req.url!, 'http://x')
    if (url.pathname === '/v1/runner/presence') return this.presenceUpgrade(req, url, socket)
    const id = /^\/v1\/runner\/jobs\/([^/]+)\/stream$/.exec(url.pathname)?.[1]
    const job = id ? this.jobs.get(id) : undefined
    const machine = url.searchParams.get('machine')
    if (this.offline || !job || job.state !== 'claimed' || job.machine !== machine || job.leaseLost) {
      socket.end('HTTP/1.1 404 Not Found\r\ncontent-length: 0\r\n\r\n')
      return
    }
    const accept = crypto.createHash('sha1').update(`${req.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64')
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nupgrade: websocket\r\nconnection: Upgrade\r\nsec-websocket-accept: ${accept}\r\nsec-websocket-protocol: bearer\r\n\r\n`)
    const after = job.events.reduce((n, e) => Math.max(n, e.seq), -1)
    const log = { job: job.id, protocol: req.headers['sec-websocket-protocol'], after, sent: [] as unknown[], socket }
    this.logs.push(log)
    frame(socket, { type: 'hello', after, watched: this.watched })
    readFrames(socket, (said: any) => {
      log.sent.push(said)
      if (said.type === 'events') for (const e of said.events) if (!job.events.some((x) => x.seq === e.seq)) job.events.push(e)
      if (said.type === 'end' && !this.silentEnd) {
        job.logEnded = true
        frame(socket, { type: 'ended' })
      }
    })
  }

  private presenceUpgrade(req: http.IncomingMessage, url: URL, socket: Socket): void {
    const held = { machine: url.searchParams.get('machine'), protocol: req.headers['sec-websocket-protocol'], pings: 0, socket: null as Socket | null }
    this.presences.push(held)
    if (this.offline || !this.presence) {
      socket.end('HTTP/1.1 404 Not Found\r\ncontent-length: 0\r\n\r\n')
      return
    }
    const accept = crypto.createHash('sha1').update(`${req.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64')
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nupgrade: websocket\r\nconnection: Upgrade\r\nsec-websocket-accept: ${accept}\r\nsec-websocket-protocol: bearer\r\n\r\n`)
    held.socket = socket
    readFrames(socket, (said) => {
      if (said !== 'ping') return
      held.pings++
      frame(socket, 'pong', false)
    }, (m) => m)
  }

  /** `prj_1`'s file. */
  file(p: string, root = 'projects/prj_1/'): string | null {
    return this.board.get(root + p)?.content ?? null
  }

  /** The workspace's shared memory file `memory/<name>`. */
  shared(p: string): string | null {
    return this.file(p, '')
  }

  dispatch(job: Partial<FakeJob> & { id: string }): FakeJob {
    const held: FakeJob = { runtime: 'codex', projectDir: null, prompt: 'go', attachments: [], state: 'waiting', events: [], claims: 0, ...job }
    this.jobs.set(held.id, held)
    return held
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (this.offline) return void req.socket.destroy()
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    const raw = Buffer.concat(chunks)
    const body = raw.length && req.headers['content-type'] === 'application/json' ? JSON.parse(raw.toString()) : {}
    const url = new URL(req.url!, 'http://x')
    const send = (status: number, value: unknown) => {
      const bytes = value && typeof value === 'object' ? (value as { [BYTES]?: Buffer })[BYTES] : undefined
      res.writeHead(status, { 'content-type': bytes ? 'application/octet-stream' : 'application/json' })
      res.end(bytes ?? JSON.stringify(value))
    }
    const refuse = (status: number, code: string, message: string) => send(status, { error: { code, message } })
    const route = url.pathname

    const stop = /^\/v1\/tasks\/([^/]+)\/(stop|chat\/stop)$/.exec(route)
    if (stop && req.method === 'POST') {
      if (stop[1] === 'refused') return refuse(403, 'forbidden', 'Not yours to stop.')
      this.stops.push(`${stop[2]} ${stop[1]}`)
      return send(200, {})
    }
    if (/^\/v1\/(tasks|projects|artifacts|uploads)\b|^\/v1\/workflows\/[^/]+$/.test(route)) return this.handleTask(req.method!, url, body, raw, send, refuse)
    if (route === '/v1/rejections') return send(200, this.rejections)
    if (route === '/v1/rejections/reviewed') {
      this.reviewed.push(body)
      return send(200, { tasks: body.tasks.length, triage: body.triage.length })
    }
    if (route === '/v1/workflows') {
      const own = Object.keys(this.workflows).map((id) => ({ id, name: id }))
      return send(200, { data: [{ id: 'wf_builtin_coding', name: 'Coding', names: { en: 'Coding', zh: '软件开发' }, description: 'Build software.' }, ...own], next: null })
    }
    if (route === '/v1/runner/version') return send(200, { version: this.version })
    if (route === '/v1/runner/presence' && this.presence) return refuse(400, 'bad_request', 'Open this as a WebSocket.')
    if (route === '/v1/runner' && req.method === 'GET') return send(200, { runner: this.runner })
    if (route === '/v1/runner') {
      if (!(body.protocol >= this.minProtocol)) return refuse(426, 'runner_outdated', 'Restart to update.')
      if (this.runner?.live && this.runner.machineId !== body.machineId) {
        return refuse(409, 'runner_elsewhere', `Your WildCrane Runner is already connected on ${this.runner.machineName}.`)
      }
      this.registrations++
      this.protocol = body.protocol
      this.runtimes = body.runtimes
      this.secrets = body.secrets
      this.runner = { machineId: body.machineId, machineName: body.machineName, live: true, notify: body.notify === true }
      return send(200, { runner: this.runner })
    }
    if (route === '/v1/session') return send(200, { session: { handle: 'lin', name: 'Lin Chen', email: 'lin@acme.dev' } })
    if (route === '/v1/runner/inbox') return send(200, this.inbox)
    if (route === '/v1/runner/alerts') {
      const machine = url.searchParams.get('machine')!
      const comments = url.searchParams.get('comments') === '1'
      const unseen = this.alerts.filter((a) => !a.shown && !a.read && (comments || a.kind !== 'comment'))
      return send(200, { alerts: this.runner?.machineId === machine ? unseen : [] })
    }
    const alert = /^\/v1\/(?:runner\/)?alerts\/([^/]+)\/(shown|read)$/.exec(route)
    if (alert) {
      const held = this.alerts.find((a) => a.id === alert[1])
      if (!held) return refuse(404, 'not_found', 'no')
      held[alert[2] as 'shown' | 'read'] = true
      return send(200, { shown: true })
    }
    if (route === '/v1/runner/folders' && req.method === 'GET') {
      const machine = url.searchParams.get('machine')!
      if (url.searchParams.get('elsewhere') === '1') {
        return send(200, { projects: this.others.filter((o) => !this.folders.some((f) => f.project === o.project && f.machine === machine)) })
      }
      return send(200, { folders: this.folders.filter((f) => f.machine === machine).map(({ machine: _, ...f }) => f) })
    }
    if (route === '/v1/runner/folders') {
      const holder = this.folders.find((f) => f.path === body.path && f.machine === body.machineId)
      if (holder && body.project && holder.project !== body.project) {
        return send(409, { error: { code: 'folder_taken', message: 'taken', project: holder.name } })
      }
      const other = this.others.find((o) => o.project === body.project)
      const folder = { project: other?.project ?? `prj_${this.folders.length + 1}`, name: other?.name ?? body.name, path: body.path, notify: true, machine: body.machineId }
      this.folders.push(folder)
      return send(200, { folder })
    }
    const folder = /^\/v1\/runner\/folders\/([^/]+)\/(remove|notify)$/.exec(route)
    if (folder) {
      const held = this.folders.find((f) => f.project === folder[1])
      if (folder[2] === 'remove') this.folders = this.folders.filter((f) => f !== held)
      else if (held) held.notify = body.on
      return send(200, { removed: true, folder: held })
    }
    if (route === '/v1/discussions/external' || /^\/v1\/discussions\/[^/]+$/.test(route)) {
      const held = route === '/v1/discussions/external'
        ? this.discussions.find((d) => d.request === body.requestId) ?? this.discussions[this.discussions.push({ id: `dsc_${this.discussions.length + 1}`, request: body.requestId, project: body.project ?? null }) - 1]!
        : this.discussions.find((d) => d.id === route.split('/').pop())
      if (!held) return refuse(404, 'not_found', 'no')
      return send(200, { id: held.id, workspace: 'ws_me', project: held.project, title: '', version: 1, ideas: [], updated_at: new Date(0).toISOString() })
    }
    if (route === '/v1/runner/release') {
      if (this.runner && this.runner.machineId === body.machineId) this.runner.live = false
      return send(200, { released: true })
    }
    const mine = (machine: string) => this.runner?.live && this.runner.machineId === machine
    if (route === '/v1/runner/tasks') return send(200, { tasks: this.machineTasks })
    if (route === '/v1/runner/chats') return send(200, { chats: mine(url.searchParams.get('machine')!) ? this.chats : [] })
    if (route === '/v1/runner/reviews') {
      this.reviews.push({ project: body.project, tasks: body.tasks, runtime: body.runtime, model: body.model })
      const job = this.dispatch({ id: `review-${this.reviews.length}`, project: body.project, runtime: body.runtime, review: { tasks: body.tasks } })
      return send(200, { job })
    }
    if (route === '/v1/runner/agents') return send(200, { agents: mine(url.searchParams.get('machine')!) ? this.periodic : [] })
    if (route === '/v1/runner/jobs' && req.method === 'POST' && body.agent) {
      this.asked.push({ project: body.project, agent: body.agent, workflow: body.workflow, seen: body.seen })
      const open = [...this.jobs.values()].some((j) => j.agent?.name === body.agent && j.state !== 'finished')
      if (open) return send(200, { job: null })
      const dir = this.folders.find((f) => f.project === body.project && f.machine === body.machineId)?.path ?? null
      const job = this.dispatch({ id: `agent-${this.asked.length}`, project: body.project, projectDir: dir, machine: body.machineId,
        agent: { name: body.agent, ...(body.workflow ? { workflow: body.workflow } : {}) } })
      return send(200, { job })
    }
    if (route === '/v1/runner/jobs') {
      const machine = url.searchParams.get('machine')!
      if (!mine(machine)) return send(200, { jobs: [] })
      const jobs = [...this.jobs.values()].filter((j) => j.state === 'waiting' || (j.state === 'claimed' && j.machine === machine && !j.leaseLost))
      return send(200, { jobs: jobs.map(({ events, claims, ...j }) => j) })
    }
    const move = /^\/v1\/runner\/jobs\/([^/]+)\/(claim|renew|finish)$/.exec(route)
    const job = move && this.jobs.get(move[1]!)
    if (!move || !job) return refuse(404, 'not_found', 'no')
    const held = job.state === 'claimed' && job.machine === body.machineId && !job.leaseLost
    switch (move[2]) {
      case 'claim':
        if (!mine(body.machineId) || job.state !== 'waiting') return send(200, { claimed: false, reason: 'taken' })
        job.claims++
        job.state = 'claimed'
        job.machine = body.machineId
        return send(200, { claimed: true, job: { ...job, events: undefined } })
      case 'renew':
        return send(200, { renewed: held, ...(job.stop ? { stop: true } : {}) })
      default:
        if (!held) return send(200, { finished: false })
        Object.assign(job, { state: 'finished', outcome: body.outcome, reason: body.reason, report: body.report, finishedLogEnded: job.logEnded === true })
        return send(200, { finished: true })
    }
  }

  private handleTask(method: string, url: URL, body: any, raw: Buffer, send: Send, refuse: (status: number, code: string, message: string) => void): void {
    const task = this.task
    const route = url.pathname
    this.log.push(`${method} ${route}`)
    const board = /^\/v1\/projects\/([^/]+)\/board(\/commits)?$/.exec(route)
    const ours = (p: string) => p.startsWith(`projects/${board![1]}/`) || p.startsWith('memory/')
    if (board && !board[2] && method === 'GET') {
      const since = url.searchParams.get('since')
      const files = [...this.board].filter(([p, f]) => ours(p) && (since === null ? f.content !== null : f.seq > Number(since)))
        .map(([p, f]) => ({ path: p, content: f.content, seq: f.seq }))
      return send(200, { head_seq: this.head, files })
    }
    if (board) {
      const job = this.jobs.get(body.job)
      if (!job || job.state !== 'claimed' || job.machine !== body.machine || job.leaseLost) {
        return refuse(409, 'conflict', 'This job has ended or moved to another computer.')
      }
      const writes = body.files as { path: string; content: string | null; base_seq: number }[]
      if (!writes.every((w) => ours(w.path))) return refuse(400, 'bad_request', 'A path is not this project’s.')
      this.beforeNextCommit?.()
      this.beforeNextCommit = null
      const now = (p: string) => this.board.get(p)
      const stale = writes.filter((w) => {
        const held = now(w.path)
        if ((held?.content ?? null) === w.content) return false
        return !(w.base_seq === (held?.seq ?? 0) || (held?.content === null && w.base_seq === 0))
      })
      if (stale.length) {
        return send(409, { error: { code: 'version_conflict', message: 'These files changed.' },
          files: stale.map((w) => ({ path: w.path, content: now(w.path)?.content ?? null, seq: now(w.path)?.seq ?? 0 })) })
      }
      const changed = writes.filter((w) => (now(w.path)?.content ?? null) !== w.content)
      if (changed.length) this.head++
      for (const w of changed) this.board.set(w.path, { content: w.content, seq: this.head })
      return send(200, { head_seq: this.head, files: writes.map((w) => ({ path: w.path, seq: now(w.path)?.seq ?? 0 })) })
    }
    if (/^\/v1\/tasks\/[^/]+\/workflow$/.test(route)) {
      if (!task.workflow) return refuse(404, 'not_found', 'No workflow version.')
      const root = `workflows/${task.workflow.workflow.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/`
      this.put(Object.fromEntries(Object.entries(task.workflow.files).map(([n, t]) => [root + n, t])))
      return send(200, { object: 'workflow_version', ...task.workflow })
    }
    const chat = /^\/v1\/tasks\/([^/]+)\/chat$/.exec(route)
    if (chat && method === 'GET') {
      const messages = this.taskChats[chat[1]!]
      return messages ? send(200, { messages }) : refuse(404, 'not_found', 'No chat.')
    }
    if (/^\/v1\/tasks\/[^/]+$/.test(route)) {
      return send(200, { id: route.split('/')[3], title: task.title ?? 'Pricing', request: task.request ?? 'Two tiers.', context: task.context ?? {} })
    }
    if (/^\/v1\/workflows\/[^/]+$/.test(route)) {
      const files = this.workflows[route.split('/')[3]!]
      return files ? send(200, { id: route.split('/')[3], files }) : refuse(404, 'not_found', 'No workflow has this id.')
    }
    if (/^\/v1\/projects\/[^/]+$/.test(route)) return send(200, { id: route.split('/')[3], unfiled: false, workspace: 'ws_1' })
    let m = /^\/v1\/artifacts\/([^/]+)$/.exec(route)
    if (m) return send(200, { id: m[1], latest_version: task.artifacts.get(m[1]!)?.length ?? null })
    m = /^\/v1\/artifacts\/([^/]+)\/versions\/(\d+)(\/file)?$/.exec(route)
    if (m) {
      const bytes = task.artifacts.get(m[1]!)?.[Number(m[2]) - 1]
      if (!bytes) return refuse(404, 'not_found', 'no')
      if (!m[3]) return send(200, { content: null, file: { url: `${route}/file` } })
      return send(200, { [BYTES]: bytes })
    }
    m = /^\/v1\/tasks\/[^/]+\/artifacts$/.exec(route)
    if (m) {
      const id = `art_${task.artifacts.size + 1}`
      task.artifacts.set(id, [])
      this.types.set(id, body.type)
      return send(201, { id })
    }
    m = /^\/v1\/artifacts\/([^/]+)\/uploads$/.exec(route)
    if (m) return send(201, { id: `upl_${m[1]}` })
    m = /^\/v1\/uploads\/upl_(.+)$/.exec(route)
    if (m) {
      this.uploads.set(m[1]!, raw)
      return send(200, { uploaded: true })
    }
    m = /^\/v1\/artifacts\/([^/]+)\/versions$/.exec(route)
    if (m) {
      const versions = task.artifacts.get(m[1]!)!
      versions.push(this.uploads.get(m[1]!)!)
      return send(201, { version: versions.length })
    }
    return refuse(404, 'not_found', 'no')
  }
}

/** One unmasked text frame, as a server sends. */
function frame(socket: Socket, value: unknown, json = true): void {
  const body = Buffer.from(json ? JSON.stringify(value) : String(value))
  const head = body.length < 126 ? Buffer.from([0x81, body.length])
    : body.length < 65536 ? Buffer.from([0x81, 126, body.length >> 8, body.length & 255])
    : Buffer.concat([Buffer.from([0x81, 127]), (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(body.length)); return b })()])
  socket.write(Buffer.concat([head, body]))
}

/** A client's masked frames, each whole text message parsed; a close is answered and ends it. */
function readFrames(socket: Socket, onMessage: (value: unknown) => void, parse: (text: string) => unknown = JSON.parse): void {
  let held = Buffer.alloc(0)
  let text: Buffer[] = []
  socket.on('error', () => {})
  socket.on('data', (chunk: Buffer) => {
    held = Buffer.concat([held, chunk])
    for (;;) {
      if (held.length < 2) return
      const fin = (held[0]! & 0x80) !== 0
      const op = held[0]! & 0x0f
      let len = held[1]! & 0x7f
      let at = 2
      if (len === 126) {
        if (held.length < 4) return
        len = held.readUInt16BE(2)
        at = 4
      } else if (len === 127) {
        if (held.length < 10) return
        len = Number(held.readBigUInt64BE(2))
        at = 10
      }
      if (held.length < at + 4 + len) return
      const mask = held.subarray(at, at + 4)
      const body = Buffer.from(held.subarray(at + 4, at + 4 + len)).map((b, i) => b ^ mask[i % 4]!)
      held = held.subarray(at + 4 + len)
      if (op === 8) {
        socket.end(Buffer.from([0x88, 0]))
        return
      }
      if (op !== 1 && op !== 0) continue
      text.push(Buffer.from(body))
      if (!fin) continue
      const message = Buffer.concat(text).toString()
      text = []
      onMessage(parse(message))
    }
  })
}

/** A session good for a day, so the Runner never refreshes or signs in. */
export function writeFakeSession(home: string): void {
  process.env.AI4KANBAN_SUPABASE_URL = 'http://127.0.0.1:9'
  fs.mkdirSync(home, { recursive: true })
  fs.writeFileSync(
    path.join(home, 'session.json'),
    JSON.stringify({ version: 1, supabaseUrl: 'http://127.0.0.1:9', accessToken: 't', refreshToken: 'r', expiresAt: Date.now() + 86_400_000, subject: 'acct' }),
  )
}

export async function until(check: () => boolean, ms = 5_000): Promise<void> {
  const end = Date.now() + ms
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out waiting')
    await new Promise((r) => setTimeout(r, 20))
  }
}
