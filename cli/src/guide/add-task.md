# Add tasks

Use this guide whenever work may become a card. If setup is unfinished, stop and follow
`akb guide setup`; its final `tasks` step is the only exception.

## Route

- Repeating work → follow `akb guide recurring-task`; do not continue with the one-shot
  card flow below.
- Direct task idea → continue below.

## Create the card

Evaluate the idea with `akb guide evaluate-task`; during setup, use setup's batch
evaluation instead. Skip unclear, duplicate, unsupported, or previously rejected work.

Create the card with metadata flags rather than editing frontmatter:

```text
akb raw create --title "..." --modules <modules> \
  --priority <low|med|high> --roi <low|med|high>
```

If the card needs an open question, create the card first, then classify and write it by
`akb guide update-questions`.

Record each dependency on the card that waits: `--blocked-by` on the new card, or
`akb raw update <id> --blocked-by <ids>` on an existing card needing its output, keeping its
current ids — the flag replaces the list. `--related` marks cards that only relate.
Non-English titles also need `--slug <short-english-slug>`.

Add `--workflow <id>` from `akb workflow list` that fits the card's work, unless the request
names one; prefer one not `Pro · locked`, then the board's own. Omit it when none fits.

Representative examples:

```text
akb raw create --title "Add CSV export" \
  --modules local-ui --priority med --roi high

akb raw create --title "Document the export format" \
  --modules docs --blocked-by 42 --related 41 --priority low --roi med

akb raw create --title "支持导出任务" --slug export-tasks \
  --modules local-ui --priority med --roi high
```

### Group tasks

Use a group task when its cards are useful as parts of one larger outcome.
For example, “Build a plugin system with Slack and Notion examples” can be one group root
with three subtasks: the system, Slack integration, and Notion integration. Follow the
folder and linking steps in `akb guide board`; otherwise keep cards independent.

### Writing

Fill the body scaffold that `akb raw create` wrote. Do not rename or translate its section
titles, and leave empty scaffold sections in place. Do not repeat the title as an H1. During
setup, fill only the opening paragraph—the background refinement completes the plan.

## Refine

Carry the request's constraints into refinement; a memory opt-out does not waive planning.

- **Inline**: when the source already supplies a concrete outcome, boundaries, and build
  steps, run `akb card refine <id> --print` and continue in this session.
- **Separate session**: otherwise, or when the user asks for background work, run
  `akb card refine <id>`.

During setup, start neither; the setup watcher starts refinement after setup exits.
