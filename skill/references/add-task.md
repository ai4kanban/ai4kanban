# Add tasks

Route every request that may create a card through this file.

**Stop if setup is unfinished** — `docs/kanban/setup-checklist.md` being there says it is.
Create no card; follow `references/setup.md` instead.

## Route the request

- No idea supplied; find missing work → `references/propose.md`.
- Article, analysis, research, complaint, or other source supplied →
  `references/extract-ideas.md`.
- Repeating job → `references/recurring-task.md`.
- Direct task idea → "Add one task idea" below.

A research task is a direct idea; a research report is source material. Reading or
summarizing a source without asking for tasks creates no card.

## Add one task idea

Turn one direct task idea or one validated draft into a card.

1. **Resolve the modules.** If the modules are not explicitly given, infer them
   yourself: read `docs/kanban/modules.md` and decide which modules the idea
   touches. Never ask the user which modules to use.
   If no module fits, repair `modules.md` according to `references/module-map.md`.
2. **Validate the idea.** Read `docs/kanban/memory/goal.md`, the resolved modules'
   memory, `${KB} list --module <module>`, and relevant code and docs. Skip work already
   supported or rejected; update the card that already owns planned work. If value,
   direction, or feasibility is unclear, explain the concern and ask before creating.
3. **Scaffold, then write the body.** Run `create --title "..." --track <track>
   --modules <the step-1 modules>` plus any other meta flags (see "The script" in
   `SKILL.md`) to write the file, its frontmatter, and the README entry.

## Tightly coupled tasks go in one group

If the request needs several tasks that only make sense together, make them a **group
task** instead of loose cards.

Example: "build a plugin system with a Slack and a Notion
demo plugin" → 4 ids: a group root for the plugin system + a subtask for the
system + a subtask for the Slack plugin + a subtask for the Notion plugin.

See "## Group task" in `SKILL.md` for the folder layout and how to allocate the ids.
Cards that stand on their own stay loose.

## Don't split off near-duplicates

If the new card is mostly a tweak, reframe, or extra detail on an upstream card that
**isn't built yet**, update the upstream card instead. A card earns its own id only
for genuinely separate work — a different file, system, or deliverable.

## Scaffold the card

Every meta field comes from a `create` flag. The frontmatter is not hand-editable — pass
the fields to `${KB} create`:

`--blocked-by` and `--related` are optional, based on the task dependencies.

```
${KB} create --title "Continue a run's conversation instead of copying its id" \
             --track features --priority med --roi med --modules local-ui

${KB} create --title "Stop saving a card's implementing stage" --track features \
             --priority med --roi high --modules local-ui,skill --related 58

${KB} create --title "Add a GitHub Projects storage backend for the board" \
             --track features --priority low --roi med --modules skill,local-ui \
             --blocked-by 55,61 --related 57
```

A new card carries no open questions — that's refine's job (`references/refine.md`).

Got a field wrong, or learned something after the fact? `${KB} update <id> --priority low`
— never an editor.

## Write the card's body

Replace the template — the summary line, `## Scope`, and `## Todo` only.

The body is what you write. The shape is rough, not a strict form. Keep lines short and
plain — a non-native reader skimming should get each line in one pass. Add any section
that helps; drop any that doesn't.

```
<one short line: what to do and why it matters.>

## Scope
- <the concrete steps>

## Todo
- [ ] <one step you can check off>
- [ ] <…>
```

- **title** lives in the frontmatter — one source of truth, so no `#` H1 in the body.
- **Todo** (REQUIRED): the scope split into single-line steps you can check off, in order.
- **Pushback** — add a `## Pushback` section only if something feels off: too much
  work for the value, not worth doing now, or a risk to users.

This isn't a full plan, just enough to start.
