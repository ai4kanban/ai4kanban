---
title: Notify a workspace's owners and members about a card that needs them
priority: high
roi: high
status: ready
release: 0.9.0
blocked_by: []
related: [311]
modules: [cloud, local-ui, site]
questions: []
verify:
  - "Apply the migration to the live project: cd cloud && npm run migrate -- --dry-run, then npm run migrate, then npm run check:closed. No checkout here holds SUPABASE_PROJECT_REF, so none of the three has been run."
  - "Two GitHub accounts on two machines against one live workspace — an owner, and a member the owner just added who never turned notifications on. Expect: a card the member's machine takes to ready lights both bells; a user-owned question raised on the member's machine reaches the owner alone; the owner answers it from their own Slack, the run starts on the owner's machine with the trail naming them, and the member's row redraws as answered rather than still asking. No checkout here holds a second admitted account."
---

Send a Cloud board's decision points to the teammates who can act on them. Today every event
is addressed to the one account whose local write produced it, which is the whole audience on
a solo board and the wrong one on a team, where the person who has to answer is usually not
the person whose agent asked. So a shared board's questions sit unseen until somebody happens
to open the card — the second of the four problems #311 exists to solve.

## Worth noting
- **An event belongs to the workspace, not to the machine that raised it**: one card raises
  one event for the whole team whichever member's machine published it, so a member's bell now
  carries cards their own machine never touched.
- **A member is told only what is addressed to them**: a plain member sees no question in
  their bell and reads the board when they want everything, so the bell stays a to-do list
  rather than the team's shared queue. They may still open the card and answer it.
- **Each member is reached in their own connected Slack or Lark**: a destination two of them
  share still gets one message, but a five-person team spends about five times a solo board's
  connector writes against one shared daily budget, so `cloud/README.md`'s account ceiling is
  recounted for that rather than capped.
- **A member an owner adds starts watching, not silent**: routing works the day a team is
  formed and the operating system's own permission prompt still gates every interruption, at
  the cost of a teammate hearing about a board they have not opened yet.

<!-- agent -->

## Today
- **An event hangs off a board, and a board is per machine**: `cloud.boards` mints a row for a
  local path and stamps it with one account, and nothing links it to a workspace, so two
  members turning notifications on for one workspace would raise two event streams for the
  same card.
- **Every event route ends at the board's owner**: `cloud.require_owner` guards them,
  `api.list_events` filters `owner_id`, and `cloud.hint` broadcasts to `account:<uid>` alone.
- **The watch lives on the machine**: the notification switch and its watched release sit in
  `~/.ai4kanban/boards.json`, and only the board's id and name reach Cloud, so Cloud cannot
  tell who is watching which release.
- **A connector belongs to a person**: a Slack or Lark connection is held by an account rather
  than by a workspace, and `cloud.event_deliveries` is unique on `(event_id, connector)` — one
  row per event per connector.
- **#376 landed the team**: membership, the two roles, `cloud.require_member`, and one
  execution node per member's machine under a workspace. It also refuses the change that would
  leave a workspace with no owner, because owner is the address a question is sent to.
- **The single decision is already a property of the schema**: `cloud.event_actions` is unique
  on `event_id` and carries the account that took it, and #325's retirement redraw already
  rewrites a chat message for an event acted on elsewhere.
- **A remote action binds to a board's one server (#318)**: a workspace holds one node per
  member instead.
- **A row may name a board or a workspace and never both**: `cloud.board_servers` already
  carries the precedent, in `board_servers_one_home`.
- **The public pages promise one account**: `/cloud` says Cloud carries "a question only you
  can answer" and hands the decision back to "your own machine"; `/privacy` says Cloud "relays
  one signed-in account's task events" and that the boards and events of the 0.8.0 relay
  "belong to one signed-in account"; `/terms` says "Every other Cloud record belongs to one
  account and answers that account alone".
- **The account ceiling counts a solo board**: `cloud/README.md`'s "How many accounts that
  carries" counts one connector delivery per event change and says to recount it when any of
  its numbers moves.

## Scope
- **An event names a workspace or a board and never both**: a checkout carrying a pointer
  raises its events against the workspace, and 0.8.0's board-kept events stay addressed to
  their one account with nothing about them changed.
- **One card raises one live event for the whole workspace**: whichever member's machine
  published it, refreshed in place by any of them.
- **The audience is resolved when an event is read**: read #376's membership then rather than
  storing recipients, so a member added or removed since is included or dropped on their next
  read.
- **A user-owned question goes to the owners, a card ready for review to the members**: owners
  included — an owner is a member with more rights, not a separate audience.
- **The watch filters both audiences**: a member whose switch is off, or who is watching
  another release, is not told, and a question no owner is watching for stays on the board.
- **A member's watch lives in the workspace, not on their machine**: the notification switch
  and watched release follow them to every machine they open the board on, and Cloud can
  resolve who is watching. It stays #319's one switch and one release, carried over from what
  their machine already holds.
- **A member an owner adds starts with the switch on, watching the newest open release**: a
  default set once when they are added, not a rule that re-points as releases come and go, and
  either of them may change it afterwards. A member whose own machine already watches that
  board keeps what it carries over; the default is for a member with nothing to carry. A
  workspace with no open release leaves the switch on with nothing to watch and the rail
  asking them to choose, which is #319's own state when a watched release closes.
- **Every event route answers a member**: the catch-up read, the hint, the action and the
  retirement, in place of the board's owner check.
