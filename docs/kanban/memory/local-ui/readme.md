# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note. Everything below is covered by `kanban-ui/README.md`,
except where another doc is named.

## Running the board

- Open the board as a desktop app, downloaded from `ai4kanban.dev/download` — nothing to
  install first, it picks the repo on first launch and reopens there, finds your coding
  agent, and says when a newer version is out. macOS, Windows and Linux all ship unsigned
  and the download page says how to get past each system's warning.
- Open any project from the app: **Open Folder** picks a folder, the projects opened before
  are a click away, and a folder with no board starts onboarding there. One project is open
  at a time, a run keeps going in the project it started in, and the list marks the projects
  that have one running. The **×** takes a project off the list without touching its folder.
- Go back and forward between the views you opened in the app: `desktop/README.md`.
- Run the board from a browser with `npx ai4kanban-ui`: `akb guide local-ui`. Deprecated
  the day the app shipped — it keeps working, and npm says so and points at the download.
- Started where there is no board, the page says so, names the folder it searched, and
  gives what to run — instead of a crash screen.
- Set a board up in the app itself: a board whose setup is unfinished opens on a short
  guided run that asks for the project and its tracks, the goal, and which agent does the
  work — one to a screen, everything prefilled, and the agent step ending on a test that
  passed. Leaving it for the board keeps a way back in: "The first run".
- Finish the rest of setup without opening a coding agent: **Finish setup**, on the guided
  run's closing screen and on the board's setup strip, runs every step still left as one
  ordinary run — watchable, stoppable, and picking up from the first unfinished step when
  started again after a failure. A board with no goal written asks for the goal instead.
- Learn that a setup run died without going looking for it: when the newest one stopped
  short, the setup strip and the guided run's closing screen both say so where the live run
  said it was working, with a link into its log for why, and **Finish setup** still beside
  it as the retry. A run you stopped yourself reads as the plain offer: "The first run".
- A bar shows how far setup got and hands over the line to paste into your coding agent; a
  goal judged weak later brings the same bar back with just that item.
- A button on the board and a command in a terminal do the same thing to a card. Every read
  and write a screen makes is the board's own command, so the two can never disagree. The
  app carries what it reads the board with, and where it finds nothing, every screen says
  so in one line naming the command that fixes it.
- An edit saved from the board waits its turn behind whatever else is writing, so it never
  lands on top of the card an agent is writing. A run killed mid-write holds nobody up.

## Reading the board

- Flip the header between the track board and a **Queue** view that splits the same cards
  into ready to build and not ready.
- See which cards are waiting on another card, and which card is in the way.
- Read the whole project goal from a compass in the header, on the board and on a card page
  alike, and edit it there — the empty box carries the ask and a link to the guide, and
  saving stops the board asking for a goal.
- See the last 30 days of completed, created, and rejected cards as a chart in the Daily
  progress view.
- Find a card by typing part of its title or body into the rail's search box: "Finding a
  card".
- Read what the agent remembers from a **Memory** panel at the foot of the rail: the four
  project-wide files as rows, and under **Modules** one row per module opening into that
  module's own four files. Each file opens whole as a page of its own with Back, Forward,
  reload and the app's swipe all working; the page re-reads itself when a run finishes and
  when you come back to the window; an unwritten file keeps its row and says so; a ⋯ menu
  copies the file's path. Read-only, and no run starts from it: "The board's memory".

## Releases

- Move a card into a release, or back out of it, from the card page — no version id to type.
- Start a release from the header dropdown, on every board including one that never planned
  a version. Two tabs say which kind it is: **From a goal**, where the goal box is the whole
  choice and an agent run plans the release against it, and **No goal**, which applies the
  plain high-priority rule and counts its cards first.
- Fill a release from its goal — the ⋯ menu's **Fill from its goal**. It is an ordinary run:
  in the runs panel, stoppable, its log saying what it moved in, wrote and left out. The
  board says the release is being planned and re-reads itself when it ends. Running it again
  only adds.
- Show one release at a time from the header dropdown — other releases' cards are hidden,
  every blocker stays on screen, and the pick is remembered per project.
- Say what a version is for in the New release dialog, read it under each version in the
  release dropdown, and change it from the ⋯ menu's **What it is for**.
- Close a shipped version or drop one that won't ship from the ⋯ menu, with a confirm that
  lists what changes. Close writes a summary; drop leaves no summary record.

## Deliveries

- Implement starts a **delivery** — the whole job, several sessions long — and the card says
  which one, by id, until it ends: "Delivery" in `kanban-ui/README.md`.
