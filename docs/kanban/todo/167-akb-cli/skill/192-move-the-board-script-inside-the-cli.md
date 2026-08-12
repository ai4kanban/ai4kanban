---
title: Move the board script inside the CLI
track: skill
priority: high
roi: high
status: todo
release: 0.6.0
blocked_by: []
related: [167]
modules: [skill]
questions: []
---

The board's bookkeeping lives in a script that only works on the folder it is run from and
ends the whole process when something is wrong. Move it inside the CLI so anything can ask
it about any board, without a skill folder installed and without being killed by a bad
answer.

## Scope
- Every bookkeeping move — take an id, write a card's fields, patch its questions, move it
  into a release, archive it, reject it, record a recurring run, scaffold memory — becomes a
  command of the CLI itself.
- A command can be pointed at a board in another folder, and two boards can be worked on at
  once without either seeing the other's answers.
- A refused move says why and hands the reason back, rather than ending whoever asked.
- Any command can answer in plain words or in a form another program can read.
- Nothing about a card changes: the same ids, the same fields, the same files, the same
  index.
- These commands are the agent's, not the person's. They stay out of the README.

## Todo
- [ ] Capture what every board command prints today — the words, the warnings, the failure
      codes — and keep it as the thing to compare against for the rest of this group.
- [ ] Make every board command work on a named board rather than the folder it was started
      from.
- [ ] Make a refused move report the reason instead of ending the process.
- [ ] Let every command answer in a form another program can read.
- [ ] Keep the script that ships in an installed skill answering exactly as it does today,
      so a board installed before this lands is untouched.
- [ ] Check every command on a repo that has a board but no skill folder installed.
