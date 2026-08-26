---
title: Bring team collaboration to AI4Kanban Cloud
track: features
priority: high
roi: high
status: todo
release: ""
blocked_by: [325]
related: [314, 315, 316, 317, 322, 325, 328]
modules: [cloud, local-ui]
schedule:
  action: refine
questions: []
verify:
  - "The service is provisioned: cloud/README.md's \"Standing up a new project\" worked through end to end, `curl https://api.ai4kanban.dev/health` answers unauthenticated, and `POST /v1/self-check` answers when it carries an admitted account's access token — without one it is refused rather than proving the deploy."
  - "The published pages describe the workspace this group actually built: /privacy and /terms on ai4kanban.dev name a shared board, its members, their roles, the owner's export and the owner's deletion as they were shipped, and no paragraph still describes the single-account relay #330 rewrote them for. #330 already checks the deploy and the mailbox in 0.8.0, so this gate is about the wording alone."
---

Let a team share one authoritative board while every member keeps code and agent work on
their own machine. Today a board is one person's folder: a second contributor cannot be
identified, cannot be reached when a question needs an answer, and nothing stops two
machines from changing the same card. This is a group task; each piece is its own subtask
in this folder.

## Worth noting
- **Owners answer the questions**: no card names a person in this version. A user-owned
  question notifies the workspace's owners, and members are notified only when a card is
  ready for review. On a preview-sized team the owner is the person who decides, and #314
  already issues that role, so routing costs no new card field. Asking a named member waits
  for a later version.
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
- **Cloud ships as an invite-only preview, and 0.8.0 already holds the gate**: #326 admits
  an account and #327 issues the code that redeems one, both before this group. So the group
  adds no second list: any admitted account may create a workspace, and #314 gates on
  workspace membership alone. The cost is that admission is service-wide rather than
  per-workspace, so an admitted member of one team can start a team of their own. Opening
  signup is a later change that comes with pricing.
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
  #323 gave the Worker a budget of 20,000 writes a day — a fifth of the account's shared
  ceiling — that it counts and refuses at, while past 500 MB the database turns read-only.
  The invite list therefore bounds capacity as well as cost, because every invited team
  shares that one budget. Paid plans, at $30 a month, come with pricing.
