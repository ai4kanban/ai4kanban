// A stand-in for the akb the Runner carries: the moves a flow job makes, on a plain folder.
// `FAKE_AKB` (JSON) says how each card verb goes; every call is logged to `FAKE_AKB_LOG`.
// A verb with `hang` leaves its run running and follows it until stopped; `chain` more runs
// start, one per stop, as a delivery's next stage would. A card with a running run refuses a
// verb, as akb's own `cardBusy` does; a test lays one down in `.fake/runs.json`.

import fs from 'node:fs'
import path from 'node:path'

const argv = process.argv.slice(2)
fs.appendFileSync(process.env.FAKE_AKB_LOG, `${JSON.stringify(argv)}\n`)
const cut = argv.indexOf('--')
const words = cut < 0 ? argv : argv.slice(0, cut)
const text = cut < 0 ? '' : argv.slice(cut + 1).join(' ')
const flag = (name) => (words.includes(name) ? words[words.indexOf(name) + 1] : undefined)
const board = flag('--board')
if (words[0] === 'skill' && words[1] === 'install') {
  for (const f of ['.claude/skills/kanban', '.agents/skills/kanban']) {
    fs.mkdirSync(path.join(flag('--dir'), f), { recursive: true })
    fs.writeFileSync(path.join(flag('--dir'), f, 'SKILL.md'), 'kanban\n')
  }
  process.exit(0)
}
const plan = JSON.parse(process.env.FAKE_AKB || '{}')
const state = path.join(board, '.fake')
fs.mkdirSync(state, { recursive: true })
const read = (name, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(state, name), 'utf8'))
  } catch {
    return fallback
  }
}
const write = (name, value) => fs.writeFileSync(path.join(state, name), JSON.stringify(value))
const cardOf = (id) => {
  for (const dir of ['todo', '.archive']) {
    const hit = fs.readdirSync(path.join(board, dir), { withFileTypes: true }).find((e) => e.name.startsWith(`${id}-`))
    if (hit) return path.join(board, dir, hit.name, hit.isDirectory() ? 'root.md' : '')
  }
  return null
}
const fail = (message) => {
  console.error(`akb: ${message}`)
  process.exit(1)
}

