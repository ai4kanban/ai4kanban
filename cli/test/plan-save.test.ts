import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, it } from 'node:test'

import { chatFile, noteChatMessage, readChat } from '../src/lib/agent/chat.ts'
import { startDiscussion } from '../src/lib/agent/discussions.ts'
import { readDiscuss } from '../src/lib/agent/discuss.ts'
import { migratePlans } from '../src/lib/agent/migrate-plans.ts'
import { savePlan } from '../src/lib/agent/save-plan.ts'
import { CHATS_DIR, KANBAN, PLANS, setBoardRoot, setBoardDir } from '../src/lib/paths.ts'
import { archivePlan, planFile, planFromText, readPlan } from '../src/lib/plans.ts'
import { restoreMachineHome } from './helpers/board.ts'

let root = ''
let home = ''
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-plan-save-'))
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-plan-home-'))
  process.env.AI4KANBAN_HOME = home
  fs.mkdirSync(path.join(root, 'docs/kanban'), { recursive: true })
  setBoardRoot(root)
})
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
  fs.rmSync(home, { recursive: true, force: true })
  restoreMachineHome()
})

it('moves existing plans and recovers unique discussion links without allocating ids', async () => {
  const target = startDiscussion()
  noteChatMessage(target, 'Saved docs/kanban/plans/625-outcome.md')
  const legacy = path.join(KANBAN, 'plans')
  fs.mkdirSync(path.join(legacy, 'archive'), { recursive: true })
  fs.writeFileSync(path.join(KANBAN, 'next-id'), '627\n')
  fs.writeFileSync(path.join(legacy, '625-outcome.md'), '# Outcome\n')
  fs.writeFileSync(path.join(legacy, 'archive/624-done.md'), '# Done\n')
  assert.equal(migratePlans(), 2)
  assert.equal(migratePlans(), 0)
  assert.equal(fs.existsSync(legacy), false)
  assert.equal(fs.readFileSync(path.join(KANBAN, 'next-id'), 'utf8'), '627\n')
  assert.equal((await readDiscuss(target)).plan?.text, '# Outcome\n')
  assert.equal(readChat(target)?.plans?.length, 1)
  const source = planFromText('docs/kanban/plans/625-outcome.md')!
  archivePlan(source)
  assert.equal(readPlan(source)?.text, '# Outcome\n')
  assert.equal(readPlan('plans/624-done.md')?.text, '# Done\n')
})

it('preserves conflicting bodies for an explicit resolution', () => {
  fs.mkdirSync(path.join(KANBAN, 'plans'), { recursive: true })
  fs.mkdirSync(PLANS, { recursive: true })
  fs.writeFileSync(path.join(KANBAN, 'plans/625-outcome.md'), '# Legacy\n')
  fs.writeFileSync(path.join(PLANS, '625-outcome.md'), '# Local\n')
  assert.throws(migratePlans, /conflict/)
  assert.equal(fs.readFileSync(path.join(KANBAN, 'plans/625-outcome.md'), 'utf8'), '# Legacy\n')
  assert.equal(readPlan('plans/625-outcome.md')?.text, '# Local\n')
})

it('restores the previous body when association fails', () => {
  const rel = 'plans/625-outcome.md'
  savePlan(null, rel, '# Before\n')
  fs.mkdirSync(`${chatFile(null)}.tmp`)
  assert.throws(() => savePlan(null, rel, '# After\n'))
  assert.equal(readPlan(rel)?.text, '# Before\n')
  assert.throws(() => savePlan(null, 'plans/626-new.md', '# New\n'))
  assert.equal(fs.existsSync(planFile('plans/626-new.md')!), false)
})

it('isolates project and board storage and rejects foreign absolute paths', () => {
  savePlan(null, 'plans/625-outcome.md', '# One\n')
  const original = planFile('plans/625-outcome.md')!
  assert.ok(original.startsWith(path.join(fs.realpathSync(root), '.akb')))
  assert.ok(CHATS_DIR.startsWith(path.dirname(PLANS)))
  setBoardDir(path.join(root, 'marketing/kanban'), root)
  assert.notEqual(planFile('plans/625-outcome.md'), original)
  assert.equal(planFromText(original), null)
  assert.equal(readPlan('plans/625-outcome.md')?.text, '')
  assert.equal(planFile('../625-outcome.md'), null)
})

it('retains a child-written plan when the host finishes the chat transcript', async () => {
  const { sendChatMessage } = await import('../src/lib/agent/chat.ts')
  const target = startDiscussion()
  const agent = path.join(root, 'agent.mjs')
  fs.writeFileSync(agent, `
    import fs from 'node:fs';
    const chats = ${JSON.stringify(chatFile(target))};
    const plans = ${JSON.stringify(PLANS)};
    fs.mkdirSync(plans, {recursive:true});
    fs.writeFileSync(plans + '/625-outcome.md', '# Outcome\\n');
    const chat = JSON.parse(fs.readFileSync(chats, 'utf8'));
    chat.plans = [{path:'plans/625-outcome.md', title:'Outcome'}];
    fs.writeFileSync(chats, JSON.stringify(chat));
    console.log(JSON.stringify({type:'result', subtype:'success', result:'Saved'}));
  `)
  fs.writeFileSync(path.join(KANBAN, 'ui.config.json'), JSON.stringify({
    harness: 'claude-code', harnessSettings: { 'claude-code': { command: `node ${agent}` } },
  }))
  const reply = await sendChatMessage(target, 'Save this outcome')
  assert.ok(!('error' in reply))
  assert.equal((await readDiscuss(target)).plan?.text, '# Outcome\n')
  assert.equal(readChat(target)?.plans?.length, 1)
  assert.equal(readChat(target)?.messages.at(-1)?.text, 'Saved')
})
