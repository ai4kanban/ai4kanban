---
title: Put a specialist agent on a card from the card's page
track: features
priority: med
roi: med
status: todo
release: ""
blocked_by: []
related: [209]
modules: [local-ui]
questions:
  - question: "[user] Where do the specialists live on the card page? — see the `ui-design` section"
    mode: single
    options:
      - A — one Specialist button in the card's button row, the list inside the dialog it opens; costs the page nothing, but you can't see the specialists without clicking
      - B — a specialists block of its own above the card's words, one row each with an Ask button; everything readable at a glance, but a permanent block on every card page
      - C — a strip under the card's words plus an Ask again link on a section already written; beside what it rewrites, but below the fold and in two places
    recommend: [1]
---

A specialist agent writes one section of a card: `ui-design` draws the screen the card
changes, `technology-selection` picks the outside library it needs. Usually the board asks
for one by itself while it plans the card. When you want one yourself, the only way is
`akb spec ui-design 4` typed in a terminal, which puts the `ui-design` specialist on card 4.
Configuration lists the specialists with an on/off switch and nothing else, and the card
page never mentions them.

## Scope
- The card page offers the specialists that are switched on, and no others.
- Each one is shown with the line Configuration shows for it: what part of a card it writes.
- A short note can go with the pick, saying what to look at.
- Picking one starts that specialist on this card.
- That run is watched and stopped like any other run the board starts.
- With every specialist switched off, the card page says so in a line rather than drawing an
  empty list.
- If the `akb` command in this project is too old to name the specialists, the card page
  says that instead.
- A specialist already working this card is not offered again.
- The card page says which specialist is working the card.
- A specialist that already wrote a section on this card is still offered.
- Starting one that already wrote a section says, before it starts, that this rewrites that
  section.
- While a specialist works the card, the card's other buttons — Implement, Refine, Edit,
  Resolve — stay on.
- While a refine, an edit or a resolve works the card, the specialists stay on offer.
- While an Implement or a Run agent is building the card, no specialist is offered.
- `kanban-ui/README.md` says how to put a specialist on a card from the card page, in place
  of the line saying only the board can.

## Todo
- [ ] Offer the switched-on specialists on the card page, each with the line saying what it
      writes.
- [ ] Start the picked specialist on this card, with an optional note.
- [ ] Say in a line when there is nothing to offer, rather than drawing an empty list.
- [ ] Say which specialist is working the card.
- [ ] Don't offer a specialist that is already working the card.
- [ ] Warn that starting one again rewrites the section it already wrote.
- [ ] Keep the card's other buttons on while a specialist works it.
- [ ] Keep the specialists on offer while a refine, an edit or a resolve works the card.
- [ ] Offer no specialist while the card is being built.
- [ ] Say in `kanban-ui/README.md` how to put a specialist on a card, in place of the line
      saying only the board can.
- [ ] Put `ui-design` on a real card from the page while a refine runs on that card, and
      check what it wrote.

## By `ui-design` agent

Three placements for the specialists on the card page. The dialog behind the pick, the
badge that names the one working the card, and the wording of the lines are the same in
all three — only where the offer lives changes.

### The layouts

<Mockup src=".mockups/275/a.tsx" label="A" />
A **Specialist** button in the card's button row, beside Implement and Refine; the switched-on specialists, each with its one line, are the first thing inside the dialog it opens, picked with a radio. Costs the page nothing for an action you rarely press, and puts it where every other card action already is — but you cannot see which specialists exist, or that any exist, without clicking.

<Mockup src=".mockups/275/b.tsx" label="B" />
A **specialists** block of its own between the meta box and the card's words, in the run of blocks the card already has: one row per specialist — name, its one line, and an **Ask** button on the right. Everything the card asks the page to say is readable without a click — at the price of a permanent block on every card page, pushing the card's own words down.

<Mockup src=".mockups/275/c.tsx" label="C" />
The offer sits under the card's words, where the sections land: a quiet wash strip listing every switched-on specialist, plus an **Ask again** link on the heading of a section one already wrote. Puts the offer beside the thing it rewrites — but it is below the fold on a long card, and the same offer then stands in two places.

**Recommended: A.** Asking for a specialist yourself is rare, and A is the only one that costs a card page nothing when you don't. It also reads as what it is — one more thing you can do to this card — instead of a new region to learn.

### The same in all three

- **The dialog**: what this specialist writes in one line, the warning, an optional note box, then Cancel and Start. Same shape as the Implement, Refine and Edit dialogs.
- **Starting one again**: a peach box above the note box — "It already wrote a section on this card. Starting it again rewrites that section." It shows only for a specialist that has a section here, and there is nothing to tick: this is a note, not a gate.
- **Which one is working the card**: the badge beside the title names it — `● ui-design drafting a spec…` — in place of the plain running mark.
- **Already working**: that specialist still appears, dimmed and unpickable, saying "working this card now". Gone from the list entirely would read as switched off.
- **Nothing to offer**: one line where the offer would be — "No specialists are switched on — turn one on in Configuration → Agents." An `akb` too old to name them says so in the same spot, in the same quiet grey.
- **Nothing greys out**: Implement, Refine, Edit and Resolve stay pressable while a specialist works the card.

## Decided by the agent
- **Why on the card page and not in Configuration**: the switch is about the board, this is
  about one card. Configuration says which specialists may run at all; the card page is
  where you say run one now.
- **Why the note is optional**: the specialist is given the card and a short note and
  nothing else, on purpose. Requiring a note would suggest it needs steering it is meant not
  to have.
- **Why the note box matches the other card dialogs**: the user types a note for Implement,
  Refine and Edit the same way, and one dialog that asks differently is one the user has to
  read twice.
- **Why a specialist does not switch the card's other buttons off**: the board already lets
  a specialist and a run work one card at once, because a specialist writes one section and
  never the card's plan. The card page is the only place left that stops the card's buttons
  for a specialist.
- **Why none is offered while the card is being built**: the app already tells the user that
  specialists run while a card is planned, never while it is built.

### Worth noting
- **Of the three cards in #209 this is the one to cut** — `docs/guides/daily-loop.md`
  already says you rarely ask for a specialist yourself, because the board asks while it
  plans the card.
- **Offering a specialist while a refine runs is a judgment call** — the refine is rewriting
  the plan the specialist reads, so the section and the plan can end up describing different
  things. The other way is to offer none while any run holds the card, which is what the
  card page does today.
