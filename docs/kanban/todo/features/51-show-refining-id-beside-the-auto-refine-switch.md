---
title: "Show \"Refining #<id>\" beside the auto-refine switch"
track: features
priority: med
roi: med
status: todo
blocked_by: []
related: [16]
modules: [local-ui]
questions:
  - "[user] The old card also started the refine timer at server boot (instrumentation.ts), so refining would run with no tab open. That fix is out of this card now. Make it its own card, or drop it?"
---

Show which card auto-refine is working on. While an auto-refine run is going, a small
"Refining #<id>" label sits beside the switch. When nothing is running, the label is gone.
That is all it shows.

## Scope
- One read-only "Refining #<id>" label beside the auto-refine switch, inside the
  Configuration dialog.
- Visible only while an auto-refine run is running. No idle text, no off text.
- Driven by the run list the UI already polls. No new poll loop.

## Scope out
- No idle reasons, no "last refined" line, no "next up" line.
- No queue editor and no run history — the global runs panel already keeps runs.
- No new header control — global settings live in the Configuration dialog, per `redesign.md`.

## Todo
- [ ] Find the current auto-refine run in the polled run list and render "Refining #<id>"
      beside the switch while it is live.

## Decided by the agent

- **Where it lives** — inside the Configuration dialog, beside the auto-refine switch.
  Not the header: `redesign.md` says a global setting never gets its own header control.
