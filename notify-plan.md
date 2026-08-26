# Asynchronous Cloud task handling — 0.8.0

## Goal

One person can leave AI4Kanban running locally and review its next actionable event from the
desktop notification center or Slack. A task at `ready` still waits for explicit approval of
its current revision. Cloud records that decision; the local machine executes it.

If the machine is unavailable, the action remains `waiting for node` until AI4Kanban returns.

## Boundaries

- The local Markdown board remains authoritative.
- Cloud receives only the review snapshot needed for a decision, never the repository, board
  files, paths, credentials, branches, or worktrees.
- Cloud sends structured actions, never shell commands, scripts, prompts, or executable data.
- Cloud is opt-in for one selected open release.
- The desktop notification center proves the flow before Slack is added.
- Slack reuses the same events and actions; it has no separate task model.
- Team workspaces, roles, shared boards, and Cloud-hosted execution are outside 0.8.0.

## Architecture

| Component | Responsibility |
| --- | --- |
| Local publisher | Detect actionable board states, keep failed publications locally, and retry without blocking board changes. |
| Cloudflare Worker | Authenticate callers, enforce ownership and idempotency, accept actions and node reports, and operate Slack. |
| Supabase Auth | Existing GitHub sign-in and invite-only admission. Better Auth is not added. |
| Supabase Postgres | Durable events, connector deliveries, human actions, execution requests, claims, and outcomes. |
| Supabase Realtime Broadcast | Private wake-up and state-change hints after durable writes. It is not a queue or authority. |
| Desktop execution node | Catch up, claim one request, validate the local task revision, run the existing flow, and report the outcome. |

There is no continuous HTTPS polling and no Cloudflare Durable Object gateway. The desktop
uses one authenticated Supabase Realtime connection while it is running. On every connection
or reconnection, it reads durable pending work from the Worker before listening for new hints.

Realtime is the only intentional direct app connection to Supabase. It exposes private topic
delivery only; all Cloud reads, writes, claims, and actions remain behind the Worker.

## Identity and routing

- The Supabase user session identifies the person and authorizes their private Realtime topics.
- Each enabled board gets an opaque Cloud ID mapped to its local path only on that machine.
- Every event and request identifies its account, board, task, revision, and intended node.
- A registered node should use a separate revocable credential when claiming execution.
- A Slack actor must be linked to the AI4Kanban account before an action is accepted.

## Events

- **Ready for review**: snapshot of a `ready` task with **Implement** for that exact revision.
- **Question needs an answer**: user-owned question, choices, recommendation, revision, and
  answer action. Whether this remains in 0.8.0 is an open decision below.

Ordinary progress, completion, and agent-owned questions do not create new notifications.
Execution state updates the original notification.

## End-to-end flow

1. An app, CLI, or agent operation changes the local board.
2. The local publisher records a pending publication, then sends the revisioned snapshot to
   the Worker. Cloud failure never rolls back the local change.
3. The Worker stores or deduplicates the event and its connector-delivery records in one
   transaction.
4. Supabase broadcasts the stored event ID. The desktop refreshes it; Slack delivery starts
   independently.
5. The user acts in the desktop center or Slack.
6. The Worker authenticates the actor and records exactly one action. A local action creates
   exactly one execution request in the same transaction.
7. Supabase broadcasts the request ID to the intended node. Until claimed, it remains
   `waiting for node`.
8. The node claims it, re-reads the local task, and verifies its board, state, and revision.
9. A valid **Implement** enters the existing delivery flow; a retained answer action enters
   the existing Resolve flow.
10. The node renews its claim while running and reports the final outcome. The desktop and
    original Slack message update from that durable state.

## Reliability and security rules

- Reconnect always performs a durable catch-up; missed or reordered broadcasts lose nothing.
- Startup reconciliation finds actionable local states missed between a board write and its
  pending publication.
- Stable IDs make publication, Slack callbacks, actions, claims, and reports idempotent.
- Cloud may reject a revision already known to be stale; the local check is final.
- A lost execution lease becomes `interrupted` or `unknown`. It is not automatically assigned
  elsewhere because local side effects may already exist.
- The same node may resume the recorded delivery, or the user may cancel it.
- Slack retries only its connector delivery; it cannot duplicate the action or execution.
- Signing out or disabling a node prevents new claims without changing the local board.

User-visible states are: actionable, accepted, waiting for node, running, completed, failed,
stale, cancelled, and interrupted.

## Delivery order

### 1. Account and admission — #326

Finish Supabase sign-in, invite-only admission, machine session refresh, account UI, and the
owner check reused by every later route.

### 2. Events and desktop center — #319

Add board registration, event snapshots, local publication recovery, durable history,
deduplication, private Realtime topics, reconnect catch-up, and the connector-neutral desktop
notification center.

### 3. Local action execution — #318

Add node registration and disablement, node wake-up and catch-up, atomic claim, lease renewal,
local revision validation, interruption recovery, and outcome reporting.

### 4. Slack connector — #320

Add Slack connection and actor linking, shared message rendering, signed and replay-safe
callbacks, independent delivery retry, and original-message updates.

### 5. Hardening

Check offline publication, app restarts, reconnect catch-up, duplicate broadcasts and clicks,
stale revisions, expired sessions, disabled nodes, Slack retries, interrupted runs, account
isolation, data boundaries, and Supabase free-tier usage.

## Release acceptance

- Entering `ready` never starts implementation.
- The desktop flow works without Slack.
- Realtime messages alone cannot authorize or start work.
- One valid action creates one durable local request and one local execution.
- Offline nodes discover waiting work after reconnecting without continuous polling.
- Old messages cannot mutate a changed or non-actionable task.
- Local changes succeed while Cloud or Slack is unavailable and publish later.
- A lost node never causes automatic duplicate execution.
- Every destination shows the same decision and meaningful outcome.

## Decisions needed

1. **Runner lifetime**: require the desktop app to remain open, or add an OS background
   service? Recommended for 0.8.0: app open; otherwise add a separate card.
2. **Question actions**: ship remote answers or only ready → implement? Recommended for a
   tighter 0.8.0: defer remote answers and remove them from #319 and #320.
3. **Board scope**: one enabled board and release per machine, or several? Recommended for
   0.8.0: one.
4. **Node credential**: #326 currently gives the node the user session. Recommended: use the
   user session for Realtime, but a separate revocable credential for execution claims.
5. **History retention**: recommended: keep active events until resolved and completed history
   for 30 days.

## Outside 0.8.0

- Shared Cloud boards and team collaboration.
- Automatic implementation without human approval.
- General-purpose task editing from notifications.
- Cloud-hosted execution or automatic routing across several nodes.
- An always-on background service unless decision 1 changes.
- External connectors beyond Slack.
