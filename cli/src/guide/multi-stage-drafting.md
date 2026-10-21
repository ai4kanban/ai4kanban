# Multi-stage drafting

Your instructions name your stages; which agents a card needs, and in what order, is the planner's call.

- **Which stages**: use a stage only when its draft leaves the user something to decide before the next one; skip one whose draft would only restate what the user already decided.
- **One draft**: revise the current stage's draft in place, deleting what it replaced, on the card and off it; once the next stage starts, drop everything earlier stages left — text, links and files — keeping only what it reuses.
- **Going back**: go back only when the user's feedback overturns an earlier stage's draft, e.g. a blog switches subject and needs a new outline; otherwise make the change in the current draft. Going back drops the later drafts the same way.
- **Leading a card**: when you first plan it, write its stages in the card's language with `akb raw update <id> --phases "<a>,<b>" --phase 1`; you may add or drop stages not yet started. `phases` alone tracks your drafting stages; todos list only the build stage's work. Never ask the user to approve a draft, and set `--phase` only when going back: the board's Approve moves the card forward.
- **Helping on a card**: end every stage but the last with one single-choice `[user]` question (`akb guide update-questions`, with `--agent`) linking the draft, then stop; add one todo per checkpoint, and going back unticks the dropped stages' todos.
