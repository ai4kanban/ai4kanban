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
- Store the board's own configuration in the workspace too — its name, tracks, modules, and
  per-flow rules — carried in by import and out by export like the rest of the board.
- Serve whole-board snapshots with a cursor and targeted card refreshes after conflicts.
- Import a Local board only into a new empty workspace and preserve stable IDs and hierarchy.
- Import `record.csv` history as imported events without false member attribution.
- Make import idempotent from a source-board fingerprint and never upload repository history.
- Leave the source board's files exactly as they are: import copies them into the workspace
  and deletes nothing the team committed (#311).
- Export a standalone markdown board; import and export are not ongoing synchronization.
- Keep delivery attempts and frozen final bodies as Cloud state, separate from portable frontmatter.

## Todo
- [ ] Store the complete shared board and its attributed history in Cloud.
- [ ] Store the board's configuration, tracks, modules, and per-flow rules as workspace
      content, and check import and export carry them.
- [ ] Return consistent whole-board snapshots and targeted conflict refreshes.
- [ ] Import a complete Local board into a new workspace without duplicating history, and
      check the source board's files are left untouched.
- [ ] Export a Cloud workspace as a standalone markdown board.
- [ ] Add durable prepared-delivery records and frozen final card bodies.
- [ ] Check that no repository, branch, credential, or model key reaches Cloud.

## Decided by the agent
- **Why board configuration lives in the workspace, not on each machine**: `config.md`,
  `modules.md` and `rules/` are board content. Two members must not run one board under
  different tracks, and a per-flow rule written from one member's board UI has to reach every
  member's runs. #316's clients read them from here.
