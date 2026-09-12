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
- **Create new project** on the launcher, beside **Open folder**: name it, say which folder
  it goes in, and the app makes the folder, runs `git init` in it and opens it like any other
  project — so a first project needs nothing prepared on disk. A name that is not one folder
  name, and a destination that is already there, are refused on the form before anything is
  written; a machine with no `git` still gets the folder and the board, and is told the
  repository is missing: `kanban-ui/README.md`.
- The same board in a browser with `npx ai4kanban-ui` — deprecated the day the app
  shipped, still working, and npm points at the download: `akb guide local-ui`.
- Started where there is no board, the page says so and names the command that fixes it.
- Set a board up in the app: a guided run for project, goal and agent, then
  **Finish setup** runs everything still left as one ordinary run — watchable, stoppable,
  resuming from the first unfinished step, and saying when the last one died. A progress
  bar hands over the line to paste into a coding agent: "The first run".
- A button and a terminal command do the same thing to a card, because every screen reads
  and writes through the board's own command; an edit queues behind whatever else is
  writing, and a screen that finds no command says so in one line.

## Reading the board

- Flip between the board and a **Queue** that splits the same cards into ready and
  not ready, see which card is in the way of a blocked one, and show one release at a time.
- Read and edit the whole project goal from the header compass, on the board and on a card.
- Find a card by typing part of its title or body into the rail's search box: "Finding a card".
- A card page opens on the human half; everything below the `<!-- agent -->` boundary folds
  behind **what the agent worked out**, and a search hit below it opens the fold for that
  visit: "Reading a card".
- **Insights** holds one chart: Daily progress (30 days of completed, created, rejected),
  read on each open from that repo's `metrics.csv` and never fetched from anywhere:
  "Insights".
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
- **AI review** turns that review off — a third switch beside the two above, on by default,
  and the only place it is answered: the Implement dialog does not ask per build. The build
  then goes straight to landing, the delivery block's foot reads **No AI review**, and the
  choice is frozen when the delivery starts: "Turning AI review off".
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
- Runs opens on a pixel office where every live job is a bot at a desk: click one for its
  work log on the right, **Completed** for the records on the left, and more than eight jobs
  pair up at desks before the office pages on. `kanban-ui/README.md`.

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
- While a reply is coming, Send is **Stop**: one click, or Esc, ends it there, what arrived is
  kept and nothing is undone. Esc only counts when nothing sits over the chat, and a reply
  `akb chat` is writing stays the terminal's own Ctrl-C. See `kanban-ui/README.md` → Chat.
- A message gets used again without retyping: **Copy** under any reply and on a code block
  inside one, **Send again** on a reply that stopped short or came back with nothing,
  **Reword** on any message you sent to put those words back in the box, and a copy button in
  the chat's header that takes the whole exchange as markdown. See `kanban-ui/README.md`
  → Chat.

## Configuration

- **Runtimes** is one list you add to: **Global default** first, which nothing renames or
  deletes, then every runtime you named, then **+ Add runtime**. A folded row is its name, the
  CLI's mark and the model it runs, with **Signed out** or **Not installed** on the right where
  this computer says so; opening one holds its name, the CLI card grid, a folded **Advanced
  settings** and **Test connection**. Naming the new row is what creates it, and leaving the
  name empty drops it.
- Delete sits at the right of a saved row's title and asks first: the agents on that row go
  back to **Global default**, and the row's API key on this computer goes with it. There is no
  "make default" control anywhere — the first row is the default.
