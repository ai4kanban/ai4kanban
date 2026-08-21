---
title: Attach a file to Create task instead of retyping it
track: features
priority: med
roi: med
status: todo
release: ""
blocked_by: []
related: [250, 157]
modules: [local-ui, skill]
questions:
  - question: "[user] Which files can be attached?"
    mode: single
    options:
      - plain text and markdown only — everything else is out of scope
      - also PDF and Word, converted to text first
      - also screenshots and photos, read by the model
    recommend: [1]
  - question: "[user] Which layout for the file in Create task? — see the `ui-design` section"
    mode: single
    options:
      - B — the file as a bar inside the text box's own frame; costs the box some height and cuts a long file name short
      - A — the file as a chip on a row under the box; least disruptive, but reads as an afterthought
      - C — the file in a panel beside the box; nothing truncates, but the typing area loses a third of the width
    recommend: [1]
---

Create task takes typed words and nothing else. Someone who already wrote the thing down —
a spec, a meeting note, a list in a document — has to retype it, or paste pages of text into
a small box. Let them hand the board the file instead.

## Scope
- The Describe tab of Create task takes a file: pick one, or drop it on the box.
- Typed text and a file travel together — the text says what to do with the file.
- Either one alone is enough to start.
- One file per create; a folder of documents is out.
- In the desktop app the run is given the file's path and reads the file where it sits.
- In a browser tab the browser hands over the file's text.
- That text is written into the run's own folder, `docs/kanban/.sessions/`, and the run is
  given its path.
- The file's text never travels inside the words the run is started with.
- No copy lands in git, and no card holds one.
- The copy goes when the run's log goes.
- What the file holds decides which flow reads it: a plan goes to `akb guide plan-from-spec`
  (#157), an article or a complaint to `akb guide extract-ideas`, anything else takes the
  same path as words the user typed.
- `akb guide add-task` makes that pick.
- The dialog never asks the user which kind of file this is.
- The dialog shows the file's name and its size.
- The user can take the file off before starting.
- A file the board cannot read is refused in the dialog, in plain words, before a run starts.
- Length is not a reason to refuse.
- The new card's `## Source` names the file it came from.
- The run's log says which file it read.
- Where the user typed nothing, the runs panel shows the file's name as the run's input.
- The rules in `akb guide add-task` still hold. Work the file describes that is already on
  the board updates the card that owns it.
- Work the file describes that is already built is skipped.

## Todo
- [ ] Add file picking and drag-and-drop to the Describe tab of Create task.
- [ ] Show the chosen file's name and size, and let the user take it off.
- [ ] Send the file with the request, alongside whatever the user typed.
- [ ] Refuse a file the board cannot read, in the dialog, before the run starts.
- [ ] Hand the run a path in the app, and a file in the run's folder in a browser — never
      the file's text in the run's prompt.
- [ ] Delete the browser's copy when the run's log is deleted.
- [ ] Let the router pick the flow that reads the file, without asking the user.
- [ ] Name the file in the new card's `## Source`, and in the run's log.
- [ ] Show the file's name as the run's input where the user typed nothing.
- [ ] Say in `kanban-ui/README.md` that Create task takes a file, and which files it takes.
- [ ] Add a line to `web/` copy about handing the board a file (doc only — do not touch
      page code).
- [ ] Try it end to end with a real spec file and check the cards it wrote.

## By `ui-design` agent

### The screen

The Describe tab of Create task, with a file chosen. The text box still takes typed words;
the file sits next to it as its own object, showing the file's name and its size, with one
control that takes it off again. Picking a file and dropping one on the box both land here.

A file the board cannot read never becomes an attachment. In its place the dialog says, in
plain words, that it cannot read this file and what kind of file to hand over instead. The
user dismisses that line; nothing is refused after the run starts.

### The layouts

<Mockup src=".mockups/252/a.tsx" label="A" />
The file is a chip on a row under the box. Nothing about the text box changes, so a user who
only types sees the dialog they already know — but the file is the quietest thing on screen
and reads as an afterthought rather than half the input.

<Mockup src=".mockups/252/b.tsx" label="B" />
The file is a bar across the top of the text box's own frame, so the file and the words are
visibly one input being sent together. It costs the box some height, and a long file name
has to be cut short to fit one line.

<Mockup src=".mockups/252/c.tsx" label="C" />
The file gets a panel beside the box, so its name, size and Remove are all full size and
never truncate. It costs the typing area a third of the dialog's width, which is the part
most people use most.

**Recommended: B.** The card's rule is that the text and the file travel together and either
one alone is enough — one frame holding both says that, where A's chip reads as an extra and
C splits them into two inputs. It also gives the refusal a fixed place: the same bar, in the
same spot the file would have been.

## Decided by the agent
- **One file, not many**: two files are usually two ideas. Turning a pile of documents into
  a board is #157's job, from a coding agent, not a dialog.
- **The file is not copied into the board**: the board lives in git and a user's document is
  theirs. Reading it is enough.
- **Why the browser's text is written to the run's folder**: a document sent as the run's
  prompt is copied into the run's record and shown as the run's label. A file the run opens
  keeps it in one place.
- **How the router tells a plan from an article**: it reads what the user typed alongside
  the file first, then the file's opening. When it still cannot tell, the file is read as a
  plan — that reading drops nothing.
- **The flow that reads a spec and plans the cards is #157**: this card is the way in from
  the app. It does not write a second reading flow.

### Worth noting
- **No size limit on the file**: the flow that reads a long plan reads it in sections
  (#157), so a number here would refuse a file the board can handle. What is refused is a
  file the board cannot read.