- **The Realtime hint fans out**: it reaches every account in the audience.
- **One delivery per distinct destination**: across the audience's own Slack and Lark
  connections, read from the stored event rather than from what a connector remembers.
- **The decision behind an event stays single**: the first action settles it, a second is
  refused, and every other recipient's surface redraws as answered rather than still asking.
- **Any member may answer a question they can see**: owner routing decides who is told, not
  who may write (#311).
- **An action taken away from a machine runs on the member who took it**: on a node of theirs
  and never on another member's, leaving the event waiting for a server until one of theirs is
  up.
- **The answer is attributed to the member who gave it**: through the audit trail every
  workspace mutation already writes (#314).
- **A member the workspace removed stops being delivered to**: a message already posted in a
  chat stays where it is.
- **An event is taken down with what it is about**: the card, or the workspace it belongs
  to.
- **The account ceiling is recounted**: `cloud/README.md`'s number covers what a team's
  fan-out costs.
- **The public pages are rewritten**: `/cloud`, `/privacy` and `/terms` wherever they promise
  one account's events or a question only you can answer, and both legal pages' effective date
  moves.
- **Out of scope**: naming a decider on a card, per-card permissions, a connector connected to
  a workspace rather than to a person, and any browser destination (#322).

## Todo
- [ ] Give an event a workspace where the checkout carries a pointer, leave 0.8.0's board
      events on their account, and keep one live event per workspace card however many members
      publish it.
- [ ] Swap every event route's owner check for the membership check, and make the catch-up
      read answer with the events a member is in the audience of.
- [ ] Hold a member's notification switch and watched release in the workspace, carrying over
      what their machine already holds, and publish from a machine only while that member's
      own switch is on.
- [ ] Start a member an owner adds on the switch on and the workspace's newest open release,
      falling back to the rail's choose-a-release prompt when the workspace has none.
- [ ] Route a user-owned question to the owners watching its release and a card ready for
      review to the members watching it.
- [ ] Fan the Realtime hint out to every account in the audience.
- [ ] Deliver an event once per distinct destination across the audience's own Slack and Lark
      connections, and redraw every one of them once the event is acted on.
- [ ] Bind an action taken away from a machine to a node of the member who took it, and leave
      the event waiting for a server until one of theirs is running.
- [ ] Attribute the answer to the member who gave it in the workspace audit trail.
- [ ] Drop a removed member from the audience on their next read, and take an event down with
      its card or its workspace.
- [ ] Recount `cloud/README.md`'s account ceiling for a team's fan-out.
- [ ] Rewrite `/cloud`, `/privacy` and `/terms` wherever they promise one account's events,
      and move both legal pages' effective date.

## Decided by the agent
- **Why the event moves to the workspace rather than gaining a list of recipients**: the board
  row an event hangs off is minted per machine per local path, so a shared board has no one row
  for the team's card to be about. Naming the workspace lets the existing
  one-live-event-per-card index deduplicate across members for free, and `cloud.board_servers`
  already shows the shape.
- **Why the audience is a query rather than stored rows**: including a member added since and
  dropping one removed since is what reading membership at delivery time means, and it leaves
  nothing to keep in step when a role changes.
- **Why a plain member is not told about a question**: #311 routes a question to the owner
  role, and a bell that showed every member every event would make that routing decorative.
  Every member can still open the card and answer it, so nothing is out of reach — only out of
  the way.
- **Why each member's own connector rather than one connection per workspace**: a Slack and a
  Lark connection belong to an account and always have, so the audience is already a set of
  people with destinations. A connector held by a workspace would be a second concept and a
  second consent, and a shared channel still gets one message because delivery is keyed by
  destination.
- **Why the watch has to leave the machine**: Cloud cannot resolve "the members watching this
  release" from a file in each member's home directory, and a member who opens the workspace on
  a second machine should not have to turn notifications on again there.
- **Why an answer runs on the answering member's own machine**: #311 fixes it, and the
  alternative — the publisher's machine running a decision it did not take — attributes the
  work to the wrong person and waits on a teammate who may be asleep.
- **What a member added after an event was stored sees**: the row, on their next catch-up read,
  with nothing interrupting them for it, because the event has not moved — #319's own rule for
  what a catch-up fills the bell with.
- **What the newest open release is, and why an added member's default is narrower than a
  board's own**: `releases.md` lists the open releases in the order they ship and `release new`
  appends, so the newest is its last line. A checkout starts on every release (`ALL_RELEASES`
  in `cli/src/lib/cloud/notifications.ts`) because the person turning notifications on is
  choosing to be told; a teammate who has not opened the board yet starts on the one version
  the team is shipping now, the smallest default that still puts a question in front of an
  owner on day one.
- **Why a solo Cloud board needs no second path**: a workspace with one member resolves to an
  audience of one, so the team behaviour and today's behaviour are the same code.
- **Why this is one card rather than a split**: the audience, its destinations and the single
  decision behind them check each other and nothing else — an audience with no destination
  shows nobody anything, and a fan-out with no audience is #319 again. The group is already
  split at its seams by #376, #375 and this one.

## Source
- #311 — the routing rule, the owner role a question is addressed to, and the four problems
  this one closes.
- #319 — the event, action and outcome contract this card extends, and the notification center
  it is read in.
- #376 — workspace membership, the two roles, and the per-member execution node this card
  routes an answer to.
- #314 — the one-transaction mutation and the audit trail an answer is attributed through.