- No Computers picker: a board knows exactly one computer. What is that computer's is named
  where it matters — the row's key and the verdict beside it.
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
- **Agents** is the whole team on one pane — the Rules pane is gone. A grid of characters,
  one per agent: the roles the board runs its own flows by (Planner, Builder, Reviewer, or
  Writer on a marketing board) and the specialists a card asks for, each with a switch where
  it may be turned off. Selecting one opens its page — its rule in your own words, what it
  remembers, its settings where it has them, and **Add a specialist** writing a new
  `docs/kanban/agents/<name>/AGENT.md` from a template. Anything wrong with an agent it found
  is a line under **Problems on this board**: "Agents", "Give an agent a rule" and "Give an
  agent memory" in `kanban-ui/README.md`.
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
- The app icon wears the bell's own count in its badge — every board Cloud is on for,
  whether the window is focused, buried or hidden — and reading the rows empties both at
  once. Clicking the icon raises the window with the bell open on what it was counting.
  Systems with no badge are unchanged.
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
  and driven as an ACP conversation (`grok agent stdio`), so its log streams as it works and
  a stopped run offers Resume. Implement, refine, archive, a stop, a resume and a failed run
  have all been watched end to end, and the runs panel's cost, tokens and model are Grok's
  own numbers: `web/content/docs/connectors.mdx`.
- **Antigravity CLI** is on the runtimes grid with a Model box and no key box — runs sign
  with the Google login `agy` already holds, and the thinking level is part of the model
  id rather than a box of its own. It is driven as a printing run (`agy … -p`), so its log
  streams as it works and a stopped run offers Resume; the runs panel shows its token
  counts and a blank for cost and model. No card has run on it yet:
  `web/content/docs/connectors.mdx`.
- A reply in the chat rail folds what the agent did behind one line — **Worked for 1m 5s**,
  counting up while the reply comes, with the step it is on left in the open — and says what
  the turn cost under it (`1,840 tokens · est. $0.03`) for an agent that reports it. Your own
  messages sit in a block of their own, and scrolling up puts **↓ 2 new lines** on screen to
  get back to the newest.
- **Archive** at the foot of the rail, under Memory, opens every finished card in
  `docs/kanban/.archive/`: newest first, each row its id, title, release and the day it was
  archived, and each one opening whole and read-only. Nothing archived shows in the columns,
  the release picker or the search box, and the row carries no count.
- The chat rail's message box carries the agent and the model **that conversation** runs on,
  on its own bottom row beside Send: the agent as its mark, the model typed in beside it,
  and one click back to the board's pair. Both start on the board's and stick to that
  conversation until changed — Configuration is untouched and no other chat moves. Changing
  the model carries the same conversation on and the transcript marks where it changed;
  switching the agent starts it over behind the bin's ask-once, and is refused while a reply
  is coming.
- The pane's specialists come from `docs/kanban/agents/<name>/AGENT.md`, its own file drawing
  its own settings; a folder still where agents used to live is one of the lines under
  **Problems on this board**: `kanban-ui/README.md`.
- Setting up a new board **finds the coding agent instead of asking for it**: the first run
  tries the agents already on the machine — Claude Code, then Codex, then the rest, skipping
  any still wanting a key — with the same call the Test button makes, and the first that
  answers is saved and named on the way to the project step. The try is one full-window view
  with a pixel character at work and a "Set it up myself" link; the picker takes over when
  nothing answers, carrying what came back, and the agent setting goes back the way it was:
  `web/content/docs/connectors.mdx`.
- The folder chip carries a **board badge** beside the path: the board's own word —
  "Engineering" on a product board, "Marketing" on a marketing one, cut to "Eng" on a narrow
  window. The two are side by side in the one frame, the path opening the projects list and the
  badge this project's boards; a project with one board gets a label with nothing to press.
  Picking another board hands the window over the way the projects list does — its own server,
  the page replaced, the board left behind still running. A board is any folder under the
  project with `todo/` and `config.md`, looked for two levels down: `kanban-ui/README.md`.

- Onboarding **leads with Local and offers Cloud beside it**: the launcher's one Open Folder
  button is now four moves — Create and Open Local board on the framed card, Create and Open
  Cloud board on the card beside it, marked a hosted, invite-only preview and never
  preselected. The Cloud choice opens a panel in the same window with no board behind it: the
  GitHub sign-in, the preview being closed to an account with no invite, the workspace and the
  project folder with a Local-to-Cloud import, and the one commit going Cloud offers. All four
  moves pick a project folder, and a recent project whose board lives in a workspace wears a
  Cloud badge: `web/content/docs/local-and-cloud-boards.mdx`.
