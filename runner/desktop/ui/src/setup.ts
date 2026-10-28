// The first-run window: one thing per screen. Sign in, then notifications, then it closes and
// the menu bar icon says where WildCrane lives.

import type { Bridge, Runner } from './bridge'
import { CRANE, ICONS, draw, h, icon } from './dom'
import type { Text } from './text'

type Notify = 'ask' | 'asking' | 'denied'

export type Redraw = (event?: { type: string; state?: unknown }) => void

export function setup(bridge: Bridge, root: HTMLElement, state: Runner, text: () => Text): Redraw {
  let notify: Notify = 'ask'
  let copied = false
  let finishing = false

  const signedIn = () => !!state.account || state.signin?.state === 'done'

  const finish = () => {
    if (finishing) return
    finishing = true
    bridge.finishSetup()
  }

  // Signed in with notifications already on (a sign-in after a sign-out): nothing left to ask.
  const afterSignIn = async () => {
    const now = await bridge.notifications()
    if (now.on) finish()
  }

  const progress = (at: number) =>
    h('div', { class: 'steps' }, text().steps.map((name, i) =>
      h('span', { class: i === at ? 'step now' : i < at ? 'step done' : 'step' }, h('b', {}, i < at ? '✓' : String(i + 1)), name),
    ))

  const hero = (art: HTMLElement, title: string, sub: string, tone?: 'error') =>
    [h('div', { class: `art${tone ? ` ${tone}` : ''}` }, art), h('h1', {}, title), h('p', { class: tone ? 'sub error' : 'sub' }, sub)]

  const signInScreen = () => {
    const t = text()
    const s = state.signin?.state
    if (s === 'waiting') {
      return frame(0, [...hero(h('span', { class: 'spinner' }), t.waiting, t.waitingSub),
        h('div', { class: 'actions' }, h('button', { class: 'secondary', onclick: () => bridge.send({ cmd: 'cancelSignIn' }) }, t.cancel))],
      h('button', {
        class: 'link',
        onclick: async () => {
          await navigator.clipboard.writeText(state.signin?.url ?? '')
          copied = true
          render()
        },
      }, copied ? t.copied : t.copyLink))
    }
    if (s === 'failed') {
      return frame(0, [...hero(h('span', { class: 'bang' }, '!'), t.failed, t.failedWhy[state.signin?.why ?? ''] ?? t.failedWhy.other!, 'error'),
        h('div', { class: 'actions' }, h('button', { class: 'primary', onclick: () => bridge.send({ cmd: 'signIn' }) }, t.retry))])
    }
    return frame(0, [...hero(icon(CRANE, 'crane'), t.welcome, t.welcomeSub),
      h('div', { class: 'actions' }, h('button', { class: 'primary', onclick: () => bridge.send({ cmd: 'signIn' }) }, t.signIn))])
  }

  const notifyScreen = () => {
    const t = text()
    if (notify === 'denied') {
      return frame(1, [...hero(icon(ICONS.bellOff, 'bell-off'), t.denied, t.deniedSub),
        h('div', { class: 'actions' }, h('button', { class: 'primary', onclick: () => bridge.openNotificationSettings() }, t.openSettings))],
      h('button', { class: 'link', onclick: finish }, t.goOn))
    }
    return frame(1, [
      h('div', { class: 'corner' }, h('div', { class: 'bar' }, h('i'), h('i'), h('i')),
        h('div', { class: 'sample' }, icon(CRANE, 'sample-icon'), h('div', {}, h('b', {}, t.sampleTitle), h('span', {}, t.sampleBody)))),
      h('h1', { class: 'gap' }, t.notify),
      h('p', { class: 'sub' }, t.notifySub),
      h('div', { class: 'actions' }, h('button', {
        class: 'primary',
        disabled: notify === 'asking',
        onclick: async () => {
          notify = 'asking'
          render()
          const answer = await bridge.enableNotifications()
          if (answer.on) return finish()
          notify = 'denied'
          render()
        },
      }, t.enable)),
    ], h('button', {
      class: 'link',
      onclick: async () => {
        await bridge.disableNotifications()
        finish()
      },
    }, t.notNow))
  }

  const frame = (at: number, body: HTMLElement[], foot?: HTMLElement) =>
    h('div', { class: 'setup' }, progress(at), h('main', {}, body), h('footer', {}, foot))

  const render = () => draw(root, signedIn() ? notifyScreen() : signInScreen())

  if (signedIn()) void afterSignIn()
  return (event) => {
    if (event?.type === 'signin' && event.state === 'done') void afterSignIn()
    if (event?.type === 'signin' && event.state === 'waiting') copied = false
    render()
  }
}

