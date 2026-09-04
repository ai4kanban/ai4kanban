---
title: Report the board's own numbers from metrics.csv and record.csv
track: skill
priority: med
roi: med
status: todo
release: 0.9.0
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

## Worth noting
- Counts only, so a bad number can never be looked into. We would see that questions went
  to the user often across all boards, not what kind of card kept causing it.
- These are the only numbers in the group that say whether the product works rather than
  whether it was opened. Reporting is on by default; a terminal-only user may disable it
  with `akb telemetry off`, and the command never asks.

<!-- agent -->

## Today
- Both files exist and are written by board commands (#223). They never leave the repo.
- `record.csv` is append-only, one line per board move: `date,event,card,detail`. Its
  events are card-created, card-archived, card-rejected, question-closed, decisions-stood,
  decisions-overruled and release-closed, and the `detail` column carries the one value
  each one means — asked or proposed for a card, board, user or verify for a closed
  question, a whole number for the decision lines, the release id for a closed release.
- `metrics.csv` is one row a day: `date,completed,created,rejected`.
- The board's own Insights dialog already shows those numbers to the user who owns the
  board. Either way nobody sees them across installs.

## Scope
- Send counts only: how many cards were created, completed and rejected, and how many of
  each event in `record.csv`.
- Break each count down by the value its record line carries — asked against proposed for a
  created card, and board against user against verify for a closed question. Those splits
  are what say how much the board settles by itself.
- Send the decision lines as their totals: how many of the board's own decisions stood and
  how many the user overruled.
- Send no card id and no card title. Whether a release id may be sent is the open question
  above; until it is answered, send none.
- Report the totals since the last report, not the whole file, so a number is never
  counted twice.
- A report is sent at most once a day, and only when something changed.
- A board that was edited by hand, or rolled back in git, must not produce negative or
  double counts.
- One machine with several boards reports each board under a random per-board id, so two
  projects are not merged and neither is named. The ids are kept in the file #293 puts
  outside every repository, not in a second place of their own.
- Send through the queue and batched sender #295 builds, not a second one.
- Send nothing at all unless #293's setting says yes.
- Reading these files never blocks a board command, and a missing or unreadable file is
  not an error.
- Out of scope: sending the card files, the memory files, or anything from `goal.md`.

## Todo
- [ ] read the two files and work out what is new since the last report
- [ ] break each count down by the value its record line carries
- [ ] give each board a random id, kept in the file #293 puts outside every repository
- [ ] send the counts at most once a day, and only on a change, through #295's sender
- [ ] handle a hand-edited or rolled-back file without producing bad counts
- [ ] check nothing is sent when the setting is off
- [ ] add the new fields to the privacy page from #293

## Decided by the agent
- **Why the detail column matters more than the totals** — "a question was closed" only
  says the board moved. "Closed by the board rather than by the user" says the board
  decided by itself, which is the product's actual claim and the one thing these numbers
  can test.
- **Why a per-board id and not the install id alone** — one person often runs several
  boards, and merging them would make one heavy user look like a busy product.
- **Why the board id is kept outside the repository** — anything inside `docs/kanban/` is
  committed, so a shared repo would report every clone under one id. #293 already has to
  put the setting and the install id somewhere outside every repo; the board ids go in the
  same file rather than a second one.
- **Why counts and not the files** — the files hold card ids and release names, which are
  the user's own product plan.
- **Why this card and not #295 sends the board's moves** — the moves are already written
  to `record.csv` by the commands that made them. Reading that file is one count that
  survives a dropped send; a live event per move is a second count that does not.
