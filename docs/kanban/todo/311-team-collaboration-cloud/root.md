---
title: Bring team collaboration to AI4Kanban Cloud
track: features
priority: high
roi: high
status: todo
release: 0.8.0
blocked_by: []
related: [312, 313, 314, 315, 316, 317, 318, 319, 320]
modules: [cloud, local-ui]
questions:
  - question: "[user] The invite-only preview puts other teams' boards on servers we run. What data story ships with it?"
    mode: single
    options:
      - Deletion only — an owner can delete a workspace and everything in it; nothing is published, because the invite list is people who already trust us
      - Deletion plus a short Cloud data note — what a workspace stores, where it runs, and that code never reaches it — linked from the Cloud choice in onboarding. One more card, and it is the first thing an open-source maintainer asks before putting a roadmap on it
      - Neither in v1 — the invite list is small enough that a deletion request is handled by hand
    recommend: [2]
  - question: "[user] AI4Kanban Cloud needs an account and a plan to run the invite-only preview on — see the `technology-selection` section"
    mode: single
    options:
      - The Cloudflare account the site already deploys from, moved to Workers Paid — $5/month covers the Worker, the Durable Objects and the telemetry service #294 plans, and storage is billed only above the included 5 GB
      - The same Cloudflare account, staying on the free plan until a limit is hit — costs nothing, and a busy day refuses writes rather than producing a bill
      - A separate Cloudflare account for Cloud only, so other teams' board data never sits in the account that serves the public site — a second login and a second bill to keep
      - A different vendor such as Supabase — a second relationship, from $25/month, and it pauses a preview that goes quiet for a week
    recommend: [1]
---

Let a team share one authoritative board while every member keeps code and agent work on
their own machine. Today a board is one person's folder: a second contributor cannot be
identified, cannot be asked a question by name, and nothing stops two machines from
changing the same card. This is a group task; each piece is its own subtask in this folder.

## Worth noting
- **Local stays what onboarding leads with**: pricing and the open-source support policy do
  not exist yet, so a default install must not land on a service we pay to run. #317 now
  leads with a Local board and offers Cloud as an explicit, clearly labelled choice beside
  it. Onboarding can lead with Cloud once those policies are published.
- **Cloud ships as an invite-only preview**: only someone we invite can create a workspace
  in v1, so the hosting bill cannot outrun us before pricing exists. #314 gates workspace
  creation on the invite and #317 labels the Cloud path as invite-only. Opening signup is a
  later change that comes with pricing.
- **The group ships in 0.8.0**: team collaboration lands alongside auto-delivery rather than
  waiting for a version of its own. `releases.md` now names both, making 0.8.0 by far the
  longest version this board has planned.
- **This is the project's first hosted service**: the README and the site sell the board as
  Markdown in your own repo. Cloud is opt-in, so the local-first promise still holds for
  anyone who never takes it.
- **Nine cards is a program, not a feature**: a provider seam, GitHub intake, a control
  plane, shared storage, both clients, onboarding, a delivery handoff, and notifications in
  the app and in Slack — all inside the version whose other goal is auto-delivery.
- **Cloud never sees code, and that is the whole safety story**: if any card ever uploads a
  repository, a credential, or a model key, the group's promise is broken rather than bent.
  #315 and #318 each carry a check for it.

## By `technology-selection` agent

The pick is one hosted platform for the whole Cloud program: where the API and the
authenticated Cloud pages run, what holds board data, what backs GitHub sign-in, and what
sends to Slack. Naming it once here is the point — #314, #315, #316, #319 and #320 each
assume a runtime and a store, and five separate answers is five migrations later.

The project already runs a Cloudflare account: `web/` deploys to Pages with `wrangler`, and
#294 picked a Worker for telemetry on the same account. So the real question is not "which
vendor" but "which store on it", and the plan is unusually specific about what the store
must do: one transaction that checks membership, lifecycle, operation id, revision and an
unexpired lease, applies the mutation, advances revisions, appends the audit event and
stores the operation result — plus a compare-and-set lease acquisition with a rising fencing
token.

### Cloudflare Workers + Durable Objects — one SQLite-backed object per workspace
- Gives us: the plan's coordination model without a locking protocol. A workspace is one
  object, single-threaded and strongly consistent, so the whole check-apply-advance-audit
  sequence runs uninterrupted; `transactionSync` covers the rest. Object alarms give lazy
  lease expiry and #320's independent Slack retry with nothing extra to run, and an idle
  preview costs nothing because there is no always-on process.
