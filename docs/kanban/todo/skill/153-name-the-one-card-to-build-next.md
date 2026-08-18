---
title: Name the one card to build next
track: skill
priority: med
roi: high
status: todo
release: ""
blocked_by: []
related: []
modules: [skill, local-ui]
questions:
  - "[user] Does Implement on the Next up band start the run in one press, or open the card first? A run can only be started from a card page today, so starting one straight from the board is new ground."
---

Asking "what's next?" today writes three brand-new cards. Most of the time the user
means "of what is already on my board, what should I build now?". Answer that question,
in both places the user works — the board's UI and the command.

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
- **A Next up band on the board**: a single row above the queue columns, the first thing
  under the header, naming the one card to build now.
- The band names the card by its id and title, and pressing that opens the card.
- Beside the name is the reason in one plain line, so the user can check it against the
  rule — "highest priority, nothing in its way, unblocks 3 cards".
- The runner-up is a second, quieter name in the same row; pressing it opens that card.
- **Implement sits at the right of the band** and starts the run on the named card.
- When no card qualifies, the band stays and says what is in the way, with counts —
  "Nothing is ready to build: 4 cards are waiting on another card, 2 on your answer".
- The band is absent only when the board holds no open cards at all.
- It picks from the cards on screen, so with a release showing the pick comes from that
  release.
- The band and the command answer with the same rule, so they can never name two
  different cards.
- On a narrow window the reason gives way first; the card, the runner-up and the button
  stay.

## Todo
- [ ] Add a command to the script that names the next card to build, with its reason.
- [ ] Have it name the runner-up, and say what is in the way when no card qualifies.
- [ ] Route "what's next" in the skill to this, and keep propose for "what are we missing".
- [ ] Update the daily-loop guide so the two asks read as two different asks.
- [ ] Draw the Next up band on the board: the card, its reason, the runner-up, the button.
- [ ] Show the band's blocked state — what is in the way, with counts.
- [ ] Check the board and the command name the same card, including on a board where
      nothing qualifies and on one showing a single release.

## Decided by the agent
- **A band above the columns, not a mark on a card** — the columns already put the pick on
  top, so what is new is the reason, the runner-up and the blocked state, and none of the
  three fits inside a card.
- **No way to hide it** — a switch that turns the band off is the ready-only focus toggle
  we already turned down, in a new shape.
- **It follows the release dropdown** — that dropdown decides what the board shows, and a
  pick naming a card the user cannot see is a pick they cannot press.
- **A card already being built is not the pick** — it is in flight and needs nothing, so
  the band moves on to the next one.
- **One card, not two** — the board's ranking rule is already shared from the command into
  the UI, so the band and the command are one change rather than two.

## Source
- Competitive analysis of Task Master, 2026-08-05 —
  https://github.com/eyaltoledano/claude-task-master; `next_task` is one of the seven
  commands they keep even in their smallest tool set, and every tutorial builds the loop
  around asking it what to work on next.
