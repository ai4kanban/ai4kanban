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
- **Insights** (the chart) — two read-only charts, a tab each: **Daily progress** and
  **Planning quality**; see below.
- **Configuration** (the gear) — see below.
- **Chat** — a conversation about this project that also does the board work, in a rail down
  the right; see below.

### Reading a card

A card is written in two halves. The top one is what a person has to read — what the task
does, and what is worth accepting or refusing about it. Under it, in a block of its own
reading **what the agent worked out**, is the half the builder needs: the scope, the todo
list, and the calls the agent made on its own.

It opens shut, and one click opens it in place — same page, nothing hidden away in a tab.
Every card page opens shut again, every visit: nothing about the fold is remembered, so a
card always reads the same way when you come to it. Opened, that half reads in a quieter ink
than the half above it.

Cards written before the two halves arrived carry no boundary, and those show their whole
body exactly as they always have — no control, nothing folded.

### Checking a card by hand

A build often ends with something only you can confirm. Those land on the card as
hand-checks, in a **check by hand** panel above the body, and the board card counts them
with a clipboard mark.

Cross one off with the **✕** beside it once you have done the check. It asks for a second
click first, because crossing off takes the line off the card and there is no way back from
this screen. A line a run has already taken off says so and the panel redraws to what the
card holds now.

You cannot write one here: hand-checks come from the spec the board clarifies, and a card
with none shows no panel.

Crossing off saves the moment you act and starts no run. It is off while an agent is
working the card. A card with hand-checks still open still archives — they are notes on
finished work, not a gate.

### Finding a card

Down the left is the **rail**: **All cards** at the top, which is the board, and under it every
card this window has opened, each one closeable. Drag its right edge to make it wider.

Above those rows is a **Find a card** box. Type part of what you remember and the rail lists
the cards that carry it, in their titles or anywhere in their bodies — case makes no
difference, so `ui` finds a card that says `UI`. Click a match to open it. It searches every
open card, including a group's subtasks, which the board's columns don't show. It never reaches
the archive. Matches scroll inside the rail, nothing matching says so, and clearing the box
(the **×**, or Escape) puts the rail's own list back.

When the word you typed is on the card only below the boundary, opening that match opens the
agent half with it, so a search never lands you on a page with nothing it found. That is for
that one visit: reloading the page, or reaching the card any other way, opens it shut. In a
browser, the window's own Find (⌘F) also opens the shut half and
lands on the word inside it — the desktop app has no Find of its own, so there the **Find a
card** box is the way to a word only a folded half holds.

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
- **Keep typing while a reply is coming.** The box stays live, so a thought that arrives
  mid-reply goes into it instead of being held in your head. Only sending waits — Enter does
  nothing and the corner button can't send — and the moment the reply lands you press send
  yourself. Nothing is ever sent on your behalf, and there is no queue.
- **The box grows with what you type**, to about eight rows — fewer on a window too short to
  leave the conversation a few lines above it — and scrolls rather than growing past that.
- **Up-arrow brings back what you last sent.** In an empty box it walks back through this
  conversation's own messages, down-arrow walks the other way, and typing ends the walk.
  They come from the transcript, so they survive a reload and take in what you sent from a
  terminal — and another card's chat offers its own.
- **Stop a reply that went the wrong way.** While one is coming, Send is **Stop** — one
  click, or Esc, and it ends there. What arrived is kept and the next message carries on
  from it; nothing is undone, and the message you stopped is not put back to be reworded.
  Esc stops it only when nothing is over the chat — a dialog, a panel or a menu keeps the
  key. A reply `akb chat` is writing is the terminal's own: the chat follows it and the box
  still takes typing, but the corner button stays a greyed Send, and Ctrl-C in that terminal
  is the way to end it.
- **See what the agent did, if you want to.** Everything a reply took before answering folds
  into one line above it — **Worked for 1m 5s** — and clicking it opens what the agent did in
  order: its notes as it went, and each file, card or search it touched. While the reply is
  still coming the line counts up and the step it is on stays under it, so the rail never goes
  quiet mid-answer. A reply that took no steps has no line.
- **Every reply says what it cost.** Under it, in grey: the tokens the turn used and the price
  the agent put on them — `1,840 tokens · est. $0.03`, the same estimate a run shows, worked
  out from tokens at list prices rather than billed. An agent that reports neither leaves the
  line out; nothing is estimated in its place, and the time is on the fold above rather than
  said twice.
- **Get back to the newest line.** Scrolled up to read an older answer while replies keep
  arriving, a pill says how many are below — **↓ 2 new lines** — and one click takes you to
  the foot. It is not there when you are already there.
- **Copy an answer without selecting it.** Hover a reply — or tab to it — and a quiet
  **Copy** appears under it. It copies what the agent said, without the steps it took on the
  way and without the app's own note that you stopped the reply. A fenced code
  block in a reply carries the same button in its corner.
- **Send a message again.** A reply that stopped short or came back with nothing gets
  **Send again**: one click sends that message again, and the answer lands at the foot with
  the old exchange untouched. A reply that finished doesn't get the button — the agent
  carries its own session on, so asking again would be asking twice. It waits while a reply
  is coming, the same way the box does.
- **Reword what you sent.** Every message of yours gets **Reword**, not only the last: it
  puts those words back in the box to edit. What is already typed is never overwritten —
  the button asks once first, the way the bin does.
- **Copy the whole conversation.** The copy button in the chat's own header takes the
  exchange as markdown, who said what in order, with the steps left out here too.
- **Folding it doesn't stop it.** The reply keeps arriving, and the Chat button marks that
  there is something to read.
- **It keeps.** The exchange is still there after the app is closed and reopened, and it is per
  project. The bin in the chat's own header clears it, and asks once before it does.
- **Pick the agent and the model for this conversation alone.** On the box's own bottom row,
  beside Send: the agent as its mark, and the model beside it. Both start on the board's, and
  what you pick sticks to this conversation until you change it — the board's settings are
  untouched, every run still takes them, and another chat is unaffected. The ↩ beside them is
  there only while one of them differs, and puts the conversation back on the board's pair.
  - **The model is typed in**, the way the Harness section takes one, because ids change
    between agent releases and a list of ours would go stale. The caret offers what you have
    typed for that agent lately, the board's own among them; empty runs the agent's default. A
    wrong id fails in the conversation, in the agent's own words, and the box keeps what you
    typed. Changing it carries the same conversation on — the next message runs on it, and the
    transcript marks where it changed, so a reply is read against the model that wrote it. An
    agent with no model setting shows no box.
  - **Switching the agent starts the conversation over**, because a transcript cannot move to
    a CLI that never opened its session. The list says so and asks once, the way the bin does;
    a conversation with nothing said in it just switches. It waits while a reply is coming.
    Only the agents that can hold a conversation are offered, and one whose CLI isn't here
    still can be — it reads **not installed**, and the message is what fails.
  - **A conversation that picked its own agent keeps it** when you change the board's, rather
    than being refused. One that never picked still follows the board, and is still told to
    clear itself when the board moves to another agent.
- **It is the same conversation as `akb chat`.** What you say here and what you say in a
  terminal land in the same place, and the pick travels with it — `akb chat --model <id>` and
  `akb chat --agent <name>` set the same thing from a terminal.

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

### The archive

Under the Memory row, at the foot of the rail, is **Archive** — every card that has been
finished, in `docs/kanban/.archive/`. Nothing archived shows anywhere else: not in the
columns, not in the release picker, not in the search box. The row carries no count, so the
board looks the same until you click it.

