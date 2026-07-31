# Resolve open questions

## Try to answer each question yourself

Research first — the module's code, the board, the memory set of any module the card
names (`docs/kanban/memory/<module>/`), and your reference docs. Many questions are
already settled, shipped, or rejected once you look.

Judgment calls — taste, priorities, money, product direction — get the same pass:
the trail of past `decisions.md`, `rejected.md`, `redesign.md`, and the board root's
`goal.md` often shows the user already made this call, or one close enough to decide from.

Decide yourself when the evidence gives you confidence. Note the decision and reason
under `## Decided by the agent` (read "Card format" in `SKILL.md`).

## Ask the user the rest

Ask when the evidence isn't enough. Keep the question itself plain and short: one line
the user can answer at a glance.

Run `${KB} tag <id> 1,2,3 user` for these questions.

### A question with choices

When the answer is a pick between choices, give the choices as **options** — don't pack
them into the question line. The user then ticks one instead of reading a sentence to
find them:

```
${KB} update 12 --question "[user] Where should the board live?" \
  --options "local files — simple | GitHub Projects — syncs with issues" \
  --pick one --recommend 1
```

- `--options` — the choices, split on `|`, two or more. **One short line each, with the
  reason inside that line** ("local files — simple"). There's no second field for a note.
- `--pick one` (the default) lets the user tick a single option; `--pick many` lets them
  tick as many as they want.
- `--recommend` — the option numbers ticked when the dialog opens, 1-based. One for
  `--pick one`, one or more for `--pick many`. Leave it off when you have no
  recommendation; the list then opens with nothing ticked.

The flags after a `--question` belong to that question, so one call can carry several:
repeat `--question` and give each its own options. A `--question` with no `--options`
stays a plain question with a text box — that's the right shape for anything open-ended.

The user always keeps the text box, so an options question can still be answered "none of
these" in their own words. You get back the option lines they ticked, or their words —
never both.

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
- **One plain line each**, written as `**<key>**: <call>` — the key is the question the
  call settles, or a short title for it. Give the call, not the reasoning, but keep it
  clear to someone planning another card:
  `**Where does a finished card go?**: to .archive/, kept in git. A rejected card is deleted.`
- **A new call replaces the old.** Rewrite the line it contradicts, never leave both. If
  you can't tell which one the user holds, change nothing and ask with a `[user]` question.
