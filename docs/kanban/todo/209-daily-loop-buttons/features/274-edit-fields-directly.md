---
title: Change a card's words and fields without starting an agent run
track: features
priority: high
roi: high
status: todo
release: 0.7.2
blocked_by: []
related: [209]
modules: [local-ui, skill]
questions:
  - question: "[user] Open questions are a card field too. Should the card page let you add one and cross one off by hand, alongside the other fields?"
    mode: single
    options:
      - no — a question is what a flow raises and Resolve answers; one written by hand has no flow behind it
      - yes — add it to this card's scope
    recommend: [1]
---

The card page writes four things straight to the file: priority, ROI, release, and a
recurring card's cadence. Everything else about the card — its title, its body, its track,
its modules, the cards it waits on — goes through **Edit**, which starts an agent run and
takes as long as a run takes. Fixing a typo, or noting that #12 has to land first, costs a
whole agent run. In a terminal all of it is one `akb board update`.

## Scope
- These change from the card page and land in the file at once, with no run: the title,
  the body, the track, the modules, the cards it is blocked by, the cards it is related to.
- Each one saves on its own, the way Priority and ROI already do.
- **Edit** stays where it is and keeps its meaning: ask the agent to change the plan.
- The body is the card's markdown in a box — you edit what the file holds, not a rendered
  page — with Save and Cancel.
- Modules are picked from the module map, and blockers and related cards are picked from
  the open cards. Nothing here is typed free-hand, so a name cannot be misspelled into
  existence.
- A change is refused while a run holds the card, and the refusal names what that run is
  doing — the same rule the chat already follows.
- Moving a group root or a subtask to another track is refused with the reason, as the
  board's own move already refuses it.
- A refused save leaves what you typed on screen.
- Nothing here starts a refine. Direct edits are the user's own, not a run that touched
  the card.
- `kanban-ui/README.md` says which fields change on the spot and which still need a run.

## Todo
- [ ] Let the card page write the title, body, track, modules, blocked-by and related
      straight to the file.
- [ ] Edit the title in place on the card page.
- [ ] Edit the body as markdown in a box, saved whole.
- [ ] Turn Track, Modules, Blocked by and Related into pickers in the meta box.
- [ ] Refuse a save while a run holds the card, naming what the run is doing.
- [ ] Keep what the user typed on screen when a save is refused.
- [ ] Say in `kanban-ui/README.md` which fields are direct and which need a run.
- [ ] Change every one of these on a real card and check the file it wrote.

## Decided by the agent
- **Why the body is a plain markdown box, not a rich editor**: the card is a markdown file
  that agents read and git diffs. Anything that reformats it on save makes every diff
  noisy.
- **Why no refine follows**: a refine follows a run that changed a card, because nobody was
  watching it. Someone typing into the card page is watching.
- **Status is not in this list**: `ready` is the board's own judgment that a card can be
  built, and a card marked ready by hand is a card nobody checked. It stays with the refine.

### Worth noting
- **A hand-editable body cuts against the board's premise** — the agent writes the card and
  the human decides. A free text box lets someone write a card no flow ever shaped, and the
  next refine will rewrite parts of it. The fields are the safe half of this card; if only
  half ships, ship the fields.
