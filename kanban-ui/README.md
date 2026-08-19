# ai4kanban-ui

> **Deprecated — get the desktop app instead: <https://ai4kanban.dev/download>**
>
> The app is the same board in a window, with nothing to install first: no Node, no npx, no
> terminal to keep alive. This package keeps working and is not going away, but it is frozen
> at its last version and no new release lands here.

The local board UI for [ai4kanban](https://ai4kanban.dev/). It shows every track and drives
the work from buttons: each button spawns an agent in your repo that does the kanban work
for you — propose, refine, implement, archive.

The markdown files in `docs/kanban/` stay the single source of truth. The UI only reads and
writes those files, so nothing here is locked in.

The desktop app is these same pages in a window, so everything below describes both. The
pages themselves are not going anywhere — reaching the board from another device still
needs them. What is deprecated is asking a person to start a server and open a browser:

```
npx ai4kanban-ui        # deprecated — http://localhost:7420, localhost only
```

Installing it, pointing it at a board elsewhere, changing the port, updating: run
`akb guide local-ui`. This file is about **using** it.

## In the app

On the first launch, pick a project folder. It does not need a board yet: if there is no
`docs/kanban/` there, the app offers to make one and then opens its guided first run.

The folder path in the header opens the **Projects** list. Pick a project there to go back
to a folder you opened before, or choose **Open folder…** to add another one. **File → Open
Project…** opens the same folder picker, and **File → Open Recent** is another way back to a
recent project.

One project is open in the window at a time. Switching replaces the whole page with that
project's board; no card, dialog, filter or half-written field from the previous project
stays on screen. An agent run is different: it stays with the project where it started and
keeps going after you switch away. A pulsing dot on that project's line says a run is still
going there.

The **×** on a project takes it off the list without touching its folder, board or history;
open the folder again to put it back. The project on screen has no **×**, so switch away
before removing it. If a remembered folder has been moved or deleted, its line says
**folder is gone** and offers only the **×**.

When a newer version is out, a line above the board says so with a link; the app never
updates itself. Closing the window ends every board server and agent run across the
projects the app has open.

## The board

The home page is the board. It answers one question — what can I start now? — with two
columns: **Ready to build**, the cards marked ready and under them the ones already being
implemented, and **Not ready**, everything still to be worked out. Each column counts what's
in it, and the ready one counts both numbers ("5 ready · 1 implementing") so the first is
what you can start today. Inside a column the cards keep their tracks, banded one under
another. Click a card to open it: the full card body, its meta (track, modules, release,
priority, ROI, blockers), its open questions, and its buttons.

A third, narrower column holds the **recurring** cards — the jobs on a cadence that are run
again and again and never finished. They stand apart because they are not part of the
ready/not-ready question at all; the column is absent on a board that has none.

The columns are a fixed width and the row scrolls sideways, so the cards lay out the same
way on a laptop and on a monitor — a wider window shows more of the row, not wider cards.

A card waiting on another card carries a small **lock** marker; hover it to see which cards
are in the way. It shows only while a blocker is still on the board — once that card is
archived or rejected the marker goes. A recurring card never counts as a blocker, since it
never closes. The card stays in its column either way: the marker says the work has an
order to it, it doesn't hide or gate anything.

The board hides nothing: every open card is in one of the three columns. Inside a track band,
the best card to start comes first — a card waiting on another sinks below the ones you can
start, and a blocker rises to the top of the rest.

The header carries six things:

- **The goal** (the compass, on the left beside the folder path) — see below.
- **The release dropdown** — which version the board is showing, and where a release is
  started, filled from its goal, or dropped; see below.
- **Create task** — describe an idea in your words and the agent writes the card. The same
  dialog has a **Propose tasks** mode: pick a module (or let the agent pick one) and it
  proposes new tasks inside it. A **How many** row sets the count — 3 by default, 10 at
  most — and a **Boldness** row sets how big those tasks are: `safe` polishes what already
  works, `normal` is a feature each, and `bold` asks for a big leap each — a capability the
  module doesn't have at all. Every proposal is a single card a session can finish, never a
  group task.
- **Runs** — every agent session, live or finished. Open one to read its log. A finished run
  can be continued with a follow-up prompt; that starts a new run.
- **Daily progress** (the chart) — the last 30 days of the board, as a line each for
  completed, created, and rejected cards, with the totals above it. The numbers come from
  `docs/kanban/metrics.csv`, which the script keeps as you work; the view only reads it. A
  board with nothing recorded yet says so instead.
- **Configuration** (the gear) — see below.

### Finding a card

Down the left is the **rail**: **All cards** at the top, which is the board, and under it
every card this window has opened, each one closeable. It is on the board and on a card page
alike, and you can drag its right edge to make it wider.

Above those rows is a **Find a card** box. Type part of what you remember and the rail lists
the cards that carry it, in their titles or anywhere in their bodies — upper and lower case
make no difference, so `ui` finds a card that says `UI`. Click a match to open it.

It searches every open card, including a group's subtasks, which the board's columns don't
show — often the cards hardest to reach any other way. It never reaches the archive: the
rail is about what you are working on now. A word that matches most of the board is fine —
the matches scroll inside the rail. Nothing matching says so in a line, and clearing the box
(the **×**, or Escape) puts the rail's own list back.

At the foot of the rail is the **Memory** panel — see **The board's memory** below.

The rail is hidden on a narrow window, and the box and the panel go with it.

### The goal

`memory/goal.md` is where the project is headed, in your own words. Every proposal the agent
makes is judged against it, so it is worth rereading now and then — and the small **compass**
on the left of the header, after the folder path, is how. It sits on the board and on a card
page alike.

Click it and a **Goal** dialog shows the whole file, headings, paragraphs and roadmap as you
wrote them. Nothing is cut short or folded away; a long goal scrolls.

**Edit** in that dialog swaps the text for a plain box, with Save and Cancel. Saving writes
your words back and the dialog shows what you just saved, with no reload.

The compass only shows when there is something to read. A goal file that is missing or empty
has nothing to open, and the first run — or the board's goal notice — is what asks you to
write it there.

A save marks the goal `reviewed: pending` in its frontmatter and leaves the rest of the block
alone. That field is how clear the goal looks to plan from: `strong`, `good` and `weak` are
the agent's judgment — it writes them when it sets the board up and every time it proposes
work — and `pending` just means you wrote something nobody has read yet. Only `weak` (or an
empty file) makes the board ask you for a goal, so writing one is enough to stop it asking.

### The board's memory

Under the open cards, at the foot of the rail, is **Memory** — what the agent remembers about
this project. Every proposal it makes is judged against these files, every question it settles
by itself leans on them, and every idea you turned down stays turned down because it is
written there. This is where you read them without opening files in an editor.

It starts collapsed: one row with an arrow. Click it — anywhere on the row — and the panel
opens on two halves, **Project** and **Modules**. The project's own four files are the four
rows under **Project**:

| Row | The file |
| --- | --- |
| **What shipped** | `docs/kanban/memory/readme.md` |
| **Settled decisions** | `docs/kanban/memory/decisions.md` |
| **Design mistakes** | `docs/kanban/memory/redesign.md` |
| **Rejected ideas** | `docs/kanban/memory/rejected.md` |

Hover a row and it names the file it opens. Click one and the file opens in the body, whole
and rendered, headed by the row's name — with the module's name over it when the file is a
module's — and the file's path from the repo root under it. That row stays highlighted while
you read, the same as the row of a card you are on. The panel
grows with its rows up to half the rail and scrolls past that, so the cards above it are never
pushed off. Whether you left it open is remembered.

Under **Modules** is one row per module your `docs/kanban/modules.md` names, in the map's own
order. Click one and it opens under itself into that module's own four files —
`docs/kanban/memory/<module>/` — the same four names, indented. They open and read exactly
like the project's. Any number of modules can be open at once, and a module nothing has been
written about yet says so in a line instead of four rows that lead nowhere.

Modules start closed every time you load the board, and nothing remembers which you had open
— except the module holding the file you landed on, so its highlighted row is on screen after
a reload. A board whose map names no modules keeps the four project rows and no labels.

An open memory file is a page of its own, so Back, Forward and a reload all keep you on it,
and landing on one opens the panel however you left it, so the highlighted row is on screen
whichever way you got there. In the app a two-finger swipe goes back from it, as it does from
a card.

The page keeps up with the file on its own: it re-reads when a run finishes and when you come
back to the window, so a file an agent has just rewritten catches up without clicking the row
again. A file nobody has written yet keeps its row and says so when you open it.

**Everything here is read-only, and nothing starts a run.** To fix a line you disagree with,
the **⋯** beside the heading offers **Copy path** (the full path on disk) and **Copy relative
path** (`docs/kanban/memory/decisions.md` — the form to paste to a coding agent working in
this repo); it says when the copy worked. The board never opens the file for you.

The goal is not in this panel — it keeps its own button in the header (see above). And on a
narrow window the rail is hidden, so memory goes with it, like the search box; a memory file
you are already on still reads.

### The release a card ships in

A card can say which version it ships in. Open the card and the meta box has a **Release**
box next to Priority and ROI: pick a version and the card moves into it, pick the dash and
it comes back out. The dash is a card in no release — wanted, but not promised to a version.

The list you pick from is the open releases in `docs/kanban/releases.md`, in the order they
ship, with the dash last. There is nothing to type, so a version id can't be misspelled into
existence — the header's dropdown is where a release is made. Your pick is written into the
card file the moment you make it, like priority and ROI, so the files stay the record.

The board cards themselves don't show the version. The dropdown in the header already says
which release you are looking at, and stamping the same name on every card under it crowds
out what the card is about.

A **group task** moves as one: put its root card in a version and every subtask goes in with
it, including the subtasks of a nested group, and taking the root out takes them all out. A
single subtask can still be moved on its own.

A board that plans no versions never sees any of this — no box on a card. Nothing asks you
to plan a release.

`releases.md` is a plain file you can edit, so a card can end up naming a version that is no
longer on the list. That card goes on showing what it says, marked **not on the list**, and
the box moves it onto a release that really exists.

### Showing one release at a time

The dropdown in the header says which release you are looking at. Pick one and **the cards
in every other release are hidden** — that is the point of it: you work on this version
without the rest of the backlog in the way. The columns regroup on what is left.

**Blockers are the exception: every blocker stays on screen whatever you pick.** A blocker
is usually in the way of the very version you are planning, and a blocker is never out of
sight. You see it in the Blockers column, and at the top of the queue's halves, even when it
belongs to another release or to none.

**No release** is the first entry and where the board opens: the open cards that aren't
promised to a version yet — the pile every release is picked out of. There is no whole-board
view, because a card already planned into a version is one you review in that version.

Each entry counts the open cards in it — "v1 (7)" — so you can see a version is nearly empty
without opening it, and carries what that version is for under its name. Those are the same
numbers and the same goals `release list` prints in your terminal.

A few more things it does:

- A **group task** shows whenever the root or any of its subtasks is in the release you
  picked. The board never draws a subtask, so hiding the root would hide the whole group.
- **Create task** puts the new card in the release on screen, so it doesn't vanish the
  moment you write it. **Propose tasks** doesn't — it offers work nobody has planned, and
  that work stays in no release.
- A release with **nothing open in it says so**, with **No release** one click away, instead
  of looking like a broken board. Blockers on screen don't count: a blocker belongs to
  whoever it blocks. On No release an empty screen says so too — every open card is in a
  version, and there is nothing left to plan.
- Your pick is remembered in your browser, per board. Nothing is
  written to the files, so a pick never changes what the agent works on — background
  refining still reads the whole board, and the progress chart still counts every card.
- If the release you picked is gone — you closed it, or edited `releases.md` — the board
  opens on No release rather than hiding your cards behind a version that no longer exists.
  That is also where closing or dropping one leaves you: the cards it let go are exactly
  what No release shows.

### Starting a release

The dropdown's last entry is **New release**, on a board with five releases and on one with
none. It asks for a version id — `v1`, `0.5.0`, `august`, whatever you call your versions —
and, above that box, which kind of release this is. Two tabs:

**From a goal.** The tab the dialog opens on. Under the version id is one more box: the
release's goal, a sentence or two in your own words saying what this version is trying to
ship. Those words are the whole choice — the release is planned against them, so the agent
moves in the open cards that ship the goal and writes the ones your board hasn't got (see the
next section). The goal goes on the release's own line in `releases.md` and shows under the
version in the dropdown. **Make release** stays out of reach while the box is empty: there is
nothing to plan a release against until it says something, and an empty goal is the other tab.

