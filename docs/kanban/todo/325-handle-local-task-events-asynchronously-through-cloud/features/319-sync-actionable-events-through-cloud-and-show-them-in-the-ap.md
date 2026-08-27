---
title: Sync actionable events through Cloud and show them in the app
track: features
priority: high
roi: high
status: todo
release: 0.8.0
blocked_by: []
related: [325]
modules: [cloud, local-ui, skill, site]
questions:
  - question: "[user] The Supabase project this card connects to is still not stood up. How should #319 be delivered?"
    mode: single
    options:
      - "Stand it up first — run cloud/README.md's \"Standing up a new project\" and fill in cli/src/lib/cloud/config.ts, so the private channels, the realtime.messages policies and the whole round trip are checked for real. It is the hand step every card from #326 on has been deferring."
      - Against a throwaway project — the migrations, Worker routes and UI land and are checked, and the policies are re-applied to the real project when it exists. Costs the setup twice.
      - Blind — everything lands unchecked and #329 is the first run against a live service. Cheapest now, and it puts every Realtime and RLS mistake in one late card.
    recommend: [1]
verify:
  - "Against the live Supabase project: moving a task to `ready` on this machine lights the bell within seconds, the same event is still there after the app is restarted, and a second signed-in account's Realtime channel receives none of it."
  - The first actionable event asks for the system's notification permission, and clicking the notification opens the app on that card's page; with the silencing switch on, the bell still fills and nothing interrupts.
  - A delivery approved from the bell and left alone raises the outcome notification when it ends and marks its row unread again; answering that same card on the board instead retires its event as stale, with nothing raised and the bell's count going down.
  - "Cloud holds only what the event carries: the task's number, title, release, revision, and its user-owned questions with their options — no other part of the card, and no `[user]` tag in the text a notification shows."
---

Turn local task states that need judgment into durable Cloud events and show them in a
desktop notification center. Today a task that reaches `ready`, or raises a question only
the user can answer, waits silently until someone opens the board. This card fixes the
event, action and outcome contract before #318 executes an approval and #320 carries the
same flow into Slack.

## Worth noting
- **Publication belongs to every local writer**: one shared publisher module ships in the
  desktop app and `akb`, so a change made by the app, the CLI, or an agent raises the
  same event. The cost is a library boundary; publishing from the app alone would be less to
  build and would miss every board change made in a terminal.
- **An event outlives the app being open**: the desktop reads pending events through the
  Worker at every start and reconnect, and publishes actionable tasks it finds with no
  publication on record. The cost is two catch-up paths to keep working; without them a
  restart at the wrong moment loses a `ready` task silently.
- **How long Cloud keeps an event**: while it is unresolved, and then for 30 days after it
  reaches a final outcome — long enough to look back over a week's work, and a period the
  privacy page can state plainly. The cost is that a notification older than that is gone from
  the bell history, and that an event nobody ever answers is never deleted.
