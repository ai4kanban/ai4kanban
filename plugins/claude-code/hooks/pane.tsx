// The panel's tree, one for the terminal and Claude Desktop: each host draws the same elements
// its own way. Only the logo differs: an Svg on Desktop, an Image (or its alt text) in a terminal.

import type { ElementTable, RenderElement } from 'claude-code'

import type { Adding, Connection, Draft, Idea, Removing, Status, Tab, TaskRow } from '../types'
import { UPDATE_COMMANDS, copyFor } from './copy'
import { LOGO_MARK, markOf } from './logo'

export interface View {
  lang: 'zh' | 'en'
  tab: Tab
  session: string
  status: Status | null
  draft: Draft | null
  open: number
  busy: boolean
  banner: string | null
  connections: Connection[] | null
  tasks: TaskRow[] | null
  stopping: string[]
  stopFailed: string[]
  synced: boolean
  removing: Removing
  adding: Adding
  signingOut: boolean
  root: string
}

export interface Handlers {
  tab(tab: Tab): void
  signIn(): void
  /** Makes this folder a project: a new one, or `project` bound to it. */
  addHere(project?: string): void
  /** Opens or closes the Sign out question. */
  askSignOut(open: boolean): void
  signOut(): void
  show(n: number): void
  workflow(idea: string, workflow: string): void
  discard(idea: string): void
  start(idea: string): void
  retry(): void
  recheck(): void
  /** Opens a project row's unbind question, or says why it cannot be unbound. */
  remove(project: string): void
  confirmRemove(project: string): void
  /** Closes the open question or folder field. */
  cancel(): void
  /** Opens or closes the folder field: `null` for a new project, else binding that one. */
  adding(project: string | null): void
  add(path: string): void
  stopTask(row: TaskRow): void
}

export type Surface =
  | { surface: 'terminal'; ui: ElementTable<'terminal'> }
  | { surface: 'desktop'; ui: ElementTable<'desktop'> }
  | { surface: 'vscode'; ui: ElementTable<'vscode'> }
  | { surface: 'mobile'; ui: ElementTable<'mobile'> }

const TABS: Tab[] = ['ideas', 'projects', 'tasks', 'agents']

/** The CLIs a connection always lists; any other shows once installed. */
const MAIN = ['claude-code', 'codex', 'cursor', 'opencode']

