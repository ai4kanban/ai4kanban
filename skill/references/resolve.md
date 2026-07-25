# Resolve open questions

A card whose `questions` frontmatter is not empty is waiting on decisions.

Research first — the module's code, the board, the memory set of any module the card
names (`docs/kanban/memory/<module>/`), and your reference docs. Many questions are
already settled, shipped, or rejected once you look. Decide yourself when the evidence
settles it, noting the decision and reason in the card body. Ask the user when it's a
judgment call — taste, priorities, money, product direction — with options and a
recommendation; never guess on these.

Write each answer into the card body. Then append to `decisions.md` only the answers that
clear its bar — user-facing calls that help future planning, one plain line each, under
the topic that fits. Everything else stays on the card. Append to the copy of the module
the card names, else the board-root copy — one copy only, never both (see "The memory set"
in SKILL.md). Then update the frontmatter:

- all answered → `${KB} update <id> --clear-questions`
- some remain → `update <id> --question "..."` listing only the unanswered ones (the
  flag replaces the whole list).

An emptied `questions` list makes the card refinable again — refine it next.
