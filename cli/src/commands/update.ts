import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

import { takeLocalModels } from '../lib/agent/local'
import { migrateRuntimes, repairEnvFile } from '../lib/agent/runtimes'
import { agentNames } from '../lib/agent/roles'
import { runBoard } from '../lib/board-cli'
import { missingConfigKeys } from '../lib/config-template'
import { BoardError, say } from '../lib/io'
import { setBoardDir } from '../lib/paths'
import { goalWords } from '../lib/memory'
import { parseYamlBlock, splitFrontmatter } from '../lib/agents/yaml'
import type { MoveResult } from '../lib/types'
import { SKILL_VERSION } from '../version'

const NAME = 'wildcrane'
const REPO = 'https://github.com/wildcrane-ai/wildcrane'

export const NEWER_LINE = `npm install -g ${NAME}@latest`
const MEMORY_FILES = ['readme.md', 'goal.md', 'decisions.md', 'redesign.md', 'rejected.md']
const UNFILLED = '_(not filled in yet'

export interface SetupContext {
  dir: string
  program: string
  board?: string | null
}

class Report {
  did: string[] = []
  notes: string[] = []
  private reported = 0

  sayDid(): void {
    for (const line of this.did.slice(this.reported)) say(`  · ${line}`)
    this.reported = this.did.length
  }

  sayNotes(): void {
    if (!this.notes.length) return
    say('')
    say('Needs your attention:')
    for (const line of this.notes) say(`  ! ${line}`)
  }
}

const read = (file: string): string | null => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null)

function statOf(p: string): fs.Stats | null {
  try {
    return fs.lstatSync(p)
  } catch {
    return null
  }
}

async function boardMove(root: string, args: string[], board?: string | null): Promise<void> {
  const where = board ? ['--board', board] : ['--dir', root]
  const code = await runBoard([...args, ...where], { program: 'akb raw', cwd: root })
  if (code !== 0) throw new BoardError(`\`board ${args.join(' ')}\` failed — nothing else was changed`, { kind: 'board-move-failed' })
}

export async function cmdUpdate(ctx: SetupContext): Promise<MoveResult> {
  const report = new Report()
  say(`wildcrane ${SKILL_VERSION} — updating ${ctx.dir}`)
  const from = null
  say('')
  const repaired = await repairBoard(ctx.dir, report, ctx.board)
  report.sayDid()
  report.sayNotes()
  say('')
  if (repaired) say(`看板已检查至 ${SKILL_VERSION}。发布记录：${REPO}/releases`)
  say('Your cards, config, and memory were left alone. Review `git diff` before committing.')
  sayCommandVersion()
  return { updated: ctx.dir, from, to: SKILL_VERSION }
}

async function repairBoard(root: string, report: Report, named?: string | null): Promise<boolean> {
  const legacy = path.join(root, 'docs', 'kanban')
  const kept = path.join(root, '.akb', 'kanban')
  const board = named ?? (fs.existsSync(legacy) ? legacy : kept)
  if (!fs.existsSync(board)) {
    report.notes.push('未找到看板，请通过插件连接云端项目。')
    return false
  }
  moveLegacyMemory(board, report)
  dropModuleGoals(board, report)
  movePlanRules(board, report)
  noteOldWorkflows(board, report)
  report.sayDid()
  await boardMove(root, ['init'], board)
  moveRuntimes(root, board, report)
  const dropped = dropRecordFile(board)
  if (dropped) report.did.push(dropped)
  checkConfig(board, report)
  checkModules(board, report)
  return true
}
function moveRuntimes(root: string, board: string, report: Report): void {
  try {
    setBoardDir(board, root)
    const line = migrateRuntimes(agentNames(), takeLocalModels(board))
    if (line) report.did.push(line)
    const keys = repairEnvFile()
    if (keys) report.did.push(keys)
  } catch (err) {
    report.notes.push(
      `couldn't turn this board's connector settings into runtimes (${err instanceof Error ? err.message : String(err)}) —` +
        ' set them up in Configuration → Runtimes',
    )
  }
}
function moveLegacyMemory(board: string, report: Report): void {
  const memory = path.join(board, 'memory')
  const moved: string[] = []
  for (const name of MEMORY_FILES) {
    const from = path.join(board, name)
    const st = statOf(from)
    if (!st || !st.isFile()) continue
    fs.mkdirSync(memory, { recursive: true })
    const to = path.join(memory, name)
    const there = read(to)
    if (there === null) {
      fs.renameSync(from, to)
      moved.push(name)
    } else if (there === read(from)) {
      fs.rmSync(from)
      moved.push(name)
    } else {
      report.notes.push(`both docs/kanban/${name} and docs/kanban/memory/${name} exist and differ — merge them by hand`)
    }
  }
  if (moved.length) report.did.push(`moved the memory set into docs/kanban/memory/: ${moved.join(', ')}`)
}

