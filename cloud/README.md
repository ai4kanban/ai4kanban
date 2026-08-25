# AI4Kanban Cloud service

The one service every Cloud workspace runs on: a Cloudflare Worker at `api.ai4kanban.dev`
in front of a Supabase Postgres project. Board rules, membership and audit events are not
here — they are #314's, written against what this stands up.

```
cloud/
├── src/            the Worker
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
- **One schedule serves the whole service**: an hourly run touches the database, which is
  what keeps a free Supabase project from pausing after a quiet week. Later scheduled work
  hangs off that run.

## Endpoints

- `GET /health` — liveness. Reaches nothing, so it stays honest while the database is
  read-only.
- `GET /v1/session` — the caller's verified identity. Needs `Authorization: Bearer <token>`.
- `POST /v1/self-check` — one budgeted write through the path every mutation uses. Needs the
  same bearer token; run it after a deploy.

A refusal is always `{ "error": { "code": ..., "message": ... } }`, and `message` is written
to be shown to a user as it stands.

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
3. `curl https://api.ai4kanban.dev/health`, then `POST /v1/self-check` with a signed-in
   token.

## Roll back

`npm run rollback`, then pick the version to return to. **A rollback returns the Worker, not
the schema.** Migrations run forward only, because reversing a schema while a workspace holds
a team's board is how a preview with no backups loses work it cannot restore. Every migration
must therefore leave the Worker version before it working; if it cannot, ship it in two
deploys.

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
The secrets the Worker holds are `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`;
`.dev.vars.example` lists them for local runs.

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
  off the thing keeping the project awake.
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
3. **GitHub OAuth app** — one app, **no scopes at all**, callback
   `https://<project-ref>.supabase.co/auth/v1/callback`. Its client id and secret go into the
   project's GitHub auth provider, not into the Worker. A token with no scopes reads a public
   profile and cannot read a private repository.
4. **Worker secrets** — `npx wrangler secret put SUPABASE_URL` and
   `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY`.
5. **Exposed schemas** — in the project's API settings, set the exposed schema list to
   `api` alone. Dropping `public` and `graphql_public` is what closes PostgREST and the
   GraphQL endpoint to everyone but the Worker.
6. **Schema** — `npm run migrate`, then `npm run check:closed`.
7. **Route** — `npm run deploy` claims `api.ai4kanban.dev` as a custom domain on the
   Cloudflare account the site deploys from. `cloud.ai4kanban.dev` stays free for the hosted
   browser surface.

Nothing else is registered against this service: Slack destinations are webhook URLs an owner
pastes, and GitHub is reached from a member's own machine with its own grant.
