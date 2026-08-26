---
title: Handle local task events asynchronously through Cloud
track: features
priority: high
roi: high
status: todo
release: 0.8.0
blocked_by: []
related: [326, 319, 318, 320, 329, 330]
modules: [cloud, local-ui, skill]
questions:
  - question: "[user] Cloud keeps every event, delivery attempt, action and outcome in a free-tier Supabase project with no backups, and no card says for how long one is kept. The published privacy page needs a Data retention line before the first invite goes out. How long does Cloud keep a finished event's history?"
    mode: single
    options:
      - Keep an event until it resolves, then keep the completed history for 30 days — enough to look back over a week's work, and a number the privacy page can state plainly.
      - Keep everything for as long as the preview runs, and revisit it when the free tier fills up — nothing to build now, but the privacy page then promises no deletion at all.
      - Keep active events only, deleting each one as its delivery completes or its question is answered — the least data held, and no history to read after the fact.
    recommend: [1]
---

Let one person leave AI4Kanban running locally and handle its requests for judgment later,
from the desktop inbox or Slack. Today a refined task waits silently at `ready`, so the user
must keep watching the board before local delivery can continue. This is a group task; each
piece is its own subtask in this folder.

## Worth noting
- **Who can use this in 0.8.0**: only an account we admit, on the invite-only terms #311
  settled. 0.8.0 is a public release whose headline is this flow, so most people who download
  it meet a refusal explaining the preview instead of the feature. That cost buys a hosting
  bill that stays at zero while the flow is proven.
- **What happens while the machine is off**: the decision is recorded and waits. Cloud never
  runs the agent, so an approval given at midnight starts nothing until the app or `akb` is
  reachable again — the user is told the work is waiting for the node rather than left to
  guess. An always-on background service that keeps the node reachable is a later card.
- **Both actionable states ship, not just ready-for-review**: a user-owned question is
  answerable remotely too, because an unanswered question stalls a card exactly as long as an
  unapproved one. The cost is a second action shape to build and keep working in two
  destinations; the option it beat was shipping `ready` → **Implement** alone.
- **Slack needs a connected app, not a pasted webhook**: an incoming webhook can post a
  message but cannot carry an authenticated action back, and the action is the whole point of
  this group. The cost is a Slack app to register, connect, and disconnect, against the
  webhook URL an owner pastes that #311 originally settled for.
- **Publication ships with both local writers**: one shared module runs in the desktop board
  server and `akb`, so a change made by the app, by the CLI, or by an agent raises the same
  event. Publishing from the app alone is less to build and misses every board change made in
  a terminal — which is how a coding agent uses the board.
- **The published Cloud pages become this group's**: they describe a team workspace holding a
  shared board, and this group ships neither, so #330 rewrites them for the relay a person is
  actually invited to. #311 wrote them and had kept their correction, but #311 is in no
  release and 0.8.0 invites the first outside person. The cost is that #311 rewrites the same
  section again when a workspace exists.

<!-- agent -->

## Today
- #323 landed: `cloud/` holds the Worker at `api.ai4kanban.dev`, its forward-only Postgres
  migrations, and its deploy, migrate, and lockdown commands. A mutation is one `api` function
  in one transaction, and a refusal is `{ error: { code, message } }` whose `message` is shown
  to a user as it stands.
- The Worker verifies a Supabase session and stops there: any signed-in GitHub account reaches
  `/v1/session` and `/v1/self-check` and spends the day's write budget, because admission was
  #314's and #314 is in no release.
- Cloud's schema holds no account, board, event, action, or node table. `cloud` holds the
  day's write counter and the heartbeat; `api` holds the functions the Worker calls.
- #321's privacy and terms pages are live and describe a Cloud that stores a team's board in a
  workspace, read by its members and exported and deleted by an owner. This group stores one
  account's events and stores no board at all, and its Slack is a connected app rather than the
  incoming webhook the privacy page names.
- Nothing in `cli/`, `kanban-ui/`, or `desktop/` mentions Cloud, a sign-in, or a notification.
  There is no publisher, no outbox, no inbox, and no Realtime connection anywhere local.
- Auto-delivery already builds, reviews, corrects, and lands an approved card from one click,
  entirely locally. This group makes that click reachable from somewhere other than the board.
- The Supabase project, its GitHub OAuth app, and the `api.ai4kanban.dev` route are not created
  yet. `cloud/README.md`, "Standing up a new project", is the list a person runs by hand.

## Scope
- Use Supabase Auth's GitHub OAuth session as the identity shared by the desktop app, `akb`,
  the Worker, private Realtime topics, and connectors.
- Admit only the accounts on the preview's list, and refuse every other verified sign-in with a
  reason a client shows as it stands.
- Turn Cloud on per board, each enabled board watching one open release; one account may have
  several boards on, and every event, request, and node names the board it belongs to.
- Bundle one local publisher module into the desktop board server and `akb`; after a successful
  board write it records and sends actionable events from a local outbox.
- Publish actionable local events for a task ready for review and user-owned questions.
- Keep durable event snapshots, delivery attempts, human decisions, and their outcomes in
  Supabase Postgres while the board and repository stay local.
