# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note. `kanban-ui/README.md` is this module's doc; a line
naming no other doc is covered there.

## Running the board

- The desktop app, from `ai4kanban.dev/download`: nothing installed first, it reopens the
  last repo, finds your coding agent, and installs a newer version when one is out. Unsigned
  on macOS, Windows and Linux, with the download page saying how to get past each warning.
- A newer version installs from the notice above the board and from **Check for Updates…**:
  one click downloads it while you keep working, and the restart you pick puts it in place —
  never before. A download that fails, is cut off, or does not match the checksum published
  with it leaves the running app untouched and still offers the downloads page, and a copy
  that cannot replace itself — a checkout, a Mac copy on a disk image or translocated, a
  folder it cannot write, a Linux copy that is not an AppImage — says why instead:
  `desktop/README.md`.
- Open, reopen and drop projects from the launcher; one project open at a time, a run
  keeps going in the project it started in, and back/forward walks the views you opened:
  `desktop/README.md`.
- The same board in a browser with `npx ai4kanban-ui` — deprecated the day the app
  shipped, still working, and npm points at the download: `akb guide local-ui`.
- Started where there is no board, the page says so and names the command that fixes it.
- Set a board up in the app: a guided run for project, tracks, goal and agent, then
  **Finish setup** runs everything still left as one ordinary run — watchable, stoppable,
  resuming from the first unfinished step, and saying when the last one died. A progress
  bar hands over the line to paste into a coding agent: "The first run".
- A button and a terminal command do the same thing to a card, because every screen reads
  and writes through the board's own command; an edit queues behind whatever else is
  writing, and a screen that finds no command says so in one line.

## Reading the board

- Flip between the track board and a **Queue** that splits the same cards into ready and
  not ready, see which card is in the way of a blocked one, and show one release at a time.
- Read and edit the whole project goal from the header compass, on the board and on a card.
- Find a card by typing part of its title or body into the rail's search box: "Finding a card".
- A card page opens on the human half; everything below the `<!-- agent -->` boundary folds
  behind **what the agent worked out**, and a search hit below it opens the fold for that
  visit: "Reading a card".
- **Insights** holds two charts: Daily progress (30 days of completed, created, rejected)
  and Planning quality (details settled, decisions that stood, proposals built, per
  release), worked out on each read from that repo's `record.csv` and never fetched from
  anywhere: "Insights".
- Read what the agent remembers from the **Memory** panel — the four project files and one
  row per module, each opening as its own page, read-only and starting no run: "The board's memory".
- A group root's page draws a map of its subtasks in build order, one chip per subtask with
  lines from blockers, and a lock on a subtask waiting on a card outside the group.
- Opened on a phone the board is laid out for that width: a bottom tab bar of **Board**,
  **Find**, **Memory** and **More**, one column at a time under a band that names it, a
  card's actions stacked full width, and Resolve, Create task and Implement as pages with
  their buttons at the foot. A window is unchanged.

## Releases

- Move a card into a release or back out from the card page, with no version id to type.
- Start a release from the header dropdown on any board — **From a goal**, where an agent
  run plans it, or **No goal**, which applies the high-priority rule.
- Fill a release from its goal as an ordinary run: stoppable, logged, and additive when run again.
- Say what a version is for, read it under each version, and change it from the ⋯ menu.
- Close a shipped version or drop one that won't ship, with a confirm listing what changes;
  closing also writes the changelog as a background run, naming `akb changelog <version>`
  as the fallback when that run fails.

## Deliveries

- Implement starts a **delivery** — the whole job, several sessions long, carried by one
  click: build, review, correct, land as one squash commit on your branch, archive the
  card. The dialog names the steps and the branch: "Delivery", "Landing on your branch".
- A delivery builds the card as it was approved when the click landed; editing the card
  afterwards doesn't change what it builds.
- A card with a delivery in flight can't be edited, refined, resolved, archived or
  rejected, on the card page or in a terminal. Priority, ROI, release, modules and todos
  stay yours.
- Each delivery builds in its own git worktree and branch under `.akb/worktrees/`, so
  several cards build at once without touching each other or your open edits. Turn
  **Automatic Git commits** off and it works in your project folder instead, one at
  a time, and you commit after review: "Where a delivery's code goes", "Manual commit mode".
