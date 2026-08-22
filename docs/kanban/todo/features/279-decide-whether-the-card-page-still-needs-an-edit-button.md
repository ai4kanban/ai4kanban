---
title: Decide whether the card page still needs an Edit button
track: features
priority: med
roi: med
status: todo
release: 0.7.2
blocked_by: [274]
related: [266]
modules: [local-ui]
questions:
  - question: "[user] What happens to Edit once the chat rewrites cards and the fields edit in place?"
    mode: single
    options:
      - keep it — it is the one visible way to ask for a rewrite, and not everyone opens the chat
      - cut it — the chat does the same job better, and the button is a second way in that has to be kept working
      - keep it but change what it does — it opens the chat rail on this card, pre-addressed, instead of starting a run
    recommend: [1]
  - Is anything lost for a user who never opens the chat rail? It is folded away by default, so this decides whether cutting Edit is safe.
---

**Edit** on a card page starts an agent run that rewrites the card. The chat rail, open on
that same card, does the same thing in the conversation you are already in — and #274 takes
the fields and the body out of Edit's hands too. Work out what is left for the button, and
either cut it or give it a job the chat doesn't already do.

## Today
- **Edit opens a box and starts a run.** You type what should change, wait out a run, and
  read the result. You cannot correct it except by starting another one.
- **The chat rail, on the same page, is that card's chat.** Ask it for the same rewrite and
  the kanban skill can make the change in that session, and a correction is one more message.
- **#274 takes the rest.** Title, body, track, modules, blocked-by and related start saving
  straight to the file, with no run at all.
- What Edit is left with is "ask an agent to rewrite the plan" — which is what the chat is.

## Scope
- Decide the question above, then carry the decision out on the card page.
- If Edit goes: remove the button, its dialog, and its row in `kanban-ui/README.md`. The
  `revise` action stays in the command — this is about the button, not the flow.
- If Edit stays: say on the card page what it does that the chat doesn't, in a line the
  user can read without opening it.
- If Edit changes: it opens the chat rail on this card with the card already named, and
  starts no run.
- Whichever way it goes, the header row is left with one clear way to change a card, not
  two that look the same.
- The same call is made for the board's other run-starting buttons only if it falls out for
  free — Refine and Resolve are not in scope here.

## Todo
- [ ] Answer the open question with the chat and #274 both on screen.
- [ ] Carry the decision out on the card page.
- [ ] Update `kanban-ui/README.md` — the Edit line and the button table.
- [ ] Change a real card the surviving way and check the file it wrote.
