---
title: Link a bug back to the delivery that introduced it
track: skill
priority: low
roi: med
status: todo
release: 0.8.0
blocked_by: []
related: [300]
modules: [skill, local-ui]
questions: []
---

Once the board builds and lands code by itself, the bugs it writes are its own. Let a bug card
name the delivery and the commit that introduced it, and put the confirmed lesson in the board's
memory so later planning and review have the evidence instead of the anecdote.

## Worth noting
- **Who establishes the link?**: whoever writes the bug card claims it; the board does not prove
  it. A wrong link teaches the wrong lesson.
- **What reaches memory?**: only a confirmed lesson. A suspicion stays a note on the card.

<!-- agent -->

## Scope
- **A bug card may name the delivery and the commit that introduced it.**
- **The card page shows that link**, and the delivery's audit record shows the bug that came out of
  it.
- **The confirmed lesson goes in `docs/kanban/memory/` as one line**, so planning and review read
  it as evidence. Follow the memory rules already in `akb guide board`: the module's set when the
  card names modules, the project-level set otherwise, and `redesign.md` for a design mistake to
  avoid.
- **The link never blocks anything**: it is a record.

## Todo
- [ ] Let a bug card carry the delivery id and commit that introduced it.
- [ ] Show the link on the card page, and the resulting bug on the delivery's audit record.
- [ ] Write the confirmed lesson into the right memory file, following the existing memory rules.
- [ ] Teach the flow that writes bug cards to ask for the link when the bug came from a landed
      delivery.
- [ ] Document the link in the skill note.

## Source
- `plan.md`, in commit `1127a91` — "Learning from bugs".