Click it and the list opens in the body, newest first. One row per card: its number, its
title, the release it shipped in, and the day it was archived. A card that named no release,
or that left the board before the board stamped a date, leaves that cell empty rather than
guessing one.

The board started stamping that date with this view, so the dates fill in from here rather
than all at once — nothing is backfilled. Where they run out, a line says so: everything
under it was archived before the board kept a record.

Click a row and the card opens whole, read the way its page read while it was open — the
body, with the agent half folded under it. **It is read-only.** Nothing un-archives, edits,
or starts a run: archiving is the end.

Both are pages of their own, so Back, Forward and a reload keep you where you were, and the
rail's Archive row stays highlighted while you read. The list re-reads itself when a run
finishes and when you come back to the window, so a card an agent just archived is at the
top of it. A board that has archived nothing says so.

### Mockups on a card

A card that changes a screen can carry **mockups** of it — small files under
`docs/kanban/.mockups/<card id>/`, each drawing one layout the card could take. The card body
points at each one with a tag on a line of its own, and the card page draws the screen that file
holds where the tag sits, so you pick a layout by looking at it. The `ui-design` agent writes
one by default and alternatives only when explicitly requested; only a card page shows them,
and the card file is never written to.

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

**Which of the two styles `ui-design` draws in is the board's Mockup style setting**, under
Configuration → Agents (`mockupStyle` in `ui.config.json`). It is board-wide, so a card carries
one style throughout. It starts at the rendered screen above; the other choice is a **plain-text
drawing**, which costs a much shorter run and reads as itself in a terminal, at the price of the
product's own look.

A plain-text drawing is **not a file**. It is written straight into the card, as a block under a
heading naming its layout, and shown exactly as the card holds it — nothing points at it, nothing
opens it on its own, and a window too narrow for it scrolls sideways rather than breaking its
columns. Because it is in the card, it travels with the card through git.

### Insights

The header's chart button opens **Insights**, which holds two charts, one per tab — they answer
different questions, so neither is read past to reach the other. It opens on Daily progress.
Both only read what the board has already written; neither ever writes.

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

A board whose installed `akb` predates these scores says so in one line, inside this tab; Daily
progress is still drawn in its own.

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
for, since the release's line is gone. Afterwards the board shows **All releases**.

The close then starts an agent that writes the version's **changelog** — a few plain lines
saying what it changed — at the top of that same section. The dialog says which of the two is
coming before you confirm, since a version that shipped no card gets no changelog. The run
shows in the runs panel like any other, the close is finished whatever it does, and if it
can't start or doesn't finish the board says so and names `akb changelog v1` as the way to get
the changelog after all. Reading that changelog is still a matter of opening the file; the
board shows the run, not the text. Nothing else edits that file — fix a wrong line in your own
editor.

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

A board whose setup is unfinished opens on a short guided run instead of the columns. One full
window per step, one thing asked in each:

1. **The agent** — which agent every button on this board runs, with the same picker, settings and
   **Test** the Configuration dialog has. It comes first because everything after it is that
   agent talking, and nothing is ever run before you have chosen one. This step can't be pressed
   past: **Test and continue** sends one call through the agent you picked, and moves on only if
   it comes back.
2. **The project** — a conversation, not a form. The agent reads your repo — README, package
   files, folder shape, recent commits — and comes back with one sentence saying what it thinks
   this project is and what tracks its work falls into, starting from whatever `config.md` and the
   folders under `docs/kanban/todo/` already hold. While it reads you get a turning arc and one
   line, never a list of the files it opened. **Yes, that's it** writes the answer; a correction
   in the box under it sends it back to read again. Nothing reaches disk before you press Yes, so
   no guessed track leaves a folder to delete. On a repo with nothing to read the same view says
   what little it saw and asks you outright — no guess is dressed as a finding.
3. **The goal** — an empty box on `memory/goal.md`, in your own words, with the longer guide beside
   it. It is asked and never drafted: the agent will not put words in this box, not its own and
   not the repo's. **I'll write it later** leaves it for later.

The conversation is not a run. It is the chat the board already holds with its agent, so it takes
no place in the runs panel and writes no log — and nothing resumes one that went wrong. When a
turn fails, the view shows what the agent said, verbatim, and the line **Nothing was written**;
**Try again** starts the conversation over, and the board never explains how to log a harness in.

**I'll fill it in myself** is on every view. It goes to the project and goal screens this run
always had — boxes for the name, what it is and the tracks, and a box for the goal — carrying
whatever the conversation had already settled. Choosing it is not an answer and is written
nowhere; the conversation is not offered again while that window is open, and a board reopened
later starts on it as usual. It is also how a machine with no agent CLI at all still answers what
it knows: the agent step can't be pressed past to finish setup, so the run keeps reopening until
an agent has answered a test.

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
reads `$kanban. Set up this board …`, and on Cursor, OpenCode, Kimi Code, DeepSeek Harness, ZCode
and Grok Build it asks for the skill in a sentence. Copy it and paste it as it comes. It is on the closing
screen and on every screen behind **I'll fill it in myself**, under **Rather set this up from your coding agent?** —
setup picks up at the first unticked box, so nothing you answered here is asked again.

That line only works once the coding agent skill is in the repo, and a board arrives without it.
Where there is none, both places say so and hand you the one command that adds it —
`npx ai4kanban@latest skill install`. **Finish setup** needs none of it: the run the board starts
is given the board's own command directly.

**Go to the board** leaves the run for the columns at any step, and the board then carries a strip
saying how far setup got with **Continue setup** on it. The run is remembered in
`setup-checklist.md`, so closing the window and coming back lands on the same screen — and the run
stops opening itself once the agent is picked and the project is written, so a goal left for later
does not reopen it. The strip stays until setup is finished, carrying **Finish setup** and
**Finish in your coding agent** beside it — or, on a repo with no skill, **Add the coding agent
skill**. Before setup ends the skill creates no cards at all: ask it for one and it tells you to
finish setup first. The last box creates three initial cards and deletes the checklist. Setup
then closes while a separate refinement run starts for each card in the background.

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
| **Resolve** | Only when the card has open questions — including while a delivery is waiting on you. |
| **Review again** | Only while a delivery has stopped and is waiting on the question its review left. |
| **Continue delivery** | Only when a delivery's next session never started — the process watching the last one died. |
| **Archive** | Once every todo is checked (a group root: once every subtask is resolved). Never on a recurring card. |
| **Reject** | Always. |

A card can only have one session at a time; while one is going the button is off and the badge
beside the title says what's going on. A session outside a delivery never commits — it leaves its
changes in your working tree, and you read `git diff` and commit. A **delivery** works differently:
see **Where a delivery's code goes** below.

### Delivery

**Implement** starts a **delivery**: the whole job, from the click to the finished work. A delivery
is usually several **sessions** — one agent invocation each — and it has an id you'll see on the
card, in the activity panel and in `akb runs`. Every other button is a single session and starts no
delivery.

- **One click carries the card all the way.** The build is one session; a fresh session then
  judges it against the card you approved, and corrects it if it has to — see **Review** below.
  Once review passes, the board lands the work on your branch as one commit — see **Landing on
  your branch** — and then archives the card. Nothing asks you again in between, unless the board
  requires diff approval: see **Approving a delivery**.
- **What you are approving is the card**, not the diff: what it should achieve, what to weigh,
  its open questions, and what building it turned up. All four are on the page, unfolded, before
  you press Implement.
- **The dialog says what the click will do**: the steps in order and the branch the change will
  land on. **Build this on a branch of its own** is the tick under it, and the sentence rewrites
  itself as you toggle it — see **Where a delivery's code goes**.
