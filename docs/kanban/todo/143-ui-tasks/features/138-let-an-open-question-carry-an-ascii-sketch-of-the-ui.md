---
title: Let an open question carry an ASCII sketch of the UI
track: features
priority: med
roi: med
status: ready
release: 0.7.0
blocked_by: []
related: [143]
modules: [skill, local-ui]
questions: []
---

A question about a screen is hard to answer in words. Let a question hold a rough ASCII sketch, and show that sketch as a block, so the user sees the shape they are picking.

## Scope
- A question's text may run several lines and hold a fenced sketch block.
- The card file stays readable. A question that runs several lines is written as a block in the frontmatter, not as one long line with `\n` inside it.
- The sketch shows as a block in both places a question is read: the open questions on a card page, and the Resolve dialog.
- A sketch wider than the panel scrolls sideways. It never wraps — a wrapped line breaks the drawing.
- Options stay one short line each. A sketch that shows two layouts labels them `A` and `B` inside the one block, and the options point at the labels.
- Only questions change. A sketch inside a card's own body already shows as a block today.
- Update `docs/guides/daily-loop.md`: a question about a screen can come with a sketch. No landing copy — this makes an existing step easier, it is not a new capability to advertise.

## Todo
- [ ] Let `update-questions --append` and `--update` take a question that runs several lines, and write it to the card as a readable block.
- [ ] Read that block back, so the script and the UI open the card the same way.
- [ ] Show a question's sketch as a block on the card page and in the Resolve dialog.
- [ ] Let a sketch wider than the panel scroll sideways instead of wrapping.
- [ ] Update `docs/guides/daily-loop.md`.
- [ ] Put a real two-layout question on a test card, answer it in the UI, and check the card file still reads as plain markdown.

## Decided by the agent
- **The answer keeps the whole question.** When the user answers, the question goes back to the agent as it was written, sketch and all — no special case that strips it, so the agent works from the same picture the user picked from.
