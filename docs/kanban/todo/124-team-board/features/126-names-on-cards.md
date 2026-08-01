---
title: Put names on cards and questions
track: features
priority: low
roi: med
status: todo
release: next
blocked_by: []
related: [124]
modules: [skill, local-ui]
questions: []
---

With two people on a board, "ask the user" stops meaning anything. Put names on the
work.

Part of #124.

## Scope
- A card can say who wants it — the person whose answer settles its questions.
- An open question can be addressed to a person, and the resolve flow asks that
  person, not whoever happens to be nearest.
- The local UI can show one person's view: the cards and questions waiting on them.
- No accounts. A name is a git author name, written by the script like every other
  field.
- A board with no names stays exactly as it is today.

## Todo
- [ ] Let the script write a card's person and a question's person.
- [ ] Teach the resolve flow to leave another person's question alone.
- [ ] Filter the board and the open questions by person in the local UI.
- [ ] Check a board with no names behaves as before.
