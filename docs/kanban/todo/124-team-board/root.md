---
title: Let a small team share one board
track: features
priority: low
roi: med
status: todo
release: next
blocked_by: []
related: [125, 126, 127]
modules: [skill, local-ui]
questions:
  - question: "[user] How does a team share the board day to day?"
    mode: single
    options:
      - plain git — everyone pushes to main and the board files merge cleanly; this group makes that safe
      - through pull requests — board changes get reviewed like code
      - a shared backend — lean on the GitHub Projects backend (#57) instead of git files
    recommend: [1]
---

The board assumes one human. A small team cannot share it: two people writing at once
collide on ids and the index, a question does not say whose call it is, and nothing
helps you catch up on what a teammate changed. Make one board work for a few people.
This is a group task; each piece is its own subtask in this folder.

## Today
- `next-id` is one counter in one file. Two people creating cards on two clones get
  the same id.
- The README index and `metrics.csv` are single files every write touches — merge
  conflicts waiting to happen.
- A question on a card is addressed to "the user". With two users, nobody knows whose
  call it is.

## Scope
- Sharing is plain git: everyone pulls, writes, pushes. This group's job is making
  that not hurt. The open question on this card confirms the model.
- The board's shared files survive two writers: ids do not collide, and the index and
  metrics merge cleanly or rebuild themselves (#125).
- Cards and questions carry names — who wants the card, who answers the question — and
  a person can see just what waits on them (#126).
- After a pull, one view says what changed on the board since you last looked (#127).
- A solo board changes nothing: same files, same commands, same output.
- Out of this group: accounts, sign-in, permissions — a name is a git author, not a
  login. Also out: anything real-time; git's pace is the board's pace.

## Todo
- [ ] Make the board merge cleanly when two people write it #125
- [ ] Put names on cards and questions #126
- [ ] Show what changed on the board since you last looked #127

## Decided by the agent
- **Names come from git.** Everyone touching the board already has a git author name.
  The board reuses it instead of inventing accounts.
- **Merge-clean beats locked.** No lock files, no server in the middle. The fix is
  making the shared files conflict-free or trivially rebuildable — which also leaves a
  solo board exactly as it is.
