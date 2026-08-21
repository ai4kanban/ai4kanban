// What a project's coding-agent skill is, as a screen or a terminal reads it.
//
// The skill is the short note a coding agent reads plus the command beside it, written into
// one folder per harness. It is NOT part of getting a board (#174): a board is scaffolded
// without it, and it is added later — from the UI, one command in a terminal, or the first
// chat. These shapes say whether a project has it, how current it is, and what one install
// wrote.
//
// Pure types, no imports — so the board UI takes a copy (scripts/sync-format.mjs) and names
// the same shapes the command does.

/** Where one harness's copy of the skill stands. */
export type SkillFolderState =
  /** Nothing there — this agent can't see the board. */
  | 'absent'
  /** The same version the command carries. */
  | 'current'
  /** An older version. The same install brings it up to date. */
  | 'stale'
  /** There, but nothing in it says which version it is. */
  | 'unknown'
  /** A symlink into a source checkout. Never written over — copying onto it would
   *  overwrite the source it points at. */
  | 'linked'

/** One harness's folder, and what is in it. */
export interface SkillFolder {
  /** Repo-relative, forward slashes: `.claude/skills/kanban`. */
  path: string
  /** The harness that reads it, e.g. "Claude Code". */
  agent: string
  state: SkillFolderState
  /** The version installed there, when it says. */
  version: string | null
}

/** Whether this project can be driven from a coding agent, and how current that is. */
export interface SkillState {
  /** The version this command would write. */
  version: string
  folders: SkillFolder[]
  /** At least one folder has the skill. */
  installed: boolean
  /** At least one folder has an older copy than the command carries. */
  outdated: boolean
}

/** One folder an install wrote. */
export interface SkillWrite {
  path: string
  agent: string
  /** What landed there, named rather than counted: `SKILL.md (the note) + kanban.mjs`. */
  files: string
  /** It was already there and was refreshed, rather than written for the first time. */
  refreshed: boolean
}

/** What one install did. */
export interface SkillInstall {
  ok: boolean
  /** Why nothing was written, when nothing was. */
  error?: string
  wrote: SkillWrite[]
  /** A folder left alone, and why. */
  skipped: { path: string; agent: string; why: string }[]
  /** How the project stands afterwards, so one answer is enough to redraw from. */
  state: SkillState
}

/** The `akb` on the user's PATH against the copy this board runs on.
 *
 *  The flows a coding agent works by ship inside that command, so an old one on the PATH
 *  means old flows in a project whose skill was just refreshed — and no command at all
 *  means the note points at something that isn't there. Neither is ours to fix: a global
 *  install is the user's line to type. */
export interface CommandState {
  /** The version this board runs on. */
  version: string
  /** What `akb` on the PATH answers, or null when it isn't there. */
  onPath: string | null
  /** The PATH command is missing, or older than this one. */
  behind: boolean
  /** The one line that fixes it — handed over, never run. */
  line: string
}
