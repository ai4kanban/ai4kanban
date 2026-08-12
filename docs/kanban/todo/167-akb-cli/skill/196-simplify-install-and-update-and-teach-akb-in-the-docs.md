---
title: Simplify install and update, and teach akb in the docs
track: skill
priority: med
roi: med
status: todo
release: 0.6.0
blocked_by: [195]
related: [167]
modules: [skill, docs]
questions: []
---

Once the flows ship with the command, most of what install and update do is copying files
that no longer need copying. Cut both down to what is left, and rewrite the docs around the
one command people now type.

## Scope
- Installing writes the short note for each agent and scaffolds the board. Nothing else is
  copied into the project.
- Updating becomes getting a newer version of the command, plus repairing an older board.
  The step where a user re-installs the skill to get a fixed flow is gone.
- A project installed by an older version is upgraded in place, without the user having to
  work out what changed.
- The docs teach the commands a person types — implement, refine, propose, and the rest —
  not the board's bookkeeping.
- Both READMEs and the command's own page say the same thing, in English and Chinese, and
  say that the one-off way to run it still works.
- The guides that show the old script commands are updated, so nothing on the site teaches a
  command we no longer want typed.

## Todo
- [ ] Cut installing down to the short note plus the board, and say so in its output.
- [ ] Make updating mean a newer command and a repaired board, nothing else.
- [ ] Upgrade a project installed by an older version in place, without the user working
      anything out.
- [ ] Rewrite the README, the Chinese README and the command's own page around the commands
      a person types.
- [ ] Update the guides and any page on the site that still teaches the old commands.
- [ ] Install into a fresh repo from scratch, and upgrade an older project, and check both
      end up on the same footing.
