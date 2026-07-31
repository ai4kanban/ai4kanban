# Refine

Take one task one step forward — from vague to concrete. First **check** the card, then
**rewrite it or raise a question**. **Gate:** a card whose `questions` frontmatter isn't
empty can't be refined — resolve them first (`references/resolve.md`).

## 1. Check

Each line below is one plain question. Answer yes or no; a no needs one line saying
what's wrong. Flag real problems, not hypotheticals.

- **Format — is it written like a card?**
  - **On topic**: does the body do what the title says? Anything else is another task.
  - **Plain language**: is every line plain and short ("Writing style" in `SKILL.md`)?
  - **No meta**: free of planning notes and meta-todos ("Card format" in `SKILL.md`)?
  - **A build plan**: is it split into `## Todo` boxes, one step of real work each?
- **Value — should this task exist at all?**
  - **Direction**: does it move the project toward the long-term goal and roadmap in
    `docs/kanban/memory/goal.md`? Suggest rejection in `questions` on a task that's off-goal.
  - **Already shipped**: is it built already? Code → search the codebase; content → search
    where that content lives (your reference docs); research → check past write-ups.
  - **Duplicate**: does another card already own the idea? Then update it, not this one.
- **Scope — is the plan the right size for the goal?**
  - **Goal fit**: would the goal still be met with this piece cut? Then it's scope creep.
    The goal is the title and its "so the user can ..." line, not what the summary grew
    into; on topic doesn't mean needed. Common drift: the goal is "find a run's log", the
    plan builds "a history of all runs".
  - **Missing updates/verification**: does the plan skip work it implies — tests, a review pass, landing
    copy? If a user can see the change, it carries doc-update todos so it isn't hidden
    after it ships (`references/document-feature.md`); none needs a why.
  - **Over-complication**: is the design more machinery than the value justifies?
  - **Grouping**: does this card only make sense with another one? Then they're one group.
- **Design — will the plan work?**
  - **Actionable**: could someone start on it tomorrow, or is it still a rough idea? If
    the how isn't obvious, are the options laid out with one recommended?
  - **Unambiguous**: can it be built without guessing? Code detail isn't needed; an open
    requirement is.
  - **Full user flow**: does the design cover the full user flow, not just the piece the title
    names? For example, auth isn't just login — sign-up and log-out too.
  - **Edge cases**: does the design hold up on them? Re-check the decisions the card
    states — written doesn't mean right. E.g. tasks kept in memory are lost on restart.
- **Status — does the card match what's already built?**
  - **Stale todos**: is each unchecked todo really still undone? Work lands without the
    box getting ticked.
  - **Finished**: are all the todos done **and** the goal met? Then it's not refinable.

## 2. Rewrite, or raise a question

Every NO turns into exactly one move below; a card with no problems skips them.
**Never write the review notes into the card** The card holds the plan and nothing else.
Read the "Card format" and "Writing style" of `SKILL.md`.

- **Rewrite.** Fix the issues while maintaining a minimal task spec.
- **Reject.** A failed Value check. "Reject an idea" in `SKILL.md`: a line in
  `rejected.md`, then `${KB} reject <id>`. Unsure the value is real? Raise a question.
- **Add a card.** A side idea, an unplanned, separate concern that doesn't
  belong to this card. "Add a task" in `SKILL.md`, minding `references/add-task.md`'s rule
  against near-duplicate splits.
- **Group.** Cards that only make sense together: "Group task" in `SKILL.md` and "Tightly
  coupled tasks go in one group" in `references/add-task.md`.
- **Archive.** Everything done and the goal met: "Finish a task" in `SKILL.md`.
- **Raise a question** instead of rewriting when the call is the user's (taste, priorities,
  money, product direction), or a **spec-level** problem is significant and you can't
  settle it — is this what the user wants, which of two shapes should the feature take,
  what's the rule in a case the card never names. Record it with `${KB} update-questions
  <id> --append ".."` (repeat the flag), leave that part alone; small calls, make them.
  A question only the user can settle is tagged `[user]`, and when it's a pick between
  choices it carries them as options ("Ask the user the rest" in `references/resolve.md`).
- **Mark it ready.** A concrete plan and no open questions finishes the card: `${KB} update
  <id> --status ready` — only if this refine stopped at the code level, not one stage
  short. The user scans for the `ready` pill to pick what to build next.
