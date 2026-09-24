#!/usr/bin/env node
// Record scripted product shots over the Chrome DevTools Protocol, one video file per shot.
//
//   node record.mjs                  every shot the config names, resuming what is unfinished
//   node record.mjs S3 S5            only these shots
//   node record.mjs --force          retake the chosen shots even when they are up to date
//   node record.mjs --list           what the config names, and what is already recorded
//   node record.mjs --init           write starter `record.config.mjs` and `shots/S1.mjs`
//   node record.mjs --json           print the ledger entries this run touched
//
// Runtime: Node 22 or later (global `WebSocket`) with `ffmpeg` and `ffprobe` on PATH. Nothing
// is installed. Save it from the agent with
// `akb raw agent-file hyperframes-assets record.mjs > record.mjs`, and keep it in the project.
//
// You write two kinds of file beside it and nothing else:
//
//   record.config.mjs   the environment — browser address, base URL, viewport, fps, folders
//   shots/<id>.mjs      one shot — how to reset, how to check the starting state, the take
//
// Connecting, the drawn cursor, click rings, typing, frame sampling, retiming, encoding,
// checking and the ledger live here. A rerun edits its own shot file; it never rewrites this.
//
// ---- record.config.mjs -----------------------------------------------------
//
//   export default {
//     browser: 'http://127.0.0.1:9461',   // a Chrome started with --remote-debugging-port
//     baseUrl: 'http://127.0.0.1:4861',   // what `ctx.go('/16')` is relative to
//     viewport: { width: 1440, height: 810, dpr: 2 },
//     fps: 30,                            // the encoded rate; sampling is measured, not assumed
//     ready: 'document.readyState === "complete"',  // when a navigation is done
//     settle: 1200,                       // ms to wait after that, before the cursor goes on
//     shots: 'shots',                     // folder of shot files, one per stable shot ID
//     out: '..',                          // where finished video files land
//     work: '.record',                    // frames, timestamps, temporary files, the ledger
//   }
//
// Every field has the default shown above; a config may set only what differs.
//
// ---- shots/<id>.mjs --------------------------------------------------------
//
//   export default {
//     output: '01-create-goal.mp4',       // the file name, inside `out`
//     inputs: ['fixtures/board.json'],    // extra files whose change invalidates the take
//     expect: { seconds: [6, 12], fps: 20 },  // size defaults to the viewport in real pixels
//     async reset(ctx) { await ctx.go('/') },       // restore the baseline — never recorded
//     async check(ctx) { await ctx.until(...) },    // the starting state — throw to fail
//     async take(ctx) { ... },            // the take; recording spans exactly this function
//   }
//
// `reset` and `check` run outside the recording, so navigation and pane setup belong there.
// Only `take` is filmed. `output`, `inputs` and `expect` are optional; `take` is not.
//
// ---- what a shot is given ---------------------------------------------------
//
//   ctx.go(route)                navigate, wait for `ready`, settle, draw the cursor
//   ctx.ev(expr)                 evaluate an expression in the page and return its value
//   ctx.until(expr, ms)          poll until the expression is truthy, or throw
//   ctx.box(expr)                the element's box — {x, y, w, h, l, t}, centre first
//   ctx.move(x, y, wait)         glide the drawn cursor and the real pointer there
//   ctx.click(x, y, wait)        move, ring, and dispatch a real click
//   ctx.clickEl(expr, wait)      the same, on an element's centre
//   ctx.domClick(expr, wait)     move and ring, then call the element's own `click()`
//   ctx.type(text, delay)        type it a key at a time, the way a person does
//   ctx.byText(text, selector)   an expression for the visible element with that exact text
//   ctx.shot(file)               save a PNG — reference frames for `check` to compare against
//   ctx.cursor()                 redraw the cursor after a navigation the shot made itself
//   ctx.sleep(ms)
//   ctx.mark(seconds)            pin this moment to that time in the finished file
//   ctx.beforeFrame(fn)          run `fn` before every sample — hold a scroll position still
//   ctx.send(method, params)     any CDP call, for whatever this list does not cover
//
// `mark` is how a take whose real pauses differ from the scripted ones still lands on the
// script's timeline: mark the scripted time at each beat and the frames are retimed onto it.
// The start of the take is time zero without being marked. Without any mark the file keeps
// the take's own timing.
//
// ---- what it guarantees ------------------------------------------------------
//
// Frames are kept beside the video with the times they were really taken at, retiming or
// not. Sampling rate is measured over how long the take really ran and reported: an encode
// at 30 fps says nothing about how fast the page was actually sampled, and neither does a
// retimed file, so `expect.fps` is checked against that measured rate alone. A take
// is written to a temporary file and replaces the output only once its checks pass; a failed
// shot leaves the previous file alone and is never recorded as this run's success. A failure
// stops that shot only — the rest still run, each from its own fresh tab.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const VERSION = 1

