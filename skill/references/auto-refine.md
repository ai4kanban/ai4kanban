# Auto-refine

Loop refining a card (`references/refine.md`) **and resolving its open questions** (`references/resolve.md`),
until any of the conditions is met:
1. status !== "todo"
2. all todos checked
3. questions.length > 0 && every question tag === "user"

## Question tags

Each open question in the card's `questions` frontmatter carries a tag saying who owns it:

- **`[user]`** — a judgment call the agent must not guess: taste, priorities, money,
  product direction.
- **untagged** — freshly raised, not yet triaged. These are what a pass works through.

Set tags with the script — never hand-edit frontmatter:

```
${KB} tag <id> 1,2,3 user               # tag several questions at once (comma-separated)
```

## The loop

Never pause to ask the user.

1. Run `references/refine.md`.
2. If questions is not empty, spawn a subagent and hand it the card and the whole batch
   of untagged questions at once. Questions should be answered with a fresh context.
   It researches and decides according to `references/resolve.md`:
   If answering surfaces new questions, add them untagged and run one more subagent for
   the new batch.
