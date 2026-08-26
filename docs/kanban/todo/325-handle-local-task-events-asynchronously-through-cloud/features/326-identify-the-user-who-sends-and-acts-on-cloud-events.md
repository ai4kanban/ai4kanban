---
title: Identify the user who sends and acts on Cloud events
track: features
priority: high
roi: high
status: ready
release: 0.8.0
blocked_by: []
related: [325, 327]
modules: [cloud, local-ui, skill]
questions: []
---

Give the Cloud relay one Supabase Auth account shared by the desktop app, `akb`, and Slack.
The service #323 already verifies Supabase JWTs; this card adds GitHub sign-in, durable session
refresh, invite-only admission, and the account record that owns every later #325 event,
action, connector, and execution node.

## Worth noting
- **Who may sign in to the relay?**: only an account we have admitted, keeping Cloud the
  invite-only preview #311 settled, so hosting cost stays where that decision put it. The
  cost is paid in the open: 0.8.0 is a public release whose headline is the asynchronous
  flow, and everyone outside the preview meets a refusal explaining it rather than the
  feature. The option it beat was open GitHub sign-up capped by a per-account write budget.
- **What a refused person can do about it**: press **Request an invite** in the refusal. The
  request is recorded against their account and emailed to `support@ai4kanban.dev`, which we
  answer by hand. Nothing is built on the site — no waitlist page, no queue, no public
  thread — so 0.8.0 adds one button rather than a surface to maintain. The costs: a request
  is answered whenever someone reads that mailbox, with no promise of when, and the preview
  now holds a requester's email address, which #321's privacy page has to list. The options
  it beat were a GitHub Discussion, which needs a GitHub account and puts the ask beside
  unrelated threads, and no link at all.
- **Where does the Cloud account surface live?**: a section of the Configuration dialog,
  below the settings that belong to the board and separated from them, because the sign-in
  is one machine's rather than one board's. The cost is two clicks to reach it and an
  expired sign-in that stays invisible until something needing Cloud fails. It beat an
  account control in the window's top row and a Cloud page in the rail.
- **Signing in needs the app, once per machine**: the sign-in starts in the Configuration
  dialog and nowhere else, so someone who only ever runs `akb` in a terminal opens the app
  once and never again. Giving the command a consent flow of its own would be a second
  sign-in to build and keep working for a step taken once. The cost is that a machine with
  no desktop — a server, a container, a remote shell — cannot reach Cloud in 0.8.0.
- **One Supabase session serves every Cloud path**: its GitHub provider issues and refreshes
  the session shared by the app and `akb`; refresh must update both Worker requests and the
  live Realtime identity together.
- **Authentication is not team membership**: 0.8.0 needs one account boundary per user, not
  workspaces, invitations, roles, or shared-board permissions. The cost is that #314 revisits
  this account record when teams ship, rather than inheriting one built for them.
- **The account is the person, not the project or the machine**: one sign-in covers every
  project the app has open and every terminal on that machine, because a relay carries one
  person's decisions. Two people sharing a login on one machine therefore share the relay in
  0.8.0; separating them needs the membership #314 owns.

<!-- agent -->

## Today
- `cloud/src/auth.ts` verifies a Supabase sign-in token against the project's JWKS and
  returns its subject, email, provider, and expiry. `GET /v1/session` hands that back, and
  the Worker holds no signing secret.
- The Worker stops there. Any signed-in GitHub account can call `/v1/session` and
  `/v1/self-check` and spend the day's write budget — #323 recorded this as open, because
  membership was #314's and #314 is in no release.
- A refusal already carries a machine-readable `code` beside a message written to be shown
  as it stands — `{ error: { code, message } }` — and the `RefusalCode` union in
  `cloud/src/errors.ts` is the list a client matches on.
- Cloud's schema holds no account and no board table: `cloud` has the day's write counter and
  the heartbeat, `api` has the functions the Worker calls, and neither schema grants anything
  to `anon` or `authenticated`. A mutation is one `api` function and one transaction.