- **It builds the card as you approved it.** The delivery copies the card's requirements — the
  title, the opening paragraph, **Worth noting**, **Scope**, **Scope out** and each agent-written
  spec section — the moment it starts, and every session inside it builds from that copy. Edit the
  card file in your own editor afterwards and the delivery carries on with what you approved.
- **The card is held while one is in flight.** Edit, Refine, Resolve, Archive and Reject are off,
  on the card page and in the terminal, and each says which delivery has the card. The one
  exception is a delivery that is waiting on you — whatever it is waiting for: **Resolve** comes
  back on there, because answering is the way on. Priority, ROI,
  release and modules stay editable — no delivery builds from those. So does **Todo**: the delivery
  ticks its own boxes as it works, and a box you tick reaches its next session.
- **One control at a time in the delivery block.** While a run is live the only control is **Stop
  run**: it ends that run where it is and nothing else, and the delivery keeps the card. Once
  nothing is running, **Resume** and **Discard** take its place — carry the delivery on, or end it.
- **Discard** is the one way out of a delivery, and the one control that throws work away. The
  delivery ends, the card unlocks, Implement comes back, and the worktree and branch it built in
  are removed. The confirmation names them first. A delivery working in your project folder has
  neither, so it leaves your own tree alone.
- **A session that fails or is cut off does not end the delivery.** The card stays held and the
  card page still says so, so **Resume** picks the delivery up rather than starting a second one —
  one delivery id across both sessions. **Discard** is the other way out.
- **Every delivery leaves a record**, one JSON file under `docs/kanban/deliveries/`: its id, the
  card as it was approved for it, each session and how it went, every review verdict and its
  findings, and how the delivery ended — finished, stopped or cancelled. It is tracked in git and
  kept after the card is archived.
- **In a terminal**: `akb discard <delivery-or-card-id> --yes` is the same thing as the button.
  `akb cancel <delivery-or-card-id>` is the half of it the UI does not offer — it ends the
  delivery and leaves its worktree and branch on disk, for when there is something in there to
  salvage. `akb runs` names the delivery each session belongs to. `akb implement <id>` starts the same delivery the
  button does, and warns about an open question the same way it warns about a blocker.

#### What the card page says while a delivery runs

The delivery's state rides the title band as a pill, where the stage and schedule pills already
sit, with one line under it naming what the delivery waits on and what answers it. A delivery
that is simply building gets no line: the pill has said it, and prose is kept for what you have
to act on.

| Pill | What it means |
| --- | --- |
| **Delivery in progress** | It is building or reviewing. Nothing is waiting on you. |
| **Held at landing** | Built and reviewed, holding until the card's open questions are answered. |
| **Waiting for your approval** | Built and reviewed, holding until you approve the tree it would land. |
| **Waiting for your commit** | Manual commit mode: review passed, and the commit is yours to make. |
| **Code changed after review** | You committed something other than what review passed, so it is being reviewed again. |
| **Landed as `abc123`** | Its commit is on your branch, and the board is taking the card off. |

- **A pause has nothing to press.** What continues it is the answer, the resolve or the commit —
  the delivery picks itself back up, with no second click. **Waiting for your approval** is the
  exception: that one has a button, on the **Approval** tab.
- **An answer that changes the plan starts a fresh delivery** on the card as it now reads, and the
  page says so. Changed means the approved requirements changed; answering a question is not a
  change of plan, and neither is a note review left under **Worth noting after implementation**.
- **The block under the buttons is the delivery's.** A **Diff** / **Log** / **Approval** tab strip
  over it, and a foot naming the delivery, how it commits and where its code is. A card with no
  delivery keeps the plain session log. Each tab appears with the thing it holds: **Diff** once
  there is one to draw, **Approval** only on a board that requires it.

#### The Diff tab

What the delivery changed, so you can read the result rather than take it on trust. Nothing here
changes anything: it is a read. Nobody has to read it either, unless the board requires diff
approval — see **Approving a delivery** below, which is the one policy that asks.

- **The size line leads.** Files changed, insertions and deletions, on one line above the diff.
- **The changed files are a tree** down the left, each with what it added and removed. Picking one
  jumps the listing to it, and scrolling the listing moves the mark — so forty files stay findable.
  Hide the tree when you want the width back.
- **Each file is a section**: its path, whether it is new, deleted or moved, and its counts, in a
  header that stays put while its hunks pass under it. Collapse one you have read; collapse them
  all and the listing becomes a table of contents.
- **Every line is numbered on both sides**, before and after, and the numbers stay pinned to the
  left edge while a long line scrolls under them.
- **While the card builds**, it is the delivery's own branch against the commit it forked from,
  read in its worktree. **Log** opens first while a delivery is live — the diff is not finished
  being written.
- **Once it has landed**, it is the squash commit against the branch tip it landed onto, read in
  your project. That is also the commit to revert if the card has to go: landing squashes, so
  reverting a card is reverting one commit.
- **In manual commit mode** it is a snapshot of your working tree, marked **uncommitted**, with
  the files git has never seen counted in — nothing has been committed yet, and a new file is
  often the work itself.
- **A long diff is cut off**, with the `git diff` command that prints all of it named underneath.
- **A case the view cannot show** — no git, a worktree someone removed, a commit that is no longer
  in the repository — is one plain line saying so. The tab does not appear at all when there is no
  diff to show.

#### Approving a delivery

Turn **Approve diffs before landing** on in Configuration → General and nothing
lands unread. Every delivery that got a branch of its own is built and reviewed as usual, and then
waits for you to approve the exact tree it would land — however that branch was chosen, so the
switch is settable with automatic Git commits off too. Off by default: requiring it on every card
puts you back in the loop for every change, which is what auto-delivery exists to remove.

- **The card reads Waiting for your approval**, and the delivery block opens on **Diff** — the tree
  is the thing to read, and the **Approval** tab beside it is where you sign it off.
- **Approve this tree** is on that tab, with one line saying what the approval covers: the commit
  the delivery was built on, and the fingerprint of the tree built on it.
- **It holds outside the landing queue** while it waits, taking no slot, so every other card still
  lands past it.
- **An approval covers one tree.** Change the tree, or the commit it was built on, and the approval
  is cancelled and the delivery waits again — a rebase onto a moved target branch does both, so a
  landing that gets rebased asks you again. The board re-reads both immediately before it moves
  your branch, so nothing lands on an approval that stopped being true in between.
- **The setting is frozen when the delivery starts**, the way its commit mode is. Turning it off
  does not release a delivery already waiting; **Discard** is the way out of one.
- **The delivery record keeps every approval** — what each one covered, and every cancellation
  with which of the two moved.
- **In a terminal**: `akb approve <delivery-or-card-id>`, beside `cancel` and `discard`.

#### Building a card with open questions

The Implement dialog warns, and you can go ahead — you know things the board doesn't.

- **It is built and reviewed all the same.** An open question is not a reason to refuse a build;
  it is a reason not to land one.
- **It holds at landing** until nothing is left to answer, and takes no landing slot while it
  waits, so every other card still lands.
- **Resolve & implement** under **open questions** is the other way: answer first, and the card is built
  once nothing is left for you to decide.

### Where a delivery's code goes

**Build this on a branch of its own** is a tick on the Implement dialog, and it settles this one
build. It opens on the side **Automatic Git commits** picks and never writes back to it, so
the setting stays the default every Implement starts from and one card can go the other way without
moving it for the rest. The paragraph above the box rewrites itself as you toggle it: the branch a
ticked build lands on, or that nothing is committed for you.

