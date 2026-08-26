---
title: Handle local task events asynchronously through Cloud
track: features
priority: high
roi: high
status: todo
release: 0.8.0
blocked_by: []
related: [326, 319, 318, 320]
modules: [cloud, local-ui, skill]
questions: []
---

Let one person leave AI4Kanban running locally and handle its requests for judgment later,
from the desktop inbox or Slack. Today a refined task waits silently at `ready`, so the user
must keep watching the board before local delivery can continue.

## Worth noting
- **The board stays local**: Cloud carries authenticated event snapshots and human actions,
  while the local board remains authoritative and code never leaves the execution node.
- **Approval stays explicit**: reaching `ready` creates a review request; it never starts
  implementation until the user approves that exact task revision.
- **The desktop inbox comes first**: it proves messages and actions without making Slack a
  development or testing dependency; Slack is the first external connector afterward.

<!-- agent -->

## Scope
- Give one user a Cloud identity shared by the desktop app, execution node, and connectors.
- Publish only actionable local events: a task ready for review and user-owned questions.
- Keep durable event snapshots, delivery attempts, human decisions, and their outcomes in
  Cloud without uploading the board or repository.
- Show the same events in a desktop notification center and let the user act on them there.
- Turn approval of the current ready revision into one request for the local execution node.
- Deliver the same events and actions through Slack as the first external connector.
- Reject stale, duplicate, unauthenticated, and unauthorized actions without changing the task.
- Keep team workspaces, shared Cloud boards, membership, roles, and multi-user coordination
  outside this group.

## Todo
- [ ] Identify the user who sends and acts on Cloud events #326
- [ ] Sync actionable events through Cloud and show them in the app #319
- [ ] Run local delivery from an approved Cloud action #318
- [ ] Act on Cloud task events from Slack #320
