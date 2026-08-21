---
title: Put what a human must read at the top of a card, and the agent's own notes at the bottom
track: skill
priority: med
roi: high
status: todo
release: ""
blocked_by: []
related: [262]
modules: [skill]
questions:
  - question: "[user] Does `## Todo` sit in the human half or the agent half?"
    mode: single
    options:
      - human half — the build plan is the human's input and they overrule it
      - agent half — a human reads the summary and `## Scope`; the tick boxes are the agent's working list
    recommend: [1]
  - question: "[user] Which half does a spec agent's section go in, when it holds mockups the user has to choose between?"
    mode: single
    options:
      - human half — a section that asks the user to pick is work for the human, wherever it was written
      - agent half always — one rule, no exceptions; the open question beside it is what pulls the user in
    recommend: [1]
  - question: "[user] What happens to the cards already on the board?"
    mode: single
    options:
      - reordered the next time each card is refined — no bulk rewrite
      - reordered all at once, in one pass over the board
    recommend: [1]
---

A card is read by two people — the one deciding it and the agent building it — and their
parts are mixed together today. Fix the order: what a human has to read and decide at the
top, what the agent worked out at the bottom. One file, one page, so reading a card costs
one pass instead of a whole page.

## Today
- The card format names the sections but never fixes their order, so every card lands
  differently: `## Decided by the agent` sits above `## Todo` on #112, #179, #182 and #183,
  a ``## By `<name>` agent`` section lands mid-card on #50, and `## Today` and
  `## Source` go wherever the writer put them.
- Every section reads with the same weight, so finding the few lines a human has to judge
  means reading all of them.

## Scope
- **Two halves, one card**: the top is what a human reads and decides, the bottom is what
  the agent worked out. Same file, same page — no second file, no second page.
- **The human half**: the summary line, `## Scope`, `## Todo`.
- **The agent half**: `## Today`, `## Decided by the agent` with its `### Worth noting`,
  each ``## By `<name>` agent``, `## Source`.
- **The rule for a section a card invents**: it goes in the human half if it says what to
  build or what to decide, in the agent half if it records what the agent found or settled.
- **One boundary, marked**: the card says where the agent half starts, so a reader and the
  board both find it without guessing.
- **Every flow writes in this order**: add-task, refine, propose, extract-ideas, spec-agent
  and release planning all produce an ordered card.
- **Refine repairs an old card**: sections move, nothing is reworded and nothing is dropped.
  Ticked boxes travel word for word.
- **Nothing new gets written**: this settles where a section sits, not what a card says.
- **The rules say it once**: "Card format" in `akb guide board` carries the order and the
  boundary; every other flow points at it.

## Todo
- [ ] Settle the boundary and write the order into "Card format" in `akb guide board`.
- [ ] Name which sections are the human half and which are the agent half, and the rule for
      a section a card invents.
- [ ] Make every flow that writes a card put the sections out in that order.
- [ ] Have refine move an out-of-order card's sections without rewording or dropping any.
- [ ] Check it end to end: refine #112, whose `## Decided by the agent` sits above its
      `## Todo`, and confirm the card only moved — no line changed, no box unticked.
