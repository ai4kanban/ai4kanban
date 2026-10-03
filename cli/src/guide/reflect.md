# Reflect on completed cards

Some cards have just been finished. Propose the work that should follow them, one inbox item
each. Proposing nothing is a normal result. Do not read archived cards you were not given,
and do not create, edit, or archive any card.

## Inputs

Each card comes in its own `<card>` block; read each in full and take nothing from one block
for another:

- **The card**: what was planned.
- **The discussion**: the conversation the card came from, when its block lists one under
  `discussion`; the user's own words win over the card's.

What helps check it — read only as far as it sharpens a candidate:

- **What shipped**: what each block lists under `shipped`.
- **Past misses**: each kind listed under `missed`; check every card for each one.

## Candidates

Each is work on the project itself that traces to a line in the card or in what shipped:
what it left out, revealed, relied on without anyone providing it, or made worth doing now.
Verify a gap in the project; never take the card's word.

Judge for yourself what is worth the user's time to read, exploratory ideas included; say so
in its text when one is a small chore.

## Filter

Drop a candidate that is already on the board (`akb raw list`) or in the inbox
(`akb triage check <source-id>`), was turned down in `docs/kanban/memory/agents/planner/rejected.md`,
`docs/kanban/memory/agents/planner/<module>/rejected.md` for each of the card's modules, or
`docs/kanban/memory/agents/planner/dismissed.md`, or is a guess nothing in the card or the
project backs. When several cards lead to the same work, propose it once, from the card it
traces to most directly.

## Write

Write each item's body to a temporary Markdown file: a short `####` heading per part — what,
to do, why, and any caveat — then the archived card's path `docs/kanban/.archive/<file>`.

```text
akb triage add --title "<one line>" --slug <short-english-slug> --source "#<id>" --file <body.md>
```

`--source` names the card the item traces to. Report what you proposed and what you skipped,
with a reason for each skip.
