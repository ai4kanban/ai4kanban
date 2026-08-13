---
title: Make akb the agent's manual, and shrink the skill to a note
track: skill
priority: med
roi: high
status: ready
release: 0.6.0
blocked_by: [194]
related: [167]
modules: [skill]
questions: []
---

The skill copied into a project is over a thousand lines of instructions that go stale the
moment they are copied — and even at that length it only covers the cards. Starting a build,
picking the agent, saving a key, turning auto-refine on, reading a run's log are all still
button-only. Cut what lands in a project down to a short note, ship the flows with the
command, and make the command answer for every action the board has — the card work and the
run work alike.

## Scope
- What lands in a project is a short note: the board lives here, this command owns it, ask
  it what to do before any board action. It is meant to stay small enough to read at a
  glance.
- The flows themselves ship with the command. Upgrading the command upgrades every flow in
  every project — no re-install, no copies to keep in step.
- Nothing an agent needs is left out: whatever the flows used to say, the command now says
  when asked, filled in for the board it was asked about.
- Every action the board UI offers can also be asked for in plain words from a coding agent,
  and lands the same thing the button lands. The gap as it stands: starting and stopping a
  build, seeing what is running, reading a run's log, continuing one that failed, picking the
  agent and its model and how hard it thinks, saving a key, checking the setup works, turning
  auto-refine on and off.
- What is missing for those is the words, not the commands — and they go in the same two
  places as everything else here, the short note and the command's own help. No third copy of
  the rules.
- A key is the one thing the skill hands back instead of doing: it gives the user the line to
  type, so the key never passes through the agent.
- When an ask can't run — no agent picked, no key, no board — the answer names the one line
  that fixes it, instead of failing quietly.
- The instructions no longer name any one agent's folder, so the same note works wherever an
  agent reads it from.
- A project that still has the old skill folder keeps working until it upgrades.
- The board's own bookkeeping commands are listed where the agent can find them, and stay
  out of what we teach a person.
- The skill stays optional. This is about what someone can ask for once they have it, not
  about needing it.

## Todo
- [ ] Write the short note that replaces the skill, and check an agent can do a full board
      action from it and nothing else.
- [ ] Move the flows out of the copied folder and ship them with the command.
- [ ] Walk the UI action by action and mark the ones nobody can ask for from a coding agent.
- [ ] Make the command's own help the agent's manual: every command it may call — the card
      work and the run work alike — and when to call it.
- [ ] Close each marked gap in the words the agent reads, so every action has a plain-words ask.
- [ ] Have the skill hand over the line that saves a key rather than running it.
- [ ] Name the one line that fixes it when an ask can't run — no agent picked, no key, no board.
- [ ] Keep a project that still has the old skill folder working until it upgrades.
- [ ] Show in the README and the guides how to ask a coding agent for these, beside the
      commands a person types.
- [ ] On a project with only the short note installed, ask a coding agent in plain words for
      a create, a refine, a resolve, an archive and each UI action, and check every one lands
      what the button or the old flow landed.

## Decided by the agent
- **Where the new words go**: the short note installed in the project and the command's own
  help. The flows ship with the command now, so there is no second place to add them.
- **Does the skill save a key itself?**: no. It prints the line for the user to run. A key the
  agent types lands in its transcript and in the shell history, and the board's rule is that
  a saved key is never read back.
