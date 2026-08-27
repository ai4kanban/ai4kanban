# Decisions

This module's settled answers to cards' open questions, grouped by topic. Keep only
**user-facing** calls that still guide future planning — what a user can see, do, or
would care about. Code detail stays on the card. Read before proposing so you don't
re-ask a settled call.

## What the UI is and isn't

- Renaming and reordering releases are the one thing the UI leaves to the terminal — they
  are hand edits in `releases.md`.
- Memory files are read-only in the UI. You read a wrong line there and fix it in your own
  editor — each section's "more" menu copies the path. The goal is the one file the UI
  writes.
- **Where a delivery's code is built**: each delivery gets a git worktree and a branch of
  its own, under `.akb/worktrees/<card>/<delivery>` on `card/<card>/<delivery>`, forked
  from the commit it started at. Several run side by side without touching each other or
  the user's own edits, and the board's own files are kept out of them. Nothing lands on
  the user's branch here; a run outside a delivery still only writes the working tree.
- **How committing is turned off**: **Allow automatic Git commits**, one repository-level
  setting in Configuration → Auto-delivery, on by default. Off is manual commit mode — a
  delivery works in the user's project folder, one at a time, from clean code, and the
  user commits after review passes. It is never a choice on a single card, and a change
  applies only to deliveries started afterwards.
- **What a delivery leaves behind**: **Discard** on the card page is the one way out of a
  delivery and the only thing that removes its worktree and branch, and it says what will
  be lost first. `akb cancel` is the terminal-only half — it ends a delivery and leaves the
  checkout on disk, for when there is something in there to salvage.
- **How the delivery block's controls are chosen**: by whether a run is live, one question
  at a time. Live means **Stop run** alone; nothing running means **Resume** and
  **Discard**. Two ways to end a delivery never share a row.
- Setup runs in the UI, as a guided first run that asks the user what only they know — the
  project, its tracks, the goal, and which agent does the work. Defaults are offered so it
  can be pressed through. The steps that read the repo and think run after it.
- Where the board's rules live: in the command, not in the UI. The UI keeps its buttons and
  panels and drives its runs through the command, rather than holding a second copy of how
  a card is written and how a run is started.
- **Where do the spec agents live in the UI?**: an **Agents** section inside the
  Configuration dialog, beside Harness and Skill — not a button of its own in the header.
  It lists each spec agent and gives each one an on/off switch, on by default. The user
  never puts an agent on a card; the flow working the card decides which one it needs.
- **What the coding tool's section is called**: **Harness**, renamed from Agent when the
  Agents section landed beside it. Two sections both reading "agent" were read as one
  thing. The command's own words (`akb agent`, `akb spec`) are unchanged.
- **Does the Agents section ship with the agents themselves?**: yes — it ships in the
  same group as `ui-design` and `technology-selection`, not as a card of its own later. The
  first release with spec agents is also the first release where the user can see and
  switch them off.
- **Where does the Cloud account live in the UI?**: a **Cloud** section in the Configuration
  dialog, listed after the board's own settings and separated from them, because the sign-in
  is one machine's rather than one board's. It carries every state a sign-in can be in, and
  the rest of the app is unchanged when nobody is signed in — no header control and no
  prompt. The cost the user accepted: two clicks to reach it, and an expired sign-in that is
  invisible until something needing Cloud fails.
- **How is the not-admitted Cloud pane laid out?**: one column — the refusal, then the
  invitation-code box, then **Request an invite** under a hairline, then **Sign out**. Whoever
  was handed a code meets the box first; whoever has none reads one short line before the
  button. Two doors side by side was turned down, because each half is narrow in that pane.
- **How does a Configuration pane hold many editable items?**: a picker and one box — a
  narrow column naming every item, marked where one is set, beside a single tall box for
  whichever is picked. Flow rules is the first pane built this way, because a rule is a
  paragraph and needs room; a pane of short settings stays a list of rows.

## How the board is run

- **Which systems the desktop app ships on?**: macOS, Windows and Linux together, from the
  first release that has an app. macOS is the one we test each release; the other two are
  built and shipped untested until someone reports otherwise.
