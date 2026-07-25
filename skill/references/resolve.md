# Resolve open questions

A card whose `questions` frontmatter is not empty is waiting on decisions.

Research first — the module's code, the board, the memory set of any module the card
names (`docs/kanban/memory/<module>/`), and your reference docs. Many questions are
already settled, shipped, or rejected once you look. Decide yourself when the evidence
settles it, noting the decision and reason in the card body. Ask the user when it's a
judgment call — taste, priorities, money, product direction — with options and a
recommendation; never guess on these.

Write each answer into the card body. Then append the **user-facing** decisions to
`decisions.md` — calls the user made or would care about. Internal details stay in the card body only. Rewrite each entry minimal and plain — one line: the question, then the
answer. Append to the board-root copy plus the copy of any module the card names (see
"The memory set" in SKILL.md). Then update the frontmatter:

- all answered → `node .claude/skills/kanban/kanban.mjs update <id> --clear-questions`
- some remain → `update <id> --question "..."` listing only the unanswered ones (the
  flag replaces the whole list).

An emptied `questions` list makes the card refinable again — refine it next.
