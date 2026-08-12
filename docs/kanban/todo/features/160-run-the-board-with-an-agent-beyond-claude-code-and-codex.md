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

The board can only run work through Claude Code or Codex. Someone who works in Cursor or
OpenCode can read the board but never press Implement, so they leave. Add those two agents.

## Scope
- Add two agents: Cursor and OpenCode. No third one is added on a guess — the next agent is
  whichever users ask for.
- Everything the existing agents get, a new one gets as far as its CLI allows: a live log,
  a cost and model line where the agent reports them, stop, and resume.
- Where a CLI can't do one of those, the board shows nothing rather than a number that
  lies. A run on an agent that reports no cost shows a duration and no price, the way a
  Codex run does today.
- When the agent's CLI is not installed, the dialog says what to install. Cursor installs
  from a script rather than from npm, so that line is not always an npm command.
- Every button must reach the skill under the new agent. Both read the shared `.agents`
  folder that install already writes, so nothing new is installed — but the prompt still
  has to name the skill in a way each agent understands.
- Name the supported agents in the local UI docs, in both READMEs, and on the site's home
  diagram, so the claim matches what ships.

## What each agent can show the user
- **Cursor** — live log yes, model yes, resume yes. No cost and no token counts: its output
  reports neither.
- **OpenCode** — live log yes, cost and token counts yes, resume yes. No model name in its
  output, so a run on it names no model.

## Todo
- [ ] Add Cursor, with its live log and its settings.
- [ ] Add OpenCode, with its live log and its settings.
- [ ] Handle stop, resume, and the missing-CLI case for each, and say in the dialog what
      an agent can't do rather than offering it.
- [ ] Run a real card end to end with each new agent — implement it, refine it, archive it.
- [ ] Name the supported agents in `kanban-ui/README.md`, one short section each saying
      what reads differently on that agent — "Running on Codex" is the shape to follow.
- [ ] Update the agent list in `README.md` and `README-zh.md`, roadmap line included.
- [ ] Replace the "…" agent tile on the site's home diagram with the agents that now ship.

## Decided by the agent
- **Does install need a new skill folder for these two?** No. Both read
  `.agents/skills/kanban/`, which install already writes, and both read `.claude/skills/`
  on top of that.
- **How does the prompt trigger the skill?** Not with a one-word name. OpenCode has no
  slash or `$` skill syntax at all — its model picks a skill itself — and Cursor's short
  name is documented for its chat box, not for a headless run. So for these two the prompt
  asks for the skill in a sentence instead of a token.
- **A blank cost or model line is fine.** The board already shows what a run reported and
  nothing else, so Cursor shows no price and OpenCode names no model. Better a blank than
  a number the run never earned.
- **Cursor runs with its own docs' headless settings.** Without them it stops to ask before
  it runs anything, and a board run has nobody to answer.
- **OpenCode gets no API key box.** It reaches any provider and each one has its own key,
  so a single box would be wrong for most people. Its runs use the login
  `opencode auth login` already made.
- **OpenCode needs no permission flag.** Left alone it writes inside the repo and refuses
  anything outside it, which is what a board run wants. The flag that would widen that
  doesn't exist in the version people install today, and passing it stops the run dead.

## Source
- Competitive analysis of Task Master, 2026-08-05 —
  https://github.com/eyaltoledano/claude-task-master; they run on a long list of providers
  and keep adding, including free and local ones (LM Studio, Ollama), so nobody is turned
  away for not having the one subscription. We support two paid CLIs.
</content>
