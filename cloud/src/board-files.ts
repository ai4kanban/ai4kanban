// What of a board lives in its project's `Board` (#2081), shared by the Worker and the Runner:
// both filter by the same rule. No imports, so either side can take it as it is.

/** The board folders kept in Cloud; anything else on a board is this computer's own. */
const ROOTS = ['todo/', '.archive/', 'memory/', 'workflows/', 'triage/', 'assets/', 'rules/']

/** The board's settings at its root (#2106): the module map and the project's settings. */
export const SETTINGS = ['modules.md', 'config.md']

/** A settings file: one of those, an agent's rule, or the rule for a workflow's cards. */
export const isSettingsPath = (path: string) => SETTINGS.includes(path) || /^rules\/(?:workflows\/)?[^/]+\.md$/.test(path)

/** A file over this goes up as an asset, not on the board. */
export const BOARD_FILE_LIMIT = 256 * 1024

/** A board path Cloud keeps: relative, inside one of its folders, not a generated file. */
export function isBoardPath(path: string): boolean {
  if (!path || path.length > 500 || path.startsWith('/') || path.includes('\\') || path.includes('\0')) return false
  if (path.split('/').some((part) => !part || part === '.' || part === '..')) return false
  // Rebuilt on every board, never kept: the index and the sync records. `next-id` and
  // `metrics.csv` sit outside every folder kept.
  if (path === 'todo/README.md' || path.split('/').includes('.sync')) return false
  if (path.startsWith('workflows/')) return true
  if (SETTINGS.includes(path)) return true
  if (path.startsWith('rules/')) return isSettingsPath(path)
  // An asset a card names sits beside it as an artifact's file, never a board file.
  if (path.startsWith('assets/')) return path.endsWith('.json')
  return ROOTS.some((root) => path.startsWith(root)) && path.endsWith('.md')
}

/** A card is named by its task's number in the project (#2105): `todo/12-pricing.md`, or a group's
 *  `todo/12-pricing/root.md`, anywhere under `todo/` or `.archive/`. */
const CARD = /^(?:todo|\.archive)\/(?:[^/]+\/)*(\d+)-[^/]*\.md$/
const ROOT = /^(?:todo|\.archive)\/(?:[^/]+\/)*(\d+)-[^/]+\/root\.md$/

export function numberOfCard(path: string): number | null {
  const n = ROOT.exec(path)?.[1] ?? CARD.exec(path)?.[1]
  return n ? Number(n) : null
}

/** A subtask's group: the number its group folder starts with. */
export function groupOfCard(path: string): number | null {
  if (ROOT.test(path) || !CARD.test(path)) return null
  const folder = /(?:^|\/)(\d+)-[^/]+\/[^/]+$/.exec(path)?.[1]
  return folder ? Number(folder) : null
}

/** A task id as a file or folder name. */
export const cardSlug = (task: string) => task.toLowerCase().replace(/_/g, '-')

/** Where a task's assets are listed: a path its card names → the artifact version it shows. */
export const assetsFile = (task: string) => `assets/${task}.json`

export const taskOfAssets = (path: string): string | null => /^assets\/(task_[0-9a-f]+)\.json$/.exec(path)?.[1] ?? null

/** The board folder a workflow is written to: its id as a board names one (`wf_builtin_coding` →
 *  `wf-builtin-coding`), so it never takes the place of a workflow akb ships. */
export const workflowFolder = (id: string) => id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** akb's name for a Cloud workflow: a built-in's own (`wf_builtin_coding` → `coding`), an
 *  account's own its folder. */
export const workflowName = (id: string) =>
  id.startsWith('wf_builtin_') ? id.slice('wf_builtin_'.length).replace(/_/g, '-') : workflowFolder(id)

/** The user's rule for every card on a workflow (#2152). */
export const workflowRuleFile = (id: string) => `rules/workflows/${workflowName(id)}.md`

/** The built-in whose task writes a workflow (#2004). */
export const BUILDER = 'wf_builtin_workflow_builder'

/** Where a builder task's workflow is written on its project's board, until the approval saves it. */
export const draftFolder = (task: string) => cardSlug(task)

export interface CardFront {
  title?: string
  status?: string
  phase?: number
  /** The previews the card chose and how many approvals they make (#2154). */
  previews?: string[]
  stages?: number
}

const unquote = (value: string) => value.trim().replace(/^(["'])(.*)\1$/, '$2')

/** The frontmatter fields Cloud's task index keeps: title, status, the previews it chose and the
 *  approval it is on. */
export function cardFront(body: string): CardFront {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(body)
  if (!match) return {}
  const out: CardFront = {}
  for (const line of match[1]!.split(/\r?\n/)) {
    const field = /^(title|status|phase|stages|previews):\s*(.*)$/.exec(line)
    if (!field) continue
    const [, key, value = ''] = field
    if (key === 'title' && value.trim()) out.title = unquote(value)
    else if (key === 'status' && value.trim()) out.status = unquote(value)
    else if (key === 'phase' && Number.isInteger(Number(value)) && value.trim()) out.phase = Number(value)
    else if (key === 'stages' && Number.isInteger(Number(value)) && value.trim()) out.stages = Number(value)
    else if (key === 'previews') {
      const flow = /^\[(.*)\]\s*$/.exec(value.trim())
      if (flow) out.previews = flow[1]!.split(',').map(unquote).filter(Boolean)
    }
  }
  return out
}
