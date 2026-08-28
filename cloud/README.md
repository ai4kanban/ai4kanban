# AI4Kanban Cloud service

The one service every Cloud workspace runs on: a Cloudflare Worker at `api.ai4kanban.dev`
in front of a Supabase Postgres project. Board rules, membership and audit events are not
here — they are #314's, written against what this stands up.

```
cloud/
├── src/            the Worker — `owner.ts` is the check every route applies
├── migrations/     the schema, one numbered file per change, applied forward only
├── scripts/        migrate and the closed-database check
├── test/           the Worker's own checks, run by `npm test`
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
- **One owner check, applied by every route**: `src/owner.ts` turns a verified sign-in into
  an account (`cloud.accounts`), refuses one we have not admitted, and hands the route an
  `owner.accountId` to hang its rows off. Exactly one route is open before admission — the
  one that reports the session, so the app can name the account it refused.
- **The trusted handle comes from the provider, not from a token**: the `api` function reads
  `auth.identities`, which Auth rewrites on every sign-in. A token carries only
  `user_metadata`, which the account holder can rewrite through Auth, so neither admission
  nor a Slack link may read a handle from one.
- **Two doors admit an account**: the hand-written handle list, and a code the account
  redeemed. A redemption is keyed on the sign-in subject rather than the handle, because
  GitHub lets a handle be given up and taken by somebody else.
- **One schedule serves the whole service**: an hourly run touches the database, which is
  what keeps a free Supabase project from pausing after a quiet week. It also sweeps finished
  events, and retries mail.
- **Mail goes out at once, and the run is the retry**: `/v1/invite-request` sends its own
  notice through `waitUntil`, so nobody waits on the top of the hour and the response still
  never waits on Resend. The hourly run picks up what is left — a send the provider refused,
  and a code approved in the SQL editor, where no Worker was in flight to send it. Either way
  the mail key never leaves the Worker and a failed send is retried rather than lost.

## Endpoints

- `GET /health` — liveness. Reaches nothing, so it stays honest while the database is
  read-only.
- `GET /v1/session` — the caller's verified identity. Needs `Authorization: Bearer <token>`.
- `POST /v1/invite-request` — record that this account asked for an invite. Open to a verified
  sign-in that is **not** admitted. Pressing it again returns the request already open.
- `POST /v1/invitations/redeem` — `{ "code": "…" }`. Open to the same. One code admits one
  account.
- `POST /v1/self-check` — one budgeted write through the path every mutation uses. Needs the
  same bearer token **and an admitted account**; run it after a deploy.

A refusal is always `{ "error": { "code": ..., "message": ... } }`, and `message` is written
to be shown to a user as it stands. The two a client must tell apart:

| Code | Means |
| --- | --- |
| `unauthenticated` | No sign-in, or one that is expired or unreadable. Signing in again fixes it. |
| `not_admitted` | A good sign-in from an account we have not admitted. Signing in again lands on the same refusal, so a client must never answer it with "sign in again". |
| `not_yours` | The request named a row belonging to another account. |
| `invitation_unknown` / `invitation_redeemed` / `invitation_withdrawn` | The three ways a code can fail. Each asks the reader for something different, so each has its own code. A refused code writes nothing at all. |

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
| `npm test` / `npm run typecheck` | The Worker's own checks. |
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
select handle, note, admitted_at from cloud.admitted_accounts order by admitted_at;

-- remove
delete from cloud.admitted_accounts where lower(handle) = lower('neverchanje');
```

Removing a row refuses that account from its next request **by this door only**. It leaves
the `cloud.accounts` row, everything hanging off it, and any code the account redeemed
exactly where they are. `cloud.remove_account` below is the one that closes both doors.

The handle is matched against what GitHub attests for the sign-in, so a row admits the
account GitHub says owns that name. It is the door we admit **ourselves** through — an
invitation code (below) is the one everybody else comes in by.

## Answer an invite request

A refused person presses **Request an invite** in the app, which records a row and then mails
the notice to `support@ai4kanban.dev` with the requester as the reply address — within
seconds, not at the top of the hour. The **record**, not the mail, is what an answer is
written from, so a notice Resend refused is one the next hourly run sends again.

Approving is one statement. It issues the code, points it at the address the sign-in
attested, and leaves it for the next hourly run to send — nobody types a code, and no mail
credential reaches whoever approves. It is SQL rather than a route, so this one really does
wait for the hour.

`npm run invite` runs the common three from a shell, against the project named by
`SUPABASE_PROJECT_REF` and `SUPABASE_ACCESS_TOKEN`:

```sh
npm run invite                       # who is waiting
npm run invite approve neverchanje   # issue the code; the next hourly run mails it
npm run invite codes                 # every code, and what became of it
```

The rest, and the same statements by hand:

```sql
-- who is waiting
select handle, email, requested_at, notified_at, notify_attempts, notify_error
from cloud.invite_requests where closed_at is null order by requested_at;

-- approve one: returns the code, and the next hourly run mails it
select cloud.approve_invite_request('neverchanje');

-- invite somebody who never asked, by naming the address
select cloud.issue_invitation('someone@example.com', 'Ana — design review');

-- every code, and what became of it
select code, email, note, issued_at, sent_at, send_attempts, send_error,
       withdrawn_at, redeemed_by, redeemed_at
from cloud.invitations order by issued_at desc;

-- withdraw a code: before it is redeemed this stops it admitting anybody and stops it
-- going out; after, it closes the door it opened
select cloud.withdraw_invitation('AK4B-7QF2-M3XD');

-- remove an admitted account by BOTH doors, taking its request and its invitation with it
select cloud.remove_account('neverchanje');
```

A code is twelve characters of a thirty-two-letter alphabet with no `0`, `O`, `1` or `I` in
it. It is matched with case and dashes ignored, so it can be pasted however it was read.

`cloud.remove_account` matches on the handle, and `cloud.accounts.handle` is deliberately not
unique — check `select id, handle from cloud.accounts where lower(handle) = lower('…')` first
if there is any chance two accounts share one.

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
The secrets the Worker holds are `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and
`RESEND_API_KEY`; `.dev.vars.example` lists them for local runs. `RESEND_API_KEY` is
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
  reason: a busy day must not hold an invitation back.
- **A send is given up on after five attempts** — `MAIL_MAX_ATTEMPTS` in `src/config.ts`. Past
  that the record keeps its last error and stops being mailed every hour forever, so a dead
  address is something the queries above can see.
- **No backups** — Supabase Free keeps none. A workspace export is the only copy anyone can
  restore from.

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
   GitHub itself verified — which is what an invitation is mailed to — and the grant still
   cannot read a repository.
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
   `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY` and
   `npx wrangler secret put RESEND_API_KEY`.
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

Nothing else is registered against this service: Slack destinations are webhook URLs an owner
pastes, and GitHub is reached from a member's own machine with its own grant.
