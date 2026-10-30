// A task that ended (#2064): its project's cards rewritten as `raw archive` / `reject` rewrite a
// local board's, by the same rules (cli/src/lib/leaving.ts). The group root's line is marked,
// cards waiting on it get a revise, references to it go, a finished group closes, and a card no
// longer blocked starts what it held or what its `schedule` says.

import { parseFrontmatter, serializeFrontmatter } from '../../../cli/src/lib/frontmatter.ts'
import { clearScheduleIn, dropRefsIn, groupCloseOf, markSubtaskIn, queueRevisionIn, unstrikeSubtaskIn } from '../../../cli/src/lib/leaving.ts'
import type { Fate } from '../../../cli/src/lib/leaving.ts'
import { boardFor, rewrite } from '../board.ts'
import { draftFolder } from '../board-files.ts'
import type { BoardClient } from '../board.ts'
import { call } from '../db.ts'
import type { Env } from '../env.ts'
import { index, indexEntries } from './board.ts'

interface ProjectCard {
  task: string
  number: number
  status: string
  path: string
  /** A step of it is queued or running: its card is left to that step, as a live run's is. */
  busy: boolean
}

interface Ending {
  task: string
  key: string
  number: number
  title: string
  status: string
  project: string
  account: string
  path: string | null
  parent: string | null
  cards: ProjectCard[]
}

const ENDED = ['done', 'cancelled']
const ROUNDS = 5

/** Every ending waiting, and those a closed group adds. Never throws: what fails stays filed
 *  and is handed out again. */
export async function settleEndings(env: Env): Promise<number> {
  let n = 0
  try {
    for (let round = 0; round < ROUNDS; round++) {
      const taken = await call<{ task: string; closing: boolean }[]>(env, 'v1_take_endings', { p_limit: 20 })
      if (!taken.length) break
      for (const e of taken) {
        try {
          await settle(env, e.task, e.closing)
          await call(env, 'v1_ending_done', { p_task: e.task })
          n++
        } catch (error) {
          console.error('cloud: task ending not handled', { task: e.task, error: error instanceof Error ? error.message : String(error) })
        }
      }
    }
  } catch (error) {
    console.error('cloud: task endings not read', error)
  }
  return n
}

async function settle(env: Env, task: string, closing: boolean): Promise<void> {
  const ending = await call<Ending | null>(env, 'v1_ending', { p_task: task })
  if (!ending || !ENDED.includes(ending.status)) return
  await dropDraft(env, ending.project, task)
  const fate: Fate = ending.status === 'done' ? 'completed' : 'rejected'
  const id = ending.number
  const leaver = { id, title: ending.title, archived: ending.path ?? ending.key }
  const open = ending.cards.filter((c) => c.task !== task && !ENDED.includes(c.status) && c.path.startsWith('todo/'))
  const root = closing ? undefined : ending.cards.find((c) => c.task === ending.parent && !ENDED.includes(c.status))
  if (!open.length && !root) return

  const board = await boardFor(env, ending.project)
  const waited = new Set<string>()
  const done = await rewrite(board, open.map((c) => c.path), (held) => {
    waited.clear()
    return open.flatMap((c) => {
      const before = held.get(c.path)?.content
      if (!before) return []
      let text = before
      if (c === root) text = markSubtaskIn(text, id, fate === 'completed' ? 'tick' : 'strike') ?? text
      const waiting = parseFrontmatter(text).meta?.blocked_by.includes(id) ?? false
      text = dropRefsIn(text, id).text
      if (waiting) {
        waited.add(c.task)
        if (!c.busy) text = queueRevisionIn(text, [leaver], fate)?.text ?? text
      }
      return text === before ? [] : [{ path: c.path, content: text }]
    })
  })
  await index(env, ending.account, ending.project, indexEntries(await written(board, done.files)))

  // A root the Runner's own archive already closed sits in `.archive/`.
  if (root) {
    const [row] = await board.read([root.path])
    if (root.path.startsWith('.archive/') || (row?.content && groupCloseOf(row.content).close)) {
      await call(env, 'v1_close_group', { p_task: root.task })
    }
  }

  for (const c of open.filter((o) => waited.has(o.task))) await release(env, ending, board, c)
}

/** A Workflow builder task's draft (#2004) leaves the board once the task is over. */
async function dropDraft(env: Env, project: string, task: string): Promise<void> {
  const board = await boardFor(env, project)
  const rows = await board.list(`workflows/${draftFolder(task)}/`)
  if (rows.length) await rewrite(board, rows.map((r) => r.path), () => rows.map((r) => ({ path: r.path, content: null })))
}