**No goal.** No goal box. A version with nothing to plan against falls back to a plain rule,
under one toggle: **put every unplanned high-priority card in**, with the cards it would move
counted right under the switch, so you see the move before making the release. It is a rule,
not a judgment call — it looks only at the cards in no release, and a card goes in on three
tests: its priority is high, nothing open is blocking it, and it is not a group root (a
subtask is tested on its own). Nothing else is looked at, and it only ever adds — a card
already in a release stays where it is. Every high-priority card the rule leaves behind is
counted there too, with the test it failed, so nothing is dropped silently. With no unplanned
card to move, the toggle says so; turned off, the release is made empty. A card that
shouldn't have gone in moves back the way any card does — its **Release** box.

Either way, where a release sits in the order is the order you made them in. A release made
on the **No goal** tab can be given a goal later — **What it is for** in the **⋯** menu — and
filled from there.

The board switches to the new release the moment it is made, so what you write next lands in
it — **Create task** puts a new card in the release on screen. Made from a goal, the board
says **it is being planned** and the cards appear as the run moves and writes them, with
**Watch the run** on the note; made with no goal, you get the cards the rule moved, or the
"has no open cards" note with **No release** one click away.

### Filling a release from its goal

A version that says what it is for can be filled against those words. While the board is
showing one release that has a goal, the **⋯** offers **Fill from its goal**. It is an agent
run, so a dialog first shows the goal it will plan against and says what the run does:

- it moves the open cards that ship the goal into the release, and
- it writes the cards the goal needs that the board hasn't got.

The new cards land plain — no open questions — and each one is refined right after, as its own
run, like any other card a run writes. The agent decides all of it: nothing waits on you and there is nothing to
approve.

The run behaves like every other run on this board: it shows in the **runs panel** from the
moment it starts, you can stop it there, and its log is where you read what it moved in, what
it wrote, and what it left out and why. While it goes, the release says **it is being
planned** across the top of the board — so a version that is empty because the agent is still
writing its cards never reads as a version nothing happened to — and **Watch the run** on that
note opens its log. The board picks the cards up as the run goes, and re-reads itself when the
run ends, so nothing waits on a reload.

A card already in another release is left where it is — filling only ever adds. So running it
again is safe, and it is what to do when the goal changes: say what it is for, then fill it
again, and it adds whatever the goal still lacks. To take a card back out, use its
**Release** box.

A release with no goal has no **Fill from its goal** entry — there is nothing to plan
against. Say **What it is for** first, and it appears. In a terminal the same move is "plan
release v1".

A name the board can't take — one it already has, an empty one, or one that can't
be a filename — is refused with the reason under the box, and the dialog stays open so you
can fix the name where you typed it. Leaving without a name makes nothing and leaves the
board on the release it was already showing.

