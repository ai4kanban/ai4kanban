# Add a task

Turn an idea into a card on the board. Review the idea before writing and the written
card after — both passes use `references/task-review.md`. On a failure, ask the user
about what it flagged, then decide from the answer whether to proceed or drop it.
Never drop a task without asking first.

1. **Resolve the modules.** If the modules are not explicitly given, infer them
   yourself: read `docs/kanban/modules.md` and decide which modules the idea
   touches. Never ask the user which modules to use.
   Then read each one's whole memory set at `docs/kanban/memory/<module>/`. A
   module with no folder yet has no notes. Read the umbrella
   set at `docs/kanban/` instead.
2. **Review the idea** — business necessity, feasibility, feature value, duplication.
   Judge it against the memory you just read: drop or fix any design `redesign.md`
   warns against, don't re-add what `rejected.md` turned down or what already shipped,
   respect settled `decisions.md`. Check "Don't split off near-duplicates" below.
3. **Scaffold, then write the body.** `create --title "..." --track <track>
   --modules <the step-1 modules>` plus any other meta flags (see "The script" in
   `SKILL.md`) writes the file, its frontmatter, and the README entry. Skip
   `--modules` only when the idea fits no module. Then spawn a subagent with this file and the card's path; it
   follows "Write the card's body" below. Adding three? Run `create` three times and
   spawn three subagents in parallel.
4. **Review the written card** — plain language, a real todo list, unambiguous plan.
5. **Refine it once** (`references/refine.md`) — a fresh card is a raw idea; the add
   isn't done until one refine pushes it a stage forward. Added several? Refine each.

## Don't split off near-duplicates

If the new card is mostly a tweak, reframe, or extra detail on an upstream card that
**isn't built yet**, update the upstream card instead. A card earns its own id only
for genuinely separate work — a different file, system, or deliverable.

## Write the card's body

For the body-writing subagent. The card is already scaffolded; replace the template
placeholders with Write/Edit — the summary line, `## Scope`, and `## Todo` only.
**Never touch the frontmatter** — the script owns it; a wrong meta field is fixed with
`create`/`update`, not an editor.

The shape is rough, not a strict form. Keep lines short and plain — a non-native
reader skimming should get each line in one pass. Add any section that helps; drop any
that doesn't.

```
---
title: <one line>
track: <one of your tracks>
priority: <high|med|low>
roi: <high|med|low>
blocked_by: [<id>, <id>]   # [] for none
related: [<id>, <id>]      # [] for none
questions: []              # questions a human must decide; [] for none
---

<one short line: what to do and why it matters.>

## Scope
- <the concrete steps>

## Todo
- [ ] <one step you can check off>
- [ ] <…>
```

- **title** lives in the frontmatter — one source of truth, so no `#` H1 in the body.
- **blocked_by / related / questions** are set through the script's flags (see
  "Relationships"), by whoever runs `create`/`update` — not in the body.
- **Todo** (REQUIRED): the scope split into single-line
  steps you can check off, in order.
- **Pushback** — add a `## Pushback` section only if something feels off: too much
  work for the value, not worth doing now, or a risk to users.

This isn't a full plan, just enough to start.

## Document a change

If the card ships something a user can see, it carries todos to update the docs it
touches (`references/document-feature.md`), so the change isn't hidden after it ships.

## Relationships

Two frontmatter lists connect cards by id, set with `--blocked-by` and `--related`:

- **Blocked by** — tasks that must finish first; this one can't start, or can't be
  done right, until they're done. A card with an open blocker isn't ready to pick.
- **Related** — tasks about the same feature, page, or data. They don't block this
  one, but keep them in sync so they don't drift apart or repeat each other.
