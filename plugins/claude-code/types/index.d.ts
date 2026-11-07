// The WildCrane panel's values, held by the host for the session.

export type Tab = 'projects' | 'tasks' | 'agents'

/** `busy` while a job, unsent work or a paused task holds the folder: it cannot be unbound. */
export type Folder = { project: string; name: string; dir: string; board: string; busy?: boolean }

/** An account's project with no folder on this computer, which a folder can be bound to. */
export type Bindable = { project: string; name: string; workspace_name: string; personal: boolean; board: string }

/** The Projects row asking to unbind, or saying it cannot. */
export type Removing = { project: string; busy: boolean } | null

/** The folder field open under New project (`project` null) or under an `elsewhere` row's Bind;
 *  `error` a refusal's code, `holder` the project a taken folder belongs to. */
export type Adding = { project: string | null; path: string; error: string | null; holder: string | null } | null

export type Status = {
  dir: string
  runner?: 'off' | 'waiting' | 'running' | 'outdated'
  signedIn: boolean
  account?: { name?: string; email?: string }
  signing?: { url: string | null; failed: string | null } | null
  folder?: Folder | null
  refused?: string | null
  projects?: Folder[]
  elsewhere?: Bindable[]
  /** `latest` only when newer than `version`; null when unknown. */
  plugin?: { version: string | null; latest: string | null }
  error?: string
}

export type Connection = { name: string; label: string; state: 'ready' | 'signedOut' | 'notInstalled'; version: string | null; command: string | null }

/** A task this computer runs or holds queued; `stop` the route that stops it, null while queued. */
export type TaskRow = {
  task: string
  title: string
  project: string
  agent: string
  state: 'running' | 'queued'
  minutes: number
  stop: 'task' | 'chat' | null
  url: string
}

declare module 'claude-code' {
  interface PluginState {
    wildcrane: {
      tab: Tab
      lang: 'zh' | 'en'
      session: string
      cwd: string
      status: Status | null
      connections: Connection[] | null
      tasks: TaskRow[] | null
      /** Tasks whose Stop was pressed, until they leave the list; `stopFailed` those Cloud refused. */
      stopping: string[]
      stopFailed: string[]
      synced: boolean
      removing: Removing
      adding: Adding
      /** The Sign out question is open. */
      signingOut: boolean
    }
  }
}
