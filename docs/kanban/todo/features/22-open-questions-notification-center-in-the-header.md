---
title: Open-questions notification center in the header
track: features
priority: med
roi: med
status: ready
blocked_by: []
related: [21, 16]
modules: []
questions: []
---

Add one place in the header to see every open question across all tasks, so you
can tell at a glance what still needs a human before a task is ready to build.

Cards already carry their open questions in the frontmatter (`questions`), and the
UI already shows them — but only one card at a time. This gathers them into a
single read-only notification center.

## Scope
- An icon button in the header, next to the runs button and agent badge. Use a
  question-mark / help icon (react-icons, e.g. `FiHelpCircle`).
- A small circle badge on the icon's top-right corner with the total count of
  open questions across the whole board. Hidden when the count is zero. Same
  look as the runs button's count circle, but **without the ping pulse** — the
  pulse means "running right now"; this is a standing count.
- Clicking opens a panel (portaled to `<body>` like the other dialogs) that lists
  the open questions **grouped by task**: one section per card that has
  questions, the card `#id` + title as the heading, its questions as a list
  beneath. Each heading links to that card's page so the user can go resolve
  them. A card with no questions is skipped.
- Read-only. No answering or editing from the panel — the user resolves questions
  on the card, same as today.
- **The button is self-contained**, like the other header controls. The header is
  shared by the board page and the card page, and the card page never loads the
  board — so the button can't be handed the cards; it loads the board itself
  through the same server call the board page uses.
- Freshness, without a new poll: load the count once on mount, again when the
  panel opens, and again when an agent run finishes. The runs button already
  watches the run list for exactly this, so a run ending is a signal the header
  already has.

## Scope out
- No answering / resolving from the panel. It only shows and links out.
- No new polling loop. Questions change only when an agent run edits a card;
  refresh on the signals above and nothing else.

## Future vision (not to build now)
- The long-term idea is to grow this into a human-in-the-loop center that steers a
  proactive kanban — the user answers questions here and the board acts on them.
  This is only a direction to keep in mind, not scope. Note that live agent
  replies stay out of the design (see `redesign.md`); questions are answered on the
  card, and any future version must keep that shape. This connects to the autonomy
  levels work (#16).

## Todo
- [ ] Add a self-contained header component for the open-questions button, next
      to the runs button and agent badge. It loads the board itself (the card
      page has no board data to pass down).
- [ ] Show the count circle on the icon — runs-button style, no pulse, hidden
      at zero.
- [ ] Build the panel: grouped by card (`#id` + title heading, questions as a
      list), each heading a link to the card page. Portal it to `<body>`.
- [ ] Refresh the count when the panel opens and when a run finishes; no new
      polling loop.
- [ ] Handle the empty state — when no card has open questions, show a short
      "nothing to resolve" message in the panel and no badge.
- [ ] Update `kanban-ui/README.md` to describe the open-questions center.
</content>
