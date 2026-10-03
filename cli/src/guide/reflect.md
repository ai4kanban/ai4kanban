# Reflect on a completed card

A card has just been finished. Propose the work that should follow it, one inbox item each.
Proposing nothing is a normal result. Do not read other archived cards, and do not create,
edit, or archive any card.

## Inputs

What was asked — read in full:

- **The card**: what was planned.
- **The discussion**: the conversation the card came from, when the flow lists one under
  `discussion`; the user's own words win over the card's.

What helps check it — read only as far as it sharpens a candidate:

- **What shipped**: what the flow lists under `shipped`.
- **Past misses**: each kind listed under `missed`; check this card for every one.

## Candidates

Each is work on the project itself that traces to a line in the card or in what shipped:
what it left out, revealed, relied on without anyone providing it, or made worth doing now.
Verify a gap in the project; never take the card's word.

Judge for yourself what is worth the user's time to read, exploratory ideas included; say so
in its text when one is a small chore.

## Filter

Drop a candidate that is already on the board (`akb raw list`) or in the inbox
(`akb triage check <source-id>`), is in `docs/kanban/memory/agents/planner/rejected.md`, or
is a guess nothing in the card or the project backs.

## Write

Write each item's body to a temporary Markdown file: a short `####` heading per part — what,
to do, why, and any caveat — then the archived card's path `docs/kanban/.archive/<file>`.

```text
akb triage add --title "<one line>" --slug <short-english-slug> --source "#<id>" --file <body.md>
```

Report what you proposed and what you skipped, with a reason for each skip.
