---
title: Handle a failed agent run instead of just marking it red
track: features
priority: high
roi: high
status: todo
blocked_by: []
related: [16, 49, 51]
modules: [local-ui]
questions:
  - "[user] redesign.md says the auto-refine switch shows one 'Refining #<id>' label and nothing otherwise — but a rate-limit pause can last hours and a silent board looks broken. (a) stay silent; (b) one small 'Paused: rate limited until <time>' line in the same slot, only while paused. Recommend (b)."
---

Say why an agent run failed, and stop the dispatcher from retrying a failure it can't fix.

Right now every failure looks the same. The registry marks the session red when the exit
code isn't 0, and that's all anyone learns. A run that hit the plan's rate limit, a run
that crashed, and a run where `claude` isn't installed all read alike. Worse, auto-refine
wakes a minute later and starts the same run again — so a rate limit turns into a run that
fails every minute for hours.

## Scope
- Read the reason out of the run instead of guessing it from the exit code. `claude -p
  --output-format stream-json` ends with a `result` event carrying `is_error` and a
  `subtype` (`success`, `error_during_execution`, `error_max_turns`, `error_max_budget_usd`).
  A session that fails before any of that — a missing binary, a bad login — leaves only
  stderr and the spawn error.
- Sort a failed run into one of three kinds, by text — no subtype names a rate limit, so
  the match is on the words, checked against the `result` text, the stderr in the tail,
  and the spawn error:
  - **rate limit** — matches `usage limit reached`, `rate limit`, or `API Error: 429`
    (case-insensitive). The classic result reads `Claude AI usage limit reached|<unix-ts>`;
    an API 429 reads `API Error: 429 …"rate_limit_error"…`.
  - **can't start** — the spawn failed (`claude` not installed), or the text matches
    `not logged in`, `please run /login`, or `invalid API key`.
  - **everything else** — the fallback kind.
- When the rate-limit text carries a reset time — the `|<unix-timestamp>` tail — keep it:
  that is how long to wait.
- Show the kind on the failed session, in plain words, next to the log.
- Back the dispatcher off. After a rate-limited run, no auto-refine until the reset time
  from the message, or for 30 minutes when it has none; another limited run re-arms the
  wait. A rate limit pauses the whole board, so it does not count against any one card.
- After 3 dispatcher-started runs on one card fail in a row (non-rate-limit failures), stop
  picking that card. Any later run on the card clears the shelf and the count — same rule
  as #49's stopped-run skip.
- Keep the wait-until time and the per-card failure counts in a small gitignored file next
  to the session registry, `docs/kanban/.dispatcher.json`, so a UI restart doesn't forget
  a wait and resume hammering.
- Say when auto-refine is paused and why, so a quiet board doesn't look broken.

## Already true
- The server runs `claude` with `CLAUDE_CODE_MAX_RETRIES=0`, so a rate limit ends the run
  at once rather than backing off inside the CLI for an hour. That is what makes a failure
  fast enough to handle here.

## Decided by the agent
- Where does the reason live? On the session in the registry, alongside `ok`/`code`, and
  persisted with it — the same record the board already polls.
- Does the back-off block the user too? No. It only gates what the dispatcher picks on
  its own. The card's buttons always work, and a run the user starts counts as a fresh
  result for that card.
- Who owns the "don't re-pick a failing card" rule? This card. #16 (auto-implement) needs
  the same rule and points here instead of writing its own.
- How do we spot a rate limit? By text — the CLI names no rate-limit subtype. Match
  `usage limit reached`, `rate limit`, or `API Error: 429` in the result text or stderr;
  the CLI itself string-matches these same phrases internally, so the rule is as honest as
  it gets without a structured signal.
- Where does the back-off state live? `docs/kanban/.dispatcher.json`, gitignored, next to
  `.sessions.json`. Not `ui.config.json` (the user's settings, checked in) and not the
  session history (pruned to 30 and dropped with its log — lossy).
- How long is the wait? Until the reset time when the message carries one; otherwise 30
  minutes, re-armed if the next try is limited again.
- How many failures shelve a card, and what clears it? 3 in a row, dispatcher-started and
  not rate-limited. Any later run on the card clears it — the UI's Edit is itself a run,
  so editing from the UI clears it too; a hand edit to the file does not, one rule only.

## Todo
- [ ] Capture the `result` event's `is_error` and `subtype` in the stream renderer.
- [ ] Classify a finished session into a failure kind, and store it on the session.
- [ ] Show the kind on the failed run in the UI, in plain words.
- [ ] Make the dispatcher wait after a rate limit instead of retrying next minute — until
      the reset time parsed from the message, or 30 minutes without one.
- [ ] Make the dispatcher stop picking a card after 3 straight failed runs; clear the shelf
      on any later run on that card.
- [ ] Keep the wait-until time and per-card failure counts in
      `docs/kanban/.dispatcher.json`; add it to `.gitignore` next to the
      `.sessions.json` entry.
- [ ] Say in the UI when auto-refine is paused and why.
- [ ] Update `kanban-ui/README.md`: describe what happens when a run fails, and fix the
      two passages this card makes wrong — the auto-refine section (the switch now has an
      on-but-waiting state) and the `CLAUDE_CODE_MAX_RETRIES` paragraph ("the board shows
      it failed" is no longer the whole story).

