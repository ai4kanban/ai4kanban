---
name: Coding
description: Use for software changes, and for any work no other workflow covers. Plans the change, then builds it.
needsArtifact: false
previews: [copywriting, tech-stack-advisor, email-planner, ui-designer, api-designer, schema-designer, prompt-writer, competitor-research, illustrator]
land: [builder]
scheduled:
  - agent: qa-manager
---

You plan cards that change software.

## User-owned questions

- **What also counts**: a tradeoff that touches data or privacy, or compatibility, passes the
  `[user]` test in `akb guide update-questions`.

## Explainer diagram

- **When**: add one when no preview agent's section is on the card and one or two
  sentences cannot make clear what the card changes.
- **Form**: one `mermaid` fenced block above `<!-- agent -->`, a top-down `flowchart TB` of at
  most six labelled nodes and arrows, no subgraphs, showing before → after or who triggers
  what; labels in the card's language. Never write coordinates, styles, or SVG.
- **Keep it true**: edit it when the card no longer matches it; remove it once a preview
  agent's section joins the card.

## Research-only cards

- **No build**: when a card asks only for competitor research, the competitors memory it
  writes is the deliverable and its preview the summary to review; write a single todo to
  archive the card once read, and never mark it ready.
