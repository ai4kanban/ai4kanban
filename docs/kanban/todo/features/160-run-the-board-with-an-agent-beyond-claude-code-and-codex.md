---
title: Run the board with an agent beyond Claude Code and Codex
track: features
priority: med
roi: med
status: todo
release: 0.6.0
blocked_by: []
related: []
modules: [local-ui]
questions: []
---

The board can only run work through Claude Code or Codex. Someone who works in Cursor,
OpenClaw, or OpenCode can read the board but never press Implement, so they leave. Add
those three agents.

## Scope
- Add three agents: Cursor, OpenClaw, and OpenCode. No other agent is added on a guess —
  the next one is whichever users ask for.
- Everything the existing agents get, a new one gets as far as its CLI allows: a live log,
  a cost and model line where the agent reports them, stop, and resume.
- Where a CLI can't do one of those, the board says so plainly instead of showing a button
  or a number that lies. No Resume button on an agent that can't resume. An agent that
  prints nothing until it finishes shows a log that says the output comes at the end,
  not an empty box that reads as a hang.
- When the agent's CLI is not installed, the dialog says what to install. One of the three
  installs from a script rather than from npm, so that line is not always an npm command.
- Every button must reach the skill under the new agent. All three read the shared
  `.agents` folder that install already writes, so nothing new is installed — but the
  prompt still has to name the skill in a way each agent understands.
- Name the supported agents in the local UI docs, in both READMEs, and on the site's home
  diagram, so the claim matches what ships.

## What each agent can show the user
Read from each agent's own docs on 2026-08-11. The first todo is to confirm it by running
them — the docs are what to expect, not what to build against.

- **Cursor** — live log yes, model yes, resume yes. No cost and no token counts: its
  output reports neither, so a Cursor run shows a duration and no price, the way a Codex
  run does today.
- **OpenCode** — live log yes, cost and token counts yes, resume yes. No model name in its
  output, so a run on it names no model.
- **OpenClaw** — no live log: it prints one summary when the run ends and nothing before
  that. That summary does carry the model, the cost and the token counts. It cannot
  resume, and its runs give up after 10 minutes unless told otherwise.

## Todo
- [ ] Run each of the three headless by hand and record what its output really reports —
      a session id to resume by, a model, a cost, token counts.
- [ ] Add Cursor, with its live log and its settings.
- [ ] Add OpenClaw, with its end-of-run summary and its settings.
- [ ] Add OpenCode, with its live log and its settings.
- [ ] Handle stop, resume, and the missing-CLI case for each, and say in the dialog what
      an agent can't do rather than offering it.
- [ ] Run a real card end to end with each new agent — implement it, refine it, archive it.
- [ ] Name the supported agents in `kanban-ui/README.md`, one short section each saying
      what reads differently on that agent — "Running on Codex" is the shape to follow.
- [ ] Update the agent list in `README.md` and `README-zh.md`, roadmap line included.
- [ ] Replace the "…" agent tile on the site's home diagram with the agents that now ship.

## Decided by the agent
- **Does install need a new skill folder for these three?** No. All three read
  `.agents/skills/kanban/`, which install already writes; Cursor and OpenCode read
  `.claude/skills/` on top of that. OpenClaw is the one catch: it only looks under the
  folder it treats as its workspace, which is not the repo unless its command says so.
- **How does the prompt trigger the skill?** Not with a one-word name. OpenCode has no
  slash or `$` skill syntax at all — its model picks a skill itself — and Cursor's and
  OpenClaw's short names are documented for their chat boxes, not for a headless run. So
  for these three the prompt asks for the skill in a sentence instead of a token.
- **A blank cost or model line is fine.** The board already shows what a run reported and
  nothing else, so Cursor shows no price and OpenCode names no model. Better a blank than
  a number the run never earned.
- **Cursor runs with its own docs' headless settings.** Without them it only proposes
  changes instead of writing them, so a board run would look like it worked and change
  nothing.

## Source
- Competitive analysis of Task Master, 2026-08-05 —
  https://github.com/eyaltoledano/claude-task-master; they run on a long list of providers
  and keep adding, including free and local ones (LM Studio, Ollama), so nobody is turned
  away for not having the one subscription. We support two paid CLIs.
