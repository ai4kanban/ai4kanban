---
title: Split, rewrite, or reject a card that sat too long
priority: med
roi: high
status: todo
release: ""
blocked_by: [117]
related: [116]
modules: [skill]
questions: []
---

A stuck card is stuck for a reason: too big, gone vague, or nobody wants it. Give the
agent one flow that takes a stuck card and does something about it.

Part of #116. Finds its cards with the stale listing (#117).

## Scope
- The flow reads one stuck card and picks one move:
  - **Split** — the card asks for too much at once. Break it into smaller cards, a
    group task if the pieces are big.
  - **Rewrite** — the project moved on and the card did not. Redo the body against what
    exists today. Ticked boxes are history and stay.
  - **Reject** — the card no longer earns its place. Propose the reject with the why,
    following the reject flow.
- Every move leaves one line on the card saying what was done and why, so the user can
  overrule it.
- Whether a reject needs the user's sign-off is an open question on #116 — the flow
  follows whatever is decided there.
- A card the flow handled is fresh again. It is not touched twice until it goes stale
  twice.

## Todo
- [ ] Write the flow as a reference the agent follows: read the card, pick split /
      rewrite / reject, act.
- [ ] Split: create the smaller cards through the script, wire blocked-by and related,
      fold the old card into them.
- [ ] Rewrite: redo the body against today's project; never touch ticked boxes.
- [ ] Reject: follow `akb guide reject`, honoring the sign-off call from #116.
- [ ] Run the flow by hand on one real stuck card and fix what reads wrong.
