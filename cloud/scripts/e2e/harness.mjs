// What every production end-to-end test shares: the step record and its report, a throwaway
// account with a Runner and a sample project folder, and the cleanup that removes them.
//
//   npm run e2e:<name>                       Runner as users get it (npm latest + Cloud's pick)
//   npm run e2e:<name> -- --runner source    Runner built from this checkout's HEAD
//   npm run e2e:<name> -- --keep             leave the account and folders for a look
//   npm run e2e:<name> -- --stop-after <key> stop after that step, keeping everything
//   npm run e2e:<name> -- clean              remove every leftover test account
//
// A throwaway account and a sample project under ~/wc-e2e/<tag>/ are made and removed; no
// other account is read or touched. Needs Chrome, a signed-in `claude`, and cloud/.env's
// SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN and RESEND_API_KEY. Writes report.md beside the
// sample project: each step, how long it took, where it broke, and what today's monitoring
// would have shown of it. Exit 0 passed, 1 failed, 2 could not start.

import { execFileSync } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { codeSignIn, removeTestAccounts, signUp, tokenSource } from './account.mjs'
import { launchBrowser, waitFor } from './browser.mjs'
import { API, REVIEW, WEB, credentials, sqlClient } from './prod.mjs'
import { prepareRunner, seedHome, startRunner } from './runner.mjs'

export const MIN = 60_000
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** What today's monitoring shows of the shared steps: `sees` exists, `gap` is what nothing shows. */
const WATCH = {
  versions: { sees: '`npm run check:live` (by hand) compares the Worker and migrations with main', gap: 'Nothing compares the Runner version Cloud hands out with what Cloud accepts, or the web and review bundles with main.' },
  signup: { sees: 'Workers Logs (dashboard, by hand) keep the API errors; Supabase Auth logs keep failed codes', gap: 'No alert when sign-in or the code mail fails; a new user just leaves.' },
  runner: { sees: 'Workers Logs record each refused `POST /v1/runner`; the user sees "Runner not connected"', gap: 'No alert or count of Runners refused or gone silent; a release that strands every Runner goes unnoticed until a user complains.' },
  setup: { sees: 'nothing: this is the test preparing itself', gap: 'None; a failure here is the test, not WildCrane.' },
  folder: { sees: 'Workers Logs record the refused call', gap: 'No alert on project-folder registration failures.' },
  firstrun: { sees: 'nothing', gap: 'No record of where new accounts stop in the first-run screens.' },
}

export async function api(token, method, path, body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'user-agent': 'wildcrane-e2e' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })
  const text = await response.text()
  if (!response.ok) throw Object.assign(new Error(`${method} ${path} answered ${response.status}: ${text.slice(0, 300)}`), { status: response.status })
  return text ? JSON.parse(text) : null
}

/**
 * One test run. `run(body)` signs nothing up by itself: `body` calls `setUp()` for the account,
 * Runner and folder, then its own steps; whatever happens, the Runner stops, the report is
 * written and the account is removed.
 */