const DEFAULTS = {
  browser: 'http://127.0.0.1:9461',
  baseUrl: 'http://127.0.0.1:4861',
  viewport: { width: 1440, height: 810, dpr: 2 },
  fps: 30,
  ready: 'document.readyState === "complete"',
  settle: 1200,
  shots: 'shots',
  out: '..',
  work: '.record',
}

const CURSOR = `(()=>{
  if(document.querySelector('#akb-capture-cursor')) return;
  const style=document.createElement('style');
  style.textContent='#akb-capture-cursor{position:fixed;z-index:2147483647;width:17px;height:25px;pointer-events:none;left:0;top:0;transition:left .45s cubic-bezier(.4,0,.2,1),top .45s cubic-bezier(.4,0,.2,1);filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.35))}#akb-capture-cursor svg{display:block;overflow:visible}.akb-click-ring{position:fixed;z-index:2147483646;width:54px;height:54px;border:4px solid #dd4f1e;border-radius:50%;pointer-events:none;transform:translate(-50%,-50%) scale(.35);opacity:1;animation:akb-ring .3s ease-out forwards}@keyframes akb-ring{to{transform:translate(-50%,-50%) scale(1);opacity:0}}';
  document.head.append(style);
  const cursor=document.createElement('div');cursor.id='akb-capture-cursor';
  // The macOS arrow, its tip on (0,0) so it lands on the click; the stroke is drawn under the fill, outside the shape.
  cursor.innerHTML='<svg width="17" height="25" viewBox="0 0 17 25"><path d="M0 0V19L4.4 14.9L7.3 21.6L10.4 20.3L7.6 13.8H13.3Z" fill="#000" stroke="#fff" stroke-width="2" stroke-linejoin="round" paint-order="stroke"/></svg>';
  document.body.append(cursor);
})()`

// ---- odds and ends ---------------------------------------------------------

const round = (n) => Math.round(n * 100) / 100

function die(said, code = 1) {
  process.stderr.write(`record: ${said}\n`)
  process.exit(code)
}

/** `S2` before `S10`, and any other name alphabetically. */
function byShotOrder(a, b) {
  const na = /^S(\d+)$/i.exec(a)
  const nb = /^S(\d+)$/i.exec(b)
  if (na && nb) return Number(na[1]) - Number(nb[1])
  return a.localeCompare(b)
}

const digest = (file) => {
  try {
    return createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 12)
  } catch {
    return null
  }
}

// ---- the arguments ---------------------------------------------------------

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(`--${name}`)
const option = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const chosen = argv.filter((a) => !a.startsWith('-'))

const configPath = path.resolve(option('config') ?? 'record.config.mjs')
const here = path.dirname(configPath)
const rel = (file) => path.relative(here, file) || path.basename(file)

if (flag('help')) {
  const lines = fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1)
  process.stdout.write(`${lines.slice(0, lines.findIndex((l) => !l.startsWith('//'))).join('\n')}\n`)
  process.exit(0)
}

if (flag('init')) {
  scaffold()
  process.exit(0)
}

// ---- the config and the shots ----------------------------------------------

if (!fs.existsSync(configPath)) die(`no ${rel(configPath)} — write one, or run \`node record.mjs --init\``, 2)

const loaded = new Map()

async function load(file) {
  const mod = (await import(`${pathToFileURL(file).href}?v=${Date.now()}`)).default ?? {}
  loaded.set(path.basename(file, '.mjs'), mod)
  return mod
}

const written = await load(configPath)
const config = { ...DEFAULTS, ...written, viewport: { ...DEFAULTS.viewport, ...(written.viewport ?? {}) } }
const shotsDir = path.resolve(here, config.shots)
const outDir = path.resolve(here, config.out)
const workDir = path.resolve(here, config.work)

const available = fs.existsSync(shotsDir)
  ? fs.readdirSync(shotsDir).filter((f) => f.endsWith('.mjs')).map((f) => f.slice(0, -4)).sort(byShotOrder)
  : []
