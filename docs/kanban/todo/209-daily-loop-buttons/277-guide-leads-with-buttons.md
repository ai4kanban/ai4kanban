---
title: Rewrite the daily-loop guide so each step leads with the button
priority: med
roi: med
status: ready
release: ""
blocked_by: []
related: [209]
modules: [docs]
questions: []
---

Every step in `docs/guides/daily-loop.md` leads with the button that does it, and the three
steps that have no button say so and give the sentence instead. Today the guide teaches every
step as a sentence you say to a coding agent, so a reader who has the board open in a window
is sent back to a terminal for work that is a button in front of them.

## Worth noting
- **Nothing in the guide turns out to be terminal-only**: saving an API key has a box in
  Configuration and the three steps with no button can be said in the Chat rail, so the guide
  splits its steps into button and sentence rather than into app and terminal.
- **"Review the board" stays a sentence until #209's open question settles it**: reviewing the
  whole board has no button and no flow behind it, so the rewrite names the sentence unless
  that answer builds one or drops the step; the section's other offer, `review #4`, is what
  **Refine** already does to one card.

<!-- agent -->

## Scope
- **Button first, sentence second**: each step leads with the button that does it, then gives
  the sentence for a coding agent.
- **The three steps with no button say so**: asking for a specialist agent, writing a
  hand-check down, and reviewing the board each say there is no button and give the sentence
  in its place.
- **The API-key step leads with Configuration**: it points at the **API key** box, and keeps
  why a coding agent hands you `akb agent set apiKey` rather than running it.
- **Finishing work done outside a delivery leads with the sentence**: **Archive** appears only
  once every todo is ticked, and no screen in the app ticks one.
- **Every screen name is checked against the app before the guide prints it**:
  `Configuration → Skill` is `Configuration → Setup` today.
- **Link the README rather than repeat it**: where `kanban-ui/README.md` covers a screen, the
  guide uses a relative link that works on GitHub instead of describing the screen again.
- **A reader who has only the app can do every step**: the Chat rail is the second way for the
  steps with no button, and `akb chat` installs the skill itself when the repo has none.

## Todo
- [ ] Put the button first in each step that has one, using the map below.
- [ ] Write the three steps with no button as "no button for this one" plus the sentence.
- [ ] Rewrite the API-key step around Configuration's key box.
- [ ] Rewrite "Finish a task" so the sentence leads, and say what gates **Archive**.
- [ ] Fix the opening: the section is `Configuration → Setup`, not `Configuration → Skill`,
      and three of the asks below it are not buttons.
- [ ] Check every other screen name the guide prints against the app.
- [ ] Replace the repeated screen descriptions with relative links into
      `kanban-ui/README.md`.
- [ ] Read the guide start to finish as someone who only has the app, and check every step is
      either doable there or says plainly that it has no button.

### The button for each step
The guide already names the app for planning, closing and dropping a release, building a card,
queueing a blocked card, and talking it over. These are the steps that do not:

| Step | What to press |
| --- | --- |
| Pick what to work on | the board's **Ready to build** column; **Create task → Propose tasks** writes new ones |
| Add a task | **Create task → Describe a task** |
| Turn a source into tasks | the same box with the source pasted in — the create flow routes a source to `extract-ideas` |
| Push a card forward | **Refine**, and **Resolve** while the card has open questions |
| Cross off a hand-check | the **✕** beside the line |
| Finish a task | **Archive**, once every todo is ticked |
| Reject an idea | **Reject** |
| Keep it lean | **Run** on the prune-the-memory recurring card every board is made with |
| Drive a run | the **Runs** panel — its log, stop, resume, and **Continue delivery** |
| Save a key, pick the agent, model or provider, name a runtime and bind it | **Configuration → Runtimes**, with **Test** for "check my setup works" |
| Install the skill | **Configuration → Setup** |
| The metrics | the **Insights** charts, which read the same numbers as `akb board metrics` |

## Decided by the agent
- **Asking for a specialist agent has no button and is not getting one**: putting one on a card
  from the card page was turned down and the Agents pane carries switches and settings only, so
  the guide gives `akb spec` for that step.
- **Writing a hand-check down has no button**: hand-checks come from the spec the board
  clarifies, so the card page only crosses them off and the guide gives
  `akb board update-verify` for writing one.
