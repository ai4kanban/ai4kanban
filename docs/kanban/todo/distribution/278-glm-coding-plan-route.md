---
title: Say how to run the board on a Z.ai GLM Coding Plan
track: distribution
priority: med
roi: high
status: todo
release: 0.7.1
blocked_by: []
related: []
modules: [docs]
questions:
  - question: "[user] Nobody here has a GLM Coding Plan key, so the tiers can only be copied from Z.ai's page, not confirmed by a run. Publish the guide that way, or wait?"
    mode: single
    options:
      - Publish now — copy the tiers from Z.ai's page, and mark what has not been tested.
      - Wait — I will buy a Coding Plan, and the guide ships once a real run backs it.
    recommend: [1]
verify:
  - Run a card end to end on a real Z.ai Coding Plan, and check the guide's tiers match what you got.
  - Do the same with a key bought through BigModel, and check it behaves the same.
---

The board already runs on ZCode, Z.ai's own coding agent for its GLM models, so a Z.ai GLM
Coding Plan can run the board. What a plan-holder still cannot find out is which tier of that
plan to buy. Nor that the plan sold in mainland China through BigModel, Z.ai's Chinese
storefront, is the same plan. `README-zh.md` names ZCode among the agents but never says a
GLM Coding Plan runs the board, and that is where most plan-holders start.

## Scope
- **The plan part goes under ZCode in `docs/guides/connectors.md`**, alongside the sign-in
  and model lines already there.
- **Every tier is named**, so a reader deciding what to buy can match one to their budget.
- **Each tier says which GLM models it reaches.**
- **Each tier says what limit you hit** — the usage cap that ends a run.
- **No prices in the guide.**
- **One line says the tiers change**, and links Z.ai's plan page as the current list.
- **The plan sold through BigModel is covered too.**
- **The guide says plainly which of its claims are untested.**
- **`README-zh.md` gets one sentence** beside the agent list: the board runs on a GLM Coding
  Plan, linking the guide.
- **`README.md` is left alone.**
- **The site is left alone.**
- **Claude Code pointed at a Z.ai address is not offered.**
- **It is not named as an alternative either, supported or not.**

## Todo
- [ ] Add Z.ai's current Coding Plan tiers to ZCode's part of `docs/guides/connectors.md` —
      name, models, and usage cap per tier.
- [ ] Add the line saying the tiers change, and the link to Z.ai's plan page.
- [ ] Say whether BigModel lists the same tiers, and link its plan page too.
- [ ] Mark in that section which claims are untested.
- [ ] Add the one sentence and the link to `README-zh.md`.

## Decided by the agent
- **Where does this go?**: under ZCode's own entry in the connectors guide, because a plan and
  a key are settings for that agent.
- **Why the Chinese README and not the English one?**: a GLM Coding Plan is mostly bought by
  readers of `README-zh.md`.
- **Why not the site as well?**: one site change is five languages of copy.
- **Why is Claude Code pointed at Z.ai not mentioned?**: two documented ways into GLM means two
  to support, and only ZCode is tested.

### Worth noting
- **The guide carries no prices.** They move faster than the guide, so the linked page carries
  them instead. Someone deciding what to buy may want the price beside the tier anyway.