if (!available.length) die(`no shot files in ${rel(shotsDir)} — one \`<id>.mjs\` per shot`, 2)

const unknown = chosen.filter((id) => !available.includes(id))
if (unknown.length) die(`no shot file for ${unknown.map((id) => `\`${id}\``).join(', ')}. This project has: ${available.join(', ')}`, 2)
const wanted = chosen.length ? available.filter((id) => chosen.includes(id)) : available

// ---- the ledger ------------------------------------------------------------

const ledgerPath = path.join(workDir, 'ledger.json')

function readLedger() {
  try {
    const read = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'))
    if (read?.recorder === VERSION && read.shots) return read
  } catch {}
  return { recorder: VERSION, shots: {} }
}

const ledger = readLedger()
const writeLedger = () => {
  fs.mkdirSync(workDir, { recursive: true })
  fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`)
}

/** What a take depended on: the config, the shot file, whatever the shot names, and the
 *  file it produced — a missing or edited output is a take that has to happen again. */
function inputsOf(id, output) {
  const shot = loaded.get(id)
  const files = [configPath, path.join(shotsDir, `${id}.mjs`), ...(shot?.inputs ?? []).map((f) => path.resolve(here, f))]
  const out = {}
  for (const file of files) out[rel(file)] = digest(file)
  if (output) out[`out:${output}`] = digest(path.join(outDir, output))
  return out
}

/** True when nothing this take read, and nothing it wrote, has changed since. */
function fresh(id, entry) {
  if (!entry?.inputs) return false
  const now = inputsOf(id, entry.output)
  const keys = new Set([...Object.keys(now), ...Object.keys(entry.inputs)])
  return [...keys].every((key) => now[key] !== null && now[key] === entry.inputs[key])
}

if (flag('list')) {
  for (const id of available) {
    await load(path.join(shotsDir, `${id}.mjs`))
    const entry = ledger.shots[id]
    const state = entry?.status === 'ok' ? (fresh(id, entry) ? 'ready' : 'stale') : (entry?.status ?? 'never recorded')
    process.stdout.write(`${id.padEnd(6)} ${state.padEnd(14)} ${entry?.output ?? ''}\n`)
  }
  process.exit(0)
}

// ---- the checks ------------------------------------------------------------

const check = (what, ok, said) => ({ what, ok, said })

/** What the finished file is, measured — never what the encode was asked for. */
function inspect(file, take, expect) {
  const probe = JSON.parse(
    execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', file], { encoding: 'utf8' }),
  )
  const stream = probe.streams?.[0] ?? {}
  const seconds = Number(probe.format?.duration ?? 0)
  const sampled = take.frames.length / take.elapsed
  const size = expect.size ?? [config.viewport.width * config.viewport.dpr, config.viewport.height * config.viewport.dpr]
  const floor = expect.fps ?? 20
  const checks = [
    check('size', stream.width === size[0] && stream.height === size[1], `${stream.width}x${stream.height}, wanted ${size[0]}x${size[1]}`),
    check('sampled fps', sampled >= floor, `sampled ${round(sampled)} fps, wanted at least ${floor} — encoding at ${config.fps} fps does not make up the difference`),
  ]
  if (expect.seconds) {
    const [min, max] = expect.seconds
    checks.push(check('duration', seconds >= min && seconds <= max, `${round(seconds)}s, wanted ${min}–${max}s`))
  }
  return checks
}

// ---- frames ----------------------------------------------------------------

/** Put every frame on a timeline. With marks, the take's beats are stretched onto the
 *  scripted times; without them the take keeps its own clock. Every frame keeps `at`, when
 *  it was really taken — retiming moves the file's clock, never the record of the sampling.
 *  `elapsed` is how long the take really ran, which is what the sampling rate is counted on. */
