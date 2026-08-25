---
title: Store the shared board in Cloud without moving the codebase
track: features
priority: high
roi: high
status: todo
release: 0.8.0
blocked_by: [314]
related: [311]
modules: [cloud, skill]
questions: []
---

Make Cloud authoritative for the shared board while keeping repositories and git history local.

## Scope
- Store cards, bodies, memory, releases, history, and portable lifecycle fields in Cloud.
- Serve whole-board snapshots with a cursor and targeted card refreshes after conflicts.
- Import a Local board only into a new empty workspace and preserve stable IDs and hierarchy.
- Import `record.csv` history as imported events without false member attribution.
- Make import idempotent from a source-board fingerprint and never upload repository history.
- Export a standalone markdown board; import and export are not ongoing synchronization.
- Keep delivery attempts and frozen final bodies as Cloud state, separate from portable frontmatter.

## Todo
- [ ] Store the complete shared board and its attributed history in Cloud.
- [ ] Return consistent whole-board snapshots and targeted conflict refreshes.
- [ ] Import a complete Local board into a new workspace without duplicating history.
- [ ] Export a Cloud workspace as a standalone markdown board.
- [ ] Add durable prepared-delivery records and frozen final card bodies.
- [ ] Check that no repository, branch, credential, or model key reaches Cloud.
