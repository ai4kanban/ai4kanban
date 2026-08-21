---
title: Show what a card unblocks, so the ones holding up work go first
track: features
priority: med
roi: med
status: todo
release: ""
blocked_by: []
related: []
modules: [skill, local-ui]
questions:
  - question: "[user] Which layout shows what a card is holding up? — see the `ui-design` section"
    mode: single
    options:
      - A
      - B
      - C
    recommend: [1]
---

A card says what it waits on, never what waits on it. So the one card holding up five
others looks the same as a card nobody needs, and it gets built last.

## Scope
- On a card page, list the cards this one is holding up.
- On the board and in the queue, mark a card that is holding up other work, with the
  count.
- Say the same thing in the script's card listing, so the agent sees it too.
- This is read from the blocked-by links already on the cards. Nothing new is stored and
  nothing is typed by hand.

## Todo
- [ ] Work out, from the blocked-by links, which cards each card is holding up.
- [ ] Show that list on the card page.
- [ ] Mark the cards holding up other work on the board and in the queue, with the count.
- [ ] Show it in the script's listing too.
- [ ] Cover it in the local UI docs.

## By `ui-design` agent

The board and the queue draw their cards with one component, so a mark added there lands
in both. Read those two Todo lines as one job.

Three layouts for the card page, which is where the list has to find a home. Each is drawn
on the same card — one that waits on #63 and holds up three others.

<Mockup src=".mockups/154/a.tsx" label="A" />

"Holding up" is a column of the meta band like any other, right after "Blocked by". The two
directions sit side by side and the band stays one shallow strip. Costs: the ids are bare
numbers, so you cannot tell three small cards from the release without opening them, and on
a narrow window the column wraps to a second line.

<Mockup src=".mockups/154/b.tsx" label="B" />

One "Links" column carries the whole sentence: waits on #63 · holds up #201 #202 #233. Both
directions in one place, and the band gains no width. Costs: the line gives two opposite
instructions — do not start this, and start this first — so you read all of it to learn
either half, and a peach id beside a sky id in one row is easy to mix up at a glance.

<Mockup src=".mockups/154/c.tsx" label="C" />

A panel under the meta band, one row per held-up card with its title, and each row opens
that card — the same row the subtasks panel already draws. You see at once whether you are
holding up the release or three small things. Costs: another panel on a page that is already
tall, and a whole panel for the common case of one held-up card.

I recommend **A**: it is the smallest thing that answers the question the card asks, and it
puts what a card holds up beside what it waits on, where the reader is already looking. C's
titles are worth having, and its panel can be added later without moving anything else. B is
the one to skip — one line that says both "wait" and "hurry" is a line people stop reading.

### The mark on the board and in the queue

The same in all three, so it is not part of the pick: an open padlock and the count, in the
card's bottom row beside PRIORITY and ROI, in the board's blue. The closed peach padlock
already there means "blocked"; the open one is its opposite, and the colour keeps the two
apart. Hovering it names the cards, the way the blocked mark already does.

### Two rules whichever is picked

- **Nothing to say, nothing drawn**: a card holding up no open work shows no mark and no
  column, the way "Blocked by" already behaves.
- **Count only open cards**: a done card that once waited on this one must not keep the
  number up, or the mark stops meaning "start this first".

## Source
- Competitive analysis of Task Master, 2026-08-05 —
  https://github.com/eyaltoledano/claude-task-master; their 0.42 release added `--ready`
  and `--blocking` filters to find the work that unblocks the most other work.