- **How does a user get the board?**: the desktop app is the way in. Homebrew may come
  later; npx is not how the app is handed out.
- **What happens to the browser way?**: deprecated the day the app ships, and said so out
  loud — a warning from npm, a notice in the page, and no doc teaching it any more. The
  package is frozen, not pulled. The pages live on inside the app; only starting a server
  and opening a browser goes away.
- **What do we pay to sign the app?**: the Mac app only, eventually — macOS is the one we
  test. Windows stays unsigned; revisit a Windows certificate when users ask. Signing never
  holds a release back: the app ships unsigned and the download page says what to click
  past.
- **Is the coding agent skill part of getting a board?**: no — a new board arrives without
  it, and it is added later from a button in the Configuration dialog. Driving the board
  from a coding agent is an extra you turn on, not the way in.
- **How does the app install the `akb` command?**: one symlink pointing at a launcher
  inside the app, written into the first of the user's own bin folders the PATH already
  reads (`~/.local/bin`, then `~/bin`) — no password — and into `/usr/local/bin` with the
  system's administrator dialog only when the PATH reads neither. Updating the app updates
  the command; there is nothing separate to keep fresh.
- **When does the app install the command?**: on first launch, before the user has done
  anything — silently when writing needs no password, as a dialog only when macOS will ask
  for the administrator password. A drag out of a disk image runs no code of ours, so first
  open is the earliest moment there is.
- **Does an administrator password wait for the signed build?**: no. A feature that asks for
  one ships in an unsigned release as long as declining costs the user nothing and the old
  way still works.

## Propose and add-task

- Propose runs on one module at a time; the picker is a single-module dropdown, never a
  multi-select. Picking a module is optional for both propose and add-task — with none
  picked, the agent chooses the focus itself.

## Refining on its own

- A refine follows the run that touched the card, as a run of its own. Nothing hunts the
  backlog, so there is no switch, no "cards at once" budget, and no timer for it.
- It answers a card's open questions itself except the ones tagged `[user]`, and skips a
  card whose questions are all `[user]`.
- Stopping a background refine holds: the dispatcher doesn't pick that card again while
  its newest run is a stopped one.
- **Does finishing setup refine the first cards it writes?**: yes — they are the roughest
  cards the board will ever hold and nothing else comes for them, so a brand-new board
  opens with a refine loop running on each.

## Runs

- Stopped is its own outcome, not a failure, and any run can be stopped whoever started
  it. Stop ends the agent only — a build or test it started finishes on its own — and the
  half-finished edits stay in the working tree for git to undo. It takes a confirmation
  beside the ✕; one click never ends a run.
- Any run that ended before finishing — failed, interrupted or stopped — can be continued;
  a run that passed shows no button. A stop ends the run, not the conversation: changing
  your mind is one click, and nothing restarts a stopped run on its own — Resume is always
  the user's act. Continuing starts a new run, and the live view stays a read-only log —
  nothing is typed into a running session.
- The model shown on a run is what the agent reported as it ran, not the model setting.
  Most people leave that setting empty, so reading it would leave most runs blank.
- **What happens after a run fails?**: nothing on the board's side. The run stays failed
  with its progress in it, and Resume is how the user carries it on. The board never waits,
  backs off, or starts the work again by itself — a usage limit is the user's to wait out
  or to buy their way out of.
- **Does the board learn one agent's errors from another's?**: no. Nothing reads a
  particular agent's error format or signals. Whatever the agent printed last is the reason
  the run shows.
- **How many deliveries can build at once?**: no cap — the board starts whatever the user
  clicks, with no queue and no limit setting. Each delivery is a full checkout with its own
  setup, and the disk and time that costs is the user's call. Manual commit mode is the
  exception, one at a time by its own lock.

## Seeing what changed

- The view shows **uncommitted changes**, not "what this run changed" — nothing records
  which files a run wrote, so it names the folder it read and shows that folder as it is
  right now. Never claim a file list belongs to one run.
