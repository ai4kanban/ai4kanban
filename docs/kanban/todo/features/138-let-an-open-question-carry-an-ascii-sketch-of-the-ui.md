---
title: Let an open question carry an ASCII sketch of the UI
track: features
priority: med
roi: med
status: todo
release: ""
blocked_by: []
related: [137]
modules: [skill, local-ui]
questions: []
---

A question about a screen is hard to answer in words. Let a question hold a rough ASCII sketch, and show that sketch as a block, so the user sees the shape they are picking.

## Scope
- A question's text may run several lines and hold a fenced sketch block.
- The card file stays readable. A question that runs several lines is written as a block in the frontmatter, not as one long line with `\n` inside it.
- The sketch shows as a block in both places a question is read: the open questions on a card page, and the Resolve dialog.
- Options stay one short line each. A sketch that shows two layouts labels them `A` and `B` inside the one block, and the options point at the labels.
- Update `docs/guides/daily-loop.md`: a question about a screen can come with a sketch. No landing copy — this makes an existing step easier, it is not a new capability to advertise.

## Todo
- [ ] Let `update-questions --append` and `--update` take a question that runs several lines, and write it to the card as a readable block.
- [ ] Read that block back, so the script and the UI open the card the same way.
- [ ] Show a question's sketch as a block on the card page and in the Resolve dialog.
- [ ] Update `docs/guides/daily-loop.md`.
- [ ] Put a real two-layout question on a test card, answer it in the UI, and check the card file still reads as plain markdown.
