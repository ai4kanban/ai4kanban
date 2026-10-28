// What the windows get from the shell (src-tauri/src/main.rs) and the Runner behind it
// (runner/src/desktop.ts).

export interface Item {
  task: string
  title: string
  project: string | null
  project_name: string | null
  phase: number | null
  at: string
  alert: string | null
  url: string
}

export interface Folder {
  project: string
  name: string
  path: string
  notify: boolean
}

/** A project of the account's workspaces not on this computer yet. */
export interface Elsewhere {
  project: string
  name: string
  workspace_name: string
  personal: boolean
}

/** The latest Runner event of each type. */
export interface Runner {
  hello?: { lang: string; web: string; version: string }
  signin?: { state: 'needed' | 'waiting' | 'failed' | 'done'; url?: string; why?: string }
  account?: { name: string; email: string; avatar: string }
  /** `paused`: another WildCrane on this computer runs the tasks, named by `holder` when it said. */
  connection?: { state: 'connecting' | 'connected' | 'paused' | 'reconnecting' | 'elsewhere' | 'refused'; machine?: string; holder?: string }
  inbox?: { review: Item[]; running: Item[] }
  folders?: { folders: Folder[] }
  elsewhere?: { projects: Elsewhere[] }
  plan?: Plan
}

/** The account's plan and what it uses (#2017). Sizes are bytes. */
export interface Plan {
  plan: 'free' | 'pro'
  /** Pro paid for, not only the trial: what may buy more storage. */
  paying: boolean
  limits: { tasks: number; storage: number; file: number; retentionDays: number }
  used: { tasks: number; storage: number }
  pricing: string
}

export interface Notifications {
  on: boolean
  /** What the system says; null when it cannot be told. */
  allowed: boolean | null
}

export interface Bridge {
  /** Which window this is: `setup`, `panel` or `bubble`. */
  window: string
  version(): Promise<string>
  snapshot(): Promise<Runner>
  /** Every Runner event, as it comes. */
  listen(on: (event: { type: string } & Record<string, unknown>) => void): void
  send(command: Record<string, unknown>): void
  openUrl(url: string, alert?: string | null): void
  /** With `project`, the folder is for that existing project; `title` heads the picker. */
  pickFolder(project?: string, title?: string): void
  notifications(): Promise<Notifications>
  enableNotifications(): Promise<Notifications>
  disableNotifications(): Promise<void>
  openNotificationSettings(): void
  autostart(on?: boolean): Promise<boolean>
  finishSetup(): void
  dismissBubble(): void
  hidePanel(): void
  quit(): void
  /** Called each time the panel is opened from the icon. */
  onShown(run: () => void): void
}

interface Tauri {
  core: { invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> }
  event: { listen(event: string, on: (e: { payload: unknown }) => void): Promise<unknown> }
  window: { getCurrentWindow(): { label: string } }
  app: { getVersion(): Promise<string> }
}

export function tauriBridge(): Bridge {
  const tauri = (window as unknown as { __TAURI__: Tauri }).__TAURI__
  const invoke = tauri.core.invoke
  const current = tauri.window.getCurrentWindow()
  return {
    window: current.label,
    version: () => tauri.app.getVersion(),
    snapshot: () => invoke<Runner>('snapshot'),
    listen: (on) => void tauri.event.listen('runner', (e) => on(e.payload as { type: string })),
    send: (command) => void invoke('send', { command }),
    openUrl: (url, alert) => void invoke('open_url', { url, alert: alert ?? null }),
    pickFolder: (project, title) => void invoke('pick_folder', { project: project ?? null, title: title ?? null }),
    notifications: () => invoke<Notifications>('notifications'),
    enableNotifications: () => invoke<Notifications>('enable_notifications'),
    disableNotifications: () => invoke('disable_notifications'),
    openNotificationSettings: () => void invoke('open_notification_settings'),
    autostart: (on) => invoke<boolean>('autostart', { on: on ?? null }),
    finishSetup: () => void invoke('finish_setup'),
    dismissBubble: () => void invoke('dismiss_bubble'),
    hidePanel: () => void invoke('hide_panel'),
    quit: () => void invoke('quit'),
    onShown: (run) => void tauri.event.listen('panel-shown', () => run()),
  }
}
