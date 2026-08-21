// The agent's manual — every command an agent working on this board may call, and when to
// call each. One copy, read two ways: `akb help` prints it, and a chat opens with it, so a
// conversation and a coding agent are given the same list rather than two that drift.

export function agentManual(program: string): string {
  return `${program} — start a run, and steer it.

Usage: ${program} <command> [args] [options]

Runs — every one of them also takes --print, and the rule for it is below
  implement <id> [note]     build the card
  run <id> [note]           one pass of a recurring card
  refine <id>               sharpen the card until it is ready to build
  resolve <id> [note]       answer its open questions (--and-implement carries on)
  revise <id> "<what>"      change the card to say something else
  create "<what you want>"  write the card(s) for it   (--release v1)
  propose                   write the next tasks       (--module m, --count n,
                            --boldness safe|normal|bold)
  plan-release <version>    fill a release from its goal
  setup                     finish setting the board up — every step still unticked
                            on docs/kanban/setup-checklist.md, in one run
  archive <id>              finish the card
  reject <id> "<why>"       drop the card

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
  in the conversation you are already in: it costs no second agent, a correction is
  their next message rather than a whole run thrown away, and it can't collide with
  the changes already in the working tree.

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

  An agent already working inside a run the board started always prints, whether or not
  it says --print. A run never starts another run, so it cannot spawn a copy of itself.

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

Talking to the agent — a conversation, not a job
  chat                         the conversation about the board so far
  chat "<message>"             say something about the board
  chat <id> "<message>"        say something about that card
  chat [<id>] --clear          forget that conversation and start fresh

  The first message opens with the board — the goal, the modules, the tracks, every open
  card in one line, the card itself when one is named, and the flow a conversation
  follows (\`${program} guide chat\`). Nothing has to be explained to it.

  The reply arrives as it is written, and the next message lands in the same session —
  the agent still has everything said before. The board's conversation and each card's
  are separate, and both live on this machine until they are cleared.

  A chat is not a run: it never shows in \`runs\`, never holds a card, and never keeps a
  run off the card it is about. It also builds nothing — when the answer is work, start
  the run for it.

  Only an agent whose command can take a second message into its own session can hold a
  conversation. On any other one, chat says so and names the agents that can.

Runs in flight
  runs [--card <id>] [--all]   what is running, and what ran lately
  log [<run>] [--follow]       one run's log; --full for all of it
  stop [<run>]                 end a run
  resume [<run>]               continue one that failed, was cut off or was stopped

A <run> is a run's id, any prefix of one that names only one run, or \`last\`.
Left out, it means the newest run.

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
  a run won't start             \`${program} runs\` — one run per card at a time, and
                                the refusal names the run already on it
  a run died part-way           \`${program} resume <run>\` continues that conversation

Options — any command takes these
  --dir <path>   the project to work on. Default: the nearest board at or above
                 the folder you ran in
  --json         answer as one JSON object instead of prose`
}
