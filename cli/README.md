# ai4kanban

Set up and update [AI4Kanban](https://ai4kanban.dev/) in one command.

AI4Kanban is AI project management that grows with you: you give the agent a vague idea, it
breaks the idea down, settles what it can on its own, asks you the rest, and keeps going
until the spec is clear enough to build. The board is plain Markdown in `docs/kanban/`,
versioned in git.

This package is the setup command. The board and the skill are the product.

## Install

From your project root:

```bash
npx ai4kanban install
```

That copies the skill into `.claude/skills/kanban/` (Claude Code) and
`.agents/skills/kanban/` (Codex), then scaffolds `docs/kanban/` — the track folders, the
board index, the memory set, and a blank `config.md`.

Pass the tracks your project actually splits into:

```bash
npx ai4kanban install --tracks feature,bug,research
```

Normally you don't run this by hand. You paste the install prompt from
<https://ai4kanban.dev/INSTALL_PROMPT.txt> and your agent reads the repo, picks the tracks,
runs this command, and fills in the config afterwards.

## Update

```bash
npx ai4kanban update
```

Overwrites every skill folder it finds with this version, repairs a board written by an
older release, and prints which version you moved from and to with a link to everything
that changed in between. Your cards, config, and memory are never touched.

## Put an agent to work

Installed, this command is `akb`. It starts the board's runs, watches them, and holds the
settings they run under — so a card can be built from a terminal, over ssh, or from a
script, without a chat session and without a browser.

```bash
akb implement 12              # build the card
akb refine 12                 # sharpen it until it is ready to build
akb create "add dark mode"    # write the card(s) for it
akb propose                   # write the next tasks
akb archive 12                # finish it
```

The run keeps working after the command returns. Watch it, or stop it, from anywhere —
including from the board app, which drives its buttons through these same commands:

```bash
akb runs                      # what is running, and what ran lately
akb log 3f2a1b04 --follow     # watch a run as it goes
akb stop 3f2a1b04             # end one
akb resume 3f2a1b04           # continue one that failed
```

Which agent runs them — Claude Code, Codex, Cursor or OpenCode — and what it is set to:

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

Both commands are safe to run twice.

## Also

- The board app: <https://ai4kanban.dev/download> — the same Markdown files, in a window.
  (`npx ai4kanban-ui` still serves it in a browser, but that way is deprecated.)
- Source and docs: <https://github.com/ai4kanban/ai4kanban>

Node 18+. No dependencies.
