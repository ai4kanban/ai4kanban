---
title: Unstick cards that sit on the board too long
track: features
priority: med
roi: med
status: todo
release: next
blocked_by: []
related: [117, 118, 119]
modules: [skill]
questions:
  - question: "[user] When the sweep thinks a stuck card should go, may it reject the card on its own?"
    mode: single
    options:
      - ask first — the sweep parks the reject as an open question on the card; nothing is deleted without you
      - reject on its own — it writes the why to rejected.md, and you can bring the idea back any time
    recommend: [1]
---

Some cards just sit. Nothing notices a card nobody has touched for a month, so a stale
plan looks exactly like live work until a human rereads the whole board. Let the board
find its stuck cards and act on them — split what is too big, rewrite what went vague,
propose rejecting what nobody wants. This is a group task; each piece is its own subtask
in this folder.

## Today
- A card shows its priority and roi, but not its age. A card from two months ago looks
  the same as one from this morning.
- Nothing reviews old cards. A stuck card is only found when someone rereads the board.
- The goal promises stalled work gets handled — split, rewritten, or rejected. None of
  that exists yet.

## Scope
- The board can tell how long a card has sat untouched, read from git — nobody keeps
  dates by hand (#117).
- One flow takes one stuck card and moves it: split it into smaller cards, rewrite it
  against what the project looks like now, or propose rejecting it (#118).
- A sweep runs on a cadence and works the stalest cards through that flow, so this
  happens without anyone remembering to (#119).
- Order: #117, then #118, then #119 — each needs the one before it.
- Out of this group: showing a card's age in the local UI. Worth doing, but it is a
  small UI card once #117 exists.

## Todo
- [ ] Show how long each card has sat untouched #117
- [ ] Split, rewrite, or reject a card that sat too long #118
- [ ] Sweep the stuck cards on a schedule #119

## Decided by the agent
- **Age comes from git, not from a field.** Cards are files in git; the last commit that
  touched a card says when it last moved. No new frontmatter, nothing to keep up by hand.
- **"Too long" is one default, not a rule per card.** 30 days untouched counts as stuck,
  one number the user can change in `config.md`. A plain rule the user can predict beats
  a smarter one they have to check.
