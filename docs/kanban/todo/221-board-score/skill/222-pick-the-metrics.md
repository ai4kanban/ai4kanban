---
title: Pick the few numbers that say how well the board plans
track: skill
priority: high
roi: high
status: ready
release: 0.7.0
blocked_by: []
related: [221]
modules: [skill]
questions: []
---

Four numbers for the board's quality have been named. Not all of them can be counted. Keep
the ones that can, write down exactly what each one counts, and say why the rest are out.

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
- A number stays only if it passes every test:
  - **nobody scores it**: no person sits down and rates a card to produce the figure.
  - **it costs no extra work**: the count comes out of a move the board already makes.
  - **two people agree**: two people counting the same cards get the same figure.
  - **it can move**: a change in how the board plans shows up in the figure.
- Keep three at most.
- If more than three pass, keep the ones that cover different parts of the board's work —
  answering a card's questions, proposing new work, planning a release.
- Write down, for every number kept: what is counted, what is left out, and how it is
  worked out.
- Count each number over one release.
- A number that has to be counted over something other than a release says what, and why.
- Name the case where each surviving number reads well while the board is planning badly.
- Write one line for each number cut, saying why.
- Say, for each surviving number, whether it can be counted for the cards already on this
  board, or only starts counting once #223 records what it needs.
- The definitions ship with the board, in one file that sits with the board's own rules.

## Todo
- [ ] test each of the four numbers against every test, and write the verdict
- [ ] write the definition of every number that survives
- [ ] write one line per number cut, saying why
- [ ] name the case where each surviving number reads well while the board plans badly
- [ ] try each surviving number on real cards from this board
- [ ] say which surviving numbers can be counted for the cards already here, and which only
      start once #223 records what they need
- [ ] save the definitions in one file that ships with the board

## Decided by the agent
- **A number a person has to score is out** — the point is a score that turns up on its own.
  Where a human judgment is worth the trouble, we already have #202.
- **Cutting a number is a result, not a failure** — saying out loud that release-completeness
  cannot be counted is more useful than a made-up figure for it. The cut is written down so
  nobody proposes the same number again.
- **Three at most** — a page of numbers nobody reads is worth less than one number that moves.
- **A number is defined before anything is built to collect it** — otherwise the definition
  quietly becomes whatever was easiest to record.
- **Counted over one release** — a release is the unit the board plans in, so it is the unit
  two scores can be compared across.
- **The definitions ship with the board** — every board scores itself, not only this one, so
  the file goes with the board's own rules rather than into this repo's notes. #223 and #224
  both build against it.
- **A number nothing records yet is still countable** — #223 adds the recording. Only a
  number that needs a person's opinion is out.
