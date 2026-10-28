// The WildCrane panel's values, held by the host for the session.

export type Tab = 'ideas' | 'chats' | 'projects' | 'connections'

export type Idea = {
  id: string
  title: string
  outcome: string
  acceptance: string[]
  workflow: string
  task: { id: string; key?: string; url: string } | null
}

export type Workflow = { id: string; name: string; names?: { en: string; zh: string }; description: string }

export type Draft = { discussion: string; version: number; ideas: Idea[]; workflows: Workflow[] }

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
  signedIn: boolean
  signing?: { url: string | null; failed: string | null } | null
  folder?: Folder | null
  refused?: string | null
  projects?: Folder[]
  elsewhere?: Bindable[]
  error?: string
}

export type Chat = { session: string; discussion: string; dir: string; title: string; ideas: number; at: string }

export type Connection = { name: string; label: string; state: 'ready' | 'signedOut' | 'notInstalled'; command: string | null }

/** A failure the panel shows over the ideas: `offline`, `conflict`, `limit`, `startFailed`, `sendFailed`, `notReady`. */
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
      /** A discussion opened from Chats; null shows this session's. */
      viewing: string | null
      open: number
      busy: boolean
      banner: Banner
      /** What the person wrote and has not reached Claude yet. */
      text: string
      chats: Chat[] | null
      connections: Connection[] | null
      synced: boolean
      removing: Removing
      adding: Adding
    }
  }
}
