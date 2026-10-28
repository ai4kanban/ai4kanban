// A stand-in shell for scripts/preview.mjs: every window in every state, with made-up data.

import type { Bridge, Item, Runner } from '../ui/src/bridge'
import { start } from '../ui/src/app'

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()
const item = (title: string, project: string | null, minutes: number, unread = false): Item => ({
  task: title, title, project, project_name: project, phase: 1, at: ago(minutes), alert: unread ? 'alr' : null, url: '#',
})

const zh = {
  review: [
    item('新增 Pricing 页面', 'acme-site', 3, true),
    item('产品演示视频', null, 8, true),
    item('首页改版', 'acme-site', 12, true),
    item('订阅流程文案', 'landing-page', 20),
    item('移动端导航重做', 'mobile-app', 26),
    item('API 文档补全', 'docs', 41),
    item('页脚链接整理', 'acme-site', 34),
    item('客户案例页', 'acme-site', 52),
  ],
  running: [
    item('修复移动端导航', 'acme-site', 12),
    item('迁移旧数据', 'landing-page', 25),
    item('周报汇总', null, 31),
  ],
}
const en = {
  review: [
    item('Add a pricing page', 'acme-site', 3, true),
    item('Product demo video', null, 8, true),
    item('Homepage redesign', 'acme-site', 12, true),
    item('Subscription flow copy', 'landing-page', 20),
    item('Rework the mobile nav', 'mobile-app', 26),
    item('Fill in the API docs', 'docs', 41),
  ],
  running: [item('Fix the mobile nav', 'acme-site', 12), item('Weekly summary', null, 31)],
}

const params = new URLSearchParams(location.search)
const lang = params.get('lang') ?? 'zh'
const scene = params.get('scene') ?? 'panel'
const inbox = lang === 'zh' ? zh : en

const base: Runner = {
  hello: { lang, web: 'https://wildcrane.ai', version: '0.2.0' },
  account: { name: 'Lin Chen', email: 'lin@acme.dev', avatar: '' },
  connection: { state: 'connected' },
  inbox,
  folders: { folders: [
    { project: 'p1', name: 'acme-site', path: '/Users/lin/acme-site', notify: true },
    { project: 'p2', name: 'landing-page', path: '/Users/lin/landing-page', notify: false },
    { project: 'p3', name: 'docs', path: '/Users/lin/docs', notify: true },
  ] },
  plan: {
    plan: 'free', paying: false, pricing: '#',
    limits: { tasks: 3, storage: 1024 ** 3, file: 100 * 1024 ** 2, retentionDays: 7 },
    used: { tasks: 3, storage: 420 * 1024 ** 2 },
  },
}

const pro: Runner['plan'] = {
  plan: 'pro', paying: true, pricing: '#',
  limits: { tasks: 10, storage: 120 * 1024 ** 3, file: 1024 ** 3, retentionDays: 30 },
  used: { tasks: 4, storage: 31.4 * 1024 ** 3 },
}
const toSettings = (r: HTMLElement) => setTimeout(() => (r.querySelector('.gear') as HTMLElement).click(), 50)

const scenes: Record<string, { window: string; state: Runner; after?: (root: HTMLElement) => void; event?: Record<string, unknown> }> = {
  'sign-in': { window: 'setup', state: { hello: base.hello, signin: { state: 'needed' } } },
  waiting: { window: 'setup', state: { hello: base.hello, signin: { state: 'waiting', url: 'https://x' } } },
  failed: { window: 'setup', state: { hello: base.hello, signin: { state: 'failed', why: 'denied' } } },
  notify: { window: 'setup', state: { hello: base.hello, signin: { state: 'done' } } },
  denied: { window: 'setup', state: { hello: base.hello, signin: { state: 'done' } }, after: (r) => setTimeout(() => (r.querySelector('.primary') as HTMLElement).click(), 50) },
  bubble: { window: 'bubble', state: base },
  panel: { window: 'panel', state: base },
  running: { window: 'panel', state: base, after: (r) => setTimeout(() => (r.querySelectorAll('.tab')[1] as HTMLElement).click(), 50) },
  project: { window: 'panel', state: base, after: (r) => setTimeout(() => (r.querySelector('.card') as HTMLElement).click(), 50) },
  single: { window: 'panel', state: { ...base, inbox: { review: inbox.review.filter((i) => i.project === 'acme-site'), running: [] } } },
  empty: { window: 'panel', state: { ...base, inbox: { review: [], running: [] } } },
  offline: { window: 'panel', state: { ...base, connection: { state: 'reconnecting' } } },
  elsewhere: { window: 'panel', state: { ...base, connection: { state: 'elsewhere', machine: 'MacBook Pro' } } },
  paused: { window: 'panel', state: { ...base, connection: { state: 'paused', holder: 'claude-code' } }, after: (r) => setTimeout(() => (r.querySelector('.info') as HTMLElement).focus(), 50) },
  settings: { window: 'panel', state: base, after: (r) => setTimeout(() => (r.querySelector('.gear') as HTMLElement).click(), 50) },
  plan: { window: 'panel', state: base, after: (r) => {
    toSettings(r)
    setTimeout(() => r.querySelector('.plan')?.scrollIntoView(), 150)
  } },
  'plan-pro': { window: 'panel', state: { ...base, plan: pro }, after: (r) => {
    toSettings(r)
    setTimeout(() => r.querySelector('.plan')?.scrollIntoView(), 150)
  } },
  rejected: { window: 'panel', state: base, after: (r) => setTimeout(() => (r.querySelector('.gear') as HTMLElement).click(), 50), event: { type: 'folderRefused', why: 'home' } },
}

const chosen = scenes[scene]!
let listener: (e: { type: string } & Record<string, unknown>) => void = () => {}
const bridge: Bridge = {
  window: chosen.window,
  version: async () => '0.2.0',
  snapshot: async () => structuredClone(chosen.state),
  listen: (on) => (listener = on),
  send: () => {},
  openUrl: () => {},
  pickFolder: () => {},
  notifications: async () => ({ on: true, allowed: true }),
  enableNotifications: async () => ({ on: scene !== 'denied', allowed: scene !== 'denied' }),
  disableNotifications: async () => {},
  openNotificationSettings: () => {},
  autostart: async () => true,
  finishSetup: () => {},
  dismissBubble: () => {},
  hidePanel: () => {},
  quit: () => {},
  onShown: () => {},
}
const root = document.getElementById('root')!
void start(bridge, root).then(() => {
  chosen.after?.(root)
  if (chosen.event) setTimeout(() => listener(chosen.event as { type: string }), 150)
})
