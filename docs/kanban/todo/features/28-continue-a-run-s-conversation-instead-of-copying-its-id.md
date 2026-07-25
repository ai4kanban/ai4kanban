---
title: Continue a run's conversation instead of copying its id
track: features
priority: med
roi: med
status: ready
blocked_by: []
related: []
modules: [local-ui]
questions: []
---

Let the user continue a finished run's conversation from the UI, instead of copying an id into a terminal.

## Today
- A finished run shows a "Copy ID" button (`HandoffButton` in `kanban-ui/components/agent-shared.tsx`).
- It copies the run's Claude Code session id. The user is meant to open a terminal and type `claude --resume <id>`.
- The button doesn't say any of that. To most users the id is just noise.

## How continuing works underneath
- Every run already keeps its session id.
- Continuing means starting a **new run** with `claude -p --resume <session-id>` plus the user's follow-up prompt.
- The new run is a normal run: it gets a log file and shows up in the global runs panel like any other.

## The shape (MVP)
- In the global runs panel, a **finished** run swaps its "Copy ID" button for a small prompt box: a text field for the follow-up plus a "Continue" button.
- Submitting starts a new run with `claude -p --resume <session-id>` and the typed prompt. The prompt box then reads as pending like any starting run.
- The reply is a normal run: it gets its own log file and its own entry in the global runs panel. No transcript view, no streaming chat — the existing read-only log view shows the reply.
- The resumed run is itself a finished run when done, so it too shows a "Continue" box. That's how a conversation carries across turns — one run per turn, no special chat state.

## Rules to follow
- Only a **finished** run can be continued. No replying mid-run — that channel is rejected in `docs/kanban/memory/local-ui/rejected.md`.
- Run logs stay in files and survive restarts, same as today.
- There is one global runs panel. This adds no per-card run history.
- "Copy ID" is gone when this ships — both places `HandoffButton` renders today (see below). No leftover legacy button.
- If `--resume` fails (e.g. the session id is gone or expired), it surfaces as a failed run in the log like any other failure — no special-case handling.

## Scope
- A run-start path that takes a session id and a follow-up prompt and runs `claude -p --resume <id>`, recording it like any run.
- The Continue prompt box on finished runs in the global runs panel (`SessionsDialog`), replacing the Copy ID button.
- Remove the Copy ID handoff everywhere it renders (`SessionsDialog` and the live-tail `SessionLogOverlay`).

## Todo
- [x] Get the three frontmatter questions answered first.
- [ ] Add a run-start path that takes a session id and a prompt and starts `claude -p --resume <id>`.
- [ ] Record the resumed run like any other run — log file, entry in the global runs panel.
- [ ] Add the Continue prompt box to a finished run in the global runs panel (`SessionsDialog`), where Copy ID is now.
- [ ] Remove the Copy ID button (`HandoffButton` in `kanban-ui/components/agent-shared.tsx`) from both `SessionsDialog` and `SessionLogOverlay`.
- [ ] Docs: add a short "continue a run" note to `kanban-ui/README.md` — it's a new user action, and no doc describes the runs panel today.

## Decided by the agent

- **Does resume cross the "no mid-run reply channel" rejection?** No. That rejection bans a *live* reply into a running session; resume only acts on an already-finished run and starts a brand-new `claude -p --resume <id>` run whose live view stays a read-only log tail. Same class of thing as today's Copy-ID handoff, just done in the UI instead of a terminal. Boundary holds — safe to build.
- **MVP or full chat?** MVP. One prompt box on a finished run that starts a new `--resume` run; the reply lands in the existing read-only log view — no new views. A full turn-by-turn chat UI would rebuild machinery the board has deliberately rejected (per-card history, live reply) for value the existing log view already gives.
- **Where does resume live?** Only the global runs panel (`SessionsDialog`), where the Copy ID button is today. The card page's run view shows the log but never renders Copy ID, so no resume box goes there — this keeps the "one global runs panel, no per-card run history" rule. Cleanup note: a second Copy-ID `HandoffButton` also renders in the live-tail overlay (`SessionLogOverlay` in `agent-shared.tsx`); removing it is part of "no leftover legacy button," not a second home for the resume box.
