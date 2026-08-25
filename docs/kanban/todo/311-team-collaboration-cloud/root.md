---
title: Bring team collaboration to AI4Kanban Cloud
track: features
priority: high
roi: high
status: todo
release: 0.8.0
blocked_by: []
related: [314, 315, 316, 317, 318, 319, 320, 321, 322]
modules: [cloud, local-ui]
questions: []
---

Let a team share one authoritative board while every member keeps code and agent work on
their own machine. Today a board is one person's folder: a second contributor cannot be
identified, cannot be reached when a question needs an answer, and nothing stops two
machines from changing the same card. This is a group task; each piece is its own subtask in this folder.

## Worth noting
- **Owners answer the questions**: no card names a person in this version. A user-owned
  question notifies the workspace's owners, and members are notified only when a card is
  ready for review. On a preview-sized team the owner is the person who decides, and #314
  already issues that role, so routing costs no new card field. Asking a named member waits
  for a later version.
- **The preview ships no Cloud page at a URL**: a team works its Cloud board from the
  installed app, which is what this version connects to Cloud, and a Slack action opens that
  app. The hosted browser surface — a public read-only board plus authenticated card review
  and Resolve — is #322, outside 0.8.0. #314 and #317 therefore carry no public-access
  switch, and #320 links into the app instead of a page.
- **A Slack question lands in a channel, not a member's inbox**: an owner pastes an incoming
  webhook URL per audience, so #320 posts to a channel and the service registers no Slack app
  and no OAuth callback. The cost is that whoever else sits in the owners' channel reads a
  question addressed to owners. Direct messages need a Slack app and a Slack-account-to-member
  map, which is more setup than the group's lowest-priority card earns.
- **A shared board changes when you act, not when a teammate does**: nothing pushes an edit
  to an open board in this version, so a member meets a teammate's change on their next
  action or refresh, and a notification is what tells them something needs them. A live
  subscription would keep every open board in step and would hold a poll or a connection per
  open board against the preview's one shared daily request ceiling — while the case that
  actually costs a team, two people writing one card, is already stopped by the refused
  stale write.
- **Local stays what onboarding leads with**: pricing and the open-source support policy do
  not exist yet, so a default install must not land on a hosted service we have neither
  priced nor promised to keep running. #317 now leads with a Local board and offers Cloud as
  an explicit, clearly labelled choice beside it. Onboarding can lead with Cloud once those
  policies are published.
- **Cloud ships as an invite-only preview**: only someone we invite can create a workspace
  in v1, so the preview cannot outgrow what a free tier holds before pricing exists. #314
  gates workspace creation on the invite and #317 labels the Cloud path as invite-only.
  Opening signup is a later change that comes with pricing.
- **Where Cloud runs**: Cloudflare Workers for compute, Supabase Postgres for the shared
  board — taken over the SQLite-backed Durable Object per workspace `technology-selection`
  recommended. Postgres transactions carry the writer lease and fencing model with no
  rewriting, and compute stays on the Cloudflare account the site already deploys from. The
  cost is a second vendor, account and bill, and a free project that pauses after a quiet
  week unless something keeps it awake. The project is created in `eu-central-1` so an EU
  team's board stays in the EU, and that region cannot be changed without recreating it.
- **Which plans the preview runs on**: the free tier of both — Supabase Free and the Workers
  free plan, $0 a month. Nothing in it can produce a bill, but the stop is ours and not the
  platform's: #294 moves this Cloudflare account onto a paid plan on a trigger of its own, so
  #323 gives the Worker a daily write budget it counts and refuses at, while past 500 MB the
  database turns read-only. The invite list therefore bounds capacity as well as cost,
  because every invited team shares that one budget. Paid plans, at $30 a month, come with
  pricing.