- Costs: the Workers runtime, so no Node-only libraries. Sharding by workspace is easy to
  choose and hard to unpick — a query across workspaces means asking each object. Serving
  the Cloud pages needs `@opennextjs/cloudflare` if they are Next.js, or a static export on
  Pages talking to the Worker, which the plan's one-snapshot hydration allows.
- Checked: pages read 2026-08-25 — developers.cloudflare.com/durable-objects/{platform/pricing,
  platform/limits,api/storage-api}. SQLite-backed objects are on the Workers free plan
  (100,000 requests and 100,000 rows written a day, 5 GB); Workers Paid is $5/month, with
  10 GB per object and a 1,000 req/s soft limit per object. `wrangler` 4.125.0, published
  2026-08-20, MIT OR Apache-2.0. `@opennextjs/cloudflare` 1.20.2, published 2026-07-21, MIT.

### Cloudflare Worker + D1 — one shared managed SQLite database
- Gives us: exactly the stack #294 already chose, so one account, one CLI, one deploy path
  and one schema across every workspace. Cross-workspace reads and migrations are ordinary
  SQL.
- Costs: the only atomic unit D1's Worker API documents is `batch()` — "Batched statements
  are SQL transactions" — and a batch is a fixed list of statements that cannot branch on
  what an earlier one read. No interactive transaction is documented. Every read-then-decide
  step above has to be re-expressed as guarded conditional writes checked by rows-changed,
  or split across round trips that are not isolated from each other. That is precisely the
  code a lease and fencing model cannot afford to get subtly wrong.
- Checked: pages read 2026-08-25 — developers.cloudflare.com/d1/{worker-api/d1-database,
  platform/pricing,platform/limits}. Same free-plan allowances as above; a database is
  capped at 500 MB on Free and 10 GB on Workers Paid, then $0.75/GB-month.

### Supabase — hosted Postgres with GitHub sign-in and Edge Functions in one product
- Gives us: real `BEGIN … COMMIT` transactions, so the plan's sequence transfers with no
  rewriting; GitHub OAuth without writing the flow; and a SQL console for the hand fixes a
  preview always needs.
- Costs: a second vendor, account and bill beside the Cloudflare one this project already
  runs. Its free plan is cheap while idle by pausing: "Free projects are paused after 1 week
  of inactivity" — an invite-only preview that goes quiet for a week wakes up down. Staying
  up is Pro, from $25/month, against $5 for everything on Cloudflare.
- Checked: supabase.com/pricing read 2026-08-25 — Free is 500 MB database, 50,000 monthly
  active users, 2 active projects, paused after 1 week idle; Pro from $25/month.

### Also weighed
- **Vercel + Neon**: Next.js hosting is native and Neon suspends after 5 minutes idle, but
  "the Hobby plan restricts users to non-commercial, personal use only", so a preview that
  becomes a product belongs on Pro at $20 per user per month. Two vendors and a connection
  story before the first card is stored. (vercel.com/docs/plans/hobby and neon.com/pricing,
  read 2026-08-25.)
- **Our own server**: a VPS with Postgres answers every requirement and costs a machine to
  patch, back up and pay for every month whether or not a workspace is open. #294 turned
  this down for a service holding our own counters; Cloud holds other teams' boards.
- **GitHub sign-in stays ours to write**: the OAuth web flow is two HTTPS calls and a signed
  session cookie. Every candidate above still needs those two calls, so an auth library buys
  little and adds an upgrade to track. Ask for identity scopes only — a sign-in token that
  cannot read a repository is what makes "Cloud never sees code" true at the platform level,
  not only in our own code. #313's issue intake needs its own repository-scoped grant and
  must never reuse the sign-in token.
- **Slack needs no SDK**: #320 sends one HTTPS POST per notification. `@slack/web-api` 8.0.0
  (2026-07-14, MIT) declares `node >= 20` and would be a dependency bought for a single
  call `fetch` already makes.

### Recommendation
**Cloudflare Workers with a SQLite-backed Durable Object per workspace.** It is the only
candidate whose concurrency model already is the plan's — one writer, serialized, strongly
consistent — so leases, fencing and the operation ledger stop being distributed-systems code
and become ordinary code inside one object. It adds no vendor, no account and no bill the
project does not already have, and it costs nothing while the preview is idle. D1 is the
safer-looking sibling and the worse fit, because the one thing this program needs most is
the one thing it does not offer; Supabase is the fastest start and pauses exactly the
preview we are trying to keep reachable. What is left open is money: see the open question.

