---
title: Turn a spec you already wrote into the cards that build it
priority: med
roi: high
status: ready
release: ""
blocked_by: []
related: [250, 251, 252]
modules: [skill]
questions: []
---

Most people arrive with a plan already written — a spec, a design doc, a list in a
notepad. Today they have to retype it as cards, one at a time. Let them point at the file
and get the cards that build it.

## Scope

The flow:
- The user names a file.
- The flow reads that file and creates the cards that build what it describes.
- It is its own flow, `akb guide plan-from-spec`.
- A request that names a file holding a plan is sent here by `akb guide add-task`.
- A part of the spec is anything in it that says something to build.
- The parts that only explain the plan — background, why it matters, what a word means —
  are read for context.
- Those parts never become cards.
- No part is left out without a reason.
- A part is never dropped for looking like a weak idea.
- The whole file is read, in sections if it is too long for one read.
- Cards are written the way every other flow writes them — "Add one task idea" in
  `akb guide add-task`.
- The flow stops before writing any card when it cannot find the file, or cannot read it.
- It says in one line which of those two it was.

Against the board:
- A part that is already built is skipped.
- A part already covered by a card on the board updates that card, instead of becoming a
  second one.
- A part the spec leaves open becomes an open question on the card it belongs to.
- Parts that only make sense together become one group task: a root card with those
  parts as subtasks.
- `akb guide board` has the folder layout a group takes.
- A group is written one card at a time: the root first, then each part related to it.
- A part that delivers something on its own stays a card of its own.
- It ends by reporting every card created, every card updated, and every part skipped.
- Each skipped part carries the reason it was skipped.

Before it writes:
- When the user is there to answer, the flow lists the cards it is about to write and
  waits for their yes.
- The user can drop or change any card on that list before it is written.
- In a background run the same list goes to the run's log before the first card is created.

## Todo
- [ ] Write the flow: read a file the user names, and plan the cards that build it.
- [ ] Cover the whole spec, and skip only what is already built.
- [ ] Report what was created, what was updated, and what was skipped with its reason.
- [ ] Update the card that already covers a part of the spec, instead of writing a second
      one.
- [ ] Turn what the spec leaves open into an open question on the card it belongs to.
- [ ] Group the parts that only make sense together into one group task, and leave a part
      that delivers something on its own as a card of its own.
- [ ] List the cards before writing them — the user's yes when they are there, the run's
      log in a background run.
- [ ] Point `akb guide add-task` at this flow, and say when a file goes here rather than to
      `akb guide extract-ideas`.
- [ ] Cover it in `docs/guides/daily-loop.md` as the way to start from a plan you already
      have.
- [ ] Run it on a real spec file and read the cards it wrote.

## Decided by the agent
- **Why its own flow rather than a mode of `akb guide extract-ideas`**: extract-ideas reads
  a source as evidence and may drop parts of it. A spec is the opposite — every part of it
  is work.
- **Which docs it updates**: `docs/guides/daily-loop.md` only. The landing copy waits for
  the file picker in #252.

### Worth noting
- **Does this flow group at all?**: yes. The board turned down grouping a release plan's
  cards, but that was releases, where each card ships on its own.
- **The spec is read directly, not through the brief in #251**: a brief is a short reading
  of loose notes, and this flow promises nothing in the spec is dropped.
- **A background run writes the cards without waiting for a yes**: the list in the log is
  what keeps it checkable.
- **No cap on how many cards one spec makes**: a cap would break the promise to cover the
  whole spec.

## Source
- Competitive analysis of Task Master, 2026-08-05 —
  https://github.com/eyaltoledano/claude-task-master; `parse-prd` is the command every one
  of their tutorials starts with, pointed at a spec file, and their best-practice line is
  "always start with a detailed PRD". We have no equivalent.
