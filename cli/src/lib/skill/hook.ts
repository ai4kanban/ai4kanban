// The commit guard: a `pre-commit` hook that refuses a commit on the branch a delivery is
// landing on (#324).
//
// Such a commit moves the target under the delivery, so the landing rebases — and after a
// few rounds it gives up and leaves the landing to be finished by hand, an hour after the
// commit that caused it. This refuses the commit instead, and names what it would break.
//
// Advice with teeth, not a lock: only that one branch is refused, and `--no-verify` gets
// past it. Anything the hook cannot judge lets the commit through — no `node`, no record, a
// record it cannot parse — because a refusal it cannot explain is worse than the rebase it
// is here to save.
//
// The board's own git never meets it: every command a delivery runs carries
// `core.hooksPath=/dev/null` (agent/worktree.ts). That matters because git shares one hook
// folder across every worktree of a repository, so a delivery's worktree runs the same file.

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { SKILL_VERSION } from '../../version'
import type { CommitHook, CommitHookResult, CommitHookState } from './types'

/** The line that says the board wrote this file. An update rewrites a hook carrying it and
 *  never one without. */
const MARKER = '# ai4kanban commit guard'
const MARKER_LINE = new RegExp(`^${MARKER}\\b`, 'm')

// The check itself: one line of JavaScript, run by `node -e` with the board's
// `.sessions.json` as its only argument. It reads that file directly rather than shelling
// out to `akb` — the hook has to work in a checkout where `cli/dist` was never built, and
// booting a board on every commit would be its own cost.
//
// Everything is inside one `try`, so any failure is a commit that goes through: no git, no
// record, a record it cannot parse. A detached HEAD reads back as `HEAD`, which is no
// branch's name. A commit made inside a delivery's own worktree is let through by name —
// the board's own git skips hooks, but a person committing in there by hand should not be
// refused on that delivery's account.
//
// No single quote may appear in this string: it is embedded in a `sh` single-quoted word.
const CHECK = [
  'try{',
  'const[top,branch]=require("child_process")',
  '.execFileSync("git",["rev-parse","--show-toplevel","--abbrev-ref","HEAD"],{encoding:"utf8"}).trim().split("\\n");',
  'if(/\\/\\.akb\\/worktrees\\//.test(top+"/"))process.exit(0);',
  'const d=(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).deliveries||[])',
  '.find((x)=>x&&x.status==="active"&&x.commitMode==="auto"&&x.targetBranch===branch&&(!x.landing||x.landing.status!=="landed"));',
  'if(!d)process.exit(0);',
  'process.stderr.write(',
  '"ai4kanban: delivery "+d.deliveryId+" is landing #"+d.cardId+" on "+branch+", so a commit here moves the target under it\\n"',
  '+"  — commit on another branch, or `git commit --no-verify` to commit anyway.\\n");',
  'process.exit(1);',
  '}catch(e){process.exit(0)}',
].join('')

/** A path as a `sh` double-quoted word. A board under a folder with a space in its name is
 *  ordinary; the rest are not, and are escaped rather than trusted. */
const quoted = (p: string): string => `"${p.replace(/(["$`\\])/g, '\\$1')}"`

/** The whole check as ONE line of `sh` — what the hook runs, and what a user with a hook of
 *  their own is given to paste into it. A machine with no `node` runs nothing and refuses
 *  nothing: `if`, not `&&`, so the line is 0 where node is missing even when it is the last
 *  line of the hook it was pasted into. */
const guardLine = (sessions: string): string =>
  `if command -v node >/dev/null 2>&1; then node -e '${CHECK}' ${quoted(sessions)} || exit 1; fi`

/** The hook file, from the board it guards. The board's path is written in at install time,
 *  so a board that is not at the repository root is still found. */
function hookScript(sessions: string): string {
  return [
    '#!/bin/sh',
    `${MARKER} ${SKILL_VERSION} — rewritten by \`akb update\`, so edits here are lost.`,
    '#',
    '# Refuses a commit on the branch a delivery is landing on, and nothing else. Anything',
    '# it cannot judge lets the commit through. `git commit --no-verify` gets past it, and',
    '# deleting this file turns it off.',
    guardLine(sessions),
    'exit 0',
    '',
  ].join('\n')
}

const read = (file: string): string | null => {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

/** Where git actually runs `pre-commit` from, or null outside a git repository.
 *
 *  `--git-path hooks` is git's own answer, so a linked worktree gets the shared folder it
 *  really runs and `core.hooksPath` is resolved rather than guessed at. */
function hooksDir(root: string): string | null {
  const out = spawnSync('git', ['rev-parse', '--git-path', 'hooks'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  })
  if (out.error || out.status !== 0 || !out.stdout.trim()) return null
  return path.resolve(root, out.stdout.trim())
}

/** Whether this repository points its hooks somewhere the board does not own. Set by the
 *  user or by a tool of theirs (husky and the like), and never written over. */
function hasOwnHooksPath(root: string): boolean {
  const out = spawnSync('git', ['config', '--get', 'core.hooksPath'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  })
  return !out.error && out.status === 0 && !!out.stdout.trim()
}

const sessionsPath = (root: string): string => path.join(root, 'docs', 'kanban', '.sessions.json')

/** Where the commit guard stands in a project. Spawns git twice, so it is asked for by name
 *  rather than folded into `readSkillState`. */
export function readCommitHook(root: string): CommitHook {
  const dir = hooksDir(root)
  if (!dir) return { state: 'no-git' }
  const where = shown(root, path.join(dir, 'pre-commit'))
  const line = guardLine(sessionsPath(root))
  if (hasOwnHooksPath(root)) return { state: 'hooks-path', path: where, line }
  const text = read(path.join(dir, 'pre-commit'))
  if (text === null) return { state: 'absent', path: where }
  return MARKER_LINE.test(text) ? { state: 'ours', path: where } : { state: 'foreign', path: where, line }
}

const shown = (root: string, p: string): string => (path.relative(root, p) || p).split(path.sep).join('/')

/** Put the guard in place, or say why it was left alone.
 *
 *  Written without asking, wherever the skill is installed: a setting that stayed off until
 *  you turned it on would protect only the users who already know this failure exists. A
 *  hook the board's marker is missing from is never touched — that one is the user's. */
export function installCommitHook(root: string): CommitHookResult {
  const hook = readCommitHook(root)
  if (hook.state === 'no-git') return {}
  if (hook.state === 'hooks-path' || hook.state === 'foreign') {
    const why =
      hook.state === 'foreign'
        ? `${hook.path} is a hook the board did not write, so no commit guard was installed`
        : `this repository runs its hooks from \`core.hooksPath\`, so no commit guard was installed`
    return {
      note:
        `${why} — add this line to ${hook.path} to refuse a commit on the branch a delivery is landing on:\n${hook.line}`,
    }
  }
  const file = path.join(root, hook.path!)
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, hookScript(sessionsPath(root)), { mode: 0o755 })
    fs.chmodSync(file, 0o755)
  } catch (e) {
    return { note: `${hook.path} could not be written — ${e instanceof Error ? e.message : String(e)}` }
  }
  return { wrote: { path: hook.path!, refreshed: hook.state === 'ours' } }
}

/** How `akb skill` says where the guard stands, in one clause. */
export function sayCommitHook(state: CommitHookState): string {
  if (state === 'absent') return 'not installed'
  if (state === 'ours') return 'refuses a commit on the branch a delivery is landing on'
  if (state === 'foreign') return 'a hook the board did not write — left alone'
  if (state === 'hooks-path') return 'this repository runs its hooks from core.hooksPath — left alone'
  return ''
}