- `cloud.daily_writes` counts the whole service's writes for a day, not one account's.
- `api`'s functions are `security definer` inside the Supabase project's own database, so one
  can read `auth.identities` — the copy of a GitHub profile the provider rewrites on every
  sign-in. A sign-in token carries no such copy: `user_metadata` is the account holder's to
  rewrite through Auth, and nothing fills `app_metadata`.
- Nothing admits anybody. There is no list of who is in the preview and no way to add to one.
- The site has no invite page, no waitlist, and no contact address on any page.
  `support@ai4kanban.dev` is the mailbox #321 introduces on the site's own domain and routes
  with Cloudflare Email Routing; neither the mailbox nor those pages exist yet.
- The Worker sends no mail and has no `send_email` binding. Cloudflare charges nothing for a
  send to a verified destination address on any plan, including the Workers free plan the
  preview runs on; sending to any other recipient needs Workers Paid.
- The Supabase project, its GitHub OAuth app, and the `api.ai4kanban.dev` route are not
  created yet. `cloud/README.md`, "Standing up a new project", is the list a person runs by
  hand.
- Nothing in the desktop app, `kanban-ui/`, or `cli/` mentions Cloud or a sign-in. The app's
  only between-launch state is a `settings.json` under Electron's app-data folder, documented
  as hand-editable and holding nothing secret; `akb` keeps nothing outside the repository, and
  `.akb/` is repo-local and git-ignored.
- The Configuration dialog holds Harness, Agents, Auto-delivery, Rules and Setup — every one
  of them a setting of the board this window has open.
- The board UI server binds whatever loopback port the OS hands out at launch, so the address
  a browser would come back to after a sign-in is different every time. The app registers no
  URL scheme of its own, and its window reaches the main process over a `window.ai4kanban`
  bridge that a plain browser does not have.
- The local execution node is the board UI server the desktop app starts per project, and it
  is stopped when that project has nothing running. `akb` also runs from a terminal with no
  app open, and #319 needs events from CLI-caused changes too.

## Scope
- Sign in and out through Supabase Auth's GitHub provider from a **Cloud** section of the
  Configuration dialog, listed after the board's own settings and separated from them.
- Start the sign-in from the app alone: the consent screen opens in the user's own browser
  and the answer comes back to the app. A terminal `akb` reads the session the app wrote and
  never starts one of its own.
- Give that section one state per answer a sign-in can come back with: not signed in,
  signed in and admitted, signed in but not admitted, and expired — each saying what the user
  can do next.
- Show the signed-in account's name and handle there, and let the user sign out; signing out
  stops this machine reaching Cloud and changes nothing already on the board.
- Leave the rest of the app as it is today when nobody is signed in: no new header control,
  no prompt, and no board behaviour that depends on Cloud.
- Record one account on first sign-in, keyed on the verified sign-in subject, and make it the
  owner every later #325 row hangs off.
- Keep a list of the accounts admitted to the preview, and let a person add to and remove
  from it by hand without deploying the Worker.
- Match that list on the handle the identity provider attests for the sign-in, so a
  hand-written row admits the account GitHub says owns that name.
- Refuse every account not on that list, with a message that says Cloud is an invite-only
  preview and what to do about it.
- Leave two routes open to a verified sign-in that is not admitted: the one that reports the
  session, so the app can name the account and say whether a request is already made, and the
  one that takes an invite request. Every other route refuses.
- Offer **Request an invite** in the not-admitted state, and record the request against the
  signed-in account so pressing it again neither writes a second row nor sends a second email.
- Send that request to `support@ai4kanban.dev` after the response has been returned, so a slow
  or failing mail send never delays or fails the sign-in; the recorded request, not the mail,
  is what an answer is written from.
- Put in the request only what the sign-in already verified — the GitHub handle, the account's
  email address, and when it was asked — and address the reply to the requester so answering
  is one click.
