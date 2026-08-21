---
title: Point at a card, a file, a memory note or a flow in the chat box
track: features
priority: med
roi: med
status: todo
release: ""
blocked_by: []
related: [266]
modules: [local-ui]
questions:
  - question: "[user] Which layout for the picker over the chat box? — see the `ui-design` section"
    mode: single
    options:
      - A — one line a row, a MEMORY chip on the notes; ten entries fit, and the panel stands on the tail of the conversation
      - B — two lines a row under Memory/Files headings; nothing clipped, six entries
      - C — the list inside the box; nothing covered, the conversation shrinks as you type
    recommend: [1]
verify:
  - try `@` in a big repo of your own — the list should keep up with your typing
---

Everything the user wants to point at has to be typed out in full — a card number from
memory, a file path from another window.

## Today
- The chat box is plain. `@` and `#` are ordinary characters in it.
- The agent's replies turn a `#12` into a link to that card. Nothing helps the user write
  `#12` in the first place.
- To say "look at kanban-ui/lib/chat-rail.ts" the user goes and finds that path themselves.

## Scope

### What each key offers
- **`#` offers the open cards**, matched on id and on title.
- Picking a card puts `#12` in the message.
- **`@` offers the project's files**, matched on the whole path, so typing `chat-rail` finds
  `kanban-ui/lib/chat-rail.ts`.
- Picking a file puts that path in the message, written from the project's top folder.
- **The memory notes and `goal.md` come first in the `@` list.**
- **`/` offers the flows the board runs**: refine, resolve, revise, implement, propose,
  plan-release, run, spec.
- Picking a flow writes plain words — `Refine #12` — never a typed command.
- **Nothing is fetched, read or attached.** The message carries the number or the path and
  nothing else.

### How the list behaves
- A small white list over the box, drawn like the rest of the chat rail.
- About ten entries at a time.
- Closest match first.
- It appears as the user types, and typing never waits for it.
- A repo with tens of thousands of files types as smoothly as an empty one.
- **↑ and ↓ move the choice, Enter picks, Esc closes the list and leaves what is typed.**
- While the list is up, Enter picks and does not send the message. Sending takes one more
  Enter, once the list has closed.
- While the list is up, ↑ and ↓ move the choice and do nothing else.
- **`#` and `@` only fire at the start of a word.** An email address, or `issue#12`, leaves
  the box alone.
- **`/` only fires as the first character in the box.**
- Nothing matching means no list, and what was typed stays as typed.
- Once Esc has closed the list, typing more of the same word does not bring it back.
- Files the project hides are never offered: whatever `.gitignore` covers, and `.git` and
  `node_modules` with it.
- The board's chat and a card's chat behave the same way.

## Scope out
- No attaching an image or a file's contents. That is #252, the card for attachments.
- No pointing at a folder, a run, or a release.
- `akb chat` in a terminal is unchanged.

## Todo
- [ ] Add the picker: a short list over the chat box, drawn like the rest of the rail.
- [ ] Drive it from the keyboard — ↑ and ↓ move, Enter picks, Esc closes.
- [ ] Keep Enter and the arrow keys from reaching the box while the list is up, so a pick
      never sends the message.
- [ ] `#` lists the open cards by id and title, and puts `#12` in the message.
- [ ] `@` lists the project's files by path, with the memory notes and `goal.md` first.
- [ ] Put the picked file's path in the message, written from the project's top folder.
- [ ] Leave out whatever `.gitignore` hides.
- [ ] Keep the list quick on a repo with tens of thousands of files.
- [ ] `/` lists the flows, and writes the picked one as plain words.
- [ ] Fire `#` and `@` only at the start of a word, and `/` only as the box's first
      character.
- [ ] Cover it in `kanban-ui/README.md`, in the Chat section.

## By `ui-design` agent

### Where the list sits

Over the chat box at the foot of the rail: the same width as the box, its bottom edge on
the box's top edge, about ten entries deep. The box, the line under it and the Send button
never move, so what the user is aiming at stays put while the list opens and closes. The
rail is 360px by default and can be dragged down to 288px, so every row is one column of
text that clips rather than wraps.

### What a row says

- **A card**: `#266` in mono, then the title, cut at the end when it is too long.
- **A file**: the path from the project's top folder, in mono, with the file's own name the
  strongest part of it and the folders quiet behind. A path too long for the rail loses its
  front, never its name.
- **A flow**: the flow's name, then what it does in one quiet line — *Refine — sharpen a
  card until it can be built*. No row shows the words the pick will write, because #263 has
  not settled them.

### The options

<Mockup src=".mockups/271/a.tsx" label="A" />
One line a row in a paper panel with the board's ink frame and hard shadow; the chosen row
is an accent-soft fill with an ember bar down its left edge and a `↵` at its end, a memory
note carries a small `MEMORY` chip, and the line under the box swaps to `↑↓ choose · Enter
picks · Esc closes`. Ten entries fit at the rail's default width — the cost is a panel
standing on the last few lines of the conversation, and the longest paths clipped.

<Mockup src=".mockups/271/b.tsx" label="B" />
Two lines a row — the name, then the folder or the card's id under it — with the memory
notes under their own `Memory` heading and the rest under `Files`, the keys on a foot line
inside the panel, and the box's own line dimmed while the list is up. Nothing is ever
clipped and the two kinds of file are named in words; the cost is a panel twice as tall for
six entries, hiding most of the conversation, and a card's id sitting on the second line of
a row the user is picking by id.

<Mockup src=".mockups/271/c.tsx" label="C" />
The list is inside the box rather than over the conversation: one framed region grows
upward from the box, the chosen row goes ink with cream text, and a memory note reads as its
name and its module in words — *decisions · local-ui* — where an ordinary file reads as its
path in mono. Nothing is covered and the list is plainly part of the box being typed in; the
cost is a conversation that shrinks and re-scrolls on the keystroke that opens the list, and
a memory note whose row no longer says where the file is.

### What I would build

**A.** It is the only one that keeps ten entries on screen at the width the rail actually
opens at, the chip says "memory" in words rather than in colour alone, and covering the tail
of the conversation costs nothing while the user is typing rather than reading. B buys
readability the board needs only for its longest paths and pays four entries for it; C moves
the conversation under the reader every time the list opens.

## Decided by the agent
- **Why a pick writes plain words instead of a command**: #263 has not settled whether a
  flow runs inside the conversation or goes to a background run. Words work either way; a
  command would settle it early, and in the wrong place.
- **Which memory notes are listed**: the four each module keeps — `readme.md`,
  `decisions.md`, `rejected.md`, `redesign.md` — and `goal.md`. The same files the Memory
  panel in the left rail already offers.
- **Why those come first**: they are where the board's own answers come from, so they are
  what a user points at most.
- **Why `#` and `@` share one rule about where they fire**: both are ordinary characters in
  the middle of a word, and one rule is one thing for the user to learn.

### Worth noting
- **`/` belongs on this card.** Naming a flow is a different ask from pointing at a thing;
  they share one list because they share one box.
- **`@` offers files, not folders.** A folder is a rarer ask and a much longer list.
