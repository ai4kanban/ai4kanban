# Refine

Review one task and leave its plan more useful than you found it. This guide describes one
pass. `akb refine <id>` controls the loop and starts a fresh session when another pass or a
question-resolution pass is needed.

Do not ask the user during the pass. Record decisions only the user can make as `[user]`
questions on the card.

**Revising is not refining.** `akb revise` applies one requested change and stops.

## Review the card

Follow the card format and writing rules in `akb guide board`. Focus this pass on four
questions:

- **Value**: does the task advance the goal and roadmap in
  `docs/kanban/memory/goal.md`? Search the codebase and relevant project sources for work
  that already ships, and check the board for duplicate cards.
- **Scope**: is every planned change necessary for the card's stated goal? Keep unrelated
  ideas outside the card. Include implied work, such as tests and documentation for a
  user-visible change (`akb guide document-feature`).
- **Design**: is the complete user flow specified well enough to build without guessing?
  Cover important edge cases while keeping the design proportionate to its value. For a
  screen or UI change, first read `akb guide ui-design`.
- **State**: do checked and unchecked todos match what has already been built? If all work
  is complete and the goal is met, the card should be archived.

## Act on what you find

- Reject an off-goal or valueless task according to `akb guide reject`. If its value is
  uncertain, raise a question instead.
- Update an existing card instead of keeping a duplicate. Move a useful side goal to its
  own card, or group tightly coupled work according to `akb guide add-task` and
  `akb guide board`.
- Rewrite only what is needed to make the plan minimal, complete, and clear. Preserve every
  ``## By `<name>` agent`` section. Put a call a reviewer could reasonably refuse under the
  human half's `## Worth noting`, and the rest under `## Decided by the agent`.
- Make minor decisions yourself. For a significant product, priority, cost, or taste
  decision you cannot make, add a question with
  `akb board update-questions <id> --append ".."`. Tag it `[user]` only when the user must
  answer it, and include options when asking them to choose.
- Archive completed work according to "Finish a task" in `akb guide board`.

## Close the pass

At the end of the pass: if you are highly confident the plan is ready to build — no
substantive gap left, no question open — run `akb board update <id> --status ready`.

Otherwise leave it at `todo`. A fresh session reads the card cold and takes the next pass;
whatever you do not write into the card is lost.

- ❌ Wording you would have phrased differently is not a gap.

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
- **A repair is not a change**: a pass that only moved sections leaves the card's status
  where it found it — a `ready` card stays `ready` — and a `todo` card it finds nothing
  else wrong with may go `ready` in that same pass. A pass that also rewords or replans the
  card follows the rule above and leaves it at `todo`.

## Request specialized input

Use `akb spec <agent> <id> <short note>` only when a part of the specification has no
answer, or when this rewrite invalidated its existing spec-agent section. The spec agent
starts after this pass; do not wait for it or edit its section yourself.
