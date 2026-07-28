---
title: Support Codex CLI as the agent harness
track: features
priority: med
roi: high
status: ready
blocked_by: [68]
related: []
modules: [local-ui]
questions: []
---

Let a Codex CLI user run the board. Every card button today spawns Claude Code;
with a Codex harness behind the interface from #68, a Codex subscription works too.

## Scope
- Add a Codex harness: spawn `codex exec --json --full-auto`. `--json` streams
  JSONL events on stdout for the live tail; `--full-auto` is required because
  exec defaults to a read-only sandbox and a kanban run writes files. Map exit
  codes to run outcomes.
- Codex reads `/kanban` as plain chat text — it triggers nothing. The Codex
  prompts start with "Read .claude/skills/kanban/SKILL.md and follow it."
  instead; the rest of each prompt stays the same.
- Codex has no `--session-id` flag, so the id can't be pinned up front. Capture
  the `thread_id` from the run's first `thread.started` JSON event and store it
  as the run's session id. The resume handoff copies `codex resume <thread-id>`
  and appears only once that event has arrived. Resuming an exec session needs a
  Codex CLI from June 2026 or later.
- Show "Codex" as the agent name in the UI.

## Todo
- [ ] Add a Codex harness in `kanban-ui/lib/agent.ts`: spawn `codex exec --json --full-auto`, parse its JSONL events into the live tail, map exit codes to outcomes.
- [ ] Start the Codex prompts with "Read .claude/skills/kanban/SKILL.md and follow it." instead of `/kanban`.
- [ ] Capture `thread_id` from the `thread.started` event, store it as the session id, and show the `codex resume <thread-id>` handoff once it arrives.
- [ ] Show "Codex" as the agent name in the UI.
- [ ] Update `kanban-ui/README.md`: how to switch to Codex, the minimum Codex version for resume, and that the sandbox blocks network access by default.

## Decided by the agent
- How should a Codex run load the skill? — the prompt opens with "Read .claude/skills/kanban/SKILL.md and follow it": Codex ignores slash triggers in exec, and the alternatives (an AGENTS.md pointer, a copy under `.agents/skills/`) add a second install surface in the consumer repo.
- Can a Codex session be resumed from the terminal? — yes: `codex resume <thread-id>` works for exec sessions on Codex CLIs from June 2026 on, so the UI offers the handoff; the id is captured from the JSON stream because Codex can't pin one up front.
- Rate limits — Codex has no equivalent of `CLAUDE_CODE_MAX_RETRIES=0`; the harness sets no special env and accepts that a rate-limited run may wait.
