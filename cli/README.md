# ai4kanban

Set up and update [AI4Kanban](https://ai4kanban.dev/) in one command.

AI4Kanban is AI project management that grows with you: you give the agent a vague idea, it
breaks the idea down, settles what it can on its own, asks you the rest, and keeps going
until the spec is clear enough to build. The board is plain Markdown in `docs/kanban/`,
versioned in git.

This package is the command, the board's own bookkeeping, and the flows the agent works by.
The board is the product.

## Start with the board app

Most people never type any of this. The board comes as a desktop app —
<https://ai4kanban.dev/download>, nothing to install first: no Node, no npx, no terminal —
and setting a board up there is a guided first run: three questions, one to a screen, then
a **Finish setup** button that works down the rest. No build is signed yet, so macOS blocks
the first open: drag the app in from the `.dmg`, then click through the warning that it
cannot be checked.

What follows is the same board from a terminal — and the way to put an agent on a card
without a chat session and without a browser.

## Get the command

The [board app](https://ai4kanban.dev/download) brings `akb` with it — the first open puts
it on your PATH and it updates when the app does, so if you have the app you have the
command. Install it on its own where the app can't run — a server, a container, or a Linux
box, whose AppImage leaves no command behind:

```bash
npm install -g ai4kanban
```

That puts `akb` on your path. Every example below also works as
`npx --yes ai4kanban@latest <command>` — the same command, fetched each time, if you would
rather not install anything.

## Install into a project

From your project root:

```bash
akb install --tracks feature,bug,research
```

That scaffolds `docs/kanban/`: the track folders, the board index, the memory set, and a
blank `config.md`. Nothing is written outside that folder — that is the whole footprint.

Pass the tracks your project actually splits into. Normally you don't run this by hand —
you paste the install prompt from <https://ai4kanban.dev/INSTALL_PROMPT.txt> and your agent
reads the repo, picks the tracks, runs this command, and fills in the config afterwards.

## Drive the board from your coding agent

Optional, and separate from the board on purpose: a board works from the app on its own.
Add it when you want Claude Code or Codex to work the same board too.

```bash
akb skill            # is it here, and how current
akb skill install    # add it, or bring an older copy up to date
```

That writes one file into `.claude/skills/kanban/` (Claude Code) and
`.agents/skills/kanban/` (Codex): `SKILL.md`, a short note telling a coding agent the board
is here and that `akb` owns it. The board app does the same thing from a button:
**Configuration → Agent setup**.

Nothing else is copied in. The flows ship inside the command (`akb guide`), so a newer
command is newer flows in every project at once — and the command itself stays where npm put
it, so a project's git history never carries 350 kB of it.

An agent that finds no `akb` on the PATH doesn't stop: the note's first section says what to
run instead — the copy in this project where there is one, and otherwise `npx --yes
ai4kanban@<the version that wrote the note>`, pinned so the rules match the board. A run
started from the app or the CLI is told the same thing in its own words, and `akb skill`
says it to you at the moment the note lands.

## Update

Two lines, and there is no third:

```bash
npm install -g ai4kanban@latest   # a newer command
akb update                        # a repaired board, from the project root
```

`akb update` refreshes a skill folder that is already there — it never adds one, since not
having it is an ordinary state now — adds whatever an older release never wrote to the
board, clears out what it no longer writes, and prints which version you moved from and to
with a link to everything that changed in between. Your cards, config, and memory are never
touched.

It can't do the first line to itself — replacing the file that is running is how you get
half a command — so it checks npm and names that line when it is behind, rather than
reporting success a release late.

## Put an agent to work

`akb` starts the board's runs, watches them, and holds the settings they run under — so a
card can be built from a terminal, over ssh, or from a script, without a chat session and
without a browser.

```bash
akb implement 12              # build the card
akb refine 12                 # sharpen it until it is ready to build
akb create "add dark mode"    # write the card(s) for it
akb propose                   # write the next tasks
akb archive 12                # finish it
```

Add `--print` to any of them and nothing starts: it prints what to do instead, filled in
for this board — the card's own path, the steps it has left, the memory file its modules
point at, and the command that closes the job.

```bash
akb implement 12 --print      # the steps, for whoever is asking
```

That is the mode for an agent already in a session: it does the job in the conversation
it is already in, rather than paying for a second agent to do the job it is sitting there
to do. Start a run when you want the work to happen on its own. `akb help runs` carries
the whole rule, beside the commands it applies to. An agent working inside a run the board
started always gets the printed flow, so a run can't spawn a copy of itself.

The run keeps working after the command returns. Watch it, or stop it, from anywhere —
including from the board app, which drives its buttons through these same commands:

```bash
akb runs                      # what is running, and what ran lately
akb log 3f2a1b04 --follow     # watch a run as it goes
akb stop 3f2a1b04             # end one
akb resume 3f2a1b04           # continue one that failed
```

Which agent runs them — Claude Code, Codex, Cursor, OpenCode or DeepSeek Harness — and
what it is set to:

```bash
akb agent                     # what runs, and how it is set up
akb agent list                # the agents it can run, and what each one takes
akb agent use codex
akb agent set model gpt-5.1-codex
akb agent set apiKey sk-…     # saved to docs/kanban/.env, never shown back
akb agent test                # one small chat, to see it works
```

Runs use these settings, never what your shell happens to export. `akb help` lists
everything, and `--json` on any command answers a program instead of a person.

An API key is the one thing to leave to the user. Hand them the line rather than typing it
for them: a key an agent types lands in its transcript and in the shell history, and a
saved key is never read back.

## Talk to it about the board

Sometimes the answer is a conversation, not a job. `akb chat` opens one about the whole
board; `akb chat <id>` opens one about that card.

```bash
akb chat "what should I build next, and why?"
akb chat 12 "what is still unclear about this card?"
akb chat 12                   # the conversation so far
akb chat 12 --clear           # forget it and start fresh
```

You explain nothing to open one. A conversation starts knowing what a coding agent
knows after you type `/kanban`: your goal, your modules, your tracks, every open card in one
line, and — when you name one — that card in full, with its fields, its open questions, and
the cards it waits on and belongs to. It knows where your memory files are and reads them
before it suggests anything, and it knows which `akb` command answers which ask, so when the
answer turns out to be work it hands you the line to run rather than running it.

What it was shown is the board as it stood when the conversation started, so on anything
that may have moved since — a card that was refined, a run that finished — it goes and reads
again instead of answering from that snapshot.

The reply arrives as it is written, and the next message lands in the same session — the
agent still has everything said before, so you can ask a follow-up without explaining your
project again. Every message is its own command, so the conversation is picked up from any
terminal and survives closing one. The board's conversation and each card's are separate,
and both live under `docs/kanban/.chats/`, on your machine and out of git.

A chat is not a run: it never shows in `akb runs`, never holds a card, and never keeps a
run off the card it is about. It builds nothing either — when the answer is work, start the
run for it.

Only an agent whose command can take a second message into its own session can hold a
conversation. On any other one, chat says so and names the agents that can.

## The manual

`akb help runs` is what a coding agent reads: every command it may call — the card work,
the runs, the agent settings — and when to call each. `akb board help` is the board's own
bookkeeping beneath it: ids, a card's fields, the index, the releases.

The flows are `akb guide`:

```bash
akb guide                     # every flow, one line each
akb guide board               # how the board works: card format, layout, memory
akb guide refine              # one card, vague to ready
akb guide plan-release        # fill a release from its goal
```

A printed flow already carries the ones its action needs, in full, so this is for the
rest.

A run that writes or changes a card is followed by `akb refine` on that card, started as a
run of its own once the first one ends — so `akb create "…"`, `akb revise`, `akb resolve`,
`akb propose` and `akb plan-release` all come back with their cards refined. Archiving or
rejecting a card does the same for every card it was blocking that now has nothing left in
its way. Each one is an ordinary run: it shows in `akb runs`, has its own log, and
`akb stop` ends it.

## What it won't do

Reading your repo, filling in `docs/kanban/config.md`, writing the module map, proposing
tasks — all of that needs a judgement call, so it stays the agent's job. When this command
hits something it can't decide, it prints it under **Needs your attention** and leaves it
alone.

`akb install`, `akb skill install` and `akb update` are all safe to run twice.

## Also

- Source and docs: <https://github.com/ai4kanban/ai4kanban>
- `npx ai4kanban-ui` still serves the board in a browser, but that way is deprecated — the
  app above is those same pages in a window.

Node 18+. No dependencies.
