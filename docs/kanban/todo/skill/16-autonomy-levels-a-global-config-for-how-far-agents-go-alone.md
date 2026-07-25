---
title: "Autonomy levels: a global config for how far agents go alone"
track: skill
priority: low
roi: med
status: todo
blocked_by: []
related: [6, 40]
modules: []
questions:
  - Are we ready to ship any autonomy level now, or park this until we've run more supervised loops? We still lack experience with agents deciding alone.
  - Where should the autonomy config live — the skill's config.md, or docs/kanban/ so the local UI can read and toggle it?
---

Add a global setting that says how much the agent may do without asking a human. Today
every hard decision stops at the user; a user who trusts the agent should be able to
turn that off, level by level.

This is an advanced feature we still lack experience with. Keep it a design card until
the open questions above are answered — don't build yet.

## Scope

Four toggles. The first three form a ladder — each one includes the ones below it.
The fourth is independent.

- **auto-design** — the agent resolves a card's open questions itself instead of
  asking. Assumes the agent is smart enough to answer the questions we listed; it
  does not assume we listed them all.
- **auto-implement** — when a card has no open questions left, the agent implements
  it from the plan. Includes auto-design, and further assumes the agent can find and
  resolve all open questions on its own — no human input at all.
- **auto-archive** — the max level: no human review either. A task runs end to end —
  design, implement, verify, archive — with no human in the loop. Turning this on
  turns on the two below it.
- **auto-reject** — independent of the ladder: the agent may decide alone that a task
  is a duplicate or against our current direction, and reject it. Can stay off even
  when auto-archive is on.

Default: everything off — today's behavior, where open questions wait for the user.

## Todo

- [ ] Answer the open questions (resolve flow).
- [ ] Decide how the flows read the levels: refine/resolve check auto-design,
      implement checks auto-implement, review/archive check auto-archive, reject
      checks auto-reject.
- [ ] Write the config format and defaults.
- [ ] Update SKILL.md and the references that change behavior per level.
- [ ] Update the user-facing docs (daily-loop guide, README) once it ships.
