// The local settings page, bundled for the browser by scripts/settings-client.mjs and served as
// /settings-client.js. Its controls are the web app's shadcn components.
import { useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { FiChevronDown, FiCopy, FiFolder, FiInfo, FiMonitor, FiRefreshCw } from 'react-icons/fi'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog'
import { Button } from './ui/button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTitle } from './ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from './ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Switch } from './ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
import { cn } from './ui/utils'
import { BRAND, MARKS } from './settings-marks'
import css from './settings.css'

const words = {
  zh: { updates: '版本更新', alpha: '接受 Alpha 版本更新', hint: 'Alpha 版本风险较高，不建议日常使用。', saving: '保存中…', saved: '已保存', saveFailed: '未能保存，更改未生效。', title: '本机设置', upgrade: '请重新打开插件', upgradeHow: '关闭这台电脑上仍在使用旧版本的 WildCrane 插件，再重新打开设置。', projects: '项目目录', add: '添加项目', new: '＋ 新建项目…', tools: 'AI 工具', recheck: '重新检测', out: '退出登录', connected: '已连接', offline: '云端暂时不可用，请重试。', empty: '还没有项目目录', remove: '解除绑定', removeAsk: '解除后，该项目的新任务将不再使用此文件夹。项目、任务和源文件保留。', cancel: '取消', confirm: '确认解除', bindTitle: '绑定已有项目', newTitle: '新建项目', project: '项目', workspace: '所属空间', chooseWorkspace: '选择空间', name: '项目名称', folder: '项目文件夹', folderHint: '绑定仅指定任务目录，不限制 AI 工具访问其他文件。', choose: '选择文件夹', current: '使用当前会话文件夹', change: '更换', create: '创建项目', bind: '绑定文件夹', signIn: '登录 WildCrane', signing: '等待浏览器完成登录…', signFailed: '登录未完成，请重试。', outTitle: '退出账号？', outAsk: '退出后，这台运行电脑上的任务将停止。', closed: '设置已断开', reopen: '请从 Claude Code、Codex 或终端重新打开 WildCrane 设置。', ready: '可用', notInstalled: '未安装', signedOut: '未登录', detecting: '检测中…', retry: '重试', noComputer: '未连接', copy: '复制位置', close: '关闭', errors: { missing: '文件夹不存在，请重新选择。', home: '不能选择主目录或包含主目录的文件夹。', disk: '不能选择整盘。', system: '不能选择系统目录。', folder_taken: '该文件夹已绑定其他项目，请更换。', picker_unavailable: '无法打开系统文件夹选择窗口。可重试或使用当前会话文件夹。', busy: '任务、未同步内容或暂停交付正在占用目录，请稍后重试。', authorization_write: '本机授权保存失败，请重试。', authorization_busy: '其他会话正在保存授权，请重试。', not_found: '项目不可访问，请重新打开设置。', forbidden: '你没有此空间的创建权限。', offline: '云端暂时不可用，请重试。', signed_out: '账号已退出，请重新登录。', stopping: '任务仍在停止，请稍后重试。', failed: '操作失败，请重试。' } as Record<string, string> },
  en: { updates: 'Updates', alpha: 'Receive Alpha updates', hint: 'Alpha versions carry higher risk. Not recommended for everyday use.', saving: 'Saving…', saved: 'Saved', saveFailed: 'Could not save. Your setting has not changed.', title: 'Local settings', upgrade: 'Reopen the plugin', upgradeHow: 'Close the older WildCrane plugins on this computer, then reopen settings.', projects: 'Project folders', add: 'Add project', new: '+ New project…', tools: 'AI tools', recheck: 'Check again', out: 'Sign out', connected: 'Connected', offline: 'Cloud unavailable. Try again.', empty: 'No project folders yet', remove: 'Unbind', removeAsk: 'New tasks will stop using this folder. The project, tasks and source files stay.', cancel: 'Cancel', confirm: 'Unbind folder', bindTitle: 'Bind existing project', newTitle: 'New project', project: 'Project', workspace: 'Workspace', chooseWorkspace: 'Choose workspace', name: 'Project name', folder: 'Project folder', folderHint: 'Binding selects a task folder; it does not restrict AI tools from accessing other files.', choose: 'Choose folder', current: 'Use current session folder', change: 'Change', create: 'Create project', bind: 'Bind folder', signIn: 'Sign in to WildCrane', signing: 'Waiting for browser sign-in…', signFailed: 'Sign-in did not finish. Try again.', outTitle: 'Sign out?', outAsk: 'Tasks on this computer will stop.', closed: 'Settings disconnected', reopen: 'Reopen WildCrane settings from Claude Code, Codex or the terminal.', ready: 'Ready', notInstalled: 'Not installed', signedOut: 'Signed out', detecting: 'Checking…', retry: 'Try again', noComputer: 'Disconnected', copy: 'Copy path', close: 'Close', errors: { missing: 'Folder not found. Choose again.', home: 'Choose a folder outside your home directory root.', disk: 'A whole disk cannot be a project.', system: 'Choose a folder outside system directories.', folder_taken: 'This folder belongs to another project. Choose another.', picker_unavailable: 'The system folder picker is unavailable. Try again or use the current session folder.', busy: 'A task, unsent work or paused delivery holds this folder. Try again later.', authorization_write: 'Could not save local permission. Try again.', authorization_busy: 'Another session is saving permissions. Try again.', not_found: 'Project unavailable. Reopen settings.', forbidden: 'You cannot create projects in this workspace.', offline: 'Cloud unavailable. Try again.', signed_out: 'Signed out. Sign in again.', stopping: 'Tasks are still stopping. Try again shortly.', failed: 'Something went wrong. Try again.' } as Record<string, string> },
}
type Lang = keyof typeof words
type Words = (typeof words)[Lang]

interface Project { project: string; name: string; path?: string; workspace?: string; workspace_name?: string; missing?: boolean }
interface State {
  machine?: string; upgrade?: boolean; signedIn?: boolean; signing?: { failed?: boolean; url?: string }
  account?: { id?: string; name?: string; email?: string }; connected?: boolean; error?: string
  projects?: Project[]; elsewhere?: Project[]; workspaces?: { id: string; name: string; role?: string }[]
  context?: { project?: string; path?: string }; acceptAlphaUpdates?: boolean
}
interface Tool { name: string; label: string; state: string }
type Result = Record<string, any> & { error?: string }

let csrf = ''
let onExpired = () => {}
async function api(action: string, body: Record<string, unknown> = {}): Promise<Result> {
  const response = await fetch('/api/' + action, { method: 'POST', headers: { 'content-type': 'application/json', 'x-settings-csrf': csrf }, body: JSON.stringify(body) })
  if (response.status === 403) { onExpired(); throw Error('expired') }
  return response.json()
}

const SECTION = 'rounded-[12px] border border-nb-ink/12 bg-nb-paper'
const H2 = 'text-[14px] font-[700]'
const ERROR = 'whitespace-pre-line text-[12px] text-nb-accent-deep'
const byWorkspace = (list: Project[] = []) => {
  const groups = new Map<string, Project[]>()
  for (const p of list) groups.set(p.workspace_name ?? '', [...(groups.get(p.workspace_name ?? '') ?? []), p])
  return groups
}

function App() {
  const [lang, setLang] = useState<Lang>(navigator.language.startsWith('zh') ? 'zh' : 'en')
  const t = words[lang]
  const message = (code?: string) => t.errors[code ?? ''] ?? t.errors.failed
  const [state, setState] = useState<State>({})
  const [tools, setTools] = useState<Tool[] | null>(null)
  const [disconnected, setDisconnected] = useState(false)
  const [pageError, setPageError] = useState('')
  const [updateStatus, setUpdateStatus] = useState('')
  const [updateWanted, setUpdateWanted] = useState(false)
  const [dialog, setDialog] = useState<{ project: Project | null } | null>(null)
  const [open, setOpen] = useState(0)
  const stateRef = useRef(state)
  stateRef.current = state
  const live = useRef({ refreshing: false, disconnected: false, saving: false, open: 0, dialog: false, tools: null as Tool[] | null })
  live.current = { ...live.current, disconnected, saving: updateStatus === 'saving', open, dialog: !!dialog, tools }
  onExpired = () => setDisconnected(true)
  const opened = (value: boolean) => setOpen((n) => n + (value ? 1 : -1))

  const checkTools = useCallback(async () => {
    setTools(null)
    try {
      const found = await api('connections')
      if (found.error) setPageError(message(found.error))
      else setTools(found.connections)
    } catch { setPageError(t.offline) }
  }, [t])

  const refresh = useCallback(async () => {
    const now = live.current
    if (now.refreshing || now.disconnected || now.saving) return
    now.refreshing = true
    try {
      const next = (await api('state')) as State
      const prev = stateRef.current
      let tools = live.current.tools
      if (next.error && next.account?.id === prev.account?.id) stateRef.current = { ...prev, ...next }
      else {
        if (next.account?.id !== prev.account?.id) { tools = null; setTools(null) }
        stateRef.current = next
      }
      setState(stateRef.current)
      if (stateRef.current.signedIn && !tools) void checkTools()
    } catch { setDisconnected(true) } finally { live.current.refreshing = false }
  }, [checkTools])

  useEffect(() => {
    void (async () => {
      const ticket = location.hash.slice(1)
      history.replaceState(null, '', '/')
      try {
        if (!ticket) {
          csrf = sessionStorage.getItem('wc_settings_csrf') || ''
          if (!csrf) throw Error('expired')
          return await refresh()
        }
        const response = await fetch('/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ticket }) })
        const session = await response.json()
        if (!response.ok) throw Error('expired')
        csrf = session.csrf
        sessionStorage.setItem('wc_settings_csrf', csrf)
        await refresh()
        const context = stateRef.current.context?.project
        const project = (stateRef.current.elsewhere ?? []).find((p) => p.project === context)
        if (project) setDialog({ project })
      } catch { setDisconnected(true) }
    })()
    // Refresh pauses while a menu, popover or dialog is open so it never redraws one away.
    const timer = setInterval(() => {
      const now = live.current
      if (document.visibilityState === 'visible' && !now.open && !now.dialog && !busy.current) void refresh()
    }, 3000)
    const visible = () => document.visibilityState === 'visible' && void refresh()
    document.addEventListener('visibilitychange', visible)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', visible) }
  }, [])

  useEffect(() => { document.documentElement.lang = lang }, [lang])

  async function saveUpdates(value: boolean) {
    if (updateStatus === 'saving') return
    setUpdateWanted(value)
    setUpdateStatus('saving')
    try {
      const result = await api('updates', { acceptAlphaUpdates: value })
      if (typeof result.acceptAlphaUpdates === 'boolean') setState((s) => (stateRef.current = { ...s, acceptAlphaUpdates: result.acceptAlphaUpdates }))
      setUpdateStatus(result.error ? 'failed' : 'saved')
    } catch { setUpdateStatus('failed') }
  }

  const header = (
    <header className="flex h-14 items-center justify-between border-b border-nb-ink/10 bg-nb-paper px-8 max-sm:px-4">
      <div className="flex items-center gap-1.5" dangerouslySetInnerHTML={{ __html: BRAND }} />
      <Select value={lang} onValueChange={(v) => setLang(v as Lang)} onOpenChange={opened}>
        <SelectTrigger aria-label="语言 / Language" className="h-7 w-auto border-0 px-2 font-[600] hover:bg-nb-ink/[0.06]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="zh">简体中文</SelectItem>
          <SelectItem value="en">English</SelectItem>
        </SelectContent>
      </Select>
    </header>
  )
  const page = (body: React.ReactNode) => (
    <div className="min-h-screen bg-nb-cream font-sans text-[13px] leading-normal text-nb-ink">
      {header}
      <main className="mx-auto max-w-[800px] px-8 pb-12 pt-10 max-sm:px-5 max-sm:pt-7">{body}</main>
    </div>
  )
  if (disconnected) return page(<><h1 className="text-[22px] font-[800] tracking-[-0.02em]">{t.closed}</h1><p className="mt-1 text-nb-ink-soft">{t.reopen}</p></>)

  const title = (
    <div className="mb-7 flex items-baseline gap-3">
      <h1 className="text-[22px] font-[800] tracking-[-0.02em]">{t.title}</h1>
      <span className="text-[12.5px] text-nb-ink-soft">{state.machine ?? ''}</span>
    </div>
  )
  if (state.upgrade) return page(<>{title}<h2 className={H2}>{t.upgrade}</h2><p className="mt-1 text-nb-ink-soft">{t.upgradeHow}</p></>)

  const updates = (
    <section className="mt-8">
      <h2 className={cn(H2, 'mb-3')}>{t.updates}</h2>
      <div className={cn(SECTION, 'flex items-start gap-3 p-4')}>
        <Switch
          id="alpha"
          className="mt-0.5"
          aria-describedby="alpha-hint"
          checked={updateStatus === 'saving' ? updateWanted : state.acceptAlphaUpdates === true}
          disabled={updateStatus === 'saving'}
          onCheckedChange={(v) => void saveUpdates(v)}
        />
        <div>
          <Label htmlFor="alpha" className="cursor-pointer text-[13px]">{t.alpha}</Label>
          <p id="alpha-hint" className="mt-0.5 text-[12px] text-nb-ink-soft">{t.hint}</p>
          {updateStatus && (
            <p role={updateStatus === 'failed' ? 'alert' : 'status'} className={cn('mt-2 text-[12px]', updateStatus === 'failed' ? 'text-nb-accent-deep' : 'text-nb-ink-soft')}>
              {updateStatus === 'failed' ? t.saveFailed : t[updateStatus as 'saving' | 'saved']}
              {updateStatus === 'failed' && <Button variant="link" size="inline" className="ml-2.5 text-[12px]" onClick={() => void saveUpdates(updateWanted)}>{t.retry}</Button>}
            </p>
          )}
        </div>
      </div>
    </section>
  )

  if (!state.signedIn) {
    return page(<>
      {title}
      <section className="mt-8">
        {state.signing && !state.signing.failed ? <>
          <p>{t.signing}</p>
          {state.signing.url && <a className="my-2.5 inline-block underline" href={state.signing.url} rel="noreferrer" target="_blank">{t.signIn}</a>}
        </> : <>
          {state.signing?.failed && <p className={cn(ERROR, 'mb-3')}>{t.signFailed}</p>}
          <Button variant="accent" onClick={async () => { try { await api('signIn'); await refresh() } catch { setPageError(t.offline) } }}>{t.signIn}</Button>
        </>}
        {pageError && <p className={cn(ERROR, 'mt-3')}>{pageError}</p>}
      </section>
      {updates}
    </>)
  }

  const account = state.account ?? {}
  const named = account.name && account.name !== account.email
  return page(<>
    {title}
    <section className={cn(SECTION, 'p-4')}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-[14px] font-[700]">{named ? account.name : account.email}</span>
            {named && account.email && <span className="truncate text-[12.5px] text-nb-ink-soft">{account.email}</span>}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-nb-ink-soft">
            <span className={cn('size-1.5 rounded-full', state.connected ? 'bg-nb-mint' : 'bg-nb-ink/25')} />
            <FiMonitor size={12} /> {state.connected ? t.connected : t.noComputer}
          </div>
        </div>
        <SignOut t={t} state={state} message={message} onOpenChange={opened} onDone={async () => { setTools(null); await refresh() }} />
      </div>
    </section>

    {(state.error || pageError) && (
      <div className={cn(ERROR, 'mt-4 flex items-center gap-2.5')}>
        <span>{pageError || message(state.error)}</span>
        <Button variant="link" size="inline" className="text-[12px]" onClick={() => { setPageError(''); void refresh() }}>{t.retry}</Button>
      </div>
    )}

    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className={H2}>{t.projects}</h2>
        <DropdownMenu modal={false} onOpenChange={opened}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-nb-accent-deep">{t.add} <FiChevronDown size={12} /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[260px]">
            {[...byWorkspace(state.elsewhere)].map(([name, projects]) => (
              <div key={name} role="group">
                <DropdownMenuLabel>{name}</DropdownMenuLabel>
                {projects.map((p) => (
                  <DropdownMenuItem key={p.project} onSelect={() => setDialog({ project: p })}><span className="truncate">{p.name}</span></DropdownMenuItem>
                ))}
              </div>
            ))}
            {!!state.elsewhere?.length && <DropdownMenuSeparator />}
            <DropdownMenuItem className="text-nb-accent-deep" onSelect={() => setDialog({ project: null })}>{t.new}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {!state.projects?.length && <p className="py-4 text-nb-ink-soft">{t.empty}</p>}
      <div className="flex flex-col gap-2">
        {[...byWorkspace(state.projects).values()].flat().map((p) => (
          <ProjectRow key={p.project} p={p} t={t} message={message} onOpenChange={opened} onRemoved={refresh} />
        ))}
      </div>
    </section>

    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className={H2}>{t.tools}</h2>
        <Button variant="ghost" size="sm" onClick={() => void checkTools()}><FiRefreshCw size={12} /> {t.recheck}</Button>
      </div>
      <div className={cn(SECTION, 'px-4')}>
        {!tools && <p className="py-3 text-nb-ink-soft">{t.detecting}</p>}
        {tools?.filter((tool) => ['claude-code', 'codex', 'opencode'].includes(tool.name) || tool.state !== 'notInstalled').map((tool, i) => (
          <div key={tool.name} className={cn('flex items-center gap-3 py-3', i > 0 && 'border-t border-nb-ink/10')}>
            <span className="inline-flex size-5 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: MARKS[tool.name] ?? '' }} />
            <span className="flex-1 text-[13px] font-[700]">{tool.label}</span>
            <span className={cn('text-[12px]', tool.state === 'ready' ? 'text-nb-mint-ink' : 'text-nb-ink-soft')}>{(t as Record<string, unknown>)[tool.state] as string ?? tool.state}</span>
          </div>
        ))}
      </div>
    </section>

    {updates}

    {dialog && (
      <ProjectDialog
        key={dialog.project?.project ?? 'new'}
        project={dialog.project}
        state={state}
        t={t}
        message={message}
        onClose={() => { setDialog(null); void api('cancel').catch(() => {}) }}
        onDone={async () => { setDialog(null); void api('cancel').catch(() => {}); await refresh() }}
      />
    )}
  </>)
}

// One request at a time, as the page always allowed.
const busy = { current: false }
async function once(run: () => Promise<void>) {
  if (busy.current) return
  busy.current = true
  try { await run() } finally { busy.current = false }
}

function SignOut({ t, state, message, onOpenChange, onDone }: { t: Words; state: State; message: (c?: string) => string; onOpenChange: (open: boolean) => void; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const change = (value: boolean) => { setOpen(value); setError(''); onOpenChange(value); if (!value) void api('cancel').catch(() => {}) }
  return (
    <AlertDialog open={open} onOpenChange={change}>
      <AlertDialogTrigger asChild><Button variant="ghost" size="sm">{t.out}</Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>{t.outTitle}</AlertDialogTitle>
        <p className="mt-3 text-[13px]">{[state.account?.email || state.account?.name, state.machine].filter(Boolean).join(' · ')}</p>
        <AlertDialogDescription>{t.outAsk}</AlertDialogDescription>
        {error && <p className={cn(ERROR, 'mt-3')}>{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
          <AlertDialogAction onClick={(e) => {
            e.preventDefault()
            void once(async () => {
              try {
                const r = await api('signOut')
                if (r.error) setError(message(r.error))
                else { change(false); await onDone() }
              } catch { setError(t.offline) }
            })
          }}>{t.out}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ProjectRow({ p, t, message, onOpenChange, onRemoved }: { p: Project; t: Words; message: (c?: string) => string; onOpenChange: (open: boolean) => void; onRemoved: () => Promise<void> }) {
  const [copied, setCopied] = useState('')
  const [error, setError] = useState('')
  return (
    <div className={cn(SECTION, 'flex items-center gap-3 p-4')}>
      <FiFolder size={16} className="shrink-0 text-nb-ink-soft" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2"><span className="text-[13px] font-[700]">{p.name}</span><span className="text-[12.5px] text-nb-ink-soft">{p.workspace_name}</span></div>
        <div className="mt-1 flex items-center gap-1.5 text-[12px] text-nb-ink-soft">
          <span className="break-all">{p.path}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t.copy} onClick={async () => { try { await navigator.clipboard.writeText(p.path ?? ''); setCopied('✓') } catch { setCopied('!') } }}>
                {copied || <FiCopy size={12} />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.copy}</TooltipContent>
          </Tooltip>
        </div>
        {p.missing && <p className={cn(ERROR, 'mt-1')}>{message('missing')}</p>}
      </div>
      <Popover onOpenChange={(v) => { setError(''); onOpenChange(v) }}>
        <PopoverTrigger asChild><Button variant="ghost" size="sm" className="text-[12px] text-nb-ink-soft">{t.remove}</Button></PopoverTrigger>
        <PopoverContent align="end" aria-label={t.remove}>
          <p>{t.removeAsk}</p>
          {error && <p className={cn(ERROR, 'mt-3')}>{error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <PopoverClose asChild><Button>{t.cancel}</Button></PopoverClose>
            <Button variant="accent" onClick={() => void once(async () => {
              try {
                const result = await api('remove', { project: p.project })
                if (result.error) setError(message(result.error))
                else await onRemoved()
              } catch { setError(t.offline) }
            })}>{t.confirm}</Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function ProjectDialog({ project, state, t, message, onClose, onDone }: { project: Project | null; state: State; t: Words; message: (c?: string) => string; onClose: () => void; onDone: () => Promise<void> }) {
  const context = [...(state.projects ?? []), ...(state.elsewhere ?? [])].find((p) => p.project === state.context?.project)
  const [workspace, setWorkspace] = useState(context?.workspace ?? '')
  const [name, setName] = useState('')
  const [edited, setEdited] = useState(false)
  const [picked, setPicked] = useState<{ name: string; path: string } | null>(null)
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  const retry = useRef(project?.project)
  const run = (work: () => Promise<void>) => once(async () => { setWorking(true); try { await work() } finally { setWorking(false) } })
  const pick = (current: boolean) => run(async () => {
    setError('')
    try {
      const result = await api('pick', { current })
      if (result.error) setError(message(result.error))
      else if (!result.cancelled) { setPicked(result as { name: string; path: string }); if (!edited) setName(result.name) }
    } catch { setError(t.offline) }
  })
  const submit = () => run(async () => {
    try {
      const result = await api('bind', { project: retry.current, name, workspace })
      if (result.project) retry.current = result.project
      if (result.error) setError(message(result.error))
      else await onDone()
    } catch { setError(t.offline) }
  })
  const label = 'mb-1.5 mt-5'
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent closeLabel={t.close} aria-describedby={undefined}>
        <DialogTitle>{project ? t.bindTitle : t.newTitle}</DialogTitle>
        {project ? <>
          <Label className={label}>{t.project}</Label>
          <p>{(project.workspace_name ?? '') + ' / ' + project.name}</p>
        </> : <>
          <Label className={label} id="workspace-label">{t.workspace}</Label>
          <Select value={workspace} onValueChange={setWorkspace}>
            <SelectTrigger aria-labelledby="workspace-label"><SelectValue placeholder={t.chooseWorkspace} /></SelectTrigger>
            <SelectContent>
              {(state.workspaces ?? []).filter((ws) => ws.role !== 'viewer').map((ws) => <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Label className={label} htmlFor="project-name">{t.name}</Label>
          <Input id="project-name" maxLength={200} value={name} onChange={(e) => { setEdited(true); setName(e.target.value) }} />
        </>}
        <Label className={label}>
          {t.folder}
          <Tooltip>
            <TooltipTrigger asChild><span tabIndex={0} aria-label={t.folderHint} className="inline-flex text-nb-ink-soft"><FiInfo size={12} /></span></TooltipTrigger>
            <TooltipContent>{t.folderHint}</TooltipContent>
          </Tooltip>
        </Label>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            {picked && <><div className="truncate text-[13px] font-[700]">{picked.name}</div><div className="break-all text-[12px] text-nb-ink-soft">{picked.path}</div></>}
          </div>
          <Button disabled={working} onClick={() => void pick(false)}>{picked ? t.change : t.choose}</Button>
        </div>
        {state.context?.path && <Button variant="link" size="inline" className="mt-3" disabled={working} onClick={() => void pick(true)}>{t.current}</Button>}
        {error && <p className={cn(ERROR, 'mt-3')}>{error}</p>}
        <DialogFooter>
          <DialogClose asChild><Button>{t.cancel}</Button></DialogClose>
          <Button variant="accent" disabled={!picked || working || (!project && (!name.trim() || !workspace))} onClick={() => void submit()}>{project ? t.bind : t.create}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const style = document.createElement('style')
style.textContent = css
document.head.append(style)
// Keyboard focus shows the ring; a click hides it (as web/src/main.tsx does).
addEventListener('pointerdown', () => document.documentElement.setAttribute('data-pointer', ''), true)
addEventListener('keydown', (e) => !e.metaKey && !e.ctrlKey && !e.altKey && document.documentElement.removeAttribute('data-pointer'), true)
createRoot(document.querySelector('#app')!).render(<TooltipProvider delayDuration={300}><App /></TooltipProvider>)
