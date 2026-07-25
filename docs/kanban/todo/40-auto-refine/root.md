---
title: "Auto-refine: loop rough ideas into ready tasks on their own"
track: skill
priority: high
roi: high
status: todo
blocked_by: []
related: [16]
modules: [skill, local-ui]
questions: []
---

Make the agent refine tasks on its own, so the board runs itself. Today a human clicks
"Refine" to push each task from a rough idea to a ready plan. Auto-refine does that loop
in the background — this is what turns kanban-skill from a normal board into auto project
management.

This is the "auto-design" autonomy level from #16: the agent resolves a card's open
questions itself instead of asking, but only the questions it is confident about.

## Scope

One loop, run on every task that isn't ready yet:

1. **Raise questions.** Look at the card and list what's missing in the user experience.
2. **Answer the safe ones.** For each question, rate how sure the agent is it can answer
   without a human — high, med, or low. Auto-decide the sure ones (one subagent per
   question) and write the answer onto the card. Leave the rest as open questions for the
   user.

Each card's whole loop runs in one agent session — a single `claude -p` from start to
finish. Inside that session the agent never stops to ask the user. It keeps answering the
questions it is sure about; each answer can raise new ones, so it reviews again and
repeats. When the only questions left are ones it can't answer easily, it leaves them on
the card as open questions and the session ends. So one session ends one of two ways: a
`ready` card with no questions left, or a card holding open questions for the user — it
never pauses mid-run to wait on a human.

A human turns the whole thing on with one global switch; while it's off, nothing
auto-runs.

The work splits into three pieces:

- **#41** — the global switch, set from the UI, that turns auto-refine on.
- **#42** — the confidence-gated loop: raise questions, then auto-answer the ones the
  agent is sure about.
- **#43** — the background dispatcher that picks not-ready tasks (highest priority first)
  and refines them, and removes the now-unneeded manual "Refine" button.

## Todo
- [x] Add a global auto-refine switch you turn on in the UI #41
- [x] Auto-answer the open questions the agent is confident about #42
- [x] Run auto-refine in the background and drop the manual Refine button #43