### Saying what a release is for

While the board is showing one release, the **⋯** beside the dropdown offers **What it is
for** — the whole goal in a box, and that box is where you change it. The dropdown clamps a
long goal to two lines and the file keeps it on one, so this is the only place you read all
of it at once. Save an empty box and the release goes back to having no goal.

The version's goal ends up in one line in `releases.md` whatever you type, so a goal typed
over three lines reads back as one sentence — and a goal with an em dash in it still reads
back whole. In a terminal the same two moves are `release new v1 --goal ".."` and
`release goal v1 ".."`.

### Closing a release

The version shipped. While the board is showing one release, a **⋯** joins the release
dropdown — one sticker, two parts — and its menu offers **Close release**. It never fires on
one click: a dialog first says what the close writes down and lists the open cards that come
out of the version — still wanted, no longer promised to it — and only confirming writes
anything.

The dialog also names any open card whose todos are all ticked but which was never archived.
Such a card counts as **not shipped**, and a closed release can't be reopened to fix that, so
it is named while you can still cancel, archive the card, and close after. In a terminal you
read that warning after the close; here you read it before.

The result is exactly what `release close v1` does: the summary file in
`docs/kanban/.release-summaries/` gets one dated **Closed** section — what shipped, from the
cards you archived while they named the version, and what was still open — the open cards come
out of the version, and its line comes off the list. Afterwards the board shows **All
releases**: the version it was showing no longer exists.

The summary also keeps what the version was for: the release's line is gone, so those words
survive only there. The rest is a list of cards, not a changelog, and the board never edits
it again. If a line in it is wrong, fix that file in your own editor, the way you'd fix a
memory file.

### Dropping a release

You gave up on the version — it will not ship. The same **⋯** menu offers **Drop release**.
It never fires on one click either:
a dialog first says what happens, lists the cards already archived under it, and lists the
open cards that come out of the version — still wanted, no longer promised to it. Only
confirming changes anything.

The result is exactly what `release drop v1` does in a terminal: the version comes off the
list with no shipped record, its open cards return to no release, and cards already
archived stay archived. No summary file or section is written. If an earlier close of the
same id left a summary file, the drop does not change or delete it. Why you gave up is
yours to write down if you want it kept — the board records nothing about it.

**Renaming and reordering a release are still terminal jobs** — `releases.md` is a short file
and a hand edit is how those work.

A board that plans no versions sees the dropdown saying **No release** — which there is
every card — and offering **New release**, and nothing more. Nothing asks you for a version.

### The first run

A board whose setup is unfinished opens on a short guided run instead of the columns. It
asks for the three things only you can answer, one to a screen:

1. **The project** — its name, one line saying what it is, and the tracks work falls into.
   Everything starts filled in: the repo's folder name, and the tracks the board was
   installed with. A track is a folder under `docs/kanban/todo/`, so adding one here makes
   it, renaming one moves it with its cards, and dropping one removes it — unless it holds
   cards, and then it stays and the screen says so.
2. **The goal** — an empty box on `memory/goal.md`, your own words, with a note about what
   belongs in it and a link to the longer guide. **Skip for now** leaves it for later.
3. **The agent** — which agent every button on this board runs, with the same picker,
   settings and **Test** the Configuration dialog has. This one can't be pressed past:
   Continue opens on a test that passed, and on nothing else. Everything the board does
   from here is a run, so an agent that hasn't answered once would fail on the first press
   instead of here, where the picker is.

Then a closing screen names what is left — the steps that read your repo and think — and
offers to do them for you: **Finish setup** starts one agent run that works down every step
still unticked. It is an ordinary run, so it shows in the runs panel, its log reads like any
other, and you can stop it. The board re-reads itself as it goes, so the bar ticks along and
the first cards appear where you are looking. Only one setup run goes at a time — while one
is going the button is replaced by **watch the run** — and starting one after a run failed
or was stopped carries on from the first unfinished step rather than redoing what finished.

When that run stops short — the agent isn't logged in, a connector is set up wrong — you are
told rather than left watching a bar. The closing screen and the board's setup strip both say
**The last setup run stopped short**, in the spot the live run wrote in, with **read its log**
in the line for why. The reason stays in the log; the strip never repeats it. **Finish setup**
stays where it is — pressing it again is how you retry. A run you stopped yourself is not a
failure: the offer reads exactly as it did before.

One thing stands in for that offer: if you skipped the goal, the screen asks for it first —
nothing after the goal can be planned from a goal nobody wrote.

The line to paste is there either way, under the offer rather than instead of it:

```
/kanban. Set up this board — follow docs/kanban/setup-checklist.md.
```

The line follows the agent you picked, because agents trigger a skill differently: on Codex
it reads `$kanban. Set up this board …`, and on Cursor, OpenCode and DeepSeek Harness it
asks for the skill in a sentence, since none of them has a name you can type. Copy it and paste it as it comes. It is
on every screen of the run too, under **Rather set this up from your coding agent?** — you
can hand over at any point, and setup picks up at the first unticked box, so nothing you
answered here is asked again.

That line only works once the coding agent skill is in the repo, and a board arrives without
it (see **The coding agent skill**). Where there is none, both places say so and hand you the
one command that adds it — `npx ai4kanban@latest skill install` — above the line to paste.
**Finish setup** needs none of it: the run the board starts is given the board's own command
directly, so it works on a repo where the skill was never installed.

Nothing here is a dead end. **Go to the board** leaves the run for the columns at any step,
and the board then carries a strip saying how far setup got with **Continue setup** on it.
The steps down the left show what has been settled and take you back to any of them. The
run itself is remembered in `setup-checklist.md` and nowhere else, so closing the window and
coming back lands on the same screen.

Once the run is answered, the strip stays until setup is finished, now carrying the same
**Finish setup** button, with **Finish in your coding agent** beside it — the line to paste
— or, on a repo with no skill in it, **Add the coding agent skill**, which opens the pane
that writes it. Before setup ends, the skill creates no cards at all: ask it for one and it
tells you to finish setup first. The last box creates your first cards and deletes the
checklist; the strip goes at the same moment the cards appear.

### When the goal needs writing

Long after setup, one notice comes back on its own when there is no goal to plan from — the
file is empty, or the agent has judged it weak again (`reviewed: weak` in its frontmatter).
Every proposal the agent makes is judged against that file. **Write the goal** opens the
same box the first run used; writing one is enough to send the notice away, and you never
wait on an agent run for that. The ✕ hides it for the browser session.

A board that is set up and simply has no cards left shows nothing — empty columns aren't a
signal, and neither is a board set up before the checklist existed.

## A card's buttons

Every button opens one small dialog. You can type a note that goes to the agent, then
confirm. The card then shows a running badge and a live log you can read while it works. The
log is read-only — you never type into a running session.

| Button | When it shows |
| --- | --- |
| **Implement** | Until every todo on the card is checked. Never on a group root or a recurring card. |
| **Run** | On a recurring card, in place of Implement — see below. |
| **Refine** | While a refine would still move the card — see below. |
| **Edit** | Always. Say what to change and the agent revises the card. |
| **Resolve** | Only when the card has open questions. |
| **Archive** | Once every todo is checked (a group root: once every subtask is resolved). Never on a recurring card. |
| **Reject** | Always. |

**Resolve** gives each open question an answer box. A question that carries choices shows
them as a tick list instead — one pick, or as many as you like, depending on the question —
with the agent's recommended ones already ticked, so agreeing is one click on the confirm
button. Those questions keep their box too: type an answer and the ticks clear, tick an
option and the text clears. Your answer is either the options or your own words, never
both. Leave a question untouched — nothing ticked, nothing typed — and the agent
researches that one itself. The card page lists the same choices under **open questions**,
so you can read them without opening the dialog.