function retime(frames, began, ended, marks) {
  const elapsed = Math.max(0.001, ended - began)
  const real = frames.map((f) => ({ data: f.data, at: f.at - began }))
  if (marks.length < 2) return { frames: real.map((f) => ({ ...f, t: f.at })), duration: elapsed, elapsed }
  const pins = marks.map((m) => ({ source: m.source - began, target: m.target })).sort((a, b) => a.source - b.source)
  // The start of the take is a pin too, so what happens before the first mark is stretched
  // onto the timeline rather than piled onto its first instant.
  if (pins[0].source > 0) pins.unshift({ source: 0, target: 0 })
  const duration = pins[pins.length - 1].target
  const at = (t) => {
    if (t <= pins[0].source) return pins[0].target
    for (let i = 0; i < pins.length - 1; i += 1) {
      const a = pins[i]
      const b = pins[i + 1]
      if (t >= a.source && t < b.source) return a.target + ((t - a.source) / (b.source - a.source)) * (b.target - a.target)
    }
    return duration
  }
  return { frames: real.map((f) => ({ data: f.data, at: f.at, t: Math.min(duration, at(f.at)) })), duration, elapsed }
}

/** The raw take, kept: every frame as it came off the page, and when it was taken. */
function writeFrames(dir, take) {
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const lines = []
  take.frames.forEach((frame, index) => {
    const name = `${String(index).padStart(6, '0')}.jpg`
    fs.writeFileSync(path.join(dir, name), Buffer.from(frame.data, 'base64'))
    const hold = (take.frames[index + 1]?.t ?? take.duration) - frame.t
    if (hold > 0) lines.push(`file '${name}'`, 'option framerate 1000', `duration ${hold.toFixed(6)}`)
  })
  const last = `${String(take.frames.length - 1).padStart(6, '0')}.jpg`
  lines.push(`file '${last}'`, 'option framerate 1000', 'duration 0.001')
  fs.writeFileSync(path.join(dir, 'frames.ffconcat'), `${lines.join('\n')}\n`)
  fs.writeFileSync(path.join(dir, 'timestamps.json'), JSON.stringify(take.frames.map((f) => round(f.at))))
  fs.writeFileSync(
    path.join(dir, 'capture.json'),
    JSON.stringify(
      { recorder: VERSION, frames: take.frames.length, duration: round(take.duration), sampledSeconds: round(take.elapsed), sampledFps: round(take.frames.length / take.elapsed), viewport: config.viewport },
      null,
      2,
    ),
  )
}

function encode(framesDir, out, fps, duration) {
  execFileSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'concat', '-safe', '0', '-i', path.join(framesDir, 'frames.ffconcat'),
    '-vf', `fps=${fps}`,
    '-t', duration.toFixed(3),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-an',
    out,
  ])
}

// ---- the browser -----------------------------------------------------------

/** One connection to the browser for the whole run, and a fresh tab for each shot — a shot
 *  that left the page dirty cannot hand that state to the next one. */
async function openBrowser(endpoint) {
  const version = await fetch(`${endpoint}/json/version`).then((r) => r.json()).catch(() => null)
  if (!version) die(`no browser answering at ${endpoint} — start Chrome with \`--remote-debugging-port=${new URL(endpoint).port}\``, 2)
  return {
    async open() {
      const target = await (await fetch(`${endpoint}/json/new?about:blank`, { method: 'PUT' })).json()
      return attach(endpoint, target)
    },
  }
}