- **Being told is the point**: an actionable event raises a system notification as well as
  lighting the bell, because Slack (#320) is not everyone's answer and a bell nobody looks at
  tells nobody anything. The cost is the operating system's permission prompt the first time,
  and a switch beside the board's notification setting for silencing the interruption while the
  bell keeps filling.
- **What the app does not interrupt**: nothing is raised while the app's window is focused —
  the bell lights and the row appears instead, and nothing is raised late to make up for it.
  Dragging a card to `ready` in the window you are looking at would otherwise alert you about
  the thing on screen. The cost is that a card an agent makes actionable while you read a
  different card is told to you only by the bell; the option it beat was interrupting whenever
  the window is not that card's own page, which alerts about work already in front of you.
- **A finished delivery interrupts too**: every final outcome of a delivery a notification
  started raises a second system notification — completed as well as failed, interrupted and
  cancelled — so a run you approved and walked away from tells you it is done. It names the
  outcome rather than repeating the event, and the same switch silences it. The cost is two
  interruptions for one piece of work; the option it beat was interrupting only when something
  needs you, which leaves a clean run to be found in the bell.
- **The bell is a way in, not a second card page**: the notification center is a rail down the
  right of the window, and a row carries the card's number and title with the event's name under
  it and nothing else; opening a row opens that card's own page, where the event's state and its
  actions are. The cost is that a row does not show its event's state, so anyone wanting more
  than the outcome its notification named opens the card — the option it beat was a full view of
  an event, which would restate the card page next to it.
- **The bell carries every board Cloud is on for**: a system notification arrives whatever board
  is open, so a bell that knew only the open board would disagree with the alert that raised it.
  A row names its board once a second board is enabled, and opening a row or its notification
  switches the app to that board and opens the card. The cost is a click that changes the project
  under you; the option it beat was a bell about the board in front of you, which leaves a second
  enabled board telling you nothing.
- **The app acts on the spot**: the card page's **Implement** and **Resolve** do what they do
  today — start the delivery, write the answer — whether or not the task has a live Cloud event,
  because the app is running on the machine that holds the board. The cost is that the app and a
  remote surface reach the same board by two different paths; the option it beat was routing the
  app's own click through Cloud and #318's server, which makes a click in front of you wait on a
  round trip to answer it.
- **One event takes one action**: whichever surface acts first records it, and every other
  surface showing that event is told and stops offering it — #320 redraws its Slack message as
  already answered. The cost is that a message someone is part-way through reading can go dead
  under them; the option it beat was letting two surfaces both act and reconciling afterwards.
- **A question can be answered in the user's own words**: every user-owned question travels with
  its options and the one it recommends, and the user either ticks an option or types an answer,
  exactly as the board's own Resolve works. The cost is that Cloud holds a sentence of the user's
  writing whenever the answer comes from anywhere but this machine; options alone would keep
  every answer a fixed value.

<!-- agent -->

## Today
- #326 landed: one Supabase GitHub sign-in per machine, held in `cli/src/lib/cloud/` and read
  by the desktop app and `akb`. The Worker verifies it against JWKS and refuses an
  unadmitted account in the service's own words. `cloud.accounts` is the row every later table
  hangs `owner_id` off.
- `cli/src/lib/cloud/realtime.ts` already keeps a Realtime client's token fresh
  (`keepAuthorized`). It types the client it needs rather than importing one, so this card is
  where the client is chosen; `cli/` has no runtime dependencies at all and bundles to one
  `dist/kanban.mjs`.
- #331 landed: every board write is awaited, so a publication can hang off one.
- `cloud/` holds the Worker, `0001_service.sql` and `0002_accounts.sql`. There is no board,
  event, delivery, action or outcome table, and the only routes are `/health`, `/v1/session`
  and `/v1/self-check`. `cloud/src/scheduled.ts` runs one hourly heartbeat that later steps
  join rather than adding a schedule of their own.
- The Supabase project is not stood up: `SUPABASE_URL` and `SUPABASE_ANON_KEY` in
  `cli/src/lib/cloud/config.ts` are blank, and `cloud/README.md`'s "Standing up a new project"
  is the list a person runs by hand. Private channels and the `realtime.messages` policies
  cannot be configured or checked until it exists.
- `web/legal/privacy.mdx`'s Data retention section covers site visits, app use, workspace
  content, the account record, the audit trail and email — there is no line for event history.
- Nothing local shows a notification. `kanban-ui/components/Header.tsx` carries the mark, the
  board badge, Goal, the release picker, one tool cluster (Insights, Sessions, Configuration),
  Chat and Create task, and the desktop app raises no system notification anywhere.
- The chat rail (#242) is the shape the bell's rail copies: `Window.tsx` and `lib/chat-rail.ts`
  put one rail down the right of the window, beside the body on a wide window and over it on a
  narrow one, folded away until the header's Chat button opens it.
- `kanban-ui/components/CardPage.tsx` already carries the two controls a Cloud action would
  stand beside: **Implement**, offered by the board's own `canImplement` rule, starts a local
  delivery on the spot, and **Resolve** opens the dialog that ticks one of a question's options
  or types an answer. Both write the local card at once.
- That page's title band carries exactly one mark and says so: a live session's badge, else the
  delivery's pill, else landed, ended, a queued schedule, and finally the status pill.
- The Resolve dialog (`kanban-ui/components/agent-shared.tsx`) answers every question on a card
  in one pass — an option list and a text box per question, ticking and typing clearing each
  other, and a question left blank meaning the agent researches that one.
- The desktop app holds one window over one open board (`desktop/src/main.ts`), and switching
  project loads another board over it — while an account may have Cloud on for several boards.
- The desktop app and a terminal `akb` run the same file: `desktop/scripts/bundle-cli.mjs`
  builds `cli/dist/kanban.mjs` and copies it into `desktop/resources/cli/`, and
  `desktop/package.json` carries no runtime dependency of its own. So `@supabase/realtime-js`
  is one bundle either way, and #325's open question is whether a terminal `akb` connects at
  all — not where the client is installed. Publishing needs `fetch` alone, and
  `cli/package.json` and `cli/README.md` promise Node 18 and no dependencies today.

## Scope
- Keep notifications off until the user enables them on a board and chooses one open release.
- Register each enabled board under a Cloud ID that means nothing outside Cloud, keep the
  mapping from that ID to the board's local path on the machine alone, and name that board on
  every event.
- Raise one event per task, when it enters `ready` or carries user-owned questions, and only
  while its release is the one that board watches; a task in no release raises nothing.
- Run the shared local publisher after every successful desktop, CLI, or agent board write.
- Publish over plain `fetch`, so a terminal `akb` with Cloud off loads no client and keeps
  running on Node 18.
- Record each publication in a local outbox before sending it through the Worker, retry it
  independently of the committed board change, and keep the outbox out of git.
- On start, publish any actionable task on the board that has no publication on record.
- Give each event the authenticated user, board, task number and title, release, current
  revision, requested decision, allowed actions, and either the review it asks for or every
  user-owned question on the card with its options and recommendation — and no other part of
  the card.
- Strip the board's internal question tags from what an event carries.
- Send every event to the one signed-in account; #328 is what gives an event a team audience.
- Store the event, its connector deliveries, human action, and outcome separately so any
  stage can retry without duplicating another.
- Store durable state in Supabase Postgres through the Worker, then send the stored event or
  request ID over a private Supabase Realtime topic authorized by the user's Auth session.
- Authorize account and server topics with RLS policies on `realtime.messages`, subscribe as
  private channels, and apply refreshed JWTs to the live connection.
- On every start and reconnect, read the account's pending events through the Worker before
  listening for hints.
- Refuse an action when its task revision or actionable state is no longer current.
- Retire an event as `stale` when the publisher sees its task leave `ready` or lose its
  user-owned questions with no action on record.
- Carry every board Cloud is on for in one bell, name a row's board only once a second board is
  enabled, and switch the app to that board when a row or its notification is opened.
- Say plainly that a row's board is no longer on this machine rather than switching to it.
- Put the bell first in the header's tool cluster wearing its unread count inside the segment,
  and open a notification rail down the right of the window in the chat rail's place; the right
  side holds one rail at a time, so opening one folds the other.
- Give the rail one row per event, newest change first — the card's number and title, the event's
  name under it, and nothing else — marking an unread row with an accent dot and ink-weight text,
  with clear empty and disabled states.
- Open that card's own page from a row rather than building a second view of an event.
- Give the event's state the card page's one title-band mark only where nothing local already
  speaks there: a delivery's own pill keeps that slot once one is running, so the states the
  event contributes are actionable, accepted, waiting for server, and stale.
- Raise a system notification for each new actionable event, saying what its row says, and open
  the app on that card's page when it is clicked.
- Raise a second system notification when a delivery a notification started reaches a final
  outcome — completed, failed, interrupted, or cancelled — naming that outcome, opening the same
  card page when clicked, and obeying the same silencing switch.
- Mark an event's row unread again when its delivery ends.
- Ask for the system's notification permission the first time one is raised, and keep the bell,
  the rail, and every action working when it is refused.
- Put a switch beside the board's notification setting that stops system notifications while the
  bell keeps filling.
- Keep the card page's **Implement** and **Resolve** acting on the spot on a task that has a live
  Cloud event: the delivery starts and the answer is written locally, exactly as they do today.
- Answer each of an event's questions the way the board's Resolve already allows — a ticked
  option, the user's own words, or neither, and never a tick and words together — and carry
  typed words to Cloud unchanged.
- Record exactly one durable action per event whichever surface takes it, refuse a second, and
  broadcast it so every other surface showing that event stops offering it.
- Read an action taken on this machine as `accepted` and follow it with the delivery's own
  states; reserve `waiting for server` for an action taken elsewhere, which #320 is the first to
  produce and #318's server is what applies.
- Store an event's actionable, accepted, waiting for server, running, completed, failed, stale,
  cancelled, or interrupted state, and show it without creating progress noise.
- Keep an event for as long as it is unresolved, and 30 days after it reaches a final outcome
  delete it with its deliveries, action, and outcome.
- Add that 30-day period to the published privacy page's Data retention section.
- Pause notifications when the selected release closes and ask the user to choose another.

## Todo
- [ ] Add the board record: a Cloud ID per enabled board, the local path held on the machine
      alone, and that board named on every event.
- [ ] Add the Cloud section's per-board notification settings: turning notifications on,
      choosing one open release, and the prompt to choose another when that release closes.
- [ ] Add the two event rules, the watched-release filter, the one-event-per-task message
      carrying every user-owned question, and durable deduplication.
- [ ] Add the shared local publisher to the desktop app and `akb`, sending over plain `fetch`,
      with one local outbox and retry path for qualifying state changes.
- [ ] Publish at start any actionable task with no publication on record.
- [ ] Retire an event as stale when the publisher sees its task leave `ready` or lose its
      user-owned questions with no action on record.
- [ ] Publish through the Worker under the Supabase Auth session, then broadcast stored IDs
      over private Realtime topics.
- [ ] Configure private Realtime channels and account- and server-scoped authorization policies,
      including live JWT refresh.
- [ ] Read pending events through the Worker at every start and reconnect, before listening
      for hints.
- [ ] Record connector delivery, human action, and outcome independently.
- [ ] Add the bell as the tool cluster's first segment with its count inside it, and the rail of
      rows ordered by each event's newest change, sharing the right side with the chat rail, with
      empty and disabled states.
- [ ] Carry every enabled board in the bell, name a row's board once a second is enabled,
      switch the app to that board when a row or its notification is opened, and say so when
      that board is no longer on this machine.
- [ ] Open a card's page from a row, and give the event's state the title band's one mark only
      when no delivery pill already holds it.
- [ ] Raise a system notification for each new actionable event, ask for permission on the
      first one, and open the app on the card's page when it is clicked.
- [ ] Raise a second system notification on a delivery's final outcome, naming the outcome and
      opening the same card page.
- [ ] Mark the event's rail row unread again when its delivery ends.
- [ ] Add the switch that stops system notifications while the bell keeps filling.
- [ ] Keep the card page's Implement and Resolve acting on the spot on a task with a live event,
      and record the same durable Cloud action — every question's answer, blanks included —
      against it.
- [ ] Accept exactly one action per event, refuse a second, and broadcast it so every other
      surface showing that event stops offering it.
- [ ] Return stale or duplicate outcomes and preserve the local task.
- [ ] Reflect meaningful action and execution outcomes on the card page, under the nine state
      names this card fixes.
- [ ] Delete an event and its history 30 days after it reaches a final outcome, as a step in
      the Worker's existing hourly run.
- [ ] Add the 30-day period to the published privacy page's Data retention section.
- [ ] Check the complete desktop message and action flow before adding Slack, including a
      restart with an event and an outcome that both landed while the app was closed.

## By `ui-design` agent

<Mockup src=".mockups/319/a.tsx" label="A" />

<Mockup src=".mockups/319/b.tsx" label="B" />

<Mockup src=".mockups/319/c.tsx" label="C" />

Recommended: **A** — the rail reads as one list at a glance, and the card keeps its one mark in the title band.

## By `technology-selection` agent

| Option | What it is | Pros | Cons |
| --- | --- | --- | --- |
| `@supabase/realtime-js` | Supabase's Realtime client on its own — 2.112.4, MIT, published 24 Aug 2026 from the `supabase-js` monorepo | `RealtimeClient.setAuth()` is exactly the `Authorizable` the board already types; private channels with `{ config: { private: true } }`; heartbeat, backoff, reconnect and rejoin already written | The CLI's first runtime dependency, carrying `tslib` and `@supabase/phoenix` (MIT) into `dist/kanban.mjs`; its `engines` and its use of Node's global `WebSocket` lift the CLI's floor from Node 18 to Node 22 |
| `@supabase/supabase-js` | The whole client — 2.112.4, MIT, same release, wrapping realtime-js with auth, postgrest, storage and functions | One package, and the shape every Supabase doc is written in | Four clients this card never calls, in a bundle that has carried none; its `auth-js` owns a session #326 deliberately keeps in `~/.ai4kanban` and refreshes under its own cross-process lock, so the machine's sign-in would have two owners |
| Write it ourselves | A `WebSocket` against the published Realtime protocol (`vsn` 1.0.0 or 2.0.0) | No dependency to license, upgrade or outlive, and `dist/kanban.mjs` stays a file of ours alone | We keep the heartbeat (25s to the `phoenix` topic), the reconnect, the rejoin and the join timeouts working against a wire format only Supabase versions; the Node 22 floor arrives anyway with global `WebSocket` |

**Pick: `@supabase/realtime-js`** — the one dependency that buys private channels and live `setAuth` without handing this project's own sign-in a second owner.

## Decided by the agent
- **Why this is one card and not two**: the publisher and the notification center check each
  other and nothing else — a pipeline with no bell shows the user nothing, and a bell with no
  pipeline has nothing to show. #325 already split this group where its seams are: the
  contract, the execution, then the connector.
- **How many events one task raises**: one, whatever it carries. The board's Resolve answers
  every question on a card in a single pass, so an event per question would ask the user three
  times for one act and leave #320 three Slack messages to keep in step.
- **What an unanswered question means**: the same as it does in the board's own dialog — the
  agent researches that one. A remote answer may therefore leave questions blank, and #318's
  resolve run reads them exactly as a local Resolve does.
- **Which task raises an event**: one whose release is the one that board watches. A `ready`
  task in another release, or promised to none, is not what the user asked to be told about.
- **Where the event's state sits in a title band that holds one mark**: below the delivery's
  pill. `CardPage.tsx` deliberately never draws two, and once a delivery is running its pill is
  already the local truth about the same work — a second pill beside it would say it twice in
  two vocabularies. So the event contributes the four states no delivery has words for.
- **What this card asks of `akb`**: publication over `fetch`, and nothing more. The desktop app
  and a terminal `akb` run the same `cli/dist/kanban.mjs`, so `@supabase/realtime-js` is one
  bundle either way — but it is loaded on the connect path alone, which only the app is on
  here, so a terminal `akb` with Cloud off still runs on Node 18. #325's open question, whether
  a terminal `akb` connects too, is #318's need rather than this card's.
- **Why the outbox retry is not enough on its own**: the board write and the outbox row are
  not one transaction, so a crash between them leaves a `ready` task nothing will ever retry.
  The scan at start is what closes that gap.
- **Where a remote answer is applied**: on the local machine by #318's server, the same way a
  remote approval is — `notify-plan.md` steps 5 to 9 are the path a surface that is not this
  machine takes, and the app's own card page does not use it. #318's Scope names only
  **Implement** today and has to carry an answer request too.
- **What a click does when Cloud is unreachable**: it starts the delivery or writes the answer
  anyway, and the Cloud action joins the publisher's local outbox and is retried like a
  publication. Nothing on the board waits for the network.
- **How a row names its board**: on the event's line, and only once a second board has Cloud on,
  so the ordinary single-board rail keeps the row this card designed.
- **Where the bell's rail sits**: on the right, in the chat rail's place, so the board keeps its
  full width and opening one rail folds the other. Two rails down the same side at once would
  leave the board a column between them.
- **Where a board turns notifications on**: the Cloud section of Configuration
  (`kanban-ui/components/Cloud.tsx`), which #326 already gave the machine's sign-in. The
  enabling switch, the release it watches, and the switch that silences system notifications
  are one group there rather than a second Cloud screen.
- **How the outcome path is checked before #318 exists**: against an outcome written straight
  through the Worker. This card stores and renders all nine states, and #318 is the first thing
  that produces `running` or `completed` from a real delivery — so the second notification and
  the row going unread again are checked against a recorded outcome, not a run.
- **What a system notification says**: the row's words — the card's number and title, and the
  event's name. A second wording for one event is a second thing to keep true. The outcome
  notification is the one exception: it carries the outcome instead of the event's name, because
  repeating the name would say only what the first notification already said.
- **Why a stale event raises nothing**: `stale` retires an event no delivery ever started, and the
  user is the one who answered it on the board a moment earlier. The second notification reports a
  run's end, so an event that never became a run has no end to report.
- **An outcome found at catch-up still interrupts**: the start and reconnect read raises the
  notification for a delivery that ended while the app was closed, because the app cannot tell a
  user who walked away from one who shut the laptop — and that is the case the second notification
  exists for.
- **What closes an event nobody acted on**: the publisher that already runs after every board
  write. It sees the task leave `ready` or lose its question and retires the event as `stale`,
  so a user who answered on the board is not asked the same thing twice from the bell.
- **Why the nine state names are fixed here**: the desktop, Slack, and the execution server all
  render one durable row, so a name invented in one of them shows the user two words for one
  outcome. This card names them because it stores them first.
- **Which events the 30 days applies to**: the five final outcomes — completed, failed, stale,
  cancelled, and interrupted. An event still actionable, accepted, waiting for server, or running
  is live work and is kept however old it is.
- **What deletes them**: a step in the Worker's existing hourly scheduled run, which
  `cloud/src/scheduled.ts` is built to collect such steps in, rather than a schedule of its own.
  It sits outside the daily write budget like the heartbeat does: a busy day must not switch off
  the sweep that frees space.
- **Why the privacy page is edited from this card**: the retention period is a fact this card
  introduces, so the published page changes with it rather than waiting; #330 re-reads the
  whole Cloud section afterwards.
- **Why `site` is in `modules`**: the card writes `web/legal/privacy.mdx`, so the module whose
  memory records that change has to be one of the card's.

### Overruled by the user
- **A question goes to the owners**: no card names a person in this release (#311), so a
  user-owned question is addressed to the workspace's owner role and a ready-for-review card
  to everyone watching the release. Routing a question to a named member waits for the
  version that gives a card an assignee.

  That rule now belongs to #328, which addresses a Cloud board's event to a workspace
  audience. It stands there rather than here because this release ships no workspace, no
  membership, and no roles to resolve an audience from — the one signed-in account is the
  whole audience, and #328 replaces that with the owners and watchers above.

- **What shape the notification center takes**: a rail like the chat rail, listing rows that
  carry the card's number and title with the event's name under them and nothing more, and a row
  opens that card's page. No second page is drawn for an event, because it would duplicate the
  card page. The `ui-design` section's **A** draws it — the bell leading the tool cluster with its
  count inside the segment, an unread row as an accent dot and ink-weight text, and the event's
  state in the card's title band.

- **Does the app's own card page wait on Cloud to act?**: no. **Implement** and **Resolve** act
  at once, so a click in front of the user never waits for a round trip. The action is recorded
  once and pushed out, and Slack's message for that event is redrawn as already answered rather
  than the app waiting to hear from it.

## Source
- `notify-plan.md` — "Events", "End-to-end flow" and "Reliability and security rules": the
  contract this card fixes and the nine state names it stores.
- #325 — the group, and why this card is second in its order.
- #326 — the machine's sign-in, `cloud.accounts`, and `keepAuthorized` in
  `cli/src/lib/cloud/realtime.ts`.
- #331 — the awaited board write the publisher hangs off.
- #318 and #320 — the server and the connector that read this card's states and actions.
- #330 — the sweep that re-reads the retention line this card writes.
- #242 — the chat rail whose right-hand place and folding the bell's rail shares.
- `docs/kanban/memory/cloud/decisions.md` — the 30-day retention and the desktop-first order.
- `docs/kanban/memory/local-ui/decisions.md` — where the chat rail lives, and the board's rule
  that an answer is either a ticked option or typed words, never both.
