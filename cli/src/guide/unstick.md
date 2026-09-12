# Settle a card that sat too long

One card has been sitting untouched for a month or more. Decide it now: keep it, rewritten
for the project as it stands today, or discard it. The verdict is the run — you raise no
question, hand the card to nobody, and leave nothing for anyone to come back to.

A card is stale for a reason. Part of it usually shipped under another card, the project
moved somewhere else, or nobody ever really wanted it.

## What you are given

- **The card**, and the project evidence it names.
- **`docs/kanban/memory/goal.md`** — what this project is for.
- **Every module's `decisions.md` and `rejected.md`** — the calls already made.

You write none of them. What you judged stays on the card you kept, or leaves with the card
you discarded.

## 1. Judge two things

Both are yours to settle. Do not ask, do not append a question, and do not schedule a
refine to work it out later.

- **How much is already done.** Walk the card's `## Scope` and `## Todo` against the code
  and the docs as they are now. A step someone else's card delivered is done, whatever the
  checkbox says.
- **Whether the rest is still worth the effort.** Judge what is left against the goal and
  the decisions since. Work the project has moved past is not worth doing because it was
  once agreed.

An unanswered `[user]` question does not protect the card. Nobody is acting on it, so judge
the card as it stands — a card no longer worth doing is discarded whether or not the
question was ever answered.

## 2a. Keep it

The work is still worth doing. Rewrite the card for the project as it is today, following
`akb guide writing`:

- **Cut what is delivered or overtaken** — every step, decision and sentence that the code
  already does, or that the project has moved past.
- **Rewrite what has gone vague** — a line whose terms no longer match the code names what
  the code calls things now.
- **Split what asks too much** — when one card has grown into several independent pieces,
  follow `akb guide add-task`'s group-task procedure and create each with
  `--related <root-id> --schedule refine`. The subtasks refine themselves; you do not.
- **Never touch a checked todo.** `- [x]` is history: keep it exactly as written, even when
  the step it names has been superseded.

**This is a rewrite, not a refine.** Change only what you can show is out of date. Do not
run the planning QA loop, do not research the card into a better plan, and do not change
its status.

**Open questions survive.** A `[user]` question stays open, unless your rewrite made it
meaningless — then drop it with `akb guide update-questions`.

Then leave the note, in the card's human half — above the `<!-- agent -->` boundary, under
its own heading:

```text
## By `sweeper` agent

- **Still worth doing** — <one line: why the work survives>.
- **Must change first** — <the one product or technical direction that has to move before
  this is buildable, or "nothing — it is buildable today">.
- **Judged** — <YYYY-MM-DD>.
```

Rewrite that section whole each time you keep a card, so a kept card reads as new rather
than as a pile of past verdicts. Leave every other section of the human half alone: a
reviewer's `## Worth noting` is theirs.

## 2b. Discard it

The card is already done, or what is left is not worth the effort:

```text
akb raw reject <id> --discard
```

Then follow `akb guide reject` for the rest. A discard writes **no** memory: skip the note
entirely, touch no `rejected.md`, and ask the user for nothing. The board has simply moved
past this idea, and anyone may propose it again.

Do fix the lines the output lists as mentioning the card — a sentence that argues from a
card that is gone is now wrong.

## Report

End with one line, so a sweep over the stale cards (#119) can report what happened:

- Kept: `#<id> kept — <the "still worth doing" line>; must change first: <…>`
- Discarded: `#<id> discarded — <why in one clause>`
