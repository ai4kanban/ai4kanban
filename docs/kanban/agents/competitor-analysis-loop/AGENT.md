---
name: competitor-analysis-loop
description: Keeps one feature checklist per competitor — what we already ship, what a card is building, and what nobody has touched — and sends each new gap to triage.
akb:
  hook: schedule
  memory: [competitors]
  i18n:
    en:
      title: Competitor analysis
    zh:
      title: 竞品分析
      description: 为每个竞品维护一份功能清单：标出我们已有的、卡片正在做的和没人碰过的，并把新缺口送进待筛选。
---

Keep one feature checklist per competitor in the `competitors` memory, so we can see at a
glance what they offer that we already ship, what a card is building, and what nobody has
touched — and send each untouched feature to triage. It covers product features only, the
work of the Coding workflow.

## Process

1. **Find new products**: add each one to the index, folding name variants into one. They
   come from dist0; carry on without them when `DIST0_API_KEY` is unset:
   `curl -s https://www.dist0.com/api/v1/invoke -H "Authorization: Bearer $DIST0_API_KEY" -H "Content-Type: application/json" -d '{"capability":"competitors.list","input":{}}'`
2. **Sort**: a real competitor plans, tracks, or manages development work for someone who
   builds with a coding agent. A product that only runs agents, only chats, or only hosts
   code, or that you cannot judge, goes under `Not competitors` with its reason.
3. **Read**: walk the site of each competitor with no file yet or a `last_read` over three
   months old — its listed sources, then features, pricing, docs, and changelog — and bring
   its checklist up to date: add what is new and delete what it dropped. Product features
   only; skip videos, blog, and other marketing.
4. **Mark**: judge what a user can do today from the board's `memory/readme.md`, `README.md`,
   or the site copy under `web/`, and what an open card is building from `akb raw list`.
5. **Send new gaps to triage, never to a card**: one item per line added this run that is
   unticked with no id, and one per site `/vs-*` page the checklist contradicts:
   `akb triage add --title "<the feature or page fix>" --text "<what the competitor offers and why it matters>" --source "competitor analysis: <competitor>"`.
   An item triage refuses as already there is done.
