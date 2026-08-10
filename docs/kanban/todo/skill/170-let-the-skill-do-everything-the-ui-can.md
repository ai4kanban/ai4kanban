---
title: Let the skill do everything the UI can
track: skill
priority: med
roi: high
status: todo
release: 0.6.0
blocked_by: [167, 168]
related: []
modules: [skill]
questions: []
---

Some things can only be done by pressing a button in the UI — starting a build, turning auto-refine on, choosing which agent does the work. Someone working in their coding agent cannot ask for them at all. Now that one CLI does all of it, the skill should reach the same actions.

## Scope
- Go through the UI action by action and give the skill a way to ask for each one, in plain
  words, through the same CLI.
- The gap today: starting and stopping a build, turning auto-refine on and off, picking the
  agent and how hard it thinks, saving a key, testing the setup, and reading a run's log.
- The skill and the UI never disagree — both do the same thing through the same command.
- The skill stays optional. This is about what someone can ask for once they have it, not
  about needing it.

## Todo
- [ ] List every action the UI offers and mark the ones the skill cannot ask for.
- [ ] Add a flow, or a line in an existing flow, for each missing action.
- [ ] Ask for each one from a coding agent and check it does the same thing as the button.
- [ ] Update `SKILL.md` and the guides so the new asks are documented.