**Resolve** has a second confirm, **Resolve & implement**: the agent answers the questions
it can settle itself, and if nothing is left for you to decide it goes straight on to build
the card in the same run. If a real judgment call remains, it stops and leaves it for you.

When a card is blocked, the **Implement** dialog names each card still in the way and asks
you to tick that you know before **Implement anyway** wakes up. The button still works: the
warning is there so you know what you're starting ahead of, not to stop you.

### Schedule it instead

Beside **Implement anyway** sits **Schedule**. It starts nothing now: it writes on the card
what you want done, and the board runs it by itself within a minute of the last card in the
way leaving the board — archived or rejected, either way that card is gone. The waiting is
the machine's job, not yours.

- **Two actions can be scheduled**: **Schedule** in the Implement dialog builds the card, and
  **Schedule** in the Refine dialog sharpens its plan. Scheduling is never a move of its own
  — it always follows one of those two.
- **Nothing to tick.** Nothing starts ahead of the blocker, so Schedule needs no "I know".
  A card that isn't **ready** still asks for its "the plan may still be rough" tick before you
  can schedule a build, the same as building it now.
- **The note you type goes with it** and reaches the run when it fires.
- **One at a time.** Scheduling a second action replaces the first, and the dialog says which
  one was on.
- **The card reads `pending`** in place of its stage, on the board and on its own page.
  Hover it and it says what will run and what it waits for — `implement · waiting on #57`.
  It is not a new stage: the card keeps the one it had and stays where it is in the queue.
- **Take it off** on the card page, next to **Scheduled**. Nothing fires after that.
- **It has its own slot.** One scheduled run starts per minute, and neither a refine in
  flight nor a recurring job that is due can hold back a card whose blocker just cleared.
- **It fires once.** The mark comes off the moment the run starts, so a run that fails or
  that you stop doesn't come back on its own — the card is plain again and you start it by
  hand.
- **A schedule that has gone pointless is dropped**, not run: a refine you queued on a card
  someone has since taken to **ready** has nothing left to do.
- **A card whose blocker is never finished stays pending forever.** That costs nothing, and
  taking the schedule off is one click.

The mark lives in the card's own frontmatter, so it survives closing the board, a reboot,
and a clone on another machine — and it travels with the card if you move it.

**Refine** runs one refine on this card right now. Its dialog has nothing to type — it says
what the agent will do, and you confirm. It is the same run the board starts by itself after
something touches the card (see **The refine that follows a run**), so it is how you refine a
card whenever you want rather than waiting for something else to happen.

The button shows only while a refine would still move the card. It's gone once the card is
**ready**, once every todo is checked, and when every open question is one only you can
answer — **Resolve** is the button for that last one. A **Blocked** card keeps the button;
the dialog names the blocker in one line and offers both ways on — **Refine anyway** now, or
**Schedule** it for when that card is done.

A card can only have one run at a time. If the board is already refining this card, the
button is off and the badge beside the title says what's going on.

A run never commits. It leaves its changes in your working tree; you read `git diff` and
commit.

### The refine that follows a run

A command does what you asked and stops. The board then refines the card, as a run of its
own: it appears in the runs panel with its own log, and you can stop it like anything else.

- **A run that wrote or changed a card gets a refine on it.** Add a card, change one, answer
  its questions, propose, fill a release — each card that run touched comes back refined,
  one run per card. Ask for three cards and three refines follow.
- **Finishing or rejecting a card refines the ones it was holding up.** Every card it was
  blocking that now has nothing left in its way gets its own refine. A group task's subtasks
  come free one wave at a time, each refined when its turn comes.
- **A group's main card is not refined by a subtask finishing.** Ticking its line is the
  group's progress, not a new plan, so a group of ten subtasks doesn't refine its main card
  ten times. Change the main card itself and it is refined like any other.
- **Cards a refine can't move are skipped** — one still waiting on a blocker, one the run
  left **ready**, a recurring card, one whose todos are all ticked, and one whose open
  questions are all yours to answer. **Resolve** is the button for that last one.
- **Nothing hunts the backlog.** Every refine follows something that just happened, so a
  card you write by hand in your editor gets none — press **Refine** on its page.
- **It hangs off the end of a run**, so it works the same whether the run started here or
  from a terminal, and a refine that failed or that you stopped is not started again.

### Recurring tasks

A card in the **recurring** column is a job you repeat — a weekly report, a daily tidy-up —
not a piece of work you finish once. Its column carries a light lilac tint so you can tell it
apart at a glance, and its cards behave differently: they are run again and again, and they
are never archived.

**Run** does one pass. The agent works through the card's **Process** in order, records the
run, and rewrites a step or two so the next run needs less of you — that is the point of a
recurring card: each pass should need a little less human than the last. The card stays on
the board when the run ends.

Nobody is watching a run, so a step that needs your judgment is not guessed at: it is left
undone and written into that run's open-questions file, next to the card, for you to answer
whenever you get to it. The next run folds your answer into the Process.

The card page says when the job **last ran**, next to Priority and ROI — the date and time of
the last run, or **Never run** for a card that hasn't run yet.

#### A cadence runs the job for you

Beside the last run is **Cadence** — how often this job should repeat. Pick a number and a
unit: every 30 minutes, every 6 hours, every 7 days. Pick days and a time box appears, so a
report can run every day at 09:30. **No cadence** is one of the choices on the same list and
takes the schedule off again.

Give a card a cadence and the board runs it itself when it comes due — no click. The run is
the same one the **Run** button starts, it shows up in **Runs** like any other, and **Stop**
ends it. Without a cadence the card runs only when you click Run; writing one is the opt-in.

**Next run** appears beside Last run and says when the job comes round again — or **Due
now** when the board is about to pick it up. Both times are your machine's clock, the one
the server runs on.

A card that has never run is due at once, so a new job runs within the minute instead of
waiting a day to show it works. After that it waits out the interval from the last recorded
run. The board wakes once a minute, so that minute is the floor: a cadence shorter than that
still runs once a minute. A job that was due while the board was closed runs once when you
open it, not once for every window it missed.

Only one recurring job runs at a time, and it has its own slot — a refine going on doesn't
hold back a job that is due. If a run is stopped, fails, or ends without recording itself, the board
leaves that card alone rather than starting the same broken run every minute; click **Run**
when you want it back on its cadence.

There is no **Archive** on a recurring card, since it has no end state, and no **Refine**
either — a recurring card has a Process, not a build plan, so running it is what sharpens it.
**Edit**, **Resolve** and **Reject** work as they do anywhere else. To make one, describe the
job in **Create task** and say it repeats; the agent writes it into the recurring column.

### Stopping a run

A live run's log has a small **✕** in its title bar. That ends the run — useful when an
agent is going the wrong way and you'd rather not wait for it. It's in every place the log
opens: the card page, the log you open from a card on the board, and **Runs** in the header.

The ✕ never stops anything on its own. It opens a small box asking you to confirm, so a
stray click on a busy board can't kill an agent mid-edit. Confirm and the button reads
**stopping…** for a few seconds: the agent is asked to end first, and only killed if it
doesn't go.

**Stop doesn't undo anything.** The run ends where it stands, and whatever it half-wrote
stays in your working tree — same as any other run. Read `git diff` and undo what you don't
want.

Every run can be stopped, whoever started it: one you pressed a button for, and one the
board started by itself. The card unlocks the moment the run ends, so you can start
something else on it.

**Stopped** is its own outcome, next to done and failed — a blue dot in the runs panel and
`stopped` on the log. Nothing went wrong, so it never reads as a failure, and it offers no
**Resume**: a run you ended is over, not one that stopped short.

