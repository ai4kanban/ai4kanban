---
title: Speak a task instead of typing it
track: features
priority: low
roi: med
status: todo
release: ""
blocked_by: [251]
related: [250]
modules: [local-ui]
questions:
  - question: "[user] Where does speech become text?"
    mode: single
    options:
      - the browser's own speech recognition — nothing to install and no key, but it needs the network and is not in every browser
      - a transcription model on the user's machine — works offline, but it is a large download
      - a cloud transcription service — the best text, but it needs an API key the board does not ask for today
    recommend: [1]
---

Typing is what stops a passing thought from becoming a card. Someone walking through a
problem out loud will not stop to write six lines into a box. Let them press record, say it,
and get the same cards a typed idea gets.

## Scope
- A record button sits in the Describe tab of Create task.
- The user speaks; the words land in the box as text, and the user can fix them before
  anything runs.
- Spoken words never go straight to cards. The text goes through the brief (#251) like
  everything else — speech repeats itself, wanders, and changes its mind mid-sentence, which
  is exactly what the brief is there to catch.
- The user can type after speaking, and send both.
- It says clearly when it is listening, and one press stops it.
- The recording is dropped as soon as it is text. No audio is written to the board or to
  git.
- Where the machine cannot turn speech into text, the button is not offered, and one line
  says why.
- A two-minute ramble is a normal case, not an edge case.
- Where the transcription fails or comes back empty, the box keeps whatever the user typed
  and says what happened.

## Todo
- [ ] Add a record button to Create task, with a clear listening state and one-press stop.
- [ ] Turn the speech into text in the box, editable before the run starts.
- [ ] Hide the button where the machine cannot do it, and say why in one line.
- [ ] Send the spoken text through the brief step (#251).
- [ ] Drop the audio once it is text.
- [ ] Say what happened when transcription fails, without losing what the user typed.
- [ ] Try it with a two-minute ramble and read the cards it wrote.

## Decided by the agent
- **The audio is not kept**: the board keeps text in git. A recording of someone thinking
  out loud is not something to store, and nobody asked to play it back.
- **What language the card is written in**: the board's own, whatever the user spoke. The
  brief step is where that switch happens.

## Pushback
Nobody has asked for this. It is the piece of the group most likely not to be worth the
work: it needs a way to turn speech into text that the board does not have today, and every
route has a real cost — a browser that only some people use, a large download, or an API key
the board never asks for. Build the file path (#252) first, see whether the brief is doing
its job, and let this one wait or be dropped.
