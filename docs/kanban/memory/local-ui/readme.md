# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note. Everything below is covered by `kanban-ui/README.md`,
except where another doc is named.

## Running the board

- Run the board from a browser with `npx ai4kanban-ui`: `skill/references/local-ui.md`.
- Started where there is no board, the page says so, names the folder it searched, and
  gives what to run — instead of a crash screen.
- A bar shows how far setup got and hands over the line to paste into your coding agent; a
  goal judged weak later brings the same bar back with just that item.

## Reading the board

- Flip the header between the track board and a **Queue** view that splits the same cards
  into ready to build and not ready.
- See which cards are waiting on another card, and which card is in the way.
- Read the whole project goal from a compass in the header, on the board and on a card
  page alike, and edit it there — writing into an empty box with the ask and a link to the
  guide above it, and saving stops the board asking for a goal right away.
- See the last 30 days of completed, created, and rejected cards as a chart in the Daily
  progress view.

## Releases

- Move a card into a release, or back out of it, from the card page — no version id to
  type.
- Start a release from the header dropdown, on every board including one that never
  planned a version; a fill toggle states the rule and names the cards it would put in and
  the ones it would leave, with the test each failed.
- Show one release at a time from the header dropdown — other releases' cards are hidden,
  every blocker stays on screen, and the pick is remembered per project.
- Close a shipped version or drop one that won't ship from the ⋯ menu, with a confirm that
  lists the open cards losing their release and, on close, any card whose todos are all
  ticked but which was never archived.

## Runs

- Stop a running run from the ✕ in the log window's title bar, with one confirmation.
- Continue a failed run with Resume, on Claude Code and Codex alike, instead of copying an
  id into a terminal.
- See what a run cost in dollars beside its duration, marked an estimate, and which model
  did the work, taken from what the agent reported.

## Auto-refine

- Flip on the Auto-refine toggle to refine cards in the background, up to 5 at once, and
  see which card it is on from a **Refining #<id>** label. It leaves a blocked card alone
  until its blockers are gone.
- Refine the card you are looking at from a **Refine** button on its page, with the switch
  off.

## Recurring tasks

- Run a recurring card from its page — **Run** stands in for Implement, does one pass of
  the card's Process, records the run, and leaves the card on the board; Archive and Refine
  never show.
- Give the card a cadence — a number, a unit, and a time of day for whole days — and the
  board runs the job itself when it comes due, showing the next run beside the last one.

## Cards

- Answer a question with choices by ticking a list, with the recommended ones already
  ticked.
- Archive a group root once all its subtasks are done or rejected.

## Configuration

- Pick the agent that runs the work, Claude Code or Codex CLI, and the dialog draws the
  settings that agent says it takes.
- Pick how hard the model thinks — low to max — or leave it on the agent's default.
- Pick who pays for a run — the Claude subscription, the Anthropic API, or any
  Anthropic-compatible gateway — and the run goes through that pick alone, not through
  something your shell exported.
- Keep your API key in `docs/kanban/.env`, typed into the dialog or written by hand, and
  the board keeps the file out of git.
- Press **Test** to send one tiny message through the setup you saved, with the agent's
  own reason when it doesn't work.
