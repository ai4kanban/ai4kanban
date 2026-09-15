# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note. `kanban-ui/README.md` is this module's doc; a line
naming no other doc is covered there.

## Running the board

- The desktop app from `ai4kanban.dev/download`: it reopens the last repo, finds your coding
  agent, and installs a newer version in the background, leaving the running copy untouched
  when a download fails or cannot replace itself: `desktop/README.md`.
- Open, reopen, drop and create projects from the launcher — **Create new project** makes the
  folder and runs `git init` — with one project open at a time and back/forward through the
  views you opened: `desktop/README.md`, "In the app".
- Onboarding leads with a Local board and offers Cloud beside it, and a recent project whose
  board lives in a workspace wears a Cloud badge:
  `web/content/docs/local-and-cloud-boards.mdx`.
- A repository can hold more than one board: the folder chip carries a board badge beside the
  path, and picking another board hands the window over the way the projects list does.
- The same board in a browser with `npx ai4kanban-ui`, deprecated the day the app shipped:
  `akb guide local-ui`. Started where there is no board, the page names the command that
  fixes it: "When it finds no board".
- Setting a board up in the app is a guided first run that finds the coding agent instead of
  asking for it, and **Finish setup** runs the rest as one watchable, resumable run:
  "The first run", `web/content/docs/connectors.mdx`.
- Anonymous usage reporting is on by default and the app says so once per machine, ahead of
  everything, with the same switch left in Configuration → General → Privacy.
- A button and a terminal command do the same thing to a card, because every screen reads and
  writes through the board's own command.

## Reading the board

- The board, a **Queue** splitting the same cards into ready and not ready, one release at a
  time, and what is in the way of a blocked card: "The board".
- Read and edit the project goal from the header star, which reads **Add goal** while the
  file is empty: "The goal".
- Find a card by part of its title or body: "Finding a card". A card page opens on the human
  half and folds everything below `<!-- agent -->`: "Reading a card".
- A group root's page draws its subtasks in build order, with lines from blockers:
  "Group tasks".
- **Insights** holds one chart, Daily progress, read from that repo's `metrics.csv`:
  "Insights".
- **Memory** in the rail opens the four project files and one row per module, read-only:
  "The board's memory". **Archive** under it opens every finished card, newest first, whole
  and read-only: "The archive".
- A board with no card shows one panel in its place, with **Create the first card**.
- Opened on a phone the board is laid out for that width — a bottom tab bar of **Board**,
  **Find**, **Memory** and **More**, one column at a time, and Resolve, Create task and
  Implement as full pages. A window is unchanged.

## Releases

- Move a card into a release from its page, start one from the header dropdown — **From a
  goal** or **No goal** — say what a version is for, fill it as an ordinary additive run, and
  close or drop it with a confirm listing what changes. Closing also writes the changelog as
  a background run: "Releases".

## Deliveries

- Implement starts a delivery — build, review, correct, land as one squash commit, archive —
  against the card exactly as it was approved: "Delivery".
- Each delivery builds in its own worktree and branch under `.akb/worktrees/`; **Build this
  on a branch of its own** is per click, and manual commit mode works in the project folder
  one at a time: "Where a delivery's code goes", "Manual commit mode".
- A card with a delivery in flight can't be edited, refined, resolved, archived or rejected;
  priority, ROI, release, modules and todos stay yours: "Delivery".
- Review is a fresh session reading the approved card and the diff: it passes, sends clear
  mistakes back for up to two corrections, or stops and asks. **Review every build**, under
  General → Delivery, turns it off: "Review", "Turning AI review off".
- **Approve diffs before landing** holds every delivery for a human read, outside the landing
  queue, and one approval covers one base commit and one tree: "Approving a delivery".
- Building a card with open questions is allowed behind a warning: it builds, reviews, then
  holds until they are answered: "Delivery".
- The card page says where a delivery has got to, with a Diff / Log / Approval strip:
  "What the card page says while a delivery runs", "The Diff tab".
- **Discard** is the way out; **Resume** and **Continue delivery** pick a failed or cut-off
  delivery back up: "Delivery".
- Every delivery leaves a record in `docs/kanban/deliveries/`, kept after the card is
  archived, and review writes what needs no decision into `## Worth noting after
  implementation`.
