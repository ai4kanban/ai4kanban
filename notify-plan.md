# Asynchronous Cloud task handling — 0.8.0

## Goal

One person can leave AI4Kanban running locally and review its next actionable event from the
desktop notification center or Slack. A task at `ready` still waits for explicit approval of
its current revision. Cloud records that decision; the local machine executes it.

If the machine is unavailable, the action remains `waiting for server` until AI4Kanban returns.

## Boundaries

- The local Markdown board remains authoritative.
- Cloud receives only the review snapshot needed for a decision; the repository, board files,
  paths, credentials, branches, and worktrees stay on the user's machine.
- Cloud sends actions from a fixed data schema; the local server translates a valid action into
  the existing local flow.
- Cloud is opt-in for one selected open release.
- The desktop notification center proves the flow before Slack is added.
- Slack and the desktop notification center share the same events and actions.
- Team workspaces, roles, shared boards, and Cloud-hosted execution are outside 0.8.0.

## Architecture

| Component | Runtime / deployment | Responsibility |
| --- | --- | --- |
| Local publisher | User's machine; a shared module bundled into the desktop app and `akb` CLI | After a successful board mutation, detect an actionable state, save the publication in a local outbox, and send or retry it independently of the board write. It ships only as local application code. |
| Cloudflare Worker | `api.ai4kanban.dev` | Verify Supabase sessions, enforce admission, ownership, and idempotency, accept actions and server reports, and operate Slack. |
| Supabase Auth | Managed Supabase project | Run GitHub OAuth, issue and refresh user sessions, and provide the JWT identity used by the Worker and private Realtime topics. |
| Supabase Postgres | Same managed Supabase project | Hold durable events, connector deliveries, human actions, execution requests, claims, and outcomes. |
| Supabase Realtime Broadcast | Same managed Supabase project | Deliver private wake-up and state-change hints after durable writes; Postgres remains the durable authority. |
| Desktop notification center | Desktop app on the user's machine | Show review events and outcomes, and send the user's selected action to the Worker. |
| The board's server | The desktop app or `akb` on the machine that holds the board | Catch up, claim one request, validate the local task revision, run the existing flow, and report the outcome. A board attaches exactly one. |

Yes, this design uses Supabase Auth. GitHub sign-in produces the user session; the Worker
verifies its JWT against Supabase's JWKS and applies invite-only admission, while Realtime
uses the same authenticated identity to authorize private topics.

```text
AUTHENTICATION
[GitHub OAuth] -> [Supabase Auth] -> session/JWT -> [Desktop app + akb]
                         |
                         +------ JWKS ------> [Cloudflare Worker]
                         +-- JWT identity --> [Private Realtime topics]

EVENTS AND ACTIONS
USER'S MACHINE                                      CLOUD
[Markdown board]
       |
       +-- successful write --> [Local publisher] -- HTTPS --> [Cloudflare Worker]
                                 (desktop + akb)                   |
                                                                  | durable reads/writes
                                                                  v
                                                        [Supabase Postgres]
                                                                  |
                                                                  | stored IDs
                                                                  v
[Desktop notification center + execution server] <-- hints -- [Realtime Broadcast]
       |
       +---------------- actions / catch-up / claims / reports --> [Cloudflare Worker]

[Cloudflare Worker] <-------- delivery and callbacks --------> [Slack]
```

While running, the desktop keeps one authenticated Realtime connection. On each connection
or reconnection it first reads durable pending work through the Worker, then listens for new
hints. Durable reads, writes, claims, and actions go through the Worker; Realtime carries only
private event and request identifiers.

## Identity and routing

