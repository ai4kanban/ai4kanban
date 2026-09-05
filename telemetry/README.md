# Usage events

The one service AI4Kanban runs: a Cloudflare Worker at `t.ai4kanban.dev` in front of a D1
database. It takes small batches of usage events from the app, the `akb` command and the
site, keeps the raw events 90 days, and writes one summary a day that outlives them. Nothing
here answers a request that returns a number — the numbers are printed by `npm run numbers`,
with the Cloudflare account we already hold.

```
telemetry/
├── contract.ts     the one file the senders and the server both read
├── src/            the Worker — index.ts is every route it has
├── migrations/     the schema, applied forward only by `wrangler d1 migrations`
├── scripts/        migrate, numbers, forget, burst
├── test/           run by `npm test`; the SQL runs against a real SQLite
└── wrangler.jsonc  both copies of the service, their routes and their schedules
```

## How it fits together

- **The contract is the only place the shapes live.** `contract.ts` names the endpoint, the
  event names and every field. The app (#295), the board's numbers (#296), the site (#297)
  and this Worker read it rather than each keeping a copy — a field renamed on one side alone
  would lose a number silently. Next.js needs `experimental.externalDir` to import it from
  `web/`.
- **A batch is one statement.** However many events it carries, the rows go in as a single
  JSON parameter and `json_each` unpacks them: D1 allows a hundred bound parameters per
  query and the free plan fifty queries per run.
- **Counting happens in the database.** A run gets ten milliseconds of processor time, so the
  daily job aggregates and reads back a handful of rows rather than reading rows to count
  them.
- **Nothing about a sender is written down but what it sent.** The country comes from the
  request and the address does not; the hourly per-address limit lives in a Durable Object's
  memory and never calls storage.
- **A spent day drops events rather than failing.** A sender that gets an error retries, and
  retries on the busiest day of the year make that day worse. Past the account's daily
  request ceiling Cloudflare answers before this code runs, which is the one case that cannot
  be made silent.

## Standing it up

Once per copy — `ai4kanban-telemetry`, and `ai4kanban-telemetry-dev` for the copy our own
work posts into:

```sh
npx wrangler d1 create ai4kanban-telemetry      # paste the id into wrangler.jsonc
npm run migrate                                 # apply migrations/ to it
npx wrangler secret put CF_ACCOUNT_ID           # the daily job's usage gauge, both optional
npx wrangler secret put CF_API_TOKEN            # a token with Account Analytics Read
npm run deploy
```

`t.ai4kanban.dev` and `t-dev.ai4kanban.dev` are custom domains on the zone the site already
uses; wrangler adds the DNS record on the first deploy. Never a `workers.dev` address —
content blockers drop those, which would quietly remove part of the site's page views.

## Day to day

```sh
npm run migrate            # apply new migrations before deploying a Worker that needs them
npm run deploy             # the endpoint at t.ai4kanban.dev
npm run deploy:dev         # the copy development builds post into
npm run numbers            # the last 14 days; --days N, --dev, --json
npm run forget -- <id>     # delete one install's events
npm run burst              # a bounded release-day burst, development copy only
npm test                   # the Worker's checks, and the SQL against a real SQLite
```

**Deploy the service before the sender that needs it.** The endpoint drops event names it
does not know, so a sender released first loses its new event silently for as long as the two
are apart. Add the name to `contract.ts`, deploy, then ship the sender.

**Forgetting is asked for before reporting is switched off.** #293 shows the install id only
while reporting is on, so someone who switches off first has no id left to give us. What goes
is the raw events, and with them that install's place in every day still open for late
events; a settled day keeps the counts it reported.

## What a day costs

The free plan gives the **account** — both copies together — 100,000 Worker requests a day,
100,000 rows written, 5 million rows read, 500 MB per database, and one run 50 queries and 10
ms of processor time. `npm run numbers` prints how close each day came, so the day we have to
start paying is seen coming.

An event costs two rows written (the row, and the one index beside it) and two more when it
is deleted 90 days later, so roughly 25,000 events a day fits. Move to Workers Paid ($5 a
month) when a day writes more than 60,000 rows, when the database passes 400 MB, when a run
can no longer finish inside 50 queries, or when any allowance is reached once. Nothing about
the service changes but the plan.
