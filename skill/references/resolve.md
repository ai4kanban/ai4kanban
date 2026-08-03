# Resolve open questions

Each open question in the card's `questions` frontmatter carries a tag saying who owns it:

- **`[user]`** — a judgment call the agent must not guess: taste, priorities, money,
  product direction.
- **untagged** — freshly raised, not yet triaged. These are what a pass works through.

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

Two commands hand a question over. Pick by one rule: does its wording change?

- **No — hand it over as it stands.** `${KB} tag <id> 1,3 user` flips ownership on the
  numbered questions and touches nothing else.
- **Yes — you're rewriting it**, usually because the answer is a pick between choices:
  list them as options so the user ticks one instead of reading a sentence to find them.
  `${KB} update-questions <id> --update <n> ".."` rewrites question `n` in place — text,
  tag and options together — and never touches its siblings.

```
${KB} update-questions 12 \
  --update 1 "[user] Where should the board live?" \
    --recommended-option "local files — simple" \
    --option "GitHub Projects — syncs with issues" \
  --update 2 "[user] Which parts ship in v1?" \
    --mode multi \
    --option "the board" \
    --option "the CLI" \
    --option "the web UI"
```

`--recommended-option` is an `--option` that opens ticked — one flag, so the choice is
written once and sits wherever you list it.

The user always keeps the text box, so an options question can still be answered "none of
these" in their own words. You get back the option lines they ticked, or their words —
never both.

## Update the frontmatter

- All answered → `${KB} update-questions <id> --clear`
- Some answered → `${KB} update-questions <id> --drop 1,3` — the 1-based numbers of
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
