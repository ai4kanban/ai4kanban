// The board answering the command it started, for the connectors whose command answers back.
//
// Four of the board's agents are started, handed the prompt on their command line, and
// read to the end: they print, we parse, the exit code is the verdict (agent/stream.ts and
// its siblings). That is all a printing command can do, and it is left exactly as it is.
//
// A fifth kind of command holds a conversation instead. It stays up, tells us what it is
// doing message by message, and asks us things — which model to work with, whether it may
// reach outside the project. Nothing in that shape fits a parser: the prompt is sent, not
// spelled on the command line; the run ends when the agent says the turn is over, not when
// the process exits (it never exits on its own); and a question left unanswered stops the
// run dead.
//
// So a harness declares a client, the runner hands it the command's pipes, and everything
// that agent's protocol says lives behind this one interface. The runner learns no
// protocol and the client learns nothing about runs.

import type { Readable, Writable } from 'node:stream'

import type { TokenUsage } from '../types'

/** One turn, from the pipes it is held over to the things it reports back. */
export interface ClientTurn {
  /** The command's own streams. The client owns both: this stdout is a protocol, not a
   *  log, and nothing else reads or writes them. */
  stdout: Readable
  stdin: Writable
  /** What to ask the agent to do. */
  prompt: string
  /** The folder the work happens in. */
  cwd: string
  /** The conversation to carry on, when this run continues an earlier one. Absent opens a
   *  fresh conversation. */
  resumeId?: string
  /** What to send instead when `resumeId` names a conversation the agent no longer holds:
   *  a self-contained ask, because the fresh session opened in its place knows nothing of
   *  it. Absent leaves a dead session failing the run — a restart nobody wrote words for
   *  would be an agent told to carry on from nothing. */
  restartPrompt?: string
  /** Text for the run's log, as it arrives — this is the live tail. */
  log: (text: string) => void
  /** The conversation's own id, the moment the agent names one, so a run that dies a
   *  second later can still be picked up. `restarted` marks the id of a session opened to
   *  replace a dead one: it goes OVER whatever id the caller was holding, where an ordinary
   *  one is kept only if the caller has none. */
  gotResumeId: (id: string, restarted?: boolean) => void
  /** The model this turn works with, as the agent itself named it. */
  gotModel: (model: string) => void
}

/** How one turn ended. `ok` is the run's verdict — the command's exit code says nothing
 *  here, because the runner is the one that ends the process. */
export interface TurnEnd {
  ok: boolean
  /** The agent's closing message. */
  result?: string
  /** Why it stopped, in the agent's own words. Never our guess at one. */
  error?: string
  /** What the turn consumed, when the agent counted it. */
  usage?: TokenUsage
  /** What it cost in US dollars, when the agent priced it. */
  costUsd?: number
}

/** A connector the board talks to rather than only reads. */
export interface RunClient {
  /** Drive one turn to its end. Never rejects: every way this can go wrong is an ending
   *  worth showing in the log. */
  turn(io: ClientTurn): Promise<TurnEnd>
}
