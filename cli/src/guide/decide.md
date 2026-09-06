# Decide the questions waiting on the user

Answer every open `[user]` question on the card yourself, then apply your answers exactly as
`akb guide resolve` says. You are standing in for the user, so the card never goes back to
them: it leaves this run with no `[user]` question on it.

Do not research, change project code, raise a new question, or touch any frontmatter field
but `questions:` and `decided:`.

## Choose each answer

Take each question in turn, and stop at the first of these that settles it:

1. `docs/kanban/memory/goal.md` — what this project is for.
2. `docs/kanban/memory/<module>/decisions.md`, for the card's own modules — a call the user
   has already made that this question is a case of.
3. The question's own recommendation — the options it opens ticked.

If none of them settles it, take the recommendation anyway: every recommended option on a
multi-choice question, the first option when nothing is recommended, and — on a question
with no options at all — the answer you would give. Never leave a question open, and never
hand the card back.

## Apply them

Follow `akb guide resolve` from "Apply each answer", with one step left out: **record no
lasting decision**. What you chose is yours, not the user's, so nothing goes into any
`memory/<module>/decisions.md` or into a spec agent's memory.

## Write down what you chose

Before dropping each answered question, record the choice on the card:

```text
akb raw update-decided <id> --question ".." --chose ".." --from "docs/kanban/memory/<module>/decisions.md"
```

`--question` is the question without its `[user]` tag, `--chose` is the option you took, and
`--from` is the file that settled it. Leave `--from` off when nothing settled it and you took
the recommendation — that is the case the card page draws differently.
