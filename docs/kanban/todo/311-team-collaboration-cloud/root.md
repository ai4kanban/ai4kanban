---
title: Bring team collaboration to AI4Kanban Cloud
track: features
priority: high
roi: high
status: ready
release: ""
blocked_by: []
related: [314, 315, 316, 317, 322, 328]
modules: [cloud, local-ui]
questions: []
verify:
  - "Two GitHub accounts on two machines share one workspace end to end: the owner invites the second, who opens the board from a clone that commits only the pointer, is refused a card the owner is holding, and raises a user question that reaches the owner and is answered by them; the owner then exports the workspace and reads the whole board back as markdown."
  - "The three published pages describe the workspace this group actually built: /cloud, /privacy and /terms on ai4kanban.dev name a shared board, its members, their roles, the owner's export and the owner's deletion as they were shipped; no paragraph still says the release has no shared board, no members and no roles; and the legal pages' effective date moved with the change."
---

Let a team share one authoritative board while every member keeps code and agent work on
their own machine. Today a board is one person's folder: a second contributor cannot be
identified, cannot be reached when a question needs an answer, and nothing stops two
machines from changing the same card. This is a group task; each piece is its own subtask
in this folder.

## Worth noting
- **Going Cloud costs a team the file-shaped board**: a Cloud checkout holds no cards, so
  reading the board on GitHub, grepping it and #56's Obsidian view all stop working there,
  and an export is the only way back to files.
- **The preview keeps no backup of its own**: Supabase and Workers on their free tiers give
  no daily backups and no point-in-time recovery, so once the board lives in a workspace the
  owner's export is the only copy anyone can restore from.
- **A shared board changes when you act, not when a teammate does**: nothing pushes an edit
  to an open board, so a member meets a teammate's change on their next action or refresh and
  a notification is what tells them something needs them; a live subscription would hold a
  poll or a connection per open board against the preview's one shared daily request ceiling,
  while the write that actually costs a team — two people editing one card — is already
  refused as stale.
- **Every member's own machine runs their own work**: a workspace registers each member's
  machine as a server and runs a decision on the machine of the member who took it — lifting
  0.8.0's one-server-per-board rule without adding dispatch between machines — so a decision
  waits for that member's machine rather than for whichever teammate's happens to be awake.

<!-- agent -->