- **Configuration → Workspace**, on a Cloud board only, is where the owner runs the workspace:
  its name and rename, the execution nodes with rename and remove, an export of the whole board
  to a folder that opens as a Local board, leaving Cloud, and deleting the workspace behind a
  confirmation that names what goes. A leave writes the board back into `docs/kanban/` and
  offers the reverse commit; a delete takes the pointer off and the window lands on the
  launcher: `web/content/docs/local-and-cloud-boards.mdx`.
- **Going Cloud and coming back are one commit each, staged by path.** It carries the board
  files leaving or entering git, `.ai4kanban.json`, and the `docs/kanban/` block in the root
  `.gitignore` — and nothing else the working tree holds, including work already staged.
  Declining leaves a checkout that still works, and the offer comes back from the workspace
  controls until it is taken. A folder with no git repository takes the Cloud path and is told
  there is nothing to commit to yet: `web/content/docs/local-and-cloud-boards.mdx`.
- A checkout whose workspace it can no longer read is told **the board is no longer this
  account's — deleted, or never theirs** — and offered the two ways out: sign in as the account
  that owns it, or leave Cloud and keep the markdown in the folder.
- The board and card screens the app draws are the same ones the hosted pages at
  `cloud.ai4kanban.dev` draw, read-only: handed no actions they render every control that
  would write as absent rather than dead, and they draw in the reader's own browser
  language — English or Simplified Chinese — where there is no machine setting to read.
- Anonymous usage reporting is on by default, and the app says so once per machine before it
  opens anything: a **Help improve AI4Kanban** step with a **Share anonymous usage** switch
  already on, **Privacy details**, and **Continue** as the only way past it. It is not a setup
  box — it comes ahead of the guided first run on a new board and on its own before a board
  that is already set up, and it never returns once answered. The same switch stays as the
  **Privacy** group of Configuration → General, with the install id while there is one and the
  link to every event and field: `https://ai4kanban.dev/privacy`.
- Create task opens on **Add task** and can be switched to **Build now**: what you type goes
  straight to a build with no card at all. Send opens a guard first — no card is written, no
  questions come back, nothing reviews it before it reaches your branch — and confirming
  closes the sheet and opens Runs on the run. A start that is refused keeps the sentence in
  the box and says why under it. A card-less flow in Runs shows the typed sentence where a
  `#id` would be, and its delivery's stop, with the commands that put it back in motion, is
  read on the flow rather than on a card page.
- **Skip for now** on the goal step is an answer: setup finishes from there, and no
  "Skipped" tag, goal band or "write the goal first" refusal is left on the board. Writing a
  goal later is the star in the top row — it says **Add goal** while the file is empty and
  opens the box straight away, and turns back into **Goal** once it holds your words.
- A board with no card on it shows one panel in place of the columns: what an empty board is,
  and **Create the first card**, which opens the create sheet.

- **Build clear cards automatically** is the first row of Configuration → General → Delivery
  and the only one that decides whether a delivery starts at all. Off by default; on, the
  ready gate judges each card whose plan settles and builds the ones it passes. Its own
  runtime picker sits under the row — the board's runtime, or one of the named ones — and is
  drawn only on a board that names more than one.
- **Decider** is the only role in Configuration → Agents' **Optional** group. Its page carries
  the one peach cost strip in the dialog — "While this is on, nothing stops for you" — and its
  switch asks once before it goes on. A card it answered wears a sky skip mark on the board
  with the count in its hover, and **What Decider chose for you** on the card page lists each
  question, the option taken and the file it went on, with a blind pick called out in peach.
  A delivery stopped or held on questions reads "Decider is answering" instead of "Waiting on
  you", and Resolve stays live under it.
- **Build now writes a card and builds it**: the sheet's Build now still sends one request
  with no id, and the run's first act is `akb raw create` — a title read off the sentence,
  the sentence itself as the summary's code block, and nothing else on the scaffold. The
  board hands that card to the delivery already in flight, so Runs turns from the sentence
  into `#id` and the card page shows the delivery. The request now carries the release on
  screen, the foot reads it beside "no review before your branch", and the Send guard leads
  with the card it writes above the two lines it still skips.
