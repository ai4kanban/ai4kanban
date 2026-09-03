---
title: Take in usage events on a server we run
track: distribution
priority: high
roi: high
status: ready
release: 0.9.0
blocked_by: []
related: [292]
modules: [telemetry]
questions: []
---

The project ships an app, a command and a static site and runs no service, so a usage event
has nowhere to go. Stand up one endpoint that takes events in over HTTPS, stores them, and
prints the numbers back.

## Worth noting
- **What it costs to run**: the project takes on its first running service — an endpoint and
  a database to keep alive and migrate. It runs on the Cloudflare account the site already
  deploys to, so no vendor is added and one account outage takes the site and the numbers
  together.
- **What the free plan costs on the busiest day**: a release day where every install reports
  is the day we lose events. Up to the database's daily allowance the endpoint drops them
  quietly and the numbers already stored stay readable; past the account's daily request
  ceiling Cloudflare answers senders with a plain error before our code runs, and that case
  cannot be softened. Both go away on the $5-a-month paid plan.
- **What 90 days of retention costs**: nothing new can be asked of an event once it is gone,
  and someone who comes back after more than 90 days away is counted as a new install again.
  Daily summaries with no install id outlive the events and carry the long trend, and the
  free plan's 500 MB database caps how many installs 90 days of events can cover.
- **How the numbers are read**: a command run from this repository against our own
  Cloudflare account. There is no address to open and no chart to glance at — the numbers
  arrive as a printed table, and nobody without the account can reach them at all.

<!-- agent -->

## Today
- `telemetry` is a new line in the module map with no code behind it, so this card starts
  the module as well as the service.

## Scope
- One public endpoint that takes a small batch of events over HTTPS and answers quickly.
- The endpoint answers at `t.ai4kanban.dev`, not on a `workers.dev` address.
- It answers requests made from a browser on `ai4kanban.dev` and its language paths, so #297
  can count page views without a cookie or an identifier. A browser request from any other
  site is refused.
- It accepts a fixed list of event names and a fixed set of fields; anything else is
  dropped, not stored.
- A sender is never told which of its events were dropped, so it never retries them.
- A bad, oversized or malformed batch is rejected without taking the endpoint down.
- Two kinds of batch arrive. An app batch carries an install id and comes from the app or
  the command; a site batch carries no install id at all and comes from a page on the site.
- Every event in an app batch carries an id the sender made for it, and an event id already
  stored for that install id is ignored rather than counted a second time.
- A site batch is not de-duplicated. A page sends one as it loads and one when the download
  button is pressed, and never resends either.
- Every event carries the calendar date it happened, as the sending machine's own clock and
  time zone saw it. The server stores that date rather than the time the batch arrived.
- A batch may carry events up to seven days old; anything older is dropped rather than
  counted on the wrong day.
- An event dated more than a day ahead of the server's own date is dropped.
- No event carries a card title, a file path, a repository name, a goal, an email, or any
  other free text from the user.
- The install id from #293 is the only identifier an app batch carries about the machine,
  and a site batch carries none.
- A board-numbers event from #296 also carries that board's own random id. It names no
  project, and it is stored on the same events as the install id.
- An IP address is used to work out a country and then not stored.
- One sender is held to 600 requests an hour, counted against the address the request
  arrived from.
- The count behind that limit is thrown away with the hour, and no address is written to the
  database.
- The limit is sized for the many people who share one address behind an office, a
  university or a mobile network, so a visitor reading several pages of the site in one
  sitting is never turned away.
- The service costs nothing to run: it stays inside the Cloudflare free plan's allowances
  rather than billing for what goes over them.
- Every run stays inside the free plan's per-run limits of 50 database queries and 10
  milliseconds of processor time. A batch is stored in a fixed small number of statements
  however many events it carries, and the daily job counts by aggregating in the database
  rather than reading rows into the service.
- Work a run cannot finish inside those limits is carried to the next run rather than
  dropped, so 90 days is the least time an event is kept rather than the exact moment it
  goes.
- The contract requires an app install to send at most one batch a day, at a time of day it
  picks for itself, so a release day arrives spread out rather than all at once. #295 builds
  the sender that obeys it.
- Once the day's database allowance is spent the endpoint takes the batch, drops it, and
  answers as if it had stored it, so no sender retries into a wall.
- Past the account's daily request ceiling Cloudflare answers with an error before the
  service runs, so that case cannot be made silent.
- Raw events are kept 90 days and then deleted; the privacy page in #293 states the same
  90 days.
- A daily summary carrying no install id is kept indefinitely, so the long trend survives
  the deletion of the events behind it.
- A day's summary is rewritten for as long as that day can still take late events, so an
  install that was offline is counted on the day it was used.
