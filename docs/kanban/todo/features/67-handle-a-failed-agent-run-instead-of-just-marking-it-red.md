---
title: Handle a failed agent run instead of just marking it red
track: features
priority: high
roi: high
status: ready
blocked_by: []
related: [16, 51, 69]
modules: [local-ui]
questions: []
---

Say why an agent run failed, and stop the dispatcher from retrying a failure it can't fix.

Right now every failure looks the same. The board marks a run failed when the exit code
isn't 0, and that is all anyone learns. A run that hit the plan's usage limit, a run that
crashed, and a run where `claude` isn't installed all look the same. Worse, auto-refine
wakes a minute later and starts the same run again — so a usage limit turns into a run
that fails every minute for hours. It already happened on this board: 12 runs in a row on
one card, one a minute, every one of them the same limit.

## Scope

**Name the reason**
- Read the reason out of the run itself instead of guessing it from the exit code. The
  run's own output already says whether it failed and roughly why.
- Sort a failed run into one of three kinds:
  - **rate limit** — the plan's usage limit, or the service turning requests away.
  - **can't start** — the agent command isn't installed, or the user isn't logged in.
  - **everything else** — the fallback kind.
- The three kinds are the same for every harness, but each harness recognises its own.
  Claude Code and Codex report a usage limit differently, so the recognising sits with the
  harness, beside the rest of what it knows about its own CLI.
- For Claude Code the signal is structured, not words. A rate-limited run ends with an HTTP
  429 on its result, and separately reports the reset time as a number and which limit was
  hit — the 5-hour session limit or the weekly one. No word matching is needed at all.
- Two traps in that signal. The reset number arrives partway through the run, not at the
  end, so it has to be caught while the run goes. And a healthy run reports the same thing
  to say the limit is fine — only a run marked rejected is rate-limited. Miss that mark and
  every good run pauses the board.
- "Can't start" has no such signal. A logged-out run ends the same shape as a rate limit but
  with no 429 on it, and a missing command prints nothing at all — that one is still a
  "can't start" run, read off the fact that the command never launched.
- Show the kind on the failed run, in plain words, next to the log: which limit was hit,
  and when background refining starts again.

**Make the dispatcher wait**
- After a rate-limited run, no auto-refine until the reset time the run reported. Without
  one, wait 30 minutes. Cap the wait at 6 hours either way — a weekly limit would
  otherwise park the board for days.
- After a "can't start" run, no auto-refine for 5 minutes. Nothing about a missing command
  belongs to one card; the next card would fail the same way. Each new one re-arms the
  wait, and a run that starts normally clears it, so the board heals itself once the user
  installs the agent or logs back in.
- Any run arms the wait — the dispatcher's, a button the user pressed, or a create or
  propose that belongs to no card. A usage limit belongs to the account, not to the card
  or the button. A run that succeeds clears the wait.
- The wait is per harness. A Claude limit must not keep the board paused after the user
  switches to Codex.
- The wait never blocks the user. Card buttons stay live and are the way to re-test
  whether the limit lifted. A rate limit pauses the whole board, so it counts against no
  card.

**Stop re-picking a card that keeps failing**
- After 3 runs the dispatcher started on one card fail in a row, stop picking that card.
- Only a run that really failed on the card counts. A rate limit, a run that couldn't start,
  a stopped run, and a run cut short when the UI died all leave the count where it was —
  none of them told us anything about the card, so none is a strike or a clear.
- A failure nobody can place counts. A card that keeps failing for a reason we can't read is
  exactly the loop the count is there to break.
- A run the dispatcher did not start clears the count the moment it begins — Implement,
  Edit, Resolve, or Resume. A run the dispatcher started that passes resets it too.
- That means the board has to record who started each run. Today it can only guess from
  the run's name, and Resume already breaks the guess: resuming a failed background refine
  keeps that run's name while being the user's own run.
- Say it on the card. A card the dispatcher gave up on shows a notice bar at the top of its
  page: the dispatcher stopped picking it after 3 failed runs in a row, and starting a run
  yourself puts it back in the rotation. It reads as a warning, not a nudge.
- The bar shows by default and stays for as long as the card is skipped. A ✕ closes it for
  the rest of the browser session — nothing is written to the board files.
- It is the same strip the goal bar already uses. Pull that strip out into one shared bar
  and put both notices on it, so every notice in the UI looks and closes the same way.
- The board marks a skipped card with a small icon chip, in the row that already carries the
  blocked lock. Without it a skipped card looks like any other on the board, and its failed
  runs age out of the 30-run history.

**Remember it across a restart**
- Keep the wait and the per-card failure counts in `docs/kanban/.dispatcher.json`, next to
  the session registry and out of git, so a UI restart doesn't forget a wait and resume
  hammering. The session history can't hold this — it keeps only the last 30 runs and
  drops them with their logs.

## Scope out
- No paused state beside the auto-refine switch. The switch keeps showing "Refining #<id>"
  while a run is going and nothing otherwise. The failed run in the runs panel is where the
  reason is named, and that is enough.
