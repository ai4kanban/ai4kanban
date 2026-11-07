---
name: kanban
description: Manage the file-based task board with akb. Use for creating and planning tasks, revising or implementing cards, and managing background runs; also for "what's running".
---

# Kanban board

The board is worked only through `akb`. Find the command for the job in `akb help` and run
it; never do its work by hand or from memory.

- **`--print` does it here**: `akb card revise 12 --print "drop the export"` prints the whole
  flow for that card on this board; follow it to its closing steps. Without `--print` the
  same command starts a separate agent.
- **Keys**: never read or write API keys; the user sets them with `akb agent set apiKey`.
