---
title: Report the board's own numbers from metrics.csv and record.csv
track: 292-app-telemetry/skill
priority: med
roi: med
status: todo
release: 0.7.2
blocked_by: [295]
related: [292]
modules: [skill, telemetry]
questions:
  - question: "[user] How much of the board's own record may be sent?"
    mode: single
    options:
      - counts only — the daily tallies and the event counts, never a card id, title or release name
      - counts plus release ids — lets a score be read release by release, but a release id is often a product detail
    recommend: [1]
---

`docs/kanban/metrics.csv` and `docs/kanban/record.csv` already count real planning work on
every board. Send the counts, so the question "does the board actually plan anything for
people" has an answer beyond our own repo.

## Today
- Both files exist and are written by board commands (#223). They never leave the repo.
- The board's own Insights dialog already shows those numbers to the user who owns the
  board. Either way nobody sees them across installs.

## Scope
- Send counts only: how many cards were created, completed and rejected, and how many of
  each event in `record.csv`.
- Send no card id, no card title, and no release name.
- Report the totals since the last report, not the whole file, so a number is never
  counted twice.
- A report is sent at most once a day, and only when something changed.
- A board that was edited by hand, or rolled back in git, must not produce negative or
  double counts.
- One machine with several boards reports each board under a random per-board id, so two
  projects are not merged and neither is named. The ids are kept in the file #293 puts
  outside every repository, not in a second place of their own.
- Send nothing at all unless #293's setting says yes.
- Reading these files never blocks a board command, and a missing or unreadable file is
  not an error.
- Out of scope: sending the card files, the memory files, or anything from `goal.md`.

## Todo
- [ ] read the two files and work out what is new since the last report
- [ ] give each board a random id, kept in the file #293 puts outside every repository
- [ ] send the counts at most once a day, and only on a change
- [ ] handle a hand-edited or rolled-back file without producing bad counts
- [ ] check nothing is sent when the setting is off
- [ ] add the new fields to the privacy page from #293

## Decided by the agent
- **Why a per-board id and not the install id alone** — one person often runs several
  boards, and merging them would make one heavy user look like a busy product.
- **Why the board id is kept outside the repository** — anything inside `docs/kanban/` is
  committed, so a shared repo would report every clone under one id. #293 already has to
  put the setting and the install id somewhere outside every repo; the board ids go in the
  same file rather than a second one.
- **Why counts and not the files** — the files hold card ids and release names, which are
  the user's own product plan.
