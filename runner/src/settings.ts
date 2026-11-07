import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { clearSession, readSession } from '../../cli/src/lib/cloud/session'
import * as api from './api'
import { clearAkb, kept } from './cache'
import { adoptLegacy, allow, disallow, refusal } from './folders'
import { runnerHome, machineId, machineName } from './home'
import { LABELS, detectRuntimes, hints } from './runtimes'
import { runnerSettingsSupport } from './lock'
import { signIn } from './signin'
import { acceptAlphaUpdates, saveAlphaUpdates } from './preferences'
import { stopExecutors } from './settings-control'
import { pickFolder } from './settings-browser'
import type { SettingsContext } from './settings-server'

const failure = (call: { error: string; code?: string }) => ({ error: call.code ?? 'offline', message: call.error })
let signing: { url: string | null; failed: string | null } | null = null
let signAbort: AbortController | null = null
let stopping = false
let callback = () => {}
const notify = () => {
  fs.mkdirSync(runnerHome(), { recursive: true, mode: 0o700 })
  fs.writeFileSync(path.join(runnerHome(), 'settings-refresh'), crypto.randomUUID(), { mode: 0o600 })
  callback()
}
export const onSettingsChange = (next: () => void) => { callback = next }
export const signingState = () => signing

export function startSignIn(): void {
  if (stopping || signing && !signing.failed) return
  signing = { url: null, failed: null }
  const held = signing
  signAbort = new AbortController()
  void signIn({ signal: signAbort.signal, onUrl: (url) => { held.url = url } }).then((error) => {
    if (signing !== held) return
    if (error) held.failed = error.why
    else { signing = null; adoptLegacy(); notify() }
  })
}

export async function signOut() {
  if (await runnerSettingsSupport() === false) return { error: 'upgrade' }
  stopping = true
  signAbort?.abort()
  signing = null
  clearSession()
  try {
    const stopped = await stopExecutors()
    notify()
    return stopped ? { signedIn: false } : { error: 'stopping' }
  } finally { stopping = false }
}

export async function folderOf(cwd: string) {
  const list = await api.listFolders(machineId())
  if (!list.ok) return { ...failure(list), folders: [] as api.Folder[], folder: null }
  const real = (dir: string) => { try { return fs.realpathSync(dir) } catch { return dir } }
  return { folders: list.value.folders, folder: list.value.folders.find((f) => real(f.path) === real(cwd)) ?? null }
}

export async function addFolder(dir: string, bind?: string, strict = false) {
  if (!readSession()) return { error: 'signed_out' }
  adoptLegacy()
  const subject = readSession()!.subject
  const why = refusal(dir)
  if (why) return { error: why }
  const real = fs.realpathSync(dir)
  const found = await folderOf(real)
  if ('error' in found) return found
  let project = found.folder?.project
  if (found.folder && (bind ? bind !== project : strict)) return { error: 'folder_taken', message: 'taken', name: found.folder.name }
  if (!project) {
    const added = await api.addFolder(machineId(), path.basename(real) || real, real, bind)
    if (!added.ok) return failure(added)
    project = added.value.folder.project
  }
  if (readSession()?.subject !== subject) return { error: 'signed_out' }
  try { allow(real) } catch { return { error: 'authorization_write', project } }
  notify()
  return { added: true, project }
}

export async function removeFolder(project: string) {
  const subject = readSession()?.subject
  if (!subject) return { error: 'signed_out' }
  const found = await folderOf('')
  if ('error' in found) return found
  const held = found.folders.find((f) => f.project === project)
  if (!held) return { error: 'not_found' }
  if (kept(held.path)) return { error: 'busy' }
  const removed = await api.removeFolder(machineId(), project)
  if (!removed.ok) return failure(removed)
  if (readSession()?.subject !== subject) return { error: 'signed_out' }
  try { for (const dir of disallow(held.path)) clearAkb(dir) } catch { return { error: 'authorization_write' } }
  notify()
  return { removed: true }
}

export async function connections() {
  const found = await detectRuntimes(true)
  notify()
  return { connections: found.map((r) => {
    const hint = hints(r.name)
    const state: 'notInstalled' | 'signedOut' | 'ready' = !r.installed ? 'notInstalled' : r.loggedIn === false ? 'signedOut' : 'ready'
    return { name: r.name, label: LABELS[r.name], state, version: r.version ?? null, command: (state === 'notInstalled' ? hint.install : state === 'signedOut' ? hint.login : null) ?? null }
  }) }
}

interface Workspace { id: string; name: string; role: string; personal: boolean }
interface Project { id: string; name: string; workspace: string; general?: boolean }
async function all<T>(route: string): Promise<api.Call<T[]>> {
  const list: T[] = []
  for (let after: string | null = null;;) {
    const result: api.Call<{ data: T[]; next: string | null }> = await api.request('GET', `${route}${route.includes('?') ? '&' : '?'}limit=100${after ? `&after=${encodeURIComponent(after)}` : ''}`)
    if (!result.ok) return result
    list.push(...result.value.data)
    if (!result.value.next) return { ok: true, value: list }
    after = result.value.next
  }
}

