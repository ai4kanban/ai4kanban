---
name: competitors
description: What competing products offer and how they design it, one file per competitor.
i18n:
  zh:
    title: 竞品
    description: 竞品有哪些功能、如何设计，每个竞品一个文件。
---

- **`README.md`**: the index, one line per product — `- [<name>](<slug>.md): <what it is>` —
  then `## Not competitors (False positives)` with `- <name>: <why>`.
- **`<slug>.md`**: one per real competitor, with `last_read: <YYYY-MM-DD>` in its frontmatter,
  `## Features` with one `- [ ] **Title**: one liner on what it does and how` per thing it
  offers its users, and `## Sources` with `- <Title>: <url>` per page read.
- **Feature marks**: tick a line once we ship it; end it in `(#id)` while a card builds it.
- **Re-check**: read a product again before relying on it when its `last_read` is over three
  months old.
