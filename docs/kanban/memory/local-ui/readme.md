# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

- Run the board from a browser with `npx ai4kanban-ui`: `skill/references/local-ui.md`.
- Flip on the Auto-refine toggle so the UI refines cards in the background: `kanban-ui/README.md`.
- Archive a group root once all its subtasks are done or rejected: `kanban-ui/README.md`.
- A bar above the board asks you to write the goal when the agent judged it weak, with a plain editor on `goal.md`: `kanban-ui/README.md`.
- Pick the agent that runs the work in the Configuration dialog: `kanban-ui/README.md`.
- A failed run's Resume button continues that run's conversation from the UI, instead of copying an id into a terminal: `kanban-ui/README.md`.
- See the last 30 days of completed, created, and rejected cards as a chart in the Daily progress view: `kanban-ui/README.md`.
- Type the model the agent runs with in the Configuration dialog, instead of hand-editing a command: `kanban-ui/README.md`.
- See on the board which cards are waiting on another card, and which card is in the way: `kanban-ui/README.md`.
- See which card auto-refine is on right now, from a **Refining #&lt;id&gt;** label beside the switch: `kanban-ui/README.md`.
- Flip the header to **Queue** to see the same cards split into ready to build and not ready, instead of by track: `kanban-ui/README.md`.
- Auto-refine leaves a blocked card alone until its blockers are gone, so no run is spent on a plan that depends on unbuilt work: `kanban-ui/README.md`.
- See what a run cost in dollars beside its duration in the session log, marked as an estimate: `kanban-ui/README.md`.
- See which model did a run's work in its session log, taken from what the agent reported, not from the model setting: `kanban-ui/README.md`.
- Set how many cards auto-refine works on at once, up to 5, from the Configuration dialog: `kanban-ui/README.md`.
- Refine the card you are looking at right now with a **Refine** button on its page, instead of waiting for the board to reach it — and it works with the auto-refine switch off: `kanban-ui/README.md`.
- Answer a question with choices by ticking a list with the recommended ones already ticked, instead of reading the options out of a sentence: `kanban-ui/README.md`.
- Start the UI where there is no board and the page says there is no board here, names the folder it searched, and gives what to run for both causes — instead of a crash screen: `kanban-ui/README.md`.
