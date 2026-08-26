---
title: Handle local task events asynchronously through Cloud
track: features
priority: high
roi: high
status: todo
release: 0.8.0
blocked_by: []
related: [319, 318, 320, 329, 330]
modules: [cloud, local-ui, skill]
questions:
  - question: "[user] Should the publisher in `akb` take #319's Realtime dependency, ending the CLI's published \"Node 18+. No dependencies.\" promise?"
    mode: single
    options:
      - Yes — `akb` gets the same publisher and live connection as the app, so a terminal or agent board change raises an event and a terminal `akb` is woken as the board's server. Every `akb` user moves to Node 22 and one dependency, including those who never turn Cloud on.
      - Send only — `akb` publishes over plain `fetch` and stays dependency-free on Node 18, and the live connection lives in the desktop app alone. A terminal `akb` catches up through the Worker when someone runs a command, so a machine with no app open learns about waiting work only then.
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
  reachable again — the user is told the work is waiting for the server rather than left to
  guess. An always-on background service that keeps the server reachable is a later card.
- **Both actionable states ship, not just ready-for-review**: a user-owned question is
  answerable remotely too, because an unanswered question stalls a card exactly as long as an
  unapproved one. The cost is a second path carried the whole way — asked in two destinations
  and applied on the machine by the existing resolve flow, not only by the delivery flow an
  approval starts; the option it beat was shipping `ready` → **Implement** alone.
- **Slack needs a connected app, not a pasted webhook**: an incoming webhook can post a
  message but cannot carry an authenticated action back, and the action is the whole point of
  this group. The cost is a Slack app to register, connect, and disconnect, against the
  webhook URL an owner pastes that #311 originally settled for.
- **Publication ships with both local writers**: one shared module runs in the desktop app
  and `akb`, so a change made by the app, by the CLI, or by an agent raises the same
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
- #326 landed the identity: the desktop app's Configuration → Cloud section signs in through
  Supabase Auth's GitHub provider and holds the session in a per-user file outside every
  repository, which a terminal `akb` reads as the same account. `akb cloud` reports that
  account and signs out, and `keepAuthorized` in `cli/src/lib/cloud/realtime.ts` hands a
  Realtime client a fresh token for as long as it is connected.
- #326 also landed admission: `requireOwner` in `cloud/src/owner.ts` turns a verified sign-in
  into the `owner.accountId` every later row hangs off, and every route but `GET /v1/session`
  refuses an account that is not admitted. Admission is a hand-written row in
  `cloud.admitted_accounts`, matched on the handle GitHub attests.
- Cloud's schema holds `cloud.accounts` and that list, and still no board, event, delivery,
  action, or server table. The day's write budget stays one counter for the whole service
  rather than one per account.
- #331 landed: every board write is awaited, so a caller that returns has a board that settled
  and a publisher has a successful write to hang an event off.
- Nothing local publishes yet — no publisher module, no outbox, no notification center, and no
  Realtime connection. `cli/` carries no runtime dependencies at all, and `cli/package.json`
  and `cli/README.md` promise Node 18 and none; #319 has picked `@supabase/realtime-js`, whose
  Node 22 floor ends both promises wherever it is installed.
- Auto-delivery already builds, reviews, corrects, and lands an approved card from one click,
  entirely locally. This group makes that click reachable from somewhere other than the board.
- #321's privacy and terms pages are live and describe a Cloud that stores a team's board in a
  workspace, read by its members and exported and deleted by an owner. This group stores one
  account's events and stores no board at all, and its Slack is a connected app rather than the
  incoming webhook the privacy page names.
