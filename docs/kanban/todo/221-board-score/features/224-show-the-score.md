---
title: Show the board's score, and write it into every release
track: features
priority: med
roi: high
status: todo
release: 0.7.1
blocked_by: [223]
related: [221]
modules: [skill]
questions: []
---

A number collected and never read changes nothing. Show the board's score in one place, and
leave a copy in the repo each time a release closes, so we can see whether the board is
getting better.

## Scope
- One command shows the score today: every number kept by #222, and the counts each one was
  worked out from.
- Each number can be traced back to the cards it was counted from, so a reader can check it
  by hand.
- A number with less behind it than #222's definition asks for says "not enough yet"
  instead of a figure.
- Closing a release writes the score into that release's summary, so the versions can be
  read side by side.
- Write the first score for this board: the numbers #222 says can be read back from the
  cards already here, and "not enough yet" for the ones that only start counting now.
- The guides say the score is there and how to read it.
- Out of scope: a screen for the score in the board UI, and showing our own score in
  public.

## Todo
- [ ] show the score, with the counts behind each number
- [ ] say which cards each number was counted from
- [ ] say "not enough yet" instead of a number when there is too little behind it
- [ ] write the score into a release's summary when the release closes
- [ ] write the first score for this board, and mark the numbers that start empty
- [ ] teach the score in the guides — what it says, and how to read it

## Decided by the agent
- **Repo first, site later** — the first numbers will be rough, and a number on the site is
  a promise. #206 is already the measured claim we put in front of readers; this one has to
  earn that.
- **Not in the UI yet** — the score is read once a release. A screen for it costs more than
  it is worth until we trust the numbers.
- **Per release, not per day** — the daily counts already exist and say little on their own.
  A release is the unit we plan in, so it is the unit worth comparing.