- **The preview keeps no backup of its own**: Supabase Free has no daily backups and no
  point-in-time recovery, so a workspace export (#315) is the only copy anyone can restore
  from. #317 puts that export where an owner can reach it, and #321 says so before a team is
  invited.
- **What the preview publishes about data**: a privacy page and a terms page on the site,
  built with the same page code the blog uses and linked from the Cloud choice in
  onboarding. #321 writes them, and no outside team is invited before they are live. What
  they commit to is now settled: Nullreach Ltd is the operator, and the terms promise
  reasonable notice where practical, not a fixed period, before a workspace is closed.
- **Going Cloud costs a team the file-shaped board**: a Cloud checkout holds no cards, so
  reading the board on GitHub, grepping it, and #56's Obsidian view all stop working there,
  and an export is the only way back to files. Keeping a markdown mirror in the repo would
  buy those back and put a second writable copy next to the authoritative one, which is the
  conflict story this group exists to remove.
- **The group ships in 0.8.0**: team collaboration lands alongside auto-delivery rather than
  waiting for a version of its own. `releases.md` now names both, making 0.8.0 by far the
  longest version this board has planned.
- **This is the first service of ours that holds a user's work**: #294 stands up a service in
  the same release, but it stores our own counters; a Cloud workspace stores a team's board.
  The README and the site sell the board as Markdown in your own repo, and Cloud is opt-in,
  so the local-first promise still holds for anyone who never takes it.
- **Cloud never sees code, and that is the whole safety story**: if any card ever uploads a
  repository, a credential, or a model key, the group's promise is broken rather than bent.
  #315 and #318 each carry a check for it.

<!-- agent -->

## Today
- No Cloud infrastructure exists: no Supabase project, no deployed API, no GitHub app.
  Creating them is account work no card can run from a checkout, so #323's service README
  lists the steps for a human, and #314 has nothing to write against until they are run.
  The `cloud` module's memory already holds this group's settled decisions.
- A board is one `docs/kanban/` folder on one machine: no member list, no way to route a
  question to a named person, and no lock that stops two machines editing one card.
- #312 has landed: `akb` and the app now reach the board through one operation contract in
  `cli/src/lib/board/`, with the markdown backend behind it. A Cloud board is a second
  implementation of that contract, not a rewrite of the callers.
- Auto-delivery already builds, reviews, corrects, and lands an approved card from one
  click, entirely locally. That flow is what #318 has to hand a Cloud card lifecycle.
- `record.csv` and `metrics.csv` hold the board's own history. #315 must carry them into a
  workspace without inventing member attribution for events that predate the team.

## Scope
- Local stays the default board and the path onboarding leads with; Cloud is an explicit
  opt-in a user chooses.
- A workspace, once chosen, owns shared cards, memory, releases, history, membership,
  coordination, and the board's own configuration — its name, tracks, modules, and per-flow
  rules.
- The workspace keeps the board's finished work as well as its open work: an archived card
  and a closed release's summary stay in it, and come back with the export.
- Repositories, worktrees, agents, model accounts, commits, and merges stay on execution nodes.
- A checkout joins a Cloud workspace through one committed pointer and carries no board
  markdown while Cloud is authoritative; export is how a team gets markdown back.
- A workspace pointer wins over any board markdown left beside it: `akb` and the app open
  the Cloud board and never read or write those files, so a teammate cannot edit a stale
  local card by accident.
- Import never deletes a file the team committed. Clearing the imported board out of the
  repository is one change the team reviews and commits itself.
- A member is a signed-in GitHub account; the group adds no second way to sign in.
- Signing in happens once per machine and serves both clients: the app's onboarding and
  `akb` share one machine-local session, kept out of git.
- Every workspace is private: nothing reads one without signing in.
- A teammate whose signed-in account is not a member of the workspace the pointer names is
  told to ask an owner for an invite, not that the board is missing.
- Solve the four problems in `goal.md`: identify members, route a question to the person who
  can decide, allow one writer per card, and keep one attributed memory.
- A user-owned question notifies the workspace's owners; a card ready for review notifies
  every member watching the release. No card carries an assignee.
- Attribute every mutation to a member, whether it changes a card, a memory file, or a release.
- Every write to shared board content goes through the one operation contract — the memory
  set, the module map, and per-flow rules included — so no flow reaches a Cloud board by
  editing a file beside it.
- The workspace holds the record of every member's deliveries, so a team reads one audit
  trail instead of one per checkout.
- Import and export bridge Local and Cloud; they never keep two writable boards in sync.
- An owner can export the workspace from the app whenever they want.
- The export restores a whole board on its own: cards, memory, releases, the board's
  configuration, its history, and its delivery records.
- Leaving Cloud is a move a team makes, never one that happens to it: the export writes the
  board back into `docs/kanban/` and the committed pointer comes off in the same change the
  team reviews and commits. Nothing removes a pointer on a team's behalf.
- Creating a Cloud workspace in v1 requires an invite we issue; signup is never open, and a
  signed-in user without an invite is told so rather than shown a broken path.
- An owner can delete a workspace and everything in it.
- The site publishes a privacy page and a terms page before the first outside team is invited.
- The service the workspaces run on — its host, database, schema migrations, scheduled run,
  GitHub app, and deploy — is built once, before any card writes against it.
- Out of the group: realtime body editing, fine-grained card permissions, automatic dispatch
  across nodes, and any Cloud handling of code.
- Out of the group: any Cloud page at a URL, public or authenticated — the browser surface is
  #322 and ships after this version.
- Out of the group: GitHub Issues intake — #313 is an intake door into either board, and a
  team shares a board without it.
- Out of the group: pricing, billing, and the open-source support policy.
- Out of the group: per-workspace usage caps and quota enforcement — the invite list and the
  service's own daily write budget (#323) are what bound cost and capacity in v1.
- Out of the group: naming a decider on a card — question routing follows the owner role, not
  a per-card assignee.

## Todo
- [x] Give Local and Cloud boards one operation contract #312
- [x] Stand up the service every Cloud workspace runs on #323
- [ ] Build the Cloud control plane for team workspaces #314
- [ ] Store the shared board in Cloud without moving the codebase #315
- [ ] Use Cloud boards safely from the app and CLI #316
- [ ] Lead onboarding with Local and make Cloud an explicit choice #317
- [ ] Connect local delivery to the Cloud card lifecycle #318
- [ ] Notify one release in the app when people must act #319
- [ ] Deliver board notifications to Slack #320
- [ ] Publish the privacy and terms pages the Cloud preview needs #321

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

## Decided by the agent
- **Why a group and not one card**: each system above is too large for one run, and none of
  them is worth building without the others.
- **Why this root stays `todo` and never goes `ready`**: it is a tracking card, and a `ready`
  card is offered for delivery. Nothing here is built directly — the subtasks carry the
  status a delivery reads, and #299 is what takes this root off the board once they are all
  finished.
- **Why the Todo runs in that order**: every card in the chain establishes the boundary the
  next one writes against — contract, control plane, storage and clients, delivery, then
  notifications. #323 sits beside #312 rather than behind it, because the contract is local
  work and the service is hosting work, and #314 is the first card that needs both. #321 sits
  outside the chain: the pages only have to be live before the first invite goes out.
- **Which card stands the service up**: #323. Every card from #314 on assumes an API on a
  host, a database with a schema, a GitHub app, and somewhere to keep secrets, and no other
  card creates them. #294 is the precedent: standing a service up is its own card, separate
  from the behaviour it serves.
- **Which card creates an execution node**: #314. #316's leases, #317's node controls and
  #318's "the same node can confirm" all need a node identity nothing else issues, so #314
  registers a machine as a named node under the member signed in on it, and revoking one
  refuses its next renewal, write, and delivery confirmation.
- **Which card carries which of the four problems**: #314 and #317 identify members, #319
  and #320 route questions to the owners #314 issues, #314 and #316 keep one writer per card,
  #312 with #314 make every card write attributed, and #315 does the same for memory.
- **Why notifications come last instead of shipping on Local first**: the notification
  center reads `status: ready` and `[user]` questions, which a Local board also has, so it
  could be built today. `goal.md` puts notifications and coordination in the hosted tier,
  so it waits for Cloud rather than shipping as a solo-Local feature.
- **Why #313 is not in the group**: GitHub intake is not on the Cloud critical path — nothing
  in #314 reads or writes what #313 builds, and no team needs it to share a board. It is built
  and checked against a Local board; its Cloud side is checked once #316 lands.
- **Whether a member may still answer a user question**: yes. Owner routing decides who is
  told, not who may write. `plan.md` keeps per-card permissions out of v1, so any member who
  opens the card can still Resolve it.
- **What stops a question reaching nobody**: a workspace always keeps at least one owner.
  #314 refuses the role change or member removal that would leave none, because owner is now
  the address a question is sent to.
- **The site still does not sell Cloud**: it is an invite-only preview with no pricing, so
  nothing in the group advertises it. The only pages it adds are #321's privacy and terms
  pages, which describe the preview to someone already invited. #317 explains both authority
  models inside the app and in `docs/guides/`; announcing Cloud is a distribution card that
  ships with pricing.
- **How a checkout finds its Cloud workspace**: `akb` and the app locate a board by walking
  up for `docs/kanban/`, so a Cloud board keeps that folder holding its machine-local files
  and one committed pointer to the workspace — no cards, no memory, no mirrored markdown,
  and no token. Every teammate's clone then resolves the same workspace, while sign-in stays
  in the machine's own ignored `.env`. #317 writes the pointer, #316 reads it.
- **How a machine gets that sign-in**: #316. Every card so far assumed a machine was
  already signed in, and only #317's app onboarding ever signs one in — which leaves `akb`
  on a machine nobody opens the app on, the way a coding agent uses the board, unauthenticated
  on every call. `akb` gains sign-in and sign-out that run the same GitHub flow into the same
  machine-local session, print the URL to open elsewhere when the machine has no browser, and
  renew the session so a long delivery never stops to sign in again.
- **What happens to the board a team imported**: it stays in the repository until the team
  removes it. Import writes the workspace and stops; #317 then says the folder's cards are a
  stale copy and offers the removal as a change the team commits, because deleting a team's
  committed history for them is not a move an import gets to make. Until they do, #316's
  pointer-wins rule is what keeps those files from being read — otherwise a teammate who has
  not pulled the removal edits a card nothing will ever save.
- **What a teammate meets on a converted board**: a pull, a pointer, and an account nobody
  has invited yet. #316 names that case — not a member of this workspace, ask an owner — and
  #317's owner controls are where the invite comes from. The preview invite that gates
  workspace creation is a different list and a different message.
- **Which card offers the export and the way back to Local**: #317. #315 builds the export,
  and the pointer wins over any markdown beside it (#316), so an export written into its own
  checkout would open nowhere. #317 owns the owner controls and the pointer it wrote, so it
  offers both the export and the pointer's removal — the same shape as the import's
  stale-copy removal, one change the team commits.
- **Which card stores the board's configuration**: #315, with #316's clients reading it
  from the workspace instead of from local files. `config.md`, `modules.md` and `rules/`
  are board content, not machine settings: two members must not run one board under
  different tracks, and a per-flow rule written from one member's board UI has to reach
  every member's runs.
- **What the contract still does not carry**: the memory set, the module map, and per-flow
  rules. #312 landed a read for each and a write for none — `refine`, `resolve`, `complete`,
  `reject` and `prune-memory` write `docs/kanban/memory/*.md` as plain file edits, `modules.md`
  is written the same way, and `docs/kanban/rules/` keeps its own exports from
  `cli/src/kanban.ts` that the copy a delivery freezes reads again. On a Cloud board none of
  those files exists, so each of those flows would write a local file nothing ever reads —
  which loses the one attributed memory this group exists to keep. #315 adds the write
  operations when it makes all three workspace content.
- **What a workspace holds once work is finished**: the archived cards and the closed
  releases' summaries, stored and carried by #315 like the rest of the board. `archive` files
  a card into `docs/kanban/.archive/` and closing a release writes `.release-summaries/<id>.md`;
  both are committed board content that the board's own `.gitignore` keeps, so a workspace
  that drops them loses a team's finished work and its export stops being the whole board it
  promises.
- **Which settings never become workspace content**: `ui.config.json` — which coding agent
  runs the board, and the provider and model it runs with. It sits in `docs/kanban/` and is
  committed, so #315's rule that board configuration lives in the workspace would sweep it in
  and hand every member one member's agent and model account, which the Scope keeps on the
  node. #315 leaves it a machine file and #316 keeps reading it locally.
- **Which card lets an owner delete a workspace**: #317, beside the export. #314 builds the
  operation and #321's privacy page promises it to everyone invited, and neither one puts it
  in front of an owner — so it is one confirmed action on the owner controls #317 already
  has, the same place the export and the pointer's removal sit.
- **Where a delivery record lives on a Cloud board**: in the workspace. `docs/kanban/deliveries/`
  is one JSON per delivery on the machine that ran it, so on a team it splits the audit trail
  across checkouts — the fourth problem this group exists to solve. Cloud keeps the
  board-facing part — the card as approved, the review outcome, the rules applied, how it
  ended, and the commit with who landed it — and the node keeps its worktree path and branch
  names. #318 carries it.
- **What the rest of the board's history does on import**: #315 carries `metrics.csv` and the
  committed `deliveries/` records in beside `record.csv`, as imported events with no member
  attribution. Both are read through the surface #312 puts behind the contract —
  `readMetricsView` in `view/api.ts` and `listDeliveries` in `view/read.ts` — so a converted
  board that carries neither draws an empty progress chart and an empty delivery history
  while the repository still holds both.
- **Where #313's GitHub access lives**: on the machine, never in Cloud. Intake and progress
  mirroring run from `akb` and the app with the member's own repository credentials and reach
  the board through the contract, so no workspace holds a token that can read a repository.
  #323 registers one GitHub app, for sign-in with no scopes at all, and #313 adds no second
  grant to it.
- **Where Cloud answers**: `api.ai4kanban.dev`, a sibling of the site and of #294's
  `t.ai4kanban.dev`, never a `workers.dev` address, and #323 fixes the name before anything
  is built against it. `cloud.ai4kanban.dev` is left free for #322's browser surface. Only
  sign-in answers elsewhere: Supabase Auth runs the GitHub flow, so #323 points the OAuth
  callback at the Supabase project's own address rather than at our host, which is a paid
  add-on the preview does not take.
- **How the Worker reaches the database**: over HTTPS through PostgREST, never a raw
  socket. PostgREST runs one request in one transaction, so the whole check-apply-advance-
  audit sequence is one Postgres function called by RPC. Hyperdrive with a Postgres driver
  is the fallback if a card ever needs ad-hoc SQL: it wants `nodejs_compat`, and Supabase's
  direct connection is IPv6 unless the Pro IPv4 add-on is bought.
- **Where the lease and its fencing live**: rows in Postgres, read and advanced inside those
  functions. There is no single-threaded object to lean on, so #314's guarantee is
  `BEGIN … COMMIT` plus a rising fencing-token column.
- **What one scheduled run does**: an hourly Cron Trigger on the Worker, built once by #323.
  Lease expiry stays lazy — a mutation compares the stored expiry — #314's sweep and #320's
  Slack retry hang off that one run instead of adding schedules of their own, and its query
  is the activity that stops the free Supabase project pausing. If one ever does pause, an
  owner resumes it from the Supabase dashboard with its data intact.
- **Who runs GitHub sign-in**: Supabase Auth's GitHub provider, whose asymmetric token the
  Worker verifies against the project's JWKS endpoint; it comes with the database we now
  run. Sign-in asks for no scopes at all, so its token cannot read a private repository, and
  #313's repository grant is a separate token that is never reused for it.
- **Which accounts**: the Cloudflare account the site and #294 already use, plus a Supabase
  project created for Cloud alone — another team's board sits in Supabase, so no second
  Cloudflare login buys any separation. The free tier allows two active projects per
  organization, so a staging project would take the last slot.
- **What the free tier costs in code**: a Worker invocation gets 10 ms of CPU on the free
  plan, and waiting on Supabase does not count against it, so the Worker forwards
  PostgREST's response rather than parsing and rebuilding a whole-board snapshot.
- **Whose daily budget Cloud spends**: the Cloudflare account's, shared with #294's
  telemetry Worker, so Cloud does not get a second Cloudflare account to hold a pool of its
  own. #323 instead gives the Worker a share of that pool to count and refuse at, because
  #294 can move the account to a paid plan and take the platform's own stop away. Past it,
  #316 says the preview is over its daily limit rather than reporting a generic failure.
- **How an account reaches the preview invite list**: an operator adds it in the database
  console. No card builds an admin surface for a list that is a handful of rows while the
  preview is invite-only; #314 only reads it.
- **What is stale in the `technology-selection` section**: it predates both the platform
  override and the no-Cloud-page call, so it still recommends a Durable Object, still names
  Cloud pages, and still ends on an open question about which plans to run. All three are
  answered above, nothing in it is left open, and no flow rewrites the section to match.
- **Checked**: pages read 2026-08-25 — supabase.com/pricing, supabase.com/docs/guides/auth/jwts,
  docs.postgrest.org references/transactions, developers.cloudflare.com/hyperdrive/{platform/pricing,
  examples/connect-to-postgres/postgres-database-providers/supabase} and
  developers.cloudflare.com/workers/databases/third-party-integrations/supabase; plus
  supabase.com/docs/guides/platform/free-project-pausing, supabase.com/docs/guides/platform/billing-faq
  and developers.cloudflare.com/workers/platform/{limits,pricing} for the free-tier ceilings.

### Overruled by the user
- **The platform recommendation**: `technology-selection` recommended a SQLite-backed
  Durable Object per workspace. Cloud runs on Workers with Supabase Postgres instead; the
  section is kept exactly as it was written.

## Source
- `plan.md` — the full design: the control, board, and codebase planes, the revision and
  writer-lease model, import and export, identity and roles, and the shipping order this
  Todo follows. Written before the browser surface moved to #322, so its "public read-only"
  switch and its Cloud UI belong to that card, not to this group.
- `notify-plan.md` — the two notifying events, the portable Markdown message, the
  notification center, and the Slack follow-up that #319 and #320 build.
- `docs/kanban/memory/goal.md`, the 团队协作 section — the four problems, the Local/Cloud
  authority split, and the hosted-tier boundary.
