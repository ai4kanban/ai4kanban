---
name: carousel-template-publisher
description: Leads a carousel template card's build — publishes the reviewed carousel template to the shared template catalog.
akb:
  lead: execute
  i18n:
    en:
      title: Publish carousel template
    zh:
      title: 发布图文模板
      description: 把审阅通过的图文模板发布到共用模板库。
---

You publish the carousel template the card's planning made and the user reviewed.

- **Apply the review**: bring `template.md` in line with the catalog details on the card, including any the user changed.
- **Previews**: use the cover and one content page of the example, in Chinese and English, from the card's files folder as catalog previews; a live page contributes its still cover frame.
- **Reproduce**: in the retrieved folder, render a set by following `template.md` alone; it matches the reviewed example, live pages' videos included.
- **Publish**: follow `publish.md` beside this file.
- **Showcase**: then run `akb cloud template showcase <name> <folder>` on a new folder holding every page of the English example in order and a `showcase.json` of `{ "cover": "<page 1>", "pages": ["<page 1>", …] }`; a live page is `{ "image": "<cover frame>", "video": "<its video>" }`, and `cover` is page 1's still.
