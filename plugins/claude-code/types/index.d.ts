// The WildCrane panel's values, held by the host for the session.

export type Tab = 'ideas' | 'projects' | 'agents'

export type Idea = {
  id: string
  title: string
  outcome: string
  acceptance: string[]
  workflow: string
  task: { id: string; key?: string; url: string } | null
}

export type Workflow = { id: string; name: string; names?: { en: string; zh: string }; description: string }

/** `project` null until a folder is chosen: Start then places the idea in this folder's. */
export type Draft = { discussion: string; project?: string | null; version: number; ideas: Idea[]; workflows: Workflow[] }

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
  error?: string
}

export type Connection = { name: string; label: string; state: 'ready' | 'signedOut' | 'notInstalled'; command: string | null }

/** A failure the panel shows over the ideas: `offline`, `conflict`, `limit`, `startFailed`, `notReady`. */
export type Banner = string | null

declare module 'claude-code' {
  interface PluginState {
    wildcrane: {
      tab: Tab
      lang: 'zh' | 'en'
      session: string
      cwd: string
      status: Status | null
      draft: Draft | null
      open: number
      busy: boolean
      banner: Banner
      connections: Connection[] | null
      synced: boolean
      removing: Removing
      adding: Adding
      /** The Sign out question is open. */
      signingOut: boolean
    }
  }
}
