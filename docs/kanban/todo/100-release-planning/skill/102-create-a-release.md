---
title: Create a release and see what is in it
track: skill
priority: high
roi: high
status: todo
blocked_by: [101]
related: [100]
modules: [skill]
questions: []
---

A release has to exist before a card can join it. Make one with a version id, keep the
releases in order, and show what each one holds.

## Scope
- Releases live in one file on the board, `docs/kanban/releases.md`: one line per release,
  in the order they ship, each marked open or closed.
- `release new <id>` adds one to the end of the list. `release list` prints them in order
  with, for each, how many cards are in it and how many of those are ready to build.
- The list is written by the script only, like every other board file the script owns.
- `next` is always last and is never written down. It is where a card with no release sits,
  so it cannot be created, renamed or reordered.
- A `--release` that names no release on the list is an error with the known ids listed —
  the same way an unknown module is today. A typo must not quietly invent a version.
- A board that has no `releases.md` still works: every card is `next` and `release list`
  says there are no releases yet.

## Todo
- [ ] Add `docs/kanban/releases.md` — one line per release, in ship order, open or closed.
- [ ] Add `release new <id>` and `release list`, with the card counts on list.
- [ ] Reject a `--release` that names no known release, and name the ones that exist.
- [ ] Scaffold `releases.md` on `init`, and add it to an older board without touching
      anything else.
- [ ] Say in the skill docs what a release is, where the list lives, and how to add one.
- [ ] Write the release idea into `README.md` and `README-zh.md`, and into
      `docs/guides/daily-loop.md` where the loop decides what to work on next.
- [ ] Check it by hand: make two releases, put cards in both, and read `release list`.