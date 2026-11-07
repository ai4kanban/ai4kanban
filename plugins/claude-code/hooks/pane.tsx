// The panel's tree, one for the terminal and Claude Desktop: each host draws the same elements
// its own way. Only the logo differs: an Svg on Desktop, an Image (or its alt text) in a terminal.

import type { ElementTable, RenderElement } from 'claude-code'

import type { Status, Tab, TaskRow } from '../types'
import { UPDATE_COMMANDS, copyFor } from './copy'
import { LOGO_MARK, markOf } from './logo'

export interface View {
  lang: 'zh' | 'en'
  tab: Tab
  session: string
  status: Status | null
  tasks: TaskRow[] | null
  stopping: string[]
  stopFailed: string[]
  synced: boolean
  root: string
}

export interface Handlers {
  settings(): void
  tab(tab: Tab): void
  stopTask(row: TaskRow): void
}

export type Surface =
  | { surface: 'terminal'; ui: ElementTable<'terminal'> }
  | { surface: 'desktop'; ui: ElementTable<'desktop'> }
  | { surface: 'vscode'; ui: ElementTable<'vscode'> }
  | { surface: 'mobile'; ui: ElementTable<'mobile'> }

const TABS: Tab[] = ['projects', 'tasks']

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
  const header = (
    <Box flexDirection="row" gap={1}>
      {logo}
      <Text bold>WildCrane</Text>
      {status?.plugin?.version ? <Text dimColor>{`v${status.plugin.version}`}</Text> : null}
      <Box flexGrow={1} />
      <Button key="settings" plain label={v.lang === 'zh' ? '运行电脑设置 ↗' : 'Computer settings ↗'} onPress={() => act.settings()} />
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

  if (!status.signedIn) return <Box flexDirection="column" gap={1}>{header}{upgrade}<Text dimColor>{v.lang === 'zh' ? '在运行电脑设置中登录 WildCrane。' : 'Sign in through computer settings.'}</Text></Box>

  const nav = (
    <Box flexDirection="row" gap={desk ? 2 : 3}>
      {TABS.map((t, i) => (
        <Button key={`tab-${t}`} plain hotkey={desk ? undefined : String(i + 1)} label={c.nav[t]} dimColor={t !== v.tab} onPress={() => act.tab(t)} />
      ))}
    </Box>
  )

  const projects = () => (
    <Box flexDirection="column" gap={1}>
      {(status.projects ?? []).map((p) => (
        <Box key={`prj-${p.project}`} flexDirection="row" gap={2}>
          <Text bold>{p.name}</Text>
          <Box flexGrow={1} />
          <Link href={p.board} label={`${c.board} ↗`} />
        </Box>
      ))}
    </Box>
  )

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

  const body = v.tab === 'tasks' ? tasks() : projects()
  return (
    <Box flexDirection="column" gap={1}>
      {header}
      {upgrade}
      {nav}
      {body}
    </Box>
  )
}