Ticked, a delivery builds in a **git worktree of its own** — `.akb/worktrees/<card>/<delivery>` — on
a branch of its own, `card/<card>/<delivery>`, forked from the commit your checkout was on when you
pressed Implement. `.akb/` is added to your `.gitignore`, so none of it is ever committed. Unticked
is **manual commit mode**, below.

- **The box is only there when a worktree is possible.** With no git, no commit to fork from, or a
  detached HEAD there is nothing to choose: the build is manual, and the paragraph says which of the
  three is why. A detached HEAD builds this way rather than being refused — the commit you then make
  is reachable from `HEAD` alone.
- **Only the Implement button carries the tick.** **Schedule** and **Resolve & implement** start a
  build later, and each reads **Automatic Git commits** as it stands then; so does
  `akb implement` in a terminal.

- **Several deliveries at once.** Each one has its own full checkout, so two cards that touch the
  same files never write over each other, and neither one touches the edits you have open.
- **A delivery won't start on uncommitted work.** It forks from your last commit and never copies
  what you have not committed, so commit or stash first. The board's own files changing doesn't
  count.
- **The board's own files stay out.** `docs/kanban/` and `.akb/` are not checked out into a
  worktree, and a commit that reaches one is refused. The card, its todos and the delivery record
  are all changed in your project folder, as they always were.
- **The board commits each session's work** onto the delivery's branch, so review reads a settled
  tree rather than a half-written one. Nothing reaches your own branch.
- **Discard** on the card page removes the worktree and the branch, and everything only they hold.
  It says exactly what will be lost and asks for a second click. It is the one control here that
  throws work away — nothing removes a worktree on its own, and `akb cancel` deliberately does not.
- **If a worktree or branch goes missing**, the card page says so and nothing is rebuilt: discard
  the delivery and start the card again.

#### Landing on your branch

Review passing is not the end. The board then **lands** the delivery: one squash commit on
the branch you were on when you pressed Implement, named after the card. The card reads
**Landed as `abc123`**. Nothing is pushed anywhere — landing ends on that branch in your own
repository.

- **One card lands at a time**, however many are building. A card that is ready waits its
  turn, and the wait is on the card page.
- **Your own uncommitted work blocks it**, the same way it blocks starting. The delivery
  waits safely on its branch and holds nothing up; commit or stash, and it lands by itself.
  A staged file blocks it too — landing moves your branch under you, and it will not do that
  over a half-built commit. The board's own files under `docs/kanban/` never count, staged or
  not: they change as every card moves, and no landed commit contains one.
- **Your working tree follows the branch.** When the target branch is the one you have out,
  the board fast-forwards it in your own checkout, exactly as a `git pull` would. When it is
  not, only the branch moves and your checkout is left alone.
- **A target branch that moved is rebased onto and reviewed again.** That costs one more
  review, and it is the only way the tree that was judged is the tree that lands. After
  three rebases on a branch that keeps moving, the card gets an open question instead.
- **Two cards touching the same files is a warning, not a block.** Landing goes ahead, and
  the overlap is recorded on the delivery. A real conflict is resolved as new work by an
  agent that reads both cards, both diffs and the checkout, and its result goes through
  review from scratch. If it stays unclear, the card gets an open question explaining the
  conflict and its branch is left whole.
- **A card with an open question waits outside the queue** until it is answered, taking no
  landing slot while it waits.
- **So does one waiting on your approval**, on a board that requires it — see **Approving a
  delivery** above.
- **The worktree and branch are removed once it has landed**, the delivery ends, and the board
  archives the card — the last step of the click, never an earlier one. A landing that changed
  nothing names no commit and archives the card all the same.
- **The delivery record keeps the landing**: the commit, the base it landed against, the
  checks that ran, and any overlap. It outlives the card.

#### Manual commit mode

Untick **Build this on a branch of its own** — or turn **Automatic Git commits** off in
Configuration → General, which is what the box opens unticked — and the delivery works in your
project folder instead. The setting is saved with the board, in `docs/kanban/ui.config.json`, so a
team shares one answer; a change applies to deliveries started afterwards, never to one already in
flight, and so does the tick.

- **One delivery at a time**, from a clean tree — an uncommitted or untracked file blocks the
  start, because review would read it as the delivery's own work.
- **You commit, after review passes.** The board saves what review passed; commit that in your own
  checkout and the delivery is done and the card is archived. Commit something else and it goes
  back through review, and the card reads **Code changed after review** until it has.
- **A project with no git, with no commit yet, or on a detached HEAD always works this way** —
  there is nothing to branch from, the dialog offers no box, and it says which of the three is why.
- **Nothing lands.** The commit is yours, and the delivery ends on it — see
  **Landing on your branch** above for what auto commit mode does instead.

### Review

The build is not the end of a delivery. A **fresh session** judges what it built against the card
as you approved it and fixes plain mistakes itself. It is one separate agent invocation per
review.

**What review is given**: the approved copy of the card, and the diff of everything the delivery
changed. It may read the repository and run the project's own checks. It is never given the session
that wrote the code — a reviewer that reads the implementer's reasoning agrees with it.

**What review answers**, exactly one of two:

- **It passes.** The work goes on to land, and the board archives the card once it has. Review
  itself never archives one.
- **It needs you.** A fix is unclear, unsafe, or requires your decision, so the delivery stops.

**What review checks**: the approved requirements and the checks this repository already has —
its tests, linter and type check. It fixes plain mistakes in the same worktree, updates focused
tests and reruns affected checks. It does not exhaustively search unaffected code or invent
hypothetical issues.

**What review does not check.** It cannot promise defect-free code, a coverage number, or that a
change is a good idea. It reads the card, so a card that says the wrong thing produces work that
passes review. It runs the checks the project has and invents none. Approving the exact diff, and
acceptance tests written from the card, are separate things a board turns on for itself.

**When it stops**, it leaves **one open question** on the card with what it found and the decision
that is yours. The delivery waits there, still holding the card. A failed, interrupted or silent
review also stops.

Then the card page reads **delivery … waiting on you**, **Resolve** comes back on while everything
else stays held, and **Review again** appears beside it. Answer the question — or write the
exception you are approving under **Worth noting after implementation** on the card — and **Review
again** judges the same work afresh. **Discard** is the other way out: changed requirements
are a new delivery, not a change to what this one was approved to build.

**Worth noting after implementation** is where review puts what it found that needs no decision: a
surprise the next card should know, a check that was already failing, a split worth making when the
card turns out to hold separate outcomes. None of it blocks anything, and it is never part of what
a delivery is approved to build.

If a delivery's next session never starts — the process watching the one before it died —
**Continue delivery** appears in the same place and starts it. Nothing is lost either way: the
delivery still says what it was about to do.

**In a terminal**: `akb review <id>` reviews and fixes the delivery in flight on a card again,
`akb conflict <id>` resolves the conflict a landing's rebase stopped on, and `akb guide review`
prints the review flow.

**Open questions** is answered where it is read. Click the panel — or **Resolve** in the toolbar,
which brings it on screen — and every question you own turns into an answer box. A question that
carries choices shows them as a tick list instead — one pick, or as many as you like, depending on
the question — with the agent's recommended ones already ticked, so agreeing is one click.
**Something else** is the last choice on every such list, and ticking it opens the box. Your answer
is either the options or your own words, never both. Leave a question untouched and the agent
researches that one itself. Click away and the panel goes back to being a read, keeping whatever
you ticked or typed.

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

- **A rough card schedules its own refine when it becomes blocked.** That mark is written when
  the card is created with blockers, or when its blocker list goes from empty to non-empty.
  **Schedule** in the Implement dialog may replace it with a build instead.
