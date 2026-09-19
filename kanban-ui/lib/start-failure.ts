import type { StartResult } from "./registry";

// --- a start that was refused, in the user's language (#706) -------------------
//
// The board answers a refused run in its own English, and one refusal in seven is a path
// list. The screen the answers were pressed on says it in the language the app is set to, so
// the board's sentence is translated HERE — the one place the app reads a refusal — and
// nowhere else. Anything the board refuses with that this list has no kind for is one
// generic line: a sentence that guesses is worse than one that admits it knows nothing.

/** The one sentence per kind, as the copy holds it. */
export interface FailureCopy {
  dirty: string;
  busy: string;
  worktree: string;
  akb: string;
  noPlan: string;
  onePlan: string;
  noProcess: string;
  rules: string;
  other: string;
}

/** A refusal as the screen draws it: one line, and the paths it named under it. */
export interface StartFailure {
  line: string;
  paths: string[];
}

/** What to say about a start that did not start. A result that came back ok with no run id
 *  is a start that did not happen either, and reads as the generic refusal. */
export function startFailure(res: StartResult, c: FailureCopy): StartFailure {
  return { line: res.reason ? c[res.reason] : c.other, paths: res.paths ?? [] };
}

/** The same, as one string — for the two places with no room to lay the paths out: the
 *  message under the Create task button at phone width, and a rail row's hover. */
export const failureText = (failure: StartFailure): string =>
  [failure.line, ...failure.paths].join("\n");
