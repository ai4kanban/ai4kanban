# Auto-refine

Loop refining a card (`akb guide refine`) **and resolving its open questions** (`akb guide resolve`),
until any of the conditions is met:
1. status !== "todo"
2. all todos checked
3. questions.length > 0 && every question tag === "user"

## The loop

Never pause to ask the user.

1. Run `akb guide refine`.
2. If questions is not empty, spawn a subagent and hand it the card and the whole batch
   of untagged questions at once. Questions should be answered with a fresh context.
   It researches and decides according to `akb guide resolve`:
   If answering surfaces new questions, add them untagged and run one more subagent for
   the new batch.