- **Nothing to tick.** Nothing starts ahead of the blocker. A card that isn't **ready** still asks
  for its "the plan may still be rough" tick before you can schedule a build.
- **The note you type goes with it** and reaches the run when it fires.
- **One at a time.** Scheduling a second action replaces the first, and the dialog says which one
  was on.
- **The card reads `pending`** in place of its stage, on the board and on its own page. Hover it
  and it says what will run and what it waits for — `implement · waiting on #57`. The card keeps
  the stage it had and stays where it is in the queue.
- **Cancel it** on the card page, next to **Scheduled**. Nothing fires after that, and changing
  one non-empty blocker list into another does not put the refine back. If the card becomes
  unblocked and is blocked again later, that new blocked episode gets the default refine again.
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

The button shows only while a refine would still move the card. It is also gone while a refine is
already scheduled for the card's blockers; cancel that schedule to bring the button back. It's
gone once the card is
**ready**, once every todo is checked, and when every open question is one only you can answer —
**Resolve** is the button for that last one. A **Blocked** card keeps the button; the dialog names
the blocker and offers both ways on — **Refine anyway** now, or **Schedule** it.

**The refine that follows a run.** A command does what you asked and stops. The board then refines
the card as a run of its own, with its own log, stoppable like anything else.

- **A run that wrote or changed a card gets a refine on it.** Add a card, change one, answer its
  questions, propose, fill a release — each card that run touched comes back refined, one run per
  card. Ask for three cards and three refines follow.
- **A blocked rough card carries the refine it will run once free.** Finishing or rejecting its
  last blocker makes that saved schedule eligible; no watcher infers the transition afterward.
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
on the log — so it never reads as a failure. **Runs** still offers **Resume** on it, because changing
your mind about a stop shouldn't cost the work already done; the card page, which speaks only about
runs that went wrong, leaves it out. Stopping the refine that
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
**General**, **Runtimes**, **Agents**, **Rules** and **Notifications**. Settings live in
`docs/kanban/ui.config.json`, next to your board, so `npx` always serves the latest UI and an update
never touches them. Everything the dialog holds writes itself there, with three exceptions: a key
goes to `docs/kanban/.env`, and the language and the Cloud sign-in settle this machine rather than
this board and are held outside every project.

A pane earns a sidebar entry by being a list too long to sit beside another. Setup, delivery and
language are five settings between them, so they are three captioned groups of the **General** pane
rather than three entries.

There is no Auto-refine section and no switch: a refine follows the run that touched the card, so
there is nothing to turn on.

### General → Delivery

Two switches. Both are repository-level answers, saved in `ui.config.json` and shared by everyone
on the board. A change applies to deliveries started afterwards; one already in flight keeps what it
started with.

**Automatic Git commits**, on by default. It is the side each Implement opens on, not the only
way to change it: the dialog's **Build this on a branch of its own** turns one build round and
leaves this where it is.

- **On** — a build gets a branch in a git worktree of its own, so several run side by side and what
  review passed is what lands. See **Where a delivery's code goes** above.
- **Off** — manual commit mode: it builds in your project folder, one at a time, and you commit it
  after review passes.

**Approve diffs before landing**, off by default. It follows whether a build got a branch of
its own, however that was chosen, so it stays settable with automatic Git commits off.

- **Off** — a delivery that review passed lands by itself. That is right for routine work, and it
  is what auto-delivery is for.
- **On** — nothing lands unread: every delivery waits after review until you approve the exact tree
  it would land. See **Approving a delivery** below.

### Runtimes, and the harness behind one

**Runtimes** is the runtimes the board names and the coding tool each one runs — all of it the
board's, so everyone on the repository reads the same answers and nothing has to be set up per
machine. A board that names no runtimes has no list: the pane is the board's own agent and its
settings, with **Add runtime** under them, and adding the first one is what turns it into a list.
Adding it keeps `default` beside the new name and stays global on it, so every flow goes on running
exactly what it ran before.

The list sets nothing. One row per runtime: its name, and the agent it runs. A runtime whose saved
agent is one this build can't run says so and names what ran instead. Pressing a row opens it.

There, the agent is what can be pressed: the square agent cards, that agent's own settings, and
**Test** — which spawns that runtime and not the board's global one. Above them are the board's
three moves:

- **Rename** carries everything held under the old name: the flows and spec skills that named it,
  and the agent it runs.
- **Make global** points the board's global runtime here — what a flow that names none runs on. The
  two runtimes swap homes and both go on running exactly what they ran.
- **Remove** names the flows and spec skills it moves onto the global runtime first, and clears their
  pointers so re-adding the name never puts them back. What it ran as goes with it. Removing the
  global runtime is refused.

Which runtime a flow or spec skill uses is **not** set here — `akb agent runtime for <what> <name>`
is where that lives, and a removal says so.

A key is the one setting that is not held beside the runtime: it writes `docs/kanban/.env`, which git
does not carry, so two runtimes on one agent share one key and the box says so. A runtime's settings
are judged by the agent *it* runs, so a runtime on Codex offers and accepts Codex's settings while
the board's global agent is something else.

A board whose `akb` is too old to answer draws the agent pane alone.

Eight harnesses ship:

| Agent | It spawns | Settings | Key | Cost | Model name |
| --- | --- | --- | --- | --- | --- |
| **Claude Code** (default) | `claude` | Provider, Endpoint base URL, Model, Reasoning effort | `ANTHROPIC_API_KEY` (optional) | yes | yes |
| **Codex** | `codex exec --json --sandbox workspace-write -c sandbox_workspace_write.network_access=true` | Provider, Endpoint base URL, Model, Reasoning effort | `OPENAI_API_KEY` (optional) | yes | yes |
| **Cursor** | `cursor-agent -p --output-format stream-json --force` | Model | `CURSOR_API_KEY` (optional) | no | yes |
| **OpenCode** | `opencode run --format json` | Model, Reasoning effort | none | yes | no |
| **Kimi Code** | `kimi --output-format stream-json -p "<prompt>"` | Provider, Model id, Endpoint format, Endpoint base URL, Model | `KIMI_MODEL_API_KEY` (endpoint pick only) | no | yes |
| **DeepSeek Harness** | `dsh-acp --permission-mode workspace-write` | Model | `DEEPSEEK_API_KEY` (optional) | yes | yes |
| **ZCode** | `zcode app-server` | Model | `ZAI_API_KEY` (required) | no | yes |
| **Grok Build** | `grok agent --always-approve stdio` | Model | `XAI_API_KEY` (optional) | yes | yes |

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

- **Provider** (Claude Code, Codex and Kimi Code) — who pays for a run and where it goes. See below.
- **Endpoint base URL** (Claude Code, Codex and Kimi Code) — the address your gateway answers on.
  Required before the endpoint pick will save.
- **Model** — the id that agent runs with, passed as `--model`. Leave it empty for the agent's own
  default; the board never invents an id. This is the board's: every run takes it, and it is where
  each chat starts — a single conversation can run on another without touching it (see **Chat**). Two agents write it differently: **OpenCode** takes
  `provider/model` (`anthropic/claude-opus-5`), because it reaches every provider and the name alone
  wouldn't say which; **Cursor** carries the thinking level inside the id, `claude-opus-4-8[effort=high]`,
  so it has no reasoning box. **DeepSeek Harness**, **ZCode** and **Grok Build** choose the model as
  the run's session opens rather than on the command line, because each carries its model catalog per
  session; ZCode also takes `zai/glm-5.3` when you want to name the provider too. **Kimi Code** takes an
  alias out of its own `config.toml` rather than a model id, and only on the sign-in pick — its
  endpoint pick names the id in **Model id** instead, so you never see two model boxes at once.
