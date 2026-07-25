# Auto-refine

Refine a card **and answer its own open questions** — the ones the agent is sure about —
instead of stopping at the user every time. It wraps `references/refine.md` with a
confidence-gated answer loop; real judgment still waits for the human.

One session drives one card to one of two rests: `ready`, or holding only `[user]`
questions (calls only the human can make).

## Question tags

Each open question in the card's `questions` frontmatter carries a tag saying who owns it:

- **`[user]`** — a judgment call the agent must not guess: taste, priorities, money,
  product direction.
- **`[agent]`** — answered by the agent; the answer lives in the card body.
- **untagged** — freshly raised, not yet triaged. These are what a pass works through.

Set tags with the script — never hand-edit frontmatter:

```
${KB} tag <id> <n> user      # hand question n (1-based) to the human
${KB} tag <id> <n> agent     # mark question n as answered by the agent
```

## The loop

Never pause to ask the user.

1. **Skip the `[user]` questions.**
2. **Answer each untagged question — one fresh subagent per question, in sequence.** The
   agent that raised a question must not answer it; a fresh context judges it objectively.
   Hand the subagent the card and that one question. It researches and decides the way
   `references/resolve.md` says, then:
   - **Answerable** → it writes the answer into `## Decided by the agent` (below); mark
     the question `${KB} tag <id> <n> agent`.
   - **A real judgment call** → it does not guess. Mark it `${KB} tag <id> <n> user`.

   Go one at a time, in order, so each subagent sees the answers written before it.
3. **Review and raise questions.** Do `references/refine.md` step 1 — but don't stop at
   the user. Add any new question untagged (`${KB} update <id> --question "..."`), then go
   back to step 2 for it.
4. **Settle the frontmatter.** When no untagged questions remain, keep only the `[user]`
   ones: `${KB} update <id> --question "[user] ..."` for each (the flag replaces the whole
   list, tag included), or `--clear-questions` if none are left.

Then end, one of two ways — never a third:

- **No questions left** → rewrite the plan one stage forward (`references/refine.md`
  step 2), then mark it `ready` (`${KB} update <id> --status ready`).
- **Only `[user]` questions left** → rewrite with what you could decide, leave those
  questions on the card, don't mark it `ready`.

## The two-part card

Keep what the agent added apart from the human's plan, so anyone can check exactly what
the agent decided:

1. **The plan** — the summary line, `## Scope`, and `## Todo`: the human's original input.
2. **`## Decided by the agent`** — every auto-answer and every unasked-for refinement.
   One short line each: the question, then the answer. Never mix these into the plan.

## What reaches decisions.md

Auto-answers stay **on the card**. Append to `decisions.md` only a decision a future loop
or a new card would need. How and where to append is `references/resolve.md`'s rule —
follow it.
