/** Where the commit guard stands — the `pre-commit` hook that refuses a commit on the
 *  branch a delivery is landing on (#324). */
export type CommitHookState =
  /** Not a git repository: no hook to write, and nothing to say about it. */
  | 'no-git'
  /** A git repository with no `pre-commit` hook. An install writes one. */
  | 'absent'
  /** The board's own hook, by its marker line. An install rewrites it in place. */
  | 'ours'
  /** A `pre-commit` hook the board did not write. Never touched. */
  | 'foreign'
  /** The repository runs its hooks from `core.hooksPath`, which is the user's to keep. */
  | 'hooks-path'

/** The commit guard in one project. */
export interface CommitHook {
  state: CommitHookState
  /** The hook git would run, repo-relative. Absent outside a git repository. */
  path?: string
  /** The one line to add by hand, on the two states the board writes nothing. */
  line?: string
}

/** What one install did about the commit guard. Both fields absent when there was nothing
 *  to do — a project that is not a git repository. */
export interface CommitHookResult {
  /** Where it landed, and whether it replaced the board's own older copy. */
  wrote?: { path: string; refreshed: boolean }
  /** Why nothing was written and what to do about it. */
  note?: string
}