export async function harness({ name, title, watch }) {
  const args = process.argv.slice(2)
  const flag = (f) => args.includes(`--${f}`) || (f === 'keep' && args.includes('--stop-after'))
  const option = (o, fallback) => {
    const at = args.indexOf(`--${o}`)
    return at >= 0 ? args[at + 1] : fallback
  }
  const env = await credentials('SUPABASE_PROJECT_REF', 'SUPABASE_ACCESS_TOKEN', 'RESEND_API_KEY').catch((error) => {
    console.error(error.message)
    process.exit(2)
  })
  const sql = sqlClient(env)
  if (args[0] === 'clean') {
    const removed = await removeTestAccounts(sql)
    console.log(removed.length ? `removed ${removed.join(', ')}` : 'no leftover test accounts')
    process.exit(0)
  }

  const tag = Date.now().toString(36)
  const root = join(homedir(), 'wc-e2e', tag)
  const h = {
    tag,
    root,
    project: join(root, 'sample'),
    home: join(root, 'wildcrane'),
    runnerLog: join(root, 'runner.log'),
    runnerKind: option('runner', 'stable'),
    env,
    sql,
    steps: [],
    notes: [],
    /** Extra report sections, each `{ heading, lines }`. */
    sections: [],
    watch: { ...WATCH, ...watch },
    page: null,
    account: null,
    runner: null,
    git: (...a) => execFileSync('git', a, { cwd: h.project, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim(),
  }

  h.step = async (key, stepTitle, fn, { slowAfter } = {}) => {
    const started = Date.now()
    process.stdout.write(`- ${stepTitle} … `)
    try {
      const detail = await fn()
      const ms = Date.now() - started
      const slow = slowAfter && ms > slowAfter
      h.steps.push({ key, title: stepTitle, ok: true, ms, detail, slow })
      console.log(`ok (${Math.round(ms / 1000)}s)${detail ? ` — ${detail}` : ''}${slow ? ' — slow' : ''}`)
      if (option('stop-after') === key) throw Object.assign(new Error(`stopped after ${key}`), { stopped: true })
    } catch (error) {
      if (error.stopped) throw error
      h.steps.push({ key, title: stepTitle, ok: false, ms: Date.now() - started, detail: error.message })
      console.log(`FAILED — ${error.message}`)
      throw Object.assign(error, { step: key })
    }
  }

  /** A step whose failure is recorded but does not end the run; answers whether it passed. */
  h.check = (key, stepTitle, fn, opts) => h.step(key, stepTitle, fn, opts).then(() => true, (error) => {
    if (error.stopped || error.fatal) throw error
    return false
  })

  h.run = async (body) => {
    const browser = await launchBrowser().catch((error) => {
      console.error(`cannot start Chrome: ${error.message}`)
      process.exit(2)
    })
    h.page = await browser.page()
    let failure
    let interrupt
    const interrupted = new Promise((_, reject) => (interrupt = reject))
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => interrupt(new Error(`interrupted by ${signal}`)))
    interrupted.catch(() => {})
    console.log(`WildCrane end-to-end: ${title} (${tag}, Runner: ${h.runnerKind})`)
    try {
      await Promise.race([interrupted, body()])
    } catch (error) {
      failure = error
    } finally {
      await h.runner?.stop()
      await browser.close()
      await writeReport(failure)
      if (!flag('keep') && h.account) await removeTestAccounts(sql, [h.account.handle]).catch((e) => console.log(`cleanup failed: ${e.message}`))
      if (!flag('keep')) for (const dir of ['wildcrane', 'wildcrane-b', 'npm']) await rm(join(root, dir), { recursive: true, force: true })
    }
    const failed = h.steps.filter((s) => !s.ok)
    const report = join(root, 'report.md')
    console.log(failure?.stopped ? `\n${failure.message}. Report: ${report}` : failed.length || failure ? `\nFAILED at ${failed.map((s) => `"${s.title}"`).join(', ') || failure.message}. Report: ${report}` : `\nPASSED. Report: ${report}`)
    if (flag('keep') && h.account) console.log(`kept ${h.account.handle}; remove it with: npm run e2e:${name} -- clean`)
    process.exit((failed.length || failure) && !failure?.stopped ? 1 : 0)
  }

  // --- the shared start: account, Runner, project folder ----------------------

  h.setUp = async () => {
    await h.step('versions', 'Record live versions', async () => {
      const v = await liveVersions(tag)
      if (v.runnerNamed !== v.runnerNpm) h.notes.push(`Cloud names Runner ${v.runnerNamed}; npm latest is ${v.runnerNpm}.`)
      return `Worker ${v.worker}, Runner named ${v.runnerNamed} / npm ${v.runnerNpm}, web ${v.web}, review ${v.review}`
    })

    await h.step('signup', 'Sign up on the web with an emailed code', async () => {
      h.account = await signUp(h.page, { sql, resendKey: env.RESEND_API_KEY, tag })
      return h.account.handle
    }, { slowAfter: 2 * MIN })
    // The page, the Runner and this script each hold their own sign-in, as a person's browser
    // and computer do; one refresh token shared would sign the others out.
    h.token = async () => (await h.page.evaluate('JSON.parse(localStorage.getItem("wildcrane.review.session"))')).access_token
    h.workspace = (await api(await h.token(), 'GET', '/v1/workspaces')).data.find((w) => w.personal)?.id

    await h.step('setup', 'Prepare the Runner, the sample project and their sign-ins', async () => {
      await makeSample(h.project)
      h.built = await prepareRunner(h.runnerKind, root)
      h.machineId = await seedHome(h.home, await codeSignIn(h.account.email, env.RESEND_API_KEY), h.project)
      h.token = tokenSource(await codeSignIn(h.account.email, env.RESEND_API_KEY))
      return `Runner ${h.built.version}`
    })

    await h.step('runner', 'Connect a Runner on this computer', async () => {
      await h.startRunner()
      return `Runner ${h.built.version}`
    }, { slowAfter: MIN })

    await h.step('folder', 'Add the sample project folder', async () => {
      const folder = await api(await h.token(), 'POST', '/v1/runner/folders', { machineId: h.machineId, name: 'sample', path: h.project })
      h.projectId = folder.folder?.project
      if (!h.projectId) throw new Error(`no project in ${JSON.stringify(folder).slice(0, 200)}`)
      // What the workspace settings list: the computer, now that it holds a project folder.
      const { runners } = await api(await h.token(), 'GET', `/v1/workspaces/${h.workspace}/runners`)
      if (!runners.find((r) => r.machine === h.machineId)?.connected) throw new Error('workspace settings do not list this computer as connected')
      return h.projectId
    })

    await h.step('firstrun', 'Get through the first-run screens', async () => {
      await h.page.goto(`${WEB}/`)
      return await firstRun(h.page)
    })
  }

  /** Starts the Runner and waits until Cloud lists it as connected. */
  h.startRunner = async () => {
    h.runner = startRunner(h.built, h.home, h.runnerLog)
    try {
      await waitFor(async () => {
        if (h.runner.exited() !== null) throw Object.assign(new Error(`the Runner exited (${h.runner.exited()})`), { fatal: true })
        const { runner: connected } = await api(await h.token(), 'GET', '/v1/runner')
        return connected && JSON.stringify(connected).includes(h.machineId)
      }, 3 * MIN, 'the Runner did not connect within 3 minutes', 5_000)
    } catch (error) {
      throw new Error(`${error.message}${await runnerSaid(h.runnerLog)}`)
    }
  }

  /** Polls the task, keeping each status change in `seen`, until `done(task)` or `ms` passes. */
  h.watchTask = async (id, done, ms, seen = []) => await waitFor(async () => {
    const t = await api(await h.token(), 'GET', `/v1/tasks/${id}`)
    const label = t.status === 'running' && t.run?.state === 'queued' ? 'queued' : t.status
    if (seen.at(-1)?.status !== label) seen.push({ status: label, at: Date.now() })
    if (['failed', 'cancelled', 'stopped'].includes(t.status)) return t
    if (h.runner && h.runner.exited() !== null) throw Object.assign(new Error(`the Runner exited (${h.runner.exited()})`), { fatal: true })
    return done(t) ? t : undefined
  }, ms, `still "${seen.at(-1)?.status}" after ${Math.round(ms / MIN)} minutes`, 10_000)

  /** Opens the workflow menu beside the request box and picks `pattern`, waiting for the list to load. */
  h.pickWorkflow = async (pattern) => {
    let items = ''
    try {
      await waitFor(async () => {
        const open = await h.page.evaluate(`!!document.querySelector('[role=menu]')`)
        if (!open) await h.page.evaluate(`document.querySelector('button[title="Workflows"]')?.click()`)
        await sleep(300)
        items = await h.page.evaluate(`[...document.querySelectorAll('[role=menu] [role=menuitem]')].map((e) => e.innerText.trim()).join(' | ')`)
        return items.split(' | ').some((item) => pattern.test(item))
      }, 20_000, 'timeout', 1_000)
    } catch {
      throw new Error(`no ${pattern} in the workflow menu after 20s: ${items || 'no menu'}`)
    }
    await h.page.click(pattern)
  }

  /** Creates a task from the web app's request box and answers it as the API reads it. */
  h.createTask = async (request, workflow = /^Coding\b/) => {
    await h.page.goto(`${WEB}/new?project=${encodeURIComponent(h.projectId)}`)
    await waitFor(() => h.page.evaluate('!!document.querySelector("textarea")'), 30_000, 'no request box on /new').catch(async (error) => {
      throw new Error(`${error.message}; the page says: ${(await h.page.text()).replace(/\s+/g, ' ').slice(0, 300)}`)
    })
    await h.pickWorkflow(workflow)
    await h.page.fill('textarea', request)
    await h.page.click(/^Send$/)
    const url = await waitFor(async () => ((await h.page.url()).includes('/tasks/') ? h.page.url() : undefined), 30_000, 'Send did not open a task')
    const key = decodeURIComponent(/\/tasks\/([^?/]+)/.exec(url)[1])
    const task = await api(await h.token(), 'GET', `/v1/tasks/${encodeURIComponent(key)}`)
    if (task.project !== h.projectId) throw new Error(`the task went to project ${task.project}, not the sample project ${h.projectId}`)
    return task
  }

  async function writeReport(failure) {
    const lines = [`# WildCrane end-to-end: ${title}`, '', `Run ${tag} · ${new Date().toISOString()} · Runner: ${h.runnerKind}`, '', '| Step | Result | Time |', '| --- | --- | --- |']
    for (const s of h.steps) lines.push(`| ${s.title} | ${s.ok ? (s.slow ? 'slow' : 'ok') : 'FAILED'}${s.detail ? ` — ${String(s.detail).replace(/\|/g, '/')}` : ''} | ${Math.round(s.ms / 1000)}s |`)
    if (failure && !failure.step && !failure.stopped) lines.push('', `Stopped by: ${failure.message}`)
    if (h.notes.length) lines.push('', '## Noticed', '', ...h.notes.map((n) => `- ${n}`))
    for (const s of h.sections) lines.push('', `## ${s.heading}`, '', ...s.lines)
    // Every step's standing gap, marked where this run tripped over it.
    lines.push('', '## Monitoring gaps', '', '| Step | This run | What shows it today | What nothing shows |', '| --- | --- | --- | --- |')
    for (const s of h.steps.filter((s) => h.watch[s.key] && s.key !== 'setup')) {
      lines.push(`| ${s.title} | ${s.ok ? (s.slow ? 'slow' : 'ok') : 'FAILED'} | ${h.watch[s.key].sees} | ${h.watch[s.key].gap} |`)
    }
    const tail = (await readFile(h.runnerLog, 'utf8').catch(() => '')).split('\n').slice(-30).join('\n')
    if (tail.trim()) lines.push('', '## Runner log (last lines)', '', '```', tail, '```')
    await mkdir(root, { recursive: true })
    await writeFile(join(root, 'report.md'), `${lines.join('\n')}\n`)
  }

  return h
}

async function makeSample(project) {
  const git = (...a) => execFileSync('git', a, { cwd: project, stdio: ['ignore', 'pipe', 'pipe'] })
  await mkdir(project, { recursive: true })
  await writeFile(join(project, 'package.json'), `${JSON.stringify({ name: 'wc-e2e-sample', version: '1.4.2', type: 'module', bin: { greet: 'cli.mjs' } }, null, 2)}\n`)
  await writeFile(join(project, 'cli.mjs'), "#!/usr/bin/env node\nconst name = process.argv[2] ?? 'world'\nconsole.log(`Hello, ${name}!`)\n")
  await writeFile(join(project, 'README.md'), '# greet\n\n`node cli.mjs [name]` prints a greeting.\n')
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('-c', 'user.name=wc-e2e', '-c', 'user.email=wc-e2e@example.com', 'commit', '-q', '-m', 'Sample CLI')
}

async function liveVersions(tag) {
  const health = await fetch(`${API}/health`).then((r) => r.json())
  const named = await fetch(`${API}/v1/runner/version?machine=00000000-0000-4000-8000-000000000000`).then((r) => r.json())
  const npm = await fetch('https://registry.npmjs.org/wildcrane-runner').then((r) => r.json())
  const bundle = async (site) => /assets\/(index-[\w-]+\.js)/.exec(await fetch(`${site}/?x=${tag}`).then((r) => r.text()))?.[1] ?? 'unknown'
  return {
    worker: health.commit,
    runnerNamed: named.version,
    runnerNpm: npm['dist-tags']?.latest,
    web: await bundle(WEB),
    review: await bundle(REVIEW),
  }
}

/** Clicks through what a new account meets first, the way a person would; returns what it saw. */
async function firstRun(page) {
  const seen = []
  let quiet = 0
  for (let i = 0; i < 45 && quiet < 5; i++) {
    await sleep(1000)
    const text = await page.text()
    const screen = /Help improve WildCrane/.test(text) ? ['usage prompt', /^Continue$/]
      : /Get ready/.test(text) ? ['setup', /^(Continue|Next|Done|Start|Finish|Go to|Open)/]
      : /Welcome tour/.test(text) && /\bSkip\b/.test(text) ? ['welcome tour', /^Skip$/]
      : undefined
    if (!screen) {
      if (/My workspace/.test(text)) quiet++
      continue
    }
    quiet = 0
    seen.push(screen[0])
    await page.click(screen[1]).catch(() => {
      throw new Error(`stuck on the ${screen[0]}: ${text.replace(/\s+/g, ' ').slice(0, 300)}`)
    })
  }
  if (quiet < 5) throw new Error(`the first-run screens did not end: ${seen.join(', ')}`)
  return seen.join(', ') || 'none'
}

async function runnerSaid(log) {
  const text = await readFile(log, 'utf8').catch(() => '')
  const line = text.split('\n').filter((l) => /outdated|update|refus|error/i.test(l)).slice(-3).join(' / ')
  return line ? `; Runner said: ${line.slice(0, 300)}` : ''
}