- **Reasoning effort** — how hard the model thinks. Claude Code and Codex each offer the same list in
  their own words — Low, Medium, High, Extra high (xhigh), Max — and **Agent's default** passes
  nothing. Claude Code takes it as `--effort`; Codex has no flag for it and takes
  `-c model_reasoning_effort=…`, passing the level straight to the API, so one the model you named
  doesn't offer fails there and the run's log says so. OpenCode makes this a box you type in, because
  the level is your provider's own word (`minimal`, `high`, `max`) and providers don't agree on the
  words.
- **The key box** — optional everywhere but ZCode and Kimi Code's endpoint pick. Leave it empty and
  runs use whatever login that CLI already has; for dsh, the key it saved in its own `$DSH_HOME`. Clear it and the next run goes
  straight back to that login. On Claude Code and Codex the key belongs to the **Provider** pick:
  only a pick that uses one is given it, so a subscription run never carries a key. **ZCode** is the exception: a `zcode login` credential belongs to a
  provider `zcode`'s own config never points at, so a run without the key stops on
  `Model provider is missing an API key: zai`, and the log says where to paste one. **Kimi Code**
  asks for one only on its endpoint pick, where its CLI refuses to start without it; the sign-in
  pick has no key box at all. OpenCode has no key box on purpose: it reaches any provider and each has its own key, so its runs use the login
  `opencode auth login` made. See **Keys**.
- **Test** — under those settings. See **Testing the connection**.

### What each agent needs

- **Claude Code** — the `claude` CLI, logged in or given a key. Run with
  `CLAUDE_CODE_MAX_RETRIES=0`, so a rate limit ends the run right away and frees the card instead of
  backing off for the best part of an hour. That is not a spend control: whether hitting your plan's
  limit spills into paid extra usage is an account setting on claude.ai.
- **Codex** — the `codex` CLI on your PATH, signed in; a ChatGPT subscription runs the board the same
  way a Claude one does, and **Provider** takes it to an OpenAI key or a gateway instead. **Codex
  0.94 or newer**, which is when it started reading skills from `.agents/skills/`. `--sandbox workspace-write` keeps a run inside the working folder, gives it no
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
- **Kimi Code** — the `kimi` CLI, signed in with `kimi login`, installed from a script:
  `curl -LsSf https://code.kimi.com/install.sh | bash`. This is Kimi **Code**, not the older
  `kimi-cli`, which has no headless mode. A run is `kimi -p`, which is already unattended: nothing
  stops to ask, and Kimi's own guard still refuses `rm -rf`, `shutdown` and `reboot`. Nothing else
  holds it to the project folder — Kimi ships no sandbox. Its JSON stream carries the conversation
  and nothing else, so the model and the token counts are read from the session Kimi writes under
  `~/.kimi-code` (or `KIMI_CODE_HOME`); a board that can't read those shows the duration alone. Kimi
  reads `.agents/skills/kanban/` on its own.
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
  either — ZCode ships no sandbox. Sign in by pasting a Coding Plan key from Z.ai or BigModel into
  the key box; a `zcode login` does not carry a run. ZCode reads `.agents/skills/kanban/` on its own.
- **Grok Build** — xAI's own coding agent, installed with
  `curl -fsSL https://x.ai/cli/install.sh | bash`. The board holds a conversation with
  `grok agent --always-approve stdio` — Grok as an ACP agent — rather than using its `-p` headless
  mode, which wants the prompt next to the flag while the board appends one last. `--always-approve`
  is there because Grok otherwise asks before every tool call and a board run has nobody to answer,
  and it sits before the subcommand because `grok agent stdio` rejects every other flag. The fence
  goes in the environment instead, `GROK_SANDBOX=workspace`, holding the run to the project,
  `~/.grok/` and temp; export your own to run behind a different profile. Sign in with `grok login`,
  or set an xAI key on a machine with no browser — Grok puts a saved login ahead of the key. Grok
  reads `.agents/skills/kanban/` on its own, from the working folder up to the repo root.

Every agent's rate limit but Claude Code's is waited out, holding the card while it does.

### Which provider a run goes through

Every run goes through somebody's account. **Provider**, at the top of the Agent section, is where
you say whose. Claude Code and Codex each offer the same three, in their own words:

| Provider | What it is | What it needs |
| --- | --- | --- |
| **Claude subscription** / **ChatGPT subscription** | The login your `claude` or `codex` CLI already has. | Nothing. |
| **Anthropic API** / **OpenAI API** | Pay per token on that provider's key. | The **API key** box. |
| **Anthropic-compatible endpoint** / **OpenAI-compatible endpoint** | A gateway that answers in that agent's format — OpenRouter, LiteLLM, a company proxy. | The **base URL**; a key only if that gateway asks for one. |

Kimi Code offers two of the same shape — **Kimi sign-in**, which needs nothing, and **Custom model
endpoint**, which wants a model id, a base URL and a key. All three are required there: Kimi builds
the endpoint out of `KIMI_MODEL_NAME`, `KIMI_MODEL_BASE_URL` and `KIMI_MODEL_API_KEY` together, and
refuses to start when one is missing. **Endpoint format** rides along as `KIMI_MODEL_PROVIDER_TYPE`
and is the one box you can leave alone — Kimi's own API unless you say Anthropic or OpenAI.

Codex's endpoint pick means OpenAI's **Responses** API specifically: Codex dropped the older chat
format, so a gateway that speaks only that one can't carry a run.

**You only see the boxes your pick uses.** The endpoint is the one pick the board won't save without
its box. A key is never demanded — you can write one into `docs/kanban/.env` by hand at any time.

**Your pick decides the whole environment a run starts in.** It sets what it needs and clears
everything else that could send Claude Code somewhere: the other providers' variables, and the ones
for providers this board doesn't offer yet (Bedrock, Vertex, Foundry). So an `ANTHROPIC_BASE_URL` you
exported in your shell months ago can't quietly route a **Claude subscription** run through a
gateway. Your cloud credentials themselves — `AWS_PROFILE`, `GOOGLE_APPLICATION_CREDENTIALS` and the
like — are left alone: the agent may need them for the work it's doing in your repo.

Codex settles the same question on its command line instead, because that is the only place its CLI
takes it: a pick that isn't the subscription writes a model provider of its own with
`-c model_provider=…`, reading your key from `OPENAI_API_KEY`. It has to be its own provider rather
than Codex's built-in one — a `codex login` signs every request through the built-in provider and
ignores your key, so an **OpenAI API** pick would otherwise quietly spend the subscription. If your
own `command` already names `model_provider`, that is your pick and the board writes none.

**Changing your mind costs nothing.** The base URL and the key stay in their boxes when you pick
something else. **Defaults keep an existing board running as it is**: a board that never picks
anything runs on the subscription, and one whose `.env` already holds that agent's key reads as the
API pick instead.

**Claude Code has no "OpenAI" entry, on purpose.** It speaks the Anthropic API and nothing else. An
OpenAI model reaches it through a gateway that answers in that format — the endpoint entry. To run
on an OpenAI account directly, pick Codex.

**Kimi Code offers two**, not three: **Kimi sign-in** and **Custom model endpoint**. There is no
"pay per token on Moonshot's key" entry between them — that is the endpoint pick with Moonshot's own
address in the base URL.