async function attach(endpoint, target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = () => reject(new Error('could not attach to the tab'))
  })
  let next = 0
  const pending = new Map()
  ws.onmessage = (e) => {
    const message = JSON.parse(e.data)
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message)
      pending.delete(message.id)
    }
  }
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = (next += 1)
      pending.set(id, resolve)
      ws.send(JSON.stringify({ id, method, params }))
    })

  const { width, height, dpr } = config.viewport
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: false })

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const ev = async (expr) => {
    const m = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
    const thrown = m.result?.exceptionDetails
    if (thrown) throw new Error(String(thrown.exception?.description ?? thrown.text ?? JSON.stringify(thrown)).slice(0, 400))
    return m.result?.result?.value
  }
  const until = async (expr, ms = 20000) => {
    const started = Date.now()
    while (Date.now() - started < ms) {
      try {
        if (await ev(expr)) return true
      } catch {}
      await sleep(250)
    }
    throw new Error(`timed out after ${ms}ms waiting for ${expr}`)
  }
  const box = async (expr) =>
    ev(`(()=>{const e=(${expr});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height,l:r.x,t:r.y}})()`)
  const need = async (expr) => {
    const b = await box(expr)
    if (!b) throw new Error(`no element: ${expr}`)
    return b
  }

  const ring = (x, y) =>
    ev(`(()=>{const r=document.createElement('div');r.className='akb-click-ring';r.style.left='${x}px';r.style.top='${y}px';document.body.append(r);setTimeout(()=>r.remove(),400)})()`)
  // The drawn cursor glides for .45s; a click waits for it to land so the ring opens under the tip.
  let at = null
  const cursor = () => {
    at = null
    return ev(CURSOR)
  }
  const land = async (x, y) => {
    const same = at?.x === x && at?.y === y
    const left = same ? at.t + 450 - Date.now() : 450
    if (!same) await move(x, y, 0)
    if (left > 0) await sleep(left)
  }
  const move = async (x, y, wait = 500) => {
    at = { x, y, t: Date.now() }
    await ev(`(()=>{const e=document.querySelector('#akb-capture-cursor');if(e){e.style.left='${x}px';e.style.top='${y}px'}})()`)
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
    if (wait) await sleep(wait)
  }
  const click = async (x, y, wait = 400) => {
    await land(x, y)
    await ring(x, y)
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
    if (wait) await sleep(wait)
  }

  let frames = []
  let sampling = false
  let loop = null
  let hooks = []
  const marks = []

  const ctx = {
    config,
    send,
    ev,
    until,
    box,
    sleep,
    cursor,
    byText: (text, selector = 'button,a,[role=button],[role=menuitem],[role=tab]') =>
      `[...document.querySelectorAll('${selector}')].filter(e=>e.offsetParent!==null&&e.innerText.trim()===${JSON.stringify(text)}).pop()`,
    async go(route = '/') {
      await send('Page.navigate', { url: /^[a-z][a-z0-9+.-]*:/i.test(route) ? route : `${config.baseUrl}${route}` })
      await sleep(400)
      await until(config.ready)
      await sleep(config.settle)
      await cursor()
      await move(config.viewport.width / 2, config.viewport.height / 2, 0)
    },
    move,
    click,
    async clickEl(expr, wait = 500) {
      const b = await need(expr)
      await click(b.x, b.y, wait)
      return b
    },
    async domClick(expr, wait = 500) {
      const b = await need(expr)
      await land(b.x, b.y)
      await ring(b.x, b.y)
      await ev(`(${expr}).click()`)
      if (wait) await sleep(wait)
      return b
    },
    async type(text, delay = 24) {
      for (const ch of text) {
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch })
        await send('Input.dispatchKeyEvent', { type: 'char', text: ch })
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch })
        await sleep(delay)
      }
    },
    async shot(file) {
      const to = path.resolve(here, file)
      const m = await send('Page.captureScreenshot', { format: 'png' })
      fs.mkdirSync(path.dirname(to), { recursive: true })
      fs.writeFileSync(to, Buffer.from(m.result.data, 'base64'))
    },
    mark: (seconds) => marks.push({ source: Date.now() / 1000, target: seconds }),
    beforeFrame: (fn) => hooks.push(fn),
  }

  /** Sample the page for exactly as long as `fn` runs. */
  async function film(fn) {
    frames = []
    marks.length = 0
    hooks = []
    const interval = 1000 / config.fps
    const began = Date.now() / 1000
    let ended = began
    sampling = true
    loop = (async () => {
      while (sampling) {
        const at = Date.now() / 1000
        for (const hook of hooks) {
          try {
            await hook(ctx)
          } catch {}
        }
        const frame = await send('Page.captureScreenshot', { format: 'jpeg', quality: 90, fromSurface: true })
        if (!sampling) break
        frames.push({ data: frame.result.data, at })
        const left = interval - (Date.now() / 1000 - at) * 1000
        if (left > 0) await sleep(left)
      }
    })()
    try {
      await fn()
    } finally {
      ended = Date.now() / 1000
      sampling = false
      await loop
    }
    return retime(frames, began, ended, marks)
  }

  const close = async () => {
    sampling = false
    try {
      ws.close()
    } catch {}
    await fetch(`${endpoint}/json/close/${target.id}`).catch(() => {})
  }

  return { ctx, film, close }
}

// ---- one shot --------------------------------------------------------------

const touched = []
let failed = 0

/** One ledger line, kept whichever way the shot went, and echoed as it happens. */
function report(id, status, rest) {
  const entry = { id, status, at: new Date().toISOString(), recorder: VERSION, ...rest, inputs: inputsOf(id, rest.output) }
  ledger.shots[id] = entry
  touched.push(entry)
  if (status === 'ok') {
    process.stdout.write(`${id} — ${entry.output}, ${entry.seconds}s, ${entry.frames} frames, sampled ${entry.sampledFps} fps\n`)
  } else {
    failed += 1
    process.stderr.write(`${id} — FAILED: ${entry.reason}\n`)
  }
  writeLedger()
}

