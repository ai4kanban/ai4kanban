// Project-local state shared by the CLI, host and sandboxed agents.
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { machineHome } from './home'

const PROJECTS = 'projects'
const ID_LENGTH = 10
const RECORD = 'board.json'
export const SESSIONS_FILE = 'sessions.json'
export const SESSIONS_FOLDER = 'sessions'
export const CHATS_FOLDER = 'chats'
export const MOCKUPS_FOLDER = 'mockups'
export const COMMENTS_FOLDER = 'comments'
export const SESSIONS_LOCK = 'sessions.lock'
export const INDEX_LOCK = 'index.lock'

function realPathOf(dir: string): string {
  const here = path.resolve(dir)
  const rest: string[] = []
  let at = here
  for (;;) {
    try {
      return path.join(fs.realpathSync(at), ...rest)
    } catch {
      const up = path.dirname(at)
      if (up === at) return here
      rest.unshift(path.basename(at))
      at = up
    }
  }
}

const slug = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'board'

/** Legacy machine-home naming, retained only for importing existing history. */
function readableName(real: string): string {
  const here = path.basename(real)
  const up = path.dirname(real)
  if (here !== 'kanban') return slug(here)
  return path.basename(up) === 'docs' ? slug(path.basename(path.dirname(up))) : slug(`${path.basename(up)}-kanban`)
}

export function legacyProjectStateDir(board: string): string {
  const real = realPathOf(board)
  const id = createHash('sha256').update(real).digest('hex').slice(0, ID_LENGTH)
  return path.join(machineHome(), PROJECTS, `${readableName(real)}-${id}`)
}


/** Match the explicit checkout root when supplied; otherwise find the board's repository. */
export function stateRootOf(board: string): string {
  let dir = realPathOf(board)
  for (;;) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir
    const up = path.dirname(dir)
    if (up === dir) break
    dir = up
  }
  const parent = path.dirname(realPathOf(board))
  return path.basename(parent) === 'docs' ? path.dirname(parent) : parent
}

export function projectStateDir(board: string, root = stateRootOf(board)): string {
  const relative = path.relative(realPathOf(root), realPathOf(board))
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('The board must be inside its project root.')
  }
  return path.join(realPathOf(root), '.akb', 'boards', relative || '_root')
}

/** Import old state once, retaining the original. Locks are never carried across. */
export function ensureProjectState(board: string, root = stateRootOf(board)): string {
  const dir = projectStateDir(board, root)
  if (!fs.existsSync(dir)) {
    const legacy = legacyProjectStateDir(board)
    fs.mkdirSync(path.dirname(dir), { recursive: true })
    const temporary = fs.mkdtempSync(`${dir}.import-`)
    try {
      if (fs.existsSync(legacy)) fs.cpSync(legacy, temporary, {
        recursive: true,
        filter: source => !['.lock', '.answering'].some(suffix => path.basename(source).endsWith(suffix)),
      })
      try { fs.renameSync(temporary, dir) }
      catch (err) {
        if (!['EEXIST', 'ENOTEMPTY'].includes((err as NodeJS.ErrnoException).code ?? '')) throw err
      }
    } finally { fs.rmSync(temporary, { recursive: true, force: true }) }
  }
  if (recordedBoard(dir) !== realPathOf(board)) {
    fs.writeFileSync(path.join(dir, RECORD), `${JSON.stringify({ board: realPathOf(board) })}\n`)
  }
  return dir
}

export function recordedBoard(dir: string): string | null {
  try {
    const held = JSON.parse(fs.readFileSync(path.join(dir, RECORD), 'utf8')) as { board?: unknown }
    return typeof held.board === 'string' ? held.board : null
  } catch { return null }
}
