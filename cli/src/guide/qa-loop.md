# QA loop

Finish one task's planning QA. Resolve what project evidence answers and leave only decisions
the user owns. Do not mark the card ready or change project code.

## Check task boundaries

Before refining details, decide whether the card is one coherent task. Split only when it
contains multiple independently refinable areas and at least one is still materially vague;
some areas may already be clear. Length alone is not a reason to split / not split.

If a split is necessary, run `akb guide add-task` and follow its group-task procedure. Create
each subtask with:

```text
akb raw create --title "<one area>" --modules <modules> \
  --related <root-id> --schedule refine
```

After creating the group, exit. The scheduled subtasks refine themselves.

## Refine when no split is needed

1. Read only the card and relevant project evidence.
2. Compare it with the available spec skills once. Request only skills whose responsibility
   is material and whose section is missing, then stop; QA resumes after their work.
3. Resolve every question project evidence can answer. Drop duplicated or unnecessary
   questions.
4. Reconstruct the promised outcome and walk concrete normal, edge, failure, recovery, and
   regression scenarios from trigger to observable result.
5. Apply supported conclusions with `akb guide writing`. Remove obsolete text and decision
   residue while preserving promised behavior and completed work.
6. Classify every surviving decision and hand-check with `akb guide update-questions`. If more
   than three `[user]` questions survive, challenge them again.
7. Repeat this refinement loop whenever the card changes. Finish only when one complete
   sweep finds no new gap and makes no change.

There is no pass quota. Do not reopen a settled decision without concrete contrary evidence.

## Success criteria

When no split was made, the session ends only in one of these states:

- **No questions**: every gap is settled; writing is next.
- **Only `[user]` questions**: each was revalidated in the final sweep and carries concrete
  choices and a recommendation; wait for the user.
- **Spec skills requested**: QA stopped after its one catalog check; their work resumes QA.

Never leave an untagged question for another session to triage. If the session cannot reach
one of these states, it is incomplete and must not claim convergence.
