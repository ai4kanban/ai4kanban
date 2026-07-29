# Redesign

Design mistakes to avoid when writing a card, grouped by topic. One entry each: the
mistake, then the design we actually want. Read before writing or reviewing a card.

## Local UI

- ❌ **UI lets people hand-edit the board** (toggle todos, write cards, move, mark done) →
  ✅ the UI spawns agents (`claude -p`) to do the kanban work; on-card buttons (Implement,
  Reject, Archive) call the agent connector. Only priority/roi and a title/body
  Edit are direct.
- ❌ **UI adds human-in-the-loop / a mid-run reply channel to the agent** → ✅ we don't do
  live replies; the agent raises "open questions" on the card and the user answers those.
  The only live view of a run is a read-only tail of its log.
- ❌ **Keep an agent run's output only in memory** → ✅ write each run's full log to a
  gitignored file, so it survives a restart and past runs can be audited. The UI tails
  the file.
- ❌ **Show a run's log only while it's live** (visible for one moment, gone after the run
  or a restart) → ✅ the log is a place, not a moment: the card's most recent run stays
  openable after the run ends and after a restart. One run is enough — a per-card run
  history list is overdesign.
- ❌ **Browse every past run from a card page** (per-card history list) → ✅ per-card stays
  one run, but there's ONE global runs panel in the header (an archive icon) to browse all
  runs — live and past, every action and card — showing each run's input + log. Keep 30.
- ❌ **A full auto-refine status readout** (current card, last refined, next pick, a reason
  for every idle state) → ✅ one "Refining #<id>" label beside the switch while a run is
  live, nothing otherwise. A background switch gets at most one small live indicator.
- ❌ **A new global setting gets its own labeled control in the header** → ✅ turn the header's
  agent badge into ONE configuration (gear) icon button that opens a single Configuration
  dialog; global settings (auto-refine, the agent connector) live inside it, so the header
  stays one quiet icon instead of growing a control per setting.
- ❌ **A settings file that repeats a name inside its own setting** (`harness.settings.<name>`
  under `harness.name`) → ✅ keep `ui.config.json` flat: the name and that thing's settings
  sit side by side (`harness: { name, command, model }`). Switching drops the settings that
  belonged to the old choice — nesting a block per choice to save them is machinery for a
  case almost nobody hits.
- ❌ **A recurring-task feature that only adds a Run button** → ✅ say how runs start without
  a click: the server's dispatcher runs due cards on a card-set cadence — scheduling is the
  server's job, never an in-session loop like Claude Code's `/loop`.