export async function settingsState(context: SettingsContext) {
  adoptLegacy()
  const session = readSession()
  const base = { machine: machineName(), machineId: machineId(), signedIn: !!session, signing, context, acceptAlphaUpdates: acceptAlphaUpdates() }
  if (await runnerSettingsSupport() === false) return { ...base, upgrade: true }
  if (!session) return base
  const account = { id: session.subject, name: session.name ?? session.handle, email: session.email }
  const subject = session.subject
  const [folders, workspaces, runner] = await Promise.all([api.listFolders(machineId()), all<Workspace>('/v1/workspaces'), api.readRunner()])
  if (readSession()?.subject !== subject) return { ...base, signedIn: false }
  if (!folders.ok) return { ...base, account, ...failure(folders) }
  if (!workspaces.ok) return { ...base, account, ...failure(workspaces) }
  const lists = await Promise.all(workspaces.value.map((ws) => all<Project>(`/v1/projects?workspace=${encodeURIComponent(ws.id)}`)))
  const failed = lists.find((list) => !list.ok)
  if (failed && !failed.ok) return { ...base, account, ...failure(failed) }
  if (readSession()?.subject !== subject) return { ...base, signedIn: false }
  const projects = lists.flatMap((list) => list.ok ? list.value : [])
  const metadata = (id: string) => {
    const project = projects.find((p) => p.id === id)
    const workspace = workspaces.value.find((w) => w.id === project?.workspace)
    return { workspace: workspace?.id, workspace_name: workspace?.name }
  }
  return { ...base, account, connected: runner.ok && runner.value.runner?.connected,
    workspaces: workspaces.value,
    projects: folders.value.folders.map((f) => ({ ...f, ...metadata(f.project), busy: kept(f.path), missing: !fs.existsSync(f.path) })),
    elsewhere: projects.filter((p) => !p.general && !folders.value.folders.some((f) => f.project === p.id)).map((p) => ({ project: p.id, name: p.name, ...metadata(p.id) })),
    ...(context.project && !projects.some((p) => p.id === context.project) ? { error: 'not_found' } : {}),
  }
}

/** 文件夹只存在服务端上下文中，浏览器提交的路径不能成为授权。 */
const selected = new WeakMap<SettingsContext, { path: string; subject: string; creation?: { key: string; name: string; workspace: string; project?: string } }>()
export async function settingsAction(action: string, body: Record<string, unknown>, context: SettingsContext): Promise<unknown> {
  if (action === 'state') return settingsState(context)
  if (action === 'updates') {
    if (typeof body.acceptAlphaUpdates !== 'boolean') return { error: 'bad_request' }
    try { saveAlphaUpdates(body.acceptAlphaUpdates); return { acceptAlphaUpdates: acceptAlphaUpdates() } }
    catch { return { error: 'preferences_write', acceptAlphaUpdates: acceptAlphaUpdates() } }
  }
  if (action === 'signIn') { startSignIn(); return { signing } }
  if (action === 'signOut') return signOut()
  if (action === 'connections') return connections()
  if (!readSession()) return { error: 'signed_out' }
  if (action === 'pick') {
    try {
      const subject = readSession()!.subject
      const dir = body.current === true ? context.path : await pickFolder()
      if (readSession()?.subject !== subject) return { error: 'signed_out' }
      if (!dir) return { cancelled: true }
      const why = refusal(dir)
      if (why) return { error: why }
      const real = fs.realpathSync(dir)
      selected.set(context, { path: real, subject: readSession()!.subject })
      return { path: real, name: path.basename(real) }
    } catch { return { error: 'picker_unavailable' } }
  }
  if (action === 'cancel') { selected.delete(context); return { cancelled: true } }
  if (action === 'remove') return typeof body.project === 'string' ? removeFolder(body.project) : { error: 'bad_request' }
  if (action === 'bind') {
    const choice = selected.get(context)
    if (!choice) return { error: 'missing' }
    if (choice.subject !== readSession()?.subject) return { error: 'signed_out' }
    const dir = choice.path
    let project = typeof body.project === 'string' ? body.project : undefined
    if (!project) {
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      if (!name || typeof body.workspace !== 'string') return { error: 'bad_request' }
      if (refusal(dir)) return { error: 'missing' }
      const spaces = await all<Workspace>('/v1/workspaces')
      if (!spaces.ok) return failure(spaces)
      if (!spaces.value.some((ws) => ws.id === body.workspace && ws.role !== 'viewer')) return { error: 'forbidden' }
      const found = await folderOf(dir)
      if ('error' in found) return found
      if (found.folder) return { error: 'folder_taken' }
      if (choice.subject !== readSession()?.subject) return { error: 'signed_out' }
      if (!choice.creation || choice.creation.name !== name || choice.creation.workspace !== body.workspace) choice.creation = { key: crypto.randomUUID(), name, workspace: body.workspace }
      const created = choice.creation.project ? { ok: true as const, value: { id: choice.creation.project } } : await api.createProject(name, body.workspace, choice.creation.key)
      if (!created.ok) return failure(created)
      project = created.value.id
      choice.creation.project = project
      // 授权保存失败或网络失败时，重试绑定同一项目。
      body.project = project
      context.project = project
    }
    const added = await addFolder(dir, project)
    if (!('error' in added)) selected.delete(context)
    return { ...added, project }
  }
  return { error: 'bad_request' }
}