## Today
- **One operation contract is in place (#312)**: `akb` and the app reach the board through
  `cli/src/lib/board/` with the markdown backend behind it, so a Cloud board is a second
  implementation of that contract rather than a rewrite of the callers.
- **The service and its write shape are in place (#323)**: `cloud/` holds the Worker, its
  forward-only migrations and its deploy, migrate and lockdown commands; a mutation is one
  Postgres function in the `api` schema called over PostgREST, board tables live in `cloud`,
  and a refusal is `{ error: { code, message } }` whose message is shown to a user as it
  stands.
- **The service is provisioned and answering**: the Supabase project in `eu-central-1`, its
  GitHub auth provider and the `api.ai4kanban.dev` route are all standing, with `GET /health`
  answering unauthenticated and `POST /v1/self-check` refusing without a token, so every card
  from #314 on is checked against a live service.
- **Sign-in, events and Slack are in place (#325)**: #326's machine-local session that the
  app and `akb` share, its admitted-account list, the event, action and outcome contract, and
  Slack as a connected app; #350, still open in 0.8.0, makes an approved request the whole of
  getting in and deletes the invitation code #327 shipped.
- **0.8.0's Cloud is single-account by construction**: a `cloud.boards` row belongs to one
  account and its events, Slack destination and server all hang off that owner, so nothing in
  it knows what a member is and no board a second account can reach exists.
- **Exactly one machine may be a board's server**: `cloud/src/servers.ts` refuses a second
  with "This board already runs its work on another machine" and taking over is how a solo
  user moves a board between machines, so a team whose members each run their own work needs
  that rule lifted.
- **The published pages say the opposite of this group, deliberately**: `/cloud` lists "No
  shared or team board" and "No members and no roles", `/privacy` and `/terms` say the release
  has no shared board and no members, `/terms` promises the page and its effective date change
  if sharing is ever added, and both legal pages reassure the reader that a closure cannot
  cost them their board because "there is no board on Cloud to export" (#330, #349).
- **An operator notice reaches an account by email only**: by hand from
  `support@ai4kanban.dev` to the address GitHub verified, and `/terms` states that the preview
  delivers no notice inside the app and none in a connected Slack channel.
- **The published account estimate counts no board writes**: `cloud/README.md`'s "How many
  accounts that carries" derives about thirty accounts from what one account's event flow
  costs, because 0.8.0 stores no board.
- **#316 is left with only its conflict path**: #331 landed awaiting every board write and
  taking the card archive out of the card page's read in 0.8.0, because #319's publisher hangs
  off a settled write; what remains for #316 is the revision-on-save conflict path, which only
  a second teammate needs.
- **The `cloud` module's memory is current**: it already holds this group's settled decisions.
- **Auto-delivery is already local and one click**: it builds, reviews, corrects and lands an
  approved card entirely on a member's machine, and #325 makes that click reachable from a
  Cloud action.
- **The board's own history lives in two files**: `record.csv` and `metrics.csv`, whose events
  predate any notion of a member.

## Scope
- **Local is what a user gets by default**: it stays the board onboarding leads with, and
  Cloud is an explicit opt-in a user chooses.
- **A workspace owns the shared board**: its cards, memory, releases, history, membership,
  coordination, and the board's own configuration — name, tracks, modules and per-flow rules.
- **Finished work stays in the workspace**: an archived card and a closed release's summary
  stay in it and come back with the export.
- **The members' machines keep the code**: repositories, worktrees, agents, model accounts,
  commits and merges never leave them.
- **One server per member's machine**: a workspace holds one for each member, and a decision
  taken away from a machine runs on the server of the member who took it, never on another
  member's.
- **A checkout joins through one committed pointer**: it carries no board markdown while Cloud
  is authoritative, and export is how a team gets markdown back.
- **The pointer wins over any markdown beside it**: `akb` and the app open the Cloud board and
  never read or write those files, so a teammate cannot edit a stale local card by accident.
- **Import never deletes a file the team committed**: clearing the imported board out of the
  repository is one change the team reviews and commits itself.
- **A member is a signed-in GitHub account**: #326's machine-local session serves both the app
  and `akb`, and the group adds no second sign-in.
- **Every workspace is private, and admission to Cloud is not membership**: every endpoint
  that reads a workspace or writes to it answers only that workspace's members.
- **A non-member is told to ask an owner for an invite**: a teammate whose signed-in account
  is not a member of the workspace the pointer names is never told the board is missing.
- **Solve the four problems in `goal.md`**: identify members, route a question to the person
  who can decide, allow one writer per card, and keep one attributed memory.
- **Routing follows roles, never an assignee**: on #325's event and action contract, a
  user-owned question notifies the workspace's owners and a card ready for review notifies
  members watching the release, and no card carries an assignee.
- **Every mutation is attributed to a member**: whether it changes a card, a memory file or a
  release.
- **Every write to shared board content goes through the one operation contract**: the memory
  set, the module map and per-flow rules included, so no flow reaches a Cloud board by editing
  a file beside it.
- **The board's existing history comes along**: `record.csv` and `metrics.csv` move into the
  workspace without inventing member attribution for events that predate the team.
- **One audit trail for the team**: the workspace holds the record of every member's
  deliveries, so a team reads one trail instead of one per checkout.
- **Import and export bridge Local and Cloud**: they never keep two writable boards in sync.
- **An owner can export the workspace from the app whenever they want.**
- **The export restores a whole board on its own**: cards, memory, releases, the board's
  configuration, its history and its delivery records.
- **Leaving Cloud is a move a team makes, never one that happens to it**: the export writes
  the board back into `docs/kanban/` and the committed pointer comes off in the same change
  the team reviews and commits, and nothing removes a pointer on a team's behalf.
- **Any admitted account may create a workspace**: the preview stays invite-only because #326
  refuses an account we have not admitted before it reaches anything here.
- **An owner can delete a workspace and everything in it.**
- **Closing one member's account never deletes a workspace others are still in**: it removes
  their membership and their machines, keeps their name on the work they already did, and asks
  an owner to transfer or delete the workspace first, so a shared board goes only when an owner
  deliberately deletes it.
- **The card that adds a capability rewrites the published pages**: whichever card adds a
  workspace, a member, a role, an export or a deletion takes the matching paragraph off
  `/cloud`, `/privacy` and `/terms` in the same delivery — the "no shared board, no members and
  no roles" lists and the promise that a closure cannot cost a team its board — and moves the
  legal pages' effective date, so all three describe what the group built before the first
  outside team is invited.
- **#315 recounts the account ceiling**: `cloud/README.md`'s "How many accounts that carries"
  is recomputed once a shared board's own writes spend the same daily budget, so the number we
  invite up to is what a team costs rather than what one account's event flow costs; counting
  is not enforcing.
- **Cloud never sees code and never runs a model over a board**: no repository, credential or
  model key reaches it on any card in this group, and every agent run stays on a member's own
  machine.
- **Out of the group**: realtime body editing, fine-grained card permissions, dispatching work
  between members' machines, and any Cloud handling of code.
- **Out of the group**: any Cloud page at a URL, public or authenticated — the browser surface
  is #322 and ships separately.
- **Out of the group**: GitHub Issues intake — #313 is an intake door into either board, and a
  team shares a board without it.
- **Out of the group**: pricing, billing, and the open-source support policy.
- **Out of the group**: the sign-in that carries a Cloud account and the admission list itself
  — #326 with #350 decides who reaches the service at all, and whether adding a member also
  admits that account is #314's open question and the one place this group may write to that
  list.
- **Out of the group**: per-workspace usage caps and quota enforcement — the invite list and
  the service's own daily write budget (#323) are what bound cost and capacity in v1.
- **Out of the group**: naming a decider on a card — question routing follows the owner role,
  not a per-card assignee.

## Todo
- [x] Give Local and Cloud boards one operation contract #312
- [x] Stand up the service every Cloud workspace runs on #323
- [ ] Build the Cloud control plane for team workspaces #314
- [ ] Store the shared board in Cloud without moving the codebase #315
- [ ] Use Cloud boards safely from the app and CLI #316
- [ ] Lead onboarding with Local and make Cloud an explicit choice #317
- [ ] Notify a workspace's owners and members about a card that needs them #328
- [x] Publish the privacy and terms pages the Cloud preview needs #321

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
- **Why this root stays `todo` and never goes `ready`**: it is a tracking card and a `ready`
  card is offered for delivery, so the subtasks carry the status a delivery reads and the
  board closes the group itself when the last subtask line is ticked off.
- **Why the Todo runs in that order**: every card establishes the boundary the next one writes
  against — contract, service, control plane, storage, then clients and onboarding, then
  routing — with #323 beside #312 because the contract is local work and the service is
  hosting work, #328 after #316 because there is no team event to address until a team's
  writes reach a Cloud board, and #321 outside the chain because 0.8.0 needed the pages for
  #327's email.
- **Where Cloud runs, and what the preview costs**: Cloudflare Workers for compute and
  Supabase Postgres for the shared board, on the free tier of both at $0 a month, because
  Postgres transactions carry the writer lease and fencing model with no rewriting and compute
  stays on the account the site already deploys from; the cost is a second vendor, account and
  bill, a project that pauses after a quiet week unless something keeps it awake, and a
  region — `eu-central-1`, so an EU team's board stays in the EU — that cannot change without
  recreating the project. Paid plans, at $30 a month, come with pricing.
- **Local stays what onboarding leads with**: pricing and the open-source support policy do
  not exist yet, so a default install must not land on a hosted service we have neither priced
  nor promised to keep running; #317 offers Cloud as an explicit, clearly labelled choice
  beside Local, and onboarding can lead with Cloud once those policies are published.
- **Cloud stays an invite-only preview, and the group adds no second list**: #326 with #350
  decides who reaches the service at all, so any admitted account may create a workspace and
  #314 gates on workspace membership alone — admission is service-wide rather than
  per-workspace, an admitted member of one team can start a team of their own, and opening
  signup is a later change that comes with pricing.
- **Cloud never sees code, and that is the whole safety story**: if any card ever uploads a
  repository, a credential or a model key the group's promise is broken rather than bent, so
  #315 carries the shared-board check and #325 established the same boundary for remote
  actions before this group starts.
- **How an operator notice reaches a workspace**: by email sent by hand from
  `support@ai4kanban.dev` to the address GitHub verified for each account — the only route
  `/terms` promises, and one that explicitly rules out the app and a connected Slack channel —
  so a shared board needs no broadcast surface of its own for a preview whose whole invite
  list fits on one page.
- **Which card stood the service up**: #323, because every card from #314 on assumes an API on
  a host, a database with a schema, a GitHub app and somewhere to keep secrets, and no other
  card creates them; #294 set the precedent that standing a service up is its own card.
- **Which card gates the endpoints #323 shipped**: #326, before this group, refuses every
  account it has not admitted, including on the budgeted `/v1/self-check`, and #314 adds the
  second gate — an admitted account still answers for nothing inside a workspace it is not a
  member of.
- **How a workspace relates to the board record 0.8.0 already keeps**: #314 grows it rather
  than parking a second object beside it, making the owner of a `cloud.boards` row the first
  membership row, so a solo user who turns Cloud on and later shares keeps the events, Slack
  destination and server already hanging off that board, and #328 routes on the same events
  table.
- **Which card registers a member's machine as a server**: #314, because #316's leases and
  #317's server controls need a machine identity the workspace owns; revoking one refuses its
  next renewal, write and delivery confirmation, and the same card lifts 0.8.0's
  one-server-per-board rule for a workspace — a board there is not a folder on one machine —
  while the take-over path stays for Local boards.
- **Which card carries which of the four problems**: #326 identifies the person and #314 with
  #317 turn that account into a member, #328 routes a question to the owners on top of #325's
  event and action contract, #314 and #316 keep one writer per card, #312 with #314 make every
  card write attributed, and #315 does the same for memory.
- **Why team routing is its own card**: #325 addresses an event to the one account that
  published it — right for a solo board, and nobody on a team — and no other card here touches
  the event contract, since #314 holds the membership an audience is resolved from, #316 the
  clients and #317 the controls.
- **Why #313 is not in the group**: GitHub intake is not on the Cloud critical path, since
  nothing in #314 reads or writes what #313 builds and no team needs it to share a board, so
  it is built and checked against a Local board and its Cloud side is checked once #316 lands.
- **Whether a member may still answer a user question**: yes — owner routing decides who is
  told, not who may write, and with per-card permissions out of the group any member who opens
  the card can still Resolve it.
- **What stops a question reaching nobody**: a workspace always keeps at least one owner, so
  #314 refuses the role change or member removal that would leave none.
- **What one member's deletion request may take**: their own place in the workspace, never the
  workspace, because `cloud.boards.owner_id` cascades from the account today — right while a
  board belongs to one person and destructive once it does not — so #314 makes membership the
  thing that is removed, leaves the work attributed to the name that did it, and the pages
  saying a removal takes the whole account and everything under it are rewritten with the rest.
- **The site still does not sell Cloud to a team**: it is an invite-only preview with no
  pricing, so nothing in the group advertises it — the group rewrites the `/cloud` page #349
  already shipped rather than adding one, #317 explains both authority models inside the app
  and in `docs/guides/`, and announcing team Cloud is a distribution card that ships with
  pricing.
- **How a checkout finds its Cloud workspace**: `akb` and the app locate a board by walking up
  for `docs/kanban/`, so a Cloud board keeps that folder holding its machine-local files and
  one committed pointer to the workspace — no cards, no memory, no mirrored markdown and no
  token — so every teammate's clone resolves the same workspace, while the sign-in stays in
  #326's session in the user's home directory, outside every repository; #317 writes the
  pointer and #316 reads it.
- **How a machine gets that sign-in**: #326, before this group, signs a machine in from the
  app's Configuration dialog into one machine-local session that `akb` reads and that refreshes
  itself, so a long delivery never stops to sign in again, #316 drops its own sign-in and
  sign-out, and a member who has never opened the app on a machine is told to sign in there
  rather than offered a second flow.
- **What a team server is, given that sign-in**: a member's own machine with the app installed,
  because #326 rules out signing in without a desktop, so a headless build server cannot be a
  team server here — which sits with dispatching work between machines, already out of the
  group.
- **What happens to the board a team imported**: it stays in the repository until the team
  removes it, because deleting a team's committed history for them is not a move an import gets
  to make — import writes the workspace and stops, #317 says the folder's cards are a stale
  copy and offers the removal as a change the team commits, and until they do #316's
  pointer-wins rule is what keeps those files from being read.
- **What a teammate meets on a converted board**: a pull, a pointer and an account nobody has
  invited yet, so #316 names that case — not a member of this workspace, ask an owner — and
  #317's owner controls are where the invite comes from; the preview admission that gates
  workspace creation is a different list and a different message.
- **Which card offers the export and the way back to Local**: #317, because #315 builds the
  export and the pointer wins over any markdown beside it (#316), so an export written into its
  own checkout would open nowhere; #317 owns the owner controls and the pointer it wrote, so it
  offers both the export and the pointer's removal — the same shape as the import's stale-copy
  removal, one change the team commits.
- **What the contract still does not carry**: the memory set, the module map and per-flow
  rules, because #312 landed a read for each and a write for none — `refine`, `resolve`,
  `complete`, `reject` and `prune-memory` write `docs/kanban/memory/*.md` as plain file edits,
  `modules.md` is written the same way, and `docs/kanban/rules/` keeps its own exports from
  `cli/src/kanban.ts` that the copy a delivery freezes reads again — so on a Cloud board each
  of those flows would write a local file nothing ever reads, losing the one attributed memory
  this group exists to keep, and #315 adds the write operations when it makes all three
  workspace content.
- **Where a delivery record lives on a Cloud board**: in the workspace, carried there by #315,
  so a team reads one audit trail rather than one per checkout; #318, in #325's group, kept
  only the machine-side record — the worktree path and the branch names.
- **Who carries Slack**: #325, which moved #318, #319 and #320 into its own group and connects
  a Slack app rather than taking a webhook URL an owner pastes; #328 extends that connector
  with which channel an owners' question reaches and picks no transport of its own.
- **Who rewrites the published pages, and when**: #330 and #349 did it in 0.8.0, then this
  group — the pages had been written for the workspace this group builds while 0.8.0 invites
  people to something else, so #330 rewrote `/privacy` and `/terms` for a single-account relay
  and #349 gave the product its own `/cloud` page; every card here that adds a shared board, a
  member or a role back rewrites the matching paragraph on all three in the same delivery and
  moves the legal pages' effective date, the way #327 already did for the invitation email.
- **Where #313's GitHub access lives**: on the machine, never in Cloud, because intake and
  progress mirroring run from `akb` and the app with the member's own repository credentials
  and reach the board through the contract, so no workspace holds a token that can read a
  repository; #323 registered one GitHub app for sign-in asking for `user:email` and nothing
  else, and #313 adds no second grant to it.
- **Where Cloud answers**: `api.ai4kanban.dev`, a sibling of the site and of #294's
  `t.ai4kanban.dev` and never a `workers.dev` address, fixed by #323 before anything was built
  against it, with `cloud.ai4kanban.dev` left free for #322's browser surface; only sign-in
  answers elsewhere, because Supabase Auth runs the GitHub flow and #323 pointed the OAuth
  callback at the Supabase project's own address rather than at our host, which is a paid
  add-on the preview does not take.
- **How the Worker reaches the database**: over HTTPS through PostgREST, never a raw socket,
  because PostgREST runs one request in one transaction and the whole check-apply-advance-audit
  sequence is therefore one Postgres function called by RPC; Hyperdrive with a Postgres driver
  is the fallback if a card ever needs ad-hoc SQL, and it wants `nodejs_compat` while Supabase's
  direct connection is IPv6 unless the Pro IPv4 add-on is bought.
- **Where the lease and its fencing live**: rows in Postgres, read and advanced inside those
  functions, so with no single-threaded object to lean on #314's guarantee is `BEGIN … COMMIT`
  plus a rising fencing-token column.
- **What one scheduled run does**: an hourly Cron Trigger on the Worker, built once by #323,
  whose `api.service_heartbeat()` call is the write that keeps the free Supabase project from
  pausing and sits outside the daily write budget so a busy day cannot switch it off; nothing
  sweeps for an expired lease because a mutation compares the stored expiry, so #314 adds only
  its operation-ledger prune, and an owner resumes a paused project from the Supabase dashboard
  with its data intact.
- **Who runs GitHub sign-in**: Supabase Auth's GitHub provider, whose asymmetric token the
  Worker verifies against the project's JWKS endpoint and which comes with the database we now
  run; it asks for `user:email` and nothing else, so its token cannot read a repository and
  #313's repository grant is a separate token that is never reused for it.
- **Which accounts**: the Cloudflare account the site and #294 already use, plus a Supabase
  project created for Cloud alone — another team's board sits in Supabase, so no second
  Cloudflare login buys any separation — and with two active projects per organization on the
  free tier, a staging project would take the last slot.
- **What the free tier costs in code**: a Worker invocation gets 10 ms of CPU on the free plan
  and waiting on Supabase does not count against it, so the Worker forwards PostgREST's
  response rather than parsing and rebuilding a whole-board snapshot.
- **Whose daily budget Cloud spends**: the Cloudflare account's, shared with #294's telemetry
  Worker rather than a pool of its own, so #323 gave the Worker a share to count and refuse at
  — #294 can move the account to a paid plan and take the platform's own stop away — and past
  it #316 says the preview is over its daily limit rather than reporting a generic failure; a
  shared board's own writes come out of that same share, which is why the preview's account
  ceiling is recounted here.
- **How an account reaches the preview**: it asks and we approve, with #350 making an approved
  request the whole of getting in in place of #327's redeemed code and a hand-written row still
  admitting somebody who never asked; nothing in this group reads or extends that list, and no
  card here builds an admin surface for it.
- **What is stale in the `technology-selection` section**: it predates the platform override,
  the no-Cloud-page call, the 0.8.0 scope change and everything 0.8.0 has since shipped, so it
  still recommends a Durable Object, names Cloud pages, assigns #318–#320 to this group and
  ends on an open question about which plans to run; those calls are answered above, and only
  its named agent may rewrite the preserved section.
- **Checked**: pages read 2026-08-25 — supabase.com/pricing, supabase.com/docs/guides/auth/jwts,
  docs.postgrest.org references/transactions, developers.cloudflare.com/hyperdrive/{platform/pricing,
  examples/connect-to-postgres/postgres-database-providers/supabase} and
  developers.cloudflare.com/workers/databases/third-party-integrations/supabase; plus
  supabase.com/docs/guides/platform/free-project-pausing, supabase.com/docs/guides/platform/billing-faq
  and developers.cloudflare.com/workers/platform/{limits,pricing} for the free-tier ceilings.
  Checked 2026-08-29 against this repository and the live service: `GET
  https://api.ai4kanban.dev/health` answered 200, `POST /v1/self-check` refused with 401
  `unauthenticated`, `cloud/src/servers.ts` and `cloud/src/errors.ts` hold the one-server
  refusal, `cli/src/lib/cloud/signin.ts` asks for `user:email`, and `web/legal/terms.mdx`,
  `web/legal/privacy.mdx` and `web/components/cloud/CloudPage.tsx` are what the three pages
  say now.

### Overruled by the user
- **The platform recommendation**: `technology-selection` recommended a SQLite-backed Durable
  Object per workspace; Cloud runs on Workers with Supabase Postgres instead, and the section
  is kept exactly as it was written.
- **The preview ships no Cloud page at a URL**: a team works its Cloud board from the installed
  app, which is what this version connects to Cloud, and the hosted browser surface — a public
  read-only board plus authenticated card review and Resolve — is #322, outside 0.8.0; #314 and
  #317 therefore carry no public-access switch, and #320's Slack message records its own
  decision in Cloud and links into the app for the rest rather than pointing at a page.

## Source
- **The subtasks are the design**: `plan.md` held it — the control, board and codebase planes,
  the revision and writer-lease model, import and export, identity and roles — and was deleted
  in `464b6fc` when #318, #319 and #320 moved to #325, so a card here states what it needs
  rather than citing that file.
- **`notify-plan.md`**: the single-user event, action, desktop inbox, board-server and Slack
  plan that #325 shipped before this group.
- **`docs/kanban/memory/goal.md`, the 团队协作 section**: the four problems, the Local/Cloud
  authority split, and the hosted-tier boundary.
