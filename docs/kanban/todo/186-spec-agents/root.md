---
title: Let a specialist agent fill the part of a spec it knows best
track: skill
priority: high
roi: high
status: todo
release: 0.7.0
blocked_by: []
related: [143, 137]
modules: [skill, local-ui]
questions: []
---

A card that needs a screen designed, or a library picked, gets the same planning pass as
every other card, so those parts of the spec stay thin. Give the board **spec agents**:
named prompts that each own one part of a card's spec. The planning flows — add-task,
refine, edit — call the one a card needs. A spec agent starts clean: it is given the card
and nothing else, and it writes its answer into a section of that card. It is not the
coding tool the board runs on — Claude Code, Codex or Cursor still does the running.
This is a group task; each piece is its own subtask in this folder.

## Today
- One planning pass writes the whole card: the pass that broke the request into cards also
  designs the screen and picks the library.
- A card that changes a screen describes it in sentences instead of showing the layout.
- A card that needs an outside library names the first one that came to mind, with nothing
  weighed against it.
- Nothing on the card says which part came from where, so the user cannot tell what was
  worked out from what was guessed.

## Scope
- A spec agent is a name and a prompt (#187).
- Each one owns one part of a card's spec, and only that part (#187).
- It is given the card and nothing else, never the conversation that called it (#187).
- It writes one section of the card and changes nothing else (#187).
- Every other flow reads that section and leaves it as it stands (#187).
- A planning flow calls a spec agent when the card needs the part that agent owns, and
  never otherwise (#188).
- Two spec agents ship here, and only two: `ui-design` (#189) and `recommend-tech-stack`
  (#190).
- `ui-design` reads the UI design reference from #137 (#189).
- The board UI's Configuration dialog gets a Spec agents section that lists them (#191).
- Every spec agent is on by default, and the user's only choice there is to switch one off
  (#191).
- Out of this group: a third spec agent, and spec agents a user writes for their own
  project.

## Todo
- [ ] Run a spec agent in its own context and write its part into the card #187
- [ ] Call a spec agent only when a card's spec needs it #188
- [ ] Ship the ui-design agent, which draws the screen a card needs #189
- [ ] Ship the recommend-tech-stack agent, which picks the library or service #190
- [ ] See the spec agents in the board UI and switch them on or off #191

## Decided by the agent
- **What we call them** — "spec agent", everywhere the user reads. The board already says
  "agent" for the coding tool it runs on.
- **Which coding tool runs one** — the one the board is already set to use, so a Codex or
  Cursor user is not left with a feature that never runs.
- **Why it starts clean** — it is not meant to agree with the pass that called it; a
  second opinion is the point.
- **Why one section each** — the card stays one spec, and the user can see which part a
  named agent is answerable for.
- **Why the user never picks one** — the flow working the card knows what the spec is
  missing. Asking the user to put an agent on a card, every card, would make the feature
  more work than writing the section by hand.
