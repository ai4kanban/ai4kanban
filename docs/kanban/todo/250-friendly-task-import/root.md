---
title: Bring a task in from a file or your voice, not only typed text
track: features
priority: med
roi: high
status: todo
release: ""
blocked_by: []
related: [251, 252, 253]
modules: [local-ui, skill]
questions: []
---

Today the only way to put work on this board is to type it into the Create task box.
Anything the user already wrote down, or would rather just say out loud, has to be retyped
or pasted in as a wall of text. Give the board other ways in — a file, your voice — and put
one rewriting step in front of all of them, so a run plans cards from a short brief instead
of from raw material. This is a group task; each piece is its own subtask in this folder.

## Scope
- Three ways to bring work in: typed text (today), a file the user picks, words the user
  speaks.
- Every way in ends at the same place: a short brief (#251). Raw material is never handed
  to the card-writing flow as-is.
- The brief carries only what the material actually says. What it leaves open becomes an
  open question on a card, never a guess the run made up.
- The user can read the brief and fix a wrong reading before any card is written.
- Cards are still created by `akb guide add-task` and the board's own moves. No way in
  writes a card by itself.
- What the user brought in stays theirs: an attached file is read where it sits, a
  recording is dropped once it is text, and neither is copied into the board or into git.
- Every card says where it came from, so a card written from a file or a recording can be
  traced back.
- Out of this group: pulling work from Notion, GitHub Issues or Obsidian (a connector, and
  we said no to building those into the open core), email and webhook intake, and importing
  a whole board from another tool.

## Todo
- [ ] Rewrite raw material into a short brief before any card is written #251
- [ ] Attach a file to Create task instead of retyping it #252
- [ ] Speak a task instead of typing it #253

## Decided by the agent
- **Why a rewriting step rather than a bigger prompt**: length is not the problem. Raw
  material has no shape, so a run cannot tell an aside from a requirement, and it fills the
  quiet parts with invention. The brief is where the reading can be checked before ten cards
  are built on it.
- **Why file and voice are one group**: they differ only in how the words arrive. Both need
  the brief, so building either alone builds half of the path.
- **Why this is not the outside connector we turned down**: a file the user picks and words
  the user speaks are material the board can already read. Nothing calls another product's
  API.
- **The flow that turns a spec file into cards already exists as #157**: this group gives it
  a way in from the app and a brief in front of it. It does not write a second flow.

### Worth noting
- **Voice is the lowest priority of the three**: it is the least proven, and it needs a way
  to turn speech into text that the board does not have today. If only one piece ships, it
  should be the file.