- Every run gets the view, not only implement; a refine or resolve writes card files too.
  It never writes to git, and it keeps no frozen copy — an old run shows today's files.
- **Can a closed version's changelog be read on the board?**: yes — the app gets a place to
  read what a shipped version changed, rather than leaving it to an editor or git. It is its
  own card, separate from the one that writes the changelog.

## Connectors and keys

- **Which agents come next?**: Cursor and OpenCode, after Claude Code and Codex. OpenClaw
  was dropped — it is a chat-app assistant, not a coding CLI. DeepSeek Harness (dsh) is the
  fifth, added because a user asked. ZCode is the sixth, and the one that wasn't waited for:
  its own runtime, tools and Goal mode are what pointing another agent at Z.ai's endpoint
  can't give, and someone on a GLM plan expects to find it in the agent grid. Anything
  further waits for users to ask.
- **What does an agent have to do to ship?**: stream its log as it works, and resume a run
  that stopped short. An agent that only prints a summary at the end isn't offered — a
  blank box for the whole run reads as a hang, and no Resume means a failure is unfinished
  work the user has to redo by hand.
- **Does the agent's own command line have to provide the log and the resume?**: no — a
  bridge counts, as long as it is still a command the board starts and reads. dsh ships
  driven over ACP (JSON-RPC over stdio), and keeping a bridge package of our own alive is
  accepted if the community one stops keeping up.
- **How does the board reach an agent?**: by starting a command and reading what it prints,
  and no other way. An agent whose live view only exists in a browser app of its own is not
  offered — talking to a server would change how every agent is wired.
- Each connector declares the settings it takes and the dialog draws them. Two shapes
  only: a box to type in, and a list to pick one from. Each keeps its own settings block
  beside its name, so switching loses nothing and a run reads the running connector's
  block and no other.
- Keys live in `docs/kanban/.env` and nowhere else, kept out of git through the board's own
  `docs/kanban/.gitignore` rather than the repo's root one. Type one into the dialog or
  write the line yourself; either way the board reads the same file, and a key written into
  `ui.config.json` is ignored. A saved key is never shown back — the box says it is set,
  with Replace and Clear.
- What `.env` names wins for a run; a variable it doesn't name is left alone, so a key
  already exported in the shell keeps working. Switching connector never touches the keys.