Stopping the refine that followed a run ends it there — nothing starts it again by itself,
since a refine only ever follows something that just happened. Press **Refine** on the card
when you want another.

Stop ends the agent. A build or a test the agent kicked off is left to finish on its own.

### What a run cost

When a run ends, its log says how long it took, what it cost, and which model did the work:
`done · 4m 12s · est. $0.42 · claude-opus-5`.
The same line shows wherever that log opens — from the card, or from **Runs** in the header.

The number is an **estimate**, not a bill. The agent works it out on its own machine from the
run's tokens at list prices. Most people run the board on a subscription plan, where a single
run isn't charged on its own, so what you actually pay may be nothing at all.

It is one run's own cost. The board never adds runs up — not per card, not per day — and a
run you continued with **Resume** shows what that new run cost, not the whole conversation.

A run with no cost to report shows no number: one still going, one that failed, was
interrupted or was stopped before it got there, and an agent whose output says nothing about
cost — Codex and Cursor are two, so their logs show the duration and no dollar figure.

### Which model a run used

The model comes from the run itself — what the agent said it was working with — not from the
model box in **Configuration**. So a run shows a model even when you left that box empty and
let the agent pick, and a run that started before you last changed the model still shows the
one it actually ran on.

It shows from the run's first seconds, so you can see what a live run is using, and it reads
exactly as the agent said it — the board never tidies up or invents a model name.

A run whose agent never named a model shows nothing there: an older run from before the board
tracked this, and any agent whose output doesn't say — Codex and OpenCode never do, so a run
on either names no model even with the Model box filled in. DeepSeek Harness names one from
the session it opens, so a dsh run says what it is on from its first seconds.

## Group tasks

A group task is a folder with a `root.md` and its subtasks under it. The root is a tracking
card, not something you build directly:

- The root shows **no Implement button**. A group is finished by finishing its subtasks, one
  card at a time.
- The root's **Archive** button appears once every subtask on it is resolved — ticked off
  (done) or struck through (rejected). Archiving the root closes the whole group.
- A group root that never got any subtasks can't be archived that way. Close it with
  **Reject**.
- The root's **Release** box moves the whole group: every subtask under it, nested groups
  included, is written into the version you pick, and the dash takes them all back out.

The root keeps this record itself: when a subtask is archived its line on the root is ticked,
and when a subtask is rejected its line is struck through. So the outcome survives even after
the subtask files are gone.

## Configuration

The gear in the header opens the **Configuration** dialog. A sidebar on its left names the
sections — **Agent** and **Skill** — and a new group of settings joins as one more entry
there. It holds:

- **Agent** — pick the agent that every button spawns: **Claude Code**, **Codex**, **Cursor**,
  **OpenCode** or **DeepSeek Harness**. It runs in your repo root. See **Running on Codex**,
  **Running on Cursor**, **Running on OpenCode** and **Running on DeepSeek Harness** below
  for what changes when you switch.

  The picker marks the agents this machine can actually run. One whose CLI isn't on the
  board's `PATH` is dimmed and reads **not installed** — it can still be picked, and the
  line under the row then names the command that installs it. The agent you have picked is
  never dimmed; if its CLI is missing, that same line says so. It is a look at the `PATH`
  and nothing more — no agent is started — so it says the CLI is there, not that a run
  would work: that is **Test**. The look happens on every page load and every time the
  picker opens, so a CLI you install in a terminal counts the next time you open it. One
  installed somewhere the board's `PATH` doesn't reach stays dimmed until the board is
  restarted, which is honest: a run would not have found it either.
- **The agent's own settings** — under the agent rows, in the same section, sit the settings
  that agent takes. Each agent brings its own list, so the fields change when you pick
  another one. Claude Code takes these:
  - **Provider** — who pays for a run and where it goes: the **Claude subscription**, the
    **Anthropic API**, or an **Anthropic-compatible endpoint**. The pick decides which of the
    boxes below you see. See **Which provider a run goes through**.
  - **Endpoint base URL** — the address your gateway answers on. Only for the endpoint, and it
    has to be filled in before that pick will save.
  - **API key** — your Anthropic key, or the one your gateway issued. Only for the two
    providers that can take one. See **Keys** below.
  - **Model** — the model that agent runs with. Type an id, or leave it empty to let the agent
    use its own default.
  - **Reasoning effort** — how hard the model thinks on every run. Pick one from the list:
    Low, Medium, High, Extra high (xhigh), Max. Lower is quicker and cheaper, higher is
    slower and more careful. Leave it on **Agent's default** and the board passes nothing —
    the agent thinks however it thinks on its own.

  Codex takes two:
  - **Model** — the same box: the id Codex runs with, passed to it as `--model`. Leave it
    empty for its own default.
  - **OpenAI API key** — optional. Leave it empty and runs use the login your `codex` CLI
    already has. Fill it in and every run uses that key instead. See **Keys** below.

  Cursor takes two:
  - **Model** — the id Cursor runs with, passed to it as `--model`. There is no separate
    reasoning box: Cursor carries the level inside the model id itself, written like
    `claude-opus-4-8[effort=high]`.
  - **Cursor API key** — optional. Empty and runs use the login your `cursor-agent` CLI
    already has.

  OpenCode takes two:
  - **Model** — written as `provider/model`, because OpenCode reaches every provider and the
    name on its own wouldn't say which. `anthropic/claude-opus-5`, for instance.
  - **Reasoning effort** — a box you type in rather than a list, because the level is your
    provider's own word (`minimal`, `high`, `max`) and providers don't agree on the words.
    Empty lets the model think however it thinks.

  OpenCode has no key box, and that is deliberate: it reaches any provider and each one has
  its own key, so one box would hold the wrong key for most people. Its runs use the login
  `opencode auth login` already made.

  DeepSeek Harness takes two:
  - **Model** — the id dsh runs with, e.g. `deepseek-v4-flash`. It is chosen as the run's
    session opens rather than passed on the command line, because dsh carries its model
    catalog per session. Empty runs whatever dsh itself defaults to.
  - **DeepSeek API key** — optional. Empty and runs use the key dsh already saved in its own
    `$DSH_HOME`, so someone set up with `dsh web` types nothing here.

  Switching agents empties the fields — a Claude model id means nothing to Codex — and leaves
  your saved keys alone.
- **Test** — under those settings, a button that sends one tiny message through the setup you
  have saved and says whether it worked. On a failure it shows what the agent said. See
  **Testing the connection**.
- **Skill** — a section of its own: driving this same board from your coding agent. See
  **The coding agent skill** below.

There is no Auto-refine section any more, and no switch: a refine follows the run that
touched the card (see **The refine that follows a run**), so there is nothing to turn on.

Settings live in `docs/kanban/ui.config.json`, next to your board — so `npx` always serves
the latest UI and an update never touches your settings. Everything the dialog holds writes
itself there, with one exception: a key goes to `docs/kanban/.env` instead, and never to this
file (see **Keys** below).

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

`harness` is the agent that runs — a name, and nothing else. It decides everything about how
that agent runs: the command, the flags that make it stream its output into the live log, the
env vars, the flags the **Resume** button uses, and how a prompt calls the skill. Five agents
ship: `claude-code`, the default, plus `codex`, `cursor`, `opencode` and `dsh`. If the file
names an agent this UI doesn't
know, Claude Code runs and the dialog says so — you are never moved to a different agent
without being told.

`harnessSettings` is every agent's settings, each under its own name, whether or not it is
the one running. Switching agents changes `harness` and touches nothing else, so nothing is
ever lost: try Codex for an afternoon and your Claude Code model, provider and endpoint are
waiting where you left them — and Codex's are waiting the next time you go back. One agent's
model id or endpoint means nothing under another's name, which is why each keeps its own
block instead of sharing one. Only the running agent's block is read.

