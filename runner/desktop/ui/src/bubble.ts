// Pointing at the menu bar icon once setup is done.

import type { Bridge } from './bridge'
import { draw, h } from './dom'
import type { Redraw } from './setup'
import type { Text } from './text'

export function bubble(bridge: Bridge, root: HTMLElement, text: () => Text): Redraw {
  // A Mac menu bar is above the bubble, a Windows taskbar below it.
  const below = /Windows/.test(navigator.userAgent)
  const render = () => {
    const t = text()
    draw(root, h('div', { class: below ? 'bubble up' : 'bubble' },
      h('b', {}, t.here),
      h('p', {}, t.hereSub),
      h('div', { class: 'end' }, h('button', { onclick: () => bridge.dismissBubble() }, t.gotIt))))
  }
  render()
  return render
}
