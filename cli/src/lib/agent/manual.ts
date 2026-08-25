// The agent's manual — every command an agent working on this board may call, and when to
// call each. One copy, read two ways: `akb help` prints it, and a chat opens with it, so a
// conversation and a coding agent are given the same list rather than two that drift.
//
// The runs table is not written here: it is rendered from the board's own list of flows
// (flows.ts), which the dispatcher and the Rules pane read too, so a flow shipped later
// appears in all three at once.

import { FLOWS } from './flows'

// Where a flow's words start, so the table reads as two columns.
const TEXT_COL = 28

// A flow's clause is written unpunctuated, because the Rules pane shows it beside a command
// name. Here it opens a paragraph, so it is closed off when a sentence follows it — never
// when what follows is the flow's options, which belong to the clause.
const clause = (flow: (typeof FLOWS)[number]): string => {
  const next = flow.more?.[0]
  return next && !next.startsWith('(') && !/[.)]$/.test(flow.gloss) ? `${flow.gloss}.` : flow.gloss
}

const runsTable = (): string =>
  FLOWS.flatMap((flow) => [
    `  ${flow.usage.padEnd(TEXT_COL - 2)}${clause(flow)}`,
    ...(flow.more ?? []).map((line) => `${' '.repeat(TEXT_COL)}${line}`),
  ]).join('\n')

