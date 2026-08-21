---
title: Carry what the conversation settled into the run a chat starts
track: skill
priority: med
roi: high
status: todo
release: 0.7.1
blocked_by: []
related: [263]
modules: [skill]
questions:
  - question: "[user] Should what the chat passes to the run also be written onto the card, so it survives the conversation?"
    mode: single
    options:
      - Yes — anything that changes what to build belongs on the card; the run's note is only the framing.
      - No — the card is the plan, and a note about one run does not belong in it.
    recommend: [1]
---

A run a chat starts begins with nothing the conversation said. The user spends ten minutes
narrowing down what a card really means, says "go build it", and the run reads the card
cold — as if that conversation never happened.

## Today
- The chat starts `akb implement <id>`, and the note that command takes is left empty or
  filled with a few words of the last message.
- Everything the two of them worked out — what was ruled out, which of two readings was
  meant, what the user does not care about — stays in the conversation and never reaches
  the agent doing the work.
- In a coding agent session there is nothing to carry: the work happens in the same session
  that held the conversation.

## Scope
- Before it starts a run, the chat writes down what the conversation settled that the run
  needs, and hands it over as the run's note.
- It is short and specific: what was decided, and what was ruled out. Not a transcript, not
  a summary of the whole chat.
- Anything settled that changes what the card should say goes on the card first, as the
  chat already does. The note is only what does not belong in the card.
- Nothing is carried when there is nothing to carry: a chat asked to build a card out of
  nowhere starts the run with no note, as today.
- The user can see what was handed over — the reply says the run started and what it was
  told.

## Scope out
- No new plumbing between the conversation and the run. The note the run already takes is
  the whole channel.
- The run is still an ordinary run: its own agent, its own context, no link back to the
  conversation.

## Todo
- [ ] Have the chat write what the conversation settled as the run's note before starting
      it.
- [ ] Keep it to what was decided and what was ruled out, and leave the note empty when
      there is nothing.
- [ ] Say in the reply what the run was told, not only that it started.
- [ ] Cover it in the chat flow and in `cli/README.md`.
