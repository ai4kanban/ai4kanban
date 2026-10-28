#!/usr/bin/env node
// End-to-end, on production: Runner A is killed mid-build. A second Runner B, on the same
// account with its own copy of the project, must not take the task; once A is back it resumes
// and finishes the task exactly once. `npm run e2e:takeover`; options and
// requirements are in harness.mjs.

import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { codeSignIn } from './account.mjs'
import { waitFor } from './browser.mjs'
import { MIN, api, harness, sleep } from './harness.mjs'
import { WEB, literal } from './prod.mjs'
import { seedHome, startRunner } from './runner.mjs'

// The sleep keeps the build running long enough to be killed in the middle.
const REQUEST = 'Add a `--version` flag to the CLI in cli.mjs: `node cli.mjs --version` prints the version from package.json and exits 0. Keep the existing greeting unchanged. After editing, run the shell command `sleep 120` before you commit.'
const LAPSE = 20 * MIN

const h = await harness({
  name: 'takeover',
  title: 'a killed run waits for its own Runner',
  watch: {
    task: { sees: 'Workers Logs; the task row in the database', gap: 'No alert when task creation fails from the web app; browser errors are not collected.' },
    plan: { sees: 'cloud.runner_jobs, read by hand; the task page while it runs', gap: 'No alert for a job queued or running past a limit.' },
    claimed: { sees: 'cloud.runner_jobs, read by hand', gap: 'None beyond the job row.' },
    kill: { sees: 'nothing: a Runner that dies sends nothing', gap: 'Nothing notices a Runner dying mid-run; Cloud only learns of it when the lease runs out.' },
    seen: { sees: 'the task page, which keeps saying Running', gap: 'For up to the 15-minute lease the user is told the task is running on a computer that is gone.' },
    lapse: { sees: 'cloud.runners.live_until and cloud.runner_jobs.lease_expires_at, read by hand', gap: 'No alert or count of leases that lapse, nor of Runners that stop renewing.' },
    second: { sees: 'Workers Logs record the refused `POST /v1/runner` (AKB22)', gap: 'No count of second computers refused while the first is still counted as connected.' },
    stays: { sees: 'cloud.runner_jobs (`machine_id`, `claimed_machine`), read by hand', gap: 'No alert for a task waiting on a computer that is offline; it waits silently.' },
    interrupted: { sees: "the job's `reason` in cloud.runner_jobs; the task page", gap: 'No count of runs ended by a Runner that stopped.' },
    back: { sees: 'Workers Logs record the refused `POST /v1/runner`', gap: 'No record of how long a returning computer is refused.' },
    finish: { sees: 'cloud.runner_jobs and the task page', gap: 'No alert for a build stuck or failed after its Runner came back.' },
    landed: { sees: "the task's `landing`", gap: 'Nothing checks that a landed commit is on the branch, or that it landed once.' },
    runs: { sees: 'cloud.runner_jobs states, by hand', gap: 'No sweep or alert for runs left "running" after their Runner stopped.' },
  },
})

const jobs = (task) => h.sql(`select id, seq, state, outcome, reason, attempt, machine_id, claimed_machine, flow ->> 'verb' as verb,
  lease_expires_at < now() as lapsed, created_at, finished_at from cloud.runner_jobs where task_id = ${literal(task)} order by seq`)
const presence = () => h.sql(`select machine_id, live_until < now() as gone, live_until from cloud.runners where owner_id = ${literal(h.account.subject ?? '')}`)