export function Pane(at: Surface, v: View, act: Handlers | null): RenderElement {
  const c = copyFor(v.lang)
  // The phone draws no field yet: the panel is the terminal's and Desktop's.
  if (at.surface === 'mobile' || !act) {
    const { Text } = at.ui
    return <Text dimColor>{c.notHere}</Text>
  }
  const ui = at.ui
  const { Box, Text, Button, Link } = ui
  const desk = at.surface !== 'terminal'
  const status = v.status

  let logo: RenderElement
  if (at.surface === 'terminal') {
    const { Image } = at.ui
    logo = <Image source={{ file: `${v.root}/assets/logo-mark-white.png`, format: 'png' }} columns={2} rows={1} alt="◆" />
  } else {
    const { Svg } = at.ui
    logo = <Svg source={LOGO_MARK} alt="WildCrane" width={18} height={18} />
  }
  const icon = (name: string, label: string) => {
    if (at.surface === 'terminal') return null
    const { Svg } = at.ui
    const svg = markOf(name, name === 'claude-code' ? '#d97757' : 'currentColor')
    return svg ? <Svg source={svg} alt={label} width={16} height={16} /> : null
  }

  const account = status?.signedIn ? status.account?.name || status.account?.email || null : null
  const header = (
    <Box flexDirection="row" gap={1}>
      {logo}
      <Text bold>WildCrane</Text>
      {status?.plugin?.version ? <Text dimColor>{`v${status.plugin.version}`}</Text> : null}
      <Box flexGrow={1} />
      {status?.signedIn && !v.synced ? <Text color="warning">{c.unsynced}</Text> : null}
    </Box>
  )

  if (!status) return <Box>{header}</Box>

  const upgrade =
    status.runner === 'outdated' ? (
      <Box flexDirection="column" paddingX={1} borderStyle="round" borderColor="warning">
        <Text color="warning">{c.outdated}</Text>
        <ui.Code source={UPDATE_COMMANDS} language="sh" />
      </Box>
    ) : status.plugin?.latest ? (
      <Box flexDirection="column" paddingX={1} borderStyle="round" borderDimColor>
        <Text>{c.update(status.plugin.latest)}</Text>
        <ui.Code source={UPDATE_COMMANDS} language="sh" />
      </Box>
    ) : null

  if (!status.signedIn) {
    const signing = status.signing
    return (
      <Box flexDirection="column" gap={1}>
        {header}
        {upgrade}
        <Text>{c.welcome}</Text>
        {status.error === 'offline' ? <Text color="warning">{c.offline}</Text> : null}
        {signing?.failed ? <Text color="warning">{c.signInFailed}</Text> : null}
        {signing && !signing.failed ? (
          <Box flexDirection="column">
            <Text dimColor>{c.signingIn}</Text>
            {signing.url ? <Link href={signing.url} label={c.openSignIn} /> : null}
          </Box>
        ) : (
          <Box flexDirection="row">
            <Button key="sign-in" variant="primary" autoFocus label={c.signIn} onPress={() => act.signIn()} />
          </Box>
        )}
      </Box>
    )
  }

  const confirm = v.signingOut ? (
    <Box flexDirection="column" gap={1} paddingX={1} borderStyle="round" borderColor="warning">
      <Text color="warning">{c.signOutAsk}</Text>
      <Box flexDirection="row" gap={2}>
        <Button key="sign-out-confirm" variant="primary" autoFocus label={c.signOut} onPress={() => act.signOut()} />
        <Button key="sign-out-cancel" label={c.cancel} onPress={() => act.askSignOut(false)} />
      </Box>
    </Box>
  ) : null

  const footer = (
    <Box flexDirection="row" gap={2}>
      <Box flexGrow={1}>{account ? <Text dimColor>{account}</Text> : null}</Box>
      <Button key="sign-out" plain dimColor={!v.signingOut} label={c.signOut} onPress={() => act.askSignOut(!v.signingOut)} />
    </Box>
  )

  const nav = (
    <Box flexDirection="row" gap={desk ? 2 : 3}>
      {TABS.map((t, i) => (
        <Button key={`tab-${t}`} plain hotkey={desk ? undefined : String(i + 1)} label={c.nav[t]} dimColor={t !== v.tab} onPress={() => act.tab(t)} />
      ))}
    </Box>
  )

  const note = (text: string, retry: boolean) => (
    <Box flexDirection="row" gap={1} paddingX={1} borderStyle="round" borderColor="warning">
      <Box flexGrow={1}>
        <Text color="warning">{text}</Text>
      </Box>
      {retry ? <Button key="retry" label={c.retry} onPress={() => act.retry()} /> : null}
    </Box>
  )

  const workflowName = (draft: Draft, id: string) => {
    const w = draft.workflows.find((x) => x.id === id)
    return w ? w.names?.[v.lang] ?? w.name : id
  }

  const row = (idea: Idea, i: number) => (
    <Box key={`row-${idea.id}`} flexDirection="row" gap={2}>
      <Box flexGrow={1}>
        <Button key={`show-${idea.id}`} plain label={`▸ ${idea.title}`} onPress={() => act.show(i)} />
      </Box>
      {idea.task ? <Text color="success">✓ {idea.task.key ?? c.started}</Text> : null}
    </Box>
  )

  const open = (draft: Draft, idea: Idea, notice: RenderElement | null) => {
    const blocked = v.busy || !!v.banner || !v.synced || !status.folder
    const outcome = [idea.outcome, idea.acceptance.length ? `**${c.acceptance}**\n${idea.acceptance.map((a) => `- ${a}`).join('\n')}` : '']
      .filter(Boolean)
      .join('\n\n')
    return (
      <Box key={`idea-${idea.id}`} flexDirection="column" gap={1} paddingX={1} borderStyle="round" borderDimColor>
        <Box flexDirection="row" gap={2}>
          <Box flexGrow={1}>
            <Text bold>{`${draft.ideas.length > 1 ? '▾ ' : ''}${idea.title}`}</Text>
          </Box>
          {idea.task ? null : <Button key={`discard-${idea.id}`} plain label={c.discard} onPress={() => act.discard(idea.id)} />}
        </Box>
        {idea.task ? null : <ui.Markdown key={`md-${idea.id}`} text={outcome} />}
        {notice}
        {idea.task ? (
          <Box flexDirection="row" gap={1}>
            <Text dimColor>{`${c.workflow} · ${workflowName(draft, idea.workflow)}`}</Text>
            <Box flexGrow={1} />
            <Text color="success">✓ {c.started}</Text>
            <Link href={idea.task.url} label={idea.task.key ?? idea.task.id} />
          </Box>
        ) : (
          <Box flexDirection="row" gap={1}>
            <ui.Select
              key={`wf-${idea.id}`}
              label={c.workflow}
              value={idea.workflow}
              options={draft.workflows.map((w) => ({ value: w.id, label: w.names?.[v.lang] ?? w.name }))}
              onSelect={(value: string) => act.workflow(idea.id, value)}
            />
            <Box flexGrow={1} />
            <Button key={`start-${idea.id}`} variant="primary" label={c.start} dimColor={blocked} onPress={() => (blocked ? undefined : act.start(idea.id))} />
          </Box>
        )}
      </Box>
    )
  }

  // This folder is no project yet: a new one, or one of the account's bound to it.
  const notProject = () => {
    const refused = status.refused ? c.refused[status.refused] ?? c.addFailed : null
    const name = status.dir.split(/[\\/]/).filter(Boolean).pop() ?? status.dir
    const bindable = status.elsewhere ?? []
    return (
      <Box flexDirection="column" gap={1}>
        <Text>{c.notProject(status.dir)}</Text>
        {refused ? <Text color="warning">{refused}</Text> : null}
        <Box flexDirection="row">
          <Button key="create-here" variant="primary" autoFocus label={c.createHere(name)} onPress={() => act.addHere()} />
        </Box>
        {bindable.length ? (
          <Box flexDirection="column">
            <Text dimColor>{c.bindHeading}</Text>
            {bindable.map((p) => (
              <Box key={`bindable-${p.project}`} flexDirection="row" gap={2}>
                <Box flexDirection="row" gap={2} flexGrow={1}>
                  <Text bold>{p.name}</Text>
                  {p.personal ? null : <Text dimColor>{p.workspace_name}</Text>}
                </Box>
                <Button key={`bind-here-${p.project}`} label={c.bind} onPress={() => act.addHere(p.project)} />
              </Box>
            ))}
          </Box>
        ) : null}
      </Box>
    )
  }

  const ideas = () => {
    const warn = v.banner ? (c as unknown as Record<string, string>)[v.banner] : v.busy ? c.busy : null
    const notice = warn ? note(warn, v.banner === 'offline') : null
    const setup = status.folder ? null : notProject()
    const draft = v.draft
    if (!draft?.ideas.length) {
      return (
        <Box flexDirection="column" gap={1}>
          {setup}
          {notice}
          {setup ? null : <Text dimColor>{c.empty}</Text>}
        </Box>
      )
    }
    const shown = Math.min(v.open, draft.ideas.length - 1)
    return (
      <Box flexDirection="column" gap={1}>
        {setup}
        {draft.ideas.map((idea, i) => (i === shown ? open(draft, idea, notice) : row(idea, i)))}
      </Box>
    )
  }

  const folderField = (adding: NonNullable<Adding>, label: string) => {
    const error = !adding.error ? null : adding.error === 'taken' && adding.holder ? c.bindTaken(adding.holder) : c.folderRefused[adding.error] ?? c.addFailed
    return (
      <Box flexDirection="column">
        <ui.Input key={`folder-${adding.project ?? 'new'}`} placeholder={c.folderAsk} value={adding.path} submitLabel={label} autoFocus onSubmit={(value: string) => act.add(value)} />
        {error ? <Text color="warning">{error}</Text> : null}
      </Box>
    )
  }

  // One list: this computer's projects, the current one marked, then the account's ones not here.
  const projects = () => {
    const adding = v.adding
    const removing = v.removing
    const elsewhere = status.elsewhere ?? []
    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Box flexDirection="row">
            <Box flexGrow={1} />
            <Button key="new-project" label={`+ ${c.newProject}`} onPress={() => act.adding(null)} />
          </Box>
          {adding && adding.project === null ? folderField(adding, c.create) : null}
        </Box>
        <Box flexDirection="column" gap={desk ? 0 : 1}>
          {(status.projects ?? []).map((p) => {
            const asking = removing?.project === p.project
            return (
              <Box key={`prj-${p.project}`} flexDirection="column">
                <Box flexDirection="row" gap={2}>
                  <Box flexDirection="column" flexGrow={1}>
                    <Box flexDirection="row" gap={1}>
                      <Text bold>{p.name}</Text>
                    </Box>
                    <Box flexDirection="row" gap={1}>
                      {p.project === status.folder?.project ? <Text color="success">{c.current}</Text> : null}
                      {p.project === status.folder?.project ? <Text dimColor>·</Text> : null}
                      <Text dimColor>{p.dir}</Text>
                    </Box>
                  </Box>
                  <Link href={p.board} label={`${c.board} ↗`} />
                  <Button key={`remove-${p.project}`} plain dimColor={!asking} label={c.remove} onPress={() => act.remove(p.project)} />
                </Box>
                {asking && removing?.busy ? <Text color="warning">{c.removeBusy}</Text> : null}
                {asking && !removing?.busy ? (
                  <Box flexDirection="column">
                    <Text color="warning">{c.removeAsk(p.name)}</Text>
                    <Box flexDirection="row" gap={2}>
                      <Button key={`unbind-${p.project}`} variant="primary" autoFocus label={c.remove} onPress={() => act.confirmRemove(p.project)} />
                      <Button key={`keep-${p.project}`} label={c.cancel} onPress={() => act.cancel()} />
                    </Box>
                  </Box>
                ) : null}
              </Box>
            )
          })}
          {elsewhere.map((p) => {
            const open = adding?.project === p.project
            return (
              <Box key={`away-${p.project}`} flexDirection="column">
                <Box flexDirection="row" gap={2}>
                  <Box flexDirection="column" flexGrow={1}>
                    <Box flexDirection="row" gap={1}>
                      <Text bold>{p.name}</Text>
                      {p.personal ? null : <Text dimColor>{p.workspace_name}</Text>}
                    </Box>
                    <Text dimColor>{c.noFolder}</Text>
                  </Box>
                  <Link href={p.board} label={`${c.board} ↗`} />
                  <Button key={`bind-${p.project}`} plain dimColor={!open} label={c.bind} onPress={() => act.adding(p.project)} />
                </Box>
                {open && adding ? folderField(adding, c.bind) : null}
              </Box>
            )
          })}
        </Box>
      </Box>
    )
  }

  const agents = () => {
    if (!v.connections) return <Text dimColor>{c.checking}</Text>
    return (
      <Box flexDirection="column" gap={desk ? 0 : 1}>
        <Text dimColor>{c.agentsIntro}</Text>
        {v.connections
          .filter((x) => MAIN.includes(x.name) || x.state !== 'notInstalled')
          .map((x) => (
            <Box key={`conn-${x.name}`} flexDirection="column">
              <Box flexDirection="row" gap={1}>
                {icon(x.name, x.label)}
                <Box flexGrow={1}>
                  <Text bold>{x.label}</Text>
                </Box>
                <Text color={x.state === 'ready' ? 'success' : 'warning'}>{c[x.state]}</Text>
              </Box>
              {x.command ? (
                <Box flexDirection="column">
                  <Text dimColor>{x.state === 'signedOut' ? c.signedOutHint(x.label) : c.notInstalledHint(x.label)}</Text>
                  <ui.Code source={x.command} language="sh" />
                  <Button key={`recheck-${x.name}`} label={c.recheck} onPress={() => act.recheck()} />
                </Box>
              ) : null}
            </Box>
          ))}
      </Box>
    )
  }

  const tasks = () => {
    if (!v.tasks) return <Text dimColor>{c.checking}</Text>
    if (!v.tasks.length) return <Text dimColor>{c.tasksEmpty}</Text>
    return (
      <Box flexDirection="column" gap={1}>
        <Text dimColor>{c.tasksIntro}</Text>
        {v.tasks.map((t) => {
          const stopping = t.state === 'running' && v.stopping.includes(t.task)
          return (
            <Box key={`task-${t.task}`} flexDirection="column">
              <Box flexDirection="row" gap={2}>
                <Box flexDirection="column" flexGrow={1}>
                  <Text bold>{t.title}</Text>
                  <Text dimColor>{[t.project, t.agent].filter(Boolean).join(' · ')}</Text>
                </Box>
                {stopping ? (
                  <Text color="warning">{c.stopping}</Text>
                ) : t.state === 'running' ? (
                  <Text color="success">{c.running(t.minutes)}</Text>
                ) : (
                  <Text dimColor>{c.queued(t.minutes)}</Text>
                )}
                {t.state === 'running' && t.stop && !stopping ? (
                  <Button key={`stop-${t.task}`} plain dimColor label={c.stop} onPress={() => act.stopTask(t)} />
                ) : null}
                <Link href={t.url} label={c.open} />
              </Box>
              {v.stopFailed.includes(t.task) ? <Text color="warning">{c.stopFailed}</Text> : null}
            </Box>
          )
        })}
      </Box>
    )
  }

  const body = v.tab === 'ideas' ? ideas() : v.tab === 'projects' ? projects() : v.tab === 'tasks' ? tasks() : agents()
  return (
    <Box flexDirection="column" gap={1}>
      {header}
      {upgrade}
      {nav}
      {body}
      {confirm}
      {footer}
    </Box>
  )
}
