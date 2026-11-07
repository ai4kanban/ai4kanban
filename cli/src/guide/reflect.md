# Reflect on completed cards

## Read

Read each given `<card>` in full and check its own `shipped` content; keep cards separate.
Find needs the work left behind or revealed, and verify them in the project. Proposing nothing is fine.

## Filter

- **Duplicates**: check `akb raw list` and `akb triage check <source-id>`; propose shared work only once.
- **Exclude**: skip unsupported guesses, work covered by `<scheduled-agents>`, work rejected in `docs/kanban/memory/agents/planner/rejected.md` or its module folders, and calls the user reversed, in any `redesign.md` under `docs/kanban/memory/agents/` or under a card's `Overruled by the user`.
- **Existing cards**: when shipped work invalidates an open card's plan, run `akb card revise <id> "<the change and why>"` instead of proposing an item.

## Write

- **Reader**: someone who has read neither the original card nor the code can decide in ten seconds whether the work is worth doing.
- **Order**: first explain what happened and what the user runs into, then say what the work would do.
- **Plain words**: keep file, function and field names, card ids, agent names and evidence trails out of the title and body.

Write the body to a temporary Markdown file and end with the source card's archive path.
Write one triage item per proposal. Exploratory ideas are welcome; identify small chores as such.
Use the source card's `workflow:`, or the id from `akb workflow list` that fits the work when it has none.

```text
akb triage add --title "<one line>" --slug <short-english-slug> --source "#<id>" --workflow <workflow> --file <body.md>
```

Briefly report what you proposed and what you skipped, with reasons.
