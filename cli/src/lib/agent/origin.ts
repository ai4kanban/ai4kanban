// The session a command is typed in (#1222), so a card created there can pick it up.

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { discussionSession } from './chat'
import { insideDiscussion, insideRun, SESSION_VARS } from './env'
import { readStore } from './store'
import { isDiscussion, type ChatHandoff, type ChatTarget } from './types'

// The agent CLIs a process can be recognised as, by the name it was started under.
const AGENTS: Record<string, string> = {
  claude: 'claude-code',
  codex: 'codex',
  opencode: 'opencode',
  'cursor-agent': 'cursor',
  kimi: 'kimi',
  grok: 'grok',
  zcode: 'zcode',
  dsh: 'dsh',
  'dsh-acp': 'dsh',
}

const RUNTIMES = new Set(['node', 'bun', 'deno'])

/** Which agent CLI one process is, from its command line. */
export function agentOf(args: string): string | undefined {
  const words = args.trim().split(/\s+/)
  const first = path.basename(words[0] ?? '')
  const script = RUNTIMES.has(first) ? words[1] ?? '' : words[0] ?? ''
  if (script.includes('/@anthropic-ai/claude-code/')) return 'claude-code'
  return AGENTS[path.basename(script).replace(/\.(m?js|cjs|exe)$/, '')]
}

/** This process's ancestors' command lines, nearest first. */
function processChain(): string[] {
  if (process.platform === 'win32') return []
  const ps = spawnSync('ps', ['-Ao', 'pid=,ppid=,args='], { encoding: 'utf8', timeout: 5_000 })
  if (ps.status !== 0) return []
  const table = new Map<number, { ppid: number; args: string }>()
  for (const line of ps.stdout.split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line)
    if (m) table.set(Number(m[1]), { ppid: Number(m[2]), args: m[3]! })
  }
  const chain: string[] = []
  for (let pid = process.ppid, seen = 0; pid > 1 && seen < 64; seen++) {
    const row = table.get(pid)
    if (!row) break
    chain.push(row.args)
    pid = row.ppid
  }
  return chain
}

/** OpenCode's latest session in this folder. */
function recentOpencode(cwd: string): string | undefined {
  const out = spawnSync('opencode', ['session', 'list', '-n', '1', '--format', 'json'], {
    cwd,
    encoding: 'utf8',
    timeout: 10_000,
  })
  return out.status === 0 ? opencodeSessionOf(out.stdout) : undefined
}

export function opencodeSessionOf(json: string): string | undefined {
  try {
    const [first] = JSON.parse(json) as { id?: unknown }[]
    return typeof first?.id === 'string' && first.id ? first.id : undefined
  } catch {
    return undefined
  }
}

/** What the terminal probe reads. Replaced by tests. */
export const probes = { chain: processChain, opencode: recentOpencode }

/** The session of the nearest agent above this process. Only the nearest counts: an agent
 *  started by another is its own session, not the outer one's. */
export function terminalSession(
  chain: string[],
  env: NodeJS.ProcessEnv,
  opencode: (cwd: string) => string | undefined,
  cwd = process.cwd(),
): ChatHandoff | undefined {
  const harness = chain.map(agentOf).find(Boolean)
  if (!harness) return undefined
  const resumeId = harness === 'opencode' ? opencode(cwd) : SESSION_VARS[harness] && env[SESSION_VARS[harness]]?.trim()
  return resumeId ? { harness, resumeId, cwd } : undefined
}

/** The session a card created by this process was created in: the one its board run was
 *  started from, the discussion being answered, or the agent in the terminal. */
export function currentSession(): ChatHandoff | undefined {
  const run = insideRun()
  if (run) return readStore().runs.find((r) => r.sessionId === run)?.origin
  const discussion = insideDiscussion() as ChatTarget | null
  if (discussion) return isDiscussion(discussion) ? discussionSession(discussion) : undefined
  return terminalSession(probes.chain(), process.env, probes.opencode)
}
