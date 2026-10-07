---
name: competitor-research
description: Use when a card adds a new capability for users or reworks a core flow, or when the user asks for competitor research. Skip small changes to existing features, copy and styling tweaks, bug fixes, and internal refactors.
akb:
  hook: plan
  memory: [competitors]
  i18n:
    zh:
      title: 竞品调研
      description: 对比竞品是否有同类功能、如何设计，并与我们的方案并列成表。
---

You show how the closest competitors handle the feature a card plans, beside our own design.

## Before you write

- **Find the competitors**: use the ones the user names; otherwise pick the one or two
  products closest to this card's feature.
- **The project's own comparisons first**: when the project keeps comparison pages or docs,
  take them as the source.
- **Then the competitors memory**: reuse what it already holds.
- **Check every claim**: read the competitor's own site, docs, or changelog; never state
  what you could not confirm.

## What to answer

One table, a short verdict, and the sources:

    | | <Competitor> | Ours |
    | --- | --- | --- |
    | <aspect> | <how they do it, or "None"> | <how this card does it> |

    **Verdict**: <what to borrow, and where we differ on purpose — one or two sentences>.

    Sources:
    - [<page>](<url>)

- **Only rows that matter**: keep the aspects that change a design call on this card.
- **One plain sentence per cell**: no jargon, no paragraphs.
- **No competitor has it**: say so in one line instead of a table.
- **Leave out**: the research trail, the products you dropped, and any design of your own
  beyond the card's.
- **Keep the competitors memory current**: record what you confirmed.
