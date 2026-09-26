# AI4Kanban Cloud service

The service every Cloud workspace runs on: a Cloudflare Worker at `api.ai4kanban.dev` in front
of a Supabase Postgres project. It holds the workspaces Cloud boards live in, and every change
to one goes through a single transaction.

```
cloud/
├── src/            the Worker — routing in `index.ts`, the admission check in `owner.ts`,
│                   limits and constants in `config.ts`
├── migrations/     the schema, one numbered file per change, applied forward only
├── scripts/        migrate, invite, redirects, the closed-database check, the schema checks
├── test/           the Worker's checks; test/sql/ is the schema's, run on a real PostgreSQL
├── endpoints.md    every route, its body, and the refusal codes
└── wrangler.jsonc  the route, the hourly schedule, and nothing secret
```

## How it fits together

- **The Worker is the only caller**: it reaches Postgres through PostgREST, and each mutation
  is one `api` function call — authorization, lifecycle checks, the expected revision, the
  change and its audit event commit together or not at all.
- **The database is not a client API**: tables live in `cloud`, which PostgREST serves to
  nobody; functions the Worker calls live in `api`, the only exposed schema. Neither grants
  anything to `anon` or `authenticated`. `npm run check:closed` proves it from outside.
- **Sign-in is verified, never issued**: Supabase Auth signs sessions with an asymmetric key;
  the Worker checks them against the project's JWKS. There is no shared signing secret.
- **Admission is one check in one place**: `src/owner.ts` turns a verified sign-in into a
  `cloud.accounts` row and refuses an account not in `cloud.admitted_accounts`. Only
  `/v1/session` and `/v1/invite-request` are open before admission.
- **The GitHub handle comes from `auth.identities`, never from a token**: a token's
  `user_metadata` is writable by its holder.
- **Authorization is `cloud.workspace_for`**: it answers the workspace's members, and treats a
  deleted workspace like one the caller is not in. Owner-only moves (rename, members, nodes,
  delete) add `cloud.require_workspace_owner`. There are two roles and no per-card permissions.
- **Writes are ordered and never silently overwrite**: each mutation locks the workspace row
  first; a card write carries the revision it read and a stale one gets `revision_conflict`.
  A card (or the board) is also held by one 30-minute lease at a time, checked after the
  revision. Nothing sweeps expired leases.
- **A retry answers once**: the client mints one `opId` per attempt and the workspace's
  operation ledger replays the committed answer. Refusals write nothing to the ledger.
- **The trail is immutable**: a trigger forbids rewriting an audit event; only deleting the
  workspace removes it. Deleting a workspace removes everything in it immediately — there is
  no grace period and no backup.
- **No code or credentials are stored**: no repository, branch, worktree, commit or model key.
  A delivery record's repository half is stripped by `cloud.portable_delivery` in the database.
- **A workspace holds the whole board**: cards, `config.md`, `modules.md`, `releases.md`,
  memory, per-flow rules, archive, summaries, history and delivery records, each under the
  path it exports to. API keys, run records, chats, mockups and `ui.config.json` stay local.
- **Browsers read less**: `/read` serves `../cloud-ui/` only the name, live cards and four
  config documents, and opens no write path.
- **Events are addressed, not stored per person**: `cloud.event_audience` resolves who an event
  is for at read time, filtered by each member's watch in `cloud.workspace_watches`.
  `api.connector_jobs` collapses that audience onto chat destinations, so one channel gets one
  message however many members read it.
- **A decision runs on the decider's machine**: `event_requests.actor_id` names the member, and
  only their machines may claim it.
- **Connectors share one pipeline**: state names and text limits are in `src/message.ts`, the
  delivery loop in `src/deliver.ts`, and `src/redraw.ts` redraws every connector's message
  when one is pressed. Slack and Lark each add only markup, controls and API calls.
