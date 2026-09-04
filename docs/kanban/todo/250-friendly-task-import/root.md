---
title: Bring a task in from a file or your voice, not only typed text
priority: med
roi: high
status: todo
release: ""
blocked_by: []
related: [251, 252, 253]
modules: [local-ui, skill]
questions:
  - question: "[user] Voice (#253) is the one piece nobody has asked for, and it needs a way to turn speech into text that the board does not have today. Is it in?"
    mode: single
    options:
      - keep it in the group, built last — after the file picker has shown the brief does its job
      - "drop it: reject #253, and this becomes a group about files only"
      - build it now, alongside the file picker
    recommend: [1]
---

Today the only way to put work on this board is to type it into the Create task box.
Anything the user already wrote down, or would rather just say out loud, has to be retyped
or pasted in as a wall of text. Give the board other ways in — a file, your voice — send
each one to the flow that reads that kind of material, and put a short brief in front of the
loose notes people type or speak. A brief is four short parts: what is wanted, why it
matters, what is out, and what the material never says. This is a group task; each piece is
its own subtask in this folder.

## Scope
- Three ways to bring work in: typed text (today), a file the user picks, words the user
  speaks.
- `akb guide add-task` is the router: it reads what arrived and picks the flow for it.
- A task idea the user typed or spoke goes through the brief (#251) first, unless it is
  already short and clear.
- A plan the user already wrote goes to `akb guide plan-from-spec` (#157), which reads it
  whole.
- An article, a complaint or a write-up goes to `akb guide extract-ideas`, as it does today.
- What the user brought in — the document, the transcript, word for word — never travels
  inside the words a run is started with. The run is given a path and opens it.
- What the material leaves open becomes an open question on a card.
- A run never invents an answer the material does not give.
- Cards are still created by `akb guide add-task` and the board's own moves.
- No way in writes a card by itself.
- No card holds a copy of what the user brought in.
- Nothing the user brought in lands in git.
- In the desktop app an attached file is read where it sits.
- In a browser tab the text the browser hands over is written into the run's own folder,
  `docs/kanban/.sessions/`.
- That copy goes when the run's log goes.
- A recording is dropped as soon as it is text.
- Every card written this way names in `## Source` the file it came from, or says it was
  spoken and when.
- Both new ways in are written into `kanban-ui/README.md`.
- The brief step is written into the daily-loop guide.
- The site copy gains a line about handing the board a file.
- Out of this group: pulling work from Notion, GitHub Issues or Obsidian.
- Also out: email and webhook intake, and importing a whole board from another tool.

## Todo
- [ ] Rewrite raw material into a short brief before any card is written #251
- [ ] Attach a file to Create task instead of retyping it #252
- [ ] Speak a task instead of typing it #253

## Decided by the agent
- **Why a rewriting step rather than a bigger prompt**: length is not the problem. Loose
  notes have no shape, so a run cannot tell an aside from a requirement, and it fills the
  quiet parts with invention. The brief is where the reading can be checked before ten cards
  are built on it.
- **Where the brief sits**: behind the router, on a task idea the user gave in their own
  words. A source and a written plan each already have a flow that reads them whole, and a
  short brief in front of either is a second, thinner reading of the same material.
- **A spec file is checked once, not twice**: #157 lists the cards it is about to write, and
  that list is the check. It does not also pass the brief.
- **Why the outside connectors are out**: Notion, GitHub Issues and Obsidian read another
  product's API, and they are planned elsewhere (#313, #56). A file the user picks and words
  the user speaks are material the board can already read.
- **Why file and voice are one group**: they are the two ways into the Create task dialog
  that the app is missing, they land in the same box, and the same router decides what
  happens to either.
- **Where a browser tab's text sits**: in the run's own folder beside its log, named for the
  run. That folder is already out of git, holds no cards, and is cleared with the log.

### Worth noting
- **Voice is the lowest priority of the three**: it is the least proven, and it needs a way
  to turn speech into text that the board does not have today. If only one piece ships, it
  should be the file.
- **The file picker does not wait for the brief**: a file holding a plan goes to #157 and a
  file holding an article goes to extract-ideas, so #252 is useful on its own. Voice still
  waits — a two-minute ramble is exactly what the brief is there to catch.
