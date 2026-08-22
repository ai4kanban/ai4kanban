---
title: Take in usage events on a server we run
track: 292-app-telemetry/distribution
priority: high
roi: high
status: todo
release: 0.7.2
blocked_by: []
related: [292]
modules: [telemetry]
questions:
  - question: "[user] Start the telemetry Worker and D1 database on the Workers Paid plan, or stay on the free plan until the numbers force a move? — see the `technology-selection` section"
    mode: single
    options:
      - Workers Paid, $5/month — 10M requests and 50M written rows included, so a release-day burst never hits a wall
      - Workers free plan, no cost — 100,000 requests and 100,000 written rows a day, 500 MB database; enough at current install numbers, and a big release day is where it breaks
    recommend: [1]
---

The events have to land somewhere we control. Stand up one endpoint that takes them in,
stores them, and lets us read the numbers back.

## Today
- There is no server. The project ships an app, a command and a static site, and owns no
  running service.
- There is no module for one either; `telemetry` is a new line in the module map with no
  code behind it yet.

## Scope
- One public endpoint that takes a small batch of events over HTTPS and answers quickly.
- The endpoint answers requests made from a browser on the site's own addresses, so #297
  can count from a static page without setting a cookie or carrying an identifier.
- The endpoint accepts a fixed list of event names and a fixed set of fields; anything
  else is dropped, not stored.
- No event carries a card title, a file path, a repository name, a goal, an email, or any
  other free text from the user.
- The install id from #293 is the only identifier stored.
- An IP address is used to work out a country and then not stored.
- A bad, oversized or malformed batch is rejected without taking the endpoint down.
- The endpoint survives a burst — an update that makes every install report on the same
  day must not cost more than the project can pay.
- Events are kept for a stated period and then deleted; the privacy page in #293 states
  the same period.
- One query or page we can read the numbers from: downloads, opens, returning installs,
  version spread, and the board numbers from #296.
- That page says which installs the app numbers cover, so an open count is never read as
  the whole product's use.
- Deleting one install id's events on request takes one command.
- The event names and fields are written down in one place that both the senders and the
  server read from, so the two cannot drift.
- Out of scope: anything a user sees, and any public dashboard.

## Todo
- [ ] pick where the service runs and what stores the events
- [ ] define the event names and fields in one shared place
- [ ] build the endpoint, accepting only the defined shapes and dropping the rest
- [ ] let the site's pages post to it from the browser, and no other site
- [ ] resolve the country from the request and store no IP address
- [ ] handle bad, oversized and repeated batches without failing
- [ ] set and enforce how long events are kept
- [ ] write the query or page we read the numbers from
- [ ] add the one command that deletes an install id's events
- [ ] load-test a release-day burst and record what it costs
- [ ] fill in `docs/kanban/memory/telemetry/` once the shape is settled

## By `technology-selection` agent

The pick is where the endpoint runs and what holds the events. The site already deploys to
Cloudflare Pages from `web/` with `wrangler`, so a Cloudflare account, the CLI and the
deploy path are all in place — a Worker is the cheapest new surface this project can add.
What is genuinely open is the store, because this card asks for four things a plain event
firehose does not give: a retention period we choose, deletion by install id, exact counts
of distinct installs, and a survivable release-day burst.

### Cloudflare Worker + D1 — a Worker in front of Cloudflare's managed SQLite
- Gives us: real rows we can `DELETE`. One install id's events go in one statement, a
  retention period we set is a scheduled job deleting rows past that age, and returning
  installs and version spread are exact `COUNT(DISTINCT install_id)` and `GROUP BY`.
- Costs: a schema and a migration to keep. Write throughput is a single-threaded database,
  so a burst has to arrive batched — one request per install carrying its events, not one
  request per event. 10 GB ceiling per database, which enforced retention keeps far away.
  The Workers free plan allows 100,000 requests and 100,000 written rows a day; past that
  it is the $5/month Workers Paid plan, where 50 million written rows a month are included.
- Checked: D1 is GA (April 2024). Limits and pricing pages read 2026-08-22 —
  developers.cloudflare.com/d1/platform/limits, /d1/platform/pricing,
  /workers/platform/pricing. `wrangler` 4.125.0, published 2026-08-20, MIT OR Apache-2.0.

### Cloudflare Worker + Analytics Engine — a write-only event store with a SQL read API
- Gives us: no database to run at all. `writeDataPoint` from the Worker, a SQL endpoint to
  read from, and it absorbs a burst without us sizing anything.
- Costs: three of this card's requirements are not reachable through it — see below. Also
  still unbilled, so today's zero cost is not a quoted price.
- Checked: GA since April 2024; retention, limits, SQL API and pricing pages read
  2026-08-22 — developers.cloudflare.com/analytics/analytics-engine/{limits,sql-api,pricing}.

### PostHog Cloud — a hosted product analytics service
- Gives us: the endpoint, the storage, the queries and the charts on day one, with 1M
  events a month free and an EU region.
- Costs: the usage data lives in a vendor's account, which the parent card #292 already
  ruled against as the opposite of the product's local-first promise. Retention on the free
  plan is a fixed year, not a period we set. It is also a second vendor relationship and a
  billing surface that grows with success.
- Checked: pricing page read 2026-08-22 (posthog.com/pricing); repository is MIT with a
  separately licensed `ee/` directory; `posthog-js` 1.418.10, published 2026-08-21,
  Apache-2.0 AND MIT.

### Where Analytics Engine conflicts with this card's scope
- **Deleting one install id's events is impossible.** The SQL API is read-only; there is no
  `DELETE` and no per-row removal. The card's "deleting one install id's events on request
  takes one command" cannot be built on it at all. This alone is decisive.
- **Retention is Cloudflare's number, not ours.** Data is kept for three months, fixed. We
  cannot shorten it, and the privacy page in #293 would be stating a period we do not
  control rather than one we set and enforce.
- **Sampling breaks exactly the numbers this card wants.** Above a certain write rate on an
  index, rows are downsampled and each stored row stands for many; counts become
  `SUM(_sample_interval)` estimates. Estimates are fine for totals but wrong for distinct
  installs — a sampled row cannot tell you which install ids you did not keep, so returning
  installs and version spread degrade into guesses. The trigger for sampling is a traffic
  spike, so the numbers are least trustworthy on release day, which is the day they matter.

### Also weighed
- **A Worker writing to R2**: storage is cheap and lifecycle rules handle retention, but
  reading downloads, opens and returning installs back out means either R2 SQL and R2 Data
  Catalog (both open beta, unbilled, so an unquoted future price) or pulling objects down
  and querying locally. Deleting one install id means rewriting objects, not one command.
- **Our own server**: a VPS with Postgres or SQLite. It answers every requirement, and
  costs a machine to patch, back up and pay for every month whether or not anyone sends an
  event — real upkeep for a project that runs no service today.

### Recommendation
**Cloudflare Worker + D1.** It is the only candidate that satisfies deletion by install id,
a retention period we choose, and exact distinct-install counts, and it adds no vendor the
project does not already have. Analytics Engine is the better fit for volume and the worse
fit for this card's actual requirements; PostHog is faster to stand up and contradicts what
the product promises. The one thing left open is money: see the open question.

## Decided by the agent
- **Why the contract lives in one shared place** — three senders (the app, the command and
  the site) and one server. A field renamed on one side and not the other silently loses a
  number, and nobody notices until the chart is already wrong.
- **Why the country and not the IP** — the useful part is which regions use the product.
  Keeping the address itself makes the store personal data for no gain.
