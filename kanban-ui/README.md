# ai4kanban-ui

> **Deprecated — get the desktop app instead: <https://ai4kanban.dev/download>**
>
> The app is the same board in a window, with nothing to install first: no Node, no npx, no
> terminal to keep alive. This package keeps working, but it is frozen at its last version.

The local board UI for [ai4kanban](https://ai4kanban.dev/). It shows every open card, and each
button spawns an agent in your repo that does the kanban work — create, refine, implement,
archive. The markdown files in `docs/kanban/` stay the single source of truth; the UI only reads
and writes them.

```
npx ai4kanban-ui        # deprecated — http://localhost:7420, localhost only
```

The desktop app draws these same pages, so everything below describes both. For installing this
package, pointing it at another board, the port or updating, run `akb guide local-ui`. This file
is about **using** the board.

## In the app

- **First launch**: pick a project folder. With no `docs/kanban/` there, the app offers to make
  one and opens the guided first run.
- **Create new project** (beside **Open folder**): name it and pick a parent folder; the app makes
  the folder, runs `git init`, and opens it. A name that is not one folder name, or a folder that
  already exists, is refused before anything is written.
- **Projects**: the folder path in the header lists every folder you opened, plus **Open
  folder…**. **File → Open Project…** and **File → Open Recent** do the same.
- **One project at a time**: switching replaces the whole page, and nothing unsaved survives it.
  A run keeps going in the project it started in, and a pulsing dot on that project's line says
  so.
- **×** takes a project off the list without touching its folder. A moved or deleted folder reads
  **folder is gone**.
- **Several boards**: the chip beside the path names the board (**Engineering**, **Marketing**).
  With two boards in the project it becomes a picker. A board is any folder up to two levels down
  with `todo/` and `config.md` in it — `akb install --board marketing/kanban` makes one.
- **Updates**: download silently. A **Restart** button appears in the top row once one is ready;
  a failed install shows **Update failed**, with the reason on hover. Versions cannot be skipped.
- **Closing the window** ends every board server and run across the open projects.

## The board

The home page answers one question — what can I start now? — in two columns:

- **Ready to build**: cards marked ready, then those being implemented ("5 ready · 1
  implementing").
- **Not ready**: everything still to be worked out.
- **Recurring** (narrow, only when the board has any): jobs that repeat and are never finished.

Inside a column, cards are banded by module, and the best card to start comes first: a blocked
card sinks, a blocker rises. A blocked card carries a **lock** marker — hover it for the cards in
the way. Nothing is hidden or gated by it. Columns are a fixed width and the row scrolls sideways.

Click a card to open it: the body, its meta (modules, release, priority, ROI, blockers), open
questions and buttons.

The header carries:

- **The goal** (compass) — see [The goal](#the-goal).
- **The release dropdown** — see [Releases](#releases).
- **New idea** (bulb) — a full-screen sheet: share an idea, ask how things are going, or ask it
  to move or start a card. Sending always starts a [discussion](#new-idea). An unsent draft is kept; Esc or ✕ returns to the board. To
  write a card straight from a sentence, use `akb create`.
- **Runs** — every agent session, live or finished, drawn as an office: one robot per job, at a
  desk while it works. Click a robot to read its log; **Completed** and **Unfinished** open the
  records. A finished run can be continued with a follow-up prompt, which starts a new run. A
  small window gets the same runs as a plain list.
- **Insights** (chart) — **Daily progress**: completed, created and rejected cards over the last
  30 days, from `docs/kanban/metrics.csv`. Read-only.
- **Configuration** (gear) — see [Configuration](#configuration).
- **Discuss** — on a card's pages only; see [Discuss a card](#discuss-a-card).

### New idea

**New idea** turns a vague idea into a conversation instead of a run, and answers for the board.
It never shows in **Runs**.

- **The Discussion helper questions the idea** rather than taking it as a spec. Ending in defer,
  drop or investigate is a fine outcome.
- **The plan**: once an outcome is agreed, the agent writes it to
  `docs/kanban/plans/<id>-<slug>.md` (the problem and the agreed behavior, 30–50 lines), shown in
  a resizable panel on the right and rewritten as the discussion moves.
- **Plan tasks** starts the run that writes the cards, in the release on screen, each citing
  the plan in `## Source`.
- **Start now** asks first, then one run writes a single card from the plan and builds it — no
  refine, no review.
- **Not yet** leaves it. You can also type any of the three.
- **Board requests**: it answers how things are going from the board as it is. Asked plainly, it
  moves, rewords, archives, rejects or starts an existing card — a build as a run in **Runs** —
  and says so when the board refuses.
- **Workflow picker**: on a board with several workflows, it picks which one the new cards use.
- **Nothing is lost** on closing: reopening it from the rail returns to the same conversation and plan. A
  run that writes no card brings the offer back.

Plans are board content and travel with the board.

### Sharing a conversation with the team

**Share with the team when it ends**, under the New idea box and under a card's discussion, sends the
whole conversation and the code behind it to the AI4Kanban team when the conversation ends.

- **What ends it**: **Plan tasks**, **Start now**, or **End discussion** on the rail's **⋯**.
  Closing the screen, Esc, or cancelling Start now does not.
- **Off by default** on every conversation. The first time you turn it on, it shows what is
  shared. Nothing is collected until the end, so turning it off or clearing the conversation
  leaves nothing behind.
- **A discussion needs a card**: turning the switch on opens **Link a previous task**. Until you
  pick one or turn sharing off, the plan's buttons and **End discussion** are refused. A card's
  chat is already about its card.

### Reading a card

A card has two halves. The top is for you: what the task does and what is worth accepting or
refusing. Below it, folded under **what the agent worked out**, is the builder's half: scope,
todos and the calls the agent made. It opens shut on every visit; one click opens it in place.
Older cards without the boundary show their whole body.

**Check by hand**: things only you can confirm after a build appear in a panel above the body, and
the board card counts them. Cross one off with **✕** (it asks twice; there is no undo). You cannot
add one here, crossing off is disabled while an agent works the card, and open checks do not
block archiving.

### Finding a card

Down the left is the **rail**: **All cards** (the board), then **Discussions** — every discussion
and every card chat. **⋯** on a row ends it. Drag the rail's edge to resize it; it is hidden on a
narrow window.

**Find a card** searches every open card's title and body, subtasks included, case-insensitively.
It never reaches the archive. Escape or **×** clears it. A match found only in the folded half
opens that half for that visit. In a browser, ⌘F also finds text in a folded half; the desktop app
has no Find, so use the box.

**Memory** and **Archive** sit at the foot of the rail.

### Discuss a card

**Discuss** in the header of a card's page opens a rail on the right, about that card. It
remembers whether it was open, and keeps one conversation per card; walking to another card leaves
nothing of the last one behind. It answers from the goal, module map, open cards, memory and
settings, and a card it names is a link.

- **It changes the board**: once a change is settled it writes, rewords, answers, moves, archives
  or drops cards straight away, then says what it did. A card a run holds is refused, naming the
  run.
- **Work goes to a run**: building, sharpening a card or filling a release starts a run in
  **Runs**. It never writes your project's code itself.
- **It is not a run**: it locks no card, so you can talk about a card an agent is building.
- **Typing while it replies**: the box stays live; only sending waits. Nothing is queued or sent
  for you.
- **History**: Up-arrow in an empty box walks back through this conversation's messages,
  including ones sent from a terminal.
- **Pictures**: paste or drag images into the box, several per message, each removable before
  sending. They are stored beside the conversation, outside git, and deleted when it is cleared.
  An agent that can't see pictures refuses the paste and names ones that can; a non-image file is
  named and skipped.
- **Stop**: while a reply comes, Send becomes **Stop** (or Esc). What arrived is kept. A reply
  that `akb chat` is writing can only be stopped with Ctrl-C in that terminal.
- **Worked for 1m 5s**: the fold above a reply lists what the agent did — notes, and each file,
  card or search it touched. It counts up while the reply is coming.
- **Cost**: each reply shows its tokens and estimated price, e.g. `1,840 tokens · est. $0.03`,
  worked out at list prices. Agents that report neither show nothing.
- **Reading**: **↓ 2 new lines** jumps to the newest; **Copy** under a reply (and on each code
  block) copies the answer without its steps; the header's copy button takes the whole
  conversation as markdown.
- **Retrying**: **Send again** appears on a reply that stopped short or came back empty.
  **Reword** on any of your messages puts it back in the box, asking first if the box has text.
- **It keeps**: folding the rail doesn't stop a reply, and the exchange survives restarts. The bin
  in the chat header clears it, after asking.
- **Runtime for this conversation**: the control beside Send picks one of the board's runtimes
  (set up in **Configuration → Runtimes**) for this conversation alone; **↩** returns to the
  board's. Same CLI: the conversation continues, and the transcript marks the model change.
  Another CLI: the conversation starts over, after asking. `akb chat --runtime <id>` does the
  same from a terminal.
- **Same as `akb chat`**: the rail and the terminal share one transcript.

On a narrow window the chat covers the board. With no coding agent set up, it points at
Configuration.

### The goal

`memory/goal.md` is where the project is headed, in your words; every proposal is judged against
it. The compass opens it in full, and **Edit** saves your words back.

Saving marks it `reviewed: pending`. The agent grades it `strong`, `good` or `weak` at setup and
on every proposal; only `weak` or an empty file makes the board ask for a goal. The compass shows
only when the file has content.

### The board's memory

**Memory**, at the foot of the rail, is what the agent remembers about this project — read-only,
so reading it starts no run. Rows are grouped by owner:

- **Board**: **What shipped** (`docs/kanban/memory/readme.md`) and **The goal**
  (`docs/kanban/memory/goal.md`).
- **Each agent that keeps memory**: e.g. the Planner's **Settled decisions**, **Rejected ideas**
  and **Design mistakes** in `docs/kanban/memory/agents/planner/`. A module is a `## <module>`
  topic inside those files.

Clicking a row opens the file rendered, with its owner and path. The page re-reads itself when a
run finishes. To fix a line, **⋯ → Copy relative path** and give it to your coding agent; the
board never opens the file for you.

### The archive

**Archive**, at the foot of the rail, lists every finished card in `docs/kanban/.archive/`,
newest first: number, title, release and archive date. Dates start from when the board began
recording them; older rows are marked. Click a row to read the card. It is read-only: nothing
un-archives.

### Assets on a card

A card can carry images and mockups under its board's `assets/<card id>/` folder, which is
gitignored. The body points at each one on a line of its own:

```
<Asset src=".assets/803/hero.png" label="Hero image" />
```

Older cards use `<Mockup src=".mockups/…">`, which still works.

- **Images** (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.svg`) fill the body's width. Click one
  for full size. SVGs are shown as images, so nothing in them runs.
- **Video and audio** (`.mp4`, `.webm`, `.mov`, `.mp3`, `.wav`, `.m4a`) play on the card in the
  browser's own player. Files the browser cannot decode (e.g. HEVC) show a note instead; use
  MP4 (H.264), WebM or MP3.
- **Shot previews** (`.hf.html`) are self-contained HyperFrames compositions: play, pause, replay,
  seek and mute drive the shot's motion and audio together; controls show on hover or tap, and
  starting one shot pauses the others. They run isolated, with no network access.
- **Mockups** are drawn by the `ui-designer` agent as rendered screens, one file per screen or
  state the card changes: a `.tsx` React component styled with Tailwind, or a self-styled `.html`
  page. Each shows at 1280×800, scaled to fit, with a switch to its code; click its file name for
  full size.
- **A `.tsx` mockup is a copy of the real screen**: `ui-designer` copies the components it is
  built from, strips data, network and click handling, and changes only what the card changes. It
  may import React, `react-icons`, `next/link`, `next/image`, `next/navigation` and class-name
  helpers.
- **Mockups are sandboxed**: nothing runs, loads from the network or answers a click. A missing or
  unsupported file reads as a plain note.

A card pulled from another board shows its asset tags as notes until `ui-designer` draws them
again.

## Releases

A release is a version in `docs/kanban/releases.md`. The header dropdown picks which one the board
shows; its **⋯** menu describes, fills, closes or drops it.

- **Putting a card in one**: the card's **Release** box. The dash means no release. A group root
  moves its whole group; a subtask can move alone. A card naming a version no longer listed reads
  **not on the list**.
- **One release at a time**: picking one hides every other release's cards, except blockers,
  which always stay visible. **No release** is where the board opens. Each entry counts its open
  cards and shows its goal. Your pick is remembered in the browser, never in the files.
- **New release** (last entry): a version id, then either **From a goal** (a sentence or two the
  release is planned against), or **No goal**, with an optional switch that moves in every
  unplanned high-priority card that is unblocked and not a group root. The board switches to the
  new release.
- **Fill from its goal**: moves in the open cards that ship the goal and writes the ones it lacks,
  each refined afterwards. It is a run: stoppable, logged, and **it is being planned** shows
  across the board. It only adds, so running it again is safe. Terminal: "plan release v1".
- **What it is for**: edits the goal. Empty removes it. Terminal: `akb release new v1 --goal ".."`,
  `akb release goal v1 ".."`.
- **Close release**: lists the open cards that come out, and names any card whose todos are all
  ticked but which was never archived — archive it first, since a closed release cannot reopen.
  Confirming runs `akb release close v1`: a dated **Closed** section in
  `docs/kanban/.release-summaries/`, the open cards leave the version, and its line comes off the
  list. An agent then writes a short changelog into that section. If it fails, run
  `akb release changelog v1`.
- **Drop release**: for a version that won't ship. Runs `akb release drop v1`: no summary, open
  cards return to no release, archived cards stay archived.
- **Rename or reorder**: edit `releases.md` by hand.

## The first run

A board with unfinished setup opens on a guided run, one step per screen:

1. **The agent** — which coding agent the board runs. The board tries each installed agent that
   needs nothing more, in order, with the same call as **Test**; the first that answers is saved.
   If none answers, you get the Configuration picker with the last error, and **Test and
   continue** moves on only when a call succeeds. **Set it up myself** skips the probing.
2. **The project** — the agent reads your repo and proposes one sentence saying what the project
   is. **Yes, that's it** writes it; a correction sends it back to read again. Nothing is written
   before Yes.
3. **The goal** — an empty box for `memory/goal.md`, in your own words; the agent never drafts it.
   **I'll write it later** skips it.

These steps are a conversation, not a run: nothing in **Runs**, no log. A failed turn shows the
agent's words and **Nothing was written**; **Try again** restarts it. **I'll fill it in myself**,
on every screen, switches to plain boxes for the project and goal.

The closing screen offers **Finish setup**: one run that works through every unticked step in
`setup-checklist.md`. It shows in **Runs**, can be stopped, and restarts from the first unfinished
step. If the goal is empty it asks for it first. A failed run shows **The last setup run stopped
short** with a link to its log; press **Finish setup** again to retry.

To finish from your coding agent instead, paste the line shown under **Rather set this up from
your coding agent?**:

```
/kanban. Set up this board — follow docs/kanban/setup-checklist.md.
```

It is adjusted to your agent (`$kanban.` on Codex; a plain sentence on the others). It needs the
coding agent skill in the repo; if it is missing, the screen offers
`npx ai4kanban@latest skill install`.

**Go to the board** leaves at any step; a strip with **Continue setup** stays until setup is done.
Until then the skill creates no cards. The last step creates three initial cards, deletes the
checklist, and starts a refine for each.

Later, if the goal is empty or judged weak, a notice with **Write the goal** comes back. ✕ hides
it for the session.

## A card's buttons

Every button opens a small dialog where you can add a note for the agent. The card then shows a
running badge and a read-only live log.

| Button | When it shows |
| --- | --- |
| **Implement** | Until every todo is checked. Never on a group root or a recurring card. |
| **Run** | On a recurring card, in place of Implement. |
| **Refine** | While a refine would still move the card. |
| **Revise** | Always. Opens the card's chat; say what to change. |
| **Resolve** | When the card has open questions, including while a delivery waits on you. |
| **Review again** | While a stopped delivery waits on the question its review left. |
| **Continue delivery** | When a delivery's next session never started. |
| **Archive** | Once every todo is checked (a group root: every subtask resolved). Never on a recurring card. |
| **Reject** | Always. **Just discard** drops the card without writing memory. |

A card has one session at a time. A session outside a delivery never commits: read `git diff` and
commit yourself.

### Delivery

**Implement** starts a **delivery**: build, review, land and archive, in one click. It runs
several sessions under one delivery id, shown on the card and in `akb run list`.

- **What you approve is the card**, not the diff. The dialog lists the steps and the target
  branch, with the **Build this on a branch of its own** tick — see
  [Where a delivery's code goes](#where-a-deliverys-code-goes).
- **It builds the card as approved**: the requirements are copied when it starts, so later edits
  to the card don't change it.
- **The card is held**: Edit, Refine, Resolve, Archive and Reject are off, except **Resolve**
  while the delivery waits on you. Priority, ROI, release, modules and todos stay editable.
- **Controls**: while a run is live, **Stop run** ends that run only. Once nothing runs,
  **Resume** continues the delivery and **Discard** ends it, removing its worktree and branch
  (after naming them).
- **A failed session doesn't end the delivery**: **Resume** picks it up under the same id.
- **Record**: every delivery leaves a JSON file in `docs/kanban/deliveries/` — the approved card,
  each session, review verdicts, landing and outcome. It is tracked in git.
- **Blocked or open questions**: the dialog warns and you can go ahead. A card with open
  questions is built and reviewed, then held at landing until they are answered, without taking
  a landing slot.
- **Terminal**: `akb card implement <id>` starts it; `akb delivery discard <id> --yes` discards;
  `akb delivery cancel <id>` ends it but keeps the worktree and branch for salvage.

#### What the card page says

| Pill | Meaning |
| --- | --- |
| **Delivery in progress** | Building or reviewing. Nothing waits on you. |
| **Held at landing** | Built; waiting for the card's open questions to be answered. |
| **Waiting for your approval** | Built; waiting for you to approve the tree it would land. |
| **Waiting for your commit** | Manual commit mode: the commit is yours to make. |
| **Code changed after review** | You committed something other than what review passed; it is being reviewed again. |
| **Landed as `abc123`** | Its commit is on your branch and the card is being archived. |

Only **Waiting for your approval** has a button (on the **Approval** tab); the others continue by
themselves once you answer, resolve or commit. An answer that changes the approved requirements
starts a fresh delivery.

Below the buttons are **Diff**, **Log** and **Approval** tabs (each only when it has content).
**Diff** is read-only:

- A size line, a collapsible file tree, sticky file headers, and line numbers on both sides.
- While building: the delivery branch against its fork point. After landing: the squash commit —
  the one to revert if the card has to go. Manual mode: your uncommitted working tree, new files
  included.
- A long diff is cut off, with the `git diff` command that prints it all.

#### Approving a delivery

**Approve diffs before landing** (Configuration → General, off by default) makes every delivery
that got its own branch wait after review for **Approve this tree** on the **Approval** tab.

- **An approval covers one tree on one base commit.** A rebase onto a moved branch cancels it and
  asks again; both are rechecked just before landing.
- **Waiting takes no landing slot**, so other cards land past it.
- **The setting is frozen** when a delivery starts; **Discard** is the way out of one waiting.
- **Terminal**: `akb delivery approve <id>`.

### Where a delivery's code goes

**Build this on a branch of its own** on the Implement dialog decides it for one build; it starts
from the **Automatic Git commits** setting and never changes it. **Schedule** and
`akb card implement` use the setting as it stands.

Ticked, the delivery builds in a git worktree, `.akb/worktrees/<card>/<delivery>`, on branch
`card/<card>/<delivery>`, forked from your checkout's current commit. `.akb/` is added to
`.gitignore`.

- **Several deliveries run at once**, each in its own checkout, without touching your open edits.
- **It won't start on uncommitted work**, which it would not copy — commit or stash first.
  Changes to the board's own files don't count.
- **Board files stay out**: `docs/kanban/` and `.akb/` are not in the worktree; card and delivery
  records change in your project folder.
- **Each session's work is committed** to the delivery branch, so review reads a settled tree.
- **A missing worktree or branch** is reported on the card; discard and start again.
- **No git, no commit or a detached HEAD**: no tick is offered, and the build uses manual mode.

#### Landing on your branch

After review passes, the board **lands** the delivery: one squash commit, named after the card, on
the branch you were on when you pressed Implement. Nothing is pushed.

- **One card lands at a time**; the wait shows on the card.
- **Your uncommitted or staged work blocks landing** (board files excepted). The delivery waits
  and lands by itself once you commit or stash.
- **Your checkout follows**: if the target branch is checked out, it is fast-forwarded like
  `git pull`; otherwise only the branch moves.
- **A moved target branch is rebased onto**, retried without limit; the card counts attempts. A
  clean rebase keeps the review verdict.
- **Overlapping cards** are a warning, recorded on the delivery. A real conflict is resolved by an
  agent and gets a focused review.
- **After landing**, the worktree and branch are removed and the card is archived. The record
  keeps the commit, base, checks and any overlap.

#### Manual commit mode

Untick the box, or turn **Automatic Git commits** off (saved in `docs/kanban/ui.config.json`, so
the team shares it), and the delivery works in your project folder:

- **One delivery at a time**, from a clean tree — an untracked file blocks the start, since review
  would read it as the delivery's work.
- **You commit after review passes.** Commit what review passed and the card is archived. Commit
  something else and it is reviewed again (**Code changed after review**).
- **Nothing lands** for you.

### Review

A **fresh session** judges the build against the approved card and the diff. It never sees the
building session. It runs the repository's own tests, linter and type check, fixes plain mistakes
in the same worktree, and gives one of two answers:

- **Pass**: the work goes on to land.
- **Needs you**: a fix is unclear, unsafe or yours to decide. It leaves **one open question** on
  the card and the delivery stops, still holding it. A failed or silent review also stops.

Review doesn't promise defect-free code or judge whether the card was a good idea: a card that
says the wrong thing produces work that passes.

When it stops, the card reads **delivery … waiting on you**. Answer the question — or write the
exception you accept under **Worth noting after implementation** — then press **Review again**.
Changed requirements need a new delivery: **Discard** and implement again.

**Worth noting after implementation** is where review records what needs no decision: a surprise,
a check that was already failing, a split worth making. It blocks nothing.

**Terminal**: `akb delivery review <id>` reviews again, `akb delivery conflict <id>` resolves a
stopped rebase, `akb guide review` prints the flow.

#### Turning AI review off

**Review every build** (Configuration → General → Delivery) is the only switch; there is no
per-build option. **Start now** is never reviewed.

- **Frozen per delivery**: the foot of the delivery block reads **No AI review** on one started
  without it.
- **The build goes straight to landing**; a rebase starts no review either.
- **What still gates it**: the repository's own checks, the open-question hold, and **Approve
  diffs before landing**. For a human in the loop without AI review, turn approval on.
- **Manual commit mode**: your commit ends the delivery, whatever it holds.
- **`akb delivery review <id>`** still runs a review on demand.

### Open questions

Click the **open questions** panel (or **Resolve**) and every question you own becomes an answer
box — or a tick list with the agent's picks pre-ticked, plus **Something else** for your own
words. Leave a question untouched and the agent researches it. **Resolve** sends the answers; the
agent folds them into the plan and settles what it can.

### Schedule it instead

On a blocked card, the Implement dialog lists the blockers and offers **Implement anyway** or
**Schedule**. Schedule runs the action within a minute of the last blocker being archived or
rejected.

- **Blocked rough cards schedule a refine by themselves** when they are created with blockers or
  first become blocked. Scheduling a build replaces it.
- **One scheduled action per card**; a second replaces the first. Your note goes with it.
- **The card reads `pending`**; hover for `implement · waiting on #57`. **Cancel** is on the card
  page.
- **It fires once**; a failed or stopped run does not come back. A pointless one (a refine on a
  card now ready) is dropped.
- **It lives in the card's frontmatter**, so it survives restarts and clones.

### Refine

**Refine** runs one refine on the card now. It shows only while a refine would still move the
card: not once it is **ready**, all todos are checked, every open question is yours (use
**Resolve**), or a refine is already scheduled. On a blocked card the dialog offers **Refine
anyway** or **Schedule**.

The board also refines by itself, as a separate run, after any run that wrote or changed a card —
one refine per card touched. It skips blocked, ready, recurring and fully ticked cards, and cards
whose open questions are all yours. A subtask finishing doesn't refine its group root. Nothing
scans the backlog: a card written by hand in your editor needs **Refine**.

### Recurring tasks

A card in the **recurring** column is a job you repeat and never archive. **Run** does one pass
through its **Process**, records it, and tightens a step or two. A step that needs your judgment
is left undone and written as an open question; the next run folds in your answer. There is no
**Archive** or **Refine**. To make one, describe the job in **New idea** and say it repeats.

**Cadence** (next to **Last run**) runs it automatically — every N minutes, hours or days, with a
time of day for days. **No cadence** means it runs only on **Run**. **Next run** shows when it is
due, in your machine's clock.

- **A new job runs within the minute**; after that it waits out the interval from its last run.
- **Missed runs** while the board was closed run once, not once per window.
- **One recurring job at a time**, in its own slot.
- **A stopped, failed or unrecorded run** takes the card off its cadence; click **Run** to put it
  back.

### Stopping a run

The **✕** in a live log's title bar (on the card page or in **Runs**) asks to confirm, then asks
the agent to end, killing it if it doesn't.

**Stop doesn't undo anything**: whatever the run wrote stays in your working tree — read
`git diff`. The card unlocks immediately. **Stopped** is its own outcome (a blue dot), and **Runs**
still offers **Resume** on it.

### What a run cost, and which model it used

A finished run's log reads like `done · 4m 12s · est. $0.42 · claude-opus-5`.

- **The cost is an estimate** from the run's tokens at list prices, not a bill, and covers that
  run alone.
- **The model is what the agent reported**, not the Configuration box.
- **Either can be missing**: some agents report neither (see the table under
  [Runtimes](#runtimes)).

## Group tasks

A group task is a folder with a `root.md` and subtasks. The root is a tracking card:

- **No Implement**: the group is finished by finishing its subtasks.
- **Archive** appears once every subtask is done or rejected, and closes the whole group. A root
  with no subtasks is closed with **Reject**.
- **Release** moves the whole group.

The root records each outcome: an archived subtask's line is ticked, a rejected one struck
through.

## When a run fails or is interrupted

A run that stopped short — it **exited** with an error, or was **interrupted** because the UI
server died (its duration is marked `~`) — gets a **Resume** button in **Runs** and in the log on
its card. Resume sends one more turn into the same agent conversation, so the agent continues
rather than starting over. It is a normal run and replaces the one it continues, dropping the old
log — read it first.

The card page shows its newest run, so an interrupted card opens with that log and a warning that
its work may be partial and sitting in your working tree.

No button appears when the agent never reported a session id, a different agent is now picked, or
the run aged out of history. An expired conversation fails with the reason in its log.

## Configuration

The gear opens **Configuration**: **Settings** (General, Runtimes, Board, Workspace, Cloud &
Notifications) and, on a board with workflows, **Customize** (Workflows, Agents).

Settings are saved in `docs/kanban/ui.config.json`, shared through git. Exceptions: keys go to
`docs/kanban/.env`, and language and Cloud sign-in are per machine.

### General → Delivery

Repository-level switches; a change applies to deliveries started afterwards. Whether a delivery
starts at all is **Auto-approve builds**, under Agents.

- **Automatic Git commits** (on): builds get their own branch and worktree and land by themselves.
  Off is [manual commit mode](#manual-commit-mode). The Implement dialog can override it per
  build.
- **Approve diffs before landing** (off): see [Approving a delivery](#approving-a-delivery).
- **Review every build** (on): see [Turning AI review off](#turning-ai-review-off).

### General → Setup: the coding agent skill

A board works without it. The skill lets you say *"add a task"* or *"what's next"* to your coding
agent and have it work this board.

- **Status**: **Not installed**, **Installed** (with versions), or **Out of date**, with **Add the
  skill** / **Update the skill**.
- **What it writes**: one `SKILL.md` in `.claude/skills/kanban/` (Claude Code) and
  `.agents/skills/kanban/` (the others) — a short note pointing at `akb`. The flows ship inside the
  `akb` command, so an old `akb` means old flows.
- **The `akb` row**: shows the command on your PATH. In the desktop app, **Install** links it to
  the app's own copy — `/usr/local/bin/akb` on macOS (asks for your password), the app folder on
  PATH on Windows — so updating the app updates the command. It leaves an `akb` it didn't install
  alone. The app offers this once, on first launch without `akb`. In a browser, and on Linux, you
  get a line to copy.

### General → Language

**English** or **中文**, for every project on this machine, applied at once. Stored in
`~/.ai4kanban/settings.json`, outside every repository. There is no `akb` command for it.

The app guesses once from your system languages (any Chinese → 中文, otherwise English) and
writes the answer down. The launcher has its own switcher in the top-right. Terminal output stays
English. A project whose board rules predate the setting stays English until
`npm install -g ai4kanban`.

### Runtimes

A **runtime** is one row: the coding tool, provider, endpoint, key, model, reasoning level and
extra arguments. The first row, **Global default**, is what an agent naming no runtime runs; it
can't be renamed or deleted. Rows are listed by whether the tool is installed on this machine;
open one to edit it, **Make board default**, or **Test** it. Add, rename and delete rows with
`akb agent runtime`.

| Tool | Spawns | Settings | Key | Cost | Model |
| --- | --- | --- | --- | --- | --- |
| **Claude Code** (default) | `claude` | Provider, Endpoint base URL, Model, Reasoning effort | `ANTHROPIC_API_KEY` (optional) | yes | yes |
| **Codex** | `codex exec --json --dangerously-bypass-approvals-and-sandbox` | Provider, Endpoint base URL, Model, Reasoning effort | `OPENAI_API_KEY` (optional) | yes | yes |
| **Cursor** | `cursor-agent -p --output-format stream-json --force` | Model | `CURSOR_API_KEY` (optional) | no | yes |
| **OpenCode** | `opencode run --format json` | Model, Reasoning effort | none | yes | no |
| **Kimi Code** | `kimi --output-format stream-json -p "<prompt>"` | Provider, Model id, Endpoint format, Endpoint base URL, Model | `KIMI_MODEL_API_KEY` (endpoint pick only) | no | yes |
| **DeepSeek Harness** | `dsh-acp --permission-mode workspace-write` | Model | `DEEPSEEK_API_KEY` (optional) | yes | yes |
| **ZCode** | `zcode app-server` | Model | `ZAI_API_KEY` (required) | no | yes |
| **Grok Build** | `grok agent --always-approve stdio` | Model | `XAI_API_KEY` (optional) | yes | yes |

**Cost** and **Model** say whether a run's log can show them; the board never invents either. A
tool whose CLI isn't on the board's `PATH` reads **not installed**, with its install command; it
can still be picked. `PATH` is re-read each time the picker opens, but a CLI installed where the
board's `PATH` doesn't reach needs a board restart. Installed is not working — that is **Test**.

- **Model** — passed as `--model`; empty uses the tool's default. OpenCode takes
  `provider/model` (`anthropic/claude-opus-5`). Cursor puts effort in the id
  (`claude-opus-4-8[effort=high]`). DeepSeek Harness, ZCode and Grok Build pick the model when the
  session opens; ZCode also accepts `zai/glm-5.3`. Kimi Code takes an alias from its own
  `config.toml` on the sign-in pick, or **Model id** on the endpoint pick.
- **Reasoning effort** — Claude Code (`--effort`) and Codex (`-c model_reasoning_effort=…`) offer
  Low to Max, or **Agent's default**. A level the model doesn't support fails in the run's log.
  OpenCode takes free text, since providers name levels differently.
- **Key** — optional except for ZCode and Kimi Code's endpoint pick. Empty means the CLI's own
  login (dsh: the key in its `$DSH_HOME`). On Claude Code and Codex only a provider pick that uses
  a key is given one, so a subscription run never carries it. OpenCode has no key box: use
  `opencode auth login`.
- **Extra arguments** (`args`) — appended after the settings' flags and before the tool's own.

#### What each tool needs

- **Claude Code** — `claude`, logged in or given a key. Runs with `CLAUDE_CODE_MAX_RETRIES=0`, so
  a rate limit ends the run and frees the card. Whether hitting your plan's limit spills into paid
  usage is a claude.ai account setting.
- **Codex** — `codex` **0.94 or newer**, signed in (a ChatGPT subscription works). Runs without
  approvals or a sandbox, so a background run never stops to ask; fence it with your own
  `command` (your `--sandbox` wins).
- **Cursor** — `cursor-agent`, signed in: `curl https://cursor.com/install -fsS | bash`. `--force`
  lets it use tools without asking.
- **OpenCode** — `curl -fsSL https://opencode.ai/install | bash`, then `opencode auth login`.
  Writes only inside the working folder.
- **Kimi Code** — `curl -LsSf https://code.kimi.com/install.sh | bash`, then `kimi login`. Not the
  older `kimi-cli`, which has no headless mode. **No sandbox**: only Kimi's guard against
  `rm -rf`, `shutdown` and `reboot`. Model and tokens are read from `~/.kimi-code` (or
  `KIMI_CODE_HOME`).
- **DeepSeek Harness** — two packages, installed **one at a time**:

  ```sh
  npm install -g @deepseek-ai/dsh
  npm install -g @openma/deepseek-harness-acp
  ```

  Installing both in one command leaves a bridge with no dsh under it, and **Test** reports no
  answer; uninstall and reinstall the bridge on its own. Requests outside the working folder are
  refused and logged as `[refused]`.
- **ZCode** — runs the board on a Z.ai GLM Coding Plan: `npm install -g zcode-app-cli`. That
  package is community-made, not Z.ai's, and its right to republish the runtime is unconfirmed; to
  avoid it, install ZCode Desktop and set `command` to its bundled `zcode` followed by
  `app-server`. **No sandbox**. Paste a Coding Plan key from Z.ai or BigModel — a `zcode login`
  does not carry a run, and a missing key fails with
  `Model provider is missing an API key: zai`.
- **Grok Build** — `curl -fsSL https://x.ai/cli/install.sh | bash`, then `grok login` (or an xAI
  key on a machine with no browser; a saved login wins). Runs with `GROK_SANDBOX=workspace`
  (project, `~/.grok/` and temp); export your own to change it.

Every tool's rate limit except Claude Code's is waited out, holding the card meanwhile.

#### Which provider a run goes through

Claude Code and Codex offer three providers, each in its own words:

| Provider | What it is | What it needs |
| --- | --- | --- |
| **Claude subscription** / **ChatGPT subscription** | The login your CLI already has. | Nothing. |
| **Anthropic API** / **OpenAI API** | Pay per token on that provider's key. | The key. |
| **Anthropic-compatible endpoint** / **OpenAI-compatible endpoint** | A gateway such as OpenRouter, LiteLLM or a company proxy. | The base URL; a key if the gateway asks. |

- **Kimi Code** offers **Kimi sign-in** (nothing needed) or **Custom model endpoint**, which needs
  a model id, base URL and key (`KIMI_MODEL_NAME`, `KIMI_MODEL_BASE_URL`, `KIMI_MODEL_API_KEY`);
  **Endpoint format** is optional. Moonshot's paid API is the endpoint pick with Moonshot's URL.
- **Codex's endpoint** must speak OpenAI's **Responses** API. A non-subscription pick is written
  as its own `-c model_provider=…` so a `codex login` can't silently bill the subscription instead;
  a `model_provider` in your own `command` wins.
- **Claude Code has no OpenAI entry**: reach OpenAI models through an Anthropic-compatible
  gateway, or use Codex.
- **The pick sets the whole environment**: it clears every other provider's variables (including
  Bedrock, Vertex and Foundry), so a stale `ANTHROPIC_BASE_URL` in your shell can't reroute a
  subscription run. Cloud credentials such as `AWS_PROFILE` are left alone.
- **Defaults**: no pick means subscription, or the API pick if `.env` already holds that tool's
  key. Switching keeps the other boxes' values.
- **The other tools** have no provider list and inherit your shell environment.

#### Testing the connection

**Test** sends "Reply with OK and nothing else." through the runtime, spawned exactly like a card
run, and tests what is saved. It reports **Passed** with the time, **Failed** with the agent's own
words, a missing CLI with its install command, or no answer after a minute. It costs a few tokens
on a paid provider and touches no card.

#### Keys

Keys live only in **`docs/kanban/.env`** — set them in the dialog or by hand:

```
ANTHROPIC_API_KEY=sk-ant-…
```

- **Format**: `NAME=value` per line; blank and `#` lines are skipped; quotes are stripped. A key
  added by hand works on the next run, no restart.
- **Out of git**: `docs/kanban/.gitignore` carries `.env`. Commit the `.gitignore`, never the
  `.env`.
- **Never shown**: once saved, the dialog offers only **Replace** and **Clear**. Keys never appear
  on screen, in logs or on a command line.
- **One line per runtime**: a row's key is named after its `id`, e.g.
  `ANTHROPIC_API_KEY__CHEAP`, so two runtimes on one tool can use two keys.
- **What a run gets**: on Claude Code, `ANTHROPIC_API_KEY` for the Anthropic API, or
  `ANTHROPIC_AUTH_TOKEN` for a gateway (with `ANTHROPIC_API_KEY` set empty, which keeps your
  claude.ai connectors on). A subscription run gets no key.

### `ui.config.json`

```json
{
  "readyGate": true,
  "autoCommit": false,
  "requireDiffApproval": true,
  "aiReview": false,
  "runtimes": [
    {
      "id": "global",
      "name": "Global default",
      "harness": "claude-code",
      "settings": {
        "provider": "subscription",
        "model": "claude-opus-5",
        "reasoning": "high",
        "args": "--max-budget-usd 5"
      }
    },
    { "id": "cheap", "name": "Cheap", "harness": "codex", "settings": { "model": "gpt-5.1-codex" } }
  ],
  "agentRuntime": { "builder": "cheap" },
  "specAgents": { "ui-designer": { "output": "agent" } }
}
```

| Key | Meaning | Missing means |
| --- | --- | --- |
| `readyGate` | **Auto-approve builds** (Configuration → Board) | off (also if the file won't parse) |
| `autoCommit` | **Automatic Git commits** | on |
| `requireDiffApproval` | **Approve diffs before landing** | off |
| `aiReview` | **Review every build** | on (also if the file won't parse) |
| `runtimes` | The runtime rows; the first is **Global default** | one Claude Code row |
| `agentRuntime` | Which runtime each agent runs, by agent name → runtime `id` | **Global default** |
| `specAgents` | Per-agent changes: `enabled: false`, or a non-default `output` | on, with defaults |

Inside a runtime row:

- **`id`** — derived from the name and never changed; it keys the `.env` line, agent picks and
  recorded runs, so renaming is lossless. **`name`** is free text, unique on the board.
- **`harness`** — `claude-code`, `codex`, `cursor`, `opencode`, `kimi`, `dsh`, `zcode` or `grok`.
  An unknown one runs Claude Code, and the dialog says so.
- **`settings`** — what the dialog draws, unchecked: a wrong value fails the run with the reason
  in its log. `provider` is `subscription`, `endpoint`, `anthropic-api` (Claude Code) or
  `openai-api` (Codex); `baseUrl` is required with `endpoint`.
- **`command`** — a custom binary or flags for the row's own tool:

  ```json
  { "settings": { "command": "/my/bin/claude -p --model opus" } }
  ```

  A flag it already names (e.g. `--model`) wins over the setting, and the dialog says so. `args`
  is still appended.

Each run reads the settings when it starts. **Resume** always uses the tool the run started on.

A board from before runtimes carries `harness`, `harnessSettings` and `agentHarness`; it reads as
the equivalent rows, and `akb update` writes them down and renames this machine's key lines to
match.

### Which runtime each agent runs

`agentRuntime` maps an agent's name to a runtime `id`:

```json
"agentRuntime": { "builder": "cheap", "ui-designer": "cheap" }
```

It covers the shipped roles (`discussion-helper`, `builder`, `software-planner`, `code-reviewer`,
`writer`, `gater`, `decider`) and every agent in `docs/kanban/agents/`, and it travels with the
repository — so the planner can run on a stronger model than the builder on every checkout. Keys
stay per machine. An unknown `id` falls back to **Global default** with a note in the log; a tool
that isn't installed fails with its install command.

Every flow is run by its role: refine, clarify and `akb card resolve` by the software planner;
New idea, card discussions and `akb chat` by the discussion helper; a `spec` or `write` pass by the
specialist it names.

**Terminal**: `akb agent` lists everything; `akb agent runtime add|rename|delete` edits rows;
`akb agent set --runtime <id> <key> <value>` sets a value; `akb agent bind <agent> <id>` points an
agent at a runtime; `akb agent use <tool>` moves **Global default** to another tool;
`akb agent test <id>` tests one.

### The agents

**Agents** draws everyone working on the board as characters: the **roles** that run its flows,
then the **specialists** the command ships, then the ones this project added. Select one to open
its page: runtime, rule, memory, settings and, for one you added, its `AGENT.md`.

- **Roles**: **Discuss an idea** (the one you talk to), **Planner** (plans and refines cards),
  **Builder** (builds and lands; a marketing board has a **Writer** instead) and **Code reviewer**
  (judges a build; switched by **Review every build**). Two stand in for you, off by default and
  on product boards only: **Auto-approve builds** judges whether a ready card may build unwatched,
  and **Auto-answer questions** answers questions waiting on you, both from the goal and every
  module's `decisions.md` and `rejected.md`.
- **Board** pane: agents split into **Manual** (what you start yourself) and **Automatic** (what
  the board may start on its own); the switch says whether it may.
- **Specialists** fill one part of a card's spec while it is planned, never while it is built:
  **UI designer** draws the screen, **Tech stack advisor** picks the library. The board assigns
  them; you can't put one on a card by hand.
- **Problems** — an `AGENT.md` that doesn't parse, a duplicate name, a folder still in the old
  `docs/kanban/skills/` — are listed under the grid.
- **Art**: `kanban-ui/public/agent-art/<name>.png`; an agent without one draws its initial.

**Runtime**: one picker over the board's runtimes, saved in `ui.config.json`.

**A rule** is one paragraph added to the end of every run that agent does, saved in
`docs/kanban/rules/<agent>.md` (tracked in git) when you leave the box. It reaches all of that
agent's flows, is frozen into a delivery when it starts, and is read by every session — so a long
rule slows every card. It is plain words, not a command; clearing it deletes the file. Chat takes
no rules.

**Memory**: the page lists the files the agent owns, read-only. A role remembers in its flows'
files (the Planner: `memory/decisions.md`, `memory/rejected.md`, `memory/goal.md`; the Builder:
`memory/readme.md`, `memory/redesign.md`, `modules.md`). A specialist owns
`docs/kanban/memory/agents/<name>/`, as its `AGENT.md` says. How the product looks lives in the
app's `design.md`, not in memory.

**Add a specialist** asks for a name (a taken one is refused), writes
`docs/kanban/agents/<name>/AGENT.md` from a template marked unwritten — so no planning flow picks
it yet — and opens it for editing. The whole file, frontmatter included, is the box, saved on
leaving it; a save the board would refuse keeps your text and says why. Bundled agents show no
box. The pane never deletes an agent.

**Switch**: every specialist is on until switched off in its tile's corner (then **Paused**). A
paused agent starts no new run and leaves the planning list; a run already going finishes. The
switch is saved with the board, and `akb spec` still lists paused agents.

**Settings** (declared in the agent's `AGENT.md` frontmatter) show one line each with their cost;
**Change** picks another choice, saved at once, board-wide. `akb spec` prints them but can't
change them.

### Cloud → Cloud storage

In the app only, for accounts in the Cloud preview. **Stored in** reads **Local · docs/kanban/**
or **Cloud ·** a workspace name.

**Store this board in Cloud** migrates, both ways, after asking:

- **On**: cards, archive, memory and settings move into a **new** Cloud workspace.
- **Off**: the workspace is written back into `docs/kanban/` whole. The workspace itself stays;
  delete it on the **Workspace** page.

Running runs finish first; the window shows the migration until it ends. The repository is left
with one change to review and commit (`docs/kanban/` entering or leaving git, the
`.ai4kanban.json` pointer, a `.gitignore` block) — nothing is committed for you. A failed move
leaves the board as it was and shows the service's reason.

## When it finds no board

The page says **There is no board here** and names the folder it searched:

- **No board yet**: run `npx ai4kanban install` in the repo root. The tab picks it up without a
  reload.
- **Wrong folder**: restart from the repo root, or `npx ai4kanban-ui --board /path/to/repo`. A
  second board: `npx ai4kanban-ui --board /path/to/repo/marketing/kanban`.

**This board can't be read** means the board's rules (shipped in `akb`) are missing: run
`npm install -g ai4kanban`. The app carries its own copy; reopen the project. A board with an
unreadable card still opens, with the error in a strip.

## Run it from source

Only when changing the UI itself. Run the production server, not `next dev`:

```
cd kanban-ui
npm install                 # first time only
npm run build
PORT=7420 npm run start     # http://localhost:7420
```

To reproduce the `npx` package: `npm run build:standalone`, then `node bin/kanban-ui.mjs`.

### Where the words live

Every word the board draws is in `kanban-ui/i18n/`: one folder per surface, one file per
language, typed by that folder's `types.ts`. Components use `useCopy()`; server code and `lib/`
import `copy` from `i18n/`. Write English first in `<surface>/en.ts`; a missing translation fails
`npm run typecheck`. `i18n/index.ts` has the rest of the rules.