/** Every pid under `root`, `root` included. */
function tree(root) {
  const rows = execFileSync('ps', ['-axo', 'pid=,ppid='], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().split('\n').map((l) => l.trim().split(/\s+/).map(Number))
  const out = [root]
  for (let i = 0; i < out.length; i++) for (const [pid, ppid] of rows) if (ppid === out[i]) out.push(pid)
  return out
}

const alive = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const cliCommits = (dir) => execFileSync('git', ['log', '--format=%h', 'main', '--', 'cli.mjs'], { cwd: dir }).toString().trim().split('\n').filter(Boolean)

await h.run(async () => {
  await h.setUp()
  const { page } = h
  const A = { machine: h.machineId, project: h.project, runner: h.runner }
  const B = { project: join(h.root, 'sample-b'), home: join(h.root, 'wildcrane-b'), log: join(h.root, 'runner-b.log'), runner: null }
  h.account.subject ??= JSON.parse(Buffer.from((await h.token()).split('.')[1], 'base64url')).sub
  // Computer B's own copy, as a second computer would clone it; it pushes nowhere.
  execFileSync('git', ['clone', '-q', A.project, B.project])
  execFileSync('git', ['remote', 'remove', 'origin'], { cwd: B.project })
  const before = { A: cliCommits(A.project), B: cliCommits(B.project) }

  try {
    let task
    await h.step('task', 'Create the task in the web app', async () => {
      task = await h.createTask(REQUEST)
      return task.key
    })

    await h.step('plan', 'Runner A plans it', async () => {
      task = await h.watchTask(task.id, (t) => t.status === 'waiting_review', 30 * MIN)
      if (task.status !== 'waiting_review') throw new Error(`ended ${task.status}`)
    }, { slowAfter: 10 * MIN })

    let killed
    await h.step('claimed', 'Approve it; Runner A starts building', async () => {
      await api(await h.token(), 'POST', `/v1/tasks/${task.id}/decisions`, { decision: 'approve', review_revision: task.review?.revision ?? 1 })
      killed = await waitFor(async () => (await jobs(task.id)).find((j) => j.verb === 'implement' && j.state === 'claimed'), 10 * MIN, 'no build was claimed in 10 minutes', 5_000)
      if (killed.claimed_machine !== A.machine) throw new Error(`the build went to ${killed.claimed_machine}, not Runner A`)
      // Into the middle of the build: past the edit, inside the sleep.
      await sleep(45_000)
      const now = (await jobs(task.id)).find((j) => j.id === killed.id)
      if (now.state !== 'claimed') throw new Error(`the build ended (${now.outcome}) before it could be killed`)
      return `job ${killed.id.slice(0, 8)} on A`
    })

    let killedAt
    await h.step('kill', "Kill Runner A's whole process tree", async () => {
      const pids = tree(A.runner.pid)
      for (const pid of pids) try { process.kill(pid, 'SIGKILL') } catch {}
      killedAt = Date.now()
      await sleep(2_000)
      const left = pids.filter(alive)
      if (left.length) throw new Error(`${left.length} process(es) still alive: ${left.join(', ')}`)
      h.runner = null
      return `${pids.length} processes`
    })

    await h.step('seen', 'What the web shows a minute later', async () => {
      await sleep(60_000)
      const t = await api(await h.token(), 'GET', `/v1/tasks/${task.id}`)
      await page.goto(`${WEB}/tasks/${encodeURIComponent(task.key)}`)
      await sleep(5_000)
      const running = /\bRUNNING\b/.test(await page.text())
      if (running) h.notes.push('A minute after Runner A died, the task page still says Running, with nothing to show the computer is gone.')
      return `API ${t.status}${t.run?.state ? `/${t.run.state}` : ''}; page ${running ? 'Running' : 'not Running'}`
    })

    let lapsedAt
    await h.step('lapse', "A's hold on the build and its connection run out", async () => {
      await waitFor(async () => {
        const job = (await jobs(task.id)).find((j) => j.id === killed.id)
        const [row] = await presence()
        return (job.state !== 'claimed' || job.lapsed) && row?.gone
      }, LAPSE, `still held after ${LAPSE / MIN} minutes`, 30_000)
      lapsedAt = Date.now()
      return `${Math.round((lapsedAt - killedAt) / MIN)} minutes after the kill`
    }, { slowAfter: 16 * MIN })

    await h.step('second', 'Connect Runner B with its own copy of the project', async () => {
      B.machine = await seedHome(B.home, await codeSignIn(h.account.email, h.env.RESEND_API_KEY), B.project)
      B.runner = h.runner = startRunner(h.built, B.home, B.log)
      await waitFor(async () => {
        if (B.runner.exited() !== null) throw Object.assign(new Error(`Runner B exited (${B.runner.exited()})`), { fatal: true })
        const { runner } = await api(await h.token(), 'GET', '/v1/runner')
        return runner && JSON.stringify(runner).includes(B.machine)
      }, 3 * MIN, 'Runner B did not connect within 3 minutes', 5_000)
      const folder = await api(await h.token(), 'POST', '/v1/runner/folders', { machineId: B.machine, name: 'sample', path: B.project, project: h.projectId })
      if (folder.folder?.project !== h.projectId) throw new Error(`B's folder went to ${folder.folder?.project}, not the sample project`)
      return `${Math.round((Date.now() - lapsedAt) / 1000)}s after the lapse`
    })

    await h.check('stays', 'Runner B does not take the build', async () => {
      await sleep(5 * MIN)
      const all = await jobs(task.id)
      const taken = all.filter((j) => j.claimed_machine === B.machine)
      if (taken.length) throw new Error(`B claimed ${taken.length} job(s) of the task`)
      const now = cliCommits(B.project)
      if (now.length !== before.B.length) throw new Error(`B's copy gained ${now.length - before.B.length} commit(s) to cli.mjs`)
      const last = all.at(-1)
      return `newest job (attempt ${last.attempt}) is ${last.state} for ${last.machine_id === A.machine ? 'A' : last.machine_id ?? 'any computer'}`
    })

    await h.check('interrupted', "A's run is marked interrupted, not running", async () => {
      const job = (await jobs(task.id)).find((j) => j.id === killed.id)
      if (job.state === 'claimed' && !job.lapsed) throw new Error('the killed run is still held as running')
      await page.goto(`${WEB}/tasks/${encodeURIComponent(task.key)}`)
      await sleep(5_000)
      if (/\bRUNNING\b/.test(await page.text())) h.notes.push('With Runner A gone and its hold lapsed, the task page still says Running.')
      return job.reason ?? job.state
    })

    // B cannot have it, so the person goes back to computer A.
    await h.step('back', 'Stop B; Runner A comes back', async () => {
      await B.runner.stop()
      const stopped = Date.now()
      h.runner = null
      let refused = 0
      await waitFor(async () => {
        A.runner = startRunner(h.built, h.home, h.runnerLog)
        await sleep(20_000)
        if (A.runner.exited() === null) {
          const { runner } = await api(await h.token(), 'GET', '/v1/runner')
          if (runner && JSON.stringify(runner).includes(A.machine)) return true
        }
        refused++
        await A.runner.stop()
        return false
      }, LAPSE, `A was not let back in ${LAPSE / MIN} minutes`, 30_000)
      h.runner = A.runner
      const waited = Math.round((Date.now() - stopped) / MIN)
      if (refused) h.notes.push(`With B stopped, computer A was refused for ${waited} minute(s) because B still counted as connected.`)
      return refused ? `let in after ${waited} minute(s), ${refused} refusal(s)` : 'connected at once'
    })
    await h.step('finish', 'The task ends done', async () => {
      task = await api(await h.token(), 'GET', `/v1/tasks/${task.id}`)
      if (['failed', 'stopped'].includes(task.status)) {
        h.notes.push(`The killed build left the task ${task.status}${task.failure ? ` ("${task.failure}")` : ''}; it went on only after Resume.`)
        await api(await h.token(), 'POST', `/v1/tasks/${task.id}/resume`)
      }
      task = await h.watchTask(task.id, (t) => ['done', 'failed', 'cancelled', 'stopped'].includes(t.status), 30 * MIN)
      if (task.status !== 'done') throw new Error(`ended ${task.status}${task.failure ? `: ${task.failure}` : ''}`)
    }, { slowAfter: 20 * MIN })

    await h.check('landed', "Exactly one copy of the change, on A's main only", async () => {
      const commit = task.landing?.commit
      if (!commit) throw new Error('the task reports no landing commit')
      const has = (dir) => { try { execFileSync('git', ['merge-base', '--is-ancestor', commit, 'main'], { cwd: dir, stdio: 'ignore' }); return true } catch { return false } }
      if (!has(A.project)) throw new Error(`the landing ${commit.slice(0, 8)} is not on A's main`)
      if (has(B.project)) throw new Error(`the landing ${commit.slice(0, 8)} is on B's main too`)
      const added = { A: cliCommits(A.project).length - before.A.length, B: cliCommits(B.project).length - before.B.length }
      if (added.A !== 1 || added.B) throw new Error(`A's main gained ${added.A} and B's ${added.B} commit(s) to cli.mjs`)
      const { version } = JSON.parse(await readFile(join(A.project, 'package.json'), 'utf8'))
      const out = execFileSync('node', ['cli.mjs', '--version'], { cwd: A.project }).toString().trim()
      if (!out.includes(version)) throw new Error(`\`node cli.mjs --version\` printed "${out}"`)
      return `${commit.slice(0, 8)} on A`
    })

    await h.check('runs', 'Every run is recorded and none is left running', async () => {
      const all = await jobs(task.id)
      const open = all.filter((j) => j.state === 'claimed' && !j.lapsed || j.state === 'waiting')
      if (open.length) throw new Error(`${open.length} run(s) still ${open.map((j) => j.state).join(', ')}`)
      h.sections.push({ heading: 'Runs of the task', lines: ['| Attempt | Step | Computer | State | Reason |', '| --- | --- | --- | --- | --- |', ...all.map((j) =>
        `| ${j.attempt} | ${j.verb ?? ''} | ${j.claimed_machine === A.machine ? 'A' : j.claimed_machine === B.machine ? 'B' : j.machine_id === A.machine ? '(for A)' : j.machine_id === B.machine ? '(for B)' : '—'} | ${j.state}${j.outcome ? ` / ${j.outcome}` : ''} | ${(j.reason ?? '').replace(/\|/g, '/')} |`)] })
      return `${all.length} run(s), all ended`
    })
  } finally {
    await B.runner?.stop()
    if (h.runner !== A.runner) await A.runner?.stop()
  }
})
