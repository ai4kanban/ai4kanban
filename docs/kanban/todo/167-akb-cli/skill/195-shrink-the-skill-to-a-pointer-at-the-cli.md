---
title: Shrink the skill to a pointer at the CLI
track: skill
priority: med
roi: high
status: todo
release: 0.6.0
blocked_by: [194]
related: [167]
modules: [skill]
questions: []
---

The skill copied into a project is over a thousand lines of instructions that go stale the
moment they are copied. Cut it down to a short note that points at the command, and ship the
flows with the command instead.

## Scope
- What lands in a project is a short note: the board lives here, this command owns it, ask
  it what to do before any board action. It is meant to stay small enough to read at a
  glance.
- The flows themselves ship with the command. Upgrading the command upgrades every flow in
  every project — no re-install, no copies to keep in step.
- Nothing an agent needs is left out: whatever the flows used to say, the command now says
  when asked, filled in for the board it was asked about.
- The instructions no longer name any one agent's folder, so the same note works wherever an
  agent reads it from.
- A project that still has the old skill folder keeps working until it upgrades.
- The board's own bookkeeping commands are listed where the agent can find them, and stay
  out of what we teach a person.

## Todo
- [ ] Write the short note that replaces the skill, and check an agent can do a full board
      action from it and nothing else.
- [ ] Move the flows out of the copied folder and ship them with the command.
- [ ] Make the command's own help the agent's manual: every command it may call, and when.
- [ ] Keep a project that still has the old skill folder working until it upgrades.
- [ ] Run a create, a refine, a resolve and an archive on a project with only the short note
      installed, and check each lands what it used to.