- A day's summary holds every number the numbers command prints for that day, including how
  many distinct installs were active and how many of those had been seen on an earlier day.
  An install seen on an earlier day is what this card means by a returning install.
- A day's summary also records that day's own requests taken and rows written. Those
  counters are kept outside the events database and written into the summary once a day.
- Every number in a summary is worked out while the events behind it still exist, so an
  install last seen longer ago than the retention period counts as new again.
- A day the daily job did not run is summarised by the next run that finds it missing, for
  as long as the events behind that day are still kept.
- The daily job's own reads and writes are counted against the same day's allowance the
  endpoint spends, and it stays inside that allowance as the number of installs grows.
- One command, run from this repository, prints the numbers: downloads, opens, returning
  installs, version spread, country spread, and the board numbers from #296.
- That command reads the summaries and never scans the events, so a reading costs the same
  however many events are stored.
- It marks a day it has no summary for rather than printing that day as zero.
- It prints how close each day came to the free plan's allowances, so the day we have to
  start paying is seen coming rather than discovered.
- Its output says which installs the app numbers cover, so an open count is never read as
  the whole product's use.
- The numbers are readable only with the Cloudflare account credentials we already hold, and
  the service answers no request that returns them.
- A second command deletes one install id's events on request. It takes the install id the
  user reads on their own machine, which #293 has to show them.
- Deleting an install id's events drops that install out of every day still open for late
  events; a day already settled keeps the counts it reported.
- The event names, the fields and the endpoint's address are written down in one place that
  both the senders and the server read from.
- That place is a file in this repository, beside the service's own source in a `telemetry/`
  folder at the repository root; the site, the app and the command read it from there rather
  than each keeping a copy.
- A build made for development reaches a separate copy of the service, so our own work on
  the senders never lands in the real numbers.
- Both copies draw on one Cloudflare account's daily allowance, so a load test against the
  development copy is bounded rather than left to spend the real endpoint's day.
- The running service accepts a new event name before any sender that emits it ships, so an
  event is never dropped for arriving before the server knew about it.
- The service runs one job a day. It deletes expired events, writes the summary, and is
  where #297's scheduled pulls of the GitHub and npm counts run.
- The counts pulled from GitHub and npm are stored beside the summaries. They carry no
  install id and are never deleted.
- Out of scope: anything a user sees, and any public dashboard.

## Todo
- [ ] stand up the Worker and the D1 database on the Workers free plan
- [ ] put the endpoint on `t.ai4kanban.dev` rather than a `workers.dev` address
- [ ] define the event names, fields and endpoint address in one shared place under `telemetry/`
- [ ] build the endpoint, accepting only the defined shapes and dropping the rest
- [ ] let the site's pages post to it from the browser, and no other site
- [ ] accept the site's batches, which carry no install id, alongside the app's
- [ ] store the date each event happened, and refuse events more than seven days old
- [ ] drop an event dated ahead of the server's own date
- [ ] resolve the country from the request and store no IP address
- [ ] accept #296's per-board id on a board-numbers event, and delete it with that install's events
- [ ] ignore an app event id already stored for that install, so a resent batch is not counted twice
- [ ] handle bad, oversized and repeated batches without failing
- [ ] limit one address to 600 requests an hour, without writing the address to the database
- [ ] put the once-a-day, self-timed sending rule in the contract and size the day against it
- [ ] drop what arrives once the day's database allowance is spent, answering as if stored
- [ ] keep every run inside 50 database queries and 10 ms of processor time, counting in the database
- [ ] keep raw events 90 days, deleting in chunks that fit one run and carrying the rest to the next
- [ ] write the daily summary, including each day's distinct and returning install counts
- [ ] record each day's own requests and rows written on that day's summary
- [ ] rewrite a day's summary while late events for that day can still arrive
- [ ] summarise a day the daily job missed, while that day's events are still kept
- [ ] keep the daily job's own reads and writes inside the day's allowance as installs grow
- [ ] run one daily job that deletes, summarises, and carries #297's scheduled pulls
- [ ] store the pulled GitHub and npm counts beside the summaries, outside the 90-day deletion
- [ ] write the command that prints the numbers from the summaries, and which installs they cover
- [ ] mark a day with no summary in the numbers command rather than printing it as zero
- [ ] print each day's requests and rows written against the free plan's allowances
- [ ] check the service answers no request that returns the numbers
- [ ] add the one command that deletes an install id's events
- [ ] drop a deleted install out of the days still open, and leave settled days as reported
- [ ] run a second copy of the service for development, and point development builds at it
- [ ] load-test a release-day burst against the development copy, bounded so it cannot
      spend the real endpoint's day
