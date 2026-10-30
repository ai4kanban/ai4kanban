#!/usr/bin/env node
// End-to-end, on production: one task from the web app to code landed on a project's main.
// `npm run e2e:mainline`; options and requirements are in harness.mjs.

import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { launchBrowser, waitFor } from './browser.mjs'
import { MIN, api, harness } from './harness.mjs'
import { WEB, literal } from './prod.mjs'

const REQUEST = 'Add a `--version` flag to the CLI in cli.mjs: `node cli.mjs --version` prints the version from package.json and exits 0. Keep the existing greeting unchanged.'

const h = await harness({
  name: 'mainline',
  title: 'one task from the web to landed code',
  watch: {
    task: { sees: 'Workers Logs; the task row in the database', gap: 'No alert when task creation fails from the web app; browser errors are not collected.' },
    plan: { sees: 'cloud.runner_jobs, read by hand; the task page shows the run while it runs', gap: 'No alert for a job queued or running past a limit, and no record of how long planning takes.' },
    share: { sees: 'Workers Logs', gap: 'No alert when a share link fails to open; the review page sends no errors anywhere.' },
    approve: { sees: 'Workers Logs; the decision row', gap: 'No alert when a decision is refused or does not start the build.' },
    build: { sees: 'cloud.runner_jobs and the task page', gap: 'No alert for a build stuck, failed, or landed nowhere; only the owner sees it, on the task page.' },
    landed: { sees: "The task's `landing` and the diff route", gap: 'Nothing checks that a landed commit is really on the branch; a lost landing reads as done.' },
    runs: { sees: 'cloud.runner_jobs states, by hand', gap: 'No sweep or alert for runs left "running" after their Runner stopped.' },
  },
})

await h.run(async () => {
  await h.setUp()
  const { page, account, env } = h

  let task
  await h.step('task', 'Create the task in the web app', async () => {
    task = await h.createTask(REQUEST)
    return task.key
  })

  const seen = []
  await h.step('plan', 'Runner plans it; the web shows it waiting for review', async () => {
    task = await h.watchTask(task.id, (t) => t.status === 'waiting_review', 30 * MIN, seen)
    await page.goto(`${WEB}/tasks/${encodeURIComponent(task.key)}`)
    await waitFor(async () => /\bTO REVIEW\b|ready for your approval/.test(await page.text()), 30_000, 'timeout').catch(async () => {
      throw new Error(`the task page does not say it is waiting for review: ${(await page.text()).replace(/\s+/g, ' ').slice(0, 400)}`)
    })
    return seen.map((s) => s.status).join(' → ')
  }, { slowAfter: 10 * MIN })

  await h.step('share', 'A visitor who is not signed in opens the share link', async () => {
    const link = await api(await h.token(), 'POST', `/v1/tasks/${task.id}/share-links`, { access: 'link' })
    const visitor = await launchBrowser()
    try {
      const anon = await visitor.page()
      await anon.goto(link.url)
      const text = await waitFor(async () => {
        const t = await anon.text()
        return t.includes('--version') ? t : undefined
      }, 30_000, 'the review page did not show the task to a visitor')
      if (/\b(Implement|Refine)\b/.test(text)) h.notes.push('A visitor who is not signed in is offered the button that approves the plan.')
    } finally {
      await visitor.close()
    }
    return link.url.replace(/[^/]+$/, '…')
  })

  await h.step('approve', 'The signed-in owner opens the share link, lands on the task page and approves', async () => {
    const invited = await api(await h.token(), 'POST', `/v1/tasks/${task.id}/share-links`, { access: 'invited' })
    await page.goto(invited.url)
    // The approve button names what approving starts: Implement, or Refine.
    await waitFor(async () => /\b(Implement|Refine)\b/.test(await page.text()), 30_000, 'the signed-in owner has no Implement after opening the share link')
    await page.click(/^(Implement|Refine)$/)
    await waitFor(async () => (await api(await h.token(), 'GET', `/v1/tasks/${task.id}`)).status !== 'waiting_review', 60_000, 'Implement did not move the task on')
  })

  await h.step('build', 'Runner implements, reviews and lands it', async () => {
    task = await h.watchTask(task.id, (t) => ['done', 'failed', 'cancelled', 'stopped'].includes(t.status) || (t.status === 'waiting_review' && t.review?.revision > 1), 45 * MIN, seen)
    if (task.status !== 'done') throw new Error(`ended ${task.status}${task.failure ? `: ${JSON.stringify(task.failure).slice(0, 200)}` : ''}`)
    await page.goto(`${WEB}/tasks/${encodeURIComponent(task.key)}`)
    // The status pill is set in capitals; the run log's own "Done" lines do not count.
    await waitFor(async () => /\bDONE\b/.test(await page.text()), 30_000, 'the task page does not say Done')
    return seen.map((s) => s.status).join(' → ')
  }, { slowAfter: 20 * MIN })

  await h.step('landed', "The change is on the sample project's main and works", async () => {
    const commit = task.landing?.commit
    if (!commit) throw new Error('the task reports no landing commit')
    if (h.git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') throw new Error('the sample project is no longer on main')
    h.git('merge-base', '--is-ancestor', commit, 'main')
    const { version } = JSON.parse(await readFile(join(h.project, 'package.json'), 'utf8'))
    const out = execFileSync('node', ['cli.mjs', '--version'], { cwd: h.project }).toString().trim()
    if (!out.includes(version)) throw new Error(`\`node cli.mjs --version\` printed "${out}"`)
    const greeting = execFileSync('node', ['cli.mjs', 'e2e'], { cwd: h.project }).toString().trim()
    if (greeting !== 'Hello, e2e!') throw new Error(`the greeting changed: "${greeting}"`)
    return `${commit.slice(0, 8)}; --version prints ${out}`
  })

  await h.step('runs', 'Every run is recorded and none is left running', async () => {
    const fresh = await api(await h.token(), 'GET', `/v1/tasks/${task.id}`)
    if (fresh.run?.state) throw new Error(`the task still has a run ${fresh.run.state}`)
    const jobs = await h.sql(`select state from cloud.runner_jobs where task_id = ${literal(task.id)}`)
    if (!jobs.length) throw new Error('no run of this task is recorded')
    const open = jobs.filter((j) => !['finished', 'interrupted'].includes(j.state))
    if (open.length) throw new Error(`${open.length} run(s) still ${open.map((j) => j.state).join(', ')}`)
    await page.goto(`${WEB}/tasks/${encodeURIComponent(task.key)}`)
    if (/\bRUNNING\b/.test(await page.text())) throw new Error('the task page still shows the task as Running')
    return `${jobs.length} run(s), all ended`
  })
})
