// The menu bar / tray panel: what needs the user, grouped by project, and settings behind the
// gear. One project, or the one opened last time, skips the cards.

import type { Bridge, Elsewhere, Folder, Item, Notifications, Plan, Runner } from './bridge'
import { CRANE, ICONS, draw, h, icon } from './dom'
import type { Redraw } from './setup'
import { since, type Text } from './text'

type Tab = 0 | 1
type View = { at: 'home' } | { at: 'project'; key: string } | { at: 'settings' | 'add'; from: View }
/** Why a picked folder was refused, and for which existing project. */
type Refused = { why: string; project?: string; taken?: string }

const REMEMBERED = 'wildcrane.project'
/** The group of tasks that belong to no project. */
const LOOSE = ''

const keyOf = (item: Item) => item.project ?? LOOSE

export function panel(bridge: Bridge, root: HTMLElement, state: Runner, text: () => Text): Redraw {
  let tab: Tab = 0
  let view: View = { at: 'home' }
  let refused: Refused | null = null
  /** A pick from the add page: the project, or `''` for a new one, and the folder count before. */
  let placing: { project: string; before: number } | null = null
  let checkoutFailed = false
  let buying = false
  let notifications: Notifications = { on: false, allowed: null }
  let autostart = false
  let version = ''

  const lists = (): [Item[], Item[]] => [state.inbox?.review ?? [], state.inbox?.running ?? []]
  const groups = (items: Item[]) => {
    const by = new Map<string, Item[]>()
    for (const item of items) by.set(keyOf(item), [...(by.get(keyOf(item)) ?? []), item])
    return [...by.entries()].sort(([, a], [, b]) => Date.parse(b[0]!.at) - Date.parse(a[0]!.at))
  }
  const projects = () => new Set([...lists()[0], ...lists()[1]].map(keyOf))
  const nameOf = (key: string) => {
    const item = [...lists()[0], ...lists()[1]].find((i) => keyOf(i) === key)
    return key === LOOSE || !item ? text().none : item.project_name ?? text().none
  }

  const open = (next: View) => {
    view = next
    if (next.at === 'project') localStorage.setItem(REMEMBERED, next.key)
    render()
  }
  const back = () => {
    if (view.at === 'settings' || view.at === 'add') return open(view.from)
    localStorage.removeItem(REMEMBERED)
    open({ at: 'home' })
  }

  /** On every opening: the project from last time, while it still has something; else the cards. */
  const reopen = () => {
    const remembered = localStorage.getItem(REMEMBERED)
    view = remembered !== null && projects().has(remembered) ? { at: 'project', key: remembered } : { at: 'home' }
    refused = null
    render()
  }

  const settingsOpen = async () => {
    open({ at: 'settings', from: view })
    bridge.send({ cmd: 'plan' })
    ;[notifications, autostart, version] = await Promise.all([bridge.notifications(), bridge.autostart(), bridge.version()])
    render()
  }

  // ── the top bar and the tabs ──

  const status = () => {
    const t = text()
    const c = state.connection
    const s = c?.state
    if (s === 'paused') {
      const tip = t.pausedTip(t.holder[c?.holder ?? ''] ?? t.otherHolder)
      return h('span', { class: 'status' }, h('i', { class: 'dot idle' }), t.paused,
        h('span', { class: 'info', tabindex: 0, 'aria-label': tip }, 'i', h('span', { class: 'tip', role: 'tooltip' }, tip)))
    }
    const label = s === 'connected' ? t.connected : s === 'reconnecting' ? t.reconnecting : s === 'connecting' || !s ? t.connecting : t.notConnected
    return h('span', { class: 'status' }, h('i', { class: s === 'connected' ? 'dot on' : 'dot off' }), label)
  }

  /** Connected, or paused behind another WildCrane here: either way the lists are current. */
  const shows = () => state.connection?.state === 'connected' || state.connection?.state === 'paused'

  const backTitle = (label: string) =>
    h('button', { class: 'back', title: text().back, onclick: back }, icon(ICONS.back), h('span', {}, label))

  const top = (title: HTMLElement) =>
    h('header', { class: 'top' }, title, view.at === 'settings' ? null : status(),
      view.at === 'settings' ? null : h('button', { class: 'gear', title: text().settings, onclick: settingsOpen }, icon(ICONS.gear)))

  const tabs = (scope: (items: Item[]) => Item[]) =>
    h('nav', { class: 'tabs' }, text().tabs.map((name, i) => {
      const count = scope(lists()[i]!).length
      return h('button', { class: i === tab ? 'tab now' : 'tab', onclick: () => ((tab = i as Tab), render()) }, name, count ? h('small', {}, count) : null)
    }))

  // ── rows ──

  const row = (item: Item) => {
    const t = text()
    const unread = !!item.alert
    const running = tab === 1
    return h('button', { class: `row${unread ? ' unread' : ''}`, onclick: () => bridge.openUrl(item.url, item.alert) },
      h('span', { class: 'mark' }, running ? h('i', { class: 'spin' }) : unread ? h('i', { class: 'dot new' }) : null),
      h('span', { class: 'title' }, item.title), h('time', {}, since(item.at, t, running ? 'lasted' : 'ago')))
  }

  const card = ([key, items]: [string, Item[]]) => {
    const t = text()
    const latest = items[0]!
    const running = tab === 1
    return h('button', { class: 'card', onclick: () => open({ at: 'project', key }) },
      h('span', { class: 'head' }, h('span', { class: key === LOOSE ? 'name loose' : 'name' }, nameOf(key)), h('small', {}, items.length), icon(ICONS.next, 'chev')),
      h('span', { class: 'latest' },
        h('span', { class: 'mark' }, running ? h('i', { class: 'spin' }) : latest.alert ? h('i', { class: 'dot new' }) : null),
        h('span', { class: latest.alert ? 'title unread' : 'title' }, latest.title),
        h('time', {}, since(latest.at, t, running ? 'lasted' : 'ago'))))
  }

  const blank = (mark: string, title: string, tone: 'ok' | 'wait', sub?: string) =>
    h('div', { class: 'blank' }, h('div', { class: `big ${tone}` }, mark), h('b', {}, title), sub ? h('p', {}, sub) : null)

  const footer = () => h('footer', { class: 'web' }, h('button', { onclick: () => bridge.openUrl(state.hello?.web ?? 'https://app.wildcrane.ai') }, `${text().web} ↗`))

  // ── views ──

  const offline = () => {
    const t = text()
    const c = state.connection
    if (c?.state === 'elsewhere') return blank('⋯', t.elsewhere(c.machine ?? ''), 'wait', t.elsewhereSub)
    if (c?.state === 'refused') return blank('⋯', t.refused, 'wait', t.refusedSub)
    if (c?.state === 'connecting' || !c) return blank('⋯', t.connecting, 'wait')
    return blank('⋯', t.offline, 'wait')
  }

  const home = () => {
    const t = text()
    const connected = shows()
    const all = groups([...lists()[0], ...lists()[1]])
    const single = all.length === 1 ? all[0]![0] : null
    // One project, or none: its list, with nothing to go back to.
    if (connected && single !== null && view.at === 'home') return project(single, false)
    const items = lists()[tab]
    const body = !connected ? offline()
      : items.length === 0 ? blank('✓', t.empty[tab]!, 'ok')
      : h('div', { class: 'list', 'data-keep': `home-${tab}` }, groups(items).map(card))
    return h('div', { class: 'panel' },
      top(h('span', { class: 'brand' }, icon(CRANE, 'crane'), 'WildCrane')),
      connected ? tabs((i) => i) : null,
      h('div', { class: 'body' }, body),
      footer())
  }

  const project = (key: string, canGoBack = true) => {
    const t = text()
    const connected = shows()
    const scope = (items: Item[]) => items.filter((i) => keyOf(i) === key)
    const items = scope(lists()[tab]!)
    const title = canGoBack ? backTitle(nameOf(key)) : h('span', { class: 'brand' }, icon(CRANE, 'crane'), 'WildCrane')
    const body = !connected ? offline()
      : items.length === 0 ? blank('✓', t.empty[tab]!, 'ok')
      : h('div', { class: 'list rows', 'data-keep': `project-${key}-${tab}` }, items.map(row))
    return h('div', { class: 'panel' }, top(title), connected ? tabs(scope) : null, h('div', { class: 'body' }, body), footer())
  }

  const folderRow = (folder: Folder) =>
    h('div', { class: 'item folder' },
      icon(ICONS.folder),
      h('span', { class: folder.notify ? 'grow' : 'grow muted' }, folder.name),
      h('button', { class: 'remove', onclick: () => bridge.send({ cmd: 'removeFolder', project: folder.project }) }, text().remove),
      h('button', {
        class: 'bell',
        title: text().muteTip,
        'aria-pressed': folder.notify ? 'true' : 'false',
        onclick: () => bridge.send({ cmd: 'folderNotify', project: folder.project, on: !folder.notify }),
      }, icon(folder.notify ? ICONS.bell : ICONS.bellOff)))

  const refusedLine = (r: Refused) => {
    const t = text()
    return h('p', { class: 'refused' }, r.why === 'taken' && r.taken ? t.refusedTaken(r.taken) : t.refusedFolder[r.why] ?? t.refusedFolder.failed!)
  }

  const pick = (project?: Elsewhere) => {
    refused = null
    if (view.at === 'add') placing = { project: project?.project ?? '', before: state.folders?.folders.length ?? 0 }
    bridge.pickFolder(project?.project, project ? text().pickFor(project.name) : undefined)
    render()
  }

  const elsewhereRow = (project: Elsewhere) =>
    h('button', { class: 'item', onclick: () => pick(project) },
      icon(ICONS.folder),
      h('span', { class: 'grow' }, project.name),
      h('span', { class: 'hint' }, project.personal ? text().personal : project.workspace_name),
      icon(ICONS.next, 'icon chev'))

  /** A new project from a folder, or one of the account's projects not here yet. */
  const addPage = () => {
    const t = text()
    const others = state.elsewhere?.projects ?? []
    return h('div', { class: 'panel settings' },
      h('header', { class: 'top' }, backTitle(t.add)),
      h('div', { class: 'body scroll', 'data-keep': 'add' },
        h('section', { class: 'group first' },
          h('button', { class: 'item add', onclick: () => pick() }, h('span', { class: 'plus' }, '+'), t.fromFolder),
          refused && !refused.project ? refusedLine(refused) : null),
        others.length ? h('h2', {}, t.others) : null,
        others.length
          ? h('section', { class: 'group' }, others.flatMap((o) => [elsewhereRow(o), refused?.project === o.project ? refusedLine(refused) : null]))
          : null))
  }

  const toggle = (on: boolean, change: (on: boolean) => void, label: string) =>
    h('button', { class: on ? 'switch on' : 'switch', role: 'switch', 'aria-checked': on ? 'true' : 'false', 'aria-label': label, onclick: () => change(!on) }, h('i'))

  const size = (bytes: number) =>
    bytes >= 1024 ** 3 ? `${+(bytes / 1024 ** 3).toFixed(1)} GB` : bytes >= 1024 ** 2 ? `${Math.round(bytes / 1024 ** 2)} MB` : bytes > 0 ? '<1 MB' : '0'

  const meter = (label: string, used: number, limit: number, show: (n: number) => string) =>
    h('div', { class: 'item meter' },
      h('span', { class: 'grow' }, label),
      h('span', { class: 'amount' }, `${show(used)} / ${show(limit)}`),
      h('i', { class: used >= limit ? 'bar full' : 'bar', style: `--used:${Math.min(100, (used / limit) * 100)}%` }))

  const buy = (item: 'pro' | 'storage') => {
    buying = true
    checkoutFailed = false
    bridge.send({ cmd: 'checkout', item })
    render()
  }

  const planGroup = (plan: Plan) => {
    const t = text()
    const action = plan.plan === 'free' ? t.upgrade : plan.paying ? t.buyStorage : null
    return [
      h('h2', {}, t.plan),
      h('section', { class: 'group plan' },
        h('div', { class: 'item' },
          h('b', { class: 'grow' }, t.planName[plan.plan] ?? plan.plan),
          action ? h('button', { class: plan.plan === 'free' ? 'cta' : 'quiet', disabled: buying, onclick: () => buy(plan.plan === 'free' ? 'pro' : 'storage') }, action) : null),
        meter(t.tasksAtOnce, plan.used.tasks, plan.limits.tasks, String),
        meter(t.storage, plan.used.storage, plan.limits.storage, size),
        h('div', { class: 'item' }, h('span', { class: 'grow' }, t.keptFor), h('span', { class: 'amount' }, t.days(plan.limits.retentionDays))),
        h('button', { class: 'item linkish', onclick: () => bridge.openUrl(plan.pricing) }, `${t.allPlans} ↗`),
        checkoutFailed ? h('p', { class: 'refused' }, t.checkoutFailed) : null),
    ]
  }

  const settings = () => {
    const t = text()
    const account = state.account
    const folders = state.folders?.folders ?? []
    const initial = (account?.name || account?.email || '?').trim().charAt(0).toUpperCase()
    return h('div', { class: 'panel settings' },
      h('header', { class: 'top' }, backTitle(t.settings)),
      h('div', { class: 'body scroll', 'data-keep': 'settings' },
        h('section', { class: 'group account' },
          account?.avatar ? h('img', { class: 'avatar', src: account.avatar, alt: '' }) : h('span', { class: 'avatar' }, initial),
          h('span', { class: 'who' }, h('b', {}, account?.name ?? ''), h('small', {}, account?.email ?? '')),
          h('button', { class: 'quiet', onclick: () => bridge.send({ cmd: 'signOut' }) }, t.signOut)),
        h('h2', {}, t.folders),
        h('section', { class: 'group' },
          folders.map(folderRow),
          state.elsewhere?.projects.length
            ? h('button', { class: 'item add', onclick: () => ((refused = null), open({ at: 'add', from: view })) },
                h('span', { class: 'plus' }, '+'), h('span', { class: 'grow' }, t.addFolder), icon(ICONS.next, 'icon chev'))
            : h('button', { class: 'item add', onclick: () => pick() }, h('span', { class: 'plus' }, '+'), t.addFolder),
          refused && !refused.project ? refusedLine(refused) : null),
        ...(state.plan ? planGroup(state.plan) : []),
        h('h2', {}, t.general),
        h('section', { class: 'group' },
          h('div', { class: 'item' }, h('span', { class: 'grow' }, t.notifications), toggle(notifications.on, async (on) => {
            if (on) notifications = await bridge.enableNotifications()
            else {
              await bridge.disableNotifications()
              notifications = { ...notifications, on: false }
            }
            render()
          }, t.notifications)),
          notifications.allowed === false
            ? h('div', { class: 'item hint' }, h('span', { class: 'grow' }, t.denied), h('button', { class: 'linkish', onclick: () => bridge.openNotificationSettings() }, t.openSettings))
            : null,
          h('div', { class: 'item' }, h('span', { class: 'grow' }, t.login), toggle(autostart, async (on) => {
            autostart = await bridge.autostart(on)
            render()
          }, t.login)))),
      h('footer', { class: 'end' }, h('button', { class: 'danger', onclick: () => bridge.quit() }, t.quit), h('small', {}, version ? t.version(version) : '')))
  }

  const render = () => {
    if (view.at === 'project' && !projects().has(view.key)) view = { at: 'home' }
    draw(root, view.at === 'settings' ? settings() : view.at === 'add' ? addPage() : view.at === 'project' ? project(view.key) : home())
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return
    if (view.at === 'home') bridge.hidePanel()
    else back()
  })
  bridge.onShown(reopen)
  reopen()

  return (event) => {
    if (event?.type === 'folderRefused') {
      const { why, project, taken } = event as Partial<Refused>
      refused = { why: why ?? 'failed', project, taken }
      placing = null
    }
    if (event?.type === 'folders') {
      refused = null
      // A folder placed from the add page goes back to settings, where it now shows.
      const folders = state.folders?.folders ?? []
      const done = placing && (placing.project ? folders.some((f) => f.project === placing!.project) : folders.length > placing.before)
      if (done && view.at === 'add') view = view.from
      if (done) placing = null
    }
    if (event?.type === 'checkout' || event?.type === 'plan') buying = false
    if (event?.type === 'checkout') {
      const { url, failed } = event as { url?: string; failed?: boolean }
      checkoutFailed = !!failed
      if (url) bridge.openUrl(url)
    }
    render()
  }
}
