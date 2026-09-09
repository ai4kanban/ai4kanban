# Redesign

Design mistakes to avoid when writing a card, grouped by topic. One entry each: the
mistake, then the design we actually want. Read before writing or reviewing a card.

## What the UI does

- ❌ **The UI lets people hand-edit the board** (toggle todos, write cards, mark done) → ✅
  the UI spawns agent runs to do the kanban work; only priority, ROI and a title/body edit
  are direct.
- ❌ **A control is hidden when the thing it drives doesn't exist yet** (no releases, so no
  release dropdown, and the UI never says releases exist) → ✅ the empty state is where the
  UI teaches the feature: keep the control and let it offer the first step.
- ❌ **A board action stays terminal-only because it feels rare or administrative** → ✅ the
  UI offers what the command offers, with the consequences shown before the user confirms.
- ❌ **A control is kept alive for its leftover cases after the thing it served is replaced**
  → ✅ send each leftover case where it belongs, then take the control away. A surface kept
  for scraps is a second way to do the same thing.
- ❌ **Setup reports itself finished while the board still can't run anything** → ✅ whatever
  the board needs to do its first piece of work is a step of setup, and setup doesn't end
  until it is answered.
- ❌ **One control changes meaning with a field above it** (the same switch means "fill from
  the goal" or "put the high-priority cards in", depending on whether a box has words) → ✅
  two modes get two tabs that name them, each showing only its own fields.
- ❌ **A feature the board can do on its own also gets a "run it on this thing" button** → ✅
  an automatic feature is switched on or off, never aimed by hand: the flow picks what it
  needs, and the UI's job is to list what exists and let the user turn one off.
- ❌ **Route the app's own control through the network so every surface shares one path**
  (Implement on the card page in front of you waits on the board's server) → ✅ a control on
  the machine that holds the board acts at once, and the act is recorded and pushed out
  afterwards. Uniformity is not worth making the local case wait on the remote one.
- ❌ **Make an external service the only place to inspect and test notification messages** →
  ✅ prove the complete event, message and action flow in the app's own notification center
  first, then let external connectors reuse it.
- ❌ **A UI feature ships with an app-wide keyboard shortcut for reaching it** → ✅ the
  feature is reached from the control already on screen. The app's first global key is a key
  map it then owes consistency to, and that is a card of its own, not a line in someone
  else's.
- ❌ **Two surfaces are told apart by a wash one shade off the ground they sit on** (the
  user's message on the rail's cream) → ✅ separate them by surface and shape — paper with a
  hairline, inset from the column — so the hierarchy survives a glance.
- ❌ **A control's label narrates what happened in empty words** ("looked at 6 things") → ✅
  say the one thing the reader wants from it — how long the agent worked — in the words the
  tools they already use say it in.
- ❌ **A new expressive view replaces the plain list it was meant to enliven** → ✅ it is a
  second view beside the list, switched where the dialog is titled. The expressive one may
  be what opens; the plain one is never taken away.
- ❌ **A character is invented from scratch for a thing the app already ships a mark for** (a
  generic figure per run, beside `public/agents/*.svg`) → ✅ build the character on the mark
  that already exists — no new art, and the agents tell themselves apart for free.
- ❌ **A card that replaces a whole screen names the screen's parts in prose and leaves the
  layout to the build** → ✅ the screen is drawn before the card is settled — where each part
  sits, what fills the empty space, and how the screen is entered and left. Scope lines say
  what the screen does, never what it looks like.
- ❌ **A control that starts an agent run offers only its fixed choices** (a repurpose you can
  pick a language for, with nowhere to say what you had in mind) → ✅ put a free-text note
  beside them, carried into the run — the commands behind these buttons already take one.
- ❌ **A control that qualifies the next message gets a strip of its own above the
  transcript** (the chat's agent and model on a row between the header and the conversation)
  → ✅ it goes inside the message box, on the box's own bottom row beside Send, and the box
  carries no rule above it. What answers the message belongs where the message is written.
- ❌ **A row works out where an item came from by matching free text against a table of
  platforms, and draws a generic mark when nothing matches** → ✅ the item names a source
  type from a predefined list and carries the rest — subreddit, author — as its own
  key/value pairs. One row draws every source, a type the table doesn't know draws its
  name alone, and an item that named no type draws no source at all.

## Runs and deliveries

- ❌ **A run's log is a moment** (in memory, or gone once the run ends) → ✅ the log is a
  place: written to a gitignored file, reopenable after a restart, and browsable live and
  past from one runs panel.
- ❌ **A run's result waits in a review state the user has to accept or discard** → ✅ a run
  changes the board when it finishes and the user reads the log. An approval step is a new
  notion to learn and a new state to keep alive, for a question the user often can't answer.
- ❌ **A run the server starts on the side is invisible to the tab that asked for it** → ✅ a
  run a click starts is that tab's own run: in the panel at once, marked on the thing it
  works on, and the board re-reads itself when it ends.
- ❌ **Waiting for a blocker is built for one action** (a Schedule button that always means
  implement) → ✅ scheduling is a modifier on an action, never an action itself.
- ❌ **One word names both the whole job and each agent invocation inside it** → ✅ give each
  level its own word: **delivery** is what one Implement click starts, **session** is one
  agent invocation, **commit** is what lands. "Run" stays a verb.
- ❌ **A card edited mid-delivery retires the delivery** → ✅ deliver the card as it was
  approved, from a snapshot, and keep the card from changing under it. Throwing away a build
  because someone fixed a typo is a punishment, not a safeguard.
- ❌ **Two controls that end the same thing stand side by side** (Stop run and Cancel
  delivery, both wearing an ✕, differing only in what they leave on disk) → ✅ ask one
  question at a time, and let one control do the whole thing with its confirmation naming
  what will be lost. The salvage path stays in the terminal.
- ❌ **A control is named after a noun the page never says anywhere else** → ✅ name the
  control after what it does. A caption added to hold up a name is a second thing to read.
- ❌ **A line of prose restates a mark right above it** → ✅ say it once, in the smallest mark
  that can carry it. Prose earns its place by saying what the reader has to act on.

## Settings

- ❌ **Ask about telemetry over the board or add a permanent Privacy tab** → ✅ put the
  default-on disclosure inside onboarding, then keep only its switch under General.
- ❌ **A new settings section is named by adding a qualifier to one that already exists** →
  ✅ two sections get two names that stand apart. A reader shouldn't hold a qualifier in
  mind to tell two entries of the same sidebar apart.
- ❌ **A new global setting gets its own labeled control in the header** → ✅ one gear icon
  opening one Configuration dialog, so the header stays quiet.
- ❌ **A new settings-file shape to hold a new setting** → ✅ a new setting is one more key in
  the block that already exists; only reshape the file when a user really loses something.
- ❌ **A dialog's fields are seeded once, from the page's first load** → ✅ a settings dialog
  shows what the file holds every time it opens, with no reload.
- ❌ **A background sweep with its own on/off switch, for work a run already causes** → ✅
  work follows the run that caused it, so there is no sweep and no switch — and the
  frugality rules the sweep needed go with it.
- ❌ **A board-wide setting ships with a per-card override beside it** → ✅ ship the setting
  alone until a card really has to differ. A mark with no rule for when to set it gets set
  by mood until it means nothing.
- ❌ **Say whether a setup can run by checking its pieces up front** → ✅ one **Test** button
  that really runs the thing once and shows what came back; a real run answers what a
  checklist can't see.

- ❌ **A pane answers "where does this run" with a thing-by-machine grid** (a row per
  runtime, a column per computer) → ✅ the thing the user came for stays the list, and it
  names its one machine itself. A second axis is repeated rows, and repeated rows read as
  noise.
- ❌ **A list that only reports sends the user into a page of its own to change what it
  reports** → ✅ set it where it is read: the one row that matters is open, the rest are
  folded, and a separate view is only for what the list cannot hold.
- ❌ **A grid of characters draws the same placeholder figure in every tile, with the real
  art left for the user to generate afterwards** → ✅ each role gets its own character —
  different silhouette, pose and prop — and the ones the product ships carry finished art
  in the repo. A screen whose whole point is the artwork cannot ship without it.
- ❌ **Monospace is used to make a name read as a literal** → ✅ settings prose is one
  typeface; a name earns its weight from position and weight, not from a second font.
- ❌ **A form leaves out the fields it can't save yet and prints a line saying where they
  come later** → ✅ draw the whole form and hold what it can't write, replaying it once the
  thing exists. A sentence pointing at a control that is not on screen reads as a missing
  control, not as a next step; needing to explain the order is the sign the order is wrong.
- ❌ **A form-shaped row is dismissed by "focus left it"** → ✅ dismiss it on a press
  outside. A field blurring itself on Enter, and a list that opens in a portal, both look
  like focus leaving and neither is — read as leaving, they throw the user's work away.

## Keys

- ❌ **A key comes from whatever the user exported before starting the server** → ✅ one fixed
  file the board owns, `docs/kanban/.env`, kept out of git. `ui.config.json` is checked in
  and never holds a key.
- ❌ **Send a key out under every variable the agent might read** → ✅ one auth variable per
  run, the one the picked provider names. A second one isn't a harmless spare: an agent
  reads it as another login and changes what it does.

## The header and charts

- ❌ **Put a long file on the board as one summarized line** → ✅ a file the user wrote in
  full is opened in full, from a control that costs no space.
- ❌ **A read-only reference control joins the header's action cluster on the right** → ✅ it
  goes on the left, beside the board's name: the left says what this board is, the right is
  what you do.
- ❌ **Planning scores live only in CLI output or release text** → ✅ chart them beside Daily
  progress, a tab each — stacking makes the reader scroll past the chart they didn't ask for.

## Recurring tasks

- ❌ **A recurring-task feature that only adds a Run button** → ✅ say how runs start without
  a click: the server's dispatcher runs due cards on a cadence, never an in-session loop.
- ❌ **A schedule is a pick from a few named options** → ✅ a number and a unit, down to the
  minute, plus an optional time of day. Real jobs don't fall into three buckets.

## Shipping the desktop app

- ❌ **A gesture ships behind a system setting the user has to go turn on** → ✅ a gesture
  people already make in their browser has to work with no setup at all. A toolkit that only
  offers the old path is a reason to keep looking, not to ask the user.
- ❌ **A release waits on a paid developer account** → ✅ ship unsigned and write down the
  clicks that get past the warning. A signature is a follow-up card, never a gate.
- ❌ **A password dialog on every machine** → ✅ write the symlink into a user-owned bin
  folder the PATH already reads, keeping `/usr/local/bin` and its dialog as the fallback,
  and never edit a shell startup file to make a folder qualify.
- ❌ **A dialog before a write that needs no privilege** → ✅ do it and say where it went; a
  dialog is only earned by the password it warns about.
- ❌ **A platform is scoped out because the chosen library's path there needs a signature**
  → ✅ the requirement belongs to the library's mechanism, not to the platform. Check what
  the system itself allows an unsigned build to do before dropping the feature there —
  especially when it is the platform we actually test on.
- ❌ **A card whose `verify:` can only be run after the release ships** → ✅ scope a way to
  exercise the feature locally — a feed, a fixture, an environment variable — as part of the
  card. A check that has to wait for publishing is a check nobody makes, and it is the
  failure cases that never get tested at all.
- ❌ **Runtime rows repeat harness names beside logos and use vague action words as states** → ✅ let the logo identify the harness, name the actual state, and keep concise local-storage notes beside their fields.
- ❌ **A runtime editor replaces the existing harness card grid with a dropdown and exposes all settings** → ✅ reuse the existing grid and collapsed advanced settings; only reduce card size and spacing to fit.

## Runtime and agent controls

- ❌ **Runtime Delete sits below a long settings form** → ✅ place it at the right of the runtime title; use the existing hard-shadow button for Test connection.
- ❌ **Memory maintenance looks like a file row and opens a separate popover** → ✅ use a clear 整理记忆 button linking to Configuration → Agent → Memory Pruner.
- ❌ **An agent feature mockup replaces the current roster and detail layout** → ✅ retain the current Agent pane and add the feature’s controls inside the selected agent’s detail.
- ❌ **Optional scheduling occupies a full settings row** → ✅ keep it beside the manual action as a compact control that opens its settings on demand.

- ❌ **Treat standalone CLI paths as Desktop discovery coverage** → ✅ scan reported Desktop cache paths, including hashed folders, using the same known-path approach as macOS.
