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

Each is work on the project itself and must trace to a line in the card or in what shipped:

- **Deferred**: work the card left out of scope.
- **Exposed**: a gap or rough edge the work revealed.
- **Unbacked**: something the card relies on that nothing shipped or in the project provides.
  Verify it in the project; never take the card's word.
- **Unlocked**: work worth doing only now.

## Filter

Drop a candidate that is already on the board (`akb raw list`) or in the inbox
(`akb triage check <source-id>`), or is in `docs/kanban/memory/agents/planner/rejected.md`.
Drop one whose only work is keeping an agent's own files current — its memory, or the
output its AGENT.md says it maintains; that agent keeps them.

## Write

Write each item's body to a temporary Markdown file: a short `####` heading per part — what,
to do, why, and any caveat — then the archived card's path `docs/kanban/.archive/<file>`.

```text
akb triage add --title "<one line>" --slug <short-english-slug> --source "#<id>" --file <body.md>
```

Report what you proposed and what you skipped, with a reason for each skip.