export function dropRecordFile(board: string): string | null {
  const file = path.join(board, 'record.csv')
  if (!fs.existsSync(file)) return null
  fs.rmSync(file)
  return 'removed docs/kanban/record.csv (the planning scores it fed are gone)'
}
function dropModuleGoals(board: string, report: Report): void {
  const memory = path.join(board, 'memory')
  if (!fs.existsSync(memory)) return
  const root = read(path.join(memory, 'goal.md'))
  let dropped = 0
  for (const entry of fs.readdirSync(memory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const file = path.join(memory, entry.name, 'goal.md')
    const text = read(file)
    if (text === null) continue
    if (text === root || text.includes(UNFILLED) || !goalWords(text)) {
      fs.rmSync(file)
      dropped++
    } else {
      report.notes.push(
        `docs/kanban/memory/${entry.name}/goal.md — fold what it says into` +
          ` docs/kanban/memory/agents/planner/${entry.name}/decisions.md, then delete it`,
      )
    }
  }
  if (dropped) report.did.push(`removed ${dropped} leftover per-module goal.md`)
}
const PLAN_LEADS: Record<string, string[]> = {
  coding: ['software-planner', 'planner'],
  'hyperframes-video': ['scriptwriter'],
  'slide-deck': ['deck-planner'],
  'carousel-post': ['carousel-planner'],
  'blog-post': ['blog-planner'],
  'video-clone': ['video-cloner'],
  'workflow-builder': ['workflow-writer'],
}
const GONE_LEADS = ['software-planner', 'planner']

export function planLeads(board: string): Record<string, string[]> {
  const leads = { ...PLAN_LEADS }
  const root = path.join(board, 'workflows')
  for (const entry of fs.existsSync(root) ? fs.readdirSync(root, { withFileTypes: true }) : []) {
    if (!entry.isDirectory()) continue
    const meta = splitFrontmatter(read(path.join(root, entry.name, 'WORKFLOW.md')) ?? '').meta
    const stages = meta === null ? undefined : parseYamlBlock(meta).stages
    const plan = stages && typeof stages === 'object' && !Array.isArray(stages) ? stages.plan : undefined
    const lead = plan && typeof plan === 'object' && !Array.isArray(plan) && typeof plan.lead === 'string' ? plan.lead.trim() : ''
    if (lead) leads[entry.name] = [lead]
  }
  return leads
}

export function movePlanRules(board: string, report: Pick<Report, 'did' | 'notes'>): void {
  const rules = path.join(board, 'rules')
  const moved: string[] = []
  for (const [id, leads] of Object.entries(planLeads(board))) {
    for (const lead of leads) {
      const from = path.join(rules, `${lead}.md`)
      const rule = read(from)?.trim()
      if (!rule) continue
      const to = path.join(rules, 'workflows', `${id}.md`)
      const there = read(to)?.trim() ?? ''
      if (!there.includes(rule)) {
        fs.mkdirSync(path.dirname(to), { recursive: true })
        fs.writeFileSync(to, `${[there, rule].filter(Boolean).join('\n\n')}\n`)
        moved.push(`${lead} → ${id}`)
      }
    }
  }
  for (const lead of GONE_LEADS) fs.rmSync(path.join(rules, `${lead}.md`), { force: true })
  if (moved.length) report.did.push(`made each plan agent's rule its workflow's card rule (docs/kanban/rules/workflows/): ${moved.join(', ')}`)
}
export function noteOldWorkflows(board: string, report: Pick<Report, 'did' | 'notes'>): void {
  const old = (dir: string, file: string, keys: RegExp) => {
    const root = path.join(board, dir)
    return (fs.existsSync(root) ? fs.readdirSync(root, { withFileTypes: true }) : [])
      .filter((e) => e.isDirectory() && keys.test(splitFrontmatter(read(path.join(root, e.name, file)) ?? '').meta ?? ''))
      .map((e) => `docs/kanban/${dir}/${e.name}/${file}`)
  }
  const files = [...old('workflows', 'WORKFLOW.md', /^(stages|delivers):/m), ...old('agents', 'AGENT.md', /^\s+(hook|lead):/m)]
  if (files.length) {
    report.notes.push(
      `written in the old form, so not read until rewritten — list a workflow's agents under \`previews\`, \`land\` and ` +
        `\`scheduled\`, and drop \`hook\`/\`lead\` from each agent (or ask the Workflow builder): ${files.join(', ')}`,
    )
  }
}
function checkConfig(board: string, report: Report): void {
  const current = read(path.join(board, 'config.md'))
  if (!current) return
  const added = missingConfigKeys(current)
  if (added.length) {
    report.notes.push(
      `this release adds ${added.map((k) => `**${k}**`).join(', ')} to the config — add the line to docs/kanban/config.md and fill it in`,
    )
  }
}

function checkModules(board: string, report: Report): void {
  const map = read(path.join(board, 'modules.md'))
  if (map && map.includes(UNFILLED)) {
    report.notes.push(
      'docs/kanban/modules.md is still blank — write it from the repo (`akb guide module-map`)',
    )
  }
}
function sayCommandVersion(): void {
  const latest = latestVersion()
  say('')
  if (latest && isOlder(SKILL_VERSION, latest)) {
    say(`This command is ${SKILL_VERSION}; ${latest} is out. It can't replace itself while it runs:`)
    say('')
    say(`    ${NEWER_LINE}`)
    say('')
    say('Then run `akb update` again — a newer command is what brings newer flows.')
  } else if (latest) {
    say(`This command is ${SKILL_VERSION} — the newest published.`)
  } else {
    say(`This command is ${SKILL_VERSION}. A newer one: \`${NEWER_LINE}\``)
  }
}
function latestVersion(): string | null {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const result = spawnSync(npm, ['view', NAME, 'version'], {
    encoding: 'utf8',
    timeout: 10_000,
    stdio: ['ignore', 'pipe', 'ignore'],
    shell: process.platform === 'win32',
  })
  if (result.status !== 0 || !result.stdout) return null
  const value = result.stdout.trim()
  return /^\d+\.\d+\.\d+/.test(value) ? value : null
}
function isOlder(a: string, b: string): boolean {
  const parts = (v: string): number[] => v.split('-')[0]!.split('.').map((n) => Number(n) || 0)
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < 3; i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0)
  }
  return a.includes('-') && !b.includes('-')
}
