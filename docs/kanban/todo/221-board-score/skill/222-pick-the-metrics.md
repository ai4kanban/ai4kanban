---
title: Pick the few numbers that say how well the board plans
track: skill
priority: high
roi: high
status: todo
release: 0.7.0
blocked_by: []
related: [221]
modules: [skill]
questions: []
---

Four numbers have been floated for the board's quality. Not all of them can be counted.
Keep the ones that can, write down exactly what each one counts, and say why the rest are
out.

## Scope
- Start from the four in `social-posts/xiaohongshu/5.md`:
  - **details-coverage** — of the details a card settles, how many the board settled
    without asking a person.
  - **clarification-correctness** — of the calls the board made on its own, how many a
    person later overruled.
  - **proposal-acceptance-rate** — of the cards the board proposed itself, how many got
    built instead of dropped.
  - **release-completeness** — how much of a release's plan turned out to be the right
    plan.
- A number stays only if it passes all three tests:
  - **counted, not judged**: nobody sits down and scores it — the count falls out of a
    move the board already makes.
  - **same answer twice**: two people counting the same cards get the same figure.
  - **moves with the planning**: it moves when the board plans better, and sits still when
    the board plans the same.
- Keep three at most. A page of numbers nobody reads is worth less than one number that
  moves.
- If more than three survive, keep the ones that cover different parts of the board's work
  — settling a card's details, proposing new work, planning a release.
- Write down, for every number kept: what is counted, what is left out, and how it is
  worked out.
- A release is the stretch of time each number is counted over, so one release can be
  compared with the next. A number that needs a different stretch says which one.
- Name the way each surviving number can lie — the case where it reads well while the
  board is doing badly.
- Write one line for each number cut, saying why, so nobody proposes it again.
- Say, for each surviving number, whether it can be worked out for the cards already on
  this board, or only starts counting once #223 records what it needs. What is missing is
  the list #223 builds from.
- The definitions ship with the board, in one file that sits with the board's own rules.
  #223 and #224 both build against that file.

## Todo
- [ ] test each of the four numbers against the three rules, and write the verdict
- [ ] write the definition of every number that survives
- [ ] write one line per number cut, saying why
- [ ] name the way each surviving number can lie
- [ ] try each surviving number on real cards from this board, and say for each whether it
      can be worked out for the cards already here or only starts counting once #223 lands
- [ ] save the definitions in one file that ships with the board

## Decided by the agent
- **A number a person has to score is out** — the point is a score that turns up every week
  on its own. Where a human judgment is worth paying for, we already have #202.
- **Cutting a number is a result, not a failure** — saying out loud that release-completeness
  cannot be counted is more useful than a made-up figure for it.
- **A number is defined before anything is built to collect it** — otherwise the definition
  quietly becomes whatever was easiest to record.
- **The definitions ship with the board** — every board scores itself, not only this one, so
  the file goes with the board's own rules rather than into this repo's notes.
- **Nothing recording a number yet is not a reason to cut it** — #223 exists to add the
  recording. Only a number that needs a person's opinion fails the first test.