- **Build now** on Create task, and under a Discuss plan, builds with no card of its own: the
  run writes the card as its first act, so Runs turns from the sentence into `#id`. Its guard
  leads with the card it writes above what it skips.

## Runs

- Stop a run from the log window, resume a failed one from the button, and read its cost,
  tokens and model beside its duration: "Stopping a run", "What a run cost, and which model
  it used".
- A card whose newest run died opens with that log open and a line saying it may be
  part-built: "On the card it was working on".
- A run started in a terminal and one started from a button are the same run: `cli/README.md`.
- **End a silent run after** in Configuration → General sets the wait, and the run it ends is
  a failure you resume from the button.
- Runs opens on a pixel office where every live job is a bot at a desk, with **Completed** for
  the records: `kanban-ui/README.md`.
- An open run log has ONE header bar: the task and its `#id`, which step this is, when the job
  started, then Stop or Carry on, the outcome, the context ring and the model — and past a
  hairline the window's own Collapse or ✕. The log starts directly under it.
- A running card's mark on the board opens Runs on that run; the board draws no log of its own,
  and neither does **Resume creating** on a half-written card.
- Inside the pixel office the two drawers are game dialog boxes — square corners, a thick ink
  line, a hard shadow — pushed out from the left and right walls with their title bars level,
  the log's reversed out to paper on ink. The chips over the room wear the same square frame,
  and the records entrance that is open shows as pressed. Everywhere else — the two-pane
  fallback, the board, a card page — the panels are unchanged.

## Cards

- A run that writes or changes a card is followed by a refine of that card, and any card can
  be refined from its page: "Refine".
- Schedule an implement or refine for when the last card in the way leaves: "Schedule it
  instead".
- Answer a question with choices by ticking a list, with the recommended ones pre-ticked, and
  cross off what a build left you to check by hand: "Checking a card by hand".
- Read a card's mockups where their tags sit: "Mockups on a card".
- Run a recurring card from its page, or give it a cadence: "Recurring tasks".
- A card the Decider answered wears a skip mark, and **What Decider chose for you** on the
  card page lists each question, the option taken and where it went:
  `web/content/docs/agents.mdx`.
- A card is not openable while the run that wrote it is still going: it sinks into the board
  with a pulsing **creating** mark, and a creator that stopped short leaves it **unfinished**
  with **Resume creating** on the card itself.

## Chat

- **Chat** in the header opens a conversation down the right, following what you are reading,
  kept across restarts and shared with `akb chat`: "Chat".
- The box stays live while a reply is coming, grows to about eight rows, and walks back
  through what it has sent with the arrow keys; Send becomes **Stop**, and what arrived is
  kept: "Chat".
- **Copy**, **Send again**, **Reword** and a copy of the whole exchange as markdown: "Chat".
- A reply folds what the agent did behind **Worked for 1m 5s** and says what the turn cost.
- Both chat boxes take a dragged picture the way a paste goes in, as removable thumbnails
  that only attach on Send.
- The message box carries the agent and model **that conversation** runs on, starting on the
  board's pair and sticking to that conversation: `web/content/docs/chat.mdx`.
- **Share with the team when it ends** sits under the box on Discuss and a card's chat: it is
  off by default, sends the whole conversation and the code behind it at the end, and a
  discussion that shares must be linked to a card before it can end.

## Configuration

- **Review chat memory** sits under **Automatic** with its switch on, and its page carries
  **Review now** and the last review that passed — no cadence, because the review is daily.
  It is the one switch that asks before it goes OFF, and **Review now** still works once it
  is off.
- **Runtimes** is one list: **Global default** first, undeletable, then every runtime you
  named, each set up in one pass before it is named, with **Test connection** and a delete
  that puts its agents back on the default: "Runtime — the coding tools this board can run",
  `web/content/docs/runs.mdx`.
- Which coding tools the board runs and what each needs installed, what a CLI nobody is
  logged in to reads, how hard the model thinks, who pays, and where keys live:
  "What each agent needs", "Which provider a run goes through", "Keys",
  `web/content/docs/connectors.mdx`.
