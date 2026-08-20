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
  - question: "[user] Does the board UI panel (#191) ship with this group, or later as its own card?"
    mode: single
    options:
      - Keep #191 in the group — the panel ships alongside the two spec agents
      - Move #191 out — the group ends when the two agents ship, and the panel becomes its own card
    recommend: [2]
---

A card that needs a screen designed, or a library picked, gets the same planning pass as
every other card, so those parts of the spec stay thin. Give the board **spec agents**:
named jobs that each own one part of a card's spec. A flow calls the one it needs, and it
starts with a fresh context and writes its own section of the card. A spec agent is a
prompt the board ships, not the harness it runs on — `akb agent` still means Claude Code,
Codex, or Cursor. This is a group task; each piece is its own subtask in this folder.

## Today
- One pass writes the whole card. The context that split the work also designs the screen
  and picks the library, and both come out shallow.
- A card that changes a screen ships prose where a layout should be. A card that needs an
  outside library names one from memory, with nothing weighed against it.
- Nothing on the card says which part came from where, so the user cannot tell a studied
  call from a guess.

## Scope
- One spec agent is one job: a name, a prompt, a fresh context. It writes one section of
  the card and nothing else (#187).
- Every other flow leaves that section alone: refine, revise and the rest read it, and
  never reword it or drop it (#187).
- The flows that shape a card — add-task, refine, edit — call a spec agent when the card
  needs the part that agent owns, and never otherwise (#188).
- Two spec agents ship here, and only two: `ui-design` (#189) and `recommend-tech-stack`
  (#190).
- `ui-design` reads the UI design reference from #137 instead of carrying its own copy of
  the same guidance (#189).
- An entry point in the board UI's header and a panel of its own, so a user can see what
  spec agents exist and put one on a card by hand (#191).
- Out of this group: a third spec agent, and spec agents a user writes for their own
  project.

## Todo
- [ ] Run a spec agent in its own context and write its part into the card #187
- [ ] Call a spec agent only when a card's spec needs it #188
- [ ] Ship the ui-design agent, which draws the screen a card needs #189
- [ ] Ship the recommend-tech-stack agent, which picks the library or service #190
- [ ] See and run the spec agents from the board UI #191

## Decided by the agent
- **They are called spec agents** — the board already uses "agent" for the harness it runs
  on, so the card, the docs and the UI say "spec agent" for the new thing.
- **Which harness runs one** — the one the board is already set to use, whatever it is.
  Wiring `claude -p` in directly would leave a Codex or Cursor user with a feature that
  never runs, and the board already sends every other run through that setting.
- **Why a fresh context** — a spec agent gets the card and nothing else. It is not meant to
  agree with the planning pass that called it; a second opinion is the point.
- **Why one section per agent** — the card stays one spec, and the user can see which part
  a named agent is answerable for.
