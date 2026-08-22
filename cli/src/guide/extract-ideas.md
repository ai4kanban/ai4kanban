# Extract ideas from a source

## 1. Extract

Read the whole source. Extract concrete user problems, capability gaps, and the outcome
each candidate would improve.

**Rules**:

- **Evidence, not a spec**: Treat features and suggested solutions as ideas to test.
- **Strong signal only**: Skip general lessons and weak ideas; zero candidates is valid.

## 2. Route and validate

Read `docs/kanban/config.md`, `docs/kanban/memory/goal.md`, and
`docs/kanban/modules.md`. Assign each candidate to the module whose behavior would
change.

Group candidates by module and send each group to a subagent. Split a large group when
useful. Give it the relevant source excerpts, module memory, `akb board list --module
<module>`, code, and docs. If no subagent is available, run the same checks in the main
agent.

Return `add`, `update #<id>`, or `skip`, with one-line evidence.

**Rules**:

- **Existing modules only**: Do not invent a module to fit an outside idea.
- **Draft-only delegation**: Subagents return drafts; only the main agent creates cards.
- **Validation gate**: Keep only concrete, feasible gaps that fit `goal.md`, justify their scope, and are not already supported, rejected, or ruled out.
- **Existing plans**: Update a planned card only when the source adds a real requirement; otherwise skip it.

## 3. Reconcile and create

Merge duplicate drafts across modules and group tightly coupled work. Apply updates,
send each surviving `add` draft to "Add one task idea" in `akb guide add-task` — adding
`--proposed` to the `create` call, because the board found this work rather than a person
asking for it — then report what was created, updated, and skipped.

**Rules**:

- **High/medium priority only**: Discard low-priority ideas before deeper validation; create survivors with `--priority high` or `--priority med`.
- **Source required**: Every created card includes `## Source` with one item per source—`<name or description> — <URL, file, or message context>; <observation that led to the idea>`—and never substitutes a generic label such as "external research" or "user feedback".
- **Completed todos**: Never change ticked todos when applying an update.