async function record(browser, id, shot) {
  const output = shot.output ?? `${id}.mp4`
  const framesDir = path.join(workDir, `${id}-source`)
  const temp = path.join(workDir, `${id}.tmp.mp4`)
  const page = await browser.open()
  try {
    await step('reset', () => shot.reset?.(page.ctx))
    await step('check', () => shot.check?.(page.ctx))
    const take = await page.film(() => shot.take(page.ctx))
    if (!take.frames.length) throw new Error('no frames were sampled')
    writeFrames(framesDir, take)
    encode(framesDir, temp, config.fps, take.duration)
    const checks = inspect(temp, take, shot.expect ?? {})
    const bad = checks.filter((c) => !c.ok)
    if (bad.length) throw new Error(`checks failed — ${bad.map((c) => `${c.what}: ${c.said}`).join('; ')}`)
    fs.renameSync(temp, path.join(outDir, output))
    report(id, 'ok', {
      output,
      frames: take.frames.length,
      seconds: round(take.duration),
      sampledFps: round(take.frames.length / take.elapsed),
      checks,
      framesDir: rel(framesDir),
    })
  } catch (error) {
    fs.rmSync(temp, { force: true })
    report(id, 'failed', { output, reason: String(error?.message ?? error) })
  } finally {
    await page.close()
  }

  async function step(name, fn) {
    try {
      await fn()
    } catch (error) {
      throw new Error(`${name}: ${error?.message ?? error}`)
    }
  }
}

// ---- scaffolding -----------------------------------------------------------

function write(file, text) {
  if (fs.existsSync(file)) return void process.stdout.write(`${rel(file)} is already here — left alone\n`)
  fs.writeFileSync(file, text)
}

function scaffold() {
  const shots = path.resolve(here, DEFAULTS.shots)
  fs.mkdirSync(shots, { recursive: true })
  write(
    configPath,
    `// This task's environment. Anything left out keeps the recorder's default.
export default {
  browser: '${DEFAULTS.browser}',
  baseUrl: '${DEFAULTS.baseUrl}',
  viewport: { width: 1440, height: 810, dpr: 2 },
  fps: 30,
}
`,
  )
  write(
    path.join(shots, 'S1.mjs'),
    `// S1 — say here what the shot shows, in the script's words.
export default {
  output: '01-<what-it-shows>.mp4',
  expect: { seconds: [4, 12], fps: 20 },

  // Restore the baseline and get to the starting frame. Not recorded.
  async reset(ctx) {
    await ctx.go('/')
  },

  // Refuse to film the wrong starting state. Throw, and the shot is reported missing.
  async check(ctx) {
    await ctx.until(\`!!document.querySelector('main')\`)
  },

  // The take. Recording spans exactly this function.
  async take(ctx) {
    await ctx.sleep(800)
    await ctx.domClick(ctx.byText('Create task'), 600)
    await ctx.type('A demo task', 30)
    await ctx.sleep(1500)
  },
}
`,
  )
  process.stdout.write(`wrote ${rel(configPath)} and ${rel(path.join(shots, 'S1.mjs'))} — edit them, then \`node record.mjs\`\n`)
}

// ---- the run ---------------------------------------------------------------

fs.mkdirSync(workDir, { recursive: true })
fs.mkdirSync(outDir, { recursive: true })

const force = flag('force')
const browser = await openBrowser(config.browser)

for (const id of wanted) {
  const shot = await load(path.join(shotsDir, `${id}.mjs`))
  if (typeof shot.take !== 'function') {
    report(id, 'failed', { reason: `${rel(path.join(shotsDir, `${id}.mjs`))} exports no \`take\`` })
    continue
  }
  if (!force && ledger.shots[id]?.status === 'ok' && fresh(id, ledger.shots[id])) {
    process.stdout.write(`${id} — already recorded, unchanged\n`)
    continue
  }
  await record(browser, id, shot)
}

writeLedger()
if (flag('json')) process.stdout.write(`${JSON.stringify(touched, null, 2)}\n`)
process.stdout.write(`${wanted.length - failed}/${wanted.length} recorded${failed ? `, ${failed} failed` : ''}\n`)
process.exit(failed ? 1 : 0)