- A delivery builds the card as it was approved when the click landed. Edit the card in your
  own editor afterwards and the delivery carries on with the copy it took.
- A card with a delivery in flight can't be edited, refined, resolved, archived or rejected
  — on the card page and in a terminal alike, each saying which delivery has it. Priority,
  ROI, release, modules and the card's own todos stay yours.
- The delivery block shows one control while a run is live — **Stop run**, which ends that
  run and nothing else — and **Resume** and **Discard** once nothing is running.
- **Discard** asks for a second click and is the one way out of a delivery: the card
  unlocks, Implement comes back, and the worktree and branch it built in are removed. A
  delivery working in your project folder has neither, and leaves your tree alone.
- A session that fails or is cut off does not end the delivery: the card stays held and
  Resume picks the same delivery up, one id across both sessions.
- Every delivery leaves a record in `docs/kanban/deliveries/`, tracked in git and kept after
  the card is archived: what it was approved to build, every session and how it went, and
  how it ended.
- A cancelled delivery reads "cancelled" beside the card's title and in the sessions panel,
  rather than the "stopped" that would describe only its last session.
- A delivery reviews what it built before it finishes: a fresh session reads the approved
  card and the diff — never the session that wrote the code — and either passes it, sends
  clear mistakes back for up to two corrections, or stops and asks you. "Review" in
  `kanban-ui/README.md` says what it checks and what it cannot.
- A stopped delivery reads "waiting on you" and leaves one open question on the card.
  **Resolve** comes back on while every other held control stays off, and **Review again**
  beside it judges the same work once you have answered. Discard is the other way out —
  changed requirements are a new delivery.
- **Continue delivery** appears when a delivery's next session never started because the
  process watching the one before it died, and starts it.
- The card's `## Worth noting after implementation` is where review puts what it found that
  needs no decision — a surprise for the next card, a check that was already failing, a
  split worth making. It blocks nothing, and it is never part of what a delivery is
  approved to build.

## Runs

- Stop a running run from the ✕ in the log window's title bar, with one confirmation.
- Continue a failed run with Resume, on Claude Code and Codex alike, instead of copying an
  id into a terminal.
- Learn on the card that its last run died: a card whose newest run stopped short — it failed,
  or the UI died under it — opens with that run's log already open and a line above it saying
  the card may be part-built and whatever the run wrote is sitting in your working tree. Resume
  sits in the log's title bar, and the page follows the run it starts: the same slot tails it
  live and the card re-reads itself when it ends. A run you stopped and a run that passed read
  exactly as they always did: "On the card it was working on" in `kanban-ui/README.md`.
- See what a run cost in dollars beside its duration, marked an estimate, and which model
  did the work, taken from what the agent reported.
- A run started in a terminal and one started from a button are the same run: both sides
  read one list, either side can watch, stop or continue it, and a card being worked on from
  either side shows busy on both: `cli/README.md`.

## Refining

- A run that writes or changes a card is followed by a refine of that card, as its own run
  in the panel. A rough card automatically saves a one-shot refine when it first becomes
  blocked; finishing or rejecting its last blocker makes that schedule eligible. Cancelling
  lasts for that blocked episode. A group's main card is left alone when a subtask finishes:
  "The refine that follows a run".
- Refine the card you are looking at from a **Refine** button on its page, whenever you want.

## Recurring tasks

- Run a recurring card from its page — **Run** stands in for Implement, does one pass of the
  card's Process, records the run, and leaves the card on the board; Archive and Refine
  never show.
- Give the card a cadence — a number, a unit, and a time of day for whole days — and the
  board runs the job itself when it comes due, showing the next run beside the last one.

## Cards

- A rough card automatically schedules a refine when it becomes blocked; schedule an
  implement to replace it. The board runs the saved action once the last card in its way
  leaves, the card reads **pending** until then, and **cancel** takes the schedule off for
  that blocked episode: "Schedule it instead".
- Answer a question with choices by ticking a list, with the recommended ones already ticked.
- Archive a group root once all its subtasks are done or rejected.
- Read a card's mockups on its page: a card that changes a screen can carry small files that
  draw the layouts it could take, and each one is drawn where its tag sits. A `.tsx` component
  styled with Tailwind and a plain `.html` page get the same frame: one desktop screen scaled
  to fit, its label and file name over it, a switch to the code behind it, and the file name
  opening that mockup on its own at full size. Nothing in one runs, loads anything or answers
  a click, and a tag the board cannot draw reads as one plain note naming the file — which is
  what a card pulled from git shows, since the mockups folder is not in it: "Mockups on a
  card".