- **Realtime policies may read nothing but `auth.uid()` and the topic**: Realtime evaluates
  them as `authenticated`, which cannot read `cloud`, so a policy that reads a table raises and
  refuses every read (`migrations/0007_private_topics.sql`).
- **One hourly schedule**: it keeps the free Supabase project awake, sweeps finished events
  (kept 30 days) and ledger rows (kept 7 days, `api.prune_operations`), and retries mail.
- **Mail never blocks anything**: sends go through `waitUntil` and failures are retried by the
  hourly run. Admission never waits on mail.

## Run it locally

```sh
npm install
cp .dev.vars.example .dev.vars   # fill in; never commit either file
npm run dev
```

`.dev.vars.example` lists every secret and which are optional. Mail, Slack and Lark are
optional: without them every other route still answers. To point `akb` or the app at a
throwaway project, set `AI4KANBAN_SUPABASE_URL`, `AI4KANBAN_SUPABASE_ANON_KEY` and
`AI4KANBAN_CLOUD_URL`.

## Commands

Run these from `cloud/`.

| Command | What it does |
| --- | --- |
| `npm run dev` / `npm run tail` | Run locally against `.dev.vars`; follow the deployed logs. |
| `npm test` | The Worker's checks, then the schema's. |
| `npm run lint` | Typecheck. |
| `npm run test:sql` | The schema's checks alone, on a throwaway PostgreSQL this makes and removes. |
| `npm run migrate` | Apply every migration not yet applied. `-- --dry-run` prints the plan. |
| `npm run check:closed` | Check the project answers nobody but the Worker. |
| `npm run deploy` / `npm run rollback` | Deploy the Worker, its route and schedule; return to an earlier version. |
| `npm run invite` | List, approve and track invite requests (below). |
| `npm run redirects` | Show the sign-in return addresses; `-- --set` writes them. |
| `npm run preview:slack` | Render every Slack message shape from real events into `.slack-preview/`. |

`npm run test:sql` stands in for Supabase's `auth` and `realtime` (`test/sql/supabase.sql`).
`-- --project` runs the checks against the project in `SUPABASE_PROJECT_REF` instead — **only
ever a throwaway project, never one a workspace is using.**

## Migrate