- [ ] write `telemetry/README.md`: deploying (server before senders), migrating, reading, deleting

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
  request per event. The free plan holds 500 MB per database and 5 GB across the account,
  which enforced retention has to stay inside; the paid plan raises that to 10 GB per
  database. The Workers free plan allows 100,000 requests and 100,000 written rows a day;
  past that it is the $5/month Workers Paid plan, where 50 million written rows a month are
  included.
- Checked: D1 is GA (April 2024). Limits and pricing pages read 2026-08-22 and the free
  plan's per-database and per-invocation limits re-checked 2026-08-27 —
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
the product promises.


## Decided by the agent
- **Why the endpoint is at `t.ai4kanban.dev`** — the site already owns `ai4kanban.dev` and
  `cdn.ai4kanban.dev` on the same Cloudflare account, so one more subdomain is one DNS line.
  Common content blockers drop requests to `workers.dev`, which would remove an unknown
  share of the site's page views and leave #297 reporting a download rate that is quietly
  wrong.
- **Why the site's batches follow different rules** — a page view is sent as the page loads
  and has no install behind it, so the once-a-day rule and the install id cannot apply to
  it. One set of rules for both would have made the endpoint reject the site's own traffic.
- **Why an event carries an id of its own** — a batch that is stored and then times out on
  the way back is sent again by #295's queue. With nothing to recognise it by, that
  machine's day is counted twice; with an id, the repeat costs a row of storage and changes
  no number. A site batch needs none because the page never resends one.
- **Why the country and not the IP** — the useful part is which regions use the product.
  Keeping the address itself makes the store personal data for no gain.
- **Why a board id is stored and the install id is still the only machine identifier** —
  #296 sends one set of counts per board, and one person often runs several boards. The
  board id says which board a count came from and nothing about the project behind it; it
  sits on the same events as the install id, so deleting that install removes it too.
- **What the numbers are worth** — the endpoint is open to the internet and an install id is
  a value the sender makes up, so the numbers are what honest senders reported rather than
  anything we can prove. The per-address limit stops a flood from costing us a day's
  numbers; it cannot make a forged count impossible.
- **Why an event carries the sender's own calendar date** — #295 queues events on disk and
  sends one batch a day, so a machine closed for a week arrives all at once; stamping events
  on arrival would pile that week onto one day. The date is the sender's own because the
  numbers answer "how many people used it today", and today is the user's day, not UTC's.
- **Why a future date is refused as well as an old one** — a machine whose clock is years
  ahead would otherwise write a summary for a day that has not happened, and a summary is
  kept indefinitely. The one-day-ahead tolerance covers every time zone; only a wrong clock
  is refused.
- **Why seven days of backfill and no more** — a summary has to settle at some point. A week
  covers a laptop closed over a holiday; a longer window means rewriting summaries
  indefinitely and reading more rows each night than the day's allowance affords.
- **Why one sender is limited, and by the address it comes from** — the day's allowance
  protects the money, not the numbers: without a limit one script spends the day's requests
  in a minute and every real install that day is dropped. An install id is a value the
  sender makes up, so a flood would use a fresh one each time; the address a request arrives
  from is the one thing a sender cannot choose, and the counter behind the limit expires
  with the hour rather than being stored.
- **Why 600 requests an hour** — a visitor reads perhaps ten pages in a sitting and an
  install sends one batch a day, so the limit is for a building: 600 an hour lets a few
  hundred people behind one address each read the site before anyone is turned away, while
  one address can still take at most 14,400 of the day's 100,000 requests.
- **What a day's allowance is** — 100,000 Worker requests a day and 1,000 a minute; 100,000
  rows written and 5 million rows read a day. Every one of them belongs to the Cloudflare
  account rather than to one Worker, so both copies of the service share them. Storage is
  500 MB per database and 5 GB across the account, and a single run gets 50 database queries
  and 10 milliseconds of processor time. Checked 2026-08-27 against
  developers.cloudflare.com/workers/platform/limits, /d1/platform/limits and
  /d1/platform/pricing.
- **Deleting costs as much as storing** — the database counts an insert, an update and a
  delete alike, and each index adds a second row to every one of them. Enforced retention
  therefore spends the same daily allowance the events do, which roughly halves how many
  events a day can hold and makes every extra index expensive.
- **The site's counter shares one allowance with the app's** — #297 posts from the site to
  the same endpoint, so page views and app events draw on the same 100,000 requests a day.
  The numbers command reports the two separately, because site traffic is the half that can
  grow without an install behind it.
- **Why counting happens in the database** — the free plan gives a single run 10
  milliseconds of processor time and 50 database queries. Reading a day's rows into the
  service to count distinct installs exceeds both; a `COUNT(DISTINCT ...)` spends waiting
  time instead, which is not counted against processor time, and returns one row.
