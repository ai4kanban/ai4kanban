---
title: Turn a spec you already wrote into the cards that build it
track: skill
priority: med
roi: high
status: ready
release: ""
blocked_by: [249]
related: [249, 250, 251, 252]
modules: [skill]
questions: []
---

Most people arrive with a plan already written — a spec, a design doc, a list in a
notepad. Today they have to retype it as ideas one at a time. Let them point at the file
and get the board it describes.

## Scope

The flow:
- The user names a file.
- The agent reads that file and creates the cards that build what it describes.
- It is its own flow, `akb guide plan-from-spec`.
- The router at the top of `akb guide add-task` sends a request that names a file holding
  a plan to this flow.
- Every part of the spec becomes work.
- A part is never dropped for looking like a weak idea.
- The whole file is read.
- A file too long to read in one go is read in sections, and every section is covered.
- Cards are created by "Add one task idea", the step in `akb guide add-task` that writes
  one card.
- A file the agent cannot find, or cannot read, stops the flow before any card is written.
- It says which of the two happened, in one line.

Against the board:
- A part of the spec that is already built is skipped.
- A part that is already on the board updates the card that owns it, rather than becoming
  a second card.
- A part the spec leaves open becomes an open question on the one card it belongs to.
- Pieces that only make sense together become one group task — a root card with the pieces
  as subtasks — by the rule in `akb guide board`.
- The report lists every card created, every card updated, and every part skipped.
- Each skipped part carries the reason it was skipped.

Before it writes:
- In a session the agent lists the cards it is about to write and waits for the user's yes.
- In a background run the same list goes to the run's log before the first card is created.

## Todo
- [ ] Write the flow: read a file the user names, and plan the cards that build it.
- [ ] Cover the whole spec, and skip only what is already built.
- [ ] Report what was created, what was updated, and what was skipped with its reason.
- [ ] Update the card that already owns a part of the spec, instead of writing a second one.
- [ ] Turn what the spec leaves open into an open question on the card it belongs to.
- [ ] Group tightly coupled pieces into one group task instead of loose cards.
- [ ] List the cards before writing them — the user's yes in a session, the run's log in a
      background run.
- [ ] Point the add-task router at this flow, and say when it applies rather than
      extract-ideas.
- [ ] Cover it in `docs/guides/daily-loop.md` as the way to start from a plan you already
      have.
- [ ] Run it on a real spec file and read the cards it wrote.

## Decided by the agent
- **Why its own flow rather than a mode of `akb guide extract-ideas`**: extract-ideas reads
  a source as evidence and may drop parts of it. A spec is the opposite — every part of it
  is work. One flow cannot hold both readings.
- **Which docs it updates**: `docs/guides/daily-loop.md` only. The landing copy waits for
  the file picker in #252; until that ships, the only way in is naming the file when you
  ask.

### Worth noting
- **The spec is read directly, not through the step that rewrites raw material into a
  short brief (#251)**: a brief is a short reading of loose notes, and this flow promises
  that nothing in the spec is dropped. If that step ships and can hold a long spec line for
  line, this flow can move behind it.
- **A background run creates the cards without waiting for a yes**: nobody is there to
  answer. What keeps it safe is the list written to the log first, and the user rejecting
  any card that should not exist. The alternative was to stop and leave the plan unbuilt,
  which ends the run with nothing on the board.
- **No cap on how many cards one spec makes**: a cap would break the promise to cover the
  whole spec. A 40-card import is allowed, and the list written before it is what keeps it
  from being a surprise.

## Source
- Competitive analysis of Task Master, 2026-08-05 —
  https://github.com/eyaltoledano/claude-task-master; `parse-prd` is the command every one
  of their tutorials starts with, pointed at a spec file, and their best-practice line is
  "always start with a detailed PRD". We have no equivalent: our intake flow weighs a
  source as evidence and is allowed to drop parts of it.
