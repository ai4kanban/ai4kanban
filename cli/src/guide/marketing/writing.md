# Write a card

A card is one **topic**, and it is three things: a title, the channels it goes to, and the
draft under `content/`. It has no body — the piece is the deliverable, and a second copy of
the brief on the card is one that goes stale the moment the draft moves.

```text
---
title: <what this piece says, in the board's language>
status: todo
modules: [<pillar>]
channels: [x, xiaohongshu]
---
```

A card written by hand is `akb raw create --title ".."`, and then you write. Never
hand-write the frontmatter: `akb raw create`, `update`, `update-verify` and
`channel-status` are what set it.

## `channels:`

- **Write it the moment the user says which channels**:

  ```text
  akb raw update <id> --channels x,xiaohongshu
  ```

  in the order they picked. The order only orders the tab strip and where `+` appends.
- **No channel leads**: `channels:` is the set of channels the piece goes to — nothing on
  the card says which post matters most. `source.md` is written for none of them, and every
  chosen channel's draft is its own repurposing of it.
- **Never invent a channel**: the four are in `akb guide channel`.

## The draft is the card

- **The brief is the top of `source.md`**: a few lines saying the angle, who it is for, and
  what it may not claim, with the provenance among them. `implement` expands that file in
  place; it never writes a second brief onto the card.
- **The angle, the audience and the hook are the user's**: they are settled in the card's
  own chat, not filed as questions — a marketing card carries none.
- **Write the title in the board's language**, whatever language this guide is read in. A
  non-English title also needs `--slug <short-english-slug>`.
