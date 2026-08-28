# QA loop

Finish one task's planning QA in this session. Resolve everything the project can answer
and leave only decisions that genuinely need the user. Do not mark the card ready, change
project code, or change an existing unrelated card. Creating cards while splitting this
one is allowed.

## Loop until the card converges

1. Read the current card and only the code, configuration, goal, project sources, and module
   memory needed to test its plan.
2. Before checking details, decide whether the card is one coherent unit. Split it first
   when it has a clear seam between independently refinable deliverables.
3. Once any split is complete, compare the resulting current card with the available spec
   agents. Do this once in the session.
4. Reconsider every open question, including `[user]`. Move manual checks to `verify:`, drop
   what is answered, duplicated, or unnecessary, and apply an answer when evidence supports
   one.
5. Reconstruct the promised outcome from scratch. Test the updated plan with concrete
   scenarios from each affected perspective, walking each from trigger to observable result.
   Challenge every unstated assumption. Keep new candidates in working notes, not on the card.
6. Apply every supported answer, consolidate related gaps, prune decision residue, and write
   only the surviving user decisions to the question list.
7. If the card or its questions changed, restart at step 1 using the new card, but skip the
   spec-agent check.
8. Finish only after a complete sweep finds no new gap and makes no change.

There is no pass quota: the session boundary is the cap. A completed loop gets no second QA
session; requested specialist work suspends this loop and resumes it afterwards. Do not
reopen a settled decision merely to reconsider it; require concrete contrary evidence. A
clean sweep is evidence of convergence, not proof that no agent could ever miss something.

Request a spec agent only when its named responsibility is material and the card lacks a
valid section covering it; relevance alone is not enough. Request every needed agent once,
then stop without continuing QA, raising substitute questions, or starting writing. The
board resumes QA after their work. Do not request the same agent again unless a later user
change invalidated its section.

## Split before refining details

Roughly 200 lines or 12 todo items is a stop sign for a deliberate cohesion
check, not a hard limit. Split only at an obvious seam between independently refinable
deliverables; never split a cohesive plan to satisfy a count.

Keep the current id for one slice and create the others with `akb board create --schedule
refine`, assigning each requirement once and carrying only relevant metadata and
dependencies. Give each title that is not in English a `--slug <short-english-slug>` —
filenames are ASCII. Then continue this loop on the current slice.
Do not ask the user to approve an evident split or refine the new cards here.

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

Outside a split, do not otherwise compress `## Today`, `## Scope`, `## Todo`, or the spec.
The writing pass owns general cleanup; QA must preserve promised behavior and implementation
requirements.

## Write user decisions

Each surviving question must be `[user]`, one line, and carry at least two concise options
with one recommendation. Fold dependent choices into the options of the decision they depend
on. Append all survivors in one command:

```text
akb board update-questions <id> \
  --append "[user] Which behavior should apply?" \
  --recommended-option "A — reason" --option "B — reason"
```

A question is exclusive: the user picks one option. Add `--mode multi` only when the options
can genuinely be combined — "which of these to include", not "which way to go" — and then
recommend every option you would take.

## Success criteria

The session ends only in one of these states:

- **No questions**: every gap is settled; writing is next.
- **Only `[user]` questions**: each was revalidated in the final sweep and carries concrete
  choices and a recommendation; wait for the user.
- **Spec agents requested**: QA stopped after its one roster check; their work resumes QA.

Never leave an untagged question for another session to triage. If the session cannot reach
either state, it is incomplete and must not claim convergence.