- **Credentials**: `SUPABASE_PROJECT_REF` and `SUPABASE_ACCESS_TOKEN` (a personal access
  token from [account/tokens](https://supabase.com/dashboard/account/tokens)), in the shell or
  in `cloud/.env`, which is not in git. `invite`, `redirects` and `preview:slack` use the same.
- **Add a file**: `migrations/000N_<what-it-does>.sql`, numbered after the last one. Files
  apply in filename order.
- **Where things go**: tables in `cloud`, Worker-callable functions in `api`. A table in `api`
  would be a rule-free way into the data.
- **Never edit an applied file**: the checksum is recorded and a changed file is refused.
- **Forward only**: there is no down migration and no backup. Every migration must keep the
  currently deployed Worker working; if it cannot, ship it in two deploys.

## Deploy

1. `npm run migrate` — the schema goes first, so the Worker always has the tables it expects.
2. `npm run deploy`.
3. `curl https://api.ai4kanban.dev/health`, then `POST /v1/self-check` with an **admitted**
   account's token. `not_admitted` means the account is not on the list, not a failed deploy.

`npm run rollback` returns the Worker, **not the schema**.

## Rotate a secret

Worker secrets live in Cloudflare's secret store, never in git. From `cloud/`:

```sh
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

The new value is live on the next request. For the service role key: roll it in the Supabase
dashboard, put it, then check `/health` and `/v1/self-check`. The full list is in
`.dev.vars.example`.

## Admit an account to the preview

Cloud is invite-only. None of the SQL below is reachable over REST (it lives in `cloud`): run it
in the project's SQL editor.

- **Admit by hand**: `cloud.admitted_accounts` holds one row per GitHub handle, matched
  case-insensitively. A hand-written row leaves `subject` null and is matched on the handle, so
  a rename un-admits it. Only somebody who has signed in can be invited this way.
- **Remove a row**: refuses the account's next request, but leaves its `cloud.accounts` row
  and data. `cloud.remove_account` removes the account too.

```sql
insert into cloud.admitted_accounts (handle, note) values ('<handle>', '<note>')
on conflict (handle) do nothing;
select handle, subject, note, admitted_at from cloud.admitted_accounts order by admitted_at;
delete from cloud.admitted_accounts where lower(handle) = lower('<handle>');
```

## Answer an invite request

**Request an invite** in the app records a row in `cloud.invite_requests` and mails
`support@ai4kanban.dev` with the requester as reply-to. Approving admits the account on the
sign-in subject the request carried (so a later rename neither un-admits them nor admits
whoever takes the name) and queues a mail that the next hourly run sends.

```sh
npm run invite                    # who is waiting
npm run invite approve <handle>   # admit them
npm run invite approved           # who we approved, and whether their mail went out
```

A row with `approval_error` set, or attempts climbing with `approval_sent_at` empty, is an
admitted person who was not told. Approving a handle another account is already admitted under
is refused: update the old row to its new handle first
(`update cloud.admitted_accounts set handle = '<new>' where lower(handle) = lower('<old>')`).

The same by hand:

```sql
select handle, email, requested_at, notified_at, notify_attempts, notify_error
from cloud.invite_requests where closed_at is null order by requested_at;
select cloud.approve_invite_request('<handle>');
select handle, email, approved_at, approval_sent_at, approval_attempts, approval_error
from cloud.invite_requests where approved_at is not null order by approved_at desc;
select cloud.remove_account('<handle>');   -- takes the account, admission and request
```

`cloud.remove_account` matches by handle, and `cloud.accounts.handle` is not unique: check
`select id, handle from cloud.accounts where lower(handle) = lower('<handle>')` first. **It is
refused while any matched account owns a workspace**, and the refusal names them. Hand each one
over first:

```sql
select w.id, w.name, a.handle, m.role
from cloud.workspace_members m
join cloud.workspaces w on w.id = m.workspace_id
join cloud.accounts a on a.id = m.account_id
where lower(a.handle) = lower('<handle>') and m.role = 'owner';

update cloud.workspace_members set role = 'owner'
 where workspace_id = '<workspace-id>' and account_id = '<new-owner-id>';
delete from cloud.workspace_members
 where workspace_id = '<workspace-id>' and account_id = '<leaver-id>';
```

A permitted removal takes the account's memberships and machines; its handle stays on the
trail.

## Limits the preview lives inside

- **Daily write budget**: `DAILY_WRITE_BUDGET` (20,000) in `src/config.ts`, counted inside each
  mutation's transaction; past it writes get `daily_write_budget_reached`. The hourly run, its
  mail and workspace deletion are outside the budget.
- **Database size**: past 500 MB a Supabase Free project turns read-only, surfaced as
  `storage_limit_reached`.
- **No backups**: Supabase Free keeps none. A workspace export is the only restorable copy.
- **Write sizes**: 200 cards per card write (`MAX_CARDS_PER_WRITE`), documents capped the same
  way, 500 history rows per import pass. Importing this repository's own board cost about
  1,200 writes.
- **Card lease**: `CARD_LOCK_SECONDS` (30 minutes), set by the service.
- **Mail**: given up after `MAIL_MAX_ATTEMPTS` (5); the record keeps its last error.
- **A board's sends**: a machine gives up on a queued send after about four hours of retries
  (`MAX_ATTEMPTS` in `cli/src/lib/cloud/publish.ts`) and sends at most `SEND_PER_PASS` (20)
  items a pass. An unsent action or outcome is not re-sent; the bell says Cloud is out of step.
- **Invite ceiling: about 30 accounts**: an estimate, not a measurement — a busy solo board
  spends about 265 writes a day, a busy five-person team about 585, and events take about
  1.4 MB per busy board. Invite in small batches: turning Cloud on for a board with many
  actionable cards costs 3 writes each plus one per destination. Before inviting past it, check
  `select writes from cloud.daily_writes order by day desc limit 7` and the database size.

## Standing up a new project

Only needed once, and again if the project is ever recreated.

1. **Supabase project**: one project, region `eu-central-1`, holding nothing else. No staging
   copy — test in a throwaway workspace.
2. **Asymmetric sign-in keys**: in JWT settings, move to an asymmetric key so
   `/auth/v1/.well-known/jwks.json` publishes one.
3. **GitHub OAuth app**: callback `https://<project-ref>.supabase.co/auth/v1/callback`; its id
   and secret go into the project's GitHub auth provider, not the Worker. Sign-in asks for
   `user:email` only (`cli/src/lib/cloud/signin.ts`).
4. **Return addresses**: `npm run redirects -- --set` allows `ai4kanban://cloud/signed-in` and
   `https://cloud.ai4kanban.dev/signin/callback`. A missing one is not refused — Auth silently
   returns to the site URL. Set the site URL to `https://ai4kanban.dev`.
5. **Client values**: put the project URL and publishable (anon) key into
   `cli/src/lib/cloud/config.ts`. Neither is secret. The `AI4KANBAN_*` variables in
   [Run it locally](#run-it-locally) override them.
6. **Worker secrets**: `npx wrangler secret put` each of `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `OPENROUTER_API_KEY` (hosted narration;
   optional), and the Slack and Lark sets below.
7. **Exposed schemas**: in API settings, expose `api` alone. Dropping `public` and
   `graphql_public` closes PostgREST and GraphQL to everyone but the Worker.
8. **Schema**: `npm run migrate`, then `npm run check:closed`.
9. **Route**: `npm run deploy` claims `api.ai4kanban.dev`. Keep `cloud.ai4kanban.dev` free for
   `../cloud-ui/`.
10. **Sending domain**: add `ai4kanban.dev` in Resend and publish its DKIM `TXT` at
    `resend._domainkey` and the return-path `MX` and SPF `TXT` on `send`. **Leave the root
    domain's MX and SPF alone** — they deliver `support@ai4kanban.dev`. The sender is
    `MAIL_FROM` in `src/config.ts`.
11. **Slack app** at [api.slack.com/apps](https://api.slack.com/apps) (`slack-manifest.json`):
    - **Bot scopes**: `SLACK_SCOPES` in `src/config.ts`. No history scope.
    - **Redirect URL**: `https://api.ai4kanban.dev/v1/slack/installed`.
    - **Interactivity**: on, request URL `https://api.ai4kanban.dev/v1/slack/actions`.
    - **Secrets**: `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`. Optional as a
      set; without the signing secret no callback is trusted.
12. **Lark apps**: two store apps (商店应用), one on
    [open.feishu.cn/app](https://open.feishu.cn/app) and one on
    [open.larksuite.com/app](https://open.larksuite.com/app), configured identically. 飞书 lists
    only against a Chinese company registration.
    - **Capabilities**: bot, on.
    - **Scopes**: `im:message:send_as_bot`, `im:chat:readonly`, `contact:user.id:readonly`.
    - **Redirect URL**: `https://api.ai4kanban.dev/v1/lark/<cloud>/connected`, where `<cloud>`
      is `feishu` or `lark`.
    - **Event and callback URL**: `https://api.ai4kanban.dev/v1/lark/<cloud>/callback`;
      subscribe to the `app_ticket` push and card callbacks.
    - **Encrypt Key**: required on both; without it no callback is trusted.
    - **Secrets**: `FEISHU_APP_ID`, `FEISHU_APP_SECRET`, `FEISHU_ENCRYPT_KEY`, and the same with
      `LARK_`. Each cloud's set is optional on its own.
    - **Listing**: each cloud works only once its own listing is granted.
