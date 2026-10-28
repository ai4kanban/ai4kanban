// One page for every window; the window's label says which it draws.

import { tauriBridge, type Bridge, type Runner } from './bridge'
import { bubble } from './bubble'
import { panel } from './panel'
import { setup, type Redraw } from './setup'
import { textFor } from './text'

export async function start(bridge: Bridge, root: HTMLElement): Promise<void> {
  const state: Runner = await bridge.snapshot()
  const text = () => textFor(state.hello?.lang ?? navigator.language)
  document.documentElement.lang = text() === textFor('zh') ? 'zh-CN' : 'en'
  document.body.dataset.window = bridge.window
  document.body.dataset.os = /Windows/.test(navigator.userAgent) ? 'windows' : 'mac'

  const redraw: Redraw =
    bridge.window === 'setup' ? setup(bridge, root, state, text)
    : bridge.window === 'bubble' ? bubble(bridge, root, text)
    : panel(bridge, root, state, text)

  bridge.listen((event) => {
    if (event.type !== 'folderRefused' && event.type !== 'notify' && event.type !== 'checkout') (state as Record<string, unknown>)[event.type] = event
    if (event.type === 'signin' && event.state === 'needed') delete state.account
    redraw(event as { type: string; state?: unknown })
  })
  redraw()
}

if ((window as unknown as { __TAURI__?: unknown }).__TAURI__) void start(tauriBridge(), document.getElementById('root')!)
