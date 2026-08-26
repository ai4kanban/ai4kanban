# Asynchronous Cloud task handling — 0.8.0 implementation plan

## Outcome

One person can leave a local board unattended and handle its next request for judgment from
the desktop notification center or Slack. A ready task still requires explicit approval;
after approval, the user's local execution node runs the existing delivery flow.

## Boundaries

- **The board stays local**: Markdown remains authoritative. Cloud never becomes a second
  writable board and never receives the repository.
- **Cloud is an authenticated relay**: it stores event snapshots, connector deliveries,
  human actions, execution requests, and their outcomes for one user.
- **The desktop center is the first destination**: the full message and action flow works
  without Slack, so Slack is not required to build or test the foundation.
- **Slack is the first external connector**: it reuses the same events and actions as the
  desktop center.
- **Execution stays local**: Cloud dispatches approved work; the local node owns agents,
  worktrees, branches, credentials, commits, and merges.
- **Approval targets one revision**: if the local task changed after the message was created,
  the old action cannot start implementation.
- **One action has one effect**: repeated clicks, retries, and duplicate connector callbacks
  cannot create a second delivery.

Team workspaces, shared Cloud boards, membership, roles, imports, exports, and multi-user
conflict handling remain in #311 for a later release.

## Events in 0.8.0

### Ready for review

When refinement leaves a task at `ready`, the local node publishes a review event containing
the task number, title, release, human-readable specification, revision, and allowed actions.

The primary action is **Implement**. It records the human sign-off in Cloud, then creates one
request for the local execution node. Reaching `ready` alone never starts implementation.

### Questions need answers

When a task has user-owned questions, the local node publishes the task context, question
choices, recommendations, revision, and allowed answer action. Agent-owned questions and
ordinary progress do not notify.

## End-to-end flow

1. An app, CLI, or agent operation changes the local board.
2. The local node detects an actionable state and publishes its revisioned event snapshot.
3. Cloud stores one durable event for the authenticated user.
4. The desktop notification center shows the event; connected external connectors receive
   the same event independently.
5. The user reviews the snapshot and takes an explicit action.
6. Cloud authenticates the actor, rejects duplicate or stale actions it can identify, and
   records the decision.
7. The local node claims the action, re-reads the authoritative task, and verifies its state
   and revision.
8. A question action enters the existing local Resolve flow; an **Implement** action enters
   the existing local delivery flow.
9. The node reports the meaningful outcome to Cloud, and each destination updates its
   original message.

Event creation, delivery, human action, and local execution are separate stages. A failure
or retry in one stage cannot duplicate another or block the local mutation that created the
event.

## Delivery order

### 1. Basic user authentication — #326

- Give the desktop app and local execution node one shared Cloud account.
- Scope every event, connector, action, and node to that authenticated user.
- Use a maintained authentication system rather than building password and session security.
- Keep sessions and credentials outside the board and repository.
- Provide the identity boundary an external connector must link to before it may act.

### 2. Cloud events and desktop notification center — #319

- Establish the two event rules, revisioned snapshots, allowed actions, durable history, and
  deduplication.
- Add explicit notification enablement and one open-release selection.
- Add the desktop bell, unread count, newest-first history, complete message context, actions,
  and clear disabled, empty, stale, and failed states.
- Let the user approve implementation and answer questions from the desktop message.
- Prove the complete event and action contract without Slack connected.

### 3. Approved action to local delivery — #318

- Register the user's local execution node.
- Turn one accepted **Implement** action into one claimable request.
- Verify the approved revision against the local authoritative task before starting.
- Run the existing implementation, review, correction, and landing lifecycle.
- Report waiting, running, delivered, failed, and cancelled outcomes without uploading board
  files, repository content, or execution credentials.
- Recover or cancel an interrupted request without starting it twice.

### 4. Interactive Slack connector — #320

- Let the authenticated user connect a Slack destination and link the Slack actor to the
  AI4Kanban account.
- Render the same task context and allowed actions as the desktop notification center.
- Return **Implement** and question answers through the shared Cloud action path.
- Update the original message with accepted, waiting, running, delivered, failed, stale, and
  unauthorized outcomes.
- Retry Slack delivery without duplicating the event, action, or delivery.

### 5. Release hardening

- Check repeated clicks, delayed actions, task changes after message delivery, expired
  sessions, connector retries, disconnected nodes, and interrupted deliveries.
- Check each user can see and act only on their own events.
- Check local task changes continue when Cloud or Slack is unavailable.
- Check Cloud and Slack never receive the repository, task files, or execution credentials.

## Release acceptance

- A task entering `ready` never implements automatically.
- The desktop app shows actionable events without Slack connected.
- Each request and action belongs to one authenticated user.
- A reviewer can understand and approve the exact task revision from either destination.
- One valid **Implement** action creates exactly one local delivery request.
- A changed or non-ready local task cannot be implemented from an old message.
- User-owned questions can be answered remotely with responder attribution.
- Cloud or connector retries do not duplicate events, actions, or deliveries.
- The user can trace an event through decision and local execution outcome.
- Adding another connector does not change event eligibility or task-action semantics.

## Outside 0.8.0

- Shared Cloud boards and team collaboration.
- Skipping human approval or automatically implementing every ready task.
- General-purpose task editing from notifications.
- Cloud-hosted code execution.
- Multiple execution nodes per user and automatic node selection.
- Notifications for ordinary progress, completion, or agent-owned questions.
- External connectors beyond Slack.