- No manual Refine button and no control to end a wait early. Resolve and Resume already
  move a card forward while the dispatcher is waiting.

## Already true
- The server runs `claude` with `CLAUDE_CODE_MAX_RETRIES=0`, so a failure ends the run at
  once rather than backing off inside the CLI for an hour. A plan limit already ends a run
  straight away on its own; the setting is what keeps the other failures fast too.

## Decided by the agent
- Where does the reason live? On the run's record, beside its pass/fail result, and kept
  with it — the same record the board already polls.
- How do we spot a rate limit? From the reported HTTP 429 and the reset number the run
  emits, not from the words in the message. The wording changes between versions and
  differs per harness; the number does not. Checked against the real CLI: the structured
  signal is there and complete, so no word matching is kept as a fallback.
- What if the reported reset time is missing, in the past, or absurd? Fall back to 30
  minutes, and never wait longer than 6 hours.
- Does the wait block the user too? No. It only gates what the dispatcher picks on its own.
  The card's buttons always work, and a run the user starts counts as a fresh result.
- Which runs arm the wait? Any run that ends rate-limited, whoever started it, card or no
  card. A limited create at 10:00 means the 10:01 refine would fail too.
- Does a "can't start" failure pause the board? Yes, for 5 minutes. Left per-card it would
  burn 3 runs on every card in turn, park the whole board for good, and push every real run
  out of the 30-run history.
- Does a "can't start" run count toward the 3? No. A missing command is not the card's
  fault, and 3 in a row would retire the best card for good. It doesn't clear the count
  either — it leaves it where it was, like a stopped run.
- Who owns the "don't re-pick a failing card" rule? This card. #16 (auto-implement) needs
  the same rule and points here instead of writing its own, so one number covers both.
- How many failures stop the dispatcher picking a card, and what clears it? 3 in a row,
  dispatcher-started and not rate-limited. A run the dispatcher didn't start clears it —
  the UI's Edit is itself a run, so editing from the UI clears it; a hand edit to the file
  does not.
- Does the skipped card's bar carry its own button? No. Implement, Refine, Resolve and Edit
  already sit on the toolbar above it, and any of them clears the skip.
- Does the board show the skip too? Yes, as a small icon chip beside the blocked lock. The
  bar alone would only be found by opening the card.
- When does a card's failure count go away? The file only holds the cards the dispatcher is
  counting against right now, not every card. A run that clears the count drops the entry,
  and a card that leaves the board takes its entry with it.
- The wait needs no cleaning up. It says "not before this time", and that time is never more
  than 6 hours out, so it goes stale on its own.
- A missing or unreadable file is not an error. The board reads it as no waits and no
  failures and carries on. Deleting it by hand is a fine way to start over.
- Where does the wait state live? `docs/kanban/.dispatcher.json`, out of git, next to
  `.sessions.json`. Not `ui.config.json` (the user's settings, checked in) and not the
  session history (pruned to 30 and dropped with its log — lossy).

## Todo
- [ ] Read the failure reason out of the finished run instead of guessing it from the exit
      code.
- [ ] Sort a failed run into rate limit / can't start / everything else, and keep the kind
      on the run. Each harness recognises its own signal.
- [ ] Keep the reset time and which limit was hit — caught while the run goes, not at the
      end, and only from a run the limit actually turned away.
- [ ] Show the kind on the failed run in the UI, in plain words, and say when background
      refining starts again.
- [ ] Record who started each run, so the user's runs can be told from the dispatcher's.
- [ ] Make the dispatcher wait after a rate limit — until the reported reset time, capped
      at 6 hours, or 30 minutes when the run reports none.
- [ ] Make the dispatcher wait 5 minutes after a "can't start" run, re-armed by each new
      one and cleared by a run that starts normally.
- [ ] Keep the wait per harness, so a Claude limit doesn't pause a board switched to Codex.
- [ ] Make the dispatcher stop picking a card after 3 straight failed runs it started, and
      clear the count when a run it didn't start begins.
- [ ] Remember the wait and the per-card failure counts across a UI restart, in
      `docs/kanban/.dispatcher.json` and out of git.
- [ ] Pull the goal bar's strip out into one shared notice bar, and keep the goal bar on it.
- [ ] Show that bar on the page of a card the dispatcher gave up on: why it was skipped, and
      that starting a run yourself puts it back. It stays while the card is skipped, and its
      ✕ hides it for the browser session only.
- [ ] Mark a skipped card on the board with a small icon chip, beside the blocked lock.
- [ ] Add a "when a run fails" section to `kanban-ui/README.md`: the three kinds, what the
      dispatcher does about each, and what a card it gave up on looks like.
- [ ] Fix the three passages in `kanban-ui/README.md` this card makes wrong — the
      auto-refine section, the `CLAUDE_CODE_MAX_RETRIES` paragraph, and "the reason is in
      its output".

