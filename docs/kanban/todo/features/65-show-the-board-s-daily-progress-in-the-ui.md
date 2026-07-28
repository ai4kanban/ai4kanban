---
title: Show the board's daily progress in the UI
track: features
priority: low
roi: med
status: todo
blocked_by: []
related: []
modules: [local-ui]
questions: []
---

Show the board's daily progress in the UI, so the user can see the project moving
without reading a CSV.

The script already keeps the numbers: `docs/kanban/metrics.csv` has one row per day —
created, completed, rejected. Nothing shows them. The goal says the board should always
reflect the project's real progress; today only the open cards are visible, not the
movement.

## Scope
- An icon button in the header, next to the Sessions and Configuration buttons
  (`kanban-ui/components/Header.tsx`). It opens a read-only progress view.
- The view shows the last 30 days from `metrics.csv`: the running totals as plain
  numbers, and a line chart of created, completed, and rejected per day.
- Draw the chart the way the site does in `web/components/home/ThroughputChart.tsx`:
  plain SVG polylines with gridlines and right-edge labels, no charting library.
  Adapt the colors to the UI's light theme — the site chart sits on a dark panel.
- Read the file as it is. The script owns `metrics.csv`; the UI never writes it.
- A board with no metrics yet shows a short "no activity recorded" note.

## Decided by the agent
- How does the view open? As an overlay dialog, matching the Configuration dialog —
  the header already uses that pattern.
- `metrics.csv` skips days with no activity — plot them or not? Fill missing days
  with zeros so the x-axis is real time and a quiet week looks quiet.

## Todo
- [ ] Read and parse `metrics.csv` on the server; fill missing days with zeros.
- [ ] Add the header icon button and the dialog it opens.
- [ ] Build the progress view: totals as numbers, plus the SVG line chart of the
      last 30 days in light-theme colors.
- [ ] Handle the empty state.
- [ ] Update `kanban-ui/README.md` to mention the progress view.
