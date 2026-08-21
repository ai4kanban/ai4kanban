---
title: Pick the few numbers that say how well the board plans
track: skill
priority: high
roi: high
status: ready
release: 0.7.1
blocked_by: []
related: [221]
modules: [skill]
questions: []
---

Four numbers for the board's quality have been named. The question is not which of them
describes the board best — it is which of them the board can write down as it runs. Name the
move that records each one. A number with no such move is cut, however good it is.

## Today
- The board records one line a day in `docs/kanban/metrics.csv`: date, completed, created,
  rejected. Nothing else is kept.
- An answered question is cleared off the card, and a rejected card is deleted, so the facts
  the other numbers would need are gone by the time anyone counts.

## Scope
- Start from these four, sketched in the post at `social-posts/xiaohongshu/5.md`:
  - **details-coverage** — of the questions a card raises, how many the board answered
    itself instead of handing them to a person.
  - **clarification-correctness** — of the answers the board decided on its own, how many
    stood, and how many a person later overruled.
  - **proposal-acceptance-rate** — of the cards the board proposed itself, how many got
    built instead of dropped.
  - **release-completeness** — of the cards a release was planned with, how many turned out
    to be the right ones to plan it with.
- Answer four things about the mechanism before judging the number at all:
  - **which move writes it** — the flow or command that is already running at the moment the
    fact is true.
  - **what it writes** — the exact field or line, and the file it lands in.
  - **what it costs** — nothing the user does, and no second pass over the board afterwards.
  - **when the fact goes** — the question cleared, the card deleted; a move that runs after
    that point cannot record it.
- A number is kept only if all four are answered with something that exists today, or with
  one line added inside a move the board already makes.
- **"#223 will record it" is not an answer.** #223 builds the write this card names; it does
  not invent one. A number handed over without a named write is cut here.
- Reading it back out of git afterwards is not a mechanism.
- A number that only works if a person scores a card is cut.
- Keep three at most. If more than three pass, keep the ones that cover different parts of
  the board's work — answering a card's questions, proposing new work, planning a release.
- Write down, for every number kept: the mechanism above, what is counted, what is left out,
  and how the figure is worked out.
- Count each number over one release. A number that has to be counted over something else
  says what, and why.
- Name the case where each surviving number reads well while the board is planning badly.
- Write one line for each number cut, saying which of the four mechanism questions went
  unanswered.
- Say, for each surviving number, whether the cards already on this board can be counted, or
  whether it starts from zero once the write exists.
- The definitions ship with the board, in one file that sits with the board's own rules.

## Todo
- [ ] answer the four mechanism questions for each of the four numbers
- [ ] cut the numbers with no mechanism, one line each saying what was missing
- [ ] write the definition of every number that survives, mechanism first
- [ ] name the case where each surviving number reads well while the board plans badly
- [ ] try each surviving number on real cards from this board
- [ ] say which surviving numbers can count the cards already here, and which start at zero
- [ ] save the definitions in one file that ships with the board

## Decided by the agent
- **The mechanism is the gate, not the number** — a number nothing can record is not a weak
  number, it is not a number. Feasibility is judged first and a good number fails it like any
  other.
- **A number a person has to score is out** — the point is a score that turns up on its own.
  Where a human judgment is worth the trouble, we already have #202.
- **This card hands #223 a list of writes** — per number kept: which move, what line, which
  file. #223 implements that list rather than working out what to record.
- **Cutting a number is a result, not a failure** — saying out loud that release-completeness
  cannot be recorded is more useful than a made-up figure for it. The cut is written down so
  nobody proposes the same number again.
- **Three at most** — a page of numbers nobody reads is worth less than one number that moves.
- **A number is defined before anything is built to collect it** — otherwise the definition
  quietly becomes whatever was easiest to record.
- **Counted over one release** — a release is the unit the board plans in, so it is the unit
  two scores can be compared across.
- **The definitions ship with the board** — every board scores itself, not only this one, so
  the file goes with the board's own rules rather than into this repo's notes. #223 and #224
  both build against it.
