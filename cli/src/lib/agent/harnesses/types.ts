// What a harness is, and the two things every harness entry beside this file needs.
//
// A harness is one way to run an agent, and all of it lives behind this interface: the
// command, the flags that make it stream, the env it needs, how its output is parsed, how
// a finished session is resumed, the settings it takes, and how it is offered to a front
// end. Adding an agent is adding one file beside this one and one name to the list in
// `./index` — nothing outside this folder learns its name.

import type { RunClient, StreamRenderer } from '../wire'
import type { HarnessOption, HarnessSetting } from '../types'

// A harness declares everything about itself but the three things it is never asked
// directly. Two only this machine can answer — whether its CLI is here, and which binary
// was looked for — and are worked out per read, against the PATH and the user's own
// `command` override (agent/installed.ts). The third is `gaps`, which is a reading of the
// fields below rather than a claim of its own (agent/capabilities.ts): a connector says what
// it does, and what it lacks follows. All three are joined on in `agentInfo`.
export interface Harness extends Omit<HarnessOption, 'binary' | 'installed' | 'gaps'> {
  /** The flags to append to the configured argv. `argv` is what the user's command
   *  already carries, so a harness never overrides a flag the user set by hand.
   *  `sessionId` is the id we generated up front — a harness that can't pin an id
   *  ignores it. `cwd` is the project this run belongs to (see WORKING FOLDER). */
  extraArgs(argv: string[], sessionId: string, cwd: string): string[]
  /** True when this harness's CLI can pick an earlier conversation back up. A failed
   *  run offers Resume only then, and it is also the whole of what a chat needs: a
   *  conversation is a second message into the session the agent already opened, so an
   *  agent that can't do this is the one a chat turns away (agent/chat.ts). */
  resumes: boolean
  /** The flags that continue the conversation `resumeId` names, instead of starting a
   *  fresh one. Stands in for `extraArgs` on a resumed run — the two are never both
   *  appended, because pinning a new session id and resuming an old one are
   *  contradictory instructions. Only called when `resumes`. */
  resumeArgs(argv: string[], resumeId: string, cwd: string): string[]
  /** The settings this harness takes, in the order a dialog draws them. This list is the
   *  whole of its configuration: a run appends the ones that carry a flag, and the file
   *  keeps them in this harness's own block under `harnessSettings`. */
  settings: HarnessSetting[]
  /** Every variable that could send this connector to a provider the user didn't pick.
   *  All of them are dropped from a run's environment, and then the picked provider sets
   *  the ones it needs — so what the settings say is where the run goes, and an export
   *  the user forgot about years ago can't say otherwise.
   *
   *  It covers providers the board doesn't offer yet, not only the ones on the list: a
   *  leftover Bedrock or Vertex switch would send a "Claude subscription" run somewhere
   *  else just as surely as a base URL would. The variables the connector's own provider
   *  settings name are dropped too, without being repeated here.
   *
   *  A connector that declares no provider list has nothing to drop for, so it leaves
   *  this out and its runs inherit the environment as they find it. */
  providerEnv?: string[]
  /** The environment the child runs under, on top of the one this process has. */
  env(): NodeJS.ProcessEnv
  /** Parses this harness's stdout into readable log lines + a final message. Left out by
   *  a harness that declares a `client` instead: then stdout is a protocol, not a log.
   *
   *  `cwd` is the folder the run works in, for a renderer that has to go looking on disk
   *  for what the stream leaves out — Kimi files its sessions by working folder, so that
   *  is the only way to find the one a crashed run opened (agent/wire/kimi-session.ts).
   *  Every other renderer ignores it. */
  renderer?(cwd: string): StreamRenderer
  /** True for a stderr line that is this CLI's own housekeeping — chatter about its caches
   *  and background refreshes, printed on nearly every turn, that says nothing about the
   *  work and nothing a user could act on.
   *
   *  Kept deliberately narrow. A run's log is the only account of what happened, so the
   *  rule is: drop a line only when knowing it would change nothing. Anything about the
   *  model, the network, the sandbox or a tool the agent couldn't reach stays, however
   *  often it repeats — a log that hides the one line explaining a failure is worse than
   *  a noisy one. */
  quietStderr?(line: string): boolean
  /** The client that holds the conversation, for a command that answers back rather than
   *  printing a report and exiting (agent/wire/). A harness declares this OR a
   *  `renderer`, never both — a command either talks or it prints.
   *
   *  It is handed the settings this harness is set to, because what a conversation opens
   *  with is part of the conversation: an ACP agent picks its model on the session it just
   *  opened, not from a flag on the command line. */
  client?(values: Record<string, string>): RunClient
  /** True when this harness adopts the session id we generate before the run starts
   *  (Claude Code takes `--session-id`), so its own resume id IS ours and is known from
   *  the first moment. False when the harness mints its own id instead — then the id
   *  arrives mid-run, out of the output stream, and the renderer reports it. */
  adoptsSessionId: boolean
  /** What this connector's own output tells the board about a finished run, beyond the work
   *  itself. Every CLI reports something different and none of it can be inferred, so it is
   *  declared: what isn't here is a number the runs panel shows nothing for, rather than one
   *  the board made up. Checked against the renderer when this module loads.
   *
   *  `cost` an estimated price, `tokens` the four token counts, `model` the id of the model
   *  that did the work. */
  reports: ('cost' | 'tokens' | 'model')[]
  /** True when a rate limit ends the run instead of waiting it out. A CLI that retries a 429
   *  by default holds its card for as long as it retries, which on a weekly limit is most of
   *  an hour — so a connector with a switch for it turns retries off in `env()` and says so
   *  here. False is not a fault: most of these CLIs have no such switch. */
  stopsOnRateLimit: boolean
  /** How a fresh prompt calls the ai4kanban skill for this agent. Claude Code triggers a
   *  skill from a slash name (`/kanban`); Codex reads a slash as plain chat text and
   *  triggers on a `$` name instead. */
  skillCall: string
}

