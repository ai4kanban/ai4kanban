---
title: Support Codex CLI as the agent harness
track: features
priority: med
roi: high
status: todo
blocked_by: []
related: []
modules: [local-ui, skill, site]
questions: []
---

Let a Codex CLI user run the board. Every card button today spawns Claude Code;
with a Codex harness behind the interface from #68, a Codex subscription works too.

## Scope
- Add a Codex harness: spawn `codex exec --json --sandbox workspace-write`. `--json`
  streams JSONL events on stdout for the live tail; the sandbox flag is needed because
  `codex exec` defaults to read-only and a kanban run writes files. Map exit codes to run
  outcomes.
- A Codex run writes only inside the repo and gets no network, and `codex exec` refuses to
  run outside a git repo. All three stay as they are. Someone who needs more widens it in
  `harness.command`, the same escape hatch every harness has, and the harness never
  overrides a flag written there by hand.
- Codex reads `/kanban` as plain chat text — it triggers nothing. Codex calls a skill with
  `$`, so the Codex prompts start with `$kanban.` instead; the rest of each prompt stays
  the same.
- `$kanban` only resolves when the skill sits in a folder Codex reads —
  `.agents/skills/kanban/` in the project. Our own install prompt puts it there as well as
  in `.claude/skills/kanban/`, so one install serves both agents and asks nothing.
- The skill tells the agent to run the script at `.claude/skills/kanban/kanban.mjs`. That
  names one agent's folder, so it is wrong anywhere else the skill sits. The skill points
  at the script in its own folder instead.
- Codex has no `--session-id` flag, so the id can't be pinned up front. Capture the
  `thread_id` from the run's first `thread.started` event and store it as the run's session
  id. The resume handoff copies `codex resume <thread-id>` and appears only once that event
  has arrived. Resuming needs a Codex CLI from May 2026 (0.135) or later.
- Show "Codex" as the agent name in the UI.
- Out of this task: installing or upgrading the skill from the UI — for example an Install
  button when the Codex skill folder is missing.

## Todo
- [ ] Add a Codex harness in `kanban-ui/lib/agent.ts`: spawn `codex exec --json --sandbox workspace-write`, parse its JSONL events (`thread.started`, `turn.*`, `item.*`, `error`) into the live tail, and map exit codes to outcomes. Leave out any flag the user's own `harness.command` already sets.
- [ ] Start the Codex prompts with `$kanban.` instead of `/kanban.` — each harness carries its own way of calling the skill.
- [ ] Drop the `.claude/skills/kanban/` path from the script line in `skill/SKILL.md`, so the skill runs the script from its own folder wherever it is installed.
- [ ] Capture `thread_id` from the `thread.started` event, store it as the session id, show the `codex resume <thread-id>` handoff once it arrives, and continue a failed run with `codex exec resume <thread-id>`.
- [ ] Show "Codex" as the agent name in the UI, with its own icon next to `kanban-ui/public/agents/claude.svg`.
- [ ] Teach the Codex harness to recognise its own failures for #67's three kinds: Codex
      says "You've hit your usage limit" with a "Try again at <local time>" reset, and it
      reports a failure on a different event than Claude Code does. Skip this if #67 hasn't
      landed yet — then #67 writes both.
- [ ] Make `web/public/INSTALL_PROMPT.txt` copy the skill into `.agents/skills/kanban/` as well as `.claude/skills/kanban/`, stamp `.version` in both, and ask the user nothing about which agents they use.
- [ ] Update `skill/references/update.md` so an update refreshes every folder the skill was copied into, not only `.claude/skills/kanban/`.
- [ ] Update `kanban-ui/README.md`: how to switch to Codex, that the skill must be installed for Codex first, that resuming needs Codex CLI 0.135 or later, and that a Codex run writes only inside the repo with no network until you widen it in `harness.command`.
- [ ] Update `README.md` and `README-zh.md`: Codex is wired up now, not "on the roadmap". The site copy already says any harness, so it needs no change.
- [ ] In a project with the skill installed for Codex, click Refine on a card and check the run loads the skill from `$kanban` and the card really changes.

## Decided by the agent
- How should a Codex run load the skill? — as a real Codex skill: the prompt opens with
  `$kanban`. Codex ignores slash triggers, and a "read this file and follow it" prompt
  would leave the user without the skill in their own Codex session. Codex also picks a
  skill up from its description on its own, so a prompt that names the skill still lands if
  the `$` mention turns out not to fire in `exec` mode.
- Where does the skill folder live? — `.agents/skills/kanban/` is the folder Codex reads in
  a project, and our install prompt writes it. The skill stops naming `.claude/` in its own
  instructions, so it also runs from wherever another installer — `npx skills add`, a
  plugin — put it.
- Which sandbox does a Codex run get? — `--sandbox workspace-write`. `--full-auto` is
  deprecated in current Codex and prints a warning, so it is not used.
- Can a Codex session be resumed from the terminal? — yes. `codex resume <thread-id>` opens
  the run in the Codex TUI, and `codex exec resume <thread-id>` continues it headless. The
  id is captured from the JSON stream because Codex can't pin one up front.
- Rate limits — Codex has no equivalent of `CLAUDE_CODE_MAX_RETRIES=0`; the harness sets no
  special env and accepts that a rate-limited run may wait.
