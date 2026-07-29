---
title: Handle a failed agent run instead of just marking it red
track: features
priority: high
roi: high
status: todo
blocked_by: []
related: [16, 49, 51, 69]
modules: [local-ui]
questions:
  - "[user] A card the dispatcher gave up on after 3 failed runs — (a) show nothing; (b) one line on the card page beside Implement; (c) that line plus a small icon chip on the board, like the blocked lock. Recommend (c): the skip is permanent and its failed runs age out of the runs panel, so nothing else would ever show it."
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
  Claude Code and Codex word a usage limit differently, so the matching sits with the
  harness, beside the rest of what it knows about its own CLI.
- For Claude Code the signal is structured, not words: a rate-limited run reports HTTP 429
  on its final result, and the run separately reports the reset time as a number and which
  limit was hit — the 5-hour session limit or the weekly one. Match on words only as a
  fallback. A run's message reads `You've hit your session limit · resets 4:50am
  (Asia/Shanghai)` — a local clock time, not worth parsing when the number is there.
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
  Rate-limited runs don't count — the board is waiting, not the card.
- A stopped run, and a run cut short when the UI died, are neither a strike nor a clear:
  neither one gave us a pass or a failure.
- A run the dispatcher did not start clears the count the moment it begins — Implement,
  Edit, Resolve, or Resume. A run the dispatcher started that passes resets it too.
- That means the board has to record who started each run. Today it can only guess from
  the run's name, and Resume already breaks the guess: resuming a failed background refine
  keeps that run's name while being the user's own run.

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
- The server runs `claude` with `CLAUDE_CODE_MAX_RETRIES=0`, so a rate limit ends the run
  at once rather than backing off inside the CLI for an hour. That is what makes a failure
  fast enough to handle here.

## Decided by the agent
- Where does the reason live? On the run's record, beside its pass/fail result, and kept
  with it — the same record the board already polls.
- How do we spot a rate limit? From the reported HTTP 429 and the reset number the run
  emits, not from the words in the message. The wording changes between versions and
  differs per harness; the number does not.
- What if the reported reset time is missing, in the past, or absurd? Fall back to 30
  minutes, and never wait longer than 6 hours.
- Does the wait block the user too? No. It only gates what the dispatcher picks on its own.
  The card's buttons always work, and a run the user starts counts as a fresh result.
- Which runs arm the wait? Any run that ends rate-limited, whoever started it, card or no
  card. A limited create at 10:00 means the 10:01 refine would fail too.
- Does a "can't start" failure pause the board? Yes, for 5 minutes. Left per-card it would
  burn 3 runs on every card in turn, park the whole board for good, and push every real run
  out of the 30-run history.
- Who owns the "don't re-pick a failing card" rule? This card. #16 (auto-implement) needs
  the same rule and points here instead of writing its own, so one number covers both.
- How many failures stop the dispatcher picking a card, and what clears it? 3 in a row,
  dispatcher-started and not rate-limited. A run the dispatcher didn't start clears it —
  the UI's Edit is itself a run, so editing from the UI clears it; a hand edit to the file
  does not.
- Where does the wait state live? `docs/kanban/.dispatcher.json`, out of git, next to
  `.sessions.json`. Not `ui.config.json` (the user's settings, checked in) and not the
  session history (pruned to 30 and dropped with its log — lossy).

## Todo
- [ ] Read the failure reason out of the finished run instead of guessing it from the exit
      code.
- [ ] Sort a failed run into rate limit / can't start / everything else, and keep the kind
      on the run. Each harness recognises its own wording.
- [ ] Keep the reset time and which limit was hit when the run reports them.
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
- [ ] Add a "when a run fails" section to `kanban-ui/README.md`: the three kinds, and what
      the dispatcher does about each.
- [ ] Fix the three passages in `kanban-ui/README.md` this card makes wrong — the
      auto-refine section, the `CLAUDE_CODE_MAX_RETRIES` paragraph, and "the reason is in
      its output".