// How a prompt asks for the skill on an agent with no direct skill syntax. A fresh chat
// ensures the skill is installed before using this sentence.
export const SKILL_SENTENCE = 'Use the kanban skill'

// ---- WORKING FOLDER --------------------------------------------------------
//
// Every run and every chat is spawned with `cwd` set to the project, and for one connector
// that is not enough. OpenCode does not honour the cwd its process was given: a run started
// anywhere else works in the CALLER's folder.
//
// That is the app's normal path — the desktop server's cwd is its own bundled folder — and
// what it costs is not a failed run. An agent that can't see the board goes looking for
// one, finds another project's, and starts working the card with that number there.
//
// So OpenCode is told the folder outright, with `--dir`, and `PWD` is set to match on every
// run (agent/resolve.ts) — that one is free, and it is the other half of what a shell would
// have said.
//
// The rest are left alone deliberately, each checked the same way: spawn it from folder A
// with `cwd` set to folder B and ask it to run `pwd`. Claude Code, Codex and Cursor all
// answer B, so their own folder flags would only repeat the cwd. dsh and ZCode are talked
// to rather than printed from, and both name the folder inside the conversation already
// (agent/wire/acp.ts, agent/wire/zcode.ts). Kimi is the one nobody has run this on: its own
// docs say `kimi -p` works in `process.cwd()`, which is a reading rather than an answer
// until a probe says so (harnesses/kimi.ts). Re-run that probe before trusting a new
// connector here.

/** True when this argv already names a flag — `--model id` or `--model=id`, in any of the
 *  names that harness answers to. Used for a setting's flags, and by a harness deciding
 *  whether its own flags are already there. */
export function namesFlag(argv: string[], flags: string[]): boolean {
  return argv.some((tok) => flags.some((flag) => tok === flag || tok.startsWith(`${flag}=`)))
}

// ---- the raw arguments every harness takes ---------------------------------
//
// A setting covers what the board has words for — a model, an effort level. This one covers
// the rest: whatever that CLI takes and this build has never heard of. Every harness gets
// it (harnesses/index.ts), so a new flag on any of them is reachable the day it ships.
//
// It is NOT a `command` override. The override replaces the command and its flags, and a
// setting whose flag it names stops being added; this is appended on top of whatever the
// command already is, and nothing turns it off.

/** The key the raw arguments save under, in the harness's own block. */
export const RAW_ARGS_KEY = 'args'

export const RAW_ARGS: HarnessSetting = {
  key: RAW_ARGS_KEY,
  label: 'Extra arguments',
  kind: 'text',
  placeholder: '--dangerously-skip-permissions',
  help: "Appended to the command as written, for whatever the settings above don't cover. Split on spaces; a bad one fails the run and the log says why.",
}
