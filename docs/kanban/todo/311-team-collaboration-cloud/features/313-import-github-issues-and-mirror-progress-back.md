---
title: Import GitHub Issues and mirror progress back
track: features
priority: med
roi: high
status: todo
release: 0.8.0
blocked_by: [312]
related: [311, 250]
modules: [skill, cloud]
questions: []
---

Let communities propose work through GitHub Issues without making GitHub another writable board.

## Scope
- Import an issue through the same intake shape as #250 and create a proposed card.
- Treat issue comments and later edits as suggestions that cannot overwrite the board.
- Mirror useful lifecycle progress back to the issue with comments or labels.
- Use stable links so retries do not create duplicate cards or progress updates.
- Work through the provider contract for both Local and Cloud boards.

## Todo
- [ ] Bring one GitHub Issue into the existing task-intake flow.
- [ ] Keep the board authoritative after import.
- [ ] Mirror selected card progress back to the source issue.
- [ ] Make import and mirroring safe to retry.
- [ ] Check the full loop on a Local board.
- [ ] Check the same loop against a Cloud board once #316 lands.
