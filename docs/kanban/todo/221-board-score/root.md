---
title: Score how well the board does its own job
track: skill
priority: high
roi: high
status: ready
release: 0.7.1
blocked_by: []
related: [202, 222, 223, 224]
modules: [skill]
questions: []
---

We say the board turns a vague idea into a spec worth building. Nothing says how well it
does that. Give the board a few numbers it scores itself by, counted from the work it
already does. This is a group task; each piece is its own subtask in this folder.

## Today
- The board counts cards created, completed and rejected per day. That is all it counts.
- Whether a refine settled the right details, or a proposed card was worth having, is
  nobody's number. We only have our own word for it.

## Scope
- Three numbers at most.
- Every number is counted from what the board already writes down.
- The numbers cover the board's own planning: settling a card's details, proposing new
  work, planning a release. A part of that work with no countable number gets none.
- A number that needs someone to sit down and judge it does not go in.
- Collecting a number costs the user nothing — no extra click, no extra question.
- The score is counted per release, and written down when the release closes.
- Every board keeps its own record and prints its own score, not only this one.
- #202 stays what it is: a one-off test of whether the board changes what a coding agent
  builds. This group is the standing score of the board's own planning, which turns up on
  its own as the board is used.
- Out of this group: scoring the code an agent writes, any number about speed or cost, and
  showing our own score in public.

## Todo
- [ ] Pick the few numbers that say how well the board plans #222
- [ ] Keep the record the numbers need, as the board runs #223
- [ ] Show the board's score, and write it into every release #224

## Decided by the agent
- **What the first score can read** — the finished cards this board still keeps, which hold
  the calls the board made on its own. What was thrown away stays thrown away: a question is
  cleared off its card the moment it is answered, and a rejected card is deleted with only
  its idea kept in `rejected.md`. So the first score fills in what the cards still hold and
  says "not enough yet" for the rest, instead of digging figures out of git history.
- **The score ships with the board** — the record is written by the flows, and the flows are
  what every user runs, so there is no version of this that is ours alone. Every board keeps
  the record and can print its own score.
- **Why not measure everything we floated** — `social-posts/xiaohongshu/5.md` names four
  numbers, and one of them (how complete a release plan is) needs someone to say what the
  right plan would have been. That is a judgment, not a count. #222 tests all four and
  keeps only what survives.
- **Not a target** — the first numbers say where we stand. Setting a number to beat before
  we know what a normal release looks like would only teach the board to game it.
