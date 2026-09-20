# Redesign

Design mistakes to avoid when writing a card, grouped by topic. One entry each: the
mistake, then the design we actually want. Read before writing or reviewing a card.

## What the UI does

- ❌ **The UI lets people hand-edit the board** → ✅ the UI spawns agent runs to do the kanban
  work; only priority, ROI and a title/body edit are direct.
- ❌ **A board action stays terminal-only because it feels rare or administrative** → ✅ the
  UI offers what the command offers, with the consequences shown before the user confirms.
- ❌ **A control is hidden when the thing it drives doesn't exist yet** → ✅ the empty state is
  where the UI teaches the feature: keep the control and let it offer the first step.
- ❌ **A control is kept alive for its leftover cases after the thing it served is replaced**
  → ✅ send each leftover case where it belongs, then take the control away. A surface kept
  for scraps is a second way to do the same thing.
- ❌ **Setup reports itself finished while the board still can't run anything** → ✅ whatever
  the board needs to do its first piece of work is a step of setup.
- ❌ **A feature the board can do on its own also gets a "run it on this thing" button** → ✅
  an automatic feature is switched on or off, never aimed by hand.
- ❌ **Route the app's own control through the network so every surface shares one path** → ✅
  a control on the machine that holds the board acts at once and is pushed out afterwards.
- ❌ **Make an external service the only place to inspect and test notification messages** →
  ✅ prove the whole event, message and action flow in the app's own notification center
  first, then let external connectors reuse it.
- ❌ **A UI feature ships with an app-wide keyboard shortcut for reaching it** → ✅ the
  feature is reached from the control already on screen; a first global key is a key map the
  app then owes consistency to, and that is a card of its own.
- ❌ **A new expressive view replaces the plain list it was meant to enliven** → ✅ it is a
  second view beside the list; the plain one is never taken away.
- ❌ **A card that replaces a whole screen names the screen's parts in prose** → ✅ the screen
  is drawn before the card is settled. Scope lines say what the screen does, never what it
  looks like.
- ❌ **A control that starts an agent run offers only its fixed choices** → ✅ put a free-text
  note beside them, carried into the run.
- ❌ **A control that qualifies the next message gets a strip of its own above the transcript**
  → ✅ it goes inside the message box, beside Send.
- ❌ **UI copy narrates, repeats controls or exposes internal files and bookkeeping** → ✅
  describe the user's outcome in brief, plain words, keep the consequences of an action, and
  drop the rest.
- ❌ **Per-card reports crowd agent settings** → ✅ show a compact summary and open the full
  report in a separate scrollable view.
- ❌ **A row works out where an item came from by matching free text against a table** → ✅ the
  item names a source type from a predefined list and carries the rest as key/value pairs.
- ❌ **An archived discussion stays open after its rail entry disappears** → ✅ archiving the
  discussion you are viewing returns you to Create task, and archiving another must not
  interrupt the view you are in.

## Runs and deliveries

- ❌ **A run's log is a moment** → ✅ the log is a place: written to a gitignored file,
  reopenable after a restart, and browsable live and past from one runs panel.
- ❌ **A run's result waits in a review state the user has to accept or discard** → ✅ a run
  changes the board when it finishes and the user reads the log.
- ❌ **A run the server starts on the side is invisible to the tab that asked for it** → ✅ a
  run a click starts is that tab's own run, marked on the thing it works on.
- ❌ **Waiting for a blocker is built for one action** → ✅ scheduling is a modifier on an
  action, never an action itself.
- ❌ **A card edited mid-delivery retires the delivery** → ✅ deliver the card as it was
  approved, from a snapshot, and keep the card from changing under it.
- ❌ **Two controls that end the same thing stand side by side** → ✅ ask one question at a
  time, and let one control do the whole thing with its confirmation naming what will be lost.
- ❌ **A control is named after a noun the page never says anywhere else** → ✅ name the
  control after what it does; a caption added to hold up a name is a second thing to read.
- ❌ **Close the discussion window on the click, ahead of the start** → ✅ keep **Starting…**
  visible and close on the real start.
- ❌ **Notify between agents while the same card still has follow-up work** → ✅ wait until the
  card's whole chain of work ends and needs a person.

## Settings

- ❌ **A new global setting gets its own labeled control in the header** → ✅ one gear icon
  opening one Configuration dialog, so the header stays quiet.
- ❌ **A new settings section is named by adding a qualifier to one that already exists** → ✅
  two sections get two names that stand apart.
- ❌ **A new settings-file shape to hold a new setting** → ✅ a new setting is one more key in
  the block that already exists.
- ❌ **A dialog's fields are seeded once, from the page's first load** → ✅ a settings dialog
  shows what the file holds every time it opens, with no reload.
- ❌ **A background sweep with its own on/off switch, for work a run already causes** → ✅
  work follows the run that caused it, so there is no sweep and no switch.
- ❌ **A board-wide setting ships with a per-card override beside it** → ✅ ship the setting
  alone until a card really has to differ.
- ❌ **Say whether a setup can run by checking its pieces up front** → ✅ one **Test** button
  that really runs the thing once and shows what came back.
- ❌ **A pane answers "where does this run" with a thing-by-machine grid** → ✅ the list stays
  the thing the user came for and names its one machine itself.
- ❌ **A list that only reports sends the user into a page of its own to change what it
  reports** → ✅ set it where it is read, with the row that matters open and the rest folded.