Inside a block, each key is one of the settings that agent takes. Each agent says which
settings it has and what each one is called, and the dialog draws that list — so the fields
you see always belong to the agent you picked, and a new agent is one entry rather than a new
box in the UI. Claude Code has four: `provider`, `baseUrl`, `model` and `reasoning`. Codex and Cursor have
one each, `model`. OpenCode has two, `model` and `variant`, and DeepSeek Harness one,
`model`. Their API keys are settings too,
but a key is never written to this file — keys
have their own place (see **Keys**), and they stay under the variable they were written for, so
switching agents never touches them.

`provider` is who pays for the run and where it goes — for Claude Code, one of `subscription`,
`anthropic-api` or `endpoint`. Leave it out and the board picks for you: `anthropic-api` on a
board whose `.env` already holds an Anthropic key, `subscription` otherwise. A value this UI
doesn't know reads as that same default, so the dialog and the run never disagree. `baseUrl`
goes with the `endpoint` pick and is the only setting the board insists on: it won't save that
pick without one.

`model` is the model that agent runs with, passed to it as `--model <id>`. One model
for every button — there's no per-action model. Leave it empty (or leave the key out) and the
agent runs its own default; the board never invents an id for you. Nothing here checks the id:
a wrong one makes the run exit right away, and the reason is in that run's log.

`reasoning` is how hard that model thinks, passed to it as `--effort <level>`. For
Claude Code the levels are `low`, `medium`, `high`, `xhigh` and `max` — the agent's own words,
not the board's, so another agent names its own. One level for every button, like the model.
Leave it empty (or leave the key out) and nothing is passed. Nothing here checks the level:
the dialog only offers the ones on the list, and a level you hand-write into the file that
the agent doesn't know makes it say so and run at its own default — that warning is in the
run's log.

A key no agent declares is left exactly where it is. Saving in the dialog writes the one
setting you changed, in the one block it belongs to, and touches nothing else in the file —
it's yours.

To run a custom binary of an agent, or add flags to it, add a `command` to that agent's block
by hand:

```json
{
  "harness": "claude-code",
  "harnessSettings": { "claude-code": { "command": "/my/bin/claude -p --model opus" } }
}
```

`command` is a path or flags **for the agent whose block it is in** — not a way to run a
different one. The harness always adds its own flags on top, and another agent's binary would
reject them. To run a different agent, pick it. The harness's flags never override one you set
yourself. If the override already names a setting's flag — a `--model`, say — it wins and that
setting is not added on top. One flag, one place it comes from, and the dialog says the field
isn't in effect, so a filled-in field never looks broken.

Each run reads the setting once, when it starts — flipping the picker while an agent is
working changes what the next run spawns, never the one in flight. And each run records the
agent it ran under, so **Resume** only ever offers to continue a run the agent you have
picked can actually reach: switch agents and a run the old one started stops offering it,
rather than handing its id to a CLI that never heard of it.

### The coding agent skill

Getting a board does not bring this with it. A new board is `docs/kanban/` and nothing else,
and the board works that way for good — every button here runs without it. What it adds is a
second way in: with it, you can say *"add a task"* or *"what's next"* to your coding agent in
your repo and it works this same board — the same cards, the same runs, the same files.

**Configuration → Skill** is where you turn that on. The pane says where the project stands
and one button does the rest:

- **Not installed** — nothing in either folder. **Add the skill** writes it.
- **Installed** — the version in each folder, beside the version this board runs on.
- **Out of date** — a folder written by an older release. The same button says **Bring it up
  to date**, and refreshes it.

Under the button it names the folders it touches — `.claude/skills/kanban/` for Claude Code,
`.agents/skills/kanban/` for Codex, Cursor, OpenCode and DeepSeek Harness — and after a press
it says, folder by
folder, what it
wrote. Each folder gets one file, `SKILL.md`: a short note saying the board is here and that
`akb` owns it. The rules themselves are not copied in — they live in the command. So this
writes a few kB in your repo and nothing else, and it never runs a global install.

That is why the pane carries one more thing: an answer to the `akb` on your PATH being
older than the copy this board runs on, or not being there at all. The note this button
writes points your agent at `akb`, and every flow it follows ships inside that command — so
an old `akb` means old flows even in a project whose note was just refreshed.

In the desktop app that answer is a second button, **Install the `akb` command**. The app
already carries the command; the button only points your system at the copy inside it, so
updating the app updates the command and there is nothing separate to keep fresh. It is one
link at `/usr/local/bin/akb` on macOS, written with the system's own password dialog, and
the app's own folder on your PATH on Windows. Before you press it the pane names the path it
would write, and which of four things is true right now: nothing installed; installed at
that path; installed but pointing at an app that is no longer there; or that path held by an
`akb` the app didn't put there — an npm install lands there too, and the button leaves it
alone. The app offers this once by itself, at the first launch that finds no `akb`; saying
no costs nothing.

In a browser, and on Linux where the AppImage has no lasting path to point at, the pane
hands you the line that fixes it instead — ready to copy, and yours to run.

If you never want it, you never need it. Nothing else in the board asks for it — except the
two places that hand you a line to paste into a coding agent (the first run's handover, and
the setup strip on the board), which say the skill isn't there and offer this pane instead of
a line that would reach nothing.

### Running on Codex

Pick **Codex** in the Configuration dialog and every button spawns
`codex exec --json --sandbox workspace-write` instead. Nothing else about the board changes:
the same cards, the same buttons, the same files.

You need the `codex` CLI on your PATH, signed in — a ChatGPT subscription runs the board the
same way a Claude one does. **Codex 0.94 or newer**, which is when it started reading skills
from `.agents/skills/`; the board's install writes the skill there as well as into
`.claude/skills/`, so every agent finds it with nothing to set up. (Resuming a run needs
`codex exec resume`, which has been there since 0.35, so the skills version is the one that
matters.)

Its two settings sit under the agent rows: a **Model** box, passed to Codex as `--model`, and
an optional **OpenAI API key** (`OPENAI_API_KEY`) — leave that empty and runs use the login
your `codex` CLI already has.

Four things read differently on Codex:

- **A run stays inside your repo.** `--sandbox workspace-write` lets it write in the working
  folder and nowhere else, gives it no network, and makes it refuse to start outside a git
  repo. If your work needs more than that, widen it yourself with a `command` of your own — a
  `--sandbox` you name there is the one that runs, and the board adds none on top.
- **A rate limit waits instead of failing.** Claude Code is run with retries off, so a limit
  ends the run at once and frees the card. Codex has no such switch: a rate-limited run sits
  there retrying, holding the card, until it gets through or gives up. Nothing on the board
  is stuck — every other card still works — but that one run may take a long while.
- **No cost.** Codex reports no price for a run, so its log shows the duration and nothing
  where Claude Code shows `est. $0.42`.
- **No model name.** Codex never names the model in its output, and the board shows what the
  run itself said rather than what the Model box holds — so a Codex log names no model, even
  when you filled that box in.

**Resume** works: Codex mints its own thread id, the board catches it from the run's first
event and keeps it with the session, and Resume continues that thread with
`codex exec resume <thread-id>`.

### Running on Cursor

Pick **Cursor** and every button spawns `cursor-agent -p --output-format stream-json --force`
instead. Same cards, same buttons, same files.

You need the `cursor-agent` CLI on your PATH, signed in. It is the one agent of the five that
doesn't come from npm — it installs from a script, `curl https://cursor.com/install -fsS | bash`,
which is the line the picker hands you when it isn't there.

