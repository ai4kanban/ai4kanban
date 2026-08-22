# ai4kanban-ui

> **Deprecated — get the desktop app instead: <https://ai4kanban.dev/download>**
>
> The app is the same board in a window, with nothing to install first: no Node, no npx, no
> terminal to keep alive. This package keeps working and is not going away, but it is frozen
> at its last version and no new release lands here.

The local board UI for [ai4kanban](https://ai4kanban.dev/). It shows every track and drives
the work from buttons: each button spawns an agent in your repo that does the kanban work for
you — propose, refine, implement, archive. The markdown files in `docs/kanban/` stay the
single source of truth. The UI only reads and writes those files, so nothing here is locked in.

```
npx ai4kanban-ui        # deprecated — http://localhost:7420, localhost only
```

The desktop app is these same pages in a window, so everything below describes both. The pages
themselves are not going anywhere — reaching the board from another device still needs them. What is
deprecated is asking a person to start a server and open a browser. Installing this package,
pointing it at a board elsewhere, changing the port, updating: run `akb guide local-ui`. This
file is about **using** the board.

## In the app

On the first launch, pick a project folder. It does not need a board yet: if there is no
`docs/kanban/` there, the app offers to make one and then opens its guided first run.

The folder path in the header opens the **Projects** list. Pick a project there to go back to
a folder you opened before, or **Open folder…** to add another. **File → Open Project…** and
**File → Open Recent** are the same two moves from the menu.

One project is open at a time. Switching replaces the whole page with that project's board;
no card, dialog, filter or half-written field survives the switch. An agent run is different:
it stays with the project where it started and keeps going after you switch away, and a
pulsing dot on that project's line says so.

The **×** on a project takes it off the list without touching its folder, board or history;
open the folder again to put it back. The project on screen has no **×**. A remembered folder
that has been moved or deleted says **folder is gone** and offers only the **×**.

When a newer version is out, a line above the board says so with a link; the app never updates
itself. Closing the window ends every board server and agent run across the open projects.

## The board

The home page is the board. It answers one question — what can I start now? — with two
columns: **Ready to build**, the cards marked ready and under them the ones already being
implemented, and **Not ready**, everything still to be worked out. Each column counts what's
in it, and the ready one counts both numbers ("5 ready · 1 implementing"). Inside a column the
cards keep their tracks, banded one under another. Click a card to open it: the full body, its
meta (track, modules, release, priority, ROI, blockers), its open questions, and its buttons.

A third, narrower column holds the **recurring** cards — jobs on a cadence that are never
finished, so they are not part of the ready/not-ready question at all. The column is absent on
a board that has none.

The columns are a fixed width and the row scrolls sideways, so cards lay out the same way on a
laptop and on a monitor — a wider window shows more of the row, not wider cards.

A card waiting on another carries a small **lock** marker; hover it to see which cards are in
the way. It shows only while a blocker is still on the board, and a recurring card never counts
as one. The card stays in its column either way: the marker says the work has an order to it,
it doesn't hide or gate anything.

The board hides nothing: every open card is in one of the three columns. Inside a track band,
the best card to start comes first — a card waiting on another sinks below the ones you can
start, and a blocker rises to the top of the rest.

The header carries seven things:

- **The goal** (the compass, beside the folder path) — see below.
- **The release dropdown** — which version the board is showing, and where a release is
  started, filled, or dropped; see **Releases**.
- **Create task** — describe an idea in your words and the agent writes the card. The same
  dialog has a **Propose tasks** mode: pick a module (or let the agent pick), a **How many**
  count (3 by default, 10 at most), and a **Boldness** — `safe` polishes what already works,
  `normal` is a feature each, `bold` asks for a capability the module doesn't have at all.
  Every proposal is a single card a session can finish, never a group task.
- **Runs** — every agent session, live or finished. Open one to read its log. A finished run
  can be continued with a follow-up prompt; that starts a new run.
- **Progress** (the chart) — two charts, both read-only: **Daily progress**, and
  **Planning quality**; see below.
- **Configuration** (the gear) — see below.
- **Chat** — a conversation about this project that also does the board work, in a rail down
  the right; see below.

### Finding a card

Down the left is the **rail**: **All cards** at the top, which is the board, and under it every
card this window has opened, each one closeable. Drag its right edge to make it wider.

Above those rows is a **Find a card** box. Type part of what you remember and the rail lists
the cards that carry it, in their titles or anywhere in their bodies — case makes no
difference, so `ui` finds a card that says `UI`. Click a match to open it. It searches every
open card, including a group's subtasks, which the board's columns don't show. It never reaches
the archive. Matches scroll inside the rail, nothing matching says so, and clearing the box
(the **×**, or Escape) puts the rail's own list back.

At the foot of the rail is the **Memory** panel. The rail is hidden on a narrow window, and the
box and the panel go with it.

### Chat

Down the right is a **chat** about this project, folded away until you ask for it. **Chat** in
the header opens and folds it, and you drag its left edge to make it wider. Whether you left it
open is remembered, and it stays open while you move between the board, a card and a memory
file.

The chat follows what is on screen: the board and a memory file get the conversation about the
whole board, a card's page gets that card's own. Each one is separate — a card's is never mixed
with the board's or with another card's. Walk to another card and nothing of the last one is
left: not its messages, not a message you half typed, not the error its last send left behind.

Before anything is said, the rail says where its answers come from — this card and the rest of
the board, or the whole board — and offers three things worth asking. On a card those are what
is unclear about it, whether it is too big to build in one go, and what could be cut.

It answers from this project — the goal, the module map, the open cards, the memory, this
board's settings — so you never have to explain the project. The reply appears as it is
written, and where it names a card the name is a link to that card's page.

- **It changes the board.** Once you have settled a change, it makes it — writes a card,
  rewords one, answers its open questions, puts it in a release or takes it out, archives it,
  drops it. Straight away, with no "shall I?" first, and it says what it did.
- **Work goes to a run.** Building a card, sharpening a vague one, proposing tasks, filling a
  release — it starts a run and that run joins the runs panel like any other, with its log,
  its Stop and its Resume. It never writes your project's code itself.
- **The board keeps up.** A card it changes moves on the board while the reply is still
  arriving. Archive or drop the card whose page you are on and the app goes back to the board.
- **A card a run has is off limits.** The change is refused, and the refusal names the card
  and what that run is doing.
- **It is still not a run.** It shows in no runs panel, locks no card, and keeps no run off
  one — you can talk about a card an agent is building.
- **One message at a time.** The box is shut while a reply is coming.
- **Folding it doesn't stop it.** The reply keeps arriving, and the Chat button marks that
  there is something to read.
- **It keeps.** The exchange is still there after the app is closed and reopened, and it is per
  project. The bin in the chat's own header clears it, and asks once before it does.
- **It is the same conversation as `akb chat`.** What you say here and what you say in a
  terminal land in the same place.

On a window too narrow to hold the board between two rails, the chat covers the board instead
of squeezing it.

Where no coding agent is set up, the chat says so and points at Configuration.

### The goal

`memory/goal.md` is where the project is headed, in your own words. Every proposal the agent
makes is judged against it. The **compass** in the header opens a **Goal** dialog showing the
whole file as you wrote it — nothing cut short or folded away, and a long goal scrolls.
**Edit** swaps the text for a plain box with Save and Cancel; saving writes your words back
with no reload.

The compass only shows when there is something to read. A goal file that is missing or empty is
asked for by the first run, or by the board's goal notice.

A save marks the goal `reviewed: pending` in its frontmatter and leaves the rest alone. That
field is how clear the goal looks to plan from: `strong`, `good` and `weak` are the agent's
judgment — written at setup and on every proposal — and `pending` means you wrote something
nobody has read yet. Only `weak` (or an empty file) makes the board ask you for a goal.

### The board's memory

At the foot of the rail is **Memory** — what the agent remembers about this project. Every
proposal is judged against these files, every question it settles itself leans on them, and
every idea you turned down stays turned down because it is written there. This is where you
read them without opening files in an editor.

It starts collapsed. Click the row and it opens on two halves, **Project** and **Modules**. The
project's four files are the four rows under **Project**:

| Row | The file |
| --- | --- |
| **What shipped** | `docs/kanban/memory/readme.md` |
| **Settled decisions** | `docs/kanban/memory/decisions.md` |
| **Design mistakes** | `docs/kanban/memory/redesign.md` |
| **Rejected ideas** | `docs/kanban/memory/rejected.md` |

Hover a row and it names the file it opens. Click one and the file opens in the body, whole and
rendered, headed by the row's name — with the module's name over it when the file is a
module's — and its path from the repo root under it. The row stays highlighted while you read.
The panel grows with its rows up to half the rail and scrolls past that, so the cards above it
are never pushed off. Whether you left it open is remembered.

Under **Modules** is one row per module your `docs/kanban/modules.md` names, in the map's own
order. Click one and it opens into that module's own four files — `docs/kanban/memory/<module>/`
— indented, reading exactly like the project's. Any number can be open at once, and a module
nothing has been written about yet says so in a line. Modules start closed every time you load
the board, except the one holding the file you landed on.

An open memory file is a page of its own, so Back, Forward and a reload keep you on it, and in
the app a two-finger swipe goes back from it, as it does from a card. The page re-reads itself
when a run finishes and when you come back to the window, so a file an agent just rewrote
catches up on its own. A file nobody has written yet keeps its row and says so when you open it.

**Everything here is read-only, and nothing starts a run.** To fix a line you disagree with, the
**⋯** beside the heading offers **Copy path** and **Copy relative path**
(`docs/kanban/memory/decisions.md` — the form to paste to a coding agent working in this repo).
The board never opens the file for you.

The goal is not in this panel — it keeps its own button in the header.

### Mockups on a card

A card that changes a screen can carry **mockups** of it — small files under
`docs/kanban/.mockups/<card id>/`, each drawing one layout the card could take. The card body
points at each one with a tag on a line of its own, and the card page draws the screen that file
holds where the tag sits, so you pick a layout by looking at it. The `ui-design` agent writes
them; only a card page shows them, and the card file is never written to.

A mockup is written as one of two things:

| The file | What it is |
| --- | --- |
| **`.tsx`** | One React component drawing the whole screen, styled with Tailwind and importing React and nothing else. This is the one an agent writes. |
| **`.html`** | A whole page carrying its own styling — for a drawing that already exists as a page. |

Both get the same frame: the mockup's **label** and its **file name** across the top, a switch to
the **code** the file holds, and under that one desktop screen — 1280 by 800 — scaled down to fit
the width the card page gives it. Every option is the same size on the page, because that is the
only way they compare. A mockup taller than one screen scrolls inside its own frame, and never
sideways. Switching one to its code leaves the others as they are.

**Click the file name to see that mockup on its own, at full size** — a page with nothing else on
it, where the words in a scaled-down screen can be read, and which scrolls sideways when the
window is narrower than the mockup. Back returns to the card.

Nothing in a mockup runs, loads anything from the network, reads anything else in the board, or
answers a click: it is drawn inside a sandbox, and the board's own fonts, colours and layout stop
at the frame — what you look at is what the file holds. A tag pointing at a file that isn't there,
at one outside the mockups folder, at one that is neither `.tsx` nor `.html`, or at a `.tsx` the
board cannot draw, reads as one plain note naming the file, and the rest of the card draws as
usual.

The folder is gitignored — a mockup is a working drawing, not something the repo carries. A card
pulled from someone else's board shows its tags as those notes until `ui-design` draws the
options again here.

### Progress

The header's chart button opens **Progress**, which holds two charts. Both only read what the
board has already written; neither ever writes.

**Daily progress** — the last 30 days as a line each for completed, created and rejected cards,
with totals above. The numbers come from `docs/kanban/metrics.csv`. A board with nothing recorded
yet says so.

**Planning quality** — how well the board planned each release, one point per release in the
order they closed, and the release still open at the right end, marked `open`. The numbers are
worked out from `docs/kanban/record.csv`, which board commands append to as they run. Three
series, each with its own line style and marker so they are told apart without colour:

| Series | What it counts | What it leaves out | Drawn after |
| --- | --- | --- | --- |
| **Details settled** | Of the card questions closed in the release, the share the board settled itself rather than handing to you. | A question moved to a card's `verify:` list — it was never answered, only turned into a hand-check. | 20 closed questions |
| **Decisions that stood** | Of the calls the agent made on its own, the share you left standing rather than overruling. Both counts land in the release where the card was archived or rejected. | Nothing; every call on a card that left the board in the window counts. | 20 calls |
| **Proposals built** | Of the cards the board proposed itself, the share that were built rather than rejected. | A card you asked for, a card created before the record existed, and a proposal still open. | 10 decided proposals |

**A missing point means too little evidence, not zero.** Below the figure in the last column a
series has no point at all and its line stops, restarting at the next release that has one. The
readout says `not enough yet` there, with the two counts it does have.

**A high number is not proof of good planning.** Asking only easy questions raises Details
settled. A decision nobody reviews is never overruled, so Decisions that stood rises when the
agent's calls go unread. Proposing only safe work raises Proposals built. Read each one beside
what the release actually shipped.

Click or hover a release to read it out; the chart is also one Tab stop, where **←** and **→**
move release to release and **Home** and **End** jump to the ends. The readout under the chart
gives the chosen release's three percentages, the counts behind each, and every card that
contributed — enough to recalculate any figure from `record.csv` by hand. It opens on the release
still open, because that is the score still worth acting on.

A board whose installed `akb` predates these scores says so in one line, and Daily progress is
still drawn above it.

## Releases

A release is a version in `docs/kanban/releases.md`. The dropdown in the header says which one
the board is showing, and its **⋯** menu is where a release is described, closed or dropped.

**Which release a card ships in.** Open the card and the meta box has a **Release** box next to
Priority and ROI: pick a version and the card moves into it, pick the dash and it comes back
out. The dash is a card in no release — wanted, but not promised to a version. You pick from the
open releases in shipping order; there is nothing to type, so a version id can't be misspelled
into existence. The pick is written into the card file at once, like priority and ROI. The board
cards don't show the version, because the dropdown already says which release you are looking
at. A **group task** moves as one: the root takes every subtask with it, nested groups included,
and a single subtask can still be moved on its own. `releases.md` is a plain file you can edit,
so a card can end up naming a version that is no longer on the list; that card is marked **not
on the list** and its box moves it onto a release that exists.

**Showing one release at a time.** Pick a release and the cards in every other release are
hidden — that is the point of it. **Blockers are the exception: every blocker stays on screen
whatever you pick**, in the Blockers column and at the top of the queue's halves, even when it
belongs to another release or to none. **No release** is the first entry and where the board
opens: the open cards not promised to a version yet, the pile every release is picked out of.
There is no whole-board view.

Each entry counts the open cards in it — "v1 (7)" — and carries what that version is for under
its name; the same numbers `release list` prints in your terminal. A few more things it does:

- A **group task** shows whenever the root or any subtask is in the release you picked.
- **Create task** puts the new card in the release on screen. **Propose tasks** doesn't — that
  work stays in no release.
- A release with **nothing open in it says so**, with **No release** one click away. Blockers on
  screen don't count.
- Your pick is remembered in your browser, per board, and never written to the files — so it
  never changes what the agent works on.
- If the release you picked is gone, the board opens on No release rather than hiding your cards.

**Starting one.** The dropdown's last entry is **New release**. It asks for a version id — `v1`,
`0.5.0`, `august`, whatever you call your versions — and which kind of release this is:

- **From a goal** (the tab it opens on) — a sentence or two saying what this version is trying to
  ship. Those words are the whole choice: the release is planned against them. The goal goes on
  the release's line in `releases.md` and shows under the version in the dropdown. **Make
  release** stays out of reach while the box is empty.
- **No goal** — one toggle instead: **put every unplanned high-priority card in**, with the cards
  it would move counted under the switch. It is a rule, not a judgment call: it looks only at
  cards in no release, and a card goes in on three tests — priority is high, nothing open is
  blocking it, and it is not a group root (a subtask is tested on its own). It only ever adds.
  Every high-priority card it leaves behind is counted with the test it failed. Turned off, the
  release is made empty.

Where a release sits in the order is the order you made them in. A release made with no goal can
be given one later — **What it is for** in the **⋯** — and filled from there. The board switches
to the new release the moment it is made, so what you write next lands in it.

**Filling one from its goal.** While the board is showing a release that has a goal, the **⋯**
offers **Fill from its goal**. A dialog first shows the goal it will plan against and says what
the run does: it moves the open cards that ship the goal into the release, and it writes the
cards the goal needs that the board hasn't got. The new cards land plain, and each is refined
right after as its own run. Nothing waits on you and there is nothing to approve.

It behaves like every other run: it shows in the runs panel from the moment it starts, you can
stop it there, and its log says what it moved in, what it wrote, and what it left out and why.
While it goes, the release says **it is being planned** across the top of the board, with
**Watch the run** on the note. The board picks the cards up as the run goes.

Filling only ever adds, so running it again is safe — say **What it is for**, then fill again,
and it adds whatever the goal still lacks. To take a card back out, use its **Release** box. In
a terminal the same move is "plan release v1". A name the board can't take — one it already has,
an empty one, or one that can't be a filename — is refused with the reason under the box.

**Saying what it is for.** The **⋯** offers **What it is for** — the whole goal in a box, and
that box is where you change it. The dropdown clamps a long goal to two lines and the file keeps
it on one, so this is the only place you read all of it at once. Save an empty box and the
release goes back to having no goal. In a terminal: `release new v1 --goal ".."` and
`release goal v1 ".."`.

**Closing one.** The **⋯** offers **Close release**. A dialog first says what the close writes
down and lists the open cards that come out of the version — still wanted, no longer promised to
it. It also names any open card whose todos are all ticked but which was never archived: that
card counts as **not shipped**, and a closed release can't be reopened to fix it, so it is named
while you can still cancel, archive the card, and close after.

Confirming does exactly what `release close v1` does: the summary file in
`docs/kanban/.release-summaries/` gets one dated **Closed** section — what shipped, from the
cards archived while they named the version, and what was still open — the open cards come out
of the version, and its line comes off the list. The summary also keeps what the version was
for, since the release's line is gone. The board never edits that file again; fix a wrong line
in your own editor. Afterwards the board shows **All releases**.

**Dropping one.** The **⋯** offers **Drop release** for a version that will not ship. A dialog
first lists the cards already archived under it and the open cards that come out of it. Confirming
does exactly what `release drop v1` does: the version comes off the list with no shipped record,
its open cards return to no release, and cards already archived stay archived. No summary is
written, and an earlier close's summary file is left alone. Why you gave up is yours to write
down if you want it kept.

**Renaming and reordering a release are still terminal jobs** — `releases.md` is a short file and
a hand edit is how those work. A board that plans no versions never sees any of this: no box on a
card, and a dropdown that says **No release** and offers **New release**.

## The first run

A board whose setup is unfinished opens on a short guided run instead of the columns. It asks for
the three things only you can answer, one to a screen:

1. **The project** — its name, one line saying what it is, and the tracks work falls into.
   Everything starts filled in. A track is a folder under `docs/kanban/todo/`, so adding one here
   makes it, renaming one moves it with its cards, and dropping one removes it — unless it holds
   cards, and then it stays and the screen says so.
2. **The goal** — an empty box on `memory/goal.md`, your own words, with a link to the longer
   guide. **Skip for now** leaves it for later.
3. **The agent** — which agent every button on this board runs, with the same picker, settings and
   **Test** the Configuration dialog has. This one can't be pressed past: Continue opens on a test
   that passed, and on nothing else.

Then a closing screen names what is left — the steps that read your repo and think — and offers to
do them for you: **Finish setup** starts one agent run that works down every step still unticked.
It is an ordinary run, so it shows in the runs panel and you can stop it, and the board re-reads
itself as it goes. Only one setup run goes at a time — while one is going the button is replaced by
**watch the run** — and starting one after a run failed or was stopped carries on from the first
unfinished step. If you skipped the goal, the screen asks for it
first — nothing after the goal can be planned from a goal nobody wrote.

When that run stops short — the agent isn't logged in, a connector is set up wrong — the closing
screen and the board's setup strip both say **The last setup run stopped short**, with **read its
log** for why. **Finish setup** stays where it is; pressing it again is how you retry. A run you
stopped yourself is not a failure, and the offer reads as it did before.

The line to paste is there either way, under the offer rather than instead of it:

```
/kanban. Set up this board — follow docs/kanban/setup-checklist.md.
```

The line follows the agent you picked, because agents trigger a skill differently: on Codex it
reads `$kanban. Set up this board …`, and on Cursor, OpenCode, DeepSeek Harness and ZCode it asks for
the
skill in a sentence. Copy it and paste it as it comes. It is on every screen of the run too, under
**Rather set this up from your coding agent?** — setup picks up at the first unticked box, so
nothing you answered here is asked again.

That line only works once the coding agent skill is in the repo, and a board arrives without it.
Where there is none, both places say so and hand you the one command that adds it —
`npx ai4kanban@latest skill install`. **Finish setup** needs none of it: the run the board starts
is given the board's own command directly.

**Go to the board** leaves the run for the columns at any step, and the board then carries a strip
saying how far setup got with **Continue setup** on it. The steps down the left take you back to
any of them. The run is remembered in `setup-checklist.md`, so closing the window and coming back
lands on the same screen. The strip stays until setup is finished, carrying **Finish setup** and
**Finish in your coding agent** beside it — or, on a repo with no skill, **Add the coding agent
skill**. Before setup ends the skill creates no cards at all: ask it for one and it tells you to
finish setup first. The last box creates your first cards and deletes the checklist.

**When the goal needs writing.** Long after setup, one notice comes back on its own when there is
no goal to plan from — the file is empty, or the agent has judged it weak again (`reviewed: weak`).
**Write the goal** opens the same box the first run used; writing one sends the notice away with no
agent run. The ✕ hides it for the browser session. A board that is set up and simply has no cards
left shows nothing.

## A card's buttons

Every button opens one small dialog. You can type a note that goes to the agent, then confirm. The
card then shows a running badge and a live log you can read while it works. The log is read-only —
you never type into a running session.

| Button | When it shows |
| --- | --- |
| **Implement** | Until every todo on the card is checked. Never on a group root or a recurring card. |
| **Run** | On a recurring card, in place of Implement — see below. |
| **Refine** | While a refine would still move the card — see below. |
| **Edit** | Always. Say what to change and the agent revises the card. |
| **Resolve** | Only when the card has open questions. |
| **Archive** | Once every todo is checked (a group root: once every subtask is resolved). Never on a recurring card. |
| **Reject** | Always. |

A card can only have one run at a time; while one is going the button is off and the badge beside
the title says what's going on. **A run never commits** — it leaves its changes in your working
tree, and you read `git diff` and commit.

**Resolve** gives each open question an answer box. A question that carries choices shows them as
a tick list instead — one pick, or as many as you like, depending on the question — with the
agent's recommended ones already ticked, so agreeing is one click. Those questions keep their box
too: type an answer and the ticks clear, tick an option and the text clears. Your answer is either
the options or your own words, never both. Leave a question untouched and the agent researches that
one itself. The card page lists the same choices under **open questions**.

**Resolve & implement** is a second confirm: the agent answers the questions it can settle itself,
and if nothing is left for you to decide it goes straight on to build the card in the same run. If
a real judgment call remains, it stops and leaves it for you.

When a card is blocked, the **Implement** dialog names each card still in the way and asks you to
tick that you know before **Implement anyway** wakes up. The warning is there so you know what
you're starting ahead of, not to stop you.

### Schedule it instead

Beside **Implement anyway** sits **Schedule**. It starts nothing now: it writes on the card what
you want done, and the board runs it by itself within a minute of the last card in the way leaving
the board — archived or rejected.

- **Two actions can be scheduled**: **Schedule** in the Implement dialog builds the card, and
  **Schedule** in the Refine dialog sharpens its plan. Scheduling always follows one of those two.
- **Nothing to tick.** Nothing starts ahead of the blocker. A card that isn't **ready** still asks
  for its "the plan may still be rough" tick before you can schedule a build.
- **The note you type goes with it** and reaches the run when it fires.
- **One at a time.** Scheduling a second action replaces the first, and the dialog says which one
  was on.
- **The card reads `pending`** in place of its stage, on the board and on its own page. Hover it
  and it says what will run and what it waits for — `implement · waiting on #57`. The card keeps
  the stage it had and stays where it is in the queue.
- **Take it off** on the card page, next to **Scheduled**. Nothing fires after that.
- **It has its own slot.** One scheduled run starts per minute, and neither a refine in flight nor
  a recurring job that is due can hold back a card whose blocker just cleared.
- **It fires once.** The mark comes off the moment the run starts, so a run that fails or that you
  stop doesn't come back on its own.
- **A schedule that has gone pointless is dropped**, not run — a refine you queued on a card
  someone has since taken to **ready** has nothing left to do.
- **A card whose blocker is never finished stays pending forever.** That costs nothing.

The mark lives in the card's own frontmatter, so it survives closing the board, a reboot, and a
clone on another machine — and it travels with the card if you move it.

### Refine

**Refine** runs one refine on this card right now. Its dialog has nothing to type. It is the same
run the board starts by itself after something touches the card, so it is how you refine a card
whenever you want.

The button shows only while a refine would still move the card. It's gone once the card is
**ready**, once every todo is checked, and when every open question is one only you can answer —
**Resolve** is the button for that last one. A **Blocked** card keeps the button; the dialog names
the blocker and offers both ways on — **Refine anyway** now, or **Schedule** it.

**The refine that follows a run.** A command does what you asked and stops. The board then refines
the card as a run of its own, with its own log, stoppable like anything else.

- **A run that wrote or changed a card gets a refine on it.** Add a card, change one, answer its
  questions, propose, fill a release — each card that run touched comes back refined, one run per
  card. Ask for three cards and three refines follow.
- **Finishing or rejecting a card refines the ones it was holding up**, one wave at a time.
- **A group's main card is not refined by a subtask finishing.** Ticking its line is the group's
  progress, not a new plan. Change the main card itself and it is refined like any other.
- **Cards a refine can't move are skipped** — one still waiting on a blocker, one the run left
  **ready**, a recurring card, one whose todos are all ticked, and one whose open questions are all
  yours to answer.
- **Nothing hunts the backlog.** Every refine follows something that just happened, so a card you
  write by hand in your editor gets none — press **Refine** on its page.
- **It hangs off the end of a run**, so it works the same whether the run started here or from a
  terminal, and a refine that failed or that you stopped is not started again.

### Recurring tasks

A card in the **recurring** column is a job you repeat — a weekly report, a daily tidy-up — not a
piece of work you finish once. Its column carries a light lilac tint, and its cards are run again
and again and never archived.

**Run** does one pass. The agent works through the card's **Process** in order, records the run,
and rewrites a step or two so the next run needs less of you. The card stays on the board when the
run ends. Nobody is watching a run, so a step that needs your judgment is not guessed at: it is
left undone and written into that run's open-questions file, next to the card. The next run folds
your answer into the Process.

There is no **Archive** on a recurring card, since it has no end state, and no **Refine** either —
a recurring card has a Process, not a build plan, so running it is what sharpens it. **Edit**,
**Resolve** and **Reject** work as they do anywhere else. To make one, describe the job in **Create
task** and say it repeats.

#### A cadence runs the job for you

The card page says when the job **last ran**, next to Priority
and ROI, or **Never run**. Beside it is **Cadence** — pick a number and a unit: every 30 minutes,
every 6 hours, every 7 days. Pick days and a time box appears, so a report can run every day at
09:30. **No cadence** takes the schedule off again.

Give a card a cadence and the board runs it itself when it comes due — no click. It is the same run
the **Run** button starts, it shows up in **Runs**, and **Stop** ends it. Without a cadence the card
runs only when you click Run. **Next run** appears beside Last run and says when the job comes round
again, or **Due now**. Both times are your machine's clock.

A card that has never run is due at once, so a new job runs within the minute. After that it waits
out the interval from the last recorded run. The board wakes once a minute, so that minute is the
floor. A job that was due while the board was closed runs once when you open it, not once for every
window it missed. Only one recurring job runs at a time, and it has its own slot. If a run is
stopped, fails, or ends without recording itself, the board leaves that card alone rather than
starting the same broken run every minute; click **Run** when you want it back on its cadence.

### Stopping a run

A live run's log has a small **✕** in its title bar — on the card page, on the log you open from a
card on the board, and in **Runs**. It opens a small box asking you to confirm, so a stray click on
a busy board can't kill an agent mid-edit. Confirm and the button reads **stopping…** for a few
seconds: the agent is asked to end first, and only killed if it doesn't go.

**Stop doesn't undo anything.** The run ends where it stands and whatever it half-wrote stays in
your working tree. Read `git diff` and undo what you don't want. A build or a test the agent kicked
off is left to finish on its own.

Every run can be stopped, whoever started it. The card unlocks the moment the run ends.
**Stopped** is its own outcome, next to done and failed — a blue dot in the runs panel and `stopped`
on the log — so it never reads as a failure, and it offers no **Resume**. Stopping the refine that
followed a run ends it there; press **Refine** on the card when you want another.

### What a run cost, and which model it used

When a run ends, its log says how long it took, what it cost, and which model did the work:
`done · 4m 12s · est. $0.42 · claude-opus-5`. The same line shows wherever that log opens.

The number is an **estimate**, not a bill: the agent works it out on its own machine from the run's
tokens at list prices. Most people run the board on a subscription plan, where a single run isn't
charged on its own. It is one run's own cost — the board never adds runs up, and a run you continued
with **Resume** shows what that new run cost, not the whole conversation.

The model comes from the run itself — what the agent said it was working with — not from the Model
box in **Configuration**. So a run shows a model even when you left that box empty, and a run that
started before you last changed the model still shows the one it actually ran on. It shows from the
run's first seconds and reads exactly as the agent said it.

Either can be missing: a run still going or one that ended before it got there reports no cost, and
some agents report neither (see **The agents**).

## Group tasks

A group task is a folder with a `root.md` and its subtasks under it. The root is a tracking card,
not something you build directly:

- The root shows **no Implement button**. A group is finished by finishing its subtasks.
- The root's **Archive** button appears once every subtask is resolved — ticked off (done) or
  struck through (rejected). Archiving the root closes the whole group.
- A group root that never got any subtasks can't be archived that way. Close it with **Reject**.
- The root's **Release** box moves the whole group, nested groups included.

The root keeps this record itself: an archived subtask's line is ticked and a rejected one's is
struck through, so the outcome survives after the subtask files are gone.

## Configuration

The gear in the header opens the **Configuration** dialog. A sidebar names its sections —
**Harness**, **Agents** and **Setup**. Settings live in `docs/kanban/ui.config.json`, next to your board, so
`npx` always serves the latest UI and an update never touches them. Everything the dialog holds
writes itself there, with one exception: a key goes to `docs/kanban/.env` and never to this file.

There is no Auto-refine section and no switch: a refine follows the run that touched the card, so
there is nothing to turn on.

### The harness

**Harness** is the coding tool that runs the board's work — every button here starts a run on it, in
your repo root. Six ship:

| Agent | It spawns | Settings | Optional key | Cost | Model name |
| --- | --- | --- | --- | --- | --- |
| **Claude Code** (default) | `claude` | Provider, Endpoint base URL, Model, Reasoning effort | `ANTHROPIC_API_KEY` | yes | yes |
| **Codex** | `codex exec --json --sandbox workspace-write` | Model | `OPENAI_API_KEY` | no | no |
| **Cursor** | `cursor-agent -p --output-format stream-json --force` | Model | `CURSOR_API_KEY` | no | yes |
| **OpenCode** | `opencode run --format json` | Model, Reasoning effort | none | yes | no |
| **DeepSeek Harness** | `dsh-acp --permission-mode workspace-write` | Model | `DEEPSEEK_API_KEY` | yes | yes |
| **ZCode** | `zcode app-server` | Sign-in, Model | `ZAI_API_KEY` | no | yes |

Same cards, same buttons, same files whichever you pick. **Cost** and **Model name** say whether a
run's log can show them: the board prints what the run itself reported and never invents either, so
an agent that reports no price shows the duration alone.

The picker marks the agents this machine can actually run. One whose CLI isn't on the board's
`PATH` is dimmed and reads **not installed** — it can still be picked, and the line under the row
names the command that installs it. The agent you have picked is never dimmed; if its CLI is
missing, that same line says so. It is a look at the `PATH` and nothing more, on every page load and
every time the picker opens — so a CLI you install in a terminal counts the next time you open it,
and one installed somewhere the board's `PATH` doesn't reach stays dimmed until the board is
restarted. That the CLI is there is not that a run would work: that is **Test**.

Each agent brings its own settings, so the fields change when you pick another one. Switching
empties them — a Claude model id means nothing to Codex — and leaves your saved keys alone.

- **Provider** (Claude Code only) — who pays for a run and where it goes. See below.
- **Sign-in** (ZCode only) — the login `zcode` already has, or a Z.AI Coding Plan key you paste in.
- **Endpoint base URL** (Claude Code only) — the address your gateway answers on. Required before
  the endpoint pick will save.
- **Model** — the id that agent runs with, passed as `--model`. Leave it empty for the agent's own
  default; the board never invents an id. Two agents write it differently: **OpenCode** takes
  `provider/model` (`anthropic/claude-opus-5`), because it reaches every provider and the name alone
  wouldn't say which; **Cursor** carries the thinking level inside the id, `claude-opus-4-8[effort=high]`,
  so it has no reasoning box. **DeepSeek Harness** and **ZCode** choose the model as the run's
  session opens rather than on the command line, because each carries its model catalog per session;
  ZCode also takes `zai/glm-5.3` when you want to name the provider too.
- **Reasoning effort** — how hard the model thinks, passed as `--effort`. Claude Code offers a list:
  Low, Medium, High, Extra high (xhigh), Max. **Agent's default** passes nothing. OpenCode makes this
  a box you type in, because the level is your provider's own word (`minimal`, `high`, `max`) and
  providers don't agree on the words.
- **The key box** — optional every time. Leave it empty and runs use whatever login that CLI already
  has; for dsh, the key it saved in its own `$DSH_HOME`; for ZCode, the one `zcode login` made. Clear
  it and the next run goes straight back to that login. OpenCode has no key box on purpose: it reaches any provider and each has its own
  key, so its runs use the login `opencode auth login` made. See **Keys**.
- **Test** — under those settings. See **Testing the connection**.

### What each agent needs

- **Claude Code** — the `claude` CLI, logged in or given a key. Run with
  `CLAUDE_CODE_MAX_RETRIES=0`, so a rate limit ends the run right away and frees the card instead of
  backing off for the best part of an hour. That is not a spend control: whether hitting your plan's
  limit spills into paid extra usage is an account setting on claude.ai.
- **Codex** — the `codex` CLI on your PATH, signed in; a ChatGPT subscription runs the board the same
  way a Claude one does. **Codex 0.94 or newer**, which is when it started reading skills from
  `.agents/skills/`. `--sandbox workspace-write` keeps a run inside the working folder, gives it no
  network, and makes it refuse to start outside a git repo; widen it with a `command` of your own if
  your work needs more — the `--sandbox` you name there is the one that runs, and the board adds none
  on top. It has no retries switch, so a rate-limited run sits there retrying and holds
  its card until it gets through — nothing else on the board is stuck.
- **Cursor** — the `cursor-agent` CLI, signed in. It is the one agent that doesn't come from npm:
  `curl https://cursor.com/install -fsS | bash`. `--force` lets a run use its tools without stopping
  to ask; a board run has nobody to answer, and Cursor's own answer to an unanswered question is to
  refuse.
- **OpenCode** — the `opencode` CLI, logged in with `opencode auth login`, installed from a script:
  `curl -fsSL https://opencode.ai/install | bash`. Left alone it writes in the working folder and
  refuses anything outside it, with no flag to widen it.
- **DeepSeek Harness** — two npm packages, **one at a time**:

  ```sh
  npm install -g @deepseek-ai/dsh
  npm install -g @openma/deepseek-harness-acp
  ```

  The first is dsh itself; the second is the bridge that lets the board talk to it. Asking for both
  in a single `npm install -g` leaves you with a bridge that has no dsh underneath it and exits on
  its first import — **Test** then says the agent did not answer. Repair it by putting the bridge in
  again on its own (`npm uninstall -g @openma/deepseek-harness-acp` then install it). The board holds
  a conversation with `dsh-acp` rather than using dsh's own headless command, which says nothing
  until it has finished and can't carry on an earlier run. Its permission preset lets a run write in
  the working folder without asking and raises a question for anything beyond it; the board answers
  no and writes `[refused]` into the log.
- **ZCode** — Z.ai's coding agent for its GLM models, and the way to run the board on a GLM Coding
  Plan. Z.ai ships no terminal command, so the one the board starts comes from a community package
  that lifts the agent out of ZCode Desktop: `npm install -g zcode-app-cli`. That package is not
  Z.ai's and says its own right to republish the runtime is unconfirmed; if you would rather not rely
  on it, install ZCode Desktop and point this agent's `command` at the `zcode` inside it, followed by
  `app-server`. The board holds a conversation with `app-server` rather than using `zcode --prompt`,
  which prints for a person to read and never says which session it ran under. A run opens its
  session in ZCode's `yolo` mode: nothing stops to ask, and nothing holds it to the project folder
  either — ZCode ships no sandbox. Sign in with `zcode login` (macOS) or `/login` once, or paste a
  Coding Plan key from Z.ai or BigModel. ZCode reads `.agents/skills/kanban/` on its own.

Every agent's rate limit but Claude Code's is waited out, holding the card while it does.

### Which provider a run goes through

Every run goes through somebody's account. **Provider**, at the top of the Agent section, is where
you say whose. Claude Code offers three:

| Provider | What it is | What it needs |
| --- | --- | --- |
| **Claude subscription** | The login your `claude` CLI already has. | Nothing. |
| **Anthropic API** | Pay per token on an Anthropic key. | The **API key** box. |
| **Anthropic-compatible endpoint** | A gateway that answers in the Anthropic format — OpenRouter, LiteLLM, a company proxy. | The **base URL**; a key only if that gateway asks for one. |

**You only see the boxes your pick uses.** The endpoint is the one pick the board won't save without
its box. A key is never demanded — you can write one into `docs/kanban/.env` by hand at any time.

**Your pick decides the whole environment a run starts in.** It sets what it needs and clears
everything else that could send Claude Code somewhere: the other providers' variables, and the ones
for providers this board doesn't offer yet (Bedrock, Vertex, Foundry). So an `ANTHROPIC_BASE_URL` you
exported in your shell months ago can't quietly route a **Claude subscription** run through a
gateway. Your cloud credentials themselves — `AWS_PROFILE`, `GOOGLE_APPLICATION_CREDENTIALS` and the
like — are left alone: the agent may need them for the work it's doing in your repo.

**Changing your mind costs nothing.** The base URL and the key stay in their boxes when you pick
something else. **Defaults keep an existing board running as it is**: a board that never picks
anything runs on the subscription, and one whose `.env` already holds an Anthropic key reads as the
Anthropic API instead.

**There is no "OpenAI" entry, on purpose.** Claude Code speaks the Anthropic API and nothing else. An
OpenAI model reaches it through a gateway that answers in that format — the endpoint entry. To run
Codex on an OpenAI account, pick Codex.

The other four agents have no provider list: each runs on whatever login its own CLI has, plus the
optional key where it takes one, and their runs inherit your shell environment. OpenCode is the one
that reaches every provider by itself — you pick that provider in its model id.

### Testing the connection

**Test**, at the bottom of the Agent section, answers one question: does this setup actually run?
Without it you only find out on the first card run that fails — the CLI isn't logged in, the key was
revoked, the gateway is down, the model id is wrong.

It sends one tiny message — "Reply with OK and nothing else." — through the agent, spawned exactly
the way a card run is: the same command, the same environment. So a test that passes is a card run
that starts. Nothing reads the answer; that the agent answered at all is the pass. **It tests what is
saved**, not what you have half-typed — every box saves as you change it, and Test stands down while
a provider pick is still waiting on a box.

What the panel under the button says:

- **Passed**, with how long it took.
- **Failed**, then the agent's own words, with nothing written on top of them — "Not logged in ·
  Please run /login", "API Error: 401 API key is invalid", "Unable to connect to API
  (ConnectionRefused)".
- **The CLI isn't installed** is the one case the board puts in its own words, because
  `spawn claude ENOENT` tells you nothing. It names the command that's missing and the one that
  installs it.
- **No answer after a minute** and the test gives up and reports that.

A test costs a few tokens on a paid provider — the line beside the button says so. It is not board
work: no card is touched or locked, nothing joins the queue, and it never shows in the **Sessions**
panel. Close the dialog and the result is gone.

### Keys

Keys live in **`docs/kanban/.env`**, next to `ui.config.json`. That is the only place the board keeps
one — never `ui.config.json`, never a shell profile. There are two ways to set one, and they agree:
type it into the Configuration dialog and press **Save**, or write the line yourself:

```
ANTHROPIC_API_KEY=sk-ant-…
```

Plain `NAME=value` lines, one per line. Blank lines and `#` lines are skipped, and a value in quotes
is read without them. The board reads the file for *which* keys it holds, so a key you write by hand
shows in the dialog as set and works in the next run — no restart. Saving from the dialog rewrites
that one line and leaves every other line, comment and ordering alone.

**The file is kept out of git.** `docs/kanban/.gitignore` carries `.env` — written when the board is
made, and added to an older board when you re-run `kanban init`, and made sure of when you save from
the dialog. A `.gitignore` already there gets the line added, not replaced. Commit that `.gitignore`;
never commit the `.env`.

**A saved key is never shown back.** The box hides what you type, and once saved the dialog says the
key is set, with **Replace** and **Clear** beside it. The key is never on screen, never in a run's
log, and never on a command line.

**What a run gets.** When a run starts, the board sets the variables from `docs/kanban/.env`. On
Claude Code the key goes out under the variable its provider uses, and only that one:
`ANTHROPIC_API_KEY` for the Anthropic API, `ANTHROPIC_AUTH_TOKEN` for a gateway — which is what
OpenRouter, LiteLLM and the rest read. A gateway run also gets `ANTHROPIC_API_KEY` explicitly empty,
because Claude Code reads a key there as its own login and turns your claude.ai connectors off when
it finds one. On the **Claude subscription** a saved key isn't sent at all. The keys sit side by side
in the file, so switching agents or providers never touches any of them.

### `ui.config.json`

```json
{
  "harness": "claude-code",
  "harnessSettings": {
    "claude-code": {
      "provider": "subscription",
      "model": "claude-opus-5",
      "reasoning": "high"
    },
    "codex": {
      "model": "gpt-5.1-codex"
    }
  }
}
```

`harness` is the agent that runs: `claude-code` (the default), `codex`, `cursor`, `opencode` or
`dsh`. The name decides everything about how that agent runs — the command, the flags that make it
stream into the live log, the env vars, the flags **Resume** uses, and how a prompt calls the skill.
If the file names an agent this UI doesn't know, Claude Code runs and the dialog says so.

`harnessSettings` holds every agent's settings under its own name, whether or not it is the one
running, and only the running agent's block is read. Switching agents changes `harness` and touches
nothing else, so trying Codex for an afternoon leaves your Claude Code model, provider and endpoint
waiting where you left them. Inside a block, each key is one of the settings that agent takes — the
same ones the dialog draws, under the agent's own name for it — OpenCode's reasoning effort is
`variant`, not `reasoning`. Nothing here is checked: a wrong model id makes the run exit right away
with the reason in its log, and a reasoning level the agent doesn't know makes it say so and run at
its own default. A key no agent declares is left exactly where it is, and saving in the dialog writes
the one setting you changed and touches nothing else in the file.

`specAgents` holds the spec agents you have switched off — `{ "technology-selection": false }`. A
name the file doesn't carry is on, and switching one back on drops its line rather than writing
`true`, so the file only ever records what somebody turned off.

`provider` is who pays for the run: `subscription`, `anthropic-api` or `endpoint`. Leave it out and
the board picks for you — `anthropic-api` on a board whose `.env` already holds an Anthropic key,
`subscription` otherwise — and a value this UI doesn't know reads as that same default. `baseUrl`
goes with the `endpoint` pick and is the only setting the board insists on.

To run a custom binary of an agent, or add flags to it, add a `command` to that agent's block by hand:

```json
{
  "harness": "claude-code",
  "harnessSettings": { "claude-code": { "command": "/my/bin/claude -p --model opus" } }
}
```

`command` is a path or flags **for the agent whose block it is in** — not a way to run a different
one; another agent's binary would reject the flags the harness adds on top. If the override already
names a setting's flag — a `--model`, say — it wins, that setting is not added on top, and the dialog
says the field isn't in effect.

Each run reads the settings once, when it starts, so flipping the picker while an agent is working
changes what the next run spawns. Each run also records the agent it ran under, so **Resume** only
ever offers to continue a run the agent you have picked can actually reach.

### The spec agents

**Agents** lists the spec agents this board ships. A **spec agent** is a named agent the board puts
on a card to fill one part of that card's spec: **UI design** draws the screen the card changes,
and **Technology selection** picks the library it leans on. Each one runs on its own, while a card is
being planned — never while it is being built — and writes one section of that card and nothing
else.

The pane lists them in the board's own order, with one readable name and two lines each: what that
agent fills in, and the kind of card the board calls it for. The command/file identifier is not
repeated in the UI. Both descriptions come from the command, so this section and `akb spec` can
never say different things. There is nothing to edit here and no way to put an agent on a card by
hand: that is what the board does for you.

Each agent has one switch, on until you turn it off:

- A switched-off agent is greyed and reads **Paused** beside its switch. The switch still works — that
  is how it goes back on.
- While it is off the board starts no new run of it, on any card. It leaves the list a planning flow
  picks from, and a flow that asks for it by name is turned away and plans that part of the card
  itself.
- The switch is saved with the board, so everyone working on it reads the same one, and a flow run
  from a terminal reads it too.
- An agent already running when you switch it off finishes its run, and whatever a spec agent
  already wrote on a card stays there.
- `akb spec`, typed in a terminal, still names a switched-off agent in a closing line, so an agent
  that stopped appearing is never a mystery.

Every agent is on until somebody switches one off, so a board set up before this shipped has all of
them on with nothing to undo.

### The coding agent skill

Getting a board does not bring this with it. A new board is `docs/kanban/` and nothing else, and
every button here runs without it. What it adds is a second way in: you can say *"add a task"* or
*"what's next"* to your coding agent in your repo and it works this same board — the same cards, the
same runs, the same files.

**Configuration → Setup** is where you turn that on. The pane says where the project stands and one
button does the rest:

- **Not installed** — nothing in either folder. **Add the skill** writes it.
- **Installed** — the version in each folder, beside the version this board runs on.
- **Out of date** — a folder written by an older release. The button says **Update the skill**.

Under the button it names the folders it touches — `.claude/skills/kanban/` for Claude Code,
`.agents/skills/kanban/` for the other four — and after a press it says, folder by folder, what it
wrote. Each folder gets one file, `SKILL.md`: a short note saying the board is here and that `akb`
owns it. The rules themselves live in the command, so this writes a few kB in your repo and never
runs a global install.

That is why the pane carries one more thing: an answer to the `akb` on your PATH being older than the
copy this board runs on, or missing. The note points your agent at `akb`, and every flow it follows
ships inside that command — so an old `akb` means old flows even in a project whose note was just
refreshed.

In the desktop app that answer is a second button, **Install the `akb` command**. The app already
carries the command; the button only points your system at the copy inside it, so updating the app
updates the command. It is one link at `/usr/local/bin/akb` on macOS, written with the system's own
password dialog, and the app's own folder on your PATH on Windows. Before you press it the pane names
the path it would write, and which of four things is true right now: nothing installed; installed at
that path; installed but pointing at an app that is no longer there; or that path held by an `akb`
the app didn't put there — an npm install lands there too, and the button leaves it alone. The app
offers this once by itself, at the first launch that finds no `akb`; saying no costs nothing. In a
browser, and on Linux where the AppImage has no lasting path to point at, the pane hands you the line
to copy instead.

If you never want it, you never need it. Nothing else in the board asks for it — except the two
places that hand you a line to paste into a coding agent (the first run's handover, and the setup
strip), which say the skill isn't there and offer this pane instead of a line that would reach
nothing.

## When a run fails or is interrupted

A run that stopped short — the peach dot in the sessions panel — shows a **Resume** button. It sends
one more turn into that same conversation (`claude --resume <id>`, `codex exec resume <thread-id>`,
`cursor-agent --resume <id>`, `opencode run --session <id>`, or the same dsh session reopened with its
history), so the agent picks up where it stopped instead of starting the task over. Nothing is copied
and you never see an id.

Two things stop a run short, and the log says which. It **exited** with a non-zero code: the agent
gave up, and the reason is in its output. Or it was **interrupted**: the board was still running it
when the UI server died, so the agent ended out of our sight. An interrupted run is never shown as
finished, and its duration is marked `~` because it's an upper bound.

Resume is a normal run — its own live log, on the same card and the same action as the run it
continues. The card lock still holds, and a resumed run can be resumed again if it fails too. It
**takes the place** of the run it continues: the row it started from disappears, marked `resumed`, so
the panel keeps one row for the work rather than a chain of dead attempts. That also drops the old
run's log, so read anything you want from it first.

Only a run that stopped short offers it. A run that passed has nothing to continue, a run you stopped
yourself is over rather than short, and a run whose conversation the agent can't reach — it never
reported an id, or a different agent is picked now — shows no button rather than one that could only
fail. If the conversation itself has expired, the resume ends as a failed run with the reason in its
log.

## When it finds no board

Start the UI somewhere with no board and the page says **There is no board here**, and names the
folder it searched. It takes over the whole screen, and the terminal says the same thing when the
server starts. Two things it could be, and the page gives both:

- **This repo has no board yet.** Make one — run `npx ai4kanban install` in the repo root.
- **This is not the repo you meant.** Stop the UI and start it from your repo root, or point it at
  the repo: `npx ai4kanban-ui --board /path/to/repo`.

The UI never sets a board up for you. Install one in a terminal, switch back to the tab, and the board
is there — no reload.

A board that exists but has no copy of the board's rules to read it with is its own page too: **This
board can't be read**. The rules live in the `akb` command, not in your repo, so the line it hands over
is `npm install -g ai4kanban`. In the app there is nothing to run: it carries its own copy, and
reopening the project picks it up.

A board that exists but has a card the UI can't read still opens, with the error in a strip above it.

## Run it from source

Only if you're changing the UI itself. Build, then start the production server (not `next dev` — run
the app the way it ships):

```
cd kanban-ui
npm install                 # first time only
npm run build
PORT=7420 npm run start     # http://localhost:7420
```

To reproduce the exact `npx` package (standalone server): `npm run build:standalone` then
`node bin/kanban-ui.mjs`.
