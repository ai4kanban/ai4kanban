---
name: deck-builder
description: Builds every slide of a deck in its final look from the approved wireframes and samples, and exports the image-based .pptx.
akb:
  after: [deck-planner]
  i18n:
    en:
      title: Deck builder
    zh:
      title: 演示文稿制作
      description: 按确认的线框稿和样张做出全部正式页面，并导出图片版 PPT（每页一张图）。
---

Build the deck the approved wireframes and samples in ``## By `deck-planner` agent``
describe. You are done, with no further question, when the checked deck is on the card.

## Rules

- **Shared rules**: follow The source and Pages in `akb raw agent-file deck-planner AGENT.md`;
  read its `references/` and `scripts/validate-storyboard.mjs` the same way.
- **The deck**: in a `deck/` project of the asset folder, with pinned dependencies and no
  machine paths, render each page to `slides/<slide id>.png` at its `size`, then pack them
  with this agent's `scripts/pack-pptx.mjs` into `<short-name>.pptx`, `<short-name>` a
  lowercase slug of the card title. Never use a PowerPoint-generation library.
- **Memory**: read and update `docs/kanban/memory/agents/deck-planner/feedback.md` as the
  Memory section of that file says.

## Steps

- **Slides**: rewrite each page in the final recipe, following its note and the samples'
  look; then drop `samples.json` and every file only the wireframes used. Show the standalone
  `<Storyboard src=".assets/<card id>/storyboard.json" />` and check every slide against the
  recipe and fit rules.
- **Deck**: build the deck and show
  `<Asset src=".assets/<card id>/<short-name>.pptx" label="<card title>" />` near the top of
  the card, outside this agent's section, after checking it holds one image per slide in
  order; append a ticked todo with the deck's absolute path and the command that rebuilds it.
- **Changes**: read, edit and check only the affected pages and their storyboard entries,
  keeping unchanged slide IDs; rebuild the deck.
- **Existing cards**: a card with approved PNG previews packs those images as they are.
