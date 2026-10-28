#!/usr/bin/env node
// End-to-end, on production: the Runner's project folder is a cache of Cloud. A rule edited on
// the web reaches the next run; a deleted folder comes back from Cloud word for word; and a card
// edited on the web and in the folder keeps both edits, or both sides agree and say what was
// lost. `npm run e2e:folder`; options and requirements are in harness.mjs.

import { existsSync } from 'node:fs'
import { readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { waitFor } from './browser.mjs'
import { MIN, api, harness, sleep } from './harness.mjs'
import { WEB } from './prod.mjs'

const BUILD = 'Add a `--shout` flag to cli.mjs: `node cli.mjs --shout ann` prints `HELLO, ANN!`. Keep the plain greeting unchanged.'
const PLAN = 'Document in README.md how to use `node cli.mjs [name]`, with one example.'
const SYNC = 'Reply with the single word OK. Do not run any command and do not edit any file.'
const HOLD = 'Run the shell command `sleep 75`, then reply with the single word OK. Do not edit any file.'

function afterFront(body, line) {
  const front = /^---\n[\s\S]*?\n---\n/.exec(body)
  const at = front ? front[0].length : 0
  return `${body.slice(0, at)}\n${line}\n${body.slice(at)}`
}

const atEnd = (text, line) => `${text.replace(/\n*$/, '\n')}\n${line}\n`

const h = await harness({
  name: 'folder',
  title: "the Runner's project folder rebuilds from Cloud",
  watch: {
    task: { sees: 'Workers Logs; the task row in the database', gap: 'No alert when task creation fails from the web app; browser errors are not collected.' },
    rule: { sees: 'nothing: a rule save that fails shows only on the page that made it', gap: 'No record of rule saves that fail; the user may believe a rule is in force that never reached Cloud.' },
    plan: { sees: 'cloud.runner_jobs, read by hand; the task page while it runs', gap: 'No alert for a job queued or running past a limit.' },
    build: { sees: 'cloud.runner_jobs and the task page', gap: 'Nothing shows which rules a run was given: the prompt is kept nowhere once the run ends, so "my rule was ignored" cannot be checked.' },
    seed: { sees: "the task's chat", gap: 'None beyond the chat itself.' },
    rebuild: { sees: 'nothing: the folder is rebuilt silently when the next run starts', gap: 'Nothing records a folder rebuilt from Cloud, or how long the first run after it waits.' },
    between: { sees: 'nothing', gap: 'A hand edit made between runs is overwritten by the next run without a word; nothing logs or counts it.' },
    during: { sees: "Workers Logs record the 409 on the board commit; the Runner's own log", gap: 'No count of merged or refused board commits; merges are invisible to the user and to us.' },
    same: { sees: "Workers Logs record the 409; the job's `conflict` outcome in cloud.runner_jobs", gap: 'No alert or count of runs re-queued on a conflict, nor of edits lost to one.' },
  },
})

await h.run(async () => {
  await h.setUp()
  const board = join(h.project, '.akb', 'kanban')
  const nonce = `rc-${h.tag}`
  const rule = `Before you finish, add a file named \`rule-check.txt\` at the project root holding exactly the line \`${nonce}\`, and commit it with your change.`

  // --- 2. a rule edited on the web reaches the run ---------------------------

  let built
  let planned
  await h.step('task', 'Create two tasks on the web', async () => {
    const { workflows } = await api(await h.token(), 'GET', `/v1/projects/${h.projectId}/agents`)
    if (!workflows.length) h.notes.push("A new project's settings list no workflow, so no agent's rule can be set before the first task is created.")
    built = await h.createTask(BUILD)
    planned = await h.createTask(PLAN)
    return `${built.key}, ${planned.key}`
  })

  let builderTitle
  // A project lists no workflow on the web until it has used one, so the rule follows the tasks.
  await h.step('rule', "Edit the builder's rule on the web", async () => {
    const agents = await api(await h.token(), 'GET', `/v1/projects/${h.projectId}/agents`)
    const builder = agents.data.find((a) => a.agent === 'builder')
    builderTitle = builder?.title?.en || 'Builder'
    await editRule(builderTitle, rule)
    return `"${builderTitle}"`
  })

  await h.step('plan', 'The Runner plans both', async () => {
    built = await h.watchTask(built.id, (t) => t.status === 'waiting_review', 30 * MIN)
    planned = await h.watchTask(planned.id, (t) => t.status === 'waiting_review', 30 * MIN)
    for (const t of [built, planned]) if (t.status !== 'waiting_review') throw new Error(`${t.key} ended ${t.status}`)
    return `${built.key}, ${planned.key}`
  }, { slowAfter: 10 * MIN })

  const ruled = await h.check('build', 'The approved build follows the rule edited on the web', async () => {
    await api(await h.token(), 'POST', `/v1/tasks/${built.id}/decisions`, { decision: 'approve', review_revision: built.review?.revision ?? 1 })
    built = await h.watchTask(built.id, (t) => t.status === 'done' || (t.status === 'waiting_review' && t.review?.revision > 1), 45 * MIN)
    if (built.status !== 'done') throw new Error(`the build ended ${built.status}${built.failure ? `: ${JSON.stringify(built.failure).slice(0, 200)}` : ''}`)
    const commit = built.landing?.commit
    if (!commit) throw new Error('the task reports no landing commit')
    let text
    try {
      text = h.git('show', 'main:rule-check.txt')
    } catch {
      throw new Error(`the landed change (${commit.slice(0, 8)}) has no rule-check.txt: the run did not follow the rule`)
    }
    if (text.trim() !== nonce) throw new Error(`rule-check.txt holds "${text.trim().slice(0, 80)}", not ${nonce}`)
    return `${commit.slice(0, 8)} carries rule-check.txt`
  }, { slowAfter: 20 * MIN })
  if (!ruled) h.notes.push('A run keeps no record of the prompt it was given, so the test can only see a rule by its effect on the landed change.')

  // --- 1. the folder deleted, then rebuilt from Cloud -------------------------

  await h.step('seed', 'Write a memory note through a run', async () => {
    const note = join(board, 'memory', 'e2e-note.md')
    const reply = await chat(planned, `Create the file \`${note}\` holding exactly these two lines, then reply OK:\n\n# End-to-end note\n${nonce}\n\nDo not edit any other file.`)
    if (reply.status !== 'idle') throw new Error(`the run ended ${reply.status}: ${lastReply(reply)}`)
    const files = await cloudFiles()
    const held = [...files].find(([p, c]) => p.endsWith('memory/e2e-note.md') && c.includes(nonce))
    if (!held) throw new Error(`Cloud holds no memory/e2e-note.md after the run; it replied: ${lastReply(reply)}; the folder ${existsSync(note) ? 'has' : 'has no'} the file`)
    return held[0]
  })

  let before
  await h.step('rebuild', 'Delete the project folder, restart the Runner, start a run', async () => {
    before = await cloudFiles()
    const cards = [...before.keys()].filter((p) => /^(todo|\.archive)\/.+\.md$/.test(p) && !p.endsWith('README.md'))
    if (cards.length < 2) throw new Error(`Cloud holds ${cards.length} card(s); the test needs two`)
    if (!before.has('rules/builder.md')) throw new Error('Cloud holds no rules/builder.md')
    await h.runner.stop()
    await rm(join(h.project, '.akb'), { recursive: true, force: true })
    await h.startRunner()
    await sleep(30_000)
    if (existsSync(board)) h.notes.push('The Runner rebuilt the project folder as soon as it restarted.')
    else h.notes.push('A deleted project folder stays gone after the Runner restarts; it comes back only when the next run on that project starts.')
    const reply = await chat(planned, SYNC)
    if (reply.status !== 'idle') throw new Error(`the run ended ${reply.status}`)
    return `${before.size} files in Cloud, ${cards.length} cards`
  })

  await h.check('restored', 'Every file is back from Cloud, word for word', async () => {
    const { compared, wrong } = await compare()
    for (const p of before.keys()) if (!compared.includes(p) && !p.startsWith('memory/')) wrong.push(`${p} no longer in Cloud`)
    if (wrong.length) throw new Error(`${wrong.length} of ${compared.length} differ: ${wrong.slice(0, 6).join('; ')}`)
    return `${compared.length} files identical`
  })

  // --- 3. one card edited on the web and in the folder ------------------------

  await h.check('between', 'Web and folder edit different parts of a card between runs', async () => {
    const local = await localCard(planned)
    const web = `Web edit between runs ${nonce}.`
    const mine = `Local edit between runs ${nonce}.`
    await writeFile(local, atEnd(await readFile(local, 'utf8'), mine))
    const card = await readCard(planned)
    await putCard(planned, afterFront(card.body, web), card.version)
    const reply = await chat(planned, SYNC)
    return await settle(planned, local, reply, [web, mine])
  })

  await h.check('during', 'Web and folder edit different parts of a card during a run', async () => {
    const web = `Web edit during a run ${nonce}.`
    const mine = `Local edit during a run ${nonce}.`
    const { local, reply } = await editDuringRun(planned, (text) => atEnd(text, mine), (body) => afterFront(body, web))
    await chat(planned, SYNC)
    return await settle(planned, local, reply, [web, mine])
  })

  await h.check('same', 'Web and folder edit the same paragraph during a run', async () => {
    const web = `Same paragraph, web ${nonce}.`
    const mine = `Same paragraph, local ${nonce}.`
    const { local, reply } = await editDuringRun(planned, (text) => atEnd(text, mine), (body) => atEnd(body, web))
    await chat(planned, SYNC)
    return await settle(planned, local, reply, [web, mine])
  })

  // --- pieces -------------------------------------------------------------------

  /** Opens settings → Workflows on the sample project, picks the agent by title, and saves `text`. */
  async function editRule(title, text) {
    const { page } = h
    try {
      await ruleOnPage(title, text)
    } catch (error) {
      const seen = await page.evaluate(`(document.querySelector('[role=dialog]') ?? document.body).innerText`).catch(() => '')
      throw new Error(`${error.message}; settings shows: ${String(seen).replace(/\s+/g, ' ').slice(0, 400)}`)
    }
  }

  async function ruleOnPage(title, text) {
    const { page } = h
    await page.goto(`${WEB}/`)
    await waitFor(async () => /My workspace/.test(await page.text()), 30_000, 'the web app did not load')
    await page.evaluate(`window.dispatchEvent(new CustomEvent('wc:settings', { detail: 'workflows' }))`)
    const switcher = `document.querySelector('[role=dialog] nav [role=group][aria-label] > button[aria-expanded]') ?? document.querySelector('nav [role=group][aria-label] > button[aria-expanded]')`
    await waitFor(() => page.evaluate(`!!(${switcher})`), 15_000, 'settings did not open')
    if ((await page.evaluate(`(${switcher}).innerText.trim()`)) !== 'sample') {
      await page.evaluate(`(${switcher}).click()`)
      const offered = await waitFor(() => page.evaluate(`(() => {
        const all = [...document.querySelectorAll('[role=listbox] [role=option]')]
        const o = all.find((e) => e.innerText.trim() === 'sample')
        o?.click()
        return o ? 'picked' : all.length ? all.map((e) => e.innerText.trim()).join(', ') : undefined
      })()`), 10_000, 'the project list never opened').catch(() => 'nothing')
      if (offered !== 'picked') throw new Error(`settings offers no "sample" project; it offers: ${offered}`)
    }
    // The workflow shown first may not be Coding.
    await waitFor(() => page.evaluate(`!!document.querySelector('button[aria-label="Workflows"][aria-expanded]')`), 15_000, 'no workflow picker in settings')
    if (!/^Coding/.test(await page.evaluate(`document.querySelector('button[aria-label="Workflows"][aria-expanded]').innerText.trim()`))) {
      await page.evaluate(`document.querySelector('button[aria-label="Workflows"][aria-expanded]').click()`)
      await sleep(300)
      const picked = await page.evaluate(`(() => {
        const o = [...document.querySelectorAll('[role=option]')].find((e) => /^Coding/.test(e.innerText.trim()))
        o?.click()
        return !!o
      })()`)
      if (!picked) throw new Error('the workflow picker offers no Coding')
    }
    await page.click(new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`))
    const field = 'textarea[aria-label="Your instructions"]'
    await waitFor(() => page.evaluate(`!!document.querySelector('${field}')`), 15_000, `no rule field for ${title}`)
    await page.evaluate(`document.querySelector('${field}').focus()`)
    await page.fill(field, text)
    // What a person's click elsewhere does: the field loses focus, and that saves it.
    await page.evaluate(`(() => {
      const el = document.querySelector('${field}')
      el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
      el.blur()
    })()`)
    const area = () => page.evaluate(`document.querySelector('${field}')?.closest('section')?.innerText ?? ''`)
    await waitFor(async () => {
      const saved = (await api(await h.token(), 'GET', `/v1/projects/${h.projectId}/agents`)).data.find((a) => a.agent === 'builder')
      return saved?.rule.trim() === text
    }, 20_000, 'Cloud never received the rule').catch(async (error) => {
      throw new Error(`${error.message}; the field shows: ${String(await area()).replace(/\s+/g, ' ').slice(0, 300)}`)
    })
    if (!/\bSaved\b(?! with)/.test(await area())) h.notes.push('The rule reached Cloud, but the page did not say Saved.')
  }

  /** Waits until no run of the task's chat is queued or replying. */
  async function idle(task) {
    await waitFor(async () => !['queued', 'replying'].includes((await api(await h.token(), 'GET', `/v1/tasks/${task.id}/chat`)).status), 15 * MIN, 'an earlier run never ended', 5_000)
  }

  /** Sends a chat message on the task and waits for its reply, or for the run to fail; answers the chat. */
  async function chat(task, body) {
    await idle(task)
    const before = (await api(await h.token(), 'GET', `/v1/tasks/${task.id}/chat`)).messages.length
    await api(await h.token(), 'POST', `/v1/tasks/${task.id}/chat`, { body, runtime: 'task' })
    return await waitFor(async () => {
      const c = await api(await h.token(), 'GET', `/v1/tasks/${task.id}/chat`)
      if (h.runner.exited() !== null) throw Object.assign(new Error(`the Runner exited (${h.runner.exited()})`), { fatal: true })
      if (['queued', 'replying'].includes(c.status)) return undefined
      return c.status !== 'idle' || c.messages.length >= before + 2 ? c : undefined
    }, 15 * MIN, 'the chat run did not end within 15 minutes', 5_000)
  }

  function lastReply(c) {
    return String(c.messages.at(-1)?.body ?? '').replace(/\s+/g, ' ').slice(0, 200)
  }

  /** Starts a run that holds the card, edits it on both sides once the run has read it, and
   *  waits until the task's runs are over — a conflict re-queues the run once. */
  async function editDuringRun(task, editLocal, editWeb) {
    await idle(task)
    const card = await readCard(task)
    // A run reads Cloud into the folder as it starts and records that read in base.json; an
    // edit made before then is the "between runs" case, not this one.
    const base = join(h.project, '.akb', 'base.json')
    const read = async () => (await stat(base).catch(() => null))?.mtimeMs ?? 0
    const before = await read()
    await api(await h.token(), 'POST', `/v1/tasks/${task.id}/chat`, { body: HOLD, runtime: 'task' })
    await waitFor(async () => (await read()) > before, 5 * MIN, 'the run never read the board', 1_000)
    await sleep(5_000)
    const local = await findCard(card.body)
    if (!local) throw new Error('the folder holds no copy of the card once the run has read the board')
    if ((await api(await h.token(), 'GET', `/v1/tasks/${task.id}/chat`)).status !== 'replying') throw new Error('the run ended before the card could be edited')
    await writeFile(local, editLocal(await readFile(local, 'utf8')))
    await putCard(task, editWeb(card.body), card.version)
    const seen = []
    let quiet = 0
    const reply = await waitFor(async () => {
      const c = await api(await h.token(), 'GET', `/v1/tasks/${task.id}/chat`)
      if (seen.at(-1) !== c.status) seen.push(c.status)
      quiet = ['queued', 'replying'].includes(c.status) ? 0 : quiet + 1
      return quiet >= 4 ? c : undefined
    }, 15 * MIN, 'the run did not end within 15 minutes', 5_000)
    return { local, reply: { ...reply, seen } }
  }

  /** Both edits kept and both sides alike, or both sides alike and the loss told to the user. */
  async function settle(task, local, reply, edits) {
    const card = await readCard(task)
    const mine = await readFile(local, 'utf8').catch(() => null)
    const kept = edits.filter((e) => card.body.includes(e))
    const said = [reply.status, ...(reply.seen ?? []), ...reply.messages.slice(-2).map((m) => m.body ?? '')].join(' ')
    const told = /conflict|changed elsewhere|updated elsewhere/i.test(said)
    const alike = mine === card.body
    if (kept.length === edits.length && alike) return 'both edits kept; web and folder agree'
    const lost = edits.filter((e) => !kept.includes(e)).map((e) => `"${e.replace(` ${nonce}.`, '')}"`)
    if (!alike) throw new Error(`the folder and Cloud differ${lost.length ? `; Cloud lost ${lost.join(', ')}` : ''}`)
    if (!told) throw new Error(`${lost.join(', ')} lost without a word to the user (chat ${(reply.seen ?? [reply.status]).join(' → ')})`)
    return `${lost.join(', ')} lost; the user was told (${(reply.seen ?? [reply.status]).join(' → ')})`
  }

  async function readCard(task) {
    return await api(await h.token(), 'GET', `/v1/tasks/${task.id}/card`)
  }

  async function putCard(task, body, version) {
    return await api(await h.token(), 'PUT', `/v1/tasks/${task.id}/card`, { body, base_version: version })
  }

  /** The card's file in the folder, as Cloud names it. */
  async function localCard(task) {
    const file = await findCard((await readCard(task)).body)
    if (!file) throw new Error("the folder holds no copy of the card as Cloud has it")
    return file
  }

  async function findCard(body) {
    const dir = join(board, 'todo')
    for (const name of await readdir(dir, { recursive: true }).catch(() => [])) {
      const file = join(dir, name)
      if (name.endsWith('.md') && (await readFile(file, 'utf8').catch(() => null)) === body) return file
    }
    return undefined
  }

  /** The project's board files as Cloud holds them, by the folder's paths. */
  async function cloudFiles() {
    const { files } = await api(await h.token(), 'GET', `/v1/projects/${h.projectId}/board`)
    const root = `projects/${h.projectId}/`
    const out = new Map()
    for (const f of files) {
      if (f.content === null) continue
      const p = f.path.startsWith(root) ? f.path.slice(root.length) : f.path.startsWith('memory/') ? f.path : null
      if (p && !p.startsWith('triage/')) out.set(p, f.content)
    }
    return out
  }

  /** Every file Cloud holds against the folder's copy. Shared memory the project's agents do not read is not copied, so only checked where it is. */
  async function compare() {
    const files = await cloudFiles()
    const compared = []
    const wrong = []
    for (const [p, content] of files) {
      const local = await readFile(join(board, p), 'utf8').catch(() => null)
      if (local === null && p.startsWith('memory/') && !p.endsWith('e2e-note.md')) continue
      compared.push(p)
      if (local === null) wrong.push(`${p} missing`)
      else if (local !== content) wrong.push(`${p} differs`)
    }
    return { compared, wrong }
  }
})

