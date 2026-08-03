# Redesign

Design mistakes to avoid when writing a card, grouped by topic. One entry each: the
mistake, then the design we actually want. Read before writing or reviewing a card.

## What the UI does

- ❌ **UI lets people hand-edit the board** (toggle todos, write cards, move, mark done) →
  ✅ the UI spawns agent runs to do the kanban work; on-card buttons call the agent
  connector. Only priority/roi and a title/body edit are direct.
- ❌ **UI adds human-in-the-loop / a mid-run reply channel to the agent** → ✅ no live
  replies: the agent raises open questions on the card and the user answers those. The
  only live view of a run is a read-only tail of its log.
- ❌ **A control is hidden when the thing it drives doesn't exist yet** (no releases → no
  release dropdown, so the UI never says releases exist and gives no way to make one) →
  ✅ the empty state is where the UI teaches the feature: keep the control and let it offer
  the first step. A user who only ever opens the UI must be able to find a feature the
  script has.
- ❌ **A board action stays terminal-only because it feels rare or administrative** → ✅ the
  UI offers what the script offers, with the consequences shown before the user confirms.

## Runs

- ❌ **A run's log is a moment** (in memory only, or visible while the run is live and gone
  after it) → ✅ the log is a place: every run's full output is written to a gitignored
  file, the card keeps its most recent run openable after a restart, and one global runs
  panel in the header browses all of them, live and past. Keep 30.
- ❌ **A full auto-refine status readout** (current card, last refined, next pick, a reason
  for every idle state) → ✅ one "Refining #<id>" label beside the switch while a run is
  live, nothing otherwise. A background switch gets at most one small live indicator.

## Settings

- ❌ **A new global setting gets its own labeled control in the header** → ✅ one
  configuration (gear) icon that opens a single Configuration dialog; global settings live
  inside it, so the header stays quiet instead of growing a control per setting.
- ❌ **A new settings-file shape to hold a new setting** (a map keyed by the picked thing's
  name, plus a migration and a "no longer in effect" notice) → ✅ a new setting is one more
  key in the block that already exists, and a file written before the card keeps working
  untouched. Only reshape the file when a user really loses something today.
- ❌ **A dialog's fields are seeded once, from the page's first load** (a setting saved a
  moment ago reads back empty next time it opens) → ✅ a settings dialog shows what the
  file holds every time it opens, with no page reload.
- ❌ **Say whether a setup can run by checking its pieces up front** (is the CLI installed,
  is it logged in, is the key set) → ✅ one **Test** button that really runs the thing once
  and shows what came back. A real run answers what a checklist can't see — a revoked key,
  a gateway that refuses this model.

## Keys

- ❌ **The board holds no secret, so a key comes from whatever the user exported before
  starting the server** (a shell profile, a wrapper script, a different place per machine)
  → ✅ one fixed file the board owns, `docs/kanban/.env`, kept out of git. `ui.config.json`
  is checked in and never holds a key.
- ❌ **Send a key out under every variable the agent might read, so it works whichever one
  the other end wants** → ✅ one auth variable per run, the one the picked provider names.
  A second one isn't a harmless spare: an agent reads it as another login and changes what
  it does — Claude Code turns the user's claude.ai connectors off the moment
  `ANTHROPIC_API_KEY` is set.

## The header and the goal

- ❌ **The goal is one section inside a bigger memory view, shipped with it** → ✅ the goal
  is its own lightweight element, built first: a quiet header button that opens the whole
  file. It is rarely edited and often reread — the opposite of the memory files, which are
  read-only and live in a view you open on purpose.
- ❌ **Put a long file on the board as one summarized line** (a headline stripped out of
  `goal.md`, truncated to fit a row) → ✅ a file the user wrote in full is opened in full,
  from a control that costs no space. A one-line squeeze drops the part worth rereading and
  takes a row from every board, every day.
- ❌ **A read-only reference control joins the header's action cluster on the right, in the
  same sticker frame** → ✅ it goes on the left, beside the board's name and folder path,
  with no border, no shadow, icon only. The left of the header says what this board is; the
  right is the things you do.

## Recurring tasks

- ❌ **A recurring-task feature that only adds a Run button** → ✅ say how runs start without
  a click: the server's dispatcher runs due cards on a card-set cadence — scheduling is the
  server's job, never an in-session loop like Claude Code's `/loop`.
- ❌ **A schedule is a pick from a few named options** (daily / weekly / monthly) → ✅ a
  number and a unit, down to the minute, plus an optional time of day — `30m`, `6h`,
  `1d at 09:30`. Real jobs don't fall into three buckets: a health check wants minutes and
  a report wants a fixed hour.
