# Resolve open questions

## Try to answer each question yourself

Research first — the module's code, the board, the memory set of any module the card
names (`docs/kanban/memory/<module>/`), and your reference docs. Many questions are
already settled, shipped, or rejected once you look.

Judgment calls — taste, priorities, money, product direction — get the same pass:
the trail of past `decisions.md`, `rejected.md`, `redesign.md`, and `goal.md` often shows the user
already made this call, or one close enough to decide from.

Decide yourself when the evidence gives you confidence. Note the decision and reason
under `## Decided by the agent` (read "Card format" in `SKILL.md`).

## Ask the user the rest

Ask when the evidence isn't enough. Write the options
and your recommendation into the question text itself. Keep it plain and short: one
line the user can answer at a glance.

> Where should the board live? (a) local files — simple; (b) GitHub Projects — syncs
> with issues. Recommend (a).

Run `${KB} tag <id> 1,2,3 user` for these questions.

## Update the frontmatter

- All answered → `${KB} update <id> --clear-questions`
- Some answered → `${KB} update <id> --drop-question 1,3` — the 1-based numbers of
  the answered ones. The rest stay untouched, tags included.

## Fold the answers into the card

Rewrite, don't append. Follow SKILL.md's "Card format" and "Writing style": keep the
card a minimal task spec. Merge answers on the same topic into one entry — not necessarily one
entry per question. Cut what the spec no longer needs.

An answer sometimes creates work the `## Todo` list doesn't cover — append it as new
unchecked todos, even when every box is ticked: an open question meant the card wasn't
finished, so the answers are the remaining work.

## Record lasting decisions

Append the user's calls to `memory/<module>/decisions.md`, under the topic that fits —
add a topic, or a subtopic under an existing one, when none does.

- **Only what the user decided.** Agent's own calls stay on the card (read "Card format" in
  `SKILL.md`). This file is what the human settled.
- **Skip** implementation-level and non-user-facing calls.
- **One plain line each** — the call, not the reasoning, but still clear to someone
  planning another card: `A finished card moves to .archive/; a rejected card is deleted.`
- **A new call replaces the old.** Rewrite the line it contradicts, never leave both. If
  you can't tell which one the user holds, change nothing and ask with a `[user]` question.
