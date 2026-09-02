# AI4Kanban Cloud service

The one service every Cloud workspace runs on: a Cloudflare Worker at `api.ai4kanban.dev`
in front of a Supabase Postgres project. It holds the workspace a Cloud board lives in, the
ids that board runs on, and the one transaction every change to it goes through. Members and
roles are not here — they are #376's, and #314 left the authorization check in one place for
them to change.

```
cloud/
├── src/            the Worker — `owner.ts` is the check every route applies
├── migrations/     the schema, one numbered file per change, applied forward only
├── scripts/        migrate, the closed-database check, and the schema checks
├── test/           the Worker's own checks; test/sql/ is the schema's, run against a real
│                   PostgreSQL rather than a fake — both run by `npm test`
└── wrangler.jsonc  the route, the schedule, and nothing secret
```

## How it fits together

- **The Worker is the only caller**: it reaches Postgres over HTTPS through PostgREST, so a
  mutation is one function call and one transaction — check, apply and audit either all land
  or none do.
- **The database is not a client API**: `cloud` holds the data and is served to nobody,
  `api` holds the functions the Worker calls and is the one schema PostgREST serves, and
  neither grants a thing to `anon` or `authenticated`. A caller that is not the Worker is
  refused at the schema, so a later migration cannot leak a table or a function by
  forgetting a grant. `npm run check:closed` proves it from outside, and the project's keys
  never leave the Worker.
- **Sign-in is verified, never issued here**: Supabase Auth signs sessions with an asymmetric
  key and the Worker checks them against the project's JWKS. There is no shared signing
  secret to hold or leak.
- **A workspace is one board, and one account's**: it holds the cards, the execution nodes
  registered to run its work, the operation ledger and the audit trail, all under ids this
  service allocates — except a card's, which stays the small integer the board already calls
  it by. `cloud.workspace_for` is the whole of its authorization, in one place, and a
  workspace that is not the caller's and one that has been deleted meet the same refusal: no
  client has to tell "gone" from "not yours", and nothing leaks whether one ever existed.
- **One transaction per change, and one line of trail per change**: authorization, lifecycle
  rules, operation uniqueness and the expected revision are checked, the change is applied,
  revisions advance and an attributed audit event is appended — all of it or none of it. A
  multi-card write commits whole or changes nothing.
- **One writer at a time per workspace**: every mutation opens by locking the workspace's own
  row, which is what makes the control plane decide the ORDER of two writes and not only
  whether each one is allowed. Without it two clients both read revision 3, both pass the
  expected-revision check, and the second quietly writes over the first; with it the second
  waits, re-reads a revision that has moved, and gets the conflict it should have had. A
  write is a card being saved rather than a keystroke, so that is a board's own pace. #375's
  per-card lease narrows this rather than adding it.
