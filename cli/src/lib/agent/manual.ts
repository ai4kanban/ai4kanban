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

  /** Under `delivery`: what one is, which no verb of it says on its own. */
  deliveries: (program: string): string => `
What a delivery is
  One \`card implement\` carries the card all the way: it builds, a fresh run reviews and fixes
  what it built, the board lands it, and the board archives the card — nothing asks you in
  between. While it is in flight the card can't be revised, refined, rejected or archived;
  \`cancel\` and \`discard\` are what take it back.

  It builds in a worktree of its own — \`.akb/worktrees/<card>/<delivery>\`, branch
  \`card/<card>/<delivery>\` — so several run at once. Once review passes it lands as one squash
  commit on the branch you were on, one card at a time, and nothing is pushed. A card built
  with open questions holds outside the landing queue until they are answered; an answer that
  changed what the card asks for ends that delivery and starts a fresh one.

  Two switches in Configuration change this: **Allow automatic Git commits** off builds in
  your checkout, one at a time; **Approve diffs before landing** on holds every delivery after
  review until \`${program} delivery approve\` signs off the tree it would land.
`,
}