Its two settings sit under the agent rows: a **Model** box, passed as `--model`, and an
optional **Cursor API key** (`CURSOR_API_KEY`) — leave that empty and runs use the login your
`cursor-agent` CLI already has.

Three things read differently on Cursor:

- **A run answers its own prompts.** `--force` lets it use its tools without stopping to ask.
  A board run has nobody to answer, and Cursor's own answer to an unanswered question is to
  refuse — so without this the run would end having changed nothing. Cursor's docs name this
  flag for exactly this case.
- **No cost.** Cursor's output reports no price and no token counts, so its log shows the
  duration and nothing where Claude Code shows `est. $0.42`.
- **No reasoning box.** Cursor carries the thinking level inside the model id itself —
  `claude-opus-4-8[effort=high]` — so there is nothing separate to set.

The model name does show: Cursor names it in the run's opening event, so a Cursor log reads
like a Claude Code one there. **Resume** works too — Cursor mints its own session id, the
board catches it from the first event, and Resume continues with `cursor-agent --resume <id>`.

### Running on OpenCode

Pick **OpenCode** and every button spawns `opencode run --format json` instead. Same cards,
same buttons, same files.

You need the `opencode` CLI on your PATH and logged in with `opencode auth login`. It
installs from a script rather than npm: `curl -fsSL https://opencode.ai/install | bash`.

Its two settings are a **Model** box and a **Reasoning effort** box. Both differ from the
other agents:

- **The model is written `provider/model`** — `anthropic/claude-opus-5`, `openai/gpt-5.1`.
  OpenCode reaches every provider, so the model name alone wouldn't say which one to use.
- **Reasoning effort is a box, not a list.** The level is your provider's own word for it —
  `minimal`, `high`, `max` — and providers don't agree on the words, so the board offers no
  list that could go stale.

Three things read differently on OpenCode:

- **No API key box.** OpenCode reaches any provider and each has its own key, so one box
  would be the wrong key for most people. Runs use whatever `opencode auth login` saved.
- **No model name.** OpenCode names the model only in its formatted output, never in the
  event stream the board reads — so an OpenCode log names no model, even with the Model box
  filled in.
- **A run stays inside your repo, with nothing to set.** Left alone OpenCode writes in the
  working folder and refuses anything outside it, which is what a board run wants. There is
  no flag to widen it in the version people install today.

Cost does show, and token counts with it: OpenCode reports both per model call and the board
adds them up, so its log reads like a Claude Code one there. **Resume** works — the session
id rides on every event, and Resume continues with `opencode run --session <id>`.

### Running on DeepSeek Harness

Pick **DeepSeek Harness** and every button spawns `dsh-acp --permission-mode workspace-write`
instead. Same cards, same buttons, same files.

You need two npm packages, not one, and they go in one at a time:

```sh
npm install -g @deepseek-ai/dsh
npm install -g @openma/deepseek-harness-acp
```

The first is DeepSeek Harness itself; the second is the bridge that lets the board talk to
it. Asking for both in a single `npm install -g` looks tidier and leaves you with a bridge
that has no dsh underneath it — it exits on its first import. Run in turn, the bridge brings
its own dsh along, which is the one the board points it at.

If you already asked for both at once, **Test** says the agent did not answer. Put the
bridge in again on its own to repair it:

```sh
npm uninstall -g @openma/deepseek-harness-acp
npm install -g @openma/deepseek-harness-acp
```

dsh's own headless command says nothing until it has finished and can't carry on an earlier
run, so the board uses neither — it holds a conversation with `dsh-acp` instead, and that is
what makes a dsh log live and a dsh **Resume** work.

Its two settings are a **Model** box and a **DeepSeek API key** box, and both can stay empty:

- **The model is chosen as the run's session opens**, not passed on the command line, because
  dsh carries its model catalog per session. Type an id like `deepseek-v4-flash`, or leave it
  empty for dsh's own default. An id dsh doesn't have fails the run and the log says which.
- **The key is optional.** Empty and a run uses whatever key dsh already saved in `$DSH_HOME`
  — the same one `dsh web` writes — so someone already set up with dsh types nothing here.
  Fill it in and every run uses that key instead.

Two things read differently on DeepSeek Harness:

- **The board answers it, rather than only reading it.** Every other agent prints its work
  and exits. dsh keeps talking, and the board keeps answering, for as long as the run lasts.
  Nothing about the board changes because of it: the log, the stop, the resume and the refine
  that follows all work as they always did.
- **A run stays inside your repo, and a request to leave it is turned down.** The permission
  preset the command starts under lets a run write in the working folder without asking, and
  raises a question for anything beyond it. The board answers that question with no, and
  writes `[refused]` into the log, so a run that couldn't reach something says so.

The model name shows — dsh names the model on the session it opens, so a dsh log says what it
is on from its first seconds. Cost and token counts show when dsh reports them. **Resume**
works: the session id comes back the moment the session opens, and Resume carries on in that
same dsh session, with the history it already holds.

### Which provider a run goes through

Every run has to go through somebody's account. **Provider**, at the top of the Agent
section, is where you say whose. Claude Code offers three:

| Provider | What it is | What it needs |
| --- | --- | --- |
| **Claude subscription** | The login your `claude` CLI already has. | Nothing. |
| **Anthropic API** | Pay per token on an Anthropic key. | The **API key** box. |
| **Anthropic-compatible endpoint** | A gateway that answers in the Anthropic format — OpenRouter, LiteLLM, a company proxy. | The **base URL**; a key only if that gateway asks for one. |

**You only see the boxes your pick uses.** The subscription shows neither, the Anthropic API
shows the key, the endpoint shows both. The endpoint is the one pick the board won't save
without its box: type the base URL and the pick saves itself the moment it's there. A key is
never demanded — you can write one into `docs/kanban/.env` by hand at any time, so the board
doesn't treat an empty box as a mistake.

**Your pick decides the whole environment a run starts in.** It sets what it needs, and it
clears everything else that could send Claude Code somewhere: the other providers' variables,
and the ones for providers this board doesn't offer yet (Bedrock, Vertex, Foundry). So an
`ANTHROPIC_BASE_URL` you exported in your shell months ago can't quietly route a
**Claude subscription** run through a gateway while the dialog says otherwise. Your cloud
credentials themselves — `AWS_PROFILE`, `GOOGLE_APPLICATION_CREDENTIALS` and the like — are
left alone: they move nothing once the switch above them is gone, and the agent may need them
for the work it's doing in your repo.

**Changing your mind costs nothing.** The base URL and the key stay in their boxes when you
pick something else, so flipping between two providers never asks you to type either again.
Only what the new pick needs reaches the next run.

**Defaults keep an existing board running as it is.** A board that never picks anything runs
on the subscription. A board whose `.env` already holds an Anthropic key reads as the
Anthropic API instead, so the key it was already using goes on being used.

**There is no "OpenAI" entry, on purpose.** Claude Code speaks the Anthropic API and nothing
else. An OpenAI model reaches it through a gateway that answers in the Anthropic format —
that's the endpoint entry, with the gateway's own base URL. To run Codex on an OpenAI account,
pick Codex.

Codex, Cursor, OpenCode and DeepSeek Harness have no provider list: each runs on whatever
login its own CLI has, plus the optional key where it takes one, and their runs inherit your
shell environment as they always did. OpenCode is the one that reaches every provider by
itself — you pick that provider in its model id, `provider/model`, and its own
`opencode auth login` holds the key. DeepSeek Harness reads the key dsh itself saved.

### Testing the connection

**Test**, at the bottom of the Agent section, answers one question: does this setup actually
run? Without it you only find out on the first card run that fails — the `claude` CLI isn't
logged in, the key was revoked, the gateway is down, the model id is wrong.

