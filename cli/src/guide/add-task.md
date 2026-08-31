# Add tasks

Use this guide whenever work may become a card. If setup is unfinished, stop and follow
`akb guide setup`; its final `tasks` step is the only exception.

## Route

- No task idea supplied → `akb guide propose`.
- Source material supplied for extracting ideas → `akb guide extract-ideas`.
- Repeating work → `akb guide recurring-task`.
- Direct task idea → continue below.

## Create the card

Evaluate the idea with `akb guide evaluate-task`; during setup, use setup's batch
evaluation instead. Skip unclear, duplicate, unsupported, or previously rejected work.

Create the card with metadata flags rather than editing frontmatter:

```text
akb board create --title "..." --track <track> --modules <modules> \
  --priority <low|med|high> --roi <low|med|high>
```

Add `--blocked-by` or `--related` when needed. Non-English titles also need
`--slug <short-english-slug>`.

Representative examples:

```text
akb board create --title "Add CSV export" --track features \
  --modules local-ui --priority med --roi high

akb board create --title "Document the export format" --track features \
  --modules docs --blocked-by 42 --related 41 --priority low --roi med

akb board create --title "支持导出任务" --slug export-tasks --track features \
  --modules local-ui --priority med --roi high
```

### Group tasks

Use a group task when its cards are useful as parts of one larger outcome.
For example, “Build a plugin system with Slack and Notion examples” can be one group root
with three subtasks: the system, Slack integration, and Notion integration. Follow the
folder and linking steps in `akb guide board`; otherwise keep cards independent.

### Writing

Fill the body scaffold that `akb board create` wrote. Do not rename or translate its section
titles, and leave empty scaffold sections in place. Do not repeat the title as an H1. During
setup, fill only the opening paragraph—the background refinement completes the plan.

## Refine

- **Lightweight**: clear outcome, narrow change, and low compatibility or coordination
  risk. Run `akb refine <id> --effort lightweight --print` and continue inline.
- **Standard**: everything else. Run `akb refine <id> --effort standard` to start a
  separate session.

Choose per card. If the user explicitly requests background work, omit `--print` for a
lightweight refinement. During setup, start neither; the setup watcher starts refinement
after setup exits.
