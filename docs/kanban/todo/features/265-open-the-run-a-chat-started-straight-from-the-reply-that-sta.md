---
title: Open the run a chat started, straight from the reply that started it
track: features
priority: med
roi: med
status: ready
release: 0.7.1
blocked_by: []
related: [264]
modules: [local-ui]
questions: []
---

The chat ends a reply with "Started a build on #12 — run 3f2a1b04." The card it names is a
link; the run is eight characters of plain text. To watch the run it just asked for, the
user folds the chat away, opens the runs panel, and finds the run by eye.

## Scope
- The run a reply names is a link, drawn like the card links beside it.
- Clicking it opens that run's log.
- The log opens in the runs panel — the same view the activity button in the top row opens.
- Only the id right after the word `run` is a link.
- Anything else in the reply that looks like an id stays plain text.
- Any run a reply names is a link, not only the one the chat just started: the refusal
  "#12 is being implemented by run 3f2a1b04 right now" links that run too.
- A run that started moments ago is a link straight away, with no wait.
- The link still works once the run has ended.
- A run the board no longer keeps reads as plain text, not a dead link.
- The board's chat and a card's chat behave the same way.

## Scope out
- `akb chat` in a terminal is unchanged.

## Todo
- [ ] Turn the run a chat reply names into a link.
- [ ] Open that run's log in the runs panel when the link is clicked.
- [ ] Keep the link working once the run has ended.
- [ ] Make a run that started moments ago a link straight away, with no wait.
- [ ] Leave a run the board no longer keeps as plain text.
- [ ] Cover the link in `kanban-ui/README.md`, in the Chat section, beside the line about a
      card's name being a link.

## Decided by the agent
- Does this need a view of its own? No — the runs panel already opens on one named run, and
  its log stays readable after the run ends.
- When does a link stop working? When the board drops the run: it keeps the last 30 runs,
  and an older id reads as plain text.

### Worth noting
- Only the id after the word `run` is linked. A reply also quotes card text, file names and
  commands; linking every id-shaped word would catch a few more mentions and turn quoted
  text into links.
- Clicking opens the runs panel over the window rather than the log inside the chat rail.
  The rail is narrow, and the panel is where a log is read everywhere else.