- The Implement dialog also carries **Build this on a branch of its own** per click — it
  opens on the setting's side and never writes back, so one card can go the other way
  without moving the default. Absent only where no worktree is possible at all.
- Review is a fresh session reading the approved card and the diff, never the session that
  wrote the code: it passes, sends clear mistakes back for up to two corrections, or stops
  and asks you: "Review".
- **Approve diffs before landing** holds every delivery for a human read of the
  tree, outside the landing queue so other cards still land; an approval covers one base
  commit and one tree and is cancelled by either moving: "Approving a delivery".
- Building a card with **open questions** is allowed behind a third warning: it builds,
  reviews, then holds outside the landing queue until the questions are answered.
  Answering carries the same delivery on unless it changed what the card asks for.
- The card page says where the delivery has got to — a pill beside the title, what it waits
  on, and a Diff / Log / Approval strip beneath: "What the card page says while a delivery
  runs", "The Diff tab".
- **Discard** is the one way out: the card unlocks and the worktree and branch go. Resume
  picks the same delivery up after a failed or cut-off session; **Continue delivery**
  starts the next session when the process watching the last one died.
- Every delivery leaves a record in `docs/kanban/deliveries/`, tracked in git and kept
  after the card is archived.
- Review writes what needs no decision into the card's `## Worth noting after
  implementation` — it blocks nothing and is never part of what a delivery builds.

## Runs

- Stop a run from the log window's ✕, resume a failed one from the button rather than a
  terminal, and see its cost and model beside its duration: "Stopping a run".
- A card whose newest run died opens with that log open and a line saying the card may be
  part-built: "On the card it was working on".
- A run started in a terminal and one started from a button are the same run — one list,
  either side can watch, stop or continue it: `cli/README.md`.
- A run whose agent has gone quiet ends by itself: **End a silent run after** in
  Configuration → General sets the wait — 10 minutes unless you change it, **Off** leaves
  the card held until you stop the run — and the run it ends is a failure you resume from
  the button.

## Cards

- A run that writes or changes a card is followed by a refine of that card as its own run;
  a rough card saves a one-shot refine when it first becomes blocked: "Refine".
- Refine the card you are looking at, whenever you want, from its page.
- Schedule an implement or refine to run once the last card in its way leaves; the card
  reads **pending** and **cancel** takes it off for that blocked episode: "Schedule it instead".
- Answer a question with choices by ticking a list, with the recommended ones pre-ticked.
- Cross off what a finished build left you to check by hand — the lines sit in their own
  panel under the open questions, with a count on the board card: "Checking a card by hand".
- Read a card's mockups where their tags sit: `.tsx` and `.html` draw as one scaled screen
  with a switch to the code, `.txt` shows as the monospaced drawing it is, and a tag the
  board can't draw reads as a plain note: "Mockups on a card".
- Archive a group root once every subtask is done or rejected.
- Run a recurring card from its page — **Run** stands in for Implement — or give it a
  cadence and the board runs it when due: "Recurring tasks".

## Chat

- **Chat** in the header opens a conversation down the right of the window, following what
  you are reading — the board's chat on the board, a card's on its page — answering from
  this project's goal, cards and memory, kept across restarts and shared with `akb chat`.
- What chat changes shows on the board and card pages as the reply arrives, with no
  reload; asking for work sends an ordinary run to the runs panel, and a card another run
  already has is refused by name: "Chat".
- The chat box stays live while a reply is coming — one the window started or one `akb chat`
  is writing in a terminal — so a thought that arrives mid-reply goes into it. Only sending
  waits, and nothing leaves the box until you press send. The box grows with what is typed
  to about eight rows, fewer on a short window, then scrolls; up- and down-arrow in an empty
  box walk back through what this conversation has sent. See `kanban-ui/README.md` → Chat.

## Configuration

- **Runtimes** names the board's runtimes and what this computer runs each one as, kept
  visibly apart — rename, make global, remove, and a **Test** that spawns that runtime. A
  board naming no runtimes is the plain harness pane it always was: "Runtimes, and the
  harness behind one".
- Two tabs: **Runtimes** is one row per runtime, the global one open and the rest folded to
  where and what they run, and **Computers** lists the machines the board knows. Each runtime
  is headed with the computer it runs on, picked there and travelling with the repository;
  pointed at another computer it shows what that machine reported and offers nothing to press.
  The pick says where a runtime belongs — a run still lands on the machine it was started
  from: `web/content/docs/daily-loop.mdx`, "Which tool each flow runs on".
- Run the board on Claude Code, Codex CLI, Cursor, OpenCode, DeepSeek Harness or ZCode,
  each with its own settings, live log, stop and resume; the picker dims the ones whose CLI
  isn't installed and names the install command: "What each agent needs",
  `web/content/docs/connectors.mdx`.
- An installed CLI that nobody is logged in to reads **Logged out** in the picker, with the
  command that logs it back in. Claude Code, Codex, Cursor and OpenCode are asked; the rest
  sign with a key or have no command that answers. It warns and gates nothing — every way of
  starting a run still starts: `web/content/docs/connectors.mdx`.
- dsh installs in two commands, never one, and a run points the bridge at the dsh beside it.
- Pick how hard the model thinks, and who pays for a run — subscription, API, or an
  Anthropic-compatible gateway — with the run going through that pick alone and not
  through your shell: "Which provider a run goes through".
- Keys live in `docs/kanban/.env`, kept out of git, and **Test** sends one tiny message
  through the saved setup: "Keys", "Testing the connection".
- **Agents** lists every spec agent with what it fills in, a switch to stop the board
  starting new runs of it, and its own settings where it has them — board-wide, saved with
  the board: "The spec agents".
- **Rules** adds one rule in your own words to the end of any flow's instructions, saved
  per flow as files in your board and shared through git: "Flow rules".
- **Skill** adds or updates the coding agent skill and says how current it is; the app also
  puts `akb` on the PATH itself, silently repairing a dead link: "The coding agent skill",
  `desktop/README.md`.
- The board reads its rules from the `akb` on your PATH when the app didn't bring its own.
- **Language** — English or 中文 — settles the machine, not the board: it is held in
  `~/.ai4kanban/settings.json`, takes effect with no reload, and has no `akb` command. The
  app guesses it once from the system's languages on first launch, and the launcher carries
  its own switcher: "Language".

## Cloud and notifications

- **Cloud** is the last Configuration section: the person this machine signs in as, saying
  what Cloud relays and what it never receives, and showing one state per sign-in answer.
  Not-admitted is one ask — the refusal in the service's words, **Request an invite**,
  **Sign out** — and approval admits the account with no second sign-in. A board with
  nobody signed in looks exactly as it did.
- A bell in the top row carries every board Cloud is on for: unread count, one row per
  event newest first, opening the card and switching board when it belongs to another.
  The right side holds one rail at a time, so the bell and chat fold each other.
- A board that couldn't reach Cloud catches up on its own — retried on the board's tick and
  on a backoff — and what it finally gives up on is said in the bell rather than
  disappearing. Turning Cloud on for a busy board fills over minutes.
- Slack connects once, in **Configuration → Notifications**, and belongs to the account:
  Slack's own consent screen, then the workspace, the channel or DM it posts to, and
  Disconnect, which stops every board's messages without touching a board. A refusal from
  Slack is shown where the connection was made. **Open card in app** opens that board's card.
- Lark sits beside Slack and reads **Coming soon.** until the app is published in the 飞书
  and Lark directories; `LARK_COMING_SOON` turns the buttons back on, and a connection
  already made is untouched.
- **Grok Build** is on the runtimes grid, configured with a model box and an xAI key box
  and driven as an ACP conversation (`grok agent stdio`), so its log streams and a stopped
  run offers Resume. It is marked untested — nobody has watched a run — and what the runs
  panel shows for cost, tokens and model is a claim: `web/content/docs/connectors.mdx`.
- A reply in the chat rail folds what the agent did behind one line — **Worked for 1m 5s**,
  counting up while the reply comes, with the step it is on left in the open — and says what
  the turn cost under it (`1,840 tokens · est. $0.03`) for an agent that reports it. Your own
  messages sit in a block of their own, and scrolling up puts **↓ 2 new lines** on screen to
  get back to the newest.
- **Archive** at the foot of the rail, under Memory, opens every finished card in
  `docs/kanban/.archive/`: newest first, each row its id, title, release and the day it was
  archived, and each one opening whole and read-only. Nothing archived shows in the columns,
  the release picker or the search box, and the row carries no count.