- The Supabase project, its GitHub OAuth app, and the `api.ai4kanban.dev` route are still not
  created: `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `cli/src/lib/cloud/config.ts` are blank,
  every Cloud screen says this build carries no project to sign in against, and
  `cloud/README.md`, "Standing up a new project", is the list a person runs by hand. #319 is
  the first card in this group that cannot be checked without it.

## Scope
- Use Supabase Auth's GitHub OAuth session as the identity shared by the desktop app, `akb`,
  the Worker, private Realtime topics, and connectors.
- Admit only the accounts on the preview's list, and refuse every other verified sign-in with a
  reason a client shows as it stands.
- Turn Cloud on per board, each enabled board watching one open release; one account may have
  several boards on, and every event, request, and server names the board it belongs to.
- Bundle one local publisher module into the desktop app and `akb`; after a successful
  board write it records and sends actionable events from a local outbox.
- Publish actionable local events for a task ready for review and user-owned questions.
- Keep durable event snapshots, delivery attempts, human decisions, and their outcomes in
  Supabase Postgres while the board and repository stay local.
- Show the same events in a desktop notification center and let the user act on them there.
- Turn either decision into one request the board's server runs: an approval of the current
  ready revision starts the existing delivery flow, and an answer starts the existing resolve
  flow.
- Deliver the same events and actions through Slack as the first external connector.
- Show every destination the same decision and the same outcome, read from that one durable
  state rather than from what a connector remembers.
- Authenticate and deduplicate every action, and preserve a task whose state or revision has
  changed.
- Let a local board change succeed while Cloud or Slack is unreachable, and publish it when
  they return.
- Recover from a client that was closed, a server that was killed, and a write that never
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

publish    a successful local board write -> [local publisher, in the desktop app and akb]
           -> [Cloudflare Worker] -> [Supabase Postgres]. The stored id then goes
           out over [Realtime] to the desktop inbox, and [Slack] is delivered from the same
           stored event.

act        the desktop inbox or [Slack] -> [Cloudflare Worker] records one action and one
           execution request -> [Realtime] wakes [the local execution server], which claims the
           request, re-reads the local task, runs the delivery or resolve flow the decision
           asked for, and reports the outcome back through the Worker.
```

## Todo
- [x] Identify the user who sends and acts on Cloud events #326
- [x] Await every board write so events can hang off it #331
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
  it can break them together; and the published pages last, because they describe the shapes
  everything above settles.
- **How many boards one account notifies from**: as many as the user turns on. #326's sign-in
  belongs to the machine and covers every project the app has open, so Cloud is enabled per
  board and each enabled board picks its own release. Binding a machine to one board would
  save a column and silently drop a second project's events.
- **Why #327 is not in this group**: it owns the whole invitation loop — the request button,
  our approval, the emailed code, and the redemption that replaces #326's hand-written row, and
  nothing in the event, action, or execution flow reads it. It still gates the group's last
  card: #327 amends the same published privacy page that #330 rewrites once, so #330 waits
  behind #327 as well as #320, and this group closes after both.
- **What this group took over from #311**: the two things 0.8.0 needs before the first invite
  and #311 was holding for a later release — correcting the published pages (#330, which #311
  had left to #328) and telling a person signing in what Cloud does with their work (#326,
  a slice of #317's onboarding explanation). Everything else there — workspaces, membership,
  roles, shared boards, the export and team routing — stays in #311.
- **Why the page correction is its own card and not a step in #320**: the pages describe a
  workspace, its members, an owner's export and an owner's deletion, so the Slack paragraph is
  one wrong sentence in a section that is wrong throughout. #330 rewrites the section once,
  after #320 settles the last shape it has to describe.
- **Which card applies an answer to the local card**: #318, the same server that runs an
  approval, through the existing resolve flow. #318's Scope names only **Implement** today, so
  the answer request is work its own refine pass has to add; without it every destination can
  ask a question that nothing on the machine ever answers.
- **Whose Slack app the preview connects**: ours, one app, kept unlisted. An invite-only
  preview needs no Slack directory listing, so no app review stands between this group and the
  first invite, and no invited person registers an app of their own.
- **What the board's server authenticates as**: the signed-in user's own session, not a
  credential of its own, because the server is the desktop app or a terminal `akb` on the
  same machine that holds the session file. `notify-plan.md` recommended a separate revocable
  credential; #318 gets revocation instead from disabling a server, which the user can reach.

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
