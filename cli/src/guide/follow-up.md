# Handle follow-up work

Use when planning or implementation discovers additional work.

- **Current task**: finish required work on this card; queue independent follow-ups in triage, then resume the original task.
- **Drop what was turned down**: queue nothing that
  `docs/kanban/memory/agents/planner/rejected.md` or
  `docs/kanban/memory/agents/planner/*/rejected.md` turns down.
- **Existing card**: when only another open card needs changing, run `akb card revise <id> "<the change and why>"`.
- **Queue it**: use the command below; skip an item the command reports as already there.
- **Workflow**: use the source card's `workflow:`, or the id from `akb workflow list` that fits the work when it has none.

```text
akb triage add --title "<one line>" --slug <short-english-slug> --source "#<id>" --workflow <workflow> --text "<body>"
```

## Write the item

- **Reader**: someone who has read neither the original card nor the code can decide in ten seconds whether the work is worth doing.
- **Order**: first explain what happened and what the user runs into, then say what the work would do.
- **Plain words**: keep file, function and field names, card ids, agent names and evidence trails out of the title and body.