const [a, b, c] = words
if (a === 'raw' && b === 'init') {
  fs.mkdirSync(path.join(board, 'todo'), { recursive: true })
  fs.mkdirSync(path.join(board, '.archive'), { recursive: true })
  fs.writeFileSync(path.join(board, 'config.md'), '')
} else if (a === 'raw' && b === 'create') {
  fs.writeFileSync(path.join(state, 'task-env'), process.env.AI4KANBAN_TASK ?? '')
  if (!flag('--id')) fail("a card's number comes from Cloud")
  const id = Number(flag('--id'))
  if (cardOf(id)) {
    console.log(JSON.stringify({ ok: false, error: { kind: 'id-taken', message: `#${id} is already a card here` } }))
    process.exit(1)
  }
  const body = flag('--body-file') ? fs.readFileSync(flag('--body-file'), 'utf8') : ''
  const workflow = flag('--workflow') ? `workflow: ${flag('--workflow')}\n` : ''
  fs.writeFileSync(path.join(board, 'todo', `${id}-${(flag('--slug') ?? flag('--title')).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'task'}.md`), `---\ntitle: ${flag('--title')}\n${workflow}questions: []\n---\n\n${body}`)
  console.log(JSON.stringify({ ok: true, id }))
} else if (a === 'agent' && b === 'use') {
  fs.writeFileSync(path.join(state, 'agent'), c)
} else if (a === 'agent' && b === 'set' && c === 'model') {
  fs.writeFileSync(path.join(state, 'model'), words[3] && !words[3].startsWith('--') ? words[3] : '')
} else if (a === 'agent' && b === 'set' && c === 'mcpConfig') {
  // the file is the Runner's; nothing to keep
} else if (a === 'agent' && b === 'set' && c === 'args') {
  fs.writeFileSync(path.join(state, 'args'), text)
} else if (a === 'agent' && b === 'set') {
  // the runtime's other settings (#2135): nothing to keep
} else if (a === 'raw' && b === 'setup-done') {
  fs.appendFileSync(path.join(state, 'setup'), `${c}\n`)
} else if (a === 'card') {
  const how = plan[b] ?? {}
  if (how.refuse) fail(how.refuse)
  const id = Number(c)
  const file = cardOf(id)
  if (!file) fail(`no task with id ${id}`)
  const runs = read('runs.json', [])
  if (runs.some((r) => r.cardId === id && r.status === 'running')) fail(`#${id} is already being worked on`)
  // The board every `akb` the agent types reaches.
  fs.writeFileSync(path.join(state, 'agent-board'), process.env.AI4KANBAN_BOARD ?? '')
  // The discussion a Cloud task carries (#2146), gone once the job ends.
  if (flag('--transcript')) fs.writeFileSync(path.join(state, 'transcript'), fs.readFileSync(flag('--transcript'), 'utf8'))
  const sessionId = `run-${b}-${runs.length + 1}`
  console.log(`working on #${id}${text ? `: ${text}` : ''}`)
  if (words.includes('--events')) console.log(JSON.stringify({ kind: 'message', data: { text: `Read #${id}.` } }))
  // What the agent writes on the board besides the card.
  for (const [at, content] of Object.entries(how.writes ?? {})) {
    fs.mkdirSync(path.dirname(path.join(board, at)), { recursive: true })
    fs.writeFileSync(path.join(board, at), content)
  }
  let card = fs.readFileSync(file, 'utf8')
  if (how.question) card = card.replace('questions: []', `questions:\n  - Which tone?\n  - question: "[user] ${how.question}"\n    mode: single\n    options:\n      - Monthly\n      - Yearly\n    recommend: [1]`)
  fs.writeFileSync(file, `${card}\n${b} ${text}`.trimEnd() + '\n')
  // A follow-up proposed as `akb triage add` writes it.
  if (how.propose) {
    fs.mkdirSync(path.join(board, 'triage'), { recursive: true })
    fs.writeFileSync(path.join(board, 'triage', 'proposed.md'), `---\nsource_id: derived-1\ntitle: ${how.propose}\n${how.workflow === '' ? '' : `workflow: ${how.workflow ?? 'coding'}\n`}collected_at: 2026-10-26 09:00\nimported_at: 2026-10-26 09:00\n---\n\nWhy ${how.propose}.\n`)
  }
  // A build's last word is its review's, a later run than the one that started it.
  const last = b === 'implement' ? `run-review-${runs.length + 2}` : sessionId
  const spent = { startedAt: Date.now(), ...how.spent }
  if (how.hang) {
    runs.push({ sessionId, cardId: id, action: b, status: 'running', ...spent })
    write('runs.json', runs)
    setInterval(() => console.log('still working'), 50)
    await new Promise(() => {})
  }
  runs.push({ sessionId, cardId: id, result: how.result, ...spent }, ...(last !== sessionId ? [{ sessionId: last, cardId: id, result: how.landed ?? 'Landed it.', ...spent }] : []))
  write('runs.json', runs)
  // `ended`: the delivery record a `delivery cancel|discard|blocked` left meanwhile (#59).
  if (how.ended) {
    fs.mkdirSync(path.join(board, 'deliveries'), { recursive: true })
    fs.writeFileSync(path.join(board, 'deliveries', `${how.ended.deliveryId}.json`), JSON.stringify(how.ended))
  }
  if (how.failed) {
    const delivery = how.ended ? { delivery: { id: how.ended.deliveryId, status: how.ended.status } } : {}
    console.log(JSON.stringify({ ok: false, error: { kind: 'run-failed', message: `run ${last.slice(0, 8)} ended error: ${how.failed}`, lastSessionId: last, ...delivery } }))
    process.exit(1)
  }
  if (b === 'implement') fs.renameSync(file, path.join(board, '.archive', path.basename(file)))
  console.log(JSON.stringify({ ok: true, status: 'done', result: how.result, lastSessionId: last, ...(how.agentSession ? { agentSession: how.agentSession } : {}),
    ...(how.delivery ? { delivery: how.delivery } : {}) }))
} else if (a === 'delivery' && b === 'resume') {
  // `delivery` in FAKE_AKB: how carrying the card's ended delivery on goes (#2128).
  const how = plan.delivery ?? {}
  if (how.refuse) {
    console.log(JSON.stringify({ ok: false, error: { kind: 'run-refused', message: how.refuse } }))
    process.exit(1)
  }
  if (how.landed) fs.renameSync(cardOf(Number(c)), path.join(board, '.archive', path.basename(cardOf(Number(c)))))
  console.log(JSON.stringify({ ok: true, deliveryId: 'd1', ...(how.landed ? { landed: true } : { carryOn: 'build' }) }))
} else if (a === 'delivery' && b === 'discard') {
  // A discarded build (#61): its record keeps no checkout.
  const file = path.join(board, 'deliveries', `${c}.json`)
  fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(fs.readFileSync(file, 'utf8')), worktree: undefined, status: 'cancelled' }))
  console.log(JSON.stringify({ ok: true, deliveryId: c, discarded: true }))
} else if (a === 'run' && b === 'stop') {
  const runs = read('runs.json', [])
  const run = runs.find((r) => r.sessionId === c)
  if (!run) fail(`no run here answers to "${c}"`)
  if (run.status === 'running') {
    run.status = 'stopped'
    const chain = plan[run.action]?.chain ?? 0
    if (runs.filter((r) => r.action === run.action).length <= chain) {
      runs.push({ sessionId: `run-${run.action}-${runs.length + 1}`, cardId: run.cardId, action: run.action, status: 'running', startedAt: Date.now() })
    }
    write('runs.json', runs)
  }
  console.log(JSON.stringify({ ok: true, sessionId: c }))
} else if (a === 'review-memory') {
  // What a review writes: a workspace file and a project one, naming the tasks it read.
  const tasks = words.slice(words.indexOf('--task') + 1).filter((w, i, all) => !all.slice(0, i + 1).some((x) => x.startsWith('--')))
  const home = process.env.AI4KANBAN_HOME
  const said = tasks.map((t) => fs.readFileSync(path.join(home, 'chats', `${t}.jsonl`), 'utf8').trim().split('\n').map((l) => JSON.parse(l).text).join(' / '))
  for (const [file, line] of [['memory/agents/copywriting/style.md', 'Style'], ['memory/agents/copywriting/writing.md', 'Writing']]) {
    fs.mkdirSync(path.dirname(path.join(board, file)), { recursive: true })
    fs.appendFileSync(path.join(board, file), `${line}: ${said.join(' | ')}\n`)
  }
  fs.writeFileSync(path.join(state, 'reviewed'), JSON.stringify(tasks))
  console.log(JSON.stringify({ ok: true, status: 'done', result: `Reviewed ${tasks.length}.` }))
} else if (a === 'review-dismissals') {
  // What a review reads, as the board lays it out, and the note it writes.
  const how = plan['review-dismissals'] ?? {}
  const list = (dir) => (fs.existsSync(path.join(board, dir)) ? fs.readdirSync(path.join(board, dir)).filter((n) => n.endsWith('.md')).map((n) => `${dir}/${n}`) : [])
  const seen = [...list('.archive/.sync'), ...list('triage/dismissed'), ...list('triage/archived')]
  fs.writeFileSync(path.join(state, 'learned'), JSON.stringify({ args: words, seen: Object.fromEntries(seen.map((f) => [f, fs.readFileSync(path.join(board, f), 'utf8')])) }))
  if (how.failed) {
    console.log(JSON.stringify({ ok: false, error: { kind: 'run-failed', message: how.failed } }))
    process.exit(1)
  }
  fs.mkdirSync(path.join(board, 'memory', 'agents', 'planner'), { recursive: true })
  fs.writeFileSync(path.join(board, 'memory', 'agents', 'planner', 'rejected.md'), '- **No mobile app**: we never build one (#9)\n')
  const runs = read('runs.json', [])
  runs.push({ sessionId: 'run-review-dismissals', cardId: null, startedAt: Date.now(), ...how.spent })
  write('runs.json', runs)
  console.log(JSON.stringify({ ok: true, status: 'done', result: 'Learned one.' }))
} else if (a === 'workflow' && b === 'list') {
  const dir = path.join(board, 'workflows')
  const ids = fs.existsSync(dir) ? fs.readdirSync(dir) : []
  console.log(JSON.stringify({ ok: true, workflows: ids.map((id) => ({ id, problems: plan.workflowProblems ?? [] })), problems: [] }))
} else if (a === 'spec' && (!b || b.startsWith('--'))) {
  console.log(JSON.stringify({ ok: true, agents: [], problems: plan.specProblems ?? [] }))
} else if (a === 'reflect' || a === 'prune-memory' || a === 'describe-project' || (a === 'agent' && b === 'run')) {
  // A periodic agent (#2068): the note it writes, the task it works for, and a follow-up proposed.
  const name = a === 'agent' ? `${c}-${words[3]}` : a
  const how = plan[name] ?? {}
  fs.writeFileSync(path.join(state, 'periodic'), JSON.stringify({ args: words, task: process.env.AI4KANBAN_TASK ?? '' }))
  if (how.failed) {
    console.log(JSON.stringify({ ok: false, error: { kind: 'run-failed', message: `run x ended error: ${how.failed}` } }))
    process.exit(1)
  }
  fs.mkdirSync(path.join(board, 'memory'), { recursive: true })
  fs.writeFileSync(path.join(board, 'memory', `${name}.md`), `${name} ran.\n`)
  // Pruning drops the memory of an agent the board does not have.
  const kept = path.join(board, 'memory', 'agents')
  if (name === 'prune-memory' && fs.existsSync(kept)) {
    for (const agent of fs.readdirSync(kept)) {
      if (!['planner', 'proposer'].includes(agent) && !fs.existsSync(path.join(board, 'agents', agent, 'AGENT.md'))) fs.rmSync(path.join(kept, agent), { recursive: true })
    }
  }
  if (how.propose) {
    fs.mkdirSync(path.join(board, 'triage'), { recursive: true })
    fs.writeFileSync(path.join(board, 'triage', 'proposed.md'), `---\nsource_id: derived-1\ntitle: ${how.propose}\n${how.workflow === '' ? '' : `workflow: ${how.workflow ?? 'coding'}\n`}collected_at: 2026-10-26 09:00\nimported_at: 2026-10-26 09:00\n---\n\nWhy ${how.propose}.\n`)
  }
  const runs = read('runs.json', [])
  runs.push({ sessionId: `run-${name}`, cardId: null, startedAt: Date.now(), ...how.spent })
  write('runs.json', runs)
  console.log(JSON.stringify({ ok: true, status: 'done', result: `${name} done.` }))
} else if (a === 'run' && b === 'list') {
  const card = Number(flag('--card'))
  const all = read('runs.json', [])
  console.log(JSON.stringify({ ok: true, runs: flag('--card') ? all.filter((r) => r.cardId === card) : all }))
} else {
  fail(`the fake has no ${words.join(' ')}`)
}
