# QA loop

Finish one task's planning QA in this session. Resolve everything the project can answer
and leave only decisions that genuinely need the user. Do not mark the card ready, change
project code, or touch another card.

## Loop until the card converges

1. Read the current card and only the code, configuration, goal, project sources, and module
   memory needed to test its plan.
2. On the first pass only, compare the card with the available spec agents.
3. Reconsider every open question, including `[user]`. Move manual checks to `verify:`, drop
   what is answered, duplicated, or unnecessary, and apply an answer when evidence supports
   one.
4. Audit the updated plan's behavior, constraints, contracts, complete user flow, important
   edge cases, and build steps. Keep new candidates in working notes, not on the card.
5. Apply every supported answer, consolidate related gaps, prune decision residue, and write
   only the surviving user decisions to the question list.
6. If the card or its questions changed, restart at step 1 using the new card, but skip the
   spec-agent check.
7. Finish only after a complete sweep finds no new gap and makes no change.

There is no pass quota: the session boundary is the cap. A completed loop gets no second QA
session; requested specialist work suspends this loop and resumes it afterwards. Do not
reopen a settled decision merely to reconsider it; require concrete contrary evidence. A
clean sweep is evidence of convergence, not proof that no agent could ever miss something.

Request a spec agent only when its named responsibility is material and the card lacks a
valid section covering it; relevance alone is not enough. Request every needed agent once,
then stop without continuing QA, raising substitute questions, or starting writing. The
board resumes QA after their work. Do not request the same agent again unless a later user
change invalidated its section.

## Decide what survives

Leave a question only when all of these hold:

- **The plan needs the answer**: implementation cannot safely choose a normal default and
  still deliver the promised result.
- **The choice is real**: at least two safe, coherent answers remain after research.
- **The user owns it**: evidence favors neither answer, and the choice materially changes
  what the user receives or accepts.

Judge the decision, not its category. Ask once for one missing policy instead of listing its
consequences. If more than three independent questions survive, challenge each again.

## Apply what the project answers

Follow `akb guide writing`. Merge each answer into the existing plan, remove obsolete or
contradictory text, preserve completed work, and add newly required work as unchecked todos.
Put a lasting agent decision under `## Decided by the agent`.

Move a manual check to `verify:`. Drop an answered or unnecessary question:

```text
akb board update-questions <id> --to-verify <n[,n...]>
akb board update-questions <id> --drop <n[,n...]>
```

## Prune decision residue

Challenge aggressively, but delete conservatively. QA prunes only:

- **Questions**: drop those that fail the decision bar and merge those governed by one
  policy.
- **Decision notes**: say each decision once across `## Worth noting` and `## Decided by the
  agent`. Keep a human-half entry only when a reasonable reviewer may reject its material
  tradeoff; move a necessary lasting decision below the boundary and delete the rest. One to
  three independent `## Worth noting` items is normal.
- **Answer residue**: remove text, options, and unchecked todos made obsolete or
  contradictory by an answer applied in this session.

Do not otherwise compress `## Today`, `## Scope`, `## Todo`, or the spec. The writing pass
owns general cleanup; QA must preserve promised behavior and implementation requirements.

## Write user decisions

Each surviving question must be `[user]`, one line, and carry at least two concise options
with one recommendation. Fold dependent choices into the options of the decision they depend
on. Append all survivors in one command:

```text
akb board update-questions <id> \
  --append "[user] Which behavior should apply?" \
  --recommended-option "A — reason" --option "B — reason"
```

## Success criteria

The session ends only in one of these states:

- **No questions**: every gap is settled; writing is next.
- **Only `[user]` questions**: each was revalidated in the final sweep and carries concrete
  choices and a recommendation; wait for the user.
- **Spec agents requested**: QA stopped after its one roster check; their work resumes QA.

Never leave an untagged question for another session to triage. If the session cannot reach
either state, it is incomplete and must not claim convergence.
