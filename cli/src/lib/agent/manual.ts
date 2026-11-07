// The parts of `akb help` no flag can carry.
//
// What every command takes is declared on the command (lib/cli/agent.ts, lib/cli/board.ts)
// and the help is what that declaration says — there is no second copy of it here. What is
// left is the guidance a table of options cannot hold: when to print a flow instead of
// starting a run, and what a delivery is.
//
// Each block is attached to the command it is about, never to the root — `akb help` is
// Commander's own list and stays that short.

export const HELP_AFTER = {
  /** Under every flow: print it, or run it. The one choice each of them has. */
  flow: `
Print it, or run it
  --print     say what to do and start nothing. What it prints is filled in for this board:
              the card's own path, the steps it has left, the memory file its modules point
              at, the flows the job is done by in full, and the
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

  /** Under `delivery`: what one is, which no verb of it says on its own. */
  deliveries: (program: string): string => `
What a delivery is
  A delivery freezes the approved requirements and runs the workflow agents in order.
  Each agent records its result with \`delivery complete\`; the final step archives the card.
  The builder manages its branch, worktree, checks and merge. File workflows deliver their
  recorded outputs in the authorized directory. A successful run alone does not finish a delivery.
  \`cancel\` ends it and preserves files. \`resume\` continues unfinished work.

`,
}
