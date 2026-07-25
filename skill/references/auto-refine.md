# Auto-refine

The agent refines a card **and answers its own open questions** — the ones it's sure
about — instead of stopping at the user every time. It wraps the normal
`references/refine.md` review/rewrite with a confidence-gated answer loop; real judgment
still waits for the human.

## The loop

One card's whole loop runs in **one session** and never pauses to ask the
user. Repeat this pass until the card is done:

1. **Resolve leftover questions first.** The card may arrive with `questions` from a
   last loop. Tag and auto-answer them (steps 3 and 4) before any review — answers
   change what the review sees. One already tagged `[user]` stays as-is: it waits on
   the user, not on a re-rate.
2. **Review and raise questions.** Do the review in `references/refine.md` step 1 — but
   don't stop at the user. It yields open questions and revisions you decide yourself.
3. **Tag every untagged question** `[agent]` or `[user]`. `[agent]` means you're sure
   you can answer it well alone — a deliberately high bar. Anything with real judgment
   in it — taste, priorities, money, product direction — is `[user]` and waits for the
   human.
4. **Auto-answer the `[agent]` ones — one subagent per question, in parallel.** Each gets
   the card and its one question, researches and decides the way `references/resolve.md`
   says, and writes the answer into the card's `## Decided by the agent` part (below).
   If the research shows it's really a judgment call, it re-tags the question `[user]`
   instead of guessing.
5. **Update the frontmatter.** `${KB} update <id> --question "[user] ..."` listing only
   the questions still open — tag included, so the next loop knows who each one waits
   on — or `--clear-questions` if none are.
6. **Re-review.** A new answer can raise new questions, so go back to step 2. A question
   you already decided is written on the card, so you won't raise it again.

Two ways one session ends — never a third:

- **No questions left** → rewrite the plan one stage forward (`references/refine.md`
  step 2), then mark it `ready` (`${KB} update <id> --status ready`).
- **Only `[user]` questions left** → rewrite with what you could decide, leave those
  questions on the card, don't mark it `ready`, and end the session.

## The two-part card

Keep what the agent added apart from the human's plan, so anyone can see — and check —
exactly what the agent decided:

1. **The plan** — the summary line, `## Scope`, and `## Todo`: the human's original input.
2. **`## Decided by the agent`** — every auto-answer and every unasked-for refinement.
   One short line each: the question, then the answer. Never mix these into the plan.

## What reaches decisions.md

Auto-answers stay **on the card**. Append to `decisions.md` only a decision a future loop
or a new card would need, so it stays a short memory, not a dump of every auto-answer.
How and where to append is `references/resolve.md`'s rule — follow it.