/** The files a write changed, as they now read. */
async function written(board: BoardClient, seqs: { path: string; seq: number }[]) {
  return seqs.length ? board.read(seqs.map((s) => s.path)) : []
}

/** A card no longer blocked starts its held step or its schedule; a schedule handed over comes off. */
async function release(env: Env, ending: Ending, board: BoardClient, card: ProjectCard): Promise<void> {
  const [row] = await board.read([card.path])
  const schedule = row?.content ? parseFrontmatter(row.content).meta?.schedule ?? null : null
  const started = await call<{ started: boolean }>(env, 'v1_release_task', {
    p_task: card.task,
    p_action: schedule?.action ?? null,
    p_notes: schedule?.notes ?? null,
  })
  if (!started.started || !schedule) return
  const done = await rewrite(board, [card.path], (held) => {
    const text = held.get(card.path)?.content
    return text ? [{ path: card.path, content: clearScheduleIn(text) }] : []
  })
  await index(env, ending.account, ending.project, indexEntries(await written(board, done.files)))
}

/** A restored task's card (#94) back on the board: out of `.archive/` into its group's folder while
 *  that is open, else `todo/`, with no rejection left on it and its group root's line unstruck.
 *  What its leaving did to other cards stays. Never throws. */
export async function restoreCard(env: Env, task: string): Promise<void> {
  try {
    const ending = await call<Ending | null>(env, 'v1_ending', { p_task: task })
    const path = ending?.path
    if (!ending || !path) return
    const root = ending.cards.find((c) => c.task === ending.parent && !ENDED.includes(c.status) && c.path.startsWith('todo/'))
    const board = await boardFor(env, ending.project)
    const moves = await placesOf(board, path, root?.path)
    const paths = [...moves.keys(), ...moves.values(), ...(root ? [root.path] : [])]
    const done = await rewrite(board, [...new Set(paths)], (held) => {
      const out: { path: string; content: string | null }[] = []
      for (const [from, to] of moves) {
        const text = held.get(from)?.content
        // A file already there is never overwritten.
        if (!text || held.get(to)?.content) continue
        out.push({ path: from, content: null }, { path: to, content: from === path ? unrejected(text) : text })
      }
      // Removed on the web: the card never left.
      const kept = moves.size ? null : held.get(path)?.content
      const clean = kept ? unrejected(kept) : kept
      if (clean && clean !== kept) out.push({ path, content: clean })
      const line = root && held.get(root.path)?.content
      const unstruck = line && unstrikeSubtaskIn(line, ending.number)
      if (unstruck) out.push({ path: root.path, content: unstruck })
      return out
    })
    await index(env, ending.account, ending.project, indexEntries([
      ...done.files.filter((f) => moves.has(f.path)).map((f) => ({ ...f, content: null })),
      ...(await written(board, done.files.filter((f) => !moves.has(f.path)))),
    ]))
  } catch (error) {
    console.error('cloud: restored card not put back', { task, error: error instanceof Error ? error.message : String(error) })
  }
}

/** Where each file of an archived card goes back to: a group root takes its folder with it. */
async function placesOf(board: BoardClient, path: string, root: string | undefined): Promise<Map<string, string>> {
  if (!path.startsWith('.archive/')) return new Map()
  const rest = path.slice('.archive/'.length)
  const group = /^([^/]+)\/root\.md$/.exec(rest)?.[1]
  if (group) {
    const rows = await board.list(`.archive/${group}/`)
    return new Map(rows.filter((r) => r.content !== null).map((r) => [r.path, `todo/${r.path.slice('.archive/'.length)}`]))
  }
  const name = rest.split('/').pop()!
  const folder = root?.endsWith('/root.md') ? root.slice(0, -'root.md'.length) : 'todo/'
  return new Map([[path, folder + name]])
}

/** A card with nothing left saying it was archived or rejected. */
function unrejected(text: string): string {
  const { meta, body } = parseFrontmatter(text)
  if (!meta || !(meta.archived || meta.rejected || meta.rejected_reason || meta.rejected_at || meta.rejected_by)) return text
  Object.assign(meta, { archived: '', rejected: false, rejected_reason: '', rejected_at: '', rejected_by: '' })
  return serializeFrontmatter(meta) + '\n' + body
}
