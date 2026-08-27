---
title: Sync actionable events through Cloud and show them in the app
track: features
priority: high
roi: high
status: implementing
release: 0.8.0
blocked_by: []
related: [325]
modules: [cloud, local-ui, skill, site]
questions: []
verify:
  - "Against the live Supabase project: moving a task to `ready` on this machine lights the bell within seconds, the same event is still there after the app is restarted with nothing interrupting on the way in, and a second signed-in account's Realtime channel receives none of it."
  - The first actionable event raised while the window is not focused asks for the system's notification permission, and clicking the notification opens the app on that card's page; with the window focused nothing is raised and only the bell moves, and with the silencing switch on the bell still fills and nothing interrupts.
  - A delivery started from a card opened out of the bell and then left alone raises the outcome notification when it ends, focused window included, and marks its row unread again; answering that same card on the board instead retires its event as stale, with nothing raised and the bell's count going down.
  - A card revised while its event is live keeps one row in the bell, bound to the new revision and interrupting nobody; answering the last question on a `ready` card turns that same row into the approval.
  - "Cloud holds only what the event carries: the task's number, title, release, revision, and its user-owned questions with their options — no other part of the card, and no `[user]` tag in the text a notification shows."
---

Turn the local task states that need a person's judgment into durable Cloud events, and show
them in a desktop notification center. Today a task that reaches `ready`, or that raises a
question only the user can answer, waits unseen until someone opens the board. This card fixes
the event, action and outcome contract, before #318 executes an approval on it and #320 carries
the same flow into Slack.

## Worth noting
- **When the app interrupts, and when only the bell moves**: an actionable event raises a system
  notification unless the app's window is focused; while it is focused the bell lights, the row
  appears, and nothing is raised later to make up for it. A delivery's final outcome interrupts
  a focused window too, so a run the user approved and walked away from can still reach them.
  Opening the app raises nothing at all — everything waiting fills the bell in front of the
  person who just opened it. The costs are the operating system's permission prompt on the first
  notification and two interruptions for one piece of work, and one switch beside the machine's
  sign-in silences every board's interruptions while the bell keeps filling. The option it beat
  was the bell alone, which reaches nobody who is not already in the app.
- **How long Cloud keeps an event**: while it is unresolved, and then for 30 days after it
  reaches a final outcome — long enough to look back over a week's work, and a period the privacy
  page can state plainly. The cost is that the bell's history loses anything older, and that an
  event nobody ever answers is never deleted.
- **One bell for every board Cloud is on for**: a system notification arrives whichever board is
  open, so a bell that knew only the open board would disagree with the alert that raised it. A
  row names its board once a second board is enabled, and opening a row or its notification
  switches the app to that board and opens the card. The cost is a click that changes the open
  project; the option it beat was a bell scoped to the board in front of the user, which would
  say nothing about a second enabled board.

<!-- agent -->

## Today
- #326 landed: one Supabase GitHub sign-in per machine, held in `cli/src/lib/cloud/` and read by
  the desktop app and `akb`. The Worker verifies it against JWKS and refuses an unadmitted
  account in the service's own words. `cloud.accounts` is the row every later table hangs
  `owner_id` off.
- `cli/src/lib/cloud/realtime.ts` already keeps a Realtime client's token fresh
  (`keepAuthorized`), and types the client it needs rather than importing one — so this card is
  where the client is chosen. `cli/` has no runtime dependencies and bundles to one
  `dist/kanban.mjs`.
- #331 landed: every board write is awaited, so a publication can hang off one. Every one of them
  goes through the single `BoardProvider` `cli/src/lib/board/index.ts` hands out, so the publisher
  has one seam to sit on rather than a hook per caller.
- `.akb/` at the repository root already holds state that never belongs in git, and
  `writeRootIgnoreIfMissing` in `cli/src/lib/paths.ts` puts its one ignore line there.
- `cli/src/lib/board/revision.ts` already derives a card's revision as a hash of its file. The
  revision an event carries and an action binds is therefore the one the board's own conflict
  check already uses, and a card edited by hand still gets a revision that moved.
