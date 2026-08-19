---
title: Add a short UI design reference that UI features go through
track: skill
priority: med
roi: med
status: ready
release: 0.7.0
blocked_by: [138]
related: [143]
modules: [skill]
questions: []
---

Ship a short UI design doc in the skill's `references/`. The flows that shape a card read it when the card touches the UI, so UI features come out friendly to use.

## Scope
- Write `references/ui-design.md` — a few short instructions only. Recent models already have a good native sense of UI/UX; the doc steers, it doesn't teach.
- One of those instructions: when a question to the user is about the shape of a screen, draw it. The question carries a rough ASCII sketch in a fenced block — layout only, no colors. Two layouts go in one block, labelled `A` and `B`, and the options point at the labels. Showing that sketch in the UI is #138.
- In the flows that write or reshape a card (add-task, refine, propose): when the card changes something users see and click, read the doc before writing the plan.
- No doc updates needed: the user gets no new action — this steers the agent's planning.

## Todo
- [ ] Write `references/ui-design.md` with a few short instructions.
- [ ] Point add-task, refine, and propose at the doc for cards that touch the UI.
- [ ] Take one UI card through refine and check the doc's guidance shows up in the plan.

## Decided by the agent
- Where the doc lives — in the skill's own `references/`, shipped with the skill and the same for every project; not a per-project entry in the board's config.
- How a flow spots a UI card — by judgment: the work changes something users see and click. No module names hardcoded, since the skill installs into any project.
- When the doc is read — while planning the card, not during the build run. The implementing model already has a native UI sense; the card carries anything project-specific.
- Mockups in questions — allowed, and worth it. A layout question the user can see is answered in one glance instead of three sentences of prose.
- Which format — ASCII, not SVG or HTML. ASCII reads the same in the card file, the terminal, and the browser; SVG and HTML only work in the browser, and the UI drops raw HTML today, so allowing them means running agent-written markup through a sanitizer. A sketch answers "which arrangement", not "which shade", and ASCII covers arrangement.
