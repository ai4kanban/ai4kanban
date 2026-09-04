---
title: Approve a screen, not a paragraph
priority: med
roi: high
status: todo
release: ""
blocked_by: []
related: []
modules: [shipped]
questions:
  - question: "[user] Which angle and hook does this lead with?"
    mode: single
    options:
      - "Approve a screen, not a paragraph — open on a card that carries a working UI mockup, so the taste call is made by looking. Cost: needs a real mockup screenshot before it can be written."
      - "The technology choice is a card, not a chat — open on the comparison spec skill settling a library pick with its tradeoffs on the card. Cost: narrower topic, and less to show."
      - "Write your own spec skill — open on the skill folder a project adds itself. Cost: only lands with people already running the board, so it is a retention piece, not a reach one."
    recommend: [1]
  - question: "[user] Which channels, and which of them leads?"
    mode: single
    options:
      - "小红书 leads, X follows — a screenshot-led piece is what that channel rewards. Cost: the term 'spec skill' needs explaining there."
      - "X leads, 小红书 follows — a mockup screenshot travels well as a single image post. Cost: the argument has to fit in very few words."
      - "YouTube leads (a short screen recording), X follows — the mockup is better watched than described. Cost: a recording is real production work, not a repurposing."
    recommend: [1]
---

A piece for developers who have had an agent build the wrong screen from a paragraph they
approved: a card can carry a working UI mockup and a technology comparison before anything is
built, so the decision is made by looking rather than by reading.

## Worth noting
- **Spec skills, not "AI design"**: the piece is about deciding earlier, not about generating
  visuals; the cost is that it will not ride any design-tool interest.

<!-- agent -->

## Today
- **Nothing published mentions spec skills**: the imported line in `memory/published.md` is
  about Kanban Engineering, and the unimported posts predate them.
- **What actually shipped**: a spec skill is an Agent Skill directory that fills one part of a
  card's spec; the board ships `ui-design` and `technology-selection`, and a project adds its
  own under `docs/kanban/skills/<name>/SKILL.md` (`docs/kanban/memory/skill/readme.md`,
  `web/content/docs/spec-skills.mdx`).

## Scope
- **Lead with the artifact**: a real mockup from a real card. A piece about this without the
  screenshot is not worth publishing.
- **Name the second skill too**: `technology-selection` puts the library choice and its
  tradeoffs on the card, so the pattern reads as general rather than as one UI feature.
- **Close on the extension point**: a project writes its own skill as a folder with a
  `SKILL.md`. One sentence, not a tutorial.
- **Must not claim**: that the mockup is production UI, or that the board designs for you. It
  settles a decision early; a person still makes it.
- **Lead channel**: whichever the channels question settles.

## Todo
- [ ] settle the two `[user]` questions
- [ ] capture the mockup screenshot the piece is built around
- [ ] write `content/5-approve-a-screen/source.md` for the lead channel
- [ ] commit the draft before it is edited — the writing rules are read from that diff
- [ ] user edits the draft, then publishes it by hand
- [ ] append the `published.md` line: date, channel, URL, result
- [ ] diff the draft against what was posted and add the writing rules

## Decided by the agent
- **The screenshot is a prerequisite, not a nice-to-have**: it is the piece, so it is a todo
  rather than an afterthought.
- **Not a tutorial**: how to write a spec skill is documentation, and the docs already cover
  it; this piece only has to make someone want to look.

### Overruled by the user

## Source
`docs/kanban/memory/skill/readme.md` and `web/content/docs/spec-skills.mdx`, via the planning
sources in `marketing/kanban/config.md`.