- Read a `.txt` mockup as the drawing it is: it is shown where its tag sits in a monospaced
  block, exactly as the file holds it — nothing scaled and no switch to code, because the file
  is the drawing. The file name opens it on its own page at reading size, and a window too
  narrow for it scrolls sideways rather than breaking its columns: "Mockups on a card".

- See what a finished build left you to check by hand: the lines sit under **check by hand**
  on the card page, in their own blue panel below the open questions, and a clipboard mark on
  the board card says how many there are. They are plain text with nothing to tick or answer
  — the accent stays reserved for a question that is really waiting on you: "What the build
  leaves you to check" in `docs/guides/daily-loop.md`.

## Configuration

- Pick the agent that runs the work, Claude Code or Codex CLI, and the dialog draws the
  settings that agent says it takes.
- Run the board on **DeepSeek Harness**: pick it in the same list, fill in a model and a
  DeepSeek key or leave both empty, and every button spawns dsh through `dsh-acp`. Its log
  streams text, thinking and tool calls as they arrive, **Test**, **Stop** and **Resume**
  all work, and a resumed run carries on in the same dsh session with its history:
  "Running on DeepSeek Harness" in `kanban-ui/README.md`.
- Run the board on **ZCode**, Z.ai's agent for its GLM models: pick it in the same list,
  paste a Z.AI or BigModel Coding Plan key — the key box is the only way in, and a run
  without it stops with the board's line saying so — and every button spawns
  `zcode app-server`. Its log streams text, thinking and tool calls as they arrive, and a
  resumed run carries on in the same ZCode session: `docs/guides/connectors.md`.
- Install dsh in two commands, never one — `npm install -g @deepseek-ai/dsh` and then
  `npm install -g @openma/deepseek-harness-acp`. Named together, npm gives each its own
  folder and the bridge comes out with no dsh under it. A run then points the bridge at the
  dsh its own install put beside it, so a dsh already on the PATH no longer breaks it, and
  someone who installed both at once is told to put the bridge in again on its own:
  "Running on DeepSeek Harness" in `kanban-ui/README.md`.
- See which agents this machine can actually run: the picker dims the ones whose CLI isn't
  on the board's PATH and marks them **not installed**, still lets you pick one, and names
  the command that installs it. It looks again every time the picker opens: "Configuration".
- Pick how hard the model thinks — low to max — or leave it on the agent's default.
- Pick who pays for a run — the Claude subscription, the Anthropic API, or any
  Anthropic-compatible gateway — and the run goes through that pick alone, not through
  something your shell exported.
- Keep your API key in `docs/kanban/.env`, typed into the dialog or written by hand, and the
  board keeps the file out of git.
- Press **Test** to send one tiny message through the setup you saved, with the agent's own
  reason when it doesn't work.
- The board reads its rules from the `akb` on your PATH when the app didn't bring its own,
  so a project needs no copy of them; with no command installed every screen says
  `npm install -g ai4kanban` instead of coming up empty.
- Add the coding agent skill from **Configuration → Skill** whenever you want it — a new
  board arrives without one. The pane says whether it is there and how current it is, one
  button writes it or updates an older copy, and it hands over the line for a newer `akb`
  when yours is behind rather than running it: "The coding agent skill".
- Get `akb` from the app itself: the first launch that finds none on the PATH writes one
  symlink into a bin folder of your own with no dialog, and asks for the administrator
  password only when `/usr/local/bin` is the only place left. A launch that finds its own
  link dead repairs it the same silent way, and **Configuration → Skill** says what holds
  the path — installed, dead, or an `akb` the app didn't put there: `desktop/README.md`.
- Run the board on Cursor or OpenCode as well as Claude Code and Codex — pick one in
  **Configuration → Agent** and every button spawns it, with its own settings, live log,
  stop and resume. Where a CLI reports no cost or no model name the log leaves that blank
  rather than guessing: "Running on Cursor", "Running on OpenCode" in the UI docs.
- See the spec agents and switch one off: the Configuration dialog's sections read
  **Harness** (the coding tool the work runs on, renamed from Agent, in the setup wizard
  too), **Agents** and **Skill**. **Agents** lists every spec agent the board ships with two
  lines each — what it fills in, and the kind of card it is called for — taken from the
  command, and one switch each. Switch one off and the board starts no new run of it
  anywhere, from a button or a terminal: it leaves the list a planning flow picks from, an
  ask for it by name is turned away, and the flow plans that part itself. The switch is
  saved with the board, a run already going finishes, and what an agent already wrote on a
  card stays: "The spec agents".
