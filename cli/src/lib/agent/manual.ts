// The parts of `akb help` no flag can carry.
//
// What every command takes is declared on the command (lib/cli/agent.ts, lib/cli/board.ts)
// and the help is what that declaration says — there is no second copy of it here. What is
// left is the guidance a table of options cannot hold: when to print a flow instead of
// starting a run, what a delivery is and what happens between its runs, and the one line
// that fixes an ask that will not run.
//
// Each block below is attached to the command it is about, so it is read where it applies:
// the root's after its list, a flow's under that flow's options.

export const HELP_AFTER = {
  /** Under the whole list: what these commands are for, and what to do when one won't run. */
  root: (program: string): string => `
Grouped by what each command acts on — \`${program} card\`, \`delivery\`, \`run\`, \`release\`.
\`${program} <noun>\` lists that noun's verbs.

A run keeps working after the command returns — close the terminal and it keeps going. Add
--follow to any of them to watch the log instead.

When an ask can't run, this is the one line that fixes it
  no board here                 \`${program} install\` in the project
  the board is half a board     \`${program} raw init\` adds what is missing
  this command is behind        \`npm install -g ai4kanban@latest\`, then \`${program} update\`
  the agent isn't installed     \`${program} agent test\` — it names the install command
  no key, or the wrong one      \`${program} agent\` says what is set; the user runs
                                \`${program} agent set apiKey <their-key>\`
  a run won't start             \`${program} run list\` — one run per card at a time, and the
                                refusal names the run already on it
  a run died part-way           \`${program} run resume <id>\` continues that conversation
  a card won't change           a delivery is in flight on it — \`${program} delivery cancel <id>\`
                                hands it back
  a delivery won't land         it is waiting for you to approve its tree —
                                \`${program} delivery approve <id>\` signs it off
`,

  /** Under every flow: print it, or run it. The one choice each of them has. */
  flow: `
Print it, or run it
  --print     say what to do and start nothing. What it prints is filled in for this board:
              the card's own path, the steps it has left, the memory file its modules point
              at, the release it is in, the flows the job is done by in full, and the
              command that closes the job — because nothing is watching you finish.
  (no flag)   start a run: a second agent, its own context, working on its own.

  Print when the user is asking you for the action here, in a session. You do the job in the
  conversation you are already in: it costs no second agent and can't collide with the
  changes already in the working tree.

  Start a run when the user wants the work to happen on its own — in the background, while
  they do something else, on a card they are not watching. That is the explicit ask. It also
  wins on long read-heavy jobs that need nothing from the conversation.

  Some jobs are better done by the agent that was there. It just built the card, so it knows
  which steps it really did; a fresh agent sees unticked boxes and works the rest out from
  the diff.

  When it is not clear which was meant, print. A printed flow costs nothing and can still be
  followed by starting a run; a started run costs a second agent, a second context, and money
  nobody asked to spend.

  One caller does not choose: an agent already working inside a run the board started always
  prints, because a run never starts another.
`,

  /** Under `chat`: what a conversation is, and what it is not. */
  chat: `
Before opening a fresh conversation, chat ensures the kanban skill is installed. Its first
prompt is only that agent's skill invocation followed by your message: /kanban for Claude
Code, $kanban for Codex, or "Use the kanban skill:" for an agent without direct invocation
syntax.

From there it is an ordinary conversation with the kanban skill. The skill chooses whether to
print a flow and do it here or start a background run; saying which one you want wins.

Only an agent whose command can take a second message into its own session can hold a
conversation. On any other one, chat says so and names the agents that can.

The agent and the model are one conversation's own. Each starts on the board's, and a pick
sticks to that conversation until it is changed. Changing the model carries the same session
on; changing the agent cannot, so it starts the conversation over.
`,

  /** Last of all: what a delivery is. Every command above touches one, and none of them
   *  is the whole story on its own. */
  deliveries: (program: string): string => `
A delivery — what an Implement click starts
  One click carries the card all the way: it builds, a fresh run reviews and fixes what it
  built, the board lands it, and the board archives the card. Nothing asks you again in
  between. While a delivery is in flight that card can't be revised, refined, rejected or
  archived; \`${program} delivery cancel\` and \`${program} delivery discard\` are what take it back.

  Building a card that still has open questions is allowed and warned about: it is built and
  reviewed, and then holds outside the landing queue — taking no slot — until the questions
  are answered. An answer that changed what the card asks for ends that delivery and starts a
  fresh one on the card as it now reads.

  Each delivery builds in a git worktree of its own — \`.akb/worktrees/<card>/<delivery>\`, on
  branch \`card/<card>/<delivery>\` — so several run at once without touching each other or
  your own edits. Turn **Allow automatic Git commits** off in Configuration and a delivery
  works in your checkout instead, one at a time.

  Once review passes it LANDS: one squash commit on the branch you were on when you pressed
  Implement. One card lands at a time, however many are building. Uncommitted work of your
  own holds a landing back until the checkout is clean; a target branch that moved is rebased
  onto, and a conflict is resolved as new work. Nothing is pushed.

  Turn **Approve diffs before landing** on in Configuration → General and no delivery lands
  unread: every one holds after review until you approve the exact tree it would land. It
  takes no landing slot while it waits. An approval covers the delivery's base commit and the
  tree built on it, and either one moving cancels it.

  Completion is the LAST step, never an earlier one: the board archives the card itself once
  the delivery has landed and ended.
`,
}
