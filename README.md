<div align="center">

# AI4Kanban

### AI project management that grows with you.

Give it a vague idea. The agent breaks it down, answers what it can<br>
on its own, asks you the rest — and keeps at it in the background<br>
until every detail is clear enough to build.

**English** · [简体中文](README-zh.md)

[Website](https://ai4kanban.dev) · [Quick start](#quick-start) · [Roadmap](#roadmap)

<img src="https://cdn.ai4kanban.dev/og-image-v2.jpg" alt="AI4Kanban — AI project management that grows with you" width="720">

</div>

## What it does

Everything checked below is built and working today.

- [x] **Breaks work down.** The agent reads an idea and splits it into subtasks. An
  unrelated ask tangled in gets pulled out as a task of its own.
- [x] **Clarifies in a loop.** The agent starts by questioning the idea. Whatever
  memory and common sense can settle, it settles on its own; the rest comes to you. It
  keeps looping until it runs out of questions.
- [x] **Runs 24/7.** Breakdown and clarification keep running in the background until the
  idea becomes a clear spec.
- [x] **Every decision is traceable.** You can always see how a spec took shape, step by
  step.
- [x] **Proposes its own tasks.** The agent pitches features drawn from each module's
  memory. Veto one and that's recorded — it won't pitch that kind of idea again.
- [x] **Self-evolving.** Each time you step in, that call is recorded and steers the
  agent's later decisions. Memory is organized by project module.
- [x] **Orders the work.** It doesn't just split tasks — it identifies dependencies and
  weighs ROI against effort, so work runs in the right order.
- [x] **Owns the whole lifecycle.** Its job doesn't end once the spec is clear. It
  runs a task's entire life — proposed, clarified, built, archived — so the board always
  shows where the project really stands.

AI4Kanban is built for small teams. Put the work on a board and step back from
implementation — spend your attention on what each task is worth to users, not on how the
coding agent is doing its job. Today's coding agents already turn a clear spec into
working code. Hand them a vague idea, though, and they'll build the wrong thing on top of
the wrong assumptions. AI4Kanban remembers your past decisions and draws on them to turn
the same vague idea into a spec concrete enough to build.

## How it's built

- [x] **Any harness.** Designed for any harness — Claude Code, Codex, Cursor. Claude Code
  and Codex are wired up today; the rest is on the roadmap.
- [x] **Local first.** Cards are Markdown files by default. No MCP, no database,
  token-efficient. Everything is plain text in git — you can review it, diff it, roll it back.
- [x] **Works out of the box.** One prompt installs or updates it. AI4Kanban does one thing —
  project management — so there's almost nothing to configure.
- [x] **Two ways to drive it.** Work the board from the command line through the skill,
  or point and click in the local UI.

Human project managers track their work on a Kanban board, and an agent should too. AI4Kanban
doesn't live in a chat window — the board is the interface.

## Quick start

From your project root, tell Claude Code (or any coding agent that can run shell commands):

```
Set up ai4kanban for this project. Read
https://ai4kanban.dev/INSTALL_PROMPT.txt and follow it.
```

The agent reads your codebase, then runs one command:

```bash
npx ai4kanban install --tracks feature,bug,research
```

That copies the skill into your project and scaffolds the board under `docs/kanban/`. The
agent then fills in the configuration, writes the module map, and proposes your first three
tasks. Both your config and your board live in `docs/kanban/` — the skill folder holds only
generic code. From then on you just talk to the board.

To update later, one command again:

```bash
npx ai4kanban update
```

It replaces the skill with the newest version, repairs anything an older release never
wrote, and tells you which version you moved from and to. Your board is never touched.

Prefer plugins? `/plugin marketplace add ai4kanban/ai4kanban` then
`/plugin install kanban@kanban` makes the skill available, but it doesn't configure a
board — run `npx ai4kanban install` for that. The install prompt above covers both paths.

If your agent can't fetch URLs, open [`INSTALL_PROMPT.txt`](web/public/INSTALL_PROMPT.txt)
and paste its contents instead — same result. The only requirement is Node.js 18+ — nothing
has dependencies, so there's nothing to install.

## Using the skill

Drive it in plain language — the skill triggers on these:

| You say | The agent does |
| --- | --- |
| "propose new tasks" | walks one focus area and drafts new cards for work nobody's planned |
| "add a task: …" | reviews the idea, writes a card, adds it to the index |
| "refine #4" | reviews card #4 and makes it one step more concrete |
| "resolve #4" | works through card #4's open questions with you |
| "review the board" | checks cards for clarity, duplication, done-ness |
| "create release v1" | plans a version, then "put #4 in v1" and "what's in v1?" |
| "#4 is done" | updates the docs the change touched, removes the card |

Planning a version is optional. Create a release, put the cards you promised into it, and
ask what's in it — you get each release in ship order with how many cards it holds and how
many are ready to build. Cards you don't place sit at `next`: wanted, not promised to a
version.

This repo uses the skill on itself: `docs/kanban/` is a real board tracking the skill's
own development, so you can see exactly what a filled-in setup looks like.

### Web UI (optional)

A local board over the same Markdown files — read a card in full and act on it with a
click instead of a prompt:

```bash
npx ai4kanban-ui        # http://localhost:7420
```

![The board view in the web UI](https://cdn.ai4kanban.dev/kanban-skill-ui-v3.jpg)

![Card detail view in the web UI](https://cdn.ai4kanban.dev/kanban-skill-ui-detail-v3.jpg)

Localhost only — no hosting, no login. See [kanban-ui/](kanban-ui/README.md) for options.

## Roadmap

- [ ] **Pluggable storage** (soon) — keep the board in Obsidian, Notion, or GitHub Issues.
- [ ] **Pluggable harness** (in progress) — hand tasks to Claude Code, Codex, or Cursor to
  run. Claude Code and Codex work today; Cursor is next.
- [ ] **Git worktrees** (soon) — tasks run in parallel, each in its own worktree, without
  stepping on each other.
- [ ] **Schedules and webhooks** (soon) — pull in requests from outside, on a timer or
  through a webhook.
- [ ] **Blocked-task management** (soon) — get tough on tasks that sit too long: split
  them, rewrite them, or reject them outright.
- [ ] **Team collaboration** (later)

## Updating

One prompt — the update guide ships with the skill, so there's nothing to fetch first:

```
Update ai4kanban in this project. Read
.claude/skills/kanban/references/update.md and follow it.
```

Updates overwrite only the generic skill folder (`SKILL.md`, `kanban.mjs`, the references).
Your config and your board both live in `docs/kanban/`, so they're never touched.

## License

[Apache License 2.0](LICENSE). Free to use, modify, and redistribute. Contributions
welcome.
