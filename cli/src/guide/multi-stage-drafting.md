# Multi-stage drafting

Each agent's instructions name its stages and checkpoints; which agents a card needs, and in what order, is the planner's call.

- **When to split into stages**: split only when an intermediate draft leaves the user something to decide before the final one, e.g. stage 1 blog outline → stage 2 full article with illustrations; skip a stage whose draft would only restate what the user already decided.
- **Checkpoints**: add one todo per checkpoint; untick one only when its checkpoint is dropped and the work goes back to the previous stage.
- **User review**: end every stage but the last with one single-choice `[user]` question (`akb guide update-questions`, with `--agent`) linking the draft, then stop; the last stage needs no confirmation.
- **One draft**: revise the current stage's draft in place; once the next stage starts, drop the earlier draft.
- **Going back**: never reopen an approved stage on your own; a change to its content once a later draft exists is made in that draft in place. Go back only when the user asks, or offer "go back to the <previous draft> and start over?" when the current draft no longer fits, e.g. several rounds still miss what the user wants, or a blog switches to a different subject and needs a new outline.
