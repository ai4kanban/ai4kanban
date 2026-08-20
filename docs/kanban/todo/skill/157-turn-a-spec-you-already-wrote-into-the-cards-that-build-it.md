---
title: Turn a spec you already wrote into the cards that build it
track: skill
priority: med
roi: high
status: todo
release: ""
blocked_by: []
related: [250, 251, 252]
modules: [skill]
questions: []
---

Most people arrive with a plan already written — a spec, a design doc, a list in a
notepad. Today they have to retype it as ideas one at a time. Let them point at the file
and get the board it describes.

## Scope
- The user names a file. The agent reads it and creates the cards that build it.
- A spec is not evidence to weigh: every part of it becomes work, and nothing is quietly
  dropped for being a weak idea. That is the opposite of how the extract-ideas flow reads
  an article, so this is its own flow.
- Anything the spec leaves open becomes an open question on the card it belongs to, not a
  guess.
- Parts already built are skipped, and the report says which and why — importing a spec
  into a live board must not duplicate what is there.
- The agent reports what it made before it makes it, so a 40-card import is not a
  surprise.

## Todo
- [ ] Write the flow: read a file the user names, and plan the cards that build it.
- [ ] Cover the whole spec — skip only what is already built, and say what was skipped.
- [ ] Turn what the spec leaves open into questions on the right card.
- [ ] Group tightly coupled pieces into group tasks instead of loose cards.
- [ ] Show the plan for approval before the cards are created.
- [ ] Point the add-task router at this flow, and say when it applies rather than
      extract-ideas.
- [ ] Cover it in the daily-loop guide as the way to start from a plan you already have.

## Source
- Competitive analysis of Task Master, 2026-08-05 —
  https://github.com/eyaltoledano/claude-task-master; `parse-prd` is their front door —
  every tutorial starts by pointing it at a spec file, and their best-practice line is
  "always start with a detailed PRD". We have no equivalent: our intake flow weighs a
  source as evidence and is allowed to drop parts of it.