- ❌ **A form leaves out the fields it can't save yet and prints a line saying where they come
  later** → ✅ draw the whole form and hold what it can't write; needing to explain the order
  is the sign the order is wrong.
- ❌ **A form-shaped row is dismissed by "focus left it"** → ✅ dismiss it on a press outside;
  a field blurring on Enter and a list opening in a portal both look like focus leaving.
- ❌ **Ask about telemetry over the board or add a permanent Privacy tab** → ✅ put the
  default-on disclosure inside onboarding, then keep only its switch under General.
- ❌ **An optional schedule occupies a full settings row** → ✅ keep it beside the manual
  action as a compact control that opens its settings on demand, reusing the components of the
  scheduled agent that already exists.
- ❌ **An optional agent appears among the always-on ones** → ✅ show it as optional, off by
  default, with its real state and switch.
- ❌ **Expose every workflow field at once, or create flows on separate pages** → ✅ start with
  usable defaults, keep the rail and the three connected step tabs whatever the flow, name new
  flows and copies inline on blur, and reveal the rest on demand.
- ❌ **Mix agent creation and runtime settings into a workflow assignment** → ✅ one Select
  agent control for the lead and only the selected helper's extra requirements; creating one
  returns you to the selection you came from.
- ❌ **Repeat a field for an unnamed scope, or the same toggle in list and detail** → ✅ bind
  extra requirements to the selected helper only, and keep each switch in one place.
- ❌ **Give agents enabled/disabled states inside a workflow** → ✅ workflows add or remove
  helpers; nothing disables an agent elsewhere, and helpers remain on request.

## Keys

- ❌ **A key comes from whatever the user exported before starting the server** → ✅ one fixed
  file the board owns, `docs/kanban/.env`, kept out of git. `ui.config.json` is checked in and
  never holds a key.
- ❌ **Send a key out under every variable the agent might read** → ✅ one auth variable per
  run, the one the picked provider names; a spare reads as another login.

## The header

- ❌ **Put a long file on the board as one summarized line** → ✅ a file the user wrote in full
  is opened in full, from a control that costs no space.
- ❌ **A read-only reference control joins the header's action cluster on the right** → ✅ it
  goes on the left beside the board's name: the left says what this board is, the right is
  what you do.

## Recurring tasks

- ❌ **A recurring-task feature that only adds a Run button** → ✅ say how runs start without a
  click: the server's dispatcher runs due cards on a cadence, never an in-session loop.
- ❌ **Scheduling is either a preset-only menu or a mandatory form** → ✅ offer common cadences
  and Off in one menu, with number, unit and optional time under Custom.

## Shipping the desktop app

- ❌ **A release waits on a paid developer account** → ✅ ship unsigned and write down the
  clicks that get past the warning. A signature is a follow-up card, never a gate.
- ❌ **A platform is scoped out because the chosen library's path there needs a signature** →
  ✅ the requirement belongs to the library's mechanism, not the platform; check what the
  system allows an unsigned build to do before dropping the feature there.
- ❌ **A gesture ships behind a system setting the user has to go turn on** → ✅ a gesture
  people already make in their browser has to work with no setup at all.
- ❌ **A password dialog on every machine, or before a write that needs no privilege** → ✅
  write the symlink into a user-owned bin folder the PATH already reads, keep the privileged
  path as the fallback, and never edit a shell startup file.
- ❌ **A card whose `verify:` can only be run after the release ships** → ✅ scope a way to
  exercise the feature locally as part of the card; it is the failure cases that otherwise
  never get tested.
- ❌ **An automatic-update failure sent users to a manual download** → ✅ keep updates
  automatic and show only confirmed failure causes.
- ❌ **An Install button needed another popover to disclose a restart** → ✅ label the header
  action for what one click does, and keep the version detail in its tooltip.

## Triage and feedback

- ❌ **One board-wide endpoint form stands in for source selection** → ✅ let users connect
  optional, independent sources, with attribution where a source is powered by one, and keep
  collection controls with the collection agent.
- ❌ **Triage alternates between heavy card walls and sparse full-width rows, or is pinned to
  one column at every width** → ✅ group lightweight cards by source in a grid that uses the
  width it has, and open one explicit-submit composer.
- ❌ **A second tab of one page gets its own layout** → ✅ both tabs are the same page — same
  toolbar, same groups, same cards.
- ❌ **Make users select internal runs or read collection infrastructure when reporting a
  problem** → ✅ start from Discuss with optional linking to a previous card, and name only
  the team, the sharing scope and the outcome. Show the sharing switch first, and the
  earlier-card picker only while sharing is on.
- ❌ **Feedback results are drawn in a chat that ending the discussion clears** → ✅ submit on
  end without keeping the chat open or adding sent, failed or retry states there.
- ❌ **Returned artifacts got a folder view with drag-drop, preview, per-quote notes and
  open-externally** → ✅ one multi-line box of paths and one status line; the reviewer and the
  user follow the paths themselves.

## Designing against the app that exists

- ❌ **A spec targets a dialog the app no longer has** → ✅ inspect the current screen, its
  modes and its controls before designing anything into it.
- ❌ **Moving existing records and logs into new containers became a redesign** → ✅ reuse
  their current components and visual structure; change only their containers.
- ❌ **A mobile mockup is a phone-width column on a desktop canvas** → ✅ draw it in a real
  narrow viewport.