- The Supabase user session identifies the person and authorizes their private Realtime topics.
- Each enabled board gets an opaque Cloud ID mapped to its local path only on that machine.
- Every event and request identifies its account, board, task, revision, and intended server.
- A board attaches exactly one server, which claims execution as the signed-in user's own
  session; revoking it means disabling the server or signing the machine out (#318).
- A Slack actor must be linked to the AI4Kanban account before an action is accepted.

## Events

- **Ready for review**: snapshot of a `ready` task with **Implement** for that exact revision.
- **Question needs an answer**: user-owned question, choices, recommendation, revision, and
  answer action. Whether this remains in 0.8.0 is an open decision below.

New notifications cover the two actionable events above. Execution progress and completion
update the original notification.

## End-to-end flow

1. An app, CLI, or agent operation changes the local board.
2. The local publisher records a pending publication, then sends the revisioned snapshot to
   the Worker. The committed local change and its retriable publication remain independent.
3. The Worker stores or deduplicates the event and its connector-delivery records in one
   transaction.
4. Supabase broadcasts the stored event ID. The desktop refreshes it; Slack delivery starts
   independently.
5. The user acts in the desktop center or Slack.
6. The Worker authenticates the actor and records exactly one action. A local action creates
   exactly one execution request in the same transaction.
7. Supabase broadcasts the request ID to the intended server. Until claimed, it remains
   `waiting for server`.
8. The server claims it, re-reads the local task, and verifies its board, state, and revision.
9. A valid **Implement** enters the existing delivery flow; a retained answer action enters
   the existing Resolve flow.
10. The server renews its claim while running and reports the final outcome. The desktop and
    original Slack message update from that durable state.

## Reliability and security rules

- Reconnect always performs a durable catch-up; missed or reordered broadcasts lose nothing.
- Startup reconciliation finds actionable local states missed between a board write and its
  pending publication.
- Stable IDs make publication, Slack callbacks, actions, claims, and reports idempotent.
- Cloud may reject a revision already known to be stale; the local check is final.
- A lost execution lease becomes `interrupted` or `unknown` and remains bound to that delivery
  because local side effects may already exist.
- The same server may resume the recorded delivery, or the user may cancel it.
- Slack retries its connector delivery under the same stable action and execution IDs.
- Signing out or disabling a server leaves the local board unchanged and stops future claims.

User-visible states are: actionable, accepted, waiting for server, running, completed, failed,
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

Add server attachment and disablement, server wake-up and catch-up, atomic claim, lease renewal,
local revision validation, interruption recovery, and outcome reporting.

### 4. Slack connector — #320

Add Slack connection and actor linking, shared message rendering, signed and replay-safe
callbacks, independent delivery retry, and original-message updates.

### 5. Hardening — #329

Check offline publication, app restarts, reconnect catch-up, duplicate broadcasts and clicks,
stale revisions, expired sessions, disabled servers, Slack retries, interrupted runs, account
isolation, data boundaries, and Supabase free-tier usage.

## Release acceptance

- Entering `ready` creates a review event; explicit approval starts implementation.
- The desktop notification center provides the complete core flow; Slack is an additional
  destination.
- The Worker authorizes every action and the server validates its local revision before work
  starts.
- One valid action creates one durable local request and one local execution.
- Reconnected servers discover waiting work through durable catch-up.
- Revision and state checks keep changed or non-actionable tasks unchanged.
- Local changes succeed while Cloud or Slack is unavailable and publish later.
- A lost server leaves one interrupted delivery for explicit resume or cancellation.
- Every destination shows the same decision and meaningful outcome.

## Decisions

1. **Runner lifetime** — settled on #325: the app stays open. A background service is a later
   card.
2. **Question actions** — settled on #325: remote answers ship, because an unanswered question
   stalls a card exactly as long as an unapproved one.
3. **Board scope** — settled on #325: as many boards as the user turns on, each picking its own
   release. The sign-in belongs to the machine, so binding it to one board would silently drop
   a second project's events.
4. **Server credential** — settled on #326: the server uses the signed-in user's session, and
   #318's server disablement is what revokes it.
5. **History retention** — open, on #325. #319 deletes finished history on whatever period is
   chosen and the published privacy page states it.
6. **Slack action shape** — settled on #320: pressing **Implement** in Slack records the
   decision in Cloud on the spot, from wherever the message is read. Opening the desktop app
   instead would leave Slack a message with nothing to press until a board reaches the browser.
7. **What the executing machine is called** — settled on #320: a **server**, attached to one
   board. It replaces "node" everywhere, including the `waiting for server` state.

## Outside 0.8.0

- Shared Cloud boards and team collaboration.
- Approval-free automatic implementation.
- General-purpose task editing from notifications.
- Cloud-hosted execution or automatic routing across several servers.
- An always-on background service unless decision 1 changes.
- External connectors beyond Slack.
