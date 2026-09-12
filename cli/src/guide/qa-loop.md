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

1. Establish the promised outcome and affected entry points from the card and code, not
   only its proposed solution.
2. Use every available spec agent’s `description` as its trigger. Check the current scope
   and request each match whose section is missing or outdated, even if you can plan it yourself. Then stop;
   QA resumes after their work. Recheck triggers when the scope changes.
3. Resolve what project evidence answers. Follow each decision into the new questions and
   obligations it creates, especially when skipping, deferring, or dropping work.
4. Reconstruct the promised outcome and walk concrete normal, edge, failure, recovery, and
   regression scenarios from trigger to observable result. Find affected entry points in code
   and check each through visible, usable completion, including failure compensation. Put
   those results in acceptance criteria; command success or file existence alone is insufficient.
5. Apply supported conclusions with `akb guide writing`. Remove obsolete text and decision
   residue while preserving promised behavior and completed work.
6. Classify every surviving decision and hand-check with `akb guide update-questions`. If more
   than three `[user]` questions survive, challenge them again.
7. Before finishing, try to construct a concrete case where implementing the plan exactly
   still fails the promised outcome. Resolve any counterexample and retain its acceptance
   check in the card. Repeat until a full sweep finds no gap and makes no change; an empty
   question list alone does not prove convergence.

There is no pass quota. Do not reopen a settled decision without concrete contrary evidence.

## Success criteria

When no split was made, the session ends only in one of these states:

- **No questions**: every gap is settled; writing is next.
- **Only `[user]` questions**: each was revalidated in the final sweep and carries concrete
  choices and a recommendation; wait for the user.
- **Spec agents requested**: QA stopped for matching agents; their work resumes QA.

Never leave an untagged question for another session to triage. If the session cannot reach
one of these states, it is incomplete and must not claim convergence.