- Set what a spec agent produces, not just whether it runs: an agent that carries settings
  shows them on its own row in **Configuration → Agents**, one line each saying what it is
  set to and what that choice costs, with **Change** opening the choices in place. A pick
  saves itself, a failed save puts it back and says why, and the answer is board-wide — every
  card that agent runs on gets it, including a run started from a terminal. A paused agent
  keeps its settings on screen and still changeable; an agent with no settings is unchanged:
  "The spec agents".
- Talk to the board without leaving it: **Chat** in the header opens a conversation down the
  right of the window, folded away until you ask for it. It follows what you are reading —
  the board's chat on the board and on a memory file, a card's on its page — and answers from
  this project's goal, cards and memory. The reply appears as it is written, a card it names
  is a link, and folding the rail never stops one arriving. The exchange keeps across restarts,
  is per project, and is the same conversation `akb chat` holds in a terminal: "Chat" in the
  UI docs.
- The chat in the window changes the board, and the window keeps up with it. A change it
  makes — a card written, reworded, moved into a release, archived, dropped — shows on the
  board and on a card's page while the reply is still arriving, with no reload; archive or
  drop the card whose page is open and the app goes back to the board. Asking for work sends
  a run to the runs panel like any other, with its log, its stop and its resume. A card a run
  is already working on is refused, and the refusal names the card and what that run is
  doing: "Chat" in the UI docs.
- A card's page opens its own chat on that card. Before anything is said the rail says its
  answers come from this card and the rest of the board, and offers three things to ask —
  what is unclear about it, whether it is too big to build in one go, what could be cut —
  with the message box asking about that card by number. Walk to another card and nothing of
  the last one is left: not its messages, not a message half typed, not the error its last
  send left: "Chat" in the UI docs.

- The header's chart button is now **Insights** and opens two charts, a tab each. Daily
  progress is unchanged and opens first; **Planning quality** draws how well the board planned
  each release — Details settled, Decisions that stood and Proposals built, one point per
  release in close order with the still-open release at the right end. Each series has its own
  line style and marker, a series with too little evidence leaves a gap rather than a zero, and
  the readout under the chart gives the chosen release's three percentages, the counts behind
  them and every contributing card id. Click, hover, or Tab to the chart and use the arrow
  keys: "Insights" in the UI docs.

- The Planning quality score the app draws belongs to the board you have open. It is worked
  out on each read from `docs/kanban/record.csv` in that same repository, which the board's
  own commands fill in as they run, so a board that has just started shows counts and `not
  enough yet` rather than a zero. No percentage is stored and no figure is fetched from
  anywhere outside the repository: "Insights" in the UI docs.

- A card's page opens on the half a person has to read. Everything above the card format's
  `<!-- agent -->` boundary sits at the top as it always did; everything below it folds
  behind one control reading **what the agent worked out**, with the number of sections
  inside it. One click opens it in place, in a quieter ink. Every card page opens shut again
  on every visit — nothing about the fold is stored. A card written before the boundary
  existed shows its whole body as before. A rail search whose word is only below the boundary
  opens that half for that visit, and so does the window's own Find where the browser
  supports it: "Reading a card" and "Finding a card" in the UI docs.

- Closing a release from the **⋯** beside the release dropdown now writes its changelog too.
  The confirm dialog says which is coming before anything is written — a changelog, or none
  because nothing shipped — and confirming starts the agent as a background run you can watch
  in the runs panel. The board goes on working while it writes; if the run cannot start or
  ends badly, a note across the top says so and names `akb changelog <version>` as the way to
  get the changelog after all. Reading the changelog itself is still a matter of opening the
  summary file: "Closing one" in the UI docs.

- Each delivery now builds in a git worktree and branch of its own — `.akb/worktrees/<card>/<delivery>`
  on `card/<card>/<delivery>` — so several cards can be built at once without touching each other or
  your open edits, and the board's own files stay out of them. A delivery refuses to start on
  uncommitted work or a detached HEAD; **Discard** on the card page is the only thing that removes
  a worktree, and it says what will be lost first. Turn **Allow automatic Git commits** off
  in Configuration → Auto-delivery and a delivery works in your project folder instead, one at a
  time, and you commit it after review passes: "Where a delivery's code goes" and "Auto-delivery" in
  the UI docs.

- Once review passes, the board now **lands** the delivery itself: one squash commit named after
  the card, on the branch you were on when you pressed Implement. One card lands at a time; your
  own uncommitted or staged work holds a landing back until the checkout is clean, and it lands
  by itself once it is. When that branch is the one you have out, your working tree follows it as
  a `git pull` would; otherwise only the branch moves. A target branch that moved is rebased onto
  and reviewed again, a conflict is resolved as new work by an agent and reviewed from scratch,
  and the worktree and branch are removed once it has landed. Nothing is pushed anywhere:
  "Landing on your branch" in the UI docs.

