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
- Stop a running run from the ✕ in the log window's title bar, with one confirmation, instead of hunting down the process in a terminal: `kanban-ui/README.md`.
- One bar shows how far setup got and hands over the line to paste into your coding agent, until setup's last box is ticked; a goal judged weak later brings the same bar back with just that item: `kanban-ui/README.md`.
- Move a card into a release, or back out of it, by picking from the open releases on the card page — no terminal, and no version id to type: `kanban-ui/README.md`.
- Keep your API key in one place, `docs/kanban/.env` — type it into the Configuration dialog or write the line yourself, and the board keeps the file out of git: `kanban-ui/README.md`.
- The Configuration dialog draws the settings the picked agent says it takes, instead of one fixed Model box, and saving leaves every other key in the file alone: `kanban-ui/README.md`.
- Pick how hard the model thinks — low to max — from a list in the Configuration dialog, and leave it on the agent's default to pass nothing: `kanban-ui/README.md`.
- Run every board action through Codex CLI, including continuing a failed Codex conversation with Resume: `kanban-ui/README.md`.
- Press **Test** in the Configuration dialog to send one tiny message through the setup you saved and see whether it works, with the agent's own reason when it doesn't: `kanban-ui/README.md`.
- Read the whole project goal from a compass in the header, on the board and on a card page alike, and edit it there — the file's `reviewed:` field is left to the agent: `kanban-ui/README.md`.
- Pick who pays for a run — the Claude subscription, the Anthropic API, or any Anthropic-compatible gateway — in the Configuration dialog, and the run goes through that pick alone, not through something your shell exported: `kanban-ui/README.md`.
- Start a release from the header's release dropdown — it is on every board, including one that has never planned a version, and a name the board can't take says why without closing the dialog; closing, renaming and reordering a release stay terminal jobs: `kanban-ui/README.md`.
- Pick which release the board and queue view show from the header dropdown — other releases' cards are hidden, every blocker stays on screen, and the choice is remembered per project in the browser: `kanban-ui/README.md`.
- The New release dialog carries a fill toggle — on by default, with the count of unplanned high-priority cards it would put in, and the ones it would leave named with the test each failed: `kanban-ui/README.md`.
- Give up on a version from the header's release dropdown — Drop shows while that release is on screen, and a confirm dialog lists the open cards losing their release before anything is written: `kanban-ui/README.md`.
