---
title: Run a spec agent in its own context and write its part into the card
track: skill
priority: high
roi: high
status: ready
release: 0.7.0
blocked_by: []
related: [186, 156]
modules: [skill]
questions: []
---

Build the thing itself: a named job the board hands one card to, which comes back with one
part of that card's spec written. This is what the two first agents run on.

## Scope
- An agent is a name and a prompt, shipped with the skill. It says what part of a spec it
  owns and what a good answer looks like.
- Running one is an ordinary board run: it goes through the agent the board is configured
  with, shows up beside the other runs, can be stopped, and keeps its log.
- It starts clean. It gets the card and an optional note from whoever called it, never the
  conversation that called it.
- It writes one section on the card, headed by its own name — `## By \`ui-design\` agent` —
  and changes nothing else. Run again, it rewrites that section instead of adding a second
  one.
- The rest of the card is off limits to it: the summary, `## Scope`, and `## Todo` stay the
  human's and the planning pass's.
- It can be run on a card that has no section from it yet, or on one that does.

## Todo
- [ ] Say what an agent is — its name, its prompt, and where it lives in the skill.
- [ ] Run one as a normal board run, through the configured agent, with its own log.
- [ ] Hand it the card and an optional note, and nothing more.
- [ ] Write its answer as one `## By \`<name>\` agent` section, replaced on a rerun.
- [ ] Stop it writing anywhere else on the card.
- [ ] Run one on a real card twice, and check the section lands once and is rewritten, not
      doubled.
- [ ] Document what an agent is and how one is run.

## Decided by the agent
- **The section is named after the agent** so a reader can see who is answerable for that
  part of the spec, and a rerun knows what to replace.
- **An agent never edits the plan** — it fills the part it owns. A card whose scope an
  agent could rewrite would drift away from what the user asked for.
- **It is its own run, not a step inside another one** — the card is written and saved
  first, and the section arrives when the agent is done. A run that waited for it would
  leave the user staring at a flow that has stopped for minutes with nothing on the board.
- **A failed agent leaves the card alone** — no section, the plan as it was, and the
  failure shown the way any failed run is (#67, #179). A half-written spec is worse than
  none.
- **Two agents may work one card** — they write different sections. Two runs writing the
  same card file at the same time is the same problem #156 already owns.
