# Sort what is waiting in triage

Judge every item in `docs/kanban/triage/`: what is worth building becomes one card with a
refine scheduled, the rest is dismissed with a reason. Finding nothing worth a card is a
complete result.

- **Read only**: the waiting items, `docs/kanban/memory/product.md`, the planner's memory in
  `docs/kanban/memory/agents/planner/`, `docs/kanban/modules.md`, `akb workflow list`, and
  the open cards.
- **Taste**: the planner's `dismissed.md` holds the user's past dismissals; the product and
  this run's instruction outrank it.
- **Write only**: the cards you create and the items you land.
- **`akb triage judge`**: when the flow names it, run it per item instead of step 1, passing
  any open card that may own the item, and do what it prints. An item listed with a verdict
  is already judged; when the command fails, leave the item waiting.

## 1. Judge each item

One at a time, in the flow's order; land each before judging the next.

- **Read it in full**: its text, source type, `meta:` values and link are all that is known.
- **Duplicates**: by `akb guide evaluate-task`, drop what is already supported, on an open
  card, or turned down before. Never update the card that already owns it.
- **Worth**: keep it only if it improves a product outcome, weighed against the product, not
  how loudly it is said.

## 2. Card what survives

Write the body to a file, then create the card in one call and archive the item onto it:

```text
akb raw create --title "<one line>" --slug <short-english-slug> \
  --modules <modules> --priority <low|med|high> --roi <low|med|high> \
  --workflow <id> --schedule refine --body-file <path>
akb triage archive <source-id> --card <id>
```

- **Modules**: from `modules.md` as it stands; never add one.
- **Workflow**: the one from `akb workflow list` that does the card's work; prefer one not
  marked `Pro`, but take a `Pro` one when only it fits. Omit the flag when unsure; when no
  workflow can do the work, dismiss the item instead.
- **Body**: the full skeleton of `akb guide writing`, ending with `## Source`: the source id,
  its landing path `docs/kanban/triage/archived/<file>`, source type, `meta:` values and
  original link.
- **Start nothing**: the scheduled refine runs itself and raises its own questions.

## 3. Dismiss the rest

```text
akb triage dismiss <source-id> --reason "<why, in one clause>"
```

Name the failed check — already supported, already on `#<id>`, turned down before, too
little worth, or no workflow does it — clearly enough to judge a month later.

## When a command refuses

- **"nothing waiting in triage is `<source-id>`"**: someone landed it meanwhile; skip it.
- **Archiving an item already dismissed**: the card id is recorded on the dismissed record;
  that is correct.
- **A run stopped between create and archive**: leave it; the next run archives the item
  onto the card whose `## Source` names it.

## Report

Items judged, each new card by id and title, and one line per dismissal with its reason.