- **Agents** is the whole team on one pane — the roles and the specialists, each with a rule
  in your own words, what it remembers, its settings, **Add a specialist**, and **Problems on
  this board**: "The agents", `web/content/docs/agents.mdx`.
- An agent wears one name on every screen: the office nameplate, a run's record, the
  Agents pane and a workflow's stages all read it off one lookup — a role from the app's
  own words, a specialist from its `AGENT.md`, and anything else spelled out of its id.
- **General → Delivery** holds the three delivery switches — automatic Git commits, approving
  diffs before landing, and reviewing every build. The switchable roles — Gater, Decider,
  Proposer, Triage — are rows on the Agents pane, each asking once before it goes on. No agent a
  workflow stage assigns has a switch anywhere, the Code reviewer included:
  `web/content/docs/agents.mdx`.
- **Prune memory** in the Memory panel and on the phone's Memory screen opens the Memory
  pruner's page; **Run now** starts one pass, and a **Recurring pruning** chip picks the
  cadence from a list — Off, every 6 hours, every day, every 7 days, or Custom — saving on the
  pick. Under them, quiet text says when the last pass that passed ran.
- **Tidy stalled cards / 整理搁置卡片** carries the same Run now and cadence chip as the
  pruner, and under the runtime a line of its own: when the current or latest sweep ran, how
  it ended, how many cards it kept and discarded, and **View report / 查看报告**. The report
  opens in place with a way back to the same agent, one row per card — its id, the title and
  the days it had sat when it was picked, the verdict and the whole note its run ended with —
  and a link across to that run. Only the latest sweep is kept. Outside a Git repository
  nothing can be dated, so Run now is off and one line says why.
- **Skill** adds or updates the coding agent skill, and the app puts `akb` on the PATH itself:
  "General → Setup: the coding agent skill", `desktop/README.md`.
- **Language** — English or 中文 — settles the machine rather than the board, takes effect
  with no reload, and is guessed once from the system: "General → Language".
- **Workspace**, on a Cloud board only, runs the workspace: rename, execution nodes, export to
  a folder that opens as Local, leaving Cloud, and deleting it. Going Cloud and coming back
  are one commit each, staged by path: `web/content/docs/local-and-cloud-boards.mdx`.

- **Configuration → 流程 / Workflows** lists every workflow this board has down the left and
  the selected one's `规划 → 执行 → 评审` beside it: one lead per stage, a compact helper row,
  and the requirements one helper carries in this workflow. New and Duplicate name the
  workflow in the list itself — no buttons, a valid name saves on blur, an empty one takes a
  just-added workflow away. A built-in offers only Duplicate.
- **Configuration → 工作流 Agent / Workflow agents** is where those agents are defined —
  per stage, built-in and this project's in one column, with each one's instructions, its
  runtime and the real path of its `AGENT.md` to copy. Creating one assigns it to nothing.
- **Configuration → 看板 Agent / Board agents** holds everything no workflow assigns —
  discussion, auto-decide, auto-start, triage, follow-ups, parked tasks, feedback and memory
  pruning. Each agent's switch is on its row in the list, and only there.
- A card's meta strip opens with its workflow: the list shows every workflow on the board,
  says up front that switching re-plans the card, and leads to the pane. While a delivery is
  in flight it shows the workflow that delivery froze, with a lock and no list.
- **Create task** picks the workflow above the box, defaulting to the board's own, so a card
  can be written without touching it.

## Notifications

- A bell in the top row carries every board Cloud is on for, with **To do** and **Landed**
  tabs: the bell's number and the app icon's badge count **To do** alone, a new landed record
  dots its own tab, and **Mark all read** works on the tab you are on.
- A board that couldn't reach Cloud catches up on its own, and what it finally gives up on is
  said in the bell rather than disappearing.
- Slack connects once in **Configuration → Notifications** and belongs to the account:
  consent, workspace, channel or DM, and a Disconnect that stops every board's messages.
  **Open card in app** opens that board's card. Lark sits beside it, reading **Coming soon.**
- The right side holds one rail at a time, so the bell and chat fold each other.

## Triage

- The page, the rail row and the add box all read **Triage / 待筛选**, and missing settings
  are named as `Triage endpoint` and `TRIAGE_ENDPOINT_TOKEN`: `web/content/docs/triage.mdx`.
