# Reflect on completed cards

Some cards have just been finished. Propose the work that should follow them, one inbox item
each. Proposing nothing is a normal result. Do not read archived cards you were not given,
and do not edit or archive any card yourself; create one only when your settings say so.

## Inputs

Each card comes in its own `<card>` block; read each in full and take nothing from one block
for another:

- **The card**: what was planned.
- **The discussion**: the conversation the card came from, when its block lists one under
  `discussion`; the user's own words win over the card's.

What helps check it — read only as far as it sharpens a candidate:

- **What shipped**: what each block lists under `shipped`.
- **Past misses**: `docs/kanban/memory/agents/proposer/missed.md`, when it exists, lists kinds
  of follow-up missed before; check every card for each one.

## Candidates

Each is work on the project itself that traces to a line in the card or in what shipped:
what it left out, revealed, relied on without anyone providing it, or made worth doing now.
Verify a gap in the project; never take the card's word.

Judge for yourself what is worth the user's time to read, exploratory ideas included; say so
in its text when one is a small chore.

When what shipped makes an open card's plan untrue, propose no item for it; run
`akb card revise <id> "<the change and why>"` instead.

## Filter

Drop a candidate that is already on the board (`akb raw list`) or in the inbox
(`akb triage check <source-id>`), is work an agent in the `<scheduled-agents>` block does on its
own runs, is turned down by `docs/kanban/memory/agents/planner/rejected.md` or
`docs/kanban/memory/agents/planner/*/rejected.md`, or is a guess nothing in the card or the
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
