---
title: Handle a failed agent run instead of just marking it red
track: features
priority: high
roi: high
status: ready
blocked_by: []
related: [16, 51]
modules: [local-ui]
questions: []
---

Say why an agent run failed, and stop the dispatcher from retrying a failure it can't fix.

Right now every failure looks the same: the board marks a run failed when the exit code
isn't 0, and that is all anyone learns. A run that hit the plan's usage limit, a run that
crashed, and a run where `claude` isn't installed can't be told apart. Worse, auto-refine
wakes a minute later and starts the same run again — this board once logged 12 runs in a
row on one card, one a minute, every one of them the same limit.

## Scope

**Name the reason**
- Read the reason out of the run's own output instead of guessing it from the exit code.
- Sort a failed run into one of three kinds:
  - **rate limit** — the plan's usage limit, or the service turning requests away.
  - **can't start** — the agent command isn't installed, or the user isn't logged in.
  - **everything else** — the fallback kind.
- The three kinds are the same for every harness, but each harness recognises its own —
  Claude Code and Codex report a usage limit differently.
- For Claude Code the signal is structured, not words: a rate-limited run ends with an HTTP
  429 and reports the reset time and which limit was hit — the 5-hour session limit or the
  weekly one. Two traps: the reset time arrives partway through the run, not at the end;
  and a healthy run reports the same thing to say the limit is fine, so only a run the
  limit turned away counts. Miss that and every good run pauses the board.
- "Can't start" has no such signal. A logged-out run looks like a rate limit without the
  429, and a missing command prints nothing at all — read that one off the fact that the
  command never launched.
- Show the kind on the failed run, in plain words next to the log: which limit was hit, and
  when background refining starts again.

**Make the dispatcher wait**
- After a rate-limited run, no auto-refine until the reset time the run reported. Without
  one, wait 30 minutes. Cap the wait at 6 hours either way — a weekly limit would otherwise
  park the board for days.
- After a "can't start" run, no auto-refine for 5 minutes. Nothing about a missing command
  belongs to one card; the next card would fail the same way. Each new one re-arms the
  wait, and a run that starts normally clears it.
- Any run arms the wait — the dispatcher's, a button the user pressed, or a create or
  propose that belongs to no card. A usage limit belongs to the account, not to one card.
  A run that succeeds clears the wait.
- The wait is per harness. A Claude limit must not keep the board paused after the user
  switches to Codex.
- The wait never blocks the user. Card buttons stay live and are the way to re-test whether
  the limit lifted.

**Stop re-picking a card that keeps failing**
- After 3 runs the dispatcher started on one card fail in a row, stop picking that card.
- Only a run that really failed on the card counts. A rate limit, a run that couldn't
  start, a stopped run, and a run cut short when the UI died all leave the count where it
  was. A failure nobody can place does count — that loop is what the count is there to
  break.
- A run the dispatcher did not start clears the count the moment it begins — Implement,
  Edit, Resolve, or Resume. A dispatcher run that passes resets it too.
- So the board has to record who started each run. Today it can only guess from the run's
  name, and Resume already breaks the guess.
- Say it on the card. A skipped card shows a notice bar at the top of its page: the
  dispatcher stopped picking it after 3 failed runs in a row, and starting a run yourself
  puts it back in the rotation. It reads as a warning, not a nudge. It is the shared notice
  bar the goal bar already uses, so pull that strip out into one bar carrying both.
- Mark a skipped card on the board with a small icon chip, in the row that already carries
  the blocked lock. Without it a skipped card looks like any other once its failed runs age
  out of the 30-run history.

**Remember it across a restart**
- Keep the wait and the per-card failure counts in `docs/kanban/.dispatcher.json`, next to
  the session registry and out of git, so a UI restart doesn't forget a wait and resume
  hammering. The session history can't hold this — it keeps only the last 30 runs and drops
  them with their logs.

## Scope out
- No paused state beside the auto-refine switch. The failed run in the runs panel is where
  the reason is named.
- No manual Refine button and no control to end a wait early. Resolve and Resume already
  move a card forward while the dispatcher is waiting.

## Already true
- The server runs `claude` with `CLAUDE_CODE_MAX_RETRIES=0`, so a failure ends the run at
  once rather than backing off inside the CLI for an hour.

## Decided by the agent
- Where does the reason live? On the run's record, beside its pass/fail result — the same
  record the board already polls.
- How do we spot a rate limit? From the 429 and the reset number the run emits, not the
  words in the message. The wording changes between versions and differs per harness; the
  number does not. Checked against the real CLI, so no word matching is kept as a fallback.
- Who owns the "don't re-pick a failing card" rule? This card. #16 (auto-implement) needs
  the same rule and points here instead of writing its own.
- Does the skipped card's bar carry its own button? No. Implement, Refine, Resolve and Edit
  already sit on the toolbar above it, and any of them clears the skip.
- Does the state file need cleaning up? No. It holds only the cards being counted right
  now, a cleared count drops its entry, and a wait is never more than 6 hours out. A
  missing or unreadable file reads as no waits and no failures, so deleting it by hand is a
  fine way to start over.

## Todo
- [ ] Read the failure reason out of the finished run instead of guessing it from the exit
      code, and sort it into rate limit / can't start / everything else. Each harness
      recognises its own signal.
- [ ] Keep the reset time and which limit was hit — caught while the run goes, and only
      from a run the limit actually turned away.
- [ ] Show the kind on the failed run in the UI, in plain words, and say when background
      refining starts again.
- [ ] Record who started each run, so the user's runs can be told from the dispatcher's.
- [ ] Make the dispatcher wait after a rate limit — until the reported reset time, capped
      at 6 hours, or 30 minutes when the run reports none. Keep the wait per harness.
- [ ] Make the dispatcher wait 5 minutes after a "can't start" run, re-armed by each new one
      and cleared by a run that starts normally.
- [ ] Make the dispatcher stop picking a card after 3 straight failed runs it started, and
      clear the count when a run it didn't start begins.
- [ ] Remember the wait and the per-card failure counts across a UI restart, in
      `docs/kanban/.dispatcher.json` and out of git.
- [ ] Pull the goal bar's strip out into one shared notice bar, and keep the goal bar on it.
- [ ] Show that bar on a skipped card's page: why it was skipped, and that starting a run
      yourself puts it back.
- [ ] Mark a skipped card on the board with a small icon chip, beside the blocked lock.
- [ ] Add a "when a run fails" section to `kanban-ui/README.md`: the three kinds, what the
      dispatcher does about each, and what a card it gave up on looks like.
- [ ] Fix the three passages in `kanban-ui/README.md` this card makes wrong — the
      auto-refine section, the `CLAUDE_CODE_MAX_RETRIES` paragraph, and "the reason is in
      its output".