export function agentManual(program: string): string {
  return `${program} — start a run, and steer it.

Usage: ${program} <command> [args] [options]

Runs — every one of them also takes --print, and the rule for it is below
${runsTable()}

The run starts and this returns — close the terminal and it keeps working. Add
--follow to any of them to watch the log instead of returning.

Print it, or run it — the two modes every command above has
  --print     say what to do and start nothing. What it prints is filled in for this
              board: the card's own path, the steps it has left, the memory file its
              modules point at, the release it is in, the flows the job is done by in
              full, and the command that closes the job — because nothing is watching
              you finish.
  (no flag)   start a run: a second agent, its own context, working on its own.

  Print when the user is asking you for the action here, in a session. You do the job
  in the conversation you are already in: it costs no second agent and can't collide
  with the changes already in the working tree.

  Start a run when the user wants the work to happen on its own — in the background,
  while they do something else, on a card they are not watching. That is the explicit
  ask. It also wins on long read-heavy jobs that need nothing from the conversation:
  proposing across the repo, planning a release, refining round after round.

  Some jobs are better done by the agent that was there. It just built the card, so it
  knows which steps it really did; a fresh agent sees unticked boxes and works the rest
  out from the diff.

  When it is not clear which was meant, print. A printed flow costs nothing and can
  still be followed by starting a run; a started run costs a second agent, a second
  context, and money nobody asked to spend.

  One caller does not choose: an agent already working inside a run the board started
  always prints, because a run never starts another run. Chat follows the ordinary rule
  above: --print does the work in that conversation; no flag starts another agent.

Spec agents — a named agent that fills one part of a card's spec
  spec                         the spec agents this board has, and what each one owns
  spec <agent> <id> [note]     put one on a card

  It is a run of its own: it starts clean, with the card and your note and nothing
  else, and it writes one section of that card — \`## By \`<agent>\` agent\` — and
  changes nothing more. That is why it has no --print: doing it in the conversation
  that asked for it is the one thing it exists not to be.

  Asked for from inside a run, it is written down rather than started, and the board
  starts it the moment that run ends. So a flow asks and carries straight on — it
  never waits for the agent, and never writes the agent's section itself.

Talking to the agent — a conversation that also does the board work
  chat                         the conversation about the board so far
  chat "<message>"             say something about the board
  chat <id> "<message>"        say something about that card
  chat [<id>] --clear          forget that conversation and start fresh

  Before opening a fresh conversation, chat ensures the kanban skill is installed. Its
  first prompt is only that agent's skill invocation followed by your message: /kanban
  for Claude Code, $kanban for Codex, or "Use the kanban skill:" for an agent without
  direct invocation syntax.

  The reply arrives as it is written, and the next message lands in the same session —
  the agent still has everything said before. The board's conversation and each card's
  are separate, and both live on this machine until they are cleared.

  From there it is an ordinary conversation with the kanban skill. The skill chooses
  whether to print a flow and do it here or start a background run; saying which one you
  want wins.

  A change to a card a run is working on is refused, and the refusal names the card and
  what that run is doing.

  A chat is still not a run: it never shows in \`runs\`, never holds a card, and never keeps
  a run off the card it is about.

  Only an agent whose command can take a second message into its own session can hold a
  conversation. On any other one, chat says so and names the agents that can.

Runs in flight
  runs [--card <id>] [--all]   what is running, and what ran lately
  log [<id>] [--follow]        one run's log; --full for all of it
  stop [<id>]                  end a run
  resume [<id>]                continue one that failed, was cut off or was stopped
  cancel <delivery|#card>      end the delivery in flight on a card and hand it back
  discard <delivery|#card>     throw a delivery's worktree and branch away (--yes to go
                               ahead; without it, it only says what would be lost)
  approve <delivery|#card>     sign off the tree a delivery would land, on a board that
                               requires it

An <id> is a run's id, any prefix of one that names only one run, or \`last\`. Left out, it
means the newest run.

Resume is the one that reaches past the board: it picks the coding agent's own session back
up — the conversation it was having, with everything it had already read — while the board
counts the work as a fresh run.

An Implement click starts a DELIVERY — the whole job, several runs long, against the card
exactly as it was approved when it started: it builds, a fresh run reviews and fixes what it
built, the board lands it, and the board archives the card.
One click carries the card all the way; nothing asks you again in between. While a delivery
is in flight that card can't be revised, refined, rejected or archived; \`cancel\` is what
takes it back. A delivery WAITING ON YOU can always be resolved — answering is the way on,
and it carries the same delivery on with no second click. Every other action is a single run
and holds nothing.

Building a card that still has open questions is allowed and warned about: it is built and
reviewed, and then holds outside the landing queue — taking no slot, so every other card
still lands — until the questions are answered. An answer that changed what the card asks
for ends that delivery and starts a fresh one on the card as it now reads.

Each delivery builds in a git worktree of its own — \`.akb/worktrees/<card>/<delivery>\`, on
branch \`card/<card>/<delivery>\` — so several run at once without touching each other or
your own edits, and the board's own files stay out of them. Cancelling one leaves its
worktree where it is; \`discard\` is what throws one away. Turn **Allow automatic Git
commits** off in Configuration and a delivery works in your checkout instead, one at a
time, and you commit after review passes.

Once review passes, the delivery LANDS: one squash commit on the branch you were on when
you pressed Implement. One card lands at a time, however many are building. Uncommitted
work of your own holds a landing back until the checkout is clean; a target branch that
moved is rebased onto and reviewed again; a conflict is resolved as new work and reviewed
from scratch. The worktree and branch are removed once it has landed. Nothing is pushed.

Turn **Require diff approval before landing** on in Configuration → Auto-delivery and no
delivery lands unread: every one holds after review until you approve the exact tree it
would land — the **Approval** tab on the card page, or \`approve\` above. It takes no landing
slot while it waits, so every other card still lands. An approval covers the delivery's base
commit and the tree built on it, and either one moving — a rebase or a review fix — cancels
it and the delivery waits again. Off by default, and frozen on a delivery the way its commit
mode is. It has nothing to hold with automatic commits off: the board never
commits there, so your own commit is the approval.

Completion is the LAST step, never an earlier one: the board archives the card itself once
the delivery has landed and ended — no run is started to do it, and the review that passes a
delivery leaves the card where it is. In manual commit mode nothing lands, so the card is
archived when your own commit matches what review passed.

The agent that runs them
  agent                        what runs, and how it is set up
  agent list                   the agents it can run, and what each one takes
  agent use <name>             pick one
  agent set <key> [value]      a setting or a key; no value clears it. \`agent\` lists
                               the keys the picked agent takes — model, reasoning
                               effort, provider, endpoint, and its API key
  agent test                   one small chat, to see the setup works

  A key is the one thing to hand back rather than run. Give the user the line —
  \`${program} agent set apiKey <their-key>\` — and let them type it: a key an agent types
  lands in its transcript and in the shell history, and a saved key is never read back.

The flows
  guide                        every flow the board has, one line each
  guide <topic>                one in full. \`guide board\` is how the board works at
                               all — card format, layout, the memory set

A printed flow already carries the flows its action is done by, so this is for the rest:
how the board works, the module map, setup, updating, the local UI.

The board's own bookkeeping
  ${program} board help                 every move: ids, a card's fields, releases, the index
  ${program} board help <move>          one move in full

Those are the agent's commands between runs — a person never has to type one. They own
docs/kanban/next-id, a card's frontmatter and metrics.csv; write and edit only a card's
body.

When an ask can't run, this is the one line that fixes it
  no board here                 \`${program} install\` in the project
  the board is half a board     \`${program} board init\` adds what is missing
  this command is behind        \`npm install -g ai4kanban@latest\`, then \`${program} update\`
  the agent isn't installed     \`${program} agent test\` — it names the install command
  no key, or the wrong one      \`${program} agent\` says what is set; the user runs
                                \`${program} agent set apiKey <their-key>\`
  a run won't start             \`${program} runs\` — one run per card at a time, and the
                                refusal names the run already on it
  a run died part-way           \`${program} resume <id>\` continues that conversation
  a card won't change           a delivery is in flight on it — \`${program} cancel <id>\`
                                hands it back
  a delivery won't land         it is waiting for you to approve its tree —
                                \`${program} approve <id>\` signs it off

Options — any command takes these
  --dir <path>   the project to work on. Default: the nearest board at or above
                 the folder you ran in
  --json         answer as one JSON object instead of prose`
}
