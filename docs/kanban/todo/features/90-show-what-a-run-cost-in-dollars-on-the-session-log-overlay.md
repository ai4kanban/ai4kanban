---
title: Show what a run cost in dollars on the session log overlay
track: features
priority: med
roi: med
status: todo
blocked_by: []
related: []
modules: [local-ui]
questions:
  - Does 'total cost' mean just that one session's cost, or also a running total across sessions (per card / per day)? Card assumes per-session only until answered.
---

Each agent run costs real money, but the user never sees how much. Show the run's
cost in US dollars on the session log overlay, so the user knows what a button press
cost them.

## Scope
- When a `claude -p` run ends, its output stream reports the total cost in USD.
  Keep that number with the session.
- Show the cost on the session log overlay, next to the run's duration.
- A session with no cost (still running, crashed, or an old log from before this
  feature) shows nothing — no zero, no placeholder.

## Todo
- [ ] Capture the run's cost when a session ends and keep it with the session.
- [ ] Show the cost on the session log overlay, next to the duration.
- [ ] Run one agent session, open its log overlay, and check the cost shows.
