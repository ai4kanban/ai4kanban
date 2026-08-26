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
  - question: "[user] Should an actionable event also raise a system notification, or only light the app's own bell?"
    mode: single
    options:
      - A system notification too — being told is the point of the flow, and Slack (#320) isn't everyone's answer. Costs a macOS permission prompt and a way to mute it.
      - The bell alone — nothing interrupts and nothing asks permission, and the user finds waiting events when they next open the app.
    recommend: [1]
  - question: "[user] May a user-owned question be answered with free text from a notification, or only by picking one of its listed options?"
    mode: single
    options:
      - Free text too — most questions are answered in a sentence, and Cloud stores that sentence until the server applies it.
      - Options only — nothing the user types reaches Cloud, and a question with no options is answered on the board.
    recommend: [1]
  - question: "[user] Which layout for the notification center? — see the `ui-design` section"
    mode: single
    options:
      - A — a dialog over the board from the header's tool cluster, the run history's shape; it is modal, so the board is behind a scrim while you answer
      - B — a rail down the right beside the board, events open in place; it wants the side the chat rail already folds down
      - C — a page of its own with a permanent rail row; the most room per event, and a destination that stays there for a few events a day
    recommend: [1]
verify:
  - "Against the live Supabase project: moving a task to `ready` on this machine lights the bell within seconds, the same event is still there after the app is restarted, and a second signed-in account's Realtime channel receives none of it."
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
- **A notification here decides, it does not write**: approving or answering records a durable
  action and stops at `waiting for server`, and #318's server is what changes the local card. The
  cost is that until #318 lands nothing on the board moves from a notification; the option it
  beat was letting the desktop app write the card directly, which would give a Slack answer
  and a desktop answer two different paths to the same edit.

## By `ui-design` agent

<Mockup src=".mockups/319/a.tsx" label="A" />

<Mockup src=".mockups/319/b.tsx" label="B" />

<Mockup src=".mockups/319/c.tsx" label="C" />

Recommended: **A** — it is the run history's shape, in the cluster the run history is in, and the board keeps its full width.

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

## Scope
- Keep notifications off until the user enables them on a board and chooses one open release.
- Register each enabled board under a Cloud ID that means nothing outside Cloud, keep the
  mapping from that ID to the board's local path on the machine alone, and name that board on
  every event.
- Create events only when a task enters `ready` or has user-owned questions.
- Run the shared local publisher after every successful desktop, CLI, or agent board write.
- Record each publication in a local outbox before sending it through the Worker, retry it
  independently of the committed board change, and keep the outbox out of git.
- On start, publish any actionable task on the board that has no publication on record, so a
  crash between the board write and the outbox entry cannot lose an event.
- Give each event the authenticated user, board, task number and title, release, the question
  or the review it raises, current revision, requested decision, and allowed actions — and no
  other part of the card, so the promise #330 publishes stays true.
- Send every event to the one signed-in account; #328 is what gives an event a team audience.
- Preserve question choices and recommendations without exposing internal ownership tags.
- Store the event, its connector deliveries, human action, and outcome separately so any
  stage can retry without duplicating another.
- Store durable state in Supabase Postgres through the Worker, then send the stored event or
  request ID over a private Supabase Realtime topic authorized by the user's Auth session.
- Authorize account and server topics with RLS policies on `realtime.messages`, subscribe as
  private channels, and apply refreshed JWTs to the live connection.
- On every start and reconnect, read the account's pending events through the Worker before
  listening for hints, so an event that arrived while the app was closed still appears.
- Refuse an action when its task revision or actionable state is no longer current.
- Retire an event as `stale` when the publisher sees its task leave `ready` or lose the
  question, so a card already answered on the board stops sitting actionable in the bell.
- Add a desktop notification center with a bell, unread count, newest-first history, message
  context, clear empty and disabled states, and the actions the event permits.
- Let the user approve implementation or answer a user-owned question from the notification
  center.
- Record either as one durable action that reads `accepted` and then `waiting for server`;
  #318's server applies both to the local card, so nothing in this card writes to a board from
  a notification.
- Update a notification with its actionable, accepted, waiting for server, running, completed,
  failed, stale, cancelled, or interrupted outcome without creating progress noise; those nine
  names are the ones #318 and #320 also use.
- Keep an event for as long as it is unresolved, and 30 days after it reaches a final outcome
  delete it with its deliveries, action, and outcome.
- Add that 30-day period to the published privacy page's Data retention section.
- Pause notifications when the selected release closes and ask the user to choose another.

## Todo
- [ ] Add the board record: a Cloud ID per enabled board, the local path held on the machine
      alone, and that board named on every event.
- [ ] Add the two event rules, release filter, portable message, and durable deduplication.
- [ ] Add the shared local publisher to the desktop app and `akb`, with one local
      outbox and retry path for qualifying state changes.
- [ ] Publish at start any actionable task with no publication on record.
- [ ] Retire an event as stale when the publisher sees its task leave `ready` or lose its
      question.
- [ ] Publish through the Worker under the Supabase Auth session, then broadcast stored IDs
      over private Realtime topics.
- [ ] Configure private Realtime channels and account- and server-scoped authorization policies,
      including live JWT refresh.
- [ ] Read pending events through the Worker at every start and reconnect, before listening
      for hints.
- [ ] Record connector delivery, human action, and outcome independently.
- [ ] Add the desktop notification center, unread state, history, and empty states.
- [ ] Approve implementation and answer user-owned questions from the desktop message, each
      recorded as one durable action that stops at `waiting for server`.
- [ ] Return stale or duplicate outcomes and preserve the local task.
- [ ] Reflect meaningful action and execution outcomes in the existing notification, under the
      nine state names this card fixes.
- [ ] Delete an event and its history 30 days after it reaches a final outcome, as a step in
      the Worker's existing hourly run.
- [ ] Add the 30-day period to the published privacy page's Data retention section.
- [ ] Check the complete desktop message and action flow before adding Slack, including a
      restart with an event and an answer that both landed while the app was closed.

## By `technology-selection` agent

| Option | What it is | Pros | Cons |
| --- | --- | --- | --- |
| `@supabase/realtime-js` | Supabase's Realtime client on its own — 2.112.4, MIT, published 24 Aug 2026 from the `supabase-js` monorepo | `RealtimeClient.setAuth()` is exactly the `Authorizable` the board already types; private channels with `{ config: { private: true } }`; heartbeat, backoff, reconnect and rejoin already written | The CLI's first runtime dependency, carrying `tslib` and `@supabase/phoenix` (MIT) into `dist/kanban.mjs`; its `engines` and its use of Node's global `WebSocket` lift the CLI's floor from Node 18 to Node 22 |
| `@supabase/supabase-js` | The whole client — 2.112.4, MIT, same release, wrapping realtime-js with auth, postgrest, storage and functions | One package, and the shape every Supabase doc is written in | Four clients this card never calls, in a bundle that has carried none; its `auth-js` owns a session #326 deliberately keeps in `~/.ai4kanban` and refreshes under its own cross-process lock, so the machine's sign-in would have two owners |
| Write it ourselves | A `WebSocket` against the published Realtime protocol (`vsn` 1.0.0 or 2.0.0) | No dependency to license, upgrade or outlive, and `dist/kanban.mjs` stays a file of ours alone | We keep the heartbeat (25s to the `phoenix` topic), the reconnect, the rejoin and the join timeouts working against a wire format only Supabase versions; the Node 22 floor arrives anyway with global `WebSocket` |

**Pick: `@supabase/realtime-js`** — the one dependency that buys private channels and live `setAuth` without handing this project's own sign-in a second owner.

## Decided by the agent
- **Why the outbox retry is not enough on its own**: the board write and the outbox row are
  not one transaction, so a crash between them leaves a `ready` task nothing will ever retry.
  The scan at start is what closes that gap.
- **Where an answer is applied**: on the local machine by #318's server, the same way an approval
  is. `notify-plan.md` step 9 sends both through the server, and one path is what keeps a Slack
  answer and a desktop answer the same act. #318's Scope names only **Implement** today and has
  to carry an answer request too.
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

## Source
- `notify-plan.md` — "Events", "End-to-end flow" and "Reliability and security rules": the
  contract this card fixes and the nine state names it stores.
- #325 — the group, and why this card is second in its order.
- #326 — the machine's sign-in, `cloud.accounts`, and `keepAuthorized` in
  `cli/src/lib/cloud/realtime.ts`.
- #331 — the awaited board write the publisher hangs off.
- #318 and #320 — the server and the connector that read this card's states and actions.
- #330 — the sweep that re-reads the retention line this card writes.
- `docs/kanban/memory/cloud/decisions.md` — the 30-day retention and the desktop-first order.
