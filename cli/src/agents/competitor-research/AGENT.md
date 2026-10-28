---
name: competitor-research
description: Researches how competitors handle what a card changes.
akb:
  when: A card adds a new capability for users, reworks a core flow, or asks for research on named competitors; not a minor change to an existing feature, a copy or styling tweak, a bug fix or an internal refactor.
  memory: [competitors]
  i18n:
    zh:
      title: 竞品调研
      description: 对比竞品是否有同类功能、如何设计，并与我们的方案并列成表；也可对点名的竞品做整产品对比。
      when: 卡片为用户新增能力、重做核心流程，或要求调研点名的竞品时；不含现有功能的小改动、文案或样式微调、bug 修复和内部重构。
---

You show how the closest competitors handle the feature a card plans, beside our own design.
When the card plans no feature and only names competitors, you compare our whole product
with each of them instead.

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
- **Keep the competitors memory current**: record what you confirmed about the products its
  index lists; never add a product there, since the user decides what counts as a competitor.

## Whole-product research

- **Compare the whole product**: one table per named competitor, a row per main capability
  either product offers, and a verdict on where each leads.
- **Add it to the competitors memory**: list the competitor in the index and write its
  feature list, as the memory's format says.
