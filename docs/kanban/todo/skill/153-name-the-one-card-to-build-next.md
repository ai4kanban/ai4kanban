---
title: Name the one card to build next
track: skill
priority: med
roi: high
status: todo
release: ""
blocked_by: []
related: []
modules: [skill]
questions: []
---

Asking "what's next?" today writes three brand-new cards. Most of the time the user
means "of what is already on my board, what should I build now?". Answer that question.

## Scope
- One command that names the next card to build and says why it won.
- It picks from the open cards only. It never writes a card.
- The rule is plain enough that a user can predict it: nothing open is blocking the card,
  it has no open questions, and among those it takes the highest priority, then the
  highest ROI, then the card that unblocks the most other work.
- It names the runner-up too, so the user can disagree in one step.
- When nothing is buildable, say what is in the way — every card blocked, or every card
  waiting on a question — instead of printing nothing.
- Split the two meanings of "what's next" in the skill and the daily-loop guide: picking
  from the board is this; inventing new work stays propose.

## Todo
- [ ] Add a command to the script that names the next card to build, with its reason.
- [ ] Have it name the runner-up, and say what is in the way when no card qualifies.
- [ ] Route "what's next" in the skill to this, and keep propose for "what are we missing".
- [ ] Update the daily-loop guide so the two asks read as two different asks.

## Source
- Competitive analysis of Task Master, 2026-08-05 —
  https://github.com/eyaltoledano/claude-task-master; `next_task` is one of the seven
  commands they keep even in their smallest tool set, and every tutorial builds the loop
  around asking it what to work on next.
