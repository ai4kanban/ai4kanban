// A workflow with **Use a Git worktree** off (#874): it works in the project with no branch,
// runs beside others, and ends on the files its card records — stopping when it recorded
// none, when one is missing, or when it changed a tracked file outside the board.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { activeDelivery, endDelivery, listDeliveries } from '../src/lib/agent/deliveries.ts'
import { printFlow } from '../src/lib/agent/flow.ts'
import { closeRun, openRun } from '../src/lib/agent/sessions.ts'
import { setAutoCommit } from '../src/lib/agent/settings.ts'
import { withStore } from '../src/lib/agent/store.ts'
import {
  createWorkflow,
  duplicateWorkflow,
  archivesOnApproval,
  setWorkflowWorktree,
  workflowById,
} from '../src/lib/agent/workflows.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { setBoardRoot, UI_CONFIG } from '../src/lib/paths.ts'
import { forgetFileMemos } from '../src/lib/file-memo.ts'

let root = ''

const kanban = (): string => path.join(root, 'docs', 'kanban')
const cardFile = (id: number): string => path.join(kanban(), 'todo', `${id}-card.md`)

const git = (args: string[]): string => {
  const out = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  if (out.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${out.stderr}`)
  return out.stdout.trim()
}

function card(id: number, workflow = ''): void {
  fs.writeFileSync(
    cardFile(id),
    [
      '---',
      `title: card ${id}`,
      'priority: med',
      'roi: med',
      'status: ready',
      'blocked_by: []',
      'related: []',
      'modules: []',
      'questions: []',
      ...(workflow ? [`workflow: ${workflow}`] : []),
      '---',
      '',
      'Write the email.',
      '',
      '<!-- agent -->',
      '',
      '## Scope',
      `- **A requirement**: ${id}.`,
      '',
      '## Todo',
      '- [ ] Write `out/draft.html`',
      '',
    ].join('\n'),
  )
}

// What the build leaves on the card: a ticked `Output:` todo naming the file.
const record = (id: number, file: string): void => fs.appendFileSync(cardFile(id), `- [x] Output: \`${file}\`\n`)

const write = (file: string, text = 'x\n'): void => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
  fs.writeFileSync(path.join(root, file), text)
}

// A board workflow of its own, left at its default.
const filesFlow = (): string => {
  const made = createWorkflow('Email')
  fs.writeFileSync(path.join(kanban(), 'workflows', made.id!, 'WORKFLOW.md'), `---\nname: Email\nneedsArtifact: true\nland: [builder]\n---\n`)
  forgetFileMemos()
  return made.id!
}

function open(id: number): string {
  const opened = openRun({ action: 'implement', id, title: `card ${id}` }, 'prompt', [])
  if ('error' in opened) throw new Error(opened.error)
  return opened.run.sessionId
}

async function end(sessionId: string): Promise<void> {
  const run = withStore((store) => store.runs.find((r) => r.sessionId === sessionId))
  fs.writeFileSync(run!.logPath, 'log\n')
  await closeRun(sessionId, { status: 'done', ok: true, code: 0 })
}

const flow = (action: 'implement', id: number): string => {
  const sink = startCollecting()
  try {
    printFlow({ action, id })
    return sink.out.join('\n')
  } finally {
    stopCollecting()
  }
}

const recordOf = (id: string) => listDeliveries().find((d) => d.deliveryId === id)!

beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'akb-files-')))
  fs.mkdirSync(path.join(kanban(), 'todo'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'todo', 'README.md'), '# Tasks\n\n## Tasks\n')
  fs.writeFileSync(path.join(root, 'shared.txt'), 'base\n')
  fs.writeFileSync(path.join(root, 'mine.txt'), 'base\n')
  git(['init', '--quiet', '-b', 'main'])
  git(['config', 'user.email', 'test@example.com'])
  git(['config', 'user.name', 'test'])
  git(['add', '-A'])
  git(['commit', '--quiet', '-m', 'start'])
  setBoardRoot(root)
  setAutoCommit(true)
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('Use a Git worktree', () => {
  it('is off on a new workflow', () => {
    assert.equal(workflowById(createWorkflow('Notes').id!)!.needsArtifact, true)
  })

  it('turns on and off for the board’s own, and stays put after a reread', () => {
    const id = filesFlow()
    assert.equal(setWorkflowWorktree(id, true).ok, true)
    assert.equal(workflowById(id)!.needsArtifact, false)
    assert.equal(setWorkflowWorktree(id, false).ok, true)
    assert.equal(workflowById(id)!.needsArtifact, true)
  })

  it('is fixed on a built-in: on for Coding, off for Product video', () => {
    assert.equal(workflowById('coding')!.needsArtifact, false)
    assert.equal(workflowById('hyperframes-video')!.needsArtifact, true)
    assert.match(setWorkflowWorktree('coding', false).error ?? '', /built in/)
  })

  it('comes with a copy', () => {
    assert.equal(workflowById(duplicateWorkflow('coding').id!)!.needsArtifact, false)
    const video = workflowById(duplicateWorkflow('slide-deck').id!)!
    assert.equal(video.needsArtifact, true)
    assert.equal(archivesOnApproval(video), true)
  })

  it('changes only deliveries started afterwards', () => {
    const id = filesFlow()
    card(1, id)
    open(1)
    setWorkflowWorktree(id, true)
    assert.equal(activeDelivery(1)!.commitMode, 'files')
    assert.match(flow('implement', 1), /Use a Git worktree: disabled/)
  })
})