- **Build now stands under a settled plan too**: Discuss's plan ask now offers Start planning,
  **Build now** and Not yet. Build now opens the sheet's own guard on the answer pressed, then
  starts the same run Create task's Build now starts — pointed at the plan file, read
  server-side, in the release on screen. The run writes one card from the plan (its title, the
  plan verbatim as the summary, `## Source` naming the file) and builds it, refining and
  reviewing nothing. While it works the answers give way to "Building from this plan…", and the
  plan is let go once that run has written its card, whatever the run did afterwards.
- **A new runtime is set up in one pass**: the row **+ Add runtime** opens now draws the
  whole runtime — the name, the connector grid and the same **Advanced settings** fold every
  saved row has, so provider, endpoint, key and model are filled in before it is named rather
  than found afterwards. Naming it creates it and everything typed lands on it; leaving it
  unnamed drops the lot. A press outside the row is what ends it.
- **The gate switch moved to the Agents page**: Configuration → General → Delivery now holds
  three switches, not four — **Build clear cards automatically** is gone, and **Gater** is a row
  on Configuration → Agents beside Decider, with its own switch, connector, instructions box and
  `Runs when` line. A board that already had the gate on finds Gater on.

- **Both chat boxes take a dragged picture**: image files dropped on the chat rail's message
  box, or on the create-task view's Discuss box, go in the way a paste does — several to a
  drop, as removable thumbnails that only attach on Send. The whole box is the target and it
  wears the accent while files are over it, its foot row saying they go in on release. A
  dropped file that is not a picture is named where a refused paste says so, and pictures that
  came with it still go in. A file dropped anywhere else in the window does nothing: the board
  stays where it is and the unsent draft survives.

- **Prune memory is a button, not a card**: the Memory panel in the rail and the phone's Memory
  screen lead with **Prune memory**, which opens Configuration → Agents on the Memory pruner's
  page. **Run now** there starts one pass and reads **Running…** while it goes; a compact
  **Recurring pruning** chip beside it opens the opt-in and, once on, the cadence — neutral
  while off, showing the cadence while on, and opening it enables nothing. A cadence the board
  cannot read is refused in place and leaves the schedule off. Under the pair, quiet text says
  **Never run** until the first pass that passed, then its time; a pass that failed says so
  beside Run now and leaves that time where it was.

- **The inbox is called Triage.** The rail row, the page title and the list all read
  "Triage / 待筛选", and the add box is "Add to triage / 加入待筛选". The page still draws one
  list and one add box. When the settings are missing it names them by their new names —
  `Triage endpoint` and `TRIAGE_ENDPOINT_TOKEN`: `web/content/docs/triage.mdx`.

- **A card being created does not open**: while the run that wrote it is still going, its board
  card sinks into the board — wash ground, hairline, no shadow — wears a pulsing **creating**
  mark in place of its status pill, and clicks nowhere. Its page refuses a direct URL with the
  reason and a way back. A creator that stopped short leaves the card marked **unfinished** with
  **Resume creating** on the card itself, since there is no page to offer it on. Both marks go
  the moment the creator finishes and the card draws as any other.
- **Typing with an IME in a marketing draft is uninterrupted**: the autosave waits out a
  half-typed candidate instead of writing through it, so the candidate survives and the caret
  stays where you are typing. A rewrite that lands under an open draft also keeps the caret.
- **Triage is an agent you can switch on**: its row is in **Configuration → Agents** under
  **Optional**, and only on a board where Triage is open at all. Its page says it cards items
  itself and what that costs, and the switch asks once on the way on — which is now a property
  the board declares per agent rather than a name the pane keeps, so the Decider and Triage ask
  through the same control.
- **The bell splits into To do and Landed**: the notification rail carries two tabs beside its
  title — **To do / 待处理** for anything still wanting a person (to review, to answer, a
  delivery that did not land, one interrupted, one waiting on a machine) and **Landed /
  已落地** for deliveries that succeeded. The bell's number and the Dock badge count **To do**
  alone; a new landed record dots the **Landed** tab instead, and switching to it clears the
  dot. **Mark all read** works on the tab you are on, and the rail opens on **To do** every
  time.
