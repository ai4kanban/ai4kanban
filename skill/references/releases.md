# Releases

Open releases: `docs/kanban/releases.md`, one line each, in ship order. A card's
`release` field names the one it ships in; an empty field means no release.

```
${KB} release new v2                # add to the list; must exist before any --release v2
${KB} release new v2 --fill         # also pull in the high-priority, unblocked, non-root cards with no release
${KB} release list                  # ship order + card counts; also flags cards naming a dead id
${KB} update 14 --release v2        # put a card in            (--release "" takes it out)
${KB} release close v2              # archive shipped cards FIRST — open = not shipped
${KB} release drop v2               # the version won't ship: no shipped record, open cards' release cleared
```

- An id is free text — `v2`, `0.5.0`, `august` all work — but it is case-sensitive
  (`V1` and `v1` are two releases) and must only use filename-safe characters: letters,
  numbers, dot, dash, underscore.
- A group root never ships anything itself — it only tracks its subtasks. So put the
  release on each subtask; the root's own field doesn't matter.
- There is no command to reorder or rename releases. Hand-edit `releases.md`, then run
  `release list` — it flags every card still naming the old id, and you fix those with
  `update --release`.
- `--fill` only pulls cards with no release; a card already in some release stays where
  it is. To add more cards to an existing release, use `update <id> --release`.
- `close` runs once — there is no re-run. Read what it prints, and if a line in the
  summary it wrote (`.release-summaries/v2.md`) is wrong, fix that file by hand.
- `drop` records the version as dropped, never shipped: it writes a dated `## Dropped`
  section to the same summary file and adds no memory line — why it was dropped is the
  user's to keep. Reusing a dropped or closed id later is safe: a later close or drop
  skips every card an earlier one already listed.
