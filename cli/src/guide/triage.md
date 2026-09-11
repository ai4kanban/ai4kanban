# Sort what is waiting in triage

Judge every item waiting in `docs/kanban/triage/`. What is worth building becomes one card
with a refine scheduled on it; everything else moves to `dismissed/` with the reason. Judging
nothing worth a card is a complete result.

Read only: the waiting items, `docs/kanban/memory/goal.md`, the module memory beside it
(including each `rejected.md`), `docs/kanban/modules.md`, and the open cards. Change nothing
but the cards you create and the items you land.

## 1. Judge one item

Take the items one at a time, in the order the flow lists them. For each:

1. **Read it in full** — its own words, its source type, the values under `meta:`, and the
   link. The file is the whole of what is known about it.
2. **Check for duplicates** with `akb guide evaluate-task`: skip anything already supported,
   already covered by an open card, or turned down before.
3. **Judge its worth**: would it improve the user's experience, the product's performance, or
   some other product outcome? Weigh it against the goal, not against how loudly it is said.

**Rules**:

- **Never adopt an existing card**: an item that lands on work a card already owns is
  ignored, not merged into that card. `evaluate-task`'s "update the card that already owns
  it" branch does not apply here.
- **Modules come from the map**: pick from `modules.md` as it stands. Never add one.
- **One item, one judgement**: decide, land it, then move to the next. Do not judge the whole
  list first.

## 2. Card what survives

Write the body to a file first, then create the card in one call — a card is never left
scaffolded with a refine already scheduled on it:

```text
akb raw create --title "<one line>" --slug <short-english-slug> \
  --modules <modules> --priority <low|med|high> --roi <low|med|high> \
  --proposed --schedule refine --body-file <path>
```

Write the body by `akb guide writing` — the whole skeleton, not a summary: the opening
paragraph, `## Worth noting`, the `<!-- agent -->` boundary, `## Scope`, `## Todo` with real
steps, and `## Decided by the agent`. A body missing one of them fails `akb raw validate`.

End it with `## Source`:

- the item's source id and the path it lands at — `docs/kanban/triage/archived/<file>`,
- its source type and the values its `meta:` carried,
- the original link.

Then record what it became, straight after the create:

```text
akb triage archive <source-id> --card <id>
```

The refine runs itself: the board starts one scheduled run per tick. Start nothing — no
delivery, no second run — and answer no question the refine will raise.

## 3. Ignore the rest

```text
akb triage dismiss <source-id> --reason "<why, in one clause>"
```

The reason is the whole record of that judgement: say which check it failed — already
supported, already on `#<id>`, turned down before, or too little worth — plainly enough that
a reader a month from now agrees or disagrees with it.

## When a command refuses

- **"nothing waiting in triage is `<source-id>`"** — somebody landed that item while you were
  judging it. Skip it and carry on; it is not a failure of this run.
- **An item already ignored, after its card was written** — `akb triage archive` records the
  card id onto the `dismissed/` record and leaves it there. That is correct: the card exists,
  and the item stays ignored.
- **A run that stopped between the create and the archive** — leave it. The next run
  reconciles: an item whose source id is already on an open card's `## Source` is archived
  onto that card before anything judges it again.

## Report

Say how many items you judged, each new card by id and title, and how many you ignored. One
line per ignore with its reason.
