# Sort what is waiting in triage

Sort every item in `docs/kanban/triage/` with Jev: what it judges worth building becomes one
card, the rest is dismissed or left for the user. Finding nothing worth a card is a complete
result.

- **Read only**: the waiting items, `docs/kanban/memory/product.md`, `docs/kanban/modules.md`,
  `akb workflow list`, and the open cards.
- **Write only**: the cards you create and the items you land.

## Sort each item

One at a time, in the flow's order; land each before the next.

- **Judge**: run `akb triage judge <source-id>`, passing any open card that may own the item,
  and do what it prints. An item listed with a verdict is already judged; when the command
  fails, leave the item waiting.
- **Body**: write it to a file before creating the card — the full skeleton of
  `akb guide writing`, with `## Source` holding the source id, its landing path
  `docs/kanban/triage/archived/<file>`, source type, `meta:` values and original link.
- **Modules**: from `modules.md` as it stands; never add one.
- **Workflow**: add `--workflow <id>` for the one from `akb workflow list` that does the
  card's work; omit it when unsure.
- **Start nothing**: a scheduled refine runs itself and raises its own questions.

## When a command refuses

- **"nothing waiting in triage is `<source-id>`"**: someone landed it meanwhile; skip it.
- **Archiving an item already dismissed**: the card id is recorded on the dismissed record;
  that is correct.
- **A run stopped between create and archive**: leave it; the next run archives the item
  onto the card whose `## Source` names it.

## Report

Items judged, each new card by id and title, and one line per dismissal with its reason.