- **How does ZCode sign in?**: with a Coding Plan key and nothing else. The *The login
  ZCode has* pick was dropped rather than taught to explain itself — it left a user with a
  run that died naming a provider they never chose, and no login has been shown to work
  from the board yet. An option comes back when one does (#282).

## Notifications

- **Where does a user review Cloud-relayed task events first?**: in a desktop notification
  center. It proves complete messages and actions without Slack; Slack reuses the same event
  contract as the first external connector.
- **What does the notification center look like?**: a rail down the right of the window, like
  the chat rail, listing rows that carry the card's number and title with the event's name under
  them and nothing more. A row opens that card's page, where the event's state and its actions
  are; no separate page is drawn for an event, because it would duplicate the card page. The bell
  leads the header's tool cluster with its unread count inside the segment, an unread row is an
  accent dot and ink-weight text, and the event's state rides in the card's title band, in the
  slot a delivery's pill already uses.
- **Does the app's own card page wait on Cloud to act?**: no. **Implement** and **Resolve** on a
  task with a live Cloud event start the delivery and write the answer at once, as they do today;
  the action is recorded in Cloud afterwards and every other surface showing that event is told it
  was taken. Only a surface that is not the board's machine waits for the board's server.
- **Does an actionable event interrupt the user?**: yes — it raises a system notification as well
  as lighting the bell, and clicking it opens the app on that card's page. The system asks
  permission the first time, and a switch beside the board's notification setting silences the
  interruption while the bell keeps filling.
- **Does a finished delivery interrupt the user too?**: yes — every final outcome of a delivery a
  notification started raises a second system notification, completed as well as failed,
  interrupted and cancelled, so a run you approved and walked away from tells you it is done. It
  names the outcome rather than the event, opens the same card page, and the same switch silences
  it. An event retired as `stale` started no delivery and raises nothing.

## Answering open questions

- A question with options keeps its text box, but the two ways don't mix: on a
  `single-option` question the user either ticks one option or types an answer.

## Group tasks

- A group is finished by finishing its subtasks, never by implementing the root. Archive
  appears on the root once every subtask is done or rejected; a group whose subtasks were
  all rejected is closed with Reject instead. The root shows each subtask's outcome, and
  done looks different from rejected.
- **How does a group root show what waits on what?**: a map above the subtasks list, one
  column per layer left to right, blockers before what they block. A chip is the subtask's
  id alone and shows its title on hover; nothing labels the columns and the panel carries no
  heading. A group with no dependency inside it shows no map.
- "Implement group" is one run owned by the root that keeps working until every subtask is
  done or rejected. It locks the root and every subtask and keeps one log, shown on all of
  them. Only Claude Code can do this — another connector falls back to one long run with
  the same instructions.

## The goal

- `goal.md` is the whole direction — the horizon and roadmap included. There is no
  separate roadmap file.
- To someone reading the board the goal is a reminder, not a file they work in: a quiet
  header control opens the whole file, and editing sits one click in. It gets no row in the
  Memory panel — one file, one place, and it is read far more often than the rest.
- The nudge bar is a nudge, not a gate: it can be dismissed, it comes back if the goal
  turns weak again long after setup, and it stops as soon as the user writes anything.

## Notice bars

- One shared bar carries every condition the UI can't fix itself — the goal nudge and
  warnings like it. It shows by default, stays while the condition holds, and a ✕ closes it
  without writing to the board. Nothing needs a second condition yet, so the bar is not
  built.

## Views and filters

- The queue view regroups the whole board and hides nothing — it is a second way to group,
  not the rejected ready-only filter.
- The release dropdown is the one place the board hides cards. Its entries are the open
  versions plus **No release** — the first entry and the default; there is no whole-board
  view, since a card already in a version is reviewed in that version. Blockers stay on
  screen whatever release is picked, since an unplanned blocker is usually blocking the
  version being planned.
- Ticking cards to move several in or out of a release is worth having beside the agent's
  fill pass, which only ever adds — a version planned too full needs a fast way back out.
- The New release dialog picks the kind of release with two tabs, **From a goal** and **No
  goal**, not with a switch that means different things. On the goal tab the goal box is
  the whole choice, and the release can't be made without it. A goal can be added later
  from the release's ⋯ menu.
- Daily progress opens from a header icon, not a strip on the board, and shows a line
  chart rather than numbers alone.
- **Which sections live in the left rail as foldable panels?**: Memory only. Runs and Daily
  progress keep their header dialogs until we have seen how the Memory panel reads.
- **Does the rail's search reach archived cards?**: no — open cards only. The rail is about
  what you are working on now.

## Chat in the UI

- **Where does the board's chat live?**: in a rail down the right side of the window, full
  height, a rail like the one on the left. It is folded away by default, so the board and
  the card stay the centre of the app, and a **Chat** button in the header, beside **Create
  task**, opens and folds it.
- **What does the rail show while a card is open?**: that card's own chat. The rail follows
  what you are reading — the board's chat on the board and on a memory file, that card's on
  its page — so only one chat is ever on screen and the card chat needs no panel of its own.
- **Does the chat in the rail change the board?**: yes, and a card's chat as much as the
  board's — it makes the change itself rather than handing it to the card's Edit and Resolve
  buttons. The board redraws where it stands.
- **Does any of it ask first?**: no. Every action goes straight through, archive, reject and
  starting a build included; the changes sit in the working tree for git to undo.
- **How does chat choose between doing work here and starting a run?**: it adds no rule of
  its own. The rail is an ordinary kanban-skill session: `--print` does a flow there, no
  flag starts a run, and users may run any `akb` command they want.

## Moving around the app

- **Do a mouse's back and forward buttons work in the desktop app?**: yes, wherever the
  system tells the app they were pressed — Windows and Linux today.
- **Which pages does the two-finger swipe move between?**: the card pages only. The board's
  columns are scrolled sideways with the very same gesture, so a board that answered the
  swipe would either stop scrolling or navigate when the user meant to scroll. From the
  board, Back and Forward are the menu's.

## A card's page

- **Does a card's page open with the agent's own notes folded shut?**: yes — the page opens
  on the half a human has to read, and the agent half sits below it behind one control. It
  stays how you last left it, so a reader who wants the detail keeps it open.
- **Where does a delivery's state show on the card page?**: on the title band — the delivery pill
  beside the title, with one line under it saying what the delivery waits on and what answers it.
  A delivery that is simply building gets no line — the pill says that already. A pause never
  gets a panel of its own.
- **Where do a delivery's diff and approval live?**: in the block that already holds the session
  log, which grows a **Diff** / **Log** / **Approval** tab strip. The page gains no new furniture,
  so a card's own words sit in the same place whether or not a delivery is live.

## Mockups on a card

- **How does a card body point at a mockup file?**: with a tag the board UI knows, on a line
  of its own — `<Mockup src=".mockups/239/a.html" label="A" />`. The card page draws it as the
  screen that file holds. A markdown link is never drawn as a mockup, so nothing a card
  already says turns into one by accident.
- **Where does the file live, and is it in git?**: `docs/kanban/.mockups/<card id>/` — dotted
  and gitignored, because a mockup is a working drawing that the build throws away. `src` is
  the path from `docs/kanban/`, so the tag and the file are the same string. A tag written
  before the folder was dotted (`mockups/...`) still reads the same file.
- **What does the page do when the file was never drawn here?**: the same plain note as any
  other unreadable tag, saying the file is not on this machine. A card pulled from git carries
  its tags without its pictures, and `ui-design` run again draws them back.
- **Does the dot show up in the address?**: no. `.mockups/239/a.tsx` is the page
  `/mockups/239/a.tsx` — one word in the URL, no dot segment (`mockupHref`).
- **How is a `.txt` mockup shown?**: as the file's own characters in a monospaced block where
  the tag sits — no frame, no scaling, and no switch to "the code behind it", because the file
  IS the drawing. It opens on its own page like any other mockup, at reading size.
- **What happens to a drawing on a narrow window?**: it scrolls sideways. It is never
  re-wrapped: a drawing whose columns break is no longer the drawing.

## Where the UI is documented

- `kanban-ui/README.md` is the user-facing guide: what the buttons do, the Configuration
  dialog, group tasks. Any card that changes visible UI behavior updates that file.
- The skill's `akb guide local-ui` covers installation only — how to run it, the
  options, updating. It never describes using the UI.

## Onboarding

- **What does onboarding lead with?**: a Local board. Cloud is offered beside it as an
  explicit, labelled hosted-service choice, never preselected.

## The app's language

- **How is the language picked?**: guessed once from the operating system on a machine that
  has never said, then owned by the user — a switcher changes it, and nothing guesses over
  that answer again. The site does not guess; the app does, because its first screen carries
  neither the reader's languages nor a switcher of the browser's own.
- **Where is the language reachable before there is a board?**: from a small switcher on the
  launcher — the Open Folder screen the app opens onto. Setup draws the header, so
  Configuration → Language is already on it; the launcher covers the screens that draw no
  header, because every one of them is reached through it.
- **Where does the switcher sit on the launcher?**: in the top-right corner, framed like
  window chrome — outside the centred column, so Open Folder stays the one thing the page
  leads with. The quieter placements, plain words at the foot of the column and a pill in the
  artwork, were turned down as too easy to miss.
- **Does the app's language also decide what the agent writes?**: yes — one setting, not
  two. The chosen language covers the app's own words and the prose the agent writes into
  cards, open questions, memory and changelogs. The board's structure — frontmatter,
  section headings, file names, commands and paths — stays English in both.
- **What happens to a board already written in English when the language changes?**:
  nothing — what is on disk stays as written, and only new writing follows the setting. No
  one-off pass rewrites existing cards or memory into the new language, so a board that
  switches holds both languages at once.