The other five agents have no provider list: each runs on whatever login its own CLI has, plus the
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
  "autoCommit": false,
  "requireDiffApproval": true,
  "harnessSettings": {
    "claude-code": {
      "provider": "subscription",
      "model": "claude-opus-5",
      "reasoning": "high",
      "args": "--dangerously-skip-permissions"
    },
    "codex": {
      "model": "gpt-5.1-codex"
    }
  },
  "runtimes": {
    "names": ["default", "cheap"],
    "global": "default",
    "flows": { "implement": "cheap" }
  },
  "specAgents": {
    "ui-design": { "runtime": "cheap", "mockupStyle": "ascii" }
  }
}
```

`autoCommit` is **Automatic Git commits** above. Only written when you turn it off — a
missing key means on, which is the default.

`requireDiffApproval` is **Approve diffs before landing** above. The other way round:
only written when you turn it **on**, so a missing key means off, which is the default.

`harness` is the agent that runs: `claude-code` (the default), `codex`, `cursor`, `opencode`,
`kimi`, `dsh` or `zcode`. The name decides everything about how that agent runs — the command, the
flags that make it stream into the live log, the env vars, the flags **Resume** uses, and how a prompt calls the skill.
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

`specAgents` holds what you have changed about a spec skill, under its name: `enabled: false`
when you switched it off, and one key per setting you picked something other than its default
for. A name the file doesn't carry is on and set to its defaults, and putting either back —
switching a skill on, or picking a setting's default — drops that key rather than writing it
out, so the file only ever records what somebody changed. The key kept the older spelling on
purpose: the word changed, and nobody's settings should change with it.

`provider` is who pays for the run: `subscription`, `endpoint`, and `anthropic-api` on Claude Code or
`openai-api` on Codex. Leave it out and the board picks for you — the API one on a board whose `.env`
already holds that agent's key, `subscription` otherwise — and a value this UI doesn't know reads as
that same default. `baseUrl` goes with the `endpoint` pick and is the only setting the board insists
on.

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

`args` is every agent's last setting: whatever that CLI takes and the board has no box for, appended
as written. It sits **after** the settings' flags and **before** the agent's own, so a connector whose
own arguments open a subcommand still takes everything after it. Unlike `model` and `reasoning`, a
`command` override never turns it off — the override replaces the command, and this is added on top
of whatever the command is.

Each run reads the settings once, when it starts, so flipping the picker while an agent is working
changes what the next run spawns. Each run also records the agent it ran under, so **Resume** only
ever offers to continue a run the agent you have picked can actually reach.

### A runtime, so different flows run different tools

`harness` above pins the whole team to one coding tool. A **runtime** puts a name in front of it, and
splits the answer in two: the board says which runtimes there are and which one each flow and spec
agent runs on, and **each computer says what those names run as there**.

`runtimes` is the board's half, and it travels with the repository:

- `names` — every runtime, each a short word a person recognises.
- `global` — the one a flow that names none runs on.
- `flows` — the runtime a flow names, keyed by the command you type: `revise`, not the `edit` the
  board keeps that action under. A spec skill names its own the same way, as a `runtime` key inside
  its `specAgents` entry — a reserved key, never one of that skill's settings.

`setup` always runs the global one: it is the run that has to work on a board nobody has configured
yet. A pass a flow spawns runs that flow's runtime — a refine's clarify, resolve and writing passes
take refine's, while an `akb resolve` you type keeps the `resolve` flow's — and only a flow is named,
never a pass.

**What each runtime runs as is the board's too**, in the same file. One place per runtime: the
global one is `harness` and `harnessSettings`, the keys a board has always had, and every other
runtime is an entry under `runtimes.agents`:

```json
"runtimes": {
  "names": ["default", "cheap"],
  "global": "default",
  "agents": { "cheap": { "harness": "codex", "settings": { "model": "gpt-5.1-codex" } } }
}
```

A name is never in both, so nothing can disagree about what a runtime runs. API keys are never in
here: they stay in `docs/kanban/.env`, under the variable each agent declares, which is the one file
git does not carry.

What a run ends up on: its runtime's own entry, or `harness` when it has none — so a runtime nobody
has set runs the board's agent and a fresh clone works with no local setup at all. Its settings are
that agent's `harnessSettings` block with the runtime's own overrides on top, key by key. An entry
naming an agent this build doesn't ship falls back to `harness`, and the run's log says so; an agent
whose CLI simply isn't installed here does **not** fall back — the run fails with the install command
in its log.

A board written before runtimes existed has no `runtimes` key, and reads exactly as it always did:
one runtime, every flow on it, running whatever `harness` and `harnessSettings` already say.

It is all read and written from a terminal too — `akb agent runtimes` prints the runtimes and what
each flow and spec skill runs on, `akb agent runtime add|remove|rename|global|for` changes the names
and the pointers, and `akb agent bind <runtime> <agent>` changes what one runs as. `akb agent test
<runtime>` spawns it. Everything but `runtime for` is also in **Configuration → Runtimes** above.

### The spec skills

**Agents** lists the spec skills this board can use. A **spec skill** is an Agent Skill the board
puts on a card to fill one part of that card's spec: **UI design** draws the screen the card
changes, and **Technology selection** picks the library it leans on. Each one runs on its own, while
a card is being planned — never while it is being built — and writes one section of that card and
nothing else.

The pane lists them in the board's own order, with one readable name and two lines each: what that
skill fills in, and when the board calls it. The command/file identifier is not repeated in the UI.
Both lines come out of that skill's own `SKILL.md`, so this section and `akb spec` can never say
different things. There is no way to put a skill on a card by hand: that is what the board does for
you.

The board ships two, and a project adds its own under `docs/kanban/skills/<name>/SKILL.md` — those
appear in this pane too, with the same switch and the same settings. A skill this board found but
cannot use — a `SKILL.md` that doesn't parse, a name already taken — is named in a note under the
list, with the reason, rather than quietly missing.

Each skill has a switch, on until you turn it off:

- A switched-off skill is greyed and reads **Paused** beside its switch. The switch still works — that
  is how it goes back on.
- While it is off the board starts no new run of it, on any card. It leaves the list a planning flow
  picks from, and a flow that asks for it by name is turned away and plans that part of the card
  itself.
- The switch is saved with the board, so everyone working on it reads the same one, and a flow run
  from a terminal reads it too.
- A skill already running when you switch it off finishes its run, and whatever a spec skill
  already wrote on a card stays there.
- `akb spec`, typed in a terminal, still names a switched-off skill in a closing line, so a skill
  that stopped appearing is never a mystery.

Every skill is on until somebody switches one off, so a board set up before this shipped has all of
them on with nothing to undo.

A skill can also carry **settings** of its own — what it produces, not just whether it runs — and
they are set on its row, under the two lines:

- One line per setting says what it is set to and what that choice costs. **Change** opens the
  choices in place, each with its own cost, and a pick saves the moment you make it.
- The settings, their choices and the words describing each one are declared in that skill's own
  `SKILL.md` frontmatter, the same as the two lines above them. Nothing here keeps a list of its
  own, so a new skill's settings need no change to this pane.
- A setting is board-wide: every card that skill runs on gets the same answer. There is no per-card
  and no per-run setting. Each choice names one file inside the skill, and only the chosen one's
  instructions reach the run.
- A save that fails puts the choice back and the reason goes across the top of the page, the way the
  switch already behaves.
- A switched-off skill keeps its settings on screen, greyed with the rest of the row and still
  changeable, so it is ready for the day you switch it back on.
- `akb spec`, typed in a terminal, prints what each skill is set to under its two lines. It offers no
  way to change one: this pane is where they are picked.

A skill that declares no settings draws nothing extra, and neither does a board running rules older
than the settings — its rows read exactly as they did.

### Flow rules

**Rules** is where a board says something of its own to a flow. A **flow** is anything the board
can start — building a card, reviewing one, refining it, proposing the next tasks. Its instructions
ship inside the command, so until now every board was given the same words. A **flow rule** is one
paragraph, in your own words, added to the **end** of one flow's instructions. Every session the
board starts from that flow reads it — a long rule therefore makes every card slower.

A rule is plain words, not a command the board runs. What it actually causes is up to the agent
reading it.

The pane is a column naming every flow, with a dot on the ones that have a rule and a count above
them, beside one tall box for whichever flow you click. Each box says which flow it changes — the
command that starts it, and one clause of plain words, because `plan-release` and `run`
name nothing you can guess at.

- **Two flows say what their rule is for**, in a line under the box. On `implement`: each delivery
  builds in a fresh worktree, and this is where you say how to prepare one — installing
  dependencies, seeding a local config. On `review`: add any repository-specific checks.
- **Checks a review rule asks for are the repository's checks.** Review already runs your tests,
  linter and type check, fixes plain failures, and stops when it needs you. A check your rule adds
  is handled the same way.
- **Saving is per flow, on blur**, with a quiet **Saved** beside the flow's name. There is no Save
  button, and a rule is free text, so there is nothing to get wrong — a save that does not land
  says so across the top of the page.
- **Rules are files in your board**: `docs/kanban/rules/<command>.md`, named by the command a user
  types — `revise.md` for `akb revise`. They are tracked in git, so a team shares them and can see
  them change, and a run started from a terminal reads the same words. Clearing a box deletes the
  file; a flow with no file runs exactly as the command ships it.
- **A delivery freezes its rules.** The rules of the flows a delivery is made of — `implement`,
  `review` and `conflict` — are copied onto the delivery record when it starts, beside
  the copy of the card it was approved to build. Every session in that delivery runs with those, so
  editing a rule changes the next delivery and never one in flight.
- **The list of flows is the board's own** — every command that can start one — so a flow shipped
  in a later release appears here on its own.

There is no way to run a shell command from a rule, and no per-delivery approval of one: both would
break the one-click flow. Spec skills take no rule — each keeps its own settings already — and
neither does **Chat**, which is a conversation rather than a flow the board starts.

### General → Setup: the coding agent skill

Getting a board does not bring this with it. A new board is `docs/kanban/` and nothing else, and
every button here runs without it. What it adds is a second way in: you can say *"add a task"* or
*"what's next"* to your coding agent in your repo and it works this same board — the same cards, the
same runs, the same files.

**Configuration → General → Setup** is where you turn that on. Two rows say where the project stands
and carry the button that fixes each:

- **Not installed** — nothing in either folder. **Add the skill** writes it.
- **Installed** — the version in each folder, beside the version this board runs on.
- **Out of date** — a folder written by an older release. The button says **Update the skill**.

Under **Technical details** it names the folders it touches — `.claude/skills/kanban/` for Claude Code,
`.agents/skills/kanban/` for the other seven — and after a press it says, folder by folder, what it
wrote. Each folder gets one file, `SKILL.md`: a short note saying the board is here and that `akb`
owns it. The rules themselves live in the command, so this writes a few kB in your repo and never
runs a global install.

That is why the group carries a second row: the `akb` on your PATH, which can be older than the copy
this board runs on, or missing. The note points your agent at `akb`, and every flow it follows
ships inside that command — so an old `akb` means old flows even in a project whose note was just
refreshed.

In the desktop app that row carries an **Install** button. The app already carries the command; the
button only points your system at the copy inside it, so updating the app updates the command. It is one link at `/usr/local/bin/akb` on macOS, written with the system's own
password dialog, and the app's own folder on your PATH on Windows. Hovering the button names the path
it would write, and which of four things is true right now: nothing installed; installed at that
path; installed but pointing at an app that is no longer there; or that path held by an `akb` the app
didn't put there — an npm install lands there too, and the button leaves it alone. The app
offers this once by itself, at the first launch that finds no `akb`; saying no costs nothing. In a
browser, and on Linux where the AppImage has no lasting path to point at, the group hands you the
line to copy instead.

If you never want it, you never need it. Nothing else in the board asks for it — except the two
places that hand you a line to paste into a coding agent (the first run's handover, and the setup
strip), which say the skill isn't there and offer this group instead of a line that would reach
nothing.

### General → Language

**Language** picks the language you read in — **English** or **中文**. It is the last group of the
General pane, and not a setting of this board: it is a fact about you, so one answer covers every
project you open and every terminal on this machine. The change takes effect at once, with no
reload.

It is held in `~/.ai4kanban/settings.json`, beside the Cloud sign-in and outside every repository,
so the app, a board served to a browser and a bare `akb` in a terminal all read the same answer —
and so it is never cloned along with your project or shared with your team. There is no `akb`
command that sets it; the switcher is the app's.

On a machine that has never said, the app picks for you the first time it opens: it reads your
system's preferred languages and keeps the first one it has a copy for — any Chinese is **中文**, and
a language it doesn't have falls through to the next one and then to English. The answer is written
down like any other pick, so it is guessed once and never again: a machine whose system language
changes later keeps what it was opened in, and this group is what moves it. An app that has been
reading English under a Chinese system turns Chinese once when it updates, for the same reason.
Guessing is the app's alone — a board served to a browser and `akb` in a terminal read the answer and
never write one.

The **launcher** — the screen with no project open — carries its own **English / 中文** switcher in
its top-right corner. It is the one screen you meet before there is a board to open this dialog on,
so a guess it got wrong costs one click there. A build whose bundled rules predate the setting draws
no switcher at all.

The board still draws in English: this release ships the setting, and the words are translated in a
later one. What the `akb` command prints in a terminal stays English either way.

A project whose copy of the board's rules predates this setting draws in English and says so when you
try to change it — `npm install -g ai4kanban` brings that project up to date.

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

Only a run that stopped short offers it. A run that passed has nothing to continue, and a run whose
conversation the agent can't reach — it never reported an id, or a different agent is picked now —
shows no button rather than one that could only fail. If the conversation itself has expired, the
resume ends as a failed run with the reason in its log.

### On the card it was working on

The card page shows its newest run in the same slot, so a run that stopped short says so on the card
rather than only in **Runs**. Open the card and that log is already open, with a line above it: this
run stopped short, so the card may be part-built and whatever it wrote is sitting in your working
tree. The log under it says why.

**Resume** sits in that log's title bar, beside the outcome — the same button the runs panel has,
doing the same thing. Once it starts, the card page follows the new run: its log tails live in the
same slot, and the card re-reads itself when the run ends.

The line is one run's outcome, not the card's, so a newer run on the card replaces it. A run that
passed and a run you stopped yourself read exactly as they always did — no line, no button. A run
too old to continue, or one whose agent you have since switched away from, still shows the line;
only the button is missing. A run that has aged out of the kept history shows nothing at all — its
log is gone from disk too, so there is nothing to open.

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

### Where the words live

Every word the board draws is in `kanban-ui/i18n/` — one folder per surface, one file per
language in it, and that folder's `types.ts` beside them. A component asks for copy with
`useCopy()`; a server component or `lib/` imports `copy` from `i18n/`. Nothing is written
where it is drawn.

New copy is written in English first, in `<surface>/en.ts`, and typed by that folder's
`types.ts` — so a key another language hasn't translated is a `pnpm typecheck` failure
rather than a blank on screen. `i18n/index.ts` has the rest of the rules for writing one.