- One Implement click now carries a card all the way: it builds, reviews, corrects, lands the
  work as one commit on your branch, and then the board archives the card itself — nothing asks
  you again in between, and no review archives a card any more. The Implement dialog says the
  steps in order and names the branch the change will land on, or says instead that the delivery
  stops after review when manual commit mode is on, where the card is archived on your own commit:
  "Delivery" and "Landing on your branch" in the UI docs.

- Building a card that still has **open questions** is allowed, with a third warning box and its
  own tick, beside **Resolve & implement** as the other way out. The card is built and reviewed and
  then holds outside the landing queue — taking no landing slot, so every other card still lands —
  until the questions are answered; answering carries the same delivery on with no second click,
  and an answer that changed what the card asks for starts a fresh delivery instead. `akb implement
  <id>` warns the same way a blocker does: "Building a card with open questions" in the UI docs.

- The card page now says where a delivery has got to, not just where its code is: a pill beside
  the title — **Delivery in progress**, **Held at landing**, **Waiting for your commit**, **Code
  changed after review**, **Can't land yet**, **Landed as `abc123`** — and under it what the delivery
  waits on and what answers it. A pause is drawn as a **waiting on you** note in the pill's own
  colour, not a grey line: it is the one thing on the page the reader has to act on. The names in it
  — a file, a branch, a commit, the control to press — are marked, and the sentence is kept to one
  or two. **Can't land yet** carries landing's own refusal: a dirty checkout, a target branch that is
  gone, a worktree with work left in it. A pause has nothing to press, and the block under the buttons is
  now the delivery's own: a Diff / Log / Approval tab strip with the log in it, and a foot naming
  the delivery, how it commits and where its code is. **Resolve** stays live whenever a delivery is
  waiting on you: "What the card page says while a delivery runs" in the UI docs.

- The Configuration dialog has a **Rules** section: one rule, in your own words, added to the end
  of any flow's instructions — a column naming every flow the board can start, with a dot on the
  ones in use, beside one tall box for whichever you click. `implement` and `review` say under the
  box what their rule is for and what it can cost. Saving is per flow, on blur; clearing a box
  removes the rule. The rules are files in your board, shared through git with everyone on it:
  "Flow rules" in the UI docs.

- The card page's **Diff** tab now says what a delivery changed. While the card is being built it
  is the delivery's own branch against the commit it forked from, read in its worktree; once the
  work has landed it is the squash commit against the branch tip it landed onto — which is also
  the one commit to revert if the card has to go. Manual commit mode shows a snapshot of your
  working tree marked **uncommitted**, with the files git has never seen counted in. The size line
  leads, a long diff is cut off naming the `git diff` that prints all of it, and a case it cannot
  read — no git, a worktree someone removed, a commit that is gone — is one plain line rather than
  an error. The tab appears only when there is a diff: "The Diff tab" in the UI docs.

- Make a board where nothing lands unread: **Require diff approval before landing**, in
  Configuration → Auto-delivery beside **Allow automatic Git commits** and off by default. On,
  every delivery is built and reviewed as usual and then waits for you — the card reads **Waiting
  for your approval**, the delivery block opens on **Diff** so the tree is the first thing read,
  and **Approve this tree** is on the **Approval** tab beside it. It holds outside the landing
  queue while it waits, taking no slot, so every other card still lands past it. An approval covers
  one base commit and one tree, and either moving — a correction, a rebase onto a branch that
  moved, anything else — cancels it and the delivery asks again; the board re-reads both
  immediately before it moves your branch. The setting is frozen when a delivery starts, and has
  nothing to hold with automatic Git commits off, where your own commit is already the approval:
  "Approving a delivery" and "Auto-delivery" in the UI docs.
- Sitting on a card the board archived under you no longer lands you on the "not on the board"
  countdown: the page's own re-read after a run finishes checks the card is still there and goes
  straight to the board when it isn't. A stale link somebody pastes still gets the page and its
  countdown, which is what it is for.
- The Configuration dialog has a **Cloud** section, last and behind a rule: everything above it
  settles this board, and Cloud is the person this machine signs in as. It says what Cloud
  relays and what it never receives, links the published privacy and terms pages, and shows one
  state per answer a sign-in can come back with — not signed in, signed in and admitted, signed
  in and not admitted, and expired. A board with nobody signed in looks exactly as it did.
