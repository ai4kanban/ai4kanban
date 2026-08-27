# Resolve questions

Use the distinction between questions and open questions in `akb guide board` and the
ownership bar in `akb guide user-question`. This pass works through untagged questions and
leaves only decisions that genuinely require the user tagged `[user]`.

## Move the ones that aren't questions

Some entries are manual checks left by a build, not decisions anyone must make. For
example: "Try it on a real repo" or "The numbers look right, but this has not been run on
a large board." Move each one to the card's `verify:` field:

```
akb board update-questions <id> --to-verify 2
```

That moves question 2 into `verify:` in one call — the wording is kept and a `[user]` tag
is dropped for you. Use one test:

- A **decision** stays in `questions:` because someone must answer it.
- A **manual check** moves to `verify:` because the user only needs to perform or confirm
  it.

Verify lines are short notes, not questions. They do not block a card from reaching
`ready`, resolving, or being archived, and they remain with the archived card. Do this
pass first; it often makes the remaining questions easy to settle in one batch.

## Try to answer each question yourself

Research first — the module's code, the board, the memory set of any module the card
names (`docs/kanban/memory/<module>/`), and your reference docs. Many questions are
already settled, shipped, or rejected once you look.

For an apparent user-owned decision, check past `decisions.md`, `rejected.md`,
`redesign.md`, and the board root's `goal.md`; the user may already have settled it or a
closely related call.

Decide when the evidence gives you confidence, then record the answer according to the
decision rules in `akb guide board`.

## Ask the user the rest

When the evidence cannot settle a user-owned decision, write it according to
`akb guide user-question`.

A question the user answers is always a list of choices they tick, so handing one over
means rewriting it with its options. `akb board update-questions <id> --update <n> ".."`
rewrites question `n` in place — text, tag and options together — and never touches its
siblings. (`akb board tag <id> 1,3 user` only flips ownership; use it for a question that
already carries options.)

```
akb board update-questions 12 \
  --update 1 "[user] Where should the board live?" \
    --recommended-option "local files — simple" \
    --option "GitHub Projects — syncs with issues" \
  --update 2 "[user] Which parts ship in v1?" \
    --option "the board" \
    --option "the CLI" \
    --option "the web UI"
```

`--recommended-option` is an `--option` that opens ticked — one flag, so the choice is
written once and sits wherever you list it. Two options is the minimum; fewer is refused.

Every question is multi-select, and the board adds a last choice, "Something else", that
opens a text box — so an open-ended question is still asked as options. Never write that
choice yourself. You get back the option lines the user ticked, their words, or both.

## Update the frontmatter

- All answered → `akb board update-questions <id> --clear`
- Some answered → `akb board update-questions <id> --drop 1,3` — the 1-based numbers of
  the answered ones. The rest stay untouched, tags included.

The card's verify lines are not part of this. They are notes, not questions — leave them
where they are, and never clear them to make the card look settled.

## Fold the answers into the card

Rewrite, don't append. Follow "Card format" and "Writing rules" in `akb guide board`: keep the
card a minimal task spec. Merge answers on the same topic into one entry — not necessarily one
entry per question. Cut what the spec no longer needs.

When the answer was a pick from options, keep only what was picked and delete the rest from
the spec. The card states the decision, not the menu it came from.

An answer sometimes creates work the `## Todo` list doesn't cover — append it as new
unchecked todos, even when every box is ticked: a question meant the card wasn't
finished, so the answers are the remaining work.

Re-read the human half last: the answers changed the plan, so the opening paragraph and
`## Worth noting` have to still hold. A spec agent's section an answered question pointed
at moves back below the boundary.

## Record lasting decisions

Append the user's calls to `memory/<module>/decisions.md`, under the topic that fits —
add a topic, or a subtopic under an existing one, when none does.

- **Only user decisions**: as required by `akb guide board`; agent decisions stay on the
  card.
- **Skip** implementation-level and non-user-facing calls.
- **One plain line each**, written as `**<key>**: <call>` — the key is the question the
  call settles, or a short title for it. Give the call, not the reasoning, but keep it
  clear to someone planning another card:
  `**Where does a finished card go?**: to .archive/, kept in git. A rejected card is deleted.`
- **A new call replaces the old.** Rewrite the line it contradicts, never leave both. If
  you can't tell which one the user holds, change nothing and ask with a `[user]` question.
