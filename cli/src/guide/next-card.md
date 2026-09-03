# Name the next card to build

Pick from the cards the board already has. This flow reads; it never writes a card, starts a
run, or adds a field. Finding work the board is *missing* is `akb guide propose` instead.

## 1. Read the board

- **`akb raw list --json`** — every open card with its `status`, `priority`, `roi`,
  `release`, `blocked_by`, `isRoot` and file path.
- **`akb raw release list`** — the open releases, in ship order.
- **`akb run list`** — a run shown as `implement #<id>` is a card already being built.

## 2. Keep only the buildable cards

A candidate is `status: ready` with an empty `blocked_by`. Drop these whatever their status:

- **a group root** (`isRoot: true`) — the work is in its subtasks, not the root,
- **a recurring card** (its file is under `todo/recurring/`) — it has no end state, and `run`
  starts it rather than `implement`,
- **a card a run is already building** — it is in flight and needs nothing.

## 3. Rank what is left

1. **Priority** — `high` before `med` before `low`.
2. **ROI** — the same order, within one priority.
3. **Release** — the release shipping next first, later releases after it, no release last.
4. **Id** — the lowest, so the same board always answers with the same three.

Priority outranks the release, so a high-priority card in a later release beats a
lower-priority one in the release shipping next. The list can name work the current release
does not contain.

## 4. Answer

Name up to **three**, best first — id, title, and one line saying why it won, so the user can
disagree in one step:

```text
#267 Show a run's cost while it runs — high priority and high ROI, in 0.9.0, the release shipping next
```

- **Nothing qualifies**: say what is in the way, with counts — "Nothing is ready to build: 4
  cards wait on another card, 12 still need refining". Count each card once, under the first
  reason it fails. Only a board with no open cards at all answers that it has none.
