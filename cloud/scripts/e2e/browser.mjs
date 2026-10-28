// A headless Chrome driven over the DevTools protocol: no Playwright in this repo.

import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = createServer().listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
    server.on('error', reject)
  })
}

/** A fresh profile, so no cookie or session leaks in from another browser. */
export async function launchBrowser() {
  const profile = await mkdtemp(join(tmpdir(), 'wc-e2e-chrome-'))
  const port = await freePort()
  const child = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--window-size=1280,900',
    'about:blank',
  ], { stdio: 'ignore' })
  let version
  for (let i = 0; i < 50 && !version; i++) {
    await new Promise((r) => setTimeout(r, 200))
    version = await fetch(`http://127.0.0.1:${port}/json/version`).then((r) => r.json()).catch(() => undefined)
  }
  if (!version) {
    child.kill()
    throw new Error('Chrome did not start')
  }
  return {
    port,
    async page() {
      const target = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
      return await connectPage(target.webSocketDebuggerUrl)
    },
    async close() {
      child.kill()
      await rm(profile, { recursive: true, force: true }).catch(() => {})
    },
  }
}

async function connectPage(url) {
  const socket = new WebSocket(url)
  await new Promise((resolve, reject) => {
    socket.onopen = resolve
    socket.onerror = () => reject(new Error('cannot reach the Chrome page'))
  })
  let next = 0
  const waiting = new Map()
  let send
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data)
    // A leave-this-page prompt or alert would block every later command.
    if (message.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {})
    const pending = waiting.get(message.id)
    if (!pending) return
    waiting.delete(message.id)
    if (message.error) pending.reject(new Error(message.error.message))
    else pending.resolve(message.result)
  }
  send = (method, params = {}, ms = 60_000) =>
    new Promise((resolve, reject) => {
      const id = ++next
      const timer = setTimeout(() => {
        waiting.delete(id)
        reject(new Error(`Chrome did not answer ${method} within ${ms / 1000}s`))
      }, ms)
      waiting.set(id, {
        resolve: (v) => (clearTimeout(timer), resolve(v)),
        reject: (e) => (clearTimeout(timer), reject(e)),
      })
      socket.send(JSON.stringify({ id, method, params }))
    })
  await send('Page.enable')
  await send('Runtime.enable')

  // A script sent while the page navigates can be lost with the old document: try once more.
  const evaluate = async (expression, retry = true) => {
    let result
    try {
      result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, 15_000)
    } catch (error) {
      if (!retry) throw error
      await new Promise((r) => setTimeout(r, 1_000))
      return await evaluate(expression, false)
    }
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? 'page script failed')
    return result.result.value
  }

  return {
    send,
    evaluate,
    /** Runs before any page script, on every navigation: used to plant a session. */
    async beforeLoad(source) {
      await send('Page.addScriptToEvaluateOnNewDocument', { source })
    },
    // Navigates from inside the page: Page.navigate itself sometimes never answers. The old
    // document carries a mark, so a load is only seen once the new one replaced it.
    async goto(target) {
      for (let attempt = 1; ; attempt++) {
        try {
          await evaluate(`window.__wcOld = true; location.href = ${JSON.stringify(target)}`).catch(() => {})
          await waitFor(() => evaluate('!window.__wcOld && document.readyState !== "loading" && !!document.body?.innerText.trim()'), 45_000, `${target} did not load`)
          return
        } catch (error) {
          if (attempt === 2) throw error
        }
      }
    },
    text: () => evaluate('document.body ? document.body.innerText : ""'),
    url: () => evaluate('location.href'),
    /** Clicks the first button or link whose visible text matches. */
    async click(pattern) {
      const source = pattern instanceof RegExp ? pattern.source : pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const flags = pattern instanceof RegExp ? pattern.flags : ''
      const clicked = await evaluate(`(() => {
        const match = new RegExp(${JSON.stringify(source)}, ${JSON.stringify(flags)})
        const el = [...document.querySelectorAll('button, a, [role=button], [role=menuitem], [role=tab]')]
          .find((e) => e.offsetParent !== null && !e.disabled && match.test((e.innerText || e.getAttribute('aria-label') || '').trim()))
        if (!el) return false
        el.click()
        return true
      })()`)
      if (!clicked) throw new Error(`no button matching ${pattern}`)
    },
    /** Types into the field matched by a CSS selector, the way React sees it. */
    async fill(selector, value) {
      const ok = await evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)})
        if (!el) return false
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)})
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
        return true
      })()`)
      if (!ok) throw new Error(`no field ${selector}`)
    },
    async screenshot() {
      const { data } = await send('Page.captureScreenshot', { format: 'png' })
      return Buffer.from(data, 'base64')
    },
    close: () => socket.close(),
  }
}

/** Polls `check` until it returns something truthy; throws `message` after `ms`, or at once
 *  when `check` throws an error marked `fatal`. */
export async function waitFor(check, ms, message, every = 500) {
  const end = Date.now() + ms
  for (;;) {
    const value = await check().catch((error) => {
      if (error.fatal) throw error
    })
    if (value) return value
    if (Date.now() > end) throw new Error(message)
    await new Promise((r) => setTimeout(r, every))
  }
}