- **A retried attempt answers once**: a client mints one `opId` per attempt (#312), and the
  workspace's operation ledger holds what the first one did. The same id carrying the same
  words gets that answer back; the same id carrying different words is refused rather than
  answered with somebody else's outcome. Only an attempt that COMMITTED is on record — a
  conflict and a refusal write nothing, so there is nothing to answer again with and a
  refused write costs the day's budget nothing.
- **A conflict is its own refusal**: `revision_conflict` carries `current`, the revision the
  resource holds now, so a client re-reads that one card rather than the whole board.
- **A workspace holds the board, not only its cards**: the memory set, `config.md`,
  `modules.md`, `releases.md`, the per-flow rules, the archive, closed releases' summaries,
  the board's own history and its delivery records all live here too (#315), each under the
  path it is written back to — so an export is a file-for-file restore and nothing has to
  invent a name on either side. What stays on the machine is what the board keeps out of git:
  the API keys, the run record and its logs, the chats, the mockups, and `ui.config.json`,
  which is that machine's own answer to which coding agent runs the board.
- **Nothing about the code is here**: no repository, branch, worktree, commit, credential or
  model key, on any path. A delivery's repository half is stripped by
  `cloud.portable_delivery` in the database rather than trusted to the client that sent it,
  which is what makes it a property of the store instead of a promise somebody forgets.
- **One writer per card, on a lease**: the row lock above decides the order of two writes that
  arrive together; it can decide nothing about two writes minutes apart, which is what a
  person editing a card actually is. So a card — or the board, for what is not one card — is
  held by one lease at a time on a 30-minute lease. Nothing sweeps: an expired lock is free
  for the next caller. The holder is the lease id and not the account, because one account on
  two machines is already two writers. The revision check stays behind it: a lease that runs
  out under a long run still lets a second writer in, and the stale upload is then refused as
  a conflict — which is what makes "never a silent overwrite" true rather than likely.
- **A stale writer is told what changed; a current one is told who is holding it**: the
  expected revision is checked before the lock, so a machine coming back with words written
  against a version the board has moved past is told to re-read that card, not to wait.
- **The trail is immutable**: an audit event is never rewritten, and the only thing that
  removes one is the workspace being deleted. A trigger on the table says so, so a later
  migration cannot quietly make it a suggestion.
- **Deleting a workspace takes everything in it, inside the call**: cards, execution nodes,
  the ledger, the delivery attempts and the trail. No grace window, no deleted-but-answering
  state, no backups to restore from — the owner's export is the only copy anyone has. It is
  deliberately outside the daily write budget: somebody removing their own data must never be
  refused for a reason that is about how busy the service was today.
- **One owner check, applied by every route**: `src/owner.ts` turns a verified sign-in into
  an account (`cloud.accounts`), refuses one we have not admitted, and hands the route an
  `owner.accountId` to hang its rows off. Two routes are open before admission — the one that
  reports the session, so the app can name the account it refused, and the one it asks for an
  invite on.
- **The trusted handle comes from the provider, not from a token**: the `api` function reads
  `auth.identities`, which Auth rewrites on every sign-in. A token carries only
  `user_metadata`, which the account holder can rewrite through Auth, so neither admission
  nor a Slack link may read a handle from one.
- **One list admits an account, and it holds two kinds of row**: a hand-written row names a
  handle and is matched on it, and an approval writes a row keyed on the sign-in subject the
  request carried, because GitHub lets a handle be given up and taken by somebody else. So a
  rename never un-admits somebody we approved, and never hands their place to whoever takes
  the name.
- **One schedule serves the whole service**: an hourly run touches the database, which is
  what keeps a free Supabase project from pausing after a quiet week. It also sweeps finished
  events, drops operation records past their retention, and retries mail.
- **Slack is a connected app, and every message is written from here**: a workspace grants
  the Worker a bot token, which never leaves it, so no Slack credential reaches a checkout
  and a message keeps moving while the board's machine is off. A press comes back signed by
  Slack; the workspace and the Slack user together say whose account it is, and the press is
  recorded through the same `record_event_action` a click in the app calls.
- **Lark is two platforms, and the same shape**: 飞书 and Lark international list separate
  apps, so a connection records which cloud it came from and the Worker posts on that cloud's
  own host. Posting uses a token minted per tenant from the `app_ticket` the platform pushes,
  held and renewed here; a press comes back encrypted and signed under the app's Encrypt Key,
  and the cloud, the tenant and the Lark user together say whose account it is.
- **A second connector is a second implementation, not a second copy**: the nine state names
  and how far a card's own words are cut are `src/message.ts`'s, the delivery loop is
  `src/deliver.ts`'s, and the due-message query is `api.connector_jobs`. Each connector adds
  only its own markup, its own controls and its own API calls.
- **One event, one message**: the delivery record holds the id the chat answered with — the
  event's own message in Lark, its one line in the thread in Slack — and an event that has one
  is never given a second. `api.connector_jobs` decides what is owed by comparing when the
  event last changed against the version its message is showing, so keeping a chat in step
  with a card needs no flag anybody has to set.
- **The top message is the card, and the thread is its log** (Slack): one message per card per
  destination, drawn from the card's NEWEST event and rewritten whenever that moves — and the
  one place **Implement**, a question's options and **Answer** are offered, however long the
  thread grows. Under it goes one reply per event, one line each, written once and never
  edited: the chat's own timestamp is when it happened. Where that message is is stored per
  board, task and connector in `cloud.card_messages`, recorded the moment the chat answers,
  and swept with the card's events.
- **A delivery that did not land says why, where the card cannot take it back** (Slack): the
  top message shows where the card stands NOW, so a refusal it is showing is gone the second
  the board raises the card again — under a minute, in practice, and the reason is the one
  thing in a chat somebody has to act on. So `failed`, `cancelled` and `interrupted` each
  leave a reply of their own carrying it, held in `event_deliveries.ended_ref` so a retry an
  hour later logs nothing twice. `completed` leaves none: nothing follows a delivery that
  landed, so the top message goes on saying it landed.
- **One card, one 话题** (Lark, until #360): every message but a card's earliest is a reply
  inside that one's topic. Nothing per-card is stored for it — `api.connector_jobs` reads the
  root back out of the delivery rows already kept — so the sweep taking a card's last message
  is a card that starts a second topic. Lark opens a topic in group chats only, so its direct
  message keeps a card per event.
- **A Lark reference names the chat, and a reply names the person**: Lark's reply endpoint
  takes no destination, so a message id alone would let a root left in a chat the account has
  moved away from be replied to. The delivery reference records `<destination>:<message_id>`
  and only a reference from the chat this connection posts to now can be a root. A topic reply
  subscribes nobody, so one still asking for a decision carries an `<at>` on the account the
  connection was made under.
- **A decision anywhere redraws everywhere**: an account may have Slack and Lark connected at
  once, and the first press settles the event. `src/redraw.ts` rewrites every connector's
  message the moment one is acted on, so the other does not go on offering a decision until
  the hourly run notices.
- **A private topic names the account, and the policy checks nothing else**: `account:<id>`
  and `server:<id>:<server>` are guarded by RLS policies on `realtime.messages`, which
  Realtime evaluates as `authenticated` — a role this project deliberately gives no access to
  the `cloud` schema. A policy that reads a table therefore does not answer false, it raises,
  and one raising policy refuses every read of that table. So a policy here may use
  `auth.uid()` and the topic string and nothing more (`migrations/0007`).
- **Mail goes out at once, and the run is the retry**: `/v1/invite-request` sends its own
  notice through `waitUntil`, so nobody waits on the top of the hour and the response still
  never waits on Resend. The hourly run picks up what is left — a send the provider refused,
  and an approval written in the SQL editor, where no Worker was in flight to send it. Either
  way the mail key never leaves the Worker and a failed send is retried rather than lost.
  **Admission never waits on any of it**: approving admits the account there and then, so a
  message that never lands costs the person the news and nothing else.

## Endpoints

- `GET /health` — liveness. Reaches nothing, so it stays honest while the database is
  read-only.
- `GET /v1/session` — the caller's verified identity. Needs `Authorization: Bearer <token>`.
- `POST /v1/invite-request` — record that this account asked for an invite. Open to a verified
  sign-in that is **not** admitted. Pressing it again returns the request already open. It is
  the only route open before admission besides the session, because approving is the whole of
  the answer — there is nothing for the person to send back.
- `POST /v1/self-check` — one budgeted write through the path every mutation uses. Needs the
  same bearer token **and an admitted account**; run it after a deploy.

The workspace a Cloud board lives in (#314), all behind the same bearer token and an admitted
account. A mutation the ledger deduplicates carries `opId`, the attempt it is, and may carry
`nodeId`, the machine it was made from; a card write also carries `expect`, the revision it
read. The four that carry no `opId` are the ones that repeat safely without one — making a
workspace, deleting it, and a node registering or renewing.

- `POST /v1/workspaces` — make one. `{ "name": "…", "opId": "…" }`; the `opId` is optional,
  because the ledger that would deduplicate it lives inside the workspace this call is
  making — the workspace row carries it instead.
- `GET /v1/workspaces` — the caller's own.
- `GET /v1/workspaces/<id>` — one, and the revision the board reads at now.
- `POST /v1/workspaces/<id>/rename` — `{ "opId": "…", "expect": "…", "name": "…" }`.
- `POST /v1/workspaces/<id>/delete` — the workspace and everything in it, at once. The
  confirmation is the caller's; #317 is what asks a person whether they mean it.
- `GET /v1/workspaces/<id>/cards` — every card, each with its own revision.
- `POST /v1/workspaces/<id>/cards` — write one card or many, in one transaction:
  `{ "opId": "…", "nodeId": "…", "cards": [{ "id": 7, "expect": "3", "data": { … } }] }`. An
  entry naming no `id` is given the next number the board has free; one naming an id the
  workspace does not hold keeps that number, which is what lets an import carry a board's own
  numbering in unchanged. `expect: ""` is what a card that does not exist yet reads as.
- `GET /v1/workspaces/<id>/audit?limit=N` — the trail, newest first.
- `GET|POST /v1/workspaces/<id>/nodes` — the machines registered to run this workspace's
  work, and registering the one calling: `{ "machineId": "…", "machineName": "…",
  "runtimes": [ … ] }`. Idempotent on the machine id.
- `POST /v1/workspaces/<id>/nodes/<node>/rename` — `{ "opId": "…", "name": "…" }`. The name is
  the owner's, so registering again never takes it back.
- `POST /v1/workspaces/<id>/nodes/<node>/remove` — take the machine off. Its next renewal,
  write and delivery confirmation are all refused.
- `POST /v1/workspaces/<id>/nodes/<node>/renew` — the node saying it is still there.
- `GET /v1/workspaces/<id>/cards/<card>` — one card. What a `revision_conflict` is re-read
  through: the refusal names the card whose revision moved, never the whole board.
- `GET /v1/workspaces/<id>/snapshot` — the live board under one cursor: the workspace, its
  live cards, and the documents somebody is working on. What a screen hydrates from. It leaves
  out what grows with the board's whole past — the archive, the trail and delivery records —
  which are read on demand.
- `GET /v1/workspaces/<id>/archive` — the cards that have left the board.
- `GET|POST /v1/workspaces/<id>/documents` — every board file that is not a card, under the
  path it is written back to: `config.md`, `modules.md`, `releases.md`, `todo/README.md`, the
  memory set, the per-flow rules in `rules/`, closed releases' summaries and the daily tally.
  A write is `{ "opId": "…", "lease": "…", "documents": [{ "path": "rules/revise.md", "kind":
  "rule", "expect": "3", "body": "…" }] }`; a body of `""` deletes the document, because that
  is what an empty per-flow rule means on a Local board. `?kind=` filters the read to one of
  `config`, `memory`, `rule`, `summary`, `history`.
- `GET|POST /v1/workspaces/<id>/locks` — the writer locks this workspace has out, and taking
  one: `{ "cardId": 7, "nodeId": "…", "lease": "…" }`. No `cardId` is the board's own lock,
  which covers what is not one card. It answers with the lease it was granted under and the
  revision that resource reads at — what a caller who never read it writes against. Presenting
  the lease again takes it again and moves the expiry; the length is the service's.
- `POST /v1/workspaces/<id>/locks/release` — give one up: `{ "cardId": 7, "lease": "…" }`.
  Silent about a lock this caller does not hold.
- `POST /v1/workspaces/<id>/deliveries` — open a delivery attempt under an id this service
  allocates: `{ "opId": "…", "nodeId": "…", "cardId": 7 }`.
- `GET /v1/workspaces/<id>/deliveries?card=N` — every delivery, or one card's.
- `POST /v1/workspaces/<id>/deliveries/<delivery>/confirm` — how it ended:
  `{ "opId": "…", "nodeId": "…", "outcome": "completed" | "failed" | "cancelled" }`.
- `POST /v1/workspaces/<id>/deliveries/<delivery>/record` — what it prepared and the bodies it
  froze: `{ "opId": "…", "record": { … }, "approved": "…", "finalBody": "…" }`. The record's
  repository half — the base commit, the branches, the worktree, the commit it landed as and
  the path a review's diff was written to — is stripped **by the database**, not by whatever
  sent it.

Moving a board in, and taking it back out (#315). A board arrives through the ordinary card,
document and delivery writers; what is here is the two things those cannot do themselves —
refuse to write over a workspace somebody is already using, and carry a board's history
without doubling it on a retry.

- `POST /v1/workspaces/<id>/import/begin` — claim a new workspace for one source board:
  `{ "opId": "…", "fingerprint": "…" }`. A workspace that already holds a board is refused
  with `board_not_empty` unless it holds **this** one, in which case it answers
  `resuming: true` and what it already holds — so an import that lost a reply or was stopped
  halfway carries on rather than writing a second copy.
- `POST /v1/workspaces/<id>/import/events` — the source board's own history, up to 500 rows a
  pass: `{ "opId": "…", "events": [{ "key": "17", "at": "2026-04-02", "action":
  "card-archived", "cardId": 3, "detail": { … } }] }`. Each row keeps its own date and carries
  no account and no handle — nobody in this service did it. `key` is the row's own identity,
  so a retried pass finds its own work.
- `POST /v1/workspaces/<id>/import/deliveries` — the finished deliveries, arriving whole
  rather than through the open-and-confirm pair a live one goes through. Idempotent on
  `sourceId`, the id the source board gave each of them.
- `POST /v1/workspaces/<id>/import/finish` — `{ "opId": "…", "nextCardId": 400 }`, so the first
  card written after an import carries on where the source board left off.
- `GET /v1/workspaces/<id>/export` — everything a standalone markdown board is made of: the
  workspace's numbering, every card live and archived, every document and every delivery.
- `GET /v1/workspaces/<id>/export/events?after=N&limit=N` — the trail in the order it happened.
  The one part of a board with no natural bound, so the one part that pages.

Import is not synchronization, and neither is export: neither keeps two writable boards in
step. `akb cloud import <workspace>` and `akb cloud export <workspace> --to <folder>` are the
two halves from a terminal.

Slack (#320), all but the last two behind the same bearer token:

- `POST /v1/slack/install` — the consent screen to open, with the nonce that makes the
  redirect this account's.
- `GET /v1/slack/connection` — what the Configuration pane draws. Never the bot token.
- `GET /v1/slack/conversations` — the channels the app can reach, and the direct message with
  whoever connected.
- `POST /v1/slack/destination` — `{ "channelId": "…", "channelName": "…" }`.
- `POST /v1/slack/disconnect` — end it, and hand the token back to Slack.
- `GET /v1/slack/installed` — **Slack's** redirect. Carries no sign-in; the nonce is what
  says whose install it is. Ends by sending the browser to `ai4kanban://cloud/slack-connected`.
- `POST /v1/slack/actions` — **Slack's** interactivity callback. Carries no sign-in; Slack's
  signature over the raw body and a timestamp inside five minutes are what it is trusted on.
  It answers `200` for everything Slack itself did right — a refused press is said to the
  person ephemerally, because a non-200 tells them the app is broken.

Lark (#351). `<cloud>` is `feishu` or `lark`; the last route names it **before the body is
read**, because an encrypted callback carries nothing readable until the right Encrypt Key has
been chosen. All but the last two behind the same bearer token:

- `POST /v1/lark/<cloud>/connect` — the consent screen to open, with the nonce that makes the
  answer this account's.
- `GET /v1/lark/connection` — what the Configuration pane draws, and which clouds this build
  carries an app for. Never a token.
- `GET /v1/lark/chats` — the group chats the bot is in, and the direct message with whoever
  connected.
- `POST /v1/lark/destination` — `{ "destinationId": "…", "destinationName": "…", "direct": false }`.
- `POST /v1/lark/disconnect` — end it. Nothing is handed back: the tenant's token is the app's,
  and an uninstall in Lark is what ends that.
- `GET /v1/lark/<cloud>/connected` — **Lark's** redirect. Carries no sign-in; the nonce is what
  says whose connection it is. Ends by sending the browser to `ai4kanban://cloud/lark-connected`.
- `POST /v1/lark/<cloud>/callback` — **Lark's** callback: the URL challenge, the `app_ticket`
  push and every press. Carries no sign-in; the body is encrypted under the app's Encrypt Key
  and signed over the timestamp, the nonce, that key and the raw body, inside five minutes. It
  answers `200` for everything Lark itself did right — a refused press is said to the person
  in a toast, because a non-200 tells them the app is broken.

Both connectors' link buttons:

- `GET /card/<board>/<task>` — the http half of `ai4kanban://card/…`, which is all a link
  button in either chat will take. One redirect, no lookup.

A refusal is always `{ "error": { "code": ..., "message": ... } }`, and `message` is written
to be shown to a user as it stands. The two a client must tell apart:

| Code | Means |
| --- | --- |
| `unauthenticated` | No sign-in, or one that is expired or unreadable. Signing in again fixes it. |
| `not_admitted` | A good sign-in from an account we have not admitted. Signing in again lands on the same refusal, so a client must never answer it with "sign in again". |
| `not_yours` | The request named a row belonging to another account — or a workspace that has been deleted, which answers the same way on purpose. |
| `revision_conflict` | A write against a revision that has moved. Carries `current`, the revision the resource holds now, so the client re-reads that one card and writes again. |
| `operation_reused` | One `opId`, two different changes. A retry carrying the same payload is answered with the first result instead; this is a client reusing an id. |
| `node_removed` | The call came from a machine this workspace no longer runs its work on. |
| `card_locked` | Another writer is holding that card, or the board. Not a conflict: nothing moved under the caller, and re-reading answers the same. Carries `until`, when the lease runs out. |
| `board_not_empty` | An import pointed at a workspace that already holds a board. Retrying lands on the same board; the answer is a new workspace. |
| `slack_unavailable` / `slack_not_connected` | This service carries no Slack app, or this account has connected none. |
| `lark_unavailable` / `lark_not_connected` | This service carries no app for that cloud, or this account has connected no Lark destination. |
| `no_verified_address` | GitHub attests no address for this account, so a request would leave us nowhere to answer. |

`GET /v1/session` answers `200` either way and carries `session.admitted`. When that is
false it also carries `refusal`, the very refusal every other route would give, so the app
shows the service's own words rather than a copy of them.

## Commands

Run these from `cloud/`.

| Command | What it does |
| --- | --- |
| `npm run deploy` | Deploy the Worker, its route and its schedule. |
| `npm run rollback` | Return the Worker to an earlier version. |
| `npm run migrate` | Apply every migration not yet applied. `-- --dry-run` prints the plan. |
| `npm run check:closed` | Check the project answers nobody but the Worker. |
| `npm test` / `npm run typecheck` | The Worker's own checks, then the schema's. |
| `npm run test:sql` | The schema's checks alone, against a throwaway PostgreSQL this makes and removes. Add `-- --project` to run them against the project `SUPABASE_PROJECT_REF` names — a **throwaway** one; never the project a workspace is using. |
| `npm run dev` / `npm run tail` | Run locally against `.dev.vars`; follow the deployed logs. |

## Deploy

1. `npm run migrate` — the schema goes first, so the Worker version being deployed always
   has the tables it expects.
2. `npm run deploy`.
3. `curl https://api.ai4kanban.dev/health`, then `POST /v1/self-check` with an **admitted**
   account's token. An account that is not on the invite list is refused with
   `not_admitted`, which is the check working rather than the deploy failing.

## Roll back

`npm run rollback`, then pick the version to return to. **A rollback returns the Worker, not
the schema.** Migrations run forward only, because reversing a schema while a workspace holds
a team's board is how a preview with no backups loses work it cannot restore. Every migration
must therefore leave the Worker version before it working; if it cannot, ship it in two
deploys.

## Admit an account to the preview

Cloud is an invite-only preview, and the invite list is `cloud.admitted_accounts` — one row
per GitHub handle, matched case-insensitively. Adding a row is neither a deploy nor a
migration: run the SQL in the project's SQL editor, or through `POST
/v1/projects/<ref>/database/query` the way `npm run migrate` does.

```sql
-- admit
insert into cloud.admitted_accounts (handle, note)
values ('neverchanje', 'Tao — 0.8.0 preview')
on conflict (handle) do nothing;

-- who is in
select handle, subject, note, admitted_at from cloud.admitted_accounts order by admitted_at;

-- remove
delete from cloud.admitted_accounts where lower(handle) = lower('neverchanje');
```

A hand-written row leaves `subject` null and is matched on the handle, so a rename un-admits
it — which is the point of naming a handle. An approval fills `subject` in, and that row is
then decided on the subject alone.

Removing a row refuses that account from its next request **by this door only**. It leaves
the `cloud.accounts` row and everything hanging off it exactly where they are.
`cloud.remove_account` below is the one that takes the account with it.

This is the door we admit **ourselves** through, and the one for inviting somebody who never
asked — by hand, with no mail sent. Everybody else comes in by asking (below).

## Answer an invite request

A refused person presses **Request an invite** in the app, which records a row and then mails
the notice to `support@ai4kanban.dev` with the requester as the reply address — within
seconds, not at the top of the hour. The **record**, not the mail, is what an answer is
written from, so a notice Resend refused is one the next hourly run sends again.

Approving is one statement, and it is the whole of getting in. It admits the account against
the sign-in subject the request carried, closes the request, and queues one message telling
the person they are in — nothing is typed back, and no mail credential reaches whoever
approves. The admission does not wait on that message: it is SQL rather than a route, so the
mail really does wait for the hour, and the account is in either way.

`npm run invite` runs the common three from a shell, against the project named by
`SUPABASE_PROJECT_REF` and `SUPABASE_ACCESS_TOKEN`:

```sh
npm run invite                       # who is waiting
npm run invite approve neverchanje   # admit them; the next hourly run mails the news
npm run invite approved              # who we approved, and where their message got to
```

`approved` is how a dead address shows up: a row with `approval_error` set, or with attempts
climbing and `approval_sent_at` still empty, is somebody who is in and has not been told.

The list holds one row per handle, so approving a handle another account is already admitted
under is refused rather than admitted for nobody. That happens when somebody we let in
renamed and a second person took the name: give the old admission the handle it goes by now
(`update cloud.admitted_accounts set handle = '<new>' where lower(handle) = lower('<old>')`),
then approve again.

The rest, and the same statements by hand:

```sql
-- who is waiting
select handle, email, requested_at, notified_at, notify_attempts, notify_error
from cloud.invite_requests where closed_at is null order by requested_at;

-- approve one: admits the account, and the next hourly run mails the news
select cloud.approve_invite_request('neverchanje');

-- who we approved, and where their message got to
select handle, email, approved_at, approval_sent_at, approval_attempts, approval_error
from cloud.invite_requests where approved_at is not null order by approved_at desc;

-- remove an admitted account, taking its admission and its request with it
select cloud.remove_account('neverchanje');
```

Inviting somebody who never asked is the hand-written row above, not a statement here. Only
somebody who has signed in can be invited out of the blue, because a hand-written row needs
the handle a sign-in produces; an email-only contact has to install the app and press
**Request an invite** first.

`cloud.remove_account` finds the admission by either name — the handle it was asked under,
for somebody who never signed in again, and the subject of any `cloud.accounts` row the named
handle matches, for somebody who renamed after we let them in. `cloud.accounts.handle` is
deliberately not unique, so check `select id, handle from cloud.accounts where lower(handle) =
lower('…')` first if there is any chance two accounts share one.

Nothing here is reachable over REST: these functions live in `cloud`, which PostgREST serves
to nobody. Run them in the project's SQL editor, the same way an account is admitted above.

## Migrate

- **Add a file**: `migrations/000N_<what-it-does>.sql`, numbered after the last one.
- **Where things go**: tables in `cloud`, functions the Worker calls in `api`. Nothing
  outside `api` is reachable over REST at all, and a table put in `api` would be a second,
  rule-free way into the data.
- **Never edit an applied file**: the command records a checksum and refuses a file that
  changed. Add a new migration instead.
- **Credentials**: `SUPABASE_PROJECT_REF` and `SUPABASE_ACCESS_TOKEN`, in the shell or in
  `cloud/.env`, which is not in git. The token is a personal access token from
  [account/tokens](https://supabase.com/dashboard/account/tokens).

## Rotate a secret

Worker secrets live in Cloudflare's secret store and never in git.

```
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY   # from cloud/
```

The new value is live on the next request; no deploy is needed. To rotate the Supabase
service role key itself: roll it in the Supabase dashboard, put the new value in with the
command above, then `curl https://api.ai4kanban.dev/health` and run `POST /v1/self-check`.
The secrets the Worker holds are `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`RESEND_API_KEY`, Slack's three and each Lark cloud's three; `.dev.vars.example` lists them
for local runs. `RESEND_API_KEY` is
deliberately not required at startup: a Worker that cannot mail still answers every route,
and the hourly run logs `RESEND_API_KEY is not set — nothing sent` rather than the whole
service refusing requests over a secret only the schedule needs.

## Limits the preview lives inside

- **The Worker's own daily write budget** — `DAILY_WRITE_BUDGET` in `src/config.ts`, counted
  in the database inside each mutation's transaction. Past it a write is refused with
  `daily_write_budget_reached` and the counter is rolled back with it, so a refusal costs
  nothing and writes stop at exactly the budget. Changing the number is a deploy, not a
  migration.
- **The database's own size limit** — past 500 MB a Supabase Free project turns read-only.
  That reaches the client as `storage_limit_reached`, never as a conflict or a generic
  failure.
- **The scheduled run is outside the budget** — 24 rows a day, and a busy day must not switch
  off the thing keeping the project awake. The mail it sends is outside it for the same
  reason: a busy day must not hold an answer back.
- **A send is given up on after five attempts** — `MAIL_MAX_ATTEMPTS` in `src/config.ts`. Past
  that the record keeps its last error and stops being mailed every hour forever, so a dead
  address is something the queries above can see.
- **A machine that gives up on sending says so and stops** — a board retries a failed send
  eight times over just under four hours (`MAX_ATTEMPTS` in `cli/src/lib/cloud/publish.ts`). Past
  that a publication is raised again by the next board write, but an **action or an outcome
  is queued once and by nobody else**, so it is not re-sent: the bell says "Cloud is out of
  step" and the row on Cloud stays where it was. The board on that machine is the one that is
  right, and a person is what reconciles them.
- **The schema's checks stand up a Supabase surface rather than using one** —
  `npm run test:sql` gives the migrations the `auth` and `realtime` pieces they lean on
  (`test/sql/supabase.sql`) and runs everything else for real. What it cannot answer is
  whether Realtime itself, Auth itself and PostgREST behave as those stand-ins do; that is
  what `-- --project` against a throwaway project is for, and what the hand-pass over a live
  project covers.
- **The operation ledger is a retry window, not a record** — a workspace's ledger rows are
  dropped after seven days by the hourly run (`api.prune_operations`), which is far past the
  just-under-four-hours a board retries a send for. The audit trail is **not** swept: it goes
  when its workspace does and at no other time.
- **Deleting a workspace is outside the write budget** — like the heartbeat and the sweep.
  Somebody removing their own data must never be refused for a reason that is about how busy
  the service was today.
- **A card write is capped at 200 cards** — `MAX_CARDS_PER_WRITE` in `src/config.ts`. The
  operation commits whole or changes nothing, so this bounds the transaction as well as the
  request; a large import sends the board in passes of that size. A document write is capped
  the same way, and a pass of a board's history at 500 rows.
- **A whole board fits inside one day** — this repository's board (254 cards of which 191 are
  archived, 41 documents, 507 history rows, 52 deliveries, about 2.6 MB) imports for **1,164**
  writes of the day's 20,000, measured by running it through the migrations against a
  throwaway PostgreSQL. A board several times this size still lands in one day.
- **A card is held for 30 minutes at a time** — `CARD_LOCK_SECONDS` in `src/config.ts`, set by
  the service and never by the client. Nothing sweeps: an expired lock is free for the next
  caller, so a machine that died frees the card inside a coffee break without anything running
  to notice.
- **No backups** — Supabase Free keeps none. A workspace export is the only copy anyone can
  restore from.

### How many accounts that carries

Arithmetic from what one account's flow costs, not a measurement — the traffic to measure
only exists once the preview has people in it. Recount it when any of the numbers below
moves.

It covers the NOTIFICATION flow alone: a board kept on a machine, publishing what needs a
person. What a board STORED in a workspace costs is above: one import of a mature board is
about 1,164 writes, and after that a save is two writes per card plus two for the workspace.

**What one card costs, from the board to a finished delivery.** Every budgeted write is a
`cloud.count_write` in `migrations/`; the connector line is one delivery record per event
change **per connected connector**, because a message is rewritten whenever the event moves.
The table counts one connector; an account with both Slack and Lark connected roughly doubles
the `+ 1`s.

| Step | Writes |
| --- | --- |
| Published, and its message | 1 + 1 |
| The card's own message, once — Slack's, until #360 gives Lark one | 1 |
| Each revision before anyone looks | 1 + 1 |
| Decided in the app | 2 + 1 |
| Decided in a chat — the extra one raises the request | 3 + 1 |
| Claimed by the board's server | 1 |
| `running`, and the outcome | (2 + 1) × 2 |
| Each five minutes the delivery runs | 1 |
| An ending that did not land, logged once — Slack's, until #360 gives Lark one | 1 |
| Retired as `stale` instead | 1 + 1 |

So a card decided in a chat, revised twice, with a half-hour delivery, is about **24 writes**
with one connector connected — one more where that delivery did not land.
A card nobody acts on is **5**.

**A day, and a year of them.** Ten cards through and five retired is about **265 writes a
day** for one busy account. Against `DAILY_WRITE_BUDGET`:

- **20,000 ÷ 265 ≈ 75 accounts**, if every one of them is busy every day.
- The largest burst is the **first fill** — turning Cloud on for a board that already holds
  actionable cards costs 3 writes each, so a 200-card board is 600. The publisher sends at
  most 20 items a pass (`SEND_PER_PASS` in `cli/src/lib/cloud/publish.ts`), so it spreads over
  minutes rather than arriving at once, but the day's total is unchanged: **invite in batches
  of a few, not twenty at a time**, or one afternoon of first fills spends the day's budget.

**Storage.** An event carries a bounded snapshot — 4,000 characters of summary and 4,000 of
notes at most, plus the questions — so a row and everything hanging off it is about **3 KB
typically and 15 KB at the ceiling**. Events are kept 30 days past their outcome, so a busy
account holds ~450 of them: **1.4 MB typically, 6.8 MB at the ceiling**. Leaving half of
Supabase Free's 500 MB for indexes, WAL and the `auth` schema:

- **250 MB ÷ 1.4 MB ≈ 180 accounts** typically, **÷ 6.8 MB ≈ 37** if every card is a long one.

**The ceiling to invite up to: about 30 accounts.** Writes give out around 75 and storage
around 37 in the worst case, and neither number has any real traffic behind it — 30 leaves
room for both to be wrong. Past it, read `select writes from cloud.daily_writes order by day
desc limit 7` and the project's database size before inviting anybody else.

## Standing up a new project

Only needed once, and again if the project is ever recreated.

1. **Supabase project** — one project, region `eu-central-1` (Frankfurt), holding Cloud's
   board and nothing else. No staging copy: Free allows two active projects per
   organization, and a Cloud workspace is already an isolation boundary, so our own testing
   gets a throwaway workspace instead.
2. **Asymmetric sign-in keys** — in the project's JWT settings, move to an asymmetric signing
   key so `/auth/v1/.well-known/jwks.json` publishes one. The Worker verifies against it.
3. **GitHub OAuth app** — one app, callback
   `https://<project-ref>.supabase.co/auth/v1/callback`. Its client id and secret go into the
   project's GitHub auth provider, not into the Worker. The sign-in asks for **`user:email`
   and nothing else** (`cli/src/lib/cloud/signin.ts`), so every account carries an address
   GitHub itself verified — which is where we answer a request — and the grant still cannot
   read a repository.
4. **The sign-in's return address** — in the project's Auth URL configuration, add
   `ai4kanban://cloud/signed-in` to the redirect allow-list. That is the URL scheme the
   desktop app registers for itself (#326): the board UI server's loopback port is whatever
   the OS handed out at launch, so there is no fixed `http` address to register instead. Set
   the site URL to `https://ai4kanban.dev`.
5. **The client's own two values** — put the project URL and its publishable (anon) key into
   `cli/src/lib/cloud/config.ts`, which is what the app, the board UI server and `akb` sign
   in against. Neither is a secret: PostgREST serves `api` alone and `api` grants nothing to
   `anon` or `authenticated`, which step 8 proves. `AI4KANBAN_SUPABASE_URL`,
   `AI4KANBAN_SUPABASE_ANON_KEY` and `AI4KANBAN_CLOUD_URL` override all three, so a checkout
   can be pointed at a throwaway project without a build.
6. **Worker secrets** — `npx wrangler secret put SUPABASE_URL`,
   `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY`, `npx wrangler secret put
   RESEND_API_KEY`, the Slack app's three from step 11 and each Lark cloud's three from
   step 12.
7. **Exposed schemas** — in the project's API settings, set the exposed schema list to
   `api` alone. Dropping `public` and `graphql_public` is what closes PostgREST and the
   GraphQL endpoint to everyone but the Worker.
8. **Schema** — `npm run migrate`, then `npm run check:closed`.
9. **Route** — `npm run deploy` claims `api.ai4kanban.dev` as a custom domain on the
   Cloudflare account the site deploys from. `cloud.ai4kanban.dev` stays free for the hosted
   browser surface.
10. **The sending domain** — add `ai4kanban.dev` as a domain in Resend and publish the three
    records it gives you: the DKIM `TXT` at `resend._domainkey`, and the return-path `MX` and
    `SPF TXT` on `send`. **Leave the root domain's own MX and SPF alone**: they belong to the
    mailbox that delivers `support@ai4kanban.dev`, and Resend needs neither — it aligns SPF on
    its own return path and DMARC on the DKIM key. Mail goes out as
    `AI4Kanban <invites@ai4kanban.dev>` replying to `support@ai4kanban.dev`
    (`src/config.ts`). Resend's free tier is 3,000 emails a month and 100 a day from one
    verified domain, which is far more than an invite-only preview issues.

11. **Slack app** (#320) — one app at [api.slack.com/apps](https://api.slack.com/apps),
    installed into a workspace by each account rather than by us.
    - **Bot token scopes**: `chat:write`, `chat:write.public`, `im:write`, `channels:read`,
      `groups:read` — the list in `SLACK_SCOPES` (`src/config.ts`). No history scope: the app
      never reads a message, including its own.
    - **Redirect URL**: `https://api.ai4kanban.dev/v1/slack/installed`.
    - **Interactivity request URL**: `https://api.ai4kanban.dev/v1/slack/actions`. Turn
      interactivity on — without it a button carries nothing back, which is the whole point
      of a connected app over a pasted webhook.
    - **Secrets**: `npx wrangler secret put SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` and
      `SLACK_SIGNING_SECRET`. All three are deliberately not required at startup, like the
      mail key: a Worker with no Slack app answers every other route and says plainly that it
      carries none. Without the signing secret **no callback is trusted** — a build that
      cannot verify refuses rather than accepting unchecked.

12. **Lark apps** (#351) — **two** store apps (商店应用), one per cloud, because
    `open.feishu.cn` and `open.larksuite.com` are separate platforms that review separately.
    A tenant installs the app from that cloud's directory; we register nothing per account.
    Both are configured identically apart from their host:
    - **Where**: [open.feishu.cn/app](https://open.feishu.cn/app) and
      [open.larksuite.com/app](https://open.larksuite.com/app). 飞书 grants a listing only
      against a Chinese company registration, which Cloud's operator has to hold first.
    - **Capabilities**: the **bot** capability, on. Without it a message cannot be posted at
      all.
    - **Scopes**: send a message as the app (`im:message:send_as_bot`), list the chats the bot
      is in (`im:chat:readonly`), and read the signed-in person's own identity
      (`contact:user.id:readonly`). No history scope: the app never reads a message, including
      its own.
    - **Redirect URL**: `https://api.ai4kanban.dev/v1/lark/feishu/connected` on 飞书 and
      `https://api.ai4kanban.dev/v1/lark/lark/connected` on Lark international.
    - **Event and callback request URL**: `https://api.ai4kanban.dev/v1/lark/feishu/callback`
      and `.../v1/lark/lark/callback`. Subscribe to the `app_ticket` push and to card
      callbacks. The URL is confirmed once with a challenge, which the route answers.
    - **Encrypt Key**: set one on **both** listings. It is not optional: Lark sends the
      signature and the timestamp that make a replayed callback refusable only under
      encryption, and a build without one accepts no callback rather than accepting them
      unchecked.
    - **Secrets**: `npx wrangler secret put FEISHU_APP_ID`, `FEISHU_APP_SECRET`,
      `FEISHU_ENCRYPT_KEY`, and `LARK_APP_ID`, `LARK_APP_SECRET`, `LARK_ENCRYPT_KEY`. Each set
      is optional on its own: a build carrying one cloud's app offers that one and says so
      where the other's Connect would be.
    - **Listing**: submit each app for review in its own directory. Neither cloud works until
      its own listing is granted, and the release waits on both.

GitHub is the only other service registered here, and it is reached from a member's own
machine with its own grant.