- `cloud/` holds the Worker and `0001_service.sql`, `0002_accounts.sql` and `0003_invitations.sql`.
  There is no board, event, delivery, action or outcome table, and the only routes are `/health`,
  `/v1/session` and `/v1/self-check`. `cloud/src/scheduled.ts` runs one hourly heartbeat that
  later steps join rather than adding a schedule of their own.
- The service is live: the Supabase project stands in `eu-central-1` with all three migrations
  applied and PostgREST closed to everyone but the Worker, `cli/src/lib/cloud/config.ts` carries
  its URL and publishable key, and the Worker answers on `api.ai4kanban.dev`. So this card's
  private channel and its `realtime.messages` policy are configured against the real project.
- `web/legal/privacy.mdx`'s Data retention section covers site visits, app use, workspace
  content, the account record, the audit trail and email — there is no line for event history.
- Nothing local shows a notification. `kanban-ui/components/Header.tsx` carries the mark, the
  board badge, Goal, the release picker, one tool cluster (Insights, Sessions, Configuration),
  Chat and Create task, and the desktop app raises no system notification anywhere.
- The chat rail (#242) is the shape the bell's rail copies: `Window.tsx` and `lib/chat-rail.ts`
  put one rail down the right of the window — beside the body on a wide window, over it on a
  narrow one — folded away until the header's Chat button opens it.
- `kanban-ui/components/CardPage.tsx` already carries the two controls a Cloud action would stand
  beside: **Implement**, offered by the board's own `canImplement` rule, starts a local delivery
  on the spot, and **Resolve** opens the dialog that ticks one of a question's options or types
  an answer. Both write the local card at once.
- That page's title band carries exactly one mark and says so: a live session's badge, else the
  delivery's pill, else landed, ended, a queued schedule, and finally the status pill.
- The Resolve dialog (`kanban-ui/components/agent-shared.tsx`) answers every question on a card
  in one pass — an option list and a text box per question, ticking and typing clearing each
  other, and a question left blank meaning the agent researches that one.
- The desktop app holds one window over one open board (`desktop/src/main.ts`), and switching
  project loads another board over it — while an account may have Cloud on for several boards.
  It runs a board server per project and keeps a backgrounded one alive while a run is going in
  it, so more than one is signed in as the same account at once; `BoardServers` already writes
  which project is on screen to its `open-project` file, which is how a server tells whether it
  is the one the window is showing.
- The desktop app and a terminal `akb` run the same file: `desktop/scripts/bundle-cli.mjs` builds
  `cli/dist/kanban.mjs` and copies it into `desktop/resources/cli/`, and `desktop/package.json`
  carries no runtime dependency of its own. So `@supabase/realtime-js` is one bundle either way,
  and #325's open question is whether a terminal `akb` connects at all — not where the client is
  installed. Publishing needs `fetch` alone, and `cli/package.json` and `cli/README.md` promise
  Node 18 and no dependencies today. The app spawns that file under Electron's own Node
  (`ELECTRON_RUN_AS_NODE=1`, `desktop/src/lib/node-binary.ts`), which Electron 43 puts at Node 22
  — so the connect path meets its floor inside the app whatever `node` the machine has.

## Scope
- Keep notifications off until the user enables them on a board and chooses one open release,
  and say so on a board that has no open release to watch.
- Pause notifications when the watched release closes, and ask the user to choose another in the
  rail, where the filling stopped, rather than only in Configuration.
- Register each enabled board under a Cloud ID that means nothing outside Cloud, keep that ID's
  mapping to the board's local path on the machine alone, and name that board on every event.
- Raise one event per task, when it enters `ready` or carries user-owned questions, and only
  while its release is the one that board watches; a task in no release raises nothing.
- Ask the question rather than the approval when a task is both `ready` and carrying user-owned
  questions.
- Refresh a live event in place when its task is still actionable but has moved — a new revision,
  a changed question list, or an approval where a question stood — rather than raising a second
  event, and interrupt nobody for the refresh.
- Publish the tasks a board is already holding actionable when its notifications are first
  turned on, filling the bell without raising a system notification for any of them.
- Run the shared local publisher after every successful desktop, CLI, or agent board write.
- Publish over plain `fetch`, so a terminal `akb` loads no Realtime client and keeps running on
  Node 18 whether or not the board has Cloud on.
- Record each publication in a local outbox before sending it through the Worker, and retry it
  independently of the committed board change. The outbox goes in the board's `.akb/`, which the
  board already keeps out of git, so no repository gains an ignore rule for Cloud.
- On start, reconcile the board against Cloud: publish any actionable task with no publication
  on record, refresh any live event whose task has moved under it, and retire any whose task is
  no longer actionable.
- Give each event the authenticated user, board, task number and title, release, current
  revision, requested decision, allowed actions, and either the review it asks for or every
  user-owned question on the card with its options and recommendation — and no other part of
  the card.
- Strip the board's internal question tags from what an event carries.
- Send every event to the one signed-in account; #328 is what gives an event a team audience.
- Store the event, its connector deliveries, human action, and outcome separately, so any stage
  can retry without duplicating another.
- Store durable state in Supabase Postgres through the Worker, then send the stored event or
  request ID over a private Supabase Realtime topic authorized by the user's Auth session.
- Authorize the account's own topic with an RLS policy on `realtime.messages`, subscribe to it
  as a private channel, and apply refreshed JWTs to the live connection; #318 adds the server's
  topic with the server row it introduces.
- Keep one live connection however many boards are enabled: the board server the window is
  showing subscribes for all of them, and a backgrounded board server publishes over `fetch`
  without subscribing or interrupting anyone.
- On every start and reconnect, read the account's pending events through the Worker before
  listening for hints.
- Refuse an action when its task's revision or actionable state is no longer current.
- Retire an event as `stale` when the publisher sees its task stop being one this board raises
  events for — it left `ready`, lost its user-owned questions, or left the watched release —
  with no action on record.
- Carry every board Cloud is on for in one bell, name a row's board only once a second board is
  enabled, and switch the app to that board when a row or its notification is opened.
- Say plainly that a row's board is no longer on this machine, rather than switching to it.
- Retire a board's live events when its notifications are turned off.
- Put the bell first in the header's tool cluster wearing its unread count inside the segment,
  and open a notification rail down the right of the window in the chat rail's place; the right
  side holds one rail at a time, so opening one folds the other.
- Give the rail one row per event, newest change first — the card's number and title, the event's
  name under it, and nothing else — marking an unread row with an accent dot and ink-weight text,
  with clear empty and disabled states.
- Open that card's own page from a row, rather than a second view of the event.
- Let the event contribute the card page's one title-band mark only where no local mark already
  holds it: the actionable, accepted, waiting for server, and stale states, coming last in that
  band's order and taking only the slot the status pill would hold.
- Raise a system notification for each new actionable event, saying what its row says, and open
  the app on that card's page when it is clicked — but raise nothing while the app's window is
  focused, and nothing later to make up for it.
- Raise a second system notification when a delivery with a Cloud action recorded against its
  event reaches an outcome the user did not just perform — completed, failed, or interrupted —
  naming that outcome, raising it whether or not the window is focused, opening the same card
  page when clicked, and obeying the same silencing switch. A delivery the user cancelled moves
  its row and raises nothing.
- Raise neither of them for what a start's catch-up read finds: the bell fills in front of the
  person who just opened the app. A reconnect's catch-up raises both, because the window may
  have been sitting unwatched the whole time it was down.
- Mark an event's row unread again when its delivery ends, clear that mark when the row is
  opened, and clear it without raising anything when the event is retired as stale.
- Ask for the system's notification permission the first time one is raised, and keep the bell,
  the rail, and every action working when it is refused.
- Put one switch beside the machine's sign-in that stops every board's system notifications while
  the bell keeps filling.
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
- Say on the published privacy page what an event holds, and that Cloud keeps it for 30 days
  after its final outcome.

## Todo
- [ ] Add the board record: a Cloud ID per enabled board, the local path held on the machine
      alone, and that board named on every event.
- [ ] Add the Cloud section's per-board notification settings: turning notifications on,
      choosing one open release, the prompt in the rail to choose another when that release
      closes, and retiring that board's live events when it is turned off.
- [ ] Add the two event rules, the watched-release filter, the one-event-per-task message
      carrying every user-owned question with the board's internal tags stripped, the question
      winning when a task is both, durable deduplication, and the in-place refresh of a live
      event whose task moved but is still actionable.
- [ ] Add the shared local publisher to the desktop app and `akb` on the one `BoardProvider`
      seam, sending over plain `fetch`, with its outbox and retry path in the board's `.akb/`.
- [ ] Reconcile at start and when a board's notifications are first turned on: publish an
      actionable task with no publication on record, refresh a live event whose task moved under
      it, retire one whose task is no longer actionable, and raise nothing for that fill.
- [ ] Retire an event as stale when the publisher sees its task leave `ready`, lose its
      user-owned questions, or leave the watched release, with no action on record.
- [ ] Publish through the Worker under the Supabase Auth session, then broadcast stored IDs over
      the account's private Realtime topic.
- [ ] Configure the account's private Realtime channel and its authorization policy, including
      live JWT refresh, subscribed by the board server the window is showing and by no other.
- [ ] Read pending events through the Worker at every start and reconnect, before listening for
      hints, raising nothing for a start's catch-up and both notifications for a reconnect's.
- [ ] Record connector delivery, human action, and outcome independently.
- [ ] Add the bell as the tool cluster's first segment with its count inside it, and the rail of
      rows ordered by each event's newest change, sharing the right side with the chat rail, with
      empty and disabled states.
- [ ] Carry every enabled board in the bell, name a row's board once a second is enabled, switch
      the app to that board when a row or its notification is opened, and say so when that board
      is no longer on this machine.
- [ ] Open a card's page from a row, and give the event's state the title band's one mark only
      when no local mark already holds it.
- [ ] Raise a system notification for each new actionable event except while the app's window is
      focused, ask for permission on the first one, and open the app on the card's page when it
      is clicked.
- [ ] Raise a second system notification when a delivery with a Cloud action recorded against its
      event completes, fails, or is interrupted — focused window included, naming the outcome and
      opening the same card page — and none when the user cancelled it.
- [ ] Mark the event's rail row unread again when its delivery ends, clear the mark when the row
      is opened, and clear it when the event is retired as stale.
- [ ] Add the one switch beside the machine's sign-in that stops every board's system
      notifications while the bell keeps filling.
- [ ] Keep the card page's Implement and Resolve acting on the spot on a task with a live event,
      and record the same durable Cloud action against it, carrying an answer for each question
      that event holds, blanks included.
- [ ] Accept exactly one action per event, refuse a second, and broadcast it so every other
      surface showing that event stops offering it.
- [ ] Refuse a stale or duplicate action, name which it was, and leave the local task unchanged.
- [ ] Store the nine state names this card fixes, and move an event through them as its action
      and its delivery's outcome land.
- [ ] Delete an event and its history 30 days after it reaches a final outcome, as a step in the
      Worker's existing hourly run.
- [ ] Say on the published privacy page what an event holds and that it is kept for 30 days
      after its final outcome.
- [ ] Check the complete desktop message and action flow before adding Slack, including a
      restart with an event and an outcome that both landed while the app was closed, which
      fills the bell and interrupts nobody.

## By `ui-design` agent

<Mockup src=".mockups/319/a.tsx" label="A" />

<Mockup src=".mockups/319/b.tsx" label="B" />

<Mockup src=".mockups/319/c.tsx" label="C" />

Recommended: **A** — the rail reads as one list at a glance, and the card keeps its one mark in the title band.

## By `technology-selection` agent

| Option | What it is | Pros | Cons |
| --- | --- | --- | --- |
| `@supabase/realtime-js` | Supabase's Realtime client on its own — 2.112.4, MIT, published 24 Aug 2026 from the `supabase-js` monorepo | `RealtimeClient.setAuth()` is exactly the `Authorizable` the board already types; private channels with `{ config: { private: true } }`; heartbeat, backoff, reconnect and rejoin already written | The CLI's first bundled dependency, carrying `tslib` and `@supabase/phoenix` (MIT) into `dist/kanban.mjs`; its use of Node's global `WebSocket` puts whatever runs the connect path on Node 22 |
| `@supabase/supabase-js` | The whole client — 2.112.4, MIT, same release, wrapping realtime-js with auth, postgrest, storage and functions | One package, and the shape every Supabase doc is written in | Four clients this card never calls, in a bundle that has carried none; its `auth-js` owns a session #326 deliberately keeps in `~/.ai4kanban` and refreshes under its own cross-process lock, so the machine's sign-in would have two owners |
| Write it ourselves | A `WebSocket` against the published Realtime protocol (`vsn` 1.0.0 or 2.0.0) | No dependency to license, upgrade or outlive, and `dist/kanban.mjs` stays a file of ours alone | We keep the heartbeat (25s to the `phoenix` topic), the reconnect, the rejoin and the join timeouts working against a wire format only Supabase versions; the Node 22 floor arrives anyway with global `WebSocket` |

**Pick: `@supabase/realtime-js`** — the one dependency that buys private channels and live `setAuth` without handing this project's own sign-in a second owner.

## Decided by the agent
- **Why this is one card and not two**: the publisher and the notification center check each
  other and nothing else — a pipeline with no bell shows the user nothing, and a bell with no
  pipeline has nothing to show. #325 already split this group where its seams are: the contract,
  the execution, then the connector.
- **What this card asks of `akb`**: publication over `fetch`, and nothing more. The desktop app
  and a terminal `akb` run the same `cli/dist/kanban.mjs`, so `@supabase/realtime-js` is one
  bundle either way — but it is a build-time dependency inlined into that file and loaded on the
  connect path alone, which only the app is on here. So a terminal `akb` runs on Node 18 with or
  without Cloud, and `cli/package.json` and `cli/README.md` keep their `Node 18+. No
  dependencies.` promise. #325's open question, whether a terminal `akb` connects too, is #318's
  need rather than this card's.
- **Which user docs this card updates**: none. Cloud still has no guide in `docs/guides/` — #317
  and #322 own the ones that will exist — so the published privacy page is the only doc surface
  this card touches, and it is a todo above.
- **Why `site` is in `modules`**: the card writes `web/legal/privacy.mdx`, so the module whose
  memory records that change has to be one of the card's.
- **Which task raises an event**: one whose release is the one that board watches. A `ready` task
  in another release, or promised to none, is not what the user asked to be told about.
- **How many events one task raises**: one, whatever it carries. The board's Resolve answers
  every question on a card in a single pass, so an event per question would ask the user three
  times for one act, and leave #320 three Slack messages to keep in step.
- **What happens when a task keeps moving under a live event**: the publisher refreshes that
  event in place — the revision it binds, the questions it carries, and the decision it asks for.
  One task means one row, so a card revised twice before anyone looks must not leave three rows
  asking about revisions two of them no longer bind; and answering the last question on a `ready`
  card turns that event into the approval rather than retiring it and raising another. The
  refresh interrupts nobody, because it is the same piece of work the user was already told
  about.
- **What one event asks for when a task is both `ready` and holding user-owned questions**: the
  question. Answering it rewrites the card and moves its revision, so an approval granted first
  would bind a revision about to change — and the board's own page still offers Implement beside
  Resolve for anyone who wants both.
- **What an unanswered question means**: the same as it does in the board's own dialog — the
  agent researches that one. A remote answer may therefore leave questions blank, and #318's
  resolve run reads them exactly as a local Resolve does.
- **What closes an event nobody acted on**: the publisher that already runs after every board
  write. It retires the event as `stale` the moment its task stops being one the board raises
  events for, so a user who answered on the board is not asked the same thing twice from the
  bell. That is one test, not three: the task left `ready`, lost its question, or left the
  watched release — which is also what a release closed off its open cards, or a release the
  user swapped for another, comes down to. A card edited by hand outside `akb` runs no publisher
  at all, so the reconciliation at start is what retires or refreshes that one, and turning a
  board's notifications off retires the rest. A board merely missing from the machine says so
  and keeps its rows, because the checkout can come back.
- **Why a stale event raises nothing**: `stale` retires an event no delivery ever started, and
  whatever retired it — an answer given on the board, a hand edit found at start, a board's
  notifications turned off — is not news the user is waiting for. The second notification reports
  a run's end, and an event that never became a run has no end to report.
- **Where this card's Realtime and RLS work is checked**: on the live Supabase project, which now
  exists. The account's private channel and its `realtime.messages` policy are configured there
  as part of this card, so the first `verify:` line is a real round trip rather than a check
  deferred to #329.
- **Whose Realtime topic this card authorizes**: the account's alone. A server topic has no
  server row to scope a policy to until #318 registers one, so its policy ships with it.
- **Which process holds the connection**: the board server the window is showing. The app keeps a
  board server per project and leaves a backgrounded one running while a run is going in it, so
  more than one process is signed in as the same account — and a subscription in each would
  raise one event's notification several times over. The `open-project` file `BoardServers`
  already writes is how a server knows it is the one on screen. Every event on the account's one
  topic reaches it whichever board raised it, so one connection draws the whole bell, and a
  backgrounded server keeps publishing over `fetch` because that is what a run in it produces.
- **Why the outbox retry is not enough on its own**: the board write and the outbox row are not
  one transaction, so a crash between them leaves a `ready` task nothing will ever retry. The
  reconciliation at start is what closes that gap.
- **What a click does when Cloud is unreachable**: it starts the delivery or writes the answer
  anyway, and the Cloud action joins the publisher's local outbox and is retried like a
  publication. Nothing on the board waits for the network.
- **Where a remote answer is applied**: on the local machine by #318's server, the same way a
  remote approval is — `notify-plan.md` steps 5 to 9 are the path a surface that is not this
  machine takes, and the app's own card page does not use it. #318's Scope names only
  **Implement** today and has to carry an answer request too.
- **What a system notification says**: the row's words — the card's number and title, and the
  event's name. A second wording for one event is a second thing to keep true. The outcome
  notification is the one exception: it carries the outcome instead of the event's name, because
  repeating the name would say only what the first notification already said.
- **Which deliveries raise the outcome notification**: those with a Cloud action recorded against
  their event, wherever the click happened. That durable action is the only thing Cloud can see,
  and a delivery started on a task with no event has nothing to report against. A cancellation is
  the exception: in this release only the user can cancel one, and interrupting somebody to
  report the thing they just did is the third interruption this card refuses to charge them.
- **Which catch-up interrupts**: a reconnect's, not a start's. A reconnect happens under a window
  that has been open the whole time the connection was down, and the app cannot tell a user who
  walked away from one who is watching — which is the case both notifications exist for, and why
  a focused window does not hold the outcome back either. A start is the opposite: the person
  launching the app is by definition in front of it, so what waited fills the bell in silence,
  the same way the first fill of a newly enabled board does.
- **How the outcome path is checked before #318 exists**: against an outcome written straight
  through the Worker. This card stores all nine states and renders the ones a local mark has no
  words for, and #318 is the first thing
  that produces `running` or `completed` from a real delivery — so the second notification and
  the row going unread again are checked against a recorded outcome, not a run.
- **Where a board turns notifications on**: the Cloud section of Configuration
  (`kanban-ui/components/Cloud.tsx`), which #326 already gave the machine's sign-in — the enabling
  switch and the release it watches join it there rather than opening a second Cloud screen. That
  section already separates what belongs to the machine from what belongs to a board, so the
  silencing switch sits with the sign-in: the interruptions it stops arrive from every enabled
  board, and a per-board switch would be reachable only by opening that project first.
- **Where the list of enabled boards lives**: on the machine, beside #326's sign-in and outside
  every repository, mapping each board's Cloud ID to its local path. The bell has to name a board
  the app does not have open, and nothing about Cloud is committed to a project's git history.
- **Where the event's state sits in a title band that holds one mark**: below the delivery's
  pill. `CardPage.tsx` deliberately never draws two, and once a delivery is running its pill is
  already the local truth about the same work — a second pill beside it would state that truth
  twice in two vocabularies. So the event contributes the four states no delivery has words for,
  and it comes last in that band's order too, taking only the slot the status pill would hold.
- **What marks a row read**: opening it. The bell's count is unread rows, so a row the user has
  looked at stops counting, and a retired event stops counting without ever being opened.
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
- **Why the privacy page is edited from this card**: what an event holds and how long it is kept
  are facts this card introduces, so the published page gains both rather than a retention line
  for a thing it never says exists; #330 re-reads the whole Cloud section afterwards.

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
