# Resolve open questions

A card whose `questions` frontmatter is not empty is waiting on decisions.

Research first — the module's code, the board, the memory set of any module the card
names (`docs/kanban/memory/<module>/`), and your reference docs. Many questions are
already settled, shipped, or rejected once you look. Decide yourself when the evidence
settles it, noting the decision and reason in the card body. Ask the user when it's a
judgment call — taste, priorities, money, product direction — with options and a
recommendation; never guess on these.

Write each answer into the card body. Then append to `memory/<module>/decisions.md` for user-facing calls that help future planning, one plain line each, under
the topic that fits. Everything else stays on the card. Skip memory recording if it's auto-decided, implementation-level, non-user-facing, or what future planning never needs.

Then update the frontmatter:

- all answered → `${KB} update <id> --clear-questions`
- some remain → `update <id> --question "..."` listing only the unanswered ones (the
  flag replaces the whole list).

Then fold the answers into the plan. An answer sometimes creates work the `## Todo` list
doesn't cover — append those steps to the end of the list as new unchecked todos. Do this
even when every box is already ticked: a question raised during or after a build means the
card isn't finished, so the answers *are* the remaining work. An all-done todo list is
never a reason to add nothing.

**The todo list is append-only.** Never edit, delete, or untick a line that's already
there — a ticked box is a record of what was built, and rewriting it loses that history.
When an answer undoes or changes earlier work, append a new todo to revert the previous changes instead. The history reads as a sequence of decisions, not a patched-up list.

An emptied `questions` list makes the card refinable again — refine it next.