- **The preview keeps no backup of its own**: Supabase Free has no daily backups and no
  point-in-time recovery, so a workspace export (#315) is the only copy anyone can restore
  from. #317 puts that export where an owner can reach it, and the terms page now says so.
- **What the preview publishes about data**: a privacy page and a terms page on the site,
  linked from the site footer and from the Cloud choice in onboarding. #321 wrote them and
  settled what they commit to: Nullreach Ltd is the operator, and the terms promise
  reasonable notice where practical, not a fixed period, before a workspace is closed. The
  cost is that those are now published promises rather than a plan — a card here that
  changes what the preview does with a team's data rewrites the pages in the same delivery,
  the way #327 already does for the invitation email. They no longer arrive describing a
  workspace: #330 rewrote them in 0.8.0 for the single-account relay that release actually
  ships, so this group writes the team half back page by page as it builds it.
- **Going Cloud costs a team the file-shaped board**: a Cloud checkout holds no cards, so
  reading the board on GitHub, grepping it, and #56's Obsidian view all stop working there,
  and an export is the only way back to files. Keeping a markdown mirror in the repo would
  buy those back and put a second writable copy next to the authoritative one, which is the
  conflict story this group exists to remove.
- **The group follows 0.8.0**: the nearer release proves authenticated single-user events,
  desktop actions, and Slack through #325; shared boards, roles, imports, and team conflict
  handling stay here for a later release.
- **This is the first service of ours that holds a user's work**: #294 stands up a service in
  the same release, but it stores our own counters; a Cloud workspace stores a team's board.
  The README and the site sell the board as Markdown in your own repo, and Cloud is opt-in,
  so the local-first promise still holds for anyone who never takes it.
- **Cloud never sees code, and that is the whole safety story**: if any card ever uploads a
  repository, a credential, or a model key, the group's promise is broken rather than bent.
  #315 carries the shared-board check, and #325 establishes the same boundary for remote
  actions before this group ships.
- **The service is provisioned before #314 resumes**: the account work — the Supabase
  project, its GitHub OAuth app, and the `api.ai4kanban.dev` route — is done first, so every
  card from #314 on can prove itself against a live service instead of recording its live
  checks as outstanding. 0.8.0 needs the same account work for #325, so this group inherits
  a live service rather than waiting on one.

<!-- agent -->

## Today
- A board is one `docs/kanban/` folder on one machine: no member list, no way to route a
  question to a named person, and no lock that stops two machines editing one card.
- #312 has landed: `akb` and the app now reach the board through one operation contract in
  `cli/src/lib/board/`, with the markdown backend behind it. A Cloud board is a second
  implementation of that contract, not a rewrite of the callers.
- #323 has landed: `cloud/` holds the Worker, its forward-only migrations, and its deploy,
  migrate and lockdown commands. A mutation is one Postgres function in the `api` schema
  called over PostgREST, board tables live in `cloud`, and a refusal is
  `{ error: { code, message } }` whose message is shown to a user as it stands. That is the
  shape every card from #314 on writes inside.
- #321 has landed: the privacy and terms pages are written and linked from the site footer.
  They commit the preview to what a workspace stores, that only its members read it, that no
  model is run over board content, that deleting a workspace removes everything at once with
  no backup behind it, and that a notice reaches a team in the app or a connected Slack
  channel and never by email. Deploying `web/` and routing `support@ai4kanban.dev` were
  hand-checks that card left for the user, and 0.8.0 now carries them on #330, because it
  invites the first outside person.
- The pages describe a Cloud that stores a team's board in a workspace, read by its members
  and exported and deleted by an owner. 0.8.0 ships none of that, so #330 rewrites both pages
  for the relay a person is actually invited to and takes the workspace wording off them. This
  group is what puts it back, correctly, once a team can share a board — and #330 is where the
  privacy page's pasted Slack webhook becomes the connected app #325 settled on.
- #325 ships first, in 0.8.0, and lands four things this group builds on: #326's Cloud
  account with the machine-local session the app and `akb` share, its admitted-account list,
  the event and action contract, and Slack as a connected app. #327 turns admission into a
  code the invited person redeems.
- Nothing above knows what a workspace is. #326 admits a person to the service and stops
  there — no member list, no roles, and no board a second account can reach.
- The service is not provisioned: no Supabase project, no GitHub OAuth app, no
  `api.ai4kanban.dev` route. That is account work no card can run from a checkout —
  `cloud/README.md`, "Standing up a new project", is the list a person works through — and
  0.8.0 has to work through it for #325 before this group starts.
- The `cloud` module's memory already holds this group's settled decisions.
- Auto-delivery already builds, reviews, corrects, and lands an approved card from one
  click, entirely locally, and #325 makes that click reachable from a Cloud action.
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
- A member is a signed-in GitHub account, signed in the way one user already is: #326's
  machine-local session serves the app and `akb`, and the group adds no second sign-in.
- Every workspace is private, and being admitted to Cloud is not membership: every endpoint
  that reads a workspace or writes to it answers only that workspace's members.
- A teammate whose signed-in account is not a member of the workspace the pointer names is
  told to ask an owner for an invite, not that the board is missing.
- Solve the four problems in `goal.md`: identify members, route a question to the person who
  can decide, allow one writer per card, and keep one attributed memory.
- Team routing will build on #325's event and action contract: a user-owned question notifies
  the workspace's owners, while a card ready for review notifies members watching the release.
  No card carries an assignee.
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
- Any admitted account may create a workspace; the preview stays invite-only because #326
  refuses an account we have not admitted before it reaches anything here.
- An owner can delete a workspace and everything in it.
- The site publishes a privacy page and a terms page before the first outside team is invited.
- A card that changes what the preview does with a team's data rewrites the published privacy
  and terms pages in the same delivery.
- The published pages describe what the group actually built before the first outside team is
  invited: the card that adds a workspace, a member, a role, an export or a deletion is the
  card that writes it back onto the pages #330 rewrote for the 0.8.0 relay.
- No model is ever run over a workspace's board content: every agent run stays on an
  execution node, which is what the privacy page commits us to.
- Out of the group: realtime body editing, fine-grained card permissions, automatic dispatch
  across nodes, and any Cloud handling of code.
- Out of the group: any Cloud page at a URL, public or authenticated — the browser surface is
  #322 and ships separately.
- Out of the group: GitHub Issues intake — #313 is an intake door into either board, and a
  team shares a board without it.
- Out of the group: pricing, billing, and the open-source support policy.
- Out of the group: the sign-in that carries a Cloud account, and the admission list itself —
  #326 and #327 decide who reaches the service at all; this group decides who is in a
  workspace. Whether adding a member also admits that account is #314's open question, and is
  the one place this group may write to that list.
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
- **Why this root stays `todo` and never goes `ready`**: it is a tracking card, and a `ready`
  card is offered for delivery. Nothing here is built directly — the subtasks carry the
  status a delivery reads, and #299 is what takes this root off the board once they are all
  finished.
- **Why the Todo runs in that order**: every card in the chain establishes the boundary the
  next one writes against — contract, service, control plane, storage, then clients and
  onboarding, then routing. #323 sits beside #312 rather than behind it, because the contract
  is local work and the service is hosting work, and #314 is the first card that needs both.
  #328 comes after #316 because there is no team event to address until a team's writes reach
  a Cloud board. #321 sat outside the chain: 0.8.0 needs the pages for #327's email, so they
  were written well before the first team is invited.
- **How an operator notice reaches a workspace**: by hand, as one event written against the
  live database — the way #326 admits an account. The terms promise notice in the app or a
  connected Slack channel, never by email, before a workspace is closed, and #325's contract
  already delivers a stored event to both, so no card here builds a broadcast surface for a
  preview whose whole invite list fits on one page.
- **Which card stands the service up**: #323. Every card from #314 on assumes an API on a
  host, a database with a schema, a GitHub app, and somewhere to keep secrets, and no other
  card creates them. #294 is the precedent: standing a service up is its own card, separate
  from the behaviour it serves.
- **Which card gates the endpoints #323 shipped**: #326, before this group — it refuses
  every account it has not admitted, including on the budgeted `/v1/self-check`. #314 adds the
  second gate this group needs: an admitted account still answers for nothing inside a
  workspace it is not a member of.
- **What a card can check before the service is provisioned**: whatever runs from the
  checkout — `cd cloud && npm run lint && npm test`, and a migration read back by
  `npm run migrate -- --dry-run`. 0.8.0 works through `cloud/README.md`'s "Standing up a new
  project" for #325, so a card here that still meets an unprovisioned service records its live
  checks as outstanding instead of reporting a check it did not run.
- **Which card creates an execution node**: #314. #316's leases and #317's node controls need
  a team-owned node identity, so #314 registers a machine as a named node under the member
  signed in on it, and revoking one refuses its next renewal, write, and delivery
  confirmation.
- **Which card carries which of the four problems**: #326 identifies the person and #314 with
  #317 turn that account into a member, #328 routes a question to the owners on top of #325's
  event and action contract, #314 and #316 keep one writer per card, #312 with #314 make every
  card write attributed, and #315 does the same for memory.
- **Why team routing is its own card**: #325 addresses an event to the one account that
  published it — right for a solo board, and nobody on a team — and no other card here
  touches the event contract, since #314 holds the membership an audience is resolved from,
  #316 the clients and #317 the controls. #328 is where the group's second problem is closed.
- **Why #313 is not in the group**: GitHub intake is not on the Cloud critical path — nothing
  in #314 reads or writes what #313 builds, and no team needs it to share a board. It is built
  and checked against a Local board; its Cloud side is checked once #316 lands.
- **Whether a member may still answer a user question**: yes. Owner routing decides who is
  told, not who may write. Per-card permissions are out of the group, so any member who opens
  the card can still Resolve it.
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
- **How a machine gets that sign-in**: #326, before this group. It signs a machine in from
  the app's Configuration dialog into one machine-local session that `akb` reads and that
  refreshes itself, so a long delivery never stops to sign in again. #316 therefore drops its
  own sign-in and sign-out and only reads that session; a member who has never opened the app
  on a machine is told to sign in there, not offered a second flow.
- **What a team execution node is, given that sign-in**: a member's own machine with the app
  installed. #326 rules out signing in without a desktop in 0.8.0, so a headless build server
  cannot be a team node here — which sits with automatic dispatch across nodes, already out of
  the group.
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
- **What the contract still does not carry**: the memory set, the module map, and per-flow
  rules. #312 landed a read for each and a write for none — `refine`, `resolve`, `complete`,
  `reject` and `prune-memory` write `docs/kanban/memory/*.md` as plain file edits, `modules.md`
  is written the same way, and `docs/kanban/rules/` keeps its own exports from
  `cli/src/kanban.ts` that the copy a delivery freezes reads again. On a Cloud board none of
  those files exists, so each of those flows would write a local file nothing ever reads —
  which loses the one attributed memory this group exists to keep. #315 adds the write
  operations when it makes all three workspace content.
- **Where a delivery record lives on a Cloud board**: in the workspace, carried there by #315,
  so a team reads one audit trail rather than one per checkout. #318, now in #325's group,
  keeps only the node-side record — the worktree path and the branch names.
- **Who carries Slack**: #325, which moved #318, #319 and #320 into its own group and connects
  a Slack app rather than taking a webhook URL an owner pastes. #328 extends that connector —
  which channel an owners' question reaches — and picks no transport of its own.
- **Who rewrites the published pages, and when**: #330, in 0.8.0, then this group. The pages
  were written for the workspace this group builds, and 0.8.0 invites people to something else
  entirely, so #330 rewrites them for a single-account relay and takes the workspace, member,
  role and owner-export wording off. Every card here that adds one of those back rewrites the
  paragraph in the same delivery, the way #327 already does for the invitation email.
- **Why this root is blocked by #325**: every subtask starts from #326's session and admitted
  account, #318's execution node, or #319's event contract, and all of them ship in #325. The
  three prose lines saying the group follows 0.8.0 were the only record of it.
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
  Its `api.service_heartbeat()` call is the write that keeps the free Supabase project from
  pausing, and sits outside the daily write budget so a busy day cannot switch it off.
  Nothing sweeps for an expired lease — a mutation compares the stored expiry — so the only
  step #314 adds to that run is its operation-ledger prune, not a schedule of its own. If a
  project ever does pause, an owner resumes it from the Supabase dashboard with its data
  intact.
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
- **How an account reaches the preview**: #327's invitation code, redeemed in the app against
  #326's admitted-account list. Nothing in this group reads or extends that list, and no card
  here builds an admin surface for it.
- **What is stale in the `technology-selection` section**: it predates both the platform
  override, the no-Cloud-page call, and the 0.8.0 scope change, so it still recommends a
  Durable Object, names Cloud pages, assigns #318–#320 to this group, and ends on an open
  question about which plans to run. Those calls are answered above, and only its named
  agent may rewrite the preserved section.
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
- **The preview ships no Cloud page at a URL**: a team works its Cloud board from the
  installed app, which is what this version connects to Cloud, and a Slack action opens that
  app. The hosted browser surface — a public read-only board plus authenticated card review
  and Resolve — is #322, outside 0.8.0. #314 and #317 therefore carry no public-access
  switch, and #320 links into the app instead of a page.

## Source
- The subtasks are the design. `plan.md` held it — the control, board, and codebase planes,
  the revision and writer-lease model, import and export, identity and roles — and was
  deleted in `464b6fc` when #318, #319 and #320 moved to #325; nothing else carries it, so a
  card here states what it needs rather than citing that file.
- `notify-plan.md` — the single-user event, action, desktop inbox, execution-node, and Slack
  plan that #325 ships before this group.
- `docs/kanban/memory/goal.md`, the 团队协作 section — the four problems, the Local/Cloud
  authority split, and the hosted-tier boundary.