It sends one tiny message — "Reply with OK and nothing else." — through the agent, spawned
exactly the way a card run is: the same command, the same environment. So a test that passes
is a card run that starts. Nothing reads the answer; that the agent answered at all is the
pass.

**It tests what is saved**, not what you have half-typed. Every box in the dialog saves as you
change it, so the two are normally the same thing — the one exception is a provider pick still
waiting on a box, and Test stands down until that pick is saved.

What the panel under the button says:

- **Passed**, with how long it took.
- **Failed**, then the agent's own words — the same lines that agent's run log would show, and
  nothing written on top of them. "Not logged in · Please run /login", "API Error: 401 API key
  is invalid", "Unable to connect to API (ConnectionRefused)", "There's an issue with the
  selected model (…)". A guess laid over a real error message would only send you the wrong
  way, so there isn't one.
- **The CLI isn't installed** is the one case the board puts in its own words, because
  `spawn claude ENOENT` tells you nothing. It names the command that's missing and the command
  that installs it.
- **No answer after a minute** and the test gives up and reports that, so a dead endpoint never
  leaves the panel spinning.

A test costs a few tokens on a paid provider — the line beside the button says so. It is not
board work: no card is touched, no card is locked, nothing joins the queue, and it never shows
up in the **Sessions** panel. Close the dialog and the result is gone; it's a check you run
while you're looking at the setup, not a job the board keeps.

### Keys

Keys live in **`docs/kanban/.env`**, next to `ui.config.json`. That is the only place the
board keeps one — never `ui.config.json`, never a shell profile, never anywhere else.

There are two ways to set one, and they agree:

- Type it into the Configuration dialog and press **Save**. It lands in `docs/kanban/.env`.
- Or write the line in that file yourself:

  ```
  ANTHROPIC_API_KEY=sk-ant-…
  ```

Plain `NAME=value` lines, one per line. Blank lines and lines starting with `#` are skipped,
and a value in quotes is read without them. The board reads the file for *which* keys it
holds, so a key you write by hand shows in the dialog as set and works in the next run — no
restart, nothing to keep in step.

Saving from the dialog rewrites that one line. Every other line — a key the board doesn't
know, a comment, the order they sit in — is left alone. It's your file.

**The file is kept out of git.** `docs/kanban/.gitignore` carries `.env`, so the key can't
be committed. `kanban init` writes it when it makes the board — and adds it to an older
board when you re-run it — so a key you write by hand yourself is covered from the first
day. Saving from the dialog makes sure of it too. A `.gitignore` already there gets the
line added, not replaced. Commit that `.gitignore`; never commit the `.env`.

**A saved key is never shown back.** The box hides what you type, and once it's saved the
dialog says the key is set, with **Replace** and **Clear** beside it. The key is never on
screen, never in a run's log, and never on a command line.

**What a run gets.** When a run starts, the board sets the variables from `docs/kanban/.env`,
so what the dialog shows is what the run uses. On Claude Code the key goes out under the
variable its provider uses, and only that one: `ANTHROPIC_API_KEY` for the Anthropic API,
`ANTHROPIC_AUTH_TOKEN` for a gateway — which is what OpenRouter, LiteLLM and the rest read.
A gateway run also gets `ANTHROPIC_API_KEY` explicitly empty, because Claude Code reads a
key there as its own login and turns your claude.ai connectors off when it finds one. A key
belongs to the provider you picked: on the **Claude subscription** it isn't sent at all,
even when it's saved.

Four of the five agents take one key each, and it is **optional** every time: Claude Code's
is `ANTHROPIC_API_KEY`, Codex's is `OPENAI_API_KEY`, Cursor's is `CURSOR_API_KEY`, and
DeepSeek Harness's is `DEEPSEEK_API_KEY`. Leave it empty and runs use whatever login that CLI
already has — for dsh, the key it saved in its own `$DSH_HOME` — which is how the board has
always worked. Clear it and the next run goes straight back to that login. OpenCode takes no
key here at all: it reaches any provider and each has its own, so its runs use the login
`opencode auth login` made. The keys sit side by side in the file — switching agents, or
providers, never touches any of them, so a key you gave once is still there when you come
back.

### When a run fails or is interrupted

A run that stopped short — the peach dot in the sessions panel — shows a **Resume** button. It
sends one more turn into that same conversation (`claude --resume <id>`,
`codex exec resume <thread-id>`, `cursor-agent --resume <id>` or `opencode run --session <id>`,
run for you — and on DeepSeek Harness, the same dsh session reopened with its history), so the
agent picks up where it stopped instead of starting the task over. Nothing is copied and you
never see an id.

Two things stop a run short, and the log says which. It **exited** with a non-zero code: the
agent itself gave up, and the reason is in its output. Or it was **interrupted**: the board
was still running it when the UI server died, so the agent ended out of our sight — no exit
code, no final message, no reason to think the work is done. An interrupted run is never
shown as finished, and its duration is marked `~` because it's an upper bound: the board only
learns the run ended when it next checks the process, which may be long after the fact.

Resume is a normal run — its own live log, on the same card and the same action as the run
it continues. So the card lock still holds — you can't resume a card another run is already
working on — and the resumed run can be resumed again if it fails too.

It **takes the place** of the run it continues: the row it started from disappears, marked
`resumed`, and the panel keeps one row for the work rather than a chain of dead attempts. That
also drops the old run's log, so read anything you want from it before you press the button.

Only a run that stopped short offers it. A run that passed has nothing to continue, a run you
stopped yourself is over rather than short (see **Stopping a run**), and a run whose
conversation the agent can't reach (it never reported an id, or a different agent is picked
now) shows no button rather than one that could only fail. If the conversation itself has
expired, the resume ends as a failed run with the reason in its log, like any other failure.

When the agent is Claude Code, the server runs it with `CLAUDE_CODE_MAX_RETRIES=0`. Claude Code
normally retries a rate limit with a long backoff, which would leave a run stuck for the best
part of an hour while the card stays locked. With retries off, a rate limit ends the run right
away and the board shows it failed. Note this is not a spend control: whether hitting your
plan's limit spills into paid extra usage is an account setting on claude.ai, not something
the CLI can turn off.

No other agent has an equivalent switch, so a rate-limited Codex, Cursor, OpenCode or
DeepSeek Harness run waits it out and holds its card while it does — see **Running on Codex**.

## When it finds no board

Start the UI somewhere with no board and the page says **There is no board here**, and names
the folder it searched. It takes over the whole screen — there is nothing to show a header or
buttons for until a board exists. The terminal says the same thing when the server starts.

Two things it could be, and the page gives both:

- **This repo has no board yet.** Make one — run `npx ai4kanban install` in the repo root.
- **This is not the repo you meant.** Stop the UI and start it from your repo root, or point
  it at the repo: `npx ai4kanban-ui --board /path/to/repo`.

The UI never sets a board up for you. Install one in a terminal, switch back to the tab, and
the board is there — no reload.

A board that exists but has no copy of the board's rules to read it with is its own page too:
**This board can't be read**. The rules live in the `akb` command, not in your repo, so the
line it hands over is `npm install -g ai4kanban`. In the app there is nothing to run: it
carries its own copy, and reopening the project picks it up.

A board that exists but has a card the UI can't read is a different thing: that board still
opens, with the error in a strip above it.

## Run it from source

Only if you're changing the UI itself. Build, then start the production server (not
`next dev` — run the app the way it ships):

```
cd kanban-ui
npm install                 # first time only
npm run build
PORT=7420 npm run start     # http://localhost:7420
```

To reproduce the exact `npx` package (standalone server): `npm run build:standalone` then
`node bin/kanban-ui.mjs`.