<!-- agent -->

## Today
- No Cloud code exists. `cloud` is a line in `modules.md` and an empty memory set.
- A board is one `docs/kanban/` folder on one machine: no member list, no way to route a
  question to a named person, and no lock that stops two machines editing one card.
- `akb` and the app write the markdown directly. There is no seam a second board backend
  could sit behind, which is why #312 comes first.
- Auto-delivery already builds, reviews, corrects, and lands an approved card from one
  click, entirely locally. That flow is what #318 has to hand a Cloud card lifecycle.
- `record.csv` and `metrics.csv` hold the board's own history. #315 must carry them into a
  workspace without inventing member attribution for events that predate the team.
- GitHub Issues is named in `goal.md` as an intake door and #250 already owns the intake
  shape, but nothing is wired up.

## Scope
- Local stays the default board and the path onboarding leads with; Cloud is an explicit
  opt-in a user chooses.
- A workspace, once chosen, owns shared cards, memory, releases, history, membership, and
  coordination.
- Repositories, worktrees, agents, model accounts, commits, and merges stay on execution nodes.
- Solve the four problems in `goal.md`: identify members, route a question to the person who
  can decide, allow one writer per card, and keep one attributed memory.
- Attribute every mutation to a member, whether it changes a card, a memory file, or a release.
- Import and export bridge Local and Cloud; they never keep two writable boards in sync.
- Creating a Cloud workspace in v1 requires an invite we issue; signup is never open, and a
  signed-in user without an invite is told so rather than shown a broken path.
- Out of the group: realtime body editing, fine-grained card permissions, automatic dispatch
  across nodes, and any Cloud handling of code.
- Out of the group: pricing, billing, and the open-source support policy. Until they exist,
  onboarding leads with Local, Cloud is never a default, and workspaces stay invite-only.
- Out of the group: per-workspace usage caps and quota enforcement — the invite list is what
  bounds cost in v1.

## Todo
- [ ] Give both board types one operation contract #312
- [ ] Import GitHub Issues and mirror progress back #313
- [ ] Build the Cloud control plane #314
- [ ] Store and migrate the shared board #315
- [ ] Use Cloud boards from the app and CLI #316
- [ ] Lead onboarding with Local and make Cloud an explicit choice #317
- [ ] Connect local delivery to Cloud #318
- [ ] Notify people in the app when they must act #319
- [ ] Deliver the same notifications to Slack #320

## Decided by the agent
- **Why a group and not one card**: each system above is too large for one run, and none of
  them is worth building without the others.
- **Why the order runs #312 to #320**: every card establishes the boundary the next one
  writes against — contract, intake, control plane, storage and clients, delivery, then
  notifications. Skipping ahead means building a write path that #312 later has to replace.
- **Why notifications come last instead of shipping on Local first**: the notification
  center reads `status: ready` and `[user]` questions, which a Local board also has, so it
  could be built today. `goal.md` puts notifications and coordination in the hosted tier,
  so it waits for Cloud rather than shipping as a solo-Local feature.
- **Why GitHub Issues is intake and never a second board**: two writable copies needs
  two-way sync and a conflict story, which `memory/skill/rejected.md` already turned down.
- **Which card carries which of the four problems**: #314 and #317 identify members, #319
  and #320 route questions, #314 and #316 keep one writer per card, and #312 with #314 make
  every memory and card write attributed.
- **The public site and README stay as they are**: Cloud is an invite-only preview with no
  pricing, so nothing in the group advertises it publicly. #317 explains both authority
  models inside the app and in `docs/guides/`; announcing Cloud on the site is a
  distribution card that ships with pricing.

## Source
- `plan.md` — the full design: the control, board, and codebase planes, the revision and
  writer-lease model, import and export, identity and roles, and the shipping order this
  Todo follows.
- `notify-plan.md` — the two notifying events, the portable Markdown message, the
  notification center, and the Slack follow-up that #319 and #320 build.
- `docs/kanban/memory/goal.md`, the 团队协作 section — the four problems, the Local/Cloud
  authority split, and the hosted-tier boundary.
