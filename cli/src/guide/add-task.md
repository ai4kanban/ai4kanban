# Add tasks

Route every request that may create a card through this file. Evaluate each task idea with
`akb guide evaluate-task` before creating it.

**Stop if setup is unfinished** — `docs/kanban/setup-checklist.md` being there says it is.
Create no card; follow `akb guide setup` instead.

## Route the request

- No idea supplied; find missing work → `akb guide propose`.
- Article, analysis, research, complaint, or other source supplied →
  `akb guide extract-ideas`.
- Repeating job → `akb guide recurring-task`.
- Direct task idea → "Add one task idea" below.

A research task is a direct idea; a research report is source material. Reading or
summarizing a source without asking for tasks creates no card.

## Add one task idea

Turn one evaluated direct idea or validated draft into a card. Run
`akb board create --title "..." --track <track> --modules <modules>` plus any other meta
flags (`akb board help create`) to write the file, its frontmatter, and the README entry.

## Tightly coupled tasks go in one group

If the request needs several tasks that only make sense together, make them a **group
task** instead of loose cards.

Example: "build a plugin system with a Slack and a Notion
demo plugin" → 4 cards: a group root for the plugin system + a subtask for the
system + a subtask for the Slack plugin + a subtask for the Notion plugin.

See "Group task" in `akb guide board` for the folder layout and the steps that build one.
Cards that stand on their own stay loose.

## Scaffold the card

Every meta field comes from a `create` flag. The frontmatter is not hand-editable — pass
the fields to `akb board create`:

`--blocked-by` and `--related` are optional, based on the task dependencies. A title that is
not in English also needs `--slug <short-english-slug>` — filenames are ASCII, and without
one every such card is named `<id>-task.md`.

```
akb board create --title "Continue a run's conversation instead of copying its id" \
             --track features --priority med --roi med --modules local-ui

akb board create --title "Stop saving a card's implementing stage" --track features \
             --priority med --roi high --modules local-ui,skill --related 58

akb board create --title "Add a GitHub Projects storage backend for the board" \
             --track features --priority low --roi med --modules skill,local-ui \
             --blocked-by 55,61 --related 57
```

A new card carries no questions. Its follow-up refinement discovers the details and
decisions the initial body does not cover.

## Choose its refine effort

After writing each card, classify it from the request, card, and only relevant project
evidence. Never ask the user for an estimate or classification.

- **Lightweight**: the observable outcome and boundaries are clear, and implementation is
  one localized path with contained compatibility, data, security, and coordination risk.
- **Standard**: every other case. Its QA loop checks task boundaries before refining details
  and splits only when several independently refinable areas exist and one remains vague.

For lightweight effort, run `akb refine <id> --effort lightweight --print` and follow it
inline. Omit `--print` only when the user explicitly wants background refinement. For
standard effort, run `akb refine <id> --effort standard` to hand the card to its own session.
Choose separately for every card in a group.

Got a field wrong, or learned something after the fact? `akb board update <id> --priority low`
— never an editor.

## Write the card's body

Replace the scaffolded body according to `akb guide writing`. A new card normally needs
the opening paragraph, `## Scope`, and
`## Todo`; add other sections only when that guide calls for them.

The title lives in frontmatter, so do not repeat it as an H1 in the body.

This isn't a full plan, just enough to start.
