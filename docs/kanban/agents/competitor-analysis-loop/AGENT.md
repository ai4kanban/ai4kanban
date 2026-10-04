---
name: competitor-analysis-loop
description: Keeps one feature checklist per competitor — what we already ship, what a card is building, and what nobody has touched — and sends each new gap to triage.
akb:
  hook: schedule
  i18n:
    en:
      title: Competitor analysis
    zh:
      title: 竞品分析
      description: 为每个竞品维护一份功能清单：标出我们已有的、卡片正在做的和没人碰过的，并把新缺口送进待筛选。
---

Keep one feature checklist per competitor, so we can see at a glance what they offer that
we already ship, what a card is building, and what nobody has touched — and send each
untouched feature to triage. It covers product features only, the work of the Coding
workflow.

## Files

Both are in your own folder. Edit them in place; never rewrite one from scratch.

- **`result.md`**: the index, one line per product —
  `- [x] <name> — read <YYYY-MM-DD>, cadence <daily|weekly|monthly|never>, next <YYYY-MM-DD>` —
  then `## Not competitors (False positives)` with `- <name>: <why>`.
- **`competitors/<slug>.md`**: one per real competitor, holding only `Last read: <YYYY-MM-DD>`,
  `## Features` with one `- [ ] **Title**: one liner` per thing it offers its users, and
  `## Sources` with `- <Title>: <url>` per page read.

A feature line is ticked once we ship it, ends in `(#id)` while a card is building it, and
is otherwise a gap.

## Process

1. **Find what is due**: add each new product to the index, folding name variants into
   one, then work only the products with no verdict yet or whose `next` date has arrived.
   New products come from dist0; carry on without them when `DIST0_API_KEY` is unset:
   `curl -s https://www.dist0.com/api/v1/invoke -H "Authorization: Bearer $DIST0_API_KEY" -H "Content-Type: application/json" -d '{"capability":"competitors.list","input":{}}'`
2. **Sort**: a real competitor plans, tracks, or manages development work for someone who
   builds with a coding agent. A product that only runs agents, only chats, or only hosts
   code, or that you cannot judge, goes under `Not competitors` with its reason.
3. **Read**: walk each due competitor's site — its listed sources, then features, pricing,
   docs, and changelog — and bring its checklist up to date: add what is new and delete
   what it dropped. Product features only; skip videos, blog, and other marketing.
4. **Mark**: tick only what a user can do today, per the board's `memory/readme.md`,
   `README.md`, or the site copy under `web/`. Write `(#id)` on a line an open card from
   `akb raw list` is building.
5. **Send new gaps to triage, never to a card**: one item per line added this run that is
   unticked with no id, and one per site `/vs-*` page the checklist contradicts:
   `akb triage add --title "<the feature or page fix>" --text "<what the competitor offers and why it matters>" --source "competitor analysis: <competitor>"`.
   An item triage refuses as already there is done.
6. **Set the cadence**: on the first read, pick it from how fast the product changes; a
   re-read that sent nothing to triage moves one step slower. Write the read date, cadence,
   and `next` date back to the index line.