- Show the request's state beside the button once it is made, along with
  `support@ai4kanban.dev` in plain text so someone whose request failed can write directly.
- Give the Worker one owner check that every #325 route applies, so #318's execution nodes,
  #319's events and actions, and #320's connectors attach to an existing rule rather than
  each inventing an owner column and a check of their own.
- Hold the session on the machine, outside the board and the repository, so the board UI
  server and a terminal `akb` act as the same account without a second sign-in.
- Keep the session across ordinary desktop restarts, and refresh it without interrupting a
  delivery already running.
- Supply the refreshed Supabase JWT to private Realtime topics as well as Worker requests.
- Let one process refresh at a time: a refresh takes a lock on the session file, and a process
  that finds the file newer than what it read takes what is there rather than refreshing
  again, so two readers never sign the user out by racing.
- Refuse a missing, expired, malformed, or unadmitted sign-in with a reason the app and the
  command show as it stands, and give not-admitted a refusal code of its own so a client never
  answers it with "sign in again".
- Refuse a request that names a row belonging to another account, whatever the row is.
- Expose the account handle #320 links a Slack actor to, taken from what the identity
  provider attests rather than from anything the account can rewrite.
- Out of scope: invitation codes and self-serve admission (#327), any invite or waitlist page
  on the site, and the workspaces, roles, and shared-board permissions #314 owns.

## Todo
- [ ] Add the account record, the admitted-accounts list, and the invite-request record to
      Cloud's schema.
- [ ] Read the sign-in's provider-attested handle from `auth.identities` inside the `api`
      function that admits and records an account, never from a token's `user_metadata`.
- [ ] Add the Worker's owner check: refuse missing, expired, malformed, and unadmitted
      sign-ins with their own codes and a message a client shows as it stands, and leave open
      only the session and invite-request routes to an account that is not admitted.
- [ ] Take an invite request on its own route: one open request per account, recorded inside
      the transaction, and the email sent after the response returns over a `send_email`
      binding restricted to the one support recipient.
- [ ] Add Supabase Auth GitHub sign-in and sign-out to the Cloud section, with its
      not-signed-in, signed-in, not-admitted, and expired states, and **Request an invite**
      with its requested state.
- [ ] Bring a finished sign-in back into the app over a URL scheme it registers for itself,
      and hand it to the open Configuration dialog.
- [ ] Hold the session on the machine outside the board and the repository, and read it from
      both the board UI server and a terminal `akb`.
- [ ] Refresh an expiring session under a lock on that file, without interrupting a running
      delivery, keep it across a restart, and update the private Realtime connection.
- [ ] Expose the account handle #320 links a Slack actor to.
- [ ] Write admitting an account, removing one, registering the sign-in's return address, and
      enabling email sending against the verified support mailbox into `cloud/README.md`,
      beside standing the project up.
- [ ] Add the invite request to #321's privacy page scope — the handle and email address it
      holds, and that it is emailed to `support@ai4kanban.dev`.
- [ ] Check that a second signed-in account reaches nothing belonging to the first, that an
      account never admitted reaches nothing but the two open routes, that a request pressed
      twice sends one email, and that two processes refreshing at once leave one working
      session.

## By `ui-design` agent

<Mockup src=".mockups/326/a.tsx" label="A" />

<Mockup src=".mockups/326/b.tsx" label="B" />

<Mockup src=".mockups/326/c.tsx" label="C" />

Recommended: **A** — the sign-in is one machine's, not one board's, and the Configuration dialog is already where this app keeps what a machine settles.

## Decided by the agent
- **How an account is admitted**: by hand, one row naming a GitHub handle, run the way the
  project is already stood up. The preview admits people one at a time, so an admin screen
  would be built for a list read far more often than it is written, and it would be the
  second privileged surface on a service that today answers nobody but its own Worker.
  #327 replaces the hand step with an invitation code once the preview outgrows it.
- **Where a finished sign-in comes back to**: the app, over a URL scheme it registers for
  itself. The board UI server's loopback port is whatever the OS hands out at launch, so no
  fixed address can be registered with the Supabase project, and the app is where the session
  file is written anyway. The consent screen still opens in the user's own browser, which
  already holds their GitHub session.
- **Where the trusted handle is read from**: `auth.identities` in the Supabase project's own
  database, through an `api` function — the record the provider rewrites on every sign-in. A
  Supabase access token carries only `user_metadata`, which the account holder can rewrite
  through Auth, so neither admission nor #320's Slack link may read a handle from a token.
- **Why two routes stay open before admission**: the not-admitted state has to name the
  account and say whether a request is already made, and the request has to be takeable.
  Refusing those two as well would leave a refused person a dead end with nothing to press.
- **Does each account get a write budget of its own?**: no — the day's budget stays one
  counter for the whole service. Admission is what bounds the load while the preview holds a
  handful of accounts, and a per-account budget belongs to the release that opens sign-up.
- **What the button says**: **Request an invite** — the plainest name for what pressing it
  does, and the words the refusal already uses.
- **Where the Worker sends the request**: the verified Email Routing destination behind
  `support@ai4kanban.dev`, with the requester as the reply address. Cloudflare charges
  nothing for a send to a verified destination on any plan, while sending to any other
  recipient needs Workers Paid, and the preview is $0 a month.
- **When the request may first be taken**: not before #321's pages are live, because the
  request is the first personal data the preview keeps. Those pages are already promised
  before the first outside team is invited, so this fixes an order rather than adding a
  requirement.
- **Does the preview still send no email?**: yes, as #321's terms mean it — no notice is
  emailed to a user. The one message is our own request mail to our own mailbox, sent because
  the user pressed a button.
- **What the request asks the user for**: nothing. The button is one click, because the
  sign-in already attests everything a hand-run admission needs, and a "why do you want in"
  box would be a form nobody has agreed to read.
- **What we promise about a reply**: no time at all. Naming a period would bind a mailbox one
  person reads, and a promise we break costs more than one we never made.
- **Where the session lives on the machine**: a per-user file in the user's home directory,
  readable by its owner alone and outside every repository. The app's Electron app-data
  `settings.json` cannot serve: a terminal `akb` has no access to it, and it is documented as
  hand-editable and holding nothing secret. Electron's `safeStorage` would bind the session to
  the OS keychain, but only the app could then read it, and #319 needs `akb` to publish events
  from a terminal.
- **What the local execution node authenticates as**: the signed-in user's own session, not a
  credential of its own. The node is the board UI server the app starts, or a terminal `akb`,
  both on the user's machine and both reading the same file. #318 registers the node itself.
- **Why the account is created on first sign-in**: the verified token already carries the
  subject and the GitHub profile, so a separate provisioning step would add a screen and a
  state without adding a fact. Admission is the gate; the record is a consequence of it.
- **Why `skill` joins the card's modules**: `cli/` reads the same session, because #319
  publishes events from CLI-caused board changes with no app open.

## Source
- #323 — the Cloud service, its schema, and the Supabase sign-in it verifies.
- #311 and `docs/kanban/memory/cloud/decisions.md` — the GitHub consent screen with no
  scopes, and the invite-only preview.
- #321 — `support@ai4kanban.dev`, the mailbox this card's request goes to, and the privacy
  page that has to list what the request holds.
- #327 — the invitation code that replaces admitting an account by hand.
- #318, #319, #320 — the execution nodes, events, actions, and connectors that hang off this
  card's account.
- Supabase Auth — `user_metadata` is the account holder's to rewrite and never carries
  authorization; `auth.identities` is the provider's own record of a sign-in.
- Cloudflare Email Service: sending to a verified destination address is free on every plan;
  any other recipient needs Workers Paid.
