// The one variable a run the board started puts on the agent it spawns.
//
// It is here, on its own, because two very different parts of the board ask the same
// question of it: the commands, which print a flow instead of starting a second run
// (agent/flow.ts), and the delivery lock, which lets a delivery's own run through the
// hold it puts on the card (agent/deliveries.ts).

/** The variable a run the board started puts on the agent it spawns, holding that run's id.
 *
 *  It is the one case where the mode is not the caller's to pick: an agent working inside a
 *  run that asks for a board action gets the flow printed, so a run can never spawn a copy
 *  of itself. Anywhere else, guessing from the environment would take away the background
 *  run a user deliberately asked for. */
export const RUN_ENV = 'KANBAN_RUN'

/** The run this process is working inside, when the board started it — otherwise null. */
export function insideRun(): string | null {
  const id = process.env[RUN_ENV]
  return id && id.trim() ? id.trim() : null
}

/** Put the run's id into the environment its agent receives. */
export function runEnv(env: NodeJS.ProcessEnv, value: string): NodeJS.ProcessEnv {
  return { ...env, [RUN_ENV]: value }
}

/** The variable a chat turn or an agent test puts on its agent, holding a one-off id: they
 *  have no run id, and it is how a stop finds the commands that agent started (#1302). */
export const STOP_ENV = 'KANBAN_STOP_ID'

/** The variable a chat turn puts on the agent it spawns, holding the discussion that turn is
 *  answering (#496).
 *
 *  It is here for the same reason `KANBAN_RUN` is: `akb raw plan new` has to land on the
 *  discussion whose reply is being written, and reading it off the environment means the
 *  agent never spells an id and can never stamp the wrong one. */
export const DISCUSSION_ENV = 'KANBAN_DISCUSSION'

/** The discussion this process is answering, when a chat turn started it — otherwise null. */
export function insideDiscussion(): string | null {
  const id = process.env[DISCUSSION_ENV]
  return id && id.trim() ? id.trim() : null
}

/** Put the discussion's id into the environment its agent receives. */
export function discussionEnv(env: NodeJS.ProcessEnv, value: string): NodeJS.ProcessEnv {
  return { ...env, [DISCUSSION_ENV]: value }
}

/** The variable a turn that submits a shared conversation puts on its agent (#679), holding
 *  the key that submission is filed under.
 *
 *  Its own variable rather than the discussion's: a card's conversation is shared the same
 *  way, and that is not a discussion. */
export const CASE_ENV = 'KANBAN_CASE'

/** The submission this process is collecting for, when a shared conversation's end started
 *  it — otherwise null. */
export function insideCase(): string | null {
  const key = process.env[CASE_ENV]
  return key && key.trim() ? key.trim() : null
}

/** Put that key into the environment its agent receives. */
export function caseEnv(env: NodeJS.ProcessEnv, value: string): NodeJS.ProcessEnv {
  return { ...env, [CASE_ENV]: value }
}

/** The variable a chat turn puts on its agent, holding the runtime that turn runs on (#1598):
 *  `akb spec --print` starts a separate run when the asked agent runs on another one. */
export const CHAT_RUNTIME_ENV = 'KANBAN_CHAT_RUNTIME'

/** The runtime of the chat turn this process is answering — otherwise null. */
export function chatRuntime(): string | null {
  const id = process.env[CHAT_RUNTIME_ENV]
  return id && id.trim() ? id.trim() : null
}

/** Put that runtime into the environment its agent receives. */
export function chatRuntimeEnv(env: NodeJS.ProcessEnv, value: string): NodeJS.ProcessEnv {
  return { ...env, [CHAT_RUNTIME_ENV]: value }
}

/** The variable each CLI puts its own session id in for the commands it runs (#1222). The
 *  board drops them from every agent it spawns, so one never reads a session it inherited. */
export const SESSION_VARS: Record<string, string> = {
  'claude-code': 'CLAUDE_CODE_SESSION_ID',
  codex: 'CODEX_THREAD_ID',
}
