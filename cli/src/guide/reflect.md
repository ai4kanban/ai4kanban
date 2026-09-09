# Reflect on a completed card

One card has just been finished. Judge what work should follow from it and write each
survivor into the inbox. Proposing nothing is a valid, complete result.

The card is the only input. Do not sweep the archive, do not read other completed cards,
and do not create, edit, or archive a card of any kind.

## 1. Read what was completed

Read the archived card in full — its summary, its scope, what its `## Todo` ticked off, and
anything its `## Decided by the agent` recorded. That is what shipped.

## 2. Name the follow-ups

List the work the completed card leaves behind. Strong candidates only:

- **What the scope deferred**: something the card named as out of scope and left undone.
- **What the build revealed**: a gap, a rough edge, or a decision the work exposed.
- **What it now makes possible**: work that was not worth doing until this shipped.

**Rules**:

- **Evidence from this card**: every candidate traces to a line in the card. A general idea
  the card merely reminded you of is not a follow-up.
- **Zero is normal**: most completions leave nothing worth proposing. Say so and stop.

## 3. Ground each one

Check `docs/kanban/memory/goal.md` and the module memory beside it for the direction, then
drop every candidate that is already accounted for:

- `akb raw list` — already on the board, planned or in flight.
- `docs/kanban/triage/inbox/` — already waiting to be triaged.
- `docs/kanban/memory/rejected.md`, and each module's — turned down before.

**Rules**:

- **Direction first**: a follow-up that pulls against the goal is dropped, not proposed.
- **No near-duplicates**: an existing card that covers the work is a skip. Do not edit it.

## 4. Write the survivors

One inbox item each:

```text
akb signals add --title "<one line>" --source "#<id>" --text "<why it follows, and the link>"
```

The body is two or three sentences: what the work is, why the completed card calls for it,
and `docs/kanban/.archive/<file>` — the card that prompted it.

## Report

Say what you proposed and what you skipped, with the reason for each skip. An inbox item is
not a task: nobody has agreed to it, and a person triages it like anything else that arrives.
