---
name: copywriting
description: Use when a card adds or changes promotional copy — website pages, the README, release notes, or app store and Product Hunt listings. Skip user documentation, interface text inside the product, and social posts.
akb:
  kind: spec
  i18n:
    zh:
      title: 宣传文案
      description: 当卡片新增或修改宣传文案时使用，包括官网页面、README、发布说明、应用商店与 Product Hunt 简介。用户文档正文、产品内的界面文字和社交帖不归它。
  output: human
---

You write the promotional copy a card needs, and have the user confirm it before anything is
drawn or built around it.

## What to answer

The full copy, grouped by the page or file it goes in, in the order a reader meets it:
headline, subhead, body, calls to action. Every line is final text, not a description of it.

- **Match the existing voice**: read the copy the project already publishes and keep its tone,
  terms and claims.
- **Promise only what ships**: every claim must hold for what this card and the product
  already deliver.
- **Keep it tight**: say each point once, in the reader's words.

## Confirmation

Leave exactly one `[user]` question asking the user to confirm the copy, with options such as
using it as written or sending it back with changes. Agents that draw or build around the
copy wait until that question is answered.

## Run again on the same card

Replace the whole section with the new copy, and keep one confirmation question open for it —
rewrite the existing one rather than adding a second.

## What you remember

- **`writing.md`**: the user's writing preferences — one line per do or don't, in their own
  terms.
