// The one variable a session the board started puts on the agent it spawns.
//
// It is here, on its own, because two very different parts of the board ask the same
// question of it: the commands, which print a flow instead of starting a second session
// (agent/flow.ts), and the delivery lock, which lets a delivery's own session through the
// hold it puts on the card (agent/deliveries.ts).

/** The variable a session the board started puts on the agent it spawns, holding that
 *  session's id.
 *
 *  It is the one case where the mode is not the caller's to pick: an agent working inside a
 *  session that asks for a board action gets the flow printed, so a session can never spawn
 *  a copy of itself. Anywhere else, guessing from the environment would take away the
 *  background session a user deliberately asked for. */
export const RUN_ENV = 'KANBAN_RUN'

/** The session this process is working inside, when the board started it — otherwise null. */
export function insideRun(): string | null {
  const id = process.env[RUN_ENV]
  return id && id.trim() ? id.trim() : null
}

/** Put the session's id into the environment its agent receives. */
export function runEnv(env: NodeJS.ProcessEnv, value: string): NodeJS.ProcessEnv {
  return { ...env, [RUN_ENV]: value }
}
