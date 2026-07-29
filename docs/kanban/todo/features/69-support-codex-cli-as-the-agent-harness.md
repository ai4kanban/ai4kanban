---
title: Support Codex CLI as the agent harness
track: features
priority: med
roi: high
status: todo
blocked_by: []
related: []
modules: [local-ui, skill]
questions:
  - "[user] Our own install prompt (web/public/INSTALL_PROMPT.txt) only copies the skill into .claude/skills/kanban/. Should it point a Codex user at an installer that asks which agents to install for, or stay Claude Code only?"
---

Let a Codex CLI user run the board. Every card button today spawns Claude Code;
with a Codex harness behind the interface from #68, a Codex subscription works too.

## Scope
- Add a Codex harness: spawn `codex exec --json --full-auto`. `--json` streams
  JSONL events on stdout for the live tail; `--full-auto` is required because
  exec defaults to a read-only sandbox and a kanban run writes files. Map exit
  codes to run outcomes.
- Codex reads `/kanban` as plain chat text — it triggers nothing. Codex has its
  own skills and calls them with `$`, so the Codex prompts start with `$kanban.`
  instead; the rest of each prompt stays the same.
- `$kanban` only resolves when the skill is already installed for Codex, in a
  folder Codex reads (`.agents/skills/kanban/`). How it got there is the user's
  own business — `npx skills add` asks which agents to install for. This task
  installs, copies or links nothing; it only tells the user, in the docs, that
  Codex needs the skill installed for it before the buttons work.
- The skill tells the agent to run the script at `.claude/skills/kanban/kanban.mjs`.
  That names one agent's folder, so it is wrong anywhere else the skill sits. The
  skill points at the script in its own folder instead.
- Codex has no `--session-id` flag, so the id can't be pinned up front. Capture
  the `thread_id` from the run's first `thread.started` JSON event and store it
  as the run's session id. The resume handoff copies `codex resume <thread-id>`
  and appears only once that event has arrived. Resuming an exec session needs a
  Codex CLI from June 2026 or later.
- Show "Codex" as the agent name in the UI.
- Out of this task: installing or upgrading the skill from the UI — for example
  an Install button when the Codex skill folder is missing.

## Todo
- [ ] Add a Codex harness in `kanban-ui/lib/agent.ts`: spawn `codex exec --json --full-auto`, parse its JSONL events into the live tail, map exit codes to outcomes.
- [ ] Start the Codex prompts with `$kanban.` instead of `/kanban.` — each harness carries its own way of calling the skill.
- [ ] Drop the `.claude/skills/kanban/` path from the script line in `skill/SKILL.md`, so the skill runs the script from its own folder wherever it is installed.
- [ ] Capture `thread_id` from the `thread.started` event, store it as the session id, and show the `codex resume <thread-id>` handoff once it arrives.
- [ ] Show "Codex" as the agent name in the UI.
- [ ] Teach the Codex harness to recognise its own failures for #67's three kinds: Codex
      says "You've hit your usage limit" with a "Try again at <local time>" reset, and it
      reports a failure on a different event than Claude Code does. Skip this if #67 hasn't
      landed yet — then #67 writes both.
- [ ] Update `kanban-ui/README.md`: how to switch to Codex, that the skill must be installed for Codex first, the minimum Codex version for resuming a run, and that the sandbox blocks network access by default.
- [ ] Update `README.md` and `README-zh.md`: Codex is wired up now, not "on the roadmap". The site copy already says any harness, so it needs no change.
- [ ] In a project with the skill installed for Codex, click Refine on a card and check the run loads the skill from `$kanban` and the card really changes.

## Decided by the agent
- How should a Codex run load the skill? — as a real Codex skill: the prompt opens with `$kanban` and the user installs the skill for Codex the way they install any skill. Codex ignores slash triggers, and a "read this file and follow it" prompt would leave the user without the skill in their own Codex session.
- Where does the skill folder live? — wherever the user's installer put it. The board never copies, moves or links skill folders; the skill just stops naming `.claude/` in its own instructions, so it works from any agent's folder.
- Can a Codex session be resumed from the terminal? — yes: `codex resume <thread-id>` works for exec sessions on Codex CLIs from June 2026 on, so the UI offers the handoff; the id is captured from the JSON stream because Codex can't pin one up front.
- Rate limits — Codex has no equivalent of `CLAUDE_CODE_MAX_RETRIES=0`; the harness sets no special env and accepts that a rate-limited run may wait.
