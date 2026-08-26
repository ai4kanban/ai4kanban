# Refine

Review one task and make its plan ready to build. This guide describes one pass. `akb
refine <id>` controls the loop and starts a fresh run when another pass or a
question-resolution pass is needed.

Refine assumes the task is wanted. Its job is to make the task minimal, complete, and clear
enough to build. It does not decide whether the task belongs on the roadmap, reject it, or
archive completed work.

**Revising is not refining.** `akb revise` applies one requested change and stops.

## Review the card

Follow the card format and writing rules in `akb guide board`. Focus this pass on:

- **Outcome**: does the card state what changes for the user or project, and what is wrong
  without it, clearly enough to guide the plan?
- **Existing work and duplicates**: search the codebase and relevant project sources for
  work that already ships, and check the board for duplicate cards. When another card
  covers the same outcome, update that card instead of keeping a duplicate.
- **Scope**: is every planned change necessary for the card's stated goal? Keep unrelated
  ideas outside the card.
- **Detail**: does each detail change the deliverable, prevent a likely mistake, or define
  a contract with related work? Cut repeated rationale, low-level choices that affect no
  requirement or constraint, scaffolding owned by another card, and narration about how
  later cards will extend this one.
- **Design**: is the complete user flow specified well enough to build without guessing?
  Cover important edge cases while keeping the design proportionate to its value.
- **Plan**: do checked and unchecked todos accurately distinguish what has already been
  built from what remains?
- **Writing**: does the card follow the board's writing rules in both halves?

## Act on what you find

- Move a useful side goal to its own card, or group tightly coupled work according to
  `akb guide add-task` and `akb guide board`.
- Rewrite only what is needed to make the plan minimal, complete, and clear. Follow
  `akb guide board` for decision placement and spec-agent sections.

## Raise user questions

Use the distinction between questions and open questions in `akb guide board`. Do not ask
the user during this pass; leave their decision on the card for a resolve pass.

- **Resolve what the evidence supports**: use the code, project sources, goal, prior
  decisions, and product conventions.
- **Hand over only user-owned decisions**: add the question with
  `akb board update-questions <id> --append ".."`, tag it `[user]`, and include concise
  options with relevant tradeoffs when useful.
- **Ask everything in one pass**: treat this as the card's only chance to ask. Walk the
  review checklist above a second time asking "what here is the user's call, not mine?",
  and append every question you find in one command — `--append` repeats. Raising them one
  per pass turns a single review into a chain of them, each costing a refine run and a
  resolve run.
- **Fold a dependent question in**: when a decision only matters under one answer to
  another, ask it now as part of that question — options that carry the follow-up, or one
  question that names the condition.

## Close the pass

At the end of the pass: if you are highly confident the plan is ready to build — no
substantive gap left, no question open — run `akb board update <id> --status ready`.

Otherwise leave it at `todo`. A fresh run reads the card cold and takes the next pass;
whatever you do not write into the card is lost.

- ❌ Wording you would have phrased differently is not a gap.
- ❌ A question you were saving for the next pass is a question for this one.

## Repair the card's shape

A card written before the two halves puts its sections wherever the writer left them. Put
them in the shape "Card format" in `akb guide board` shows, in the same pass:

- **Move, never reword**: each section keeps its lines word for word, ticked boxes
  included. Nothing is dropped and nothing is added.
- **Lift the reviewer's lines**: an old card's `### Worth noting` lines and its
  `## Pushback` lines move, as they stand, into the human half's `## Worth noting`. Drop
  the emptied headings.
- **Send the rest below**: every section the guide does not name goes into the agent half,
  under the named section it already follows.
- **Write the marker**: put `<!-- agent -->` directly above the first agent half section,
  unless the card has no agent half.
- **A repair is not a change**: moving sections is not replanning. Close the pass on what
  the plan says — a card whose shape you repaired and found nothing else wrong with goes
  `ready` in that same pass.

## Request specialized input

Use `akb spec <agent> <id> <short note>` only when a part of the specification has no
answer, or when this rewrite invalidated its existing spec-agent section. The spec agent
starts after this pass; do not wait for it or edit its section yourself.
