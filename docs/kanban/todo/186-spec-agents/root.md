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
questions:
  - "[user] The request asks for three agents but names two — ui-design and recommend-tech-stack. What is the third one for?"
---

A card that needs a screen designed, or a library picked, gets the same planning pass as
every other card, so those parts of the spec stay thin. Give the board named agents that
each own one part of a spec, and let a flow call the one it needs. Each runs with a fresh
context and writes its own section of the card. This is a group task; each piece is its
own subtask in this folder.

## Today
- One pass writes the whole card. The context that split the work also designs the screen
  and picks the library, and both come out shallow.
- A card that changes a screen ships prose where a layout should be. A card that needs an
  outside library names one from memory, with nothing weighed against it.
- Nothing on the card says which part came from where, so the user cannot tell a studied
  call from a guess.

## Scope
- One agent is one job: a name, a prompt, a fresh context. It writes one section of the
  card and nothing else (#187).
- The flows that shape a card — add-task, refine, edit — call an agent when the card needs
  the part that agent owns, and never otherwise (#188).
- Two agents to start: `ui-design` (#189) and `recommend-tech-stack` (#190). Adding more
  later is writing a prompt, not changing the machinery.
- An entry point in the board UI's header and a panel of its own, so a user can see what
  agents exist and put one on a card by hand (#191).
- Out of this group: agents a user writes for their own project. Worth doing once the two
  we ship prove the shape.

## Todo
- [ ] Run a spec agent in its own context and write its part into the card #187
- [ ] Call a spec agent only when a card's spec needs it #188
- [ ] Ship the ui-design agent, which draws the screen a card needs #189
- [ ] Ship the recommend-tech-stack agent, which picks the library or service #190
- [ ] See and run the spec agents from the board UI #191

## Decided by the agent
- **Which agent runs one** — the harness the board is already set to use, whatever it is.
  Wiring `claude -p` in directly would leave a Codex or Cursor user with a feature that
  never runs, and the board already sends every other run through that setting.
- **Why a fresh context** — an agent gets the card and nothing else. It is not meant to
  agree with the planning pass that called it; a second opinion is the point.
- **Why one section per agent** — the card stays one spec, and the user can see which part
  a named agent is answerable for.