describe('a files delivery', () => {
  it('works in the project with no branch, beside another, from a dirty checkout', () => {
    const id = filesFlow()
    card(1, id)
    card(2, id)
    write('mine.txt', 'the user is editing this\n')
    open(1)
    open(2)
    for (const n of [1, 2]) {
      const d = activeDelivery(n)!
      assert.equal(d.commitMode, 'files')
      assert.equal(d.worktree, undefined)
      assert.equal(d.branch, undefined)
    }
    assert.equal(git(['branch', '--list']), '* main')
  })

  it('archives the card once the recorded file is there, and lands nothing', async () => {
    card(1, filesFlow())
    const session = open(1)
    const delivery = activeDelivery(1)!
    write('out/email.html')
    record(1, 'out/email.html')
    await end(session)
    const done = recordOf(delivery.deliveryId)
    assert.equal(done.status, 'finished')
    assert.equal(done.landing, undefined)
    assert.equal(fs.existsSync(cardFile(1)), false)
    assert.equal(git(['log', '--oneline']).split('\n').length, 1)
  })

  it('stops when the card records no file — ticking a planned todo is not a record', async () => {
    card(1, filesFlow())
    const session = open(1)
    fs.writeFileSync(cardFile(1), fs.readFileSync(cardFile(1), 'utf8').replace('- [ ]', '- [x]'))
    await end(session)
    const stopped = activeDelivery(1)!.review?.stopped
    assert.equal(stopped?.reason, 'output')
    assert.deepEqual(stopped?.paths, [])
    assert.equal(fs.existsSync(cardFile(1)), true)
  })

  it('takes a planned todo reworded after its text as progress, not a record (#1921)', async () => {
    card(1, filesFlow())
    const session = open(1)
    const body = fs.readFileSync(cardFile(1), 'utf8')
    fs.writeFileSync(cardFile(1), body.replace('- [ ] Write `out/draft.html`', '- [x] Write `out/draft.html` — kept `template.md`'))
    await end(session)
    const stopped = activeDelivery(1)!.review?.stopped
    assert.equal(stopped?.reason, 'output')
    assert.deepEqual(stopped?.paths, [])
  })

  it('reads a bare file name as no output', async () => {
    card(1, filesFlow())
    const session = open(1)
    record(1, 'template.md')
    await end(session)
    assert.deepEqual(activeDelivery(1)!.review?.stopped?.paths, [])
  })

  it('takes `./x.md` and a folder as outputs', async () => {
    card(1, filesFlow())
    const session = open(1)
    const delivery = activeDelivery(1)!
    write('x.md')
    write('out/email/index.html')
    record(1, './x.md')
    record(1, './out/email/')
    await end(session)
    assert.equal(recordOf(delivery.deliveryId).status, 'finished')
  })

  it('takes only an `Output:` line as a record, not a path in another ticked todo', async () => {
    card(1, filesFlow())
    const session = open(1)
    write('out/email.html')
    fs.appendFileSync(cardFile(1), '- [x] Wrote `out/email.html`\n')
    await end(session)
    assert.equal(activeDelivery(1)!.review?.stopped?.reason, 'output')
  })

  // #1923: a first delivery ticked its todos, naming a draft it later deleted and a wildcard,
  // and recorded an output; a second one picks the card up from there.
  async function secondDelivery(): Promise<string> {
    card(1, filesFlow())
    const first = open(1)
    const body = fs.readFileSync(cardFile(1), 'utf8')
    fs.writeFileSync(cardFile(1), body.replace('- [ ] Write `out/draft.html`', '- [x] Write `out/draft.html` and `out/page-4x5-*.png`'))
    write('out/old.html')
    record(1, 'out/old.html')
    endDelivery(activeDelivery(1)!.deliveryId, 'cancelled')
    await end(first)
    return open(1)
  }

  it('takes only the `Output:` line the delivery added (#1941)', async () => {
    const session = await secondDelivery()
    const delivery = activeDelivery(1)!
    write('out/email/index.html')
    record(1, 'out/email/')
    await end(session)
    assert.equal(recordOf(delivery.deliveryId).status, 'finished')
  })

  it('stops when the delivery added no `Output:` line, whatever earlier ones recorded', async () => {
    const session = await secondDelivery()
    await end(session)
    const stopped = activeDelivery(1)!.review?.stopped
    assert.equal(stopped?.reason, 'output')
    assert.deepEqual(stopped?.paths, [])
  })

  it('stops naming a recorded file that is not there', async () => {
    card(1, filesFlow())
    const session = open(1)
    record(1, 'out/gone.html')
    await end(session)
    assert.deepEqual(activeDelivery(1)!.review?.stopped?.paths, ['out/gone.html'])
  })

  it('stops on a tracked file it changed outside the board, and reverts nothing', async () => {
    write('mine.txt', 'already changed\n')
    card(1, filesFlow())
    const session = open(1)
    write('shared.txt', 'changed by the run\n')
    write('out/email.html')
    record(1, 'out/email.html')
    await end(session)
    const stopped = activeDelivery(1)!.review?.stopped
    assert.equal(stopped?.reason, 'outside')
    assert.deepEqual(stopped?.paths, ['shared.txt'])
    assert.equal(fs.readFileSync(path.join(root, 'shared.txt'), 'utf8'), 'changed by the run\n')
  })

  it('asks the build for recorded files, and for no commit or landing', () => {
    card(1, filesFlow())
    open(1)
    const build = flow('implement', 1)
    assert.match(build, /add one new ticked `## Todo` line naming the output file or folder, never a wildcard/)
    assert.match(build, /do not create a branch or worktree, commit, or merge/)
    assert.match(build, /The board archives it after the output files pass the delivery checks/)
    assert.doesNotMatch(build, /leave your work uncommitted|once the delivery has landed|Review comes next/)
  })

  it('leaves a coding card on its own branch', () => {
    card(1)
    open(1)
    assert.equal(activeDelivery(1)!.commitMode, 'auto')
    assert.ok(activeDelivery(1)!.branch)
  })
})
