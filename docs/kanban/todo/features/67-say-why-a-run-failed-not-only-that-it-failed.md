---
title: Say why a run failed, not only that it failed
track: features
priority: med
roi: high
status: ready
release: 0.6.1
blocked_by: []
related: [16, 51, 179]
modules: [local-ui]
questions: []
---

Say why a run failed, so the user knows whether to press Resume or go and fix something
first.

Today every failure reads the same. The run shows `✕ exited 1`, and the reason sits in the
log, where the user has to go and find it. A run stopped by the plan's usage limit, a run
that crashed, and a run where the agent command was never installed all look alike — and
only the last one is worth leaving the screen for.

## Scope

**Say why on the run**
- A failed run carries a short reason, in plain words, beside its result.
- The reason is the agent's own last words: the end of what it printed before it stopped.
- A run whose command never started says so, and names the command that was missing.
- The reason reads without opening the log. The log still holds the whole story.
- Every agent is read the same way. Nothing here knows one agent's error wording from
  another's.

**Recovery stays the user's**
- Resume is still the only way a failed run carries on. #179 is what puts that button on
  the card.
- The board starts nothing again by itself after a failure.

## Scope out
- No sorting failures into kinds — no rate limit / can't start / everything else.
- No reading an agent's own signals: no HTTP 429, no reset time, no which-limit-was-hit.
- No waiting, backoff, or pause after a failure.
- No restarting a scheduled or recurring pass that a failure killed.
- No give-up count per card, no notice bar, no board chip.
- No line about a stopped-short run on the card's own page — that is #179's.

## Already true
- A failed run is recorded with its log, and offers Resume wherever the run can be picked
  up again.
- A scheduled card loses its mark as its run starts, and a recurring card is passed over
  once a run exists for its window. Both fire once on purpose: restarting a failure is the
  user's call.
- `CLAUDE_CODE_MAX_RETRIES=0` makes a rate-limited Claude Code run fail at once instead of
  holding its card for the best part of an hour.

## Decided by the agent
- Should the board wait and try again after a usage limit? No. A limit the user has to buy
  their way out of is not one the board can wait out, and a limit that lifts by itself is
  already covered by pressing Resume.
- Should the board pick a rate limit out of the agent's output? No. That is one reader per
  agent, kept in step with each agent's wording, to earn a label the agent's own last line
  already gives.
- Should a scheduled or recurring pass be started again after a failure? No. Both were
  built to fire once on purpose, and firing again is how a broken setup spawns a run a
  minute.
- Does this overlap #179? No. This card decides what a failed run says; #179 decides where
  the user reads it.

## Todo
- [ ] Show a short reason on a failed run, taken from the end of the agent's own output.
- [ ] Say when the agent's command never started, and name the command that was missing.
- [ ] Update "When a run fails or is interrupted" in `kanban-ui/README.md`: a failed run now
      says why, and the log is the whole story rather than the only place to read it.
