// The panel's tree, one for the terminal and Claude Desktop: each host draws the same elements
// its own way. Only the logo differs: an Svg on Desktop, an Image (or its alt text) in a terminal.

import type { ElementTable, RenderElement } from 'claude-code'

import type { Chat, Connection, Draft, Idea, Status, Tab } from '../types'
import { ago, copyFor } from './copy'
import { LOGO_MARK, markOf } from './logo'

export interface View {
  lang: 'zh' | 'en'
  tab: Tab
  session: string
  status: Status | null
  draft: Draft | null
  viewing: string | null
  open: number
  busy: boolean
  banner: string | null
  text: string
  chats: Chat[] | null
  connections: Connection[] | null
  synced: boolean
  root: string
}

export interface Handlers {
  tab(tab: Tab): void
  setup(): void
  send(text: string): void
  show(n: number): void
  workflow(idea: string, workflow: string): void
  discard(idea: string): void
  start(idea: string): void
  retry(): void
  openChat(chat: Chat): void
  back(): void
  recheck(): void
}

export type Surface =
  | { surface: 'terminal'; ui: ElementTable<'terminal'> }
  | { surface: 'desktop'; ui: ElementTable<'desktop'> }
  | { surface: 'vscode'; ui: ElementTable<'vscode'> }
  | { surface: 'mobile'; ui: ElementTable<'mobile'> }

const TABS: Tab[] = ['ideas', 'chats', 'projects', 'connections']

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

  const header = (bare?: boolean) => (
    <Box flexDirection="row" gap={1}>
      {logo}
      <Text bold>WildCrane</Text>
      {!bare && status?.folder ? <Text dimColor>{status.folder.name}</Text> : null}
      <Box flexGrow={1} />
      {!bare && status?.folder ? <Text dimColor={v.synced} color={v.synced ? undefined : 'warning'}>{v.synced ? c.synced : c.unsynced}</Text> : null}
    </Box>
  )

  if (!status) return <Box>{header(true)}</Box>

  // Signed out, or this folder not added: one button does what is missing.
  if (!status.signedIn || !status.folder) {
    const signing = status.signing
    const refused = status.refused ? c.refused[status.refused] ?? c.startFailed : null
    return (
      <Box flexDirection="column" gap={1}>
        {header(true)}
        <Box flexDirection="column">
          <Text>{status.dir}</Text>
          <Text dimColor>{c.dirHint}</Text>
        </Box>
        {refused ? <Text color="warning">{refused}</Text> : null}
        {status.error === 'offline' ? <Text color="warning">{c.offline}</Text> : null}
        {signing?.failed ? <Text color="warning">{c.signInFailed}</Text> : null}
        {signing && !signing.failed ? (
          <Box flexDirection="column">
            <Text dimColor>{c.signingIn}</Text>
            {signing.url ? <Link href={signing.url} label={c.openSignIn} /> : null}
          </Box>
        ) : (
          <Button key="setup" variant="primary" autoFocus label={status.signedIn ? c.addDir : c.signInAdd} onPress={() => act.setup()} />
        )}
      </Box>
    )
  }

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
    const blocked = v.busy || !!v.banner || !v.synced
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

  const ideas = () => {
    const warn = v.banner ? (c as unknown as Record<string, string>)[v.banner] : v.busy ? c.busy : null
    const notice = warn ? note(warn, v.banner === 'offline' || v.banner === 'sendFailed') : null
    const input = v.viewing ? (
      <Button key="back" plain label={`← ${c.back}`} onPress={() => act.back()} />
    ) : (
      <ui.Input key="idea" placeholder={c.placeholder} value={v.text} submitLabel={c.send} autoFocus onSubmit={(value: string) => act.send(value)} />
    )
    const draft = v.draft
    if (!draft?.ideas.length) {
      return (
        <Box flexDirection="column" gap={1}>
          {input}
          {notice}
        </Box>
      )
    }
    const shown = Math.min(v.open, draft.ideas.length - 1)
    return (
      <Box flexDirection="column" gap={1}>
        {input}
        {draft.ideas.map((idea, i) => (i === shown ? open(draft, idea, notice) : row(idea, i)))}
      </Box>
    )
  }

  const chats = () => {
    if (!v.chats) return <Text dimColor>…</Text>
    const mine = v.chats.filter((x) => x.session === v.session)
    const past = v.chats.filter((x) => x.session !== v.session)
    const item = (x: Chat) => (
      <Box key={`chat-${x.discussion}`} flexDirection="column">
        <Button key={`open-${x.discussion}`} plain label={x.title || c.ideaCount(0)} onPress={() => act.openChat(x)} />
        <Text dimColor>{`${c.ideaCount(x.ideas)} · ${ago(c, x.at)}`}</Text>
      </Box>
    )
    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text dimColor>{c.thisChat}</Text>
          {mine.length ? mine.map(item) : <Text dimColor>{c.ideaCount(0)}</Text>}
        </Box>
        <Box flexDirection="column" gap={desk ? 0 : 1}>
          <Text dimColor>{c.earlierChats}</Text>
          {past.length ? past.map(item) : <Text dimColor>{c.noChats}</Text>}
        </Box>
      </Box>
    )
  }

  const projects = () => (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text dimColor>{c.thisDir}</Text>
        <Box flexDirection="row" gap={2}>
          <Box flexGrow={1}>
            <Text>{status.dir}</Text>
          </Box>
          <Text color="success">✓ {c.added}</Text>
        </Box>
      </Box>
      <Box flexDirection="column">
        <Text dimColor>{c.addedProjects}</Text>
        {(status.projects ?? []).map((p) => (
          <Box key={`prj-${p.project}`} flexDirection="row" gap={2}>
            <Box flexDirection="column" flexGrow={1}>
              <Text bold>{p.name}</Text>
              <Text dimColor>{p.dir}</Text>
            </Box>
            <Link href={p.board} label={`${c.board} ↗`} />
          </Box>
        ))}
      </Box>
    </Box>
  )

  const connections = () => {
    if (!v.connections) return <Text dimColor>{c.checking}</Text>
    return (
      <Box flexDirection="column" gap={desk ? 0 : 1}>
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

  const body = v.tab === 'ideas' ? ideas() : v.tab === 'chats' ? chats() : v.tab === 'projects' ? projects() : connections()
  return (
    <Box flexDirection="column" gap={1}>
      {header()}
      {nav}
      {body}
    </Box>
  )
}