- Show the same events in a desktop notification center and let the user act on them there.
- Turn approval of the current ready revision into one request for the local execution node.
- Deliver the same events and actions through Slack as the first external connector.
- Show every destination the same decision and the same outcome, read from that one durable
  state rather than from what a connector remembers.
- Authenticate and deduplicate every action, and preserve a task whose state or revision has
  changed.
- Let a local board change succeed while Cloud or Slack is unreachable, and publish it when
  they return.
- Recover from a client that was closed, a node that was killed, and a write that never
  reached its outbox, rather than losing the event or pinning the delivery.
- Delete finished event history on a stated schedule, and say so on the published privacy page.
- Make the published privacy and terms pages describe the preview this group ships — a relay
  for one account's events, not a team's shared board — before the first invitation goes out.
- Tell a person signing in what Cloud does and does not do, and link them to those two pages
  from where they sign in.
- Break the assembled flow on purpose before the first invite goes out, and measure it against
  the free tier it runs on.
- Keep team workspaces, shared Cloud boards, membership, roles, and multi-user coordination
  outside this group.
- Keep an always-on background service, Cloud-hosted execution, approval-free implementation,
  and general task editing from a notification outside this group.

```text
identity   [GitHub OAuth] -> [Supabase Auth] -> one session, held on the machine and shared
           by the desktop app, akb, the Worker (verified against JWKS), and the user's
           private Realtime topics.

publish    a successful local board write -> [local publisher, in the desktop board server
           and akb] -> [Cloudflare Worker] -> [Supabase Postgres]. The stored id then goes
           out over [Realtime] to the desktop inbox, and [Slack] is delivered from the same
           stored event.

act        the desktop inbox or [Slack] -> [Cloudflare Worker] records one action and one
           execution request -> [Realtime] wakes [the local execution node], which claims the
           request, re-reads the local task, runs the existing delivery flow, and reports the
           outcome back through the Worker.
```

## Todo
- [ ] Identify the user who sends and acts on Cloud events #326
- [ ] Sync actionable events through Cloud and show them in the app #319
- [ ] Run local delivery from an approved Cloud action #318
- [ ] Act on Cloud task events from Slack #320
- [ ] Harden the Cloud event flow before the first invite #329
- [ ] Make the published Cloud pages describe what 0.8.0 ships #330

## Decided by the agent
- **Why a group and not one card**: each piece is too large for one run, and none of them is
  worth building without the others.
- **Why this root stays `todo` and never goes `ready`**: it is a tracking card, and a `ready`
  card is offered for delivery. The subtasks carry the status a delivery reads, and the group
  closes itself once the last subtask line is resolved.
- **Why the Todo runs in that order**: identity first, because every later row hangs off an
  account; then events and the desktop center, where the message and action contract is
  proven; then local execution, which consumes an accepted action; then Slack, which
  re-renders a flow that already works; then hardening, which needs all four to exist before
  it can break them together.
- **How many boards one account notifies from**: as many as the user turns on. #326's sign-in
  belongs to the machine and covers every project the app has open, so Cloud is enabled per
  board and each enabled board picks its own release. Binding a machine to one board would
  save a column and silently drop a second project's events.
- **Why #327 is not in this group**: it owns the whole invitation loop — the request button,
  our approval, the emailed code, and the redemption that replaces #326's hand-written row. It
  ships in the same release and sits behind #326, but nothing in the event, action, or
  execution flow reads it, and this group is finished without it.
- **What this group took over from #311**: the two things 0.8.0 needs before the first invite
  and #311 was holding for a later release — correcting the published pages (#330, which #311
  had left to #328) and telling a person signing in what Cloud does with their work (#326,
  a slice of #317's onboarding explanation). Everything else there — workspaces, membership,
  roles, shared boards, the export and team routing — stays in #311.
- **Why the page correction is its own card and not a step in #320**: the pages describe a
  workspace, its members, an owner's export and an owner's deletion, so the Slack paragraph is
  one wrong sentence in a section that is wrong throughout. #330 rewrites the section once,
  after #320 settles the last shape it has to describe.
- **What the execution node authenticates as**: the signed-in user's own session, not a
  credential of its own, because the node is the board UI server or a terminal `akb` on the
  same machine that holds the session file. `notify-plan.md` recommended a separate revocable
  credential; #318 gets revocation instead from disabling a node, which the user can reach.

## Source
- `notify-plan.md` — the full single-user design: each component and its runtime, the
  end-to-end flow, the reliability and security rules, the user-visible states, and the
  delivery order this Todo follows.
- #311 and `docs/kanban/memory/cloud/decisions.md` — the invite-only preview, the Local-first
  default, and what Cloud behaviour 0.8.0 ships.
- #323 — the Worker, its schema, and the Supabase sign-in it verifies.
- #321 — the published privacy and terms pages, which the retention answer amends.
- #327 — the invite request, the invitation code, and the mail, shipping in 0.8.0 beside this
  group.
- #314 — the workspaces, roles, and shared boards this group's single-account record
  deliberately does not become.
