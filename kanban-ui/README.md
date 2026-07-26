# ai4kanban-ui

The local board UI for [ai4kanban](https://ai4kanban.dev/). It shows every track in
a browser and drives the work from buttons: each button spawns an agent in your repo that
does the kanban work for you — propose, refine, implement, archive.

The markdown files in `docs/kanban/` stay the single source of truth. The UI only reads and
writes those files, so nothing here is locked in.

```
npx ai4kanban-ui        # http://localhost:7420, localhost only
```

Installing it, pointing it at a board elsewhere, changing the port, updating: the skill's
`references/local-ui.md`. This file is about **using** it.

## The board

The home page is the board — one column per track, cards in priority order. Click a card to
open it: the full card body, its meta (track, modules, priority, ROI, blockers), its open
questions, and its buttons.

The header carries three things:

- **Create task** — describe an idea in your words and the agent writes the card. The same
  dialog has a **Propose 3 tasks** mode: pick a module (or let the agent pick one) and it
  proposes three new tasks inside it.
- **Runs** — every agent session, live or finished. Open one to read its log. A finished run
  can be continued with a follow-up prompt; that starts a new run.
- **Configuration** (the gear) — see below.

## A card's buttons

Every button opens one small dialog. You can type a note that goes to the agent, then
confirm. The card then shows a running badge and a live log you can read while it works. The
log is read-only — you never type into a running session.

| Button | When it shows |
| --- | --- |
| **Implement** | Until every todo on the card is checked. Never on a group root. |
| **Edit** | Always. Say what to change and the agent revises the card. |
| **Resolve** | Only when the card has open questions. |
| **Archive** | Once every todo is checked (a group root: once every subtask is resolved). |
| **Reject** | Always. |

**Resolve** has a second confirm, **Resolve & implement**: the agent answers the questions
it can settle itself, and if nothing is left for you to decide it goes straight on to build
the card in the same run. If a real judgment call remains, it stops and leaves it for you.

There is no **Refine** button. Refining is automatic only — see Auto-refine below.

A run never commits. It leaves its changes in your working tree; you read `git diff` and
commit.

## Group tasks

A group task is a folder with a `root.md` and its subtasks under it. The root is a tracking
card, not something you build directly:

- The root shows **no Implement button**. A group is finished by finishing its subtasks, one
  card at a time.
- The root's **Archive** button appears once every subtask on it is resolved — ticked off
  (done) or struck through (rejected). Archiving the root closes the whole group.
- A group root that never got any subtasks can't be archived that way. Close it with
  **Reject**.

The root keeps this record itself: when a subtask is archived its line on the root is ticked,
and when a subtask is rejected its line is struck through. So the outcome survives even after
the subtask files are gone.

## Configuration

The gear in the header opens the **Configuration** dialog. It holds:

- **Agent** — the agent that every button spawns. It runs in your repo root.
- **Auto-refine** — a switch. Turn it on and the server refines cards in the background:
  about once a minute it picks the highest-priority card that still needs refining and runs
  one refine on it, one card at a time. It answers the questions it's confident about and
  leaves the real judgment calls for you as open questions. With the switch off, no card is
  ever refined.

Settings live in `docs/kanban/ui.config.json`, next to your board — so `npx` always serves
the latest UI and an update never touches your settings. The switch writes itself there. The
agent command is the `command` key, which you edit in that file:

```json
{ "command": "claude -p" }
```

The default is `claude -p` (a Claude Code subscription). Point `command` at another agent to
swap it.

## Run it from source

Only if you're changing the UI itself. Build, then start the production server (not
`next dev` — run the app the way it ships):

```
cd kanban-ui
npm install                 # first time only
npm run build
PORT=7420 npm run start     # http://localhost:7420
```

To reproduce the exact `npx` package (standalone server): `npm run build:standalone` then
`node bin/kanban-ui.mjs`.
