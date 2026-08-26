---
title: Point at a card in the chat box
track: features
priority: med
roi: med
status: todo
release: ""
blocked_by: []
related: [266]
modules: [local-ui]
questions:
  - question: "[user] Which layout for the card picker over the chat box? — see the `ui-design` section"
    mode: single
    options:
      - A — ten cards, one line each, in a floating panel; a long title is cut off at the right
      - B — the same ten flush with the box, inverted selection and a count line; louder
      - C — two lines a card, nothing cut off, six cards
    recommend: [1]
verify:
  - type `#` in the chat box on a board with plenty of open cards — the list should keep up with your typing
---

A card number has to be typed out in full, from memory.

## Worth noting
- The list offers open cards only. Archived cards, files, memory notes and flows are all
  out, so anything but a card id is still typed by hand.
- A pick writes `#12` and nothing more. No card text travels with the message; the agent
  reads the card itself if it needs to.
- The layout below was drawn while this card still offered files and flows, so a fresh
  `ui-design` pass is redrawing it for a cards-only list.

## By `ui-design` agent

### Where the list sits

Over the chat box at the foot of the rail: the same width as the box, its bottom edge on
the box's top edge. The box, the line under it and the Send button never move, so what the
user is aiming at stays put while the list opens and closes. The rail is 360px by default
and can be dragged down to 288px, which is what decides how much of a title a row can hold.

Each mockup draws the rail twice: `#` typed and nothing after it, which is the open cards
with the most recently touched first, and `#run` typed, which is the same list narrowed to
the cards whose title carries those letters.

### What a row says

- **The id, then the title**: `#12` in mono, the title after it, and the letters typed
  after the `#` are the strong part of the title with the rest of it quiet.
- **The chosen row is filled and carries `↵`**, so the key that picks a card sits on the row
  it picks.
- **The line under the box changes while the list is up**: `↑↓ choose · Enter picks · Esc
  closes` in place of `Enter sends · Shift-Enter starts a line`, and the box's own outline
  goes ember. Enter never looks like it will send.
- **Nothing matching draws nothing**: no panel, no empty box saying so, and what was typed
  stays as typed.

### The options

<Mockup src=".mockups/271/a.tsx" label="A" />
One line a card in a paper panel with the board's ink frame and hard shadow, floating clear
of the box, ten cards deep; the chosen row is an accent-soft fill with an ember bar down its
left edge. Ten open cards fit at the rail's default width and the panel reads as something
that opened and will close again — the cost is a panel standing on the last few lines of the
conversation, and a long title cut off at the right.

<Mockup src=".mockups/271/b.tsx" label="B" />
The same ten rows, but flush with the box and framed like it — no gap, no shadow, square
where the two meet, hairlines between rows, the chosen row inverted to ink with cream text,
and a foot line inside the panel reading `10 of 41 open cards · keep typing to narrow`. It
reads unmistakably as part of the box being typed in, the ink row is the one selection mark
that survives being read without colour, and the count says the list is a window on a longer
one; the cost is a tall block of white and ink in a rail that is otherwise quiet, and a foot
line that eats the height of another card.

<Mockup src=".mockups/271/c.tsx" label="C" />
Two lines a card — the id and the whole title, wrapped rather than cut, then where the card
sits under it (`in #292 App telemetry · features · 0.7.2`) — six cards deep. Nothing is ever
cut off and two cards with near-identical titles can be told apart; the cost is four cards
fewer in the same height, a second line that is noise on the nine cards in ten whose title
is already enough, and a panel that grows taller as titles wrap.

### What I would build

**A.** The user is picking a number they half-remember, so what helps most is seeing more
cards at once: A shows ten at the width the rail actually opens at, and a title cut off at
the right still starts with the words being matched. B buys a heavier frame and a count for
the price of one card and a much louder panel; C pays four cards for a second line that
only matters when two titles read alike.

<!-- agent -->

## Today
- The chat box is plain. `#` is an ordinary character in it.
- The agent's replies turn a `#12` into a link to that card. Nothing helps the user write
  `#12` in the first place.

## Scope

### What `#` offers
- **`#` offers the open cards**, matched on id and on title.
- Picking a card puts `#12` in the message.
- **Nothing is fetched, read or attached.** The message carries the number and nothing else.

### How the list behaves
- A small white list over the box, drawn like the rest of the chat rail.
- About ten entries at a time.
- Closest match first.
- It appears as the user types, and typing never waits for it.
- **↑ and ↓ move the choice, Enter picks, Esc closes the list and leaves what is typed.**
- While the list is up, Enter picks and does not send the message. Sending takes one more
  Enter, once the list has closed.
- While the list is up, ↑ and ↓ move the choice and do nothing else.
- **Esc closes the list before anything else sees it**, so it does not also stop a reply
  being written (#267).
- **`#` only fires at the start of a word.** An email address, or `issue#12`, leaves the box
  alone.
- Nothing matching means no list, and what was typed stays as typed.
- Once Esc has closed the list, typing more of the same word does not bring it back.
- The board's chat and a card's chat behave the same way.

## Scope out
- **No `@` file picker.** Cut from this card. Offering the project's files by path needs a
  file index of the whole repo, and it is a separate ask from pointing at a card.
- **No `/` flow picker.** Cut from this card. Naming a flow the board runs is a different
  ask from pointing at a card.
- No attaching an image or a file's contents. That is #252, the card for attachments.
- No pointing at a folder, a run, a release, a memory note or an archived card.
- `akb chat` in a terminal is unchanged.

## Todo
- [ ] Add the picker: a short list over the chat box, drawn like the rest of the rail.
- [ ] Drive it from the keyboard — ↑ and ↓ move, Enter picks, Esc closes.
- [ ] Keep Enter and the arrow keys from reaching the box while the list is up, so a pick
      never sends the message.
- [ ] Keep Esc from reaching #267's Stop while the list is up.
- [ ] `#` lists the open cards by id and title, and puts `#12` in the message.
- [ ] Fire `#` only at the start of a word.
- [ ] Cover it in `kanban-ui/README.md`, in the Chat section.

## Decided by the agent
- **Why does `#` fire only at the start of a word?**: `#` is an ordinary character in the
  middle of one, so an email address or `issue#12` has to be typeable without a list
  appearing over the box.
- **Why does the pick write `#12` rather than the card's title?**: `#12` is what the board's
  own replies already link on, so the same string means the same thing in both directions.

### Overruled by the user
The `@` file picker and the `/` flow picker were cut from this card, which settles these
calls the other way.