- **Why a full day drops events instead of failing** — a sender that gets an error retries,
  and retries on the busiest day of the year make that day worse. Losing part of one day's
  events costs less than the numbers being unreadable for it. The one case we cannot soften
  is the account's request ceiling: Cloudflare answers before our code runs, which is why
  the per-address limit, the once-a-day contract and the trigger to move to the paid plan
  all exist to keep the day away from it.
- **Why a spent day still answers reads** — the free plan turns the database read-only
  rather than off, so the summaries already written stay readable on the day the endpoint is
  dropping events. What a spent day costs is that day's events, not the numbers.
- **When we move to the paid plan** — when a day writes more than 60,000 rows, when the
  database passes 400 of its 500 MB, when one run can no longer finish the day's work inside
  50 queries, or when any allowance is reached once. That is Workers Paid at $5/month for 10
  million requests and 50 million rows written a month, and it raises a run to 1,000 queries;
  nothing about the service changes but the plan.
- **Why the load test is bounded** — the day's allowance belongs to the account, not to a
  Worker, so the development copy spends the same 100,000 requests the real endpoint does.
  An unbounded release-day burst would cost a real day of numbers to learn where the free
  plan gives out.
- **Why the numbers are read from summaries and never from the events** — one full scan of
  the event table would spend a large share of the day's read allowance on a single reading,
  and the events behind any day past the retention period are gone anyway.
- **Why a returning install is one seen on an earlier day** — it is the only form of the
  number a summary can carry after its events are deleted. Daily counts of distinct installs
  cannot be added together, so how many distinct installs a month had is not a question the
  summaries answer.
- **Why a missed day is summarised late rather than skipped** — the summary is the only copy
  of a day's numbers once its events are deleted. A job that fails one night and never goes
  back loses that day for good.
- **When the daily job runs** — in the last hour of the UTC day, so it spends what the day's
  allowance has left rather than taking it from the senders first. A day already spent fails
  the job, and the next run summarises the missed day.
- **Why the daily job's own cost is stated** — it reads events and writes summaries out of
  the same allowance the endpoint spends, so as installs grow the nightly job, not the
  incoming traffic, is the first thing to reach the ceiling.
- **Why the daily job carries #297's pulls as well** — the site is a static export and
  cannot run a schedule. This service is the only thing the project runs on a clock, so the
  GitHub and npm pulls run here rather than on a second scheduled surface.
- **Why the pulled download counts outlive the events** — they are public totals with nobody
  behind them, so the retention period #293 publishes does not apply to them, and the
  download trend is the one number worth years of history.
- **Why the day's own usage is stored, and outside the events database** — the numbers
  command promises how close each day came to the allowances, and Cloudflare reports per-day
  usage nowhere the command reads. A row written for every request would spend the whole
  allowance on measuring itself, so the counters live outside that database and land in the
  summary as one write a day.
- **Why the numbers are printed by a command and not served as a page** — #292 says nobody
  outside the project reads them, and a page anyone can open is the one way that promise
  breaks quietly. A page also needs an address and something guarding it: a second product
  to configure, and the one surface that can leak. `wrangler` already reads the database
  with the account we hold, so a command costs nothing to build and nothing to protect. The
  price is that there are no charts, only a table.
- **What deleting one install id removes** — its raw events, and with them that install's
  place in every day still open for late events. A settled day keeps the counts it already
  reported: no summary names an install, its events are gone, and rewriting settled history
  would change numbers already read. #293's privacy page says the same.
- **Why the contract lives in one shared place** — three senders (the app, the command and
  the site) and one server. A field renamed on one side and not the other silently loses a
  number, and nobody notices until the chart is already wrong. The endpoint's address sits
  there too, so a moved service is one change rather than four.
- **Where the service and its contract live** — in this repository, deployed with
  `wrangler`, the tool the site already deploys with. The site, the app and the command each
  live in their own root folder, and the service is a fourth thing that deploys on its own,
  so it takes `telemetry/` at the root. The contract is a plain file beside it rather than a
  published package; four readers in one repository do not need one.
- **Why development sends somewhere else** — the endpoint's address comes from the shared
  contract file, so a build made from this repository would otherwise post our own testing
  into the real numbers on exactly the days we are working on the senders.
- **Why the service is deployed ahead of the sender that needs it** — the endpoint drops
  event names it does not know. A sender released first would lose its new event silently
  for as long as the two are apart.
- **Why no user-facing document is updated here** — nothing on this card is visible to a
  user. The retention period and the event list it defines are published by the privacy page
  #293 writes.
