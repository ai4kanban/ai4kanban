---
title: Run the board on DeepSeek Harness (dsh)
track: features
priority: med
roi: med
status: todo
release: 0.6.1
blocked_by: []
related: [160]
modules: [skill, local-ui]
questions:
  - question: "[user] dsh's own command line still can't show a run's log or continue a stopped run, and dsh may never add either. dsh does let us replace the part that runs a task with one of ours, which would do both. Do we?"
    mode: single
    options:
      - No — keep waiting on dsh, and ask the dsh project for the two options.
      - Yes — publish a small dsh part of our own, have the user install it into their dsh, and keep it working against a new dsh release most weeks.
      - Drop the card — dsh isn't worth a fifth agent.
    recommend: [1]
---

Add DeepSeek Harness (`dsh`) as a fifth agent the board can run, so someone already paying
for DeepSeek can press Implement without a second subscription. A user asked for it.

The four agents the board runs today are Claude Code, Codex, Cursor and OpenCode.

## What dsh does today
Last checked 2026-08-15, against `@deepseek-ai/dsh` 0.1.0-rc.6 and the one-shot part it
runs, `@deepseek-ai/dsh-headless` 0.0.1-rc.1. That is still the newest dsh on npm, so this
is the same release the first check read and nothing below has changed. A headless run is
`dsh --profile headless "<task>"` — dsh started from the command line with a prompt and left
to work with nobody watching, the way the board runs any agent.

- **No live log**: a headless run prints one thing, its final answer, once the work is
  finished. Nothing before that.
- **No output the board can follow**: the headless command takes a prompt, and `--help`.
  There is no other option — none for the output, the model, or a session.
- **No continuing an earlier run**: each headless run makes up a session name of its own and
  never prints it. dsh itself can reopen a session it saved; no command line reaches that.
- **The skill reaches it**: dsh reads `AGENTS.md`, and it reads `.agents/skills/` — the
  folder `akb install` already writes.
- **The prompt asks for the skill in a sentence**: dsh has no short name a prompt can type
  to call a skill, so it gets the same sentence Cursor and OpenCode get.
- **Install**: `npm install -g @deepseek-ai/dsh` puts `dsh` on the PATH.
- **Key**: `DEEPSEEK_API_KEY`. dsh keeps a key of its own too, in its settings folder
  `$DSH_HOME`, so a key typed into the board must not fight that one.
- **Model**: chosen in dsh's own settings file. There is nothing the board could pass to
  choose it.
- **What a run may touch**: no setting of dsh's does what a board run needs. Its normal
  setting keeps a run inside the project but stops to ask before every write, and a board
  run has nobody to answer; the one setting that never asks also takes the fence around the
  project away. The board has to hand dsh a small override file instead — see the todo.
- **dsh is built from swappable parts**: the part that runs a headless task is one of them,
  and a replacement of ours could both show the log and continue a run. It would be an npm
  package we publish, the user installs into their dsh, and we keep working against a
  project that ships a new pre-1.0 release most weeks.

## What ships
Nothing for now. An agent joins the board only if it shows its log while it works and can
pick up a run that stopped short (`docs/kanban/memory/local-ui/decisions.md`). dsh's command
line does neither today. OpenClaw, the last agent we looked at, was dropped over these same
two gaps, and a fifth agent that shows an empty screen for twenty minutes and can't be
picked up again would take that rule back.

The card stays open because dsh is close. Its browser mode already shows a run as it happens
and opens an earlier session again — only the command line can't. dsh is new and still
changing, and its options move between releases.

There is now a second way in: dsh lets anyone replace the part that runs a headless task, so
a part of our own could close both gaps without waiting for dsh. That is a package we would
have to publish and keep alive, so it is the user's call, and it is the open question on
this card.

So the build steps below wait on the re-check, and if the re-check fails, none of them run.
Write down the dsh version each re-check read, so the next one starts from there.

When it does ship, dsh should need no change outside the board's list of agents and its
logo. Anything more means the list itself needs fixing first.

## Todo
- [x] Check what a dsh headless run can do.
- [x] Work out how a dsh run reaches the kanban skill.
- [ ] Re-check dsh on a later release: does a headless run print its work as it goes, and
      can it be told to continue an earlier session? Both must be yes.
- [ ] Add dsh to the board's list of agents (`cli/src/lib/agent/harnesses.ts`) — how it is
      started, how it is continued, its settings, its key, and its install line — with the
      part that turns its output into a live log.
- [ ] Ship the override file a dsh run is started with, so it writes inside the project
      without stopping to ask and reaches no further into the machine than the four agents
      already do. Neither of dsh's own settings does both.
- [ ] Add dsh's logo at `kanban-ui/public/agents/` so it can be picked in the agent list.
- [ ] Run a real card end to end on dsh — implement it, refine it, archive it — and see a
      failure and a stop on it too.
- [ ] Name dsh everywhere we count our agents: `kanban-ui/README.md`, `README.md`,
      `README-zh.md`, and the site's home diagram and comparison pages, translations
      included.

## Decided by the agent
- **What ships while dsh can't show its log or continue a run?** Nothing. The rule for
  adding an agent already settles it.
- **Do we install dsh and run it by hand first?** No — the answers above come from the code
  dsh ships, which is firmer than one run on one machine.
- **Should the board learn to run an agent over HTTP, so it can use dsh's browser mode?**
  No. dsh's headless command is the way in, and it is a command line like the other four.
  The browser mode is a separate app with a server of its own; teaching the board to talk to
  a server would change how every agent is wired, for one agent that doesn't need it.
- **Why not make dsh show its log and continue a run ourselves?** Both are possible — dsh
  lets its one-shot runner be replaced, and its saved sessions can be reopened from inside.
  What it costs is a package of ours that has to keep up with dsh, and whether that is worth
  a fifth agent is the user's call, not ours.
- **Can the board read the log dsh saves instead of waiting for one?** No. dsh does append
  every run to a file under `$DSH_HOME` while the work happens, but the run never says which
  file is its own, the file is compressed, and reading it still gives no way to continue a
  run. It is not something dsh offers, so it would break on any release.
