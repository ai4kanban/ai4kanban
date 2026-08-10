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
questions:
  - Install writes the skill to .claude/skills/ and .agents/skills/. Cursor reads the .agents folder, so it is covered — do OpenClaw and OpenCode read it too, or does each need its own skill location?
---

The board can only run work through Claude Code or Codex. Someone who works in Cursor,
OpenClaw, or OpenCode can read the board but never press Implement, so they leave. Add
those three agents.

## Scope
- Add three agents: Cursor, OpenClaw, and OpenCode. No other agent is added on a guess —
  the next one is whichever users ask for.
- Everything the existing agents get, a new one gets: a live log, a cost and model line
  where the agent reports them, stop, and resume where its CLI can resume.
- An agent that cannot resume says so in its dialog instead of showing a button that
  fails.
- When the agent's CLI is not installed, the dialog says what to install rather than
  failing at run time.
- Every button must reach the skill under the new agent: the skill has to sit where that
  agent looks for it, and the prompt has to trigger it the way that agent triggers a
  skill. Install already writes the skill to the shared `.agents` folder, so an agent that
  reads that folder needs nothing extra.
- Name the supported agents in the local UI docs and in the README, so the claim matches
  what ships.

## Todo
- [ ] Confirm each of the three runs headless from a prompt, and see what its output
      reports — a session id to resume by, a model, a cost.
- [ ] Add Cursor, with its live log and its settings.
- [ ] Add OpenClaw, with its live log and its settings.
- [ ] Add OpenCode, with its live log and its settings.
- [ ] Handle stop, resume, and the missing-CLI case for each.
- [ ] Run a real card end to end with each new agent — implement it, refine it, archive it.
- [ ] Name the supported agents in `kanban-ui/README.md`.
- [ ] Update the agent list in `README.md` and `README-zh.md`, roadmap line included.

## Source
- Competitive analysis of Task Master, 2026-08-05 —
  https://github.com/eyaltoledano/claude-task-master; they run on a long list of providers
  and keep adding, including free and local ones (LM Studio, Ollama), so nobody is turned
  away for not having the one subscription. We support two paid CLIs.
