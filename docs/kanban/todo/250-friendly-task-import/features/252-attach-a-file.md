---
title: Attach a file to Create task instead of retyping it
track: features
priority: med
roi: med
status: todo
release: ""
blocked_by: [251]
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
---

Create task takes typed words and nothing else. Someone who already wrote the thing down —
a spec, a meeting note, a list in a document — has to retype it, or paste pages of text into
a small box. Let them hand the board the file instead.

## Scope
- The Describe tab of Create task takes a file: pick one, or drop it on the box.
- Typed text and a file travel together — the text says what to do with the file, and either
  one alone is enough to start.
- One file per create. A folder of documents is not this card.
- The file is read where it sits. Nothing is copied into the board, and nothing lands in git.
- In the desktop app the board is given the file's path; in a browser tab the browser hands
  over the file's text, because a web page never learns a real path. Either way the run
  reads text.
- What is read goes through the brief (#251) before any card is planned.
- The dialog shows the file's name and its size, and the user can take it off before
  starting.
- A file the board cannot read, or one too big, is refused in the dialog in plain words —
  before a run starts, not halfway through one.
- The new card's `## Source` names the file it came from.
- The run's log says which file it read.
- The add-task rules still hold: work the file describes that is already on the board
  updates the card that owns it, and work already built is skipped.

## Todo
- [ ] Add file picking and drag-and-drop to the Describe tab of Create task.
- [ ] Show the chosen file's name and size, and let the user take it off.
- [ ] Send the file with the request, alongside whatever the user typed.
- [ ] Refuse an unreadable or oversized file in the dialog, before the run starts.
- [ ] Read the file through the brief step (#251) rather than into the prompt.
- [ ] Name the file in the new card's `## Source`, and in the run's log.
- [ ] Try it end to end with a real spec file and check the cards it wrote.

## Decided by the agent
- **One file, not many**: two files are usually two ideas. Turning a pile of documents into
  a board is #157's job, from a coding agent, not a dialog.
- **The file is not copied into the board**: the board lives in git and a user's document is
  theirs. Reading it is enough.
- **The flow that reads a spec and plans the cards is #157**: this card is the way in from
  the app. It does not write a second reading flow.
