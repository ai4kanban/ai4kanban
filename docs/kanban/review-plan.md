# Reduce review cost and give users control

## Problem

Implementation automatically starts a separate AI review. Every subsequent rebase starts
another full review, even when the delivery already passed. This adds cost and waiting time
that users cannot currently opt out of.

For #294, the delivery record shows two reviews, not three. They took 17 minutes and cost
an estimated $8.70, compared with $12.21 for implementation. The second review followed a
rebase onto a moved `main`. The screenshot also shows a review of #293 beneath #294, making
the grouping misleading.

Both reviews found and fixed issues, including a rate-limit bypass. Review has value; the
problem is repeating its full scope automatically and making it mandatory for every budget.

## Proposed behavior

- **One full review by default**: review the delivery against its approved requirements,
  fix findings, and verify the fixes within the same session. Fixes alone do not trigger
  another reviewer.
- **Focused checks after rebasing**: run affected repository checks. Any additional AI
  review examines conflict resolutions and interactions introduced by the rebase, using
  the previous review as context instead of restarting the full review.
- **Optional AI review**: add an enabled-by-default `AI review` setting under Configuration
  and an override when starting an implementation. Persist the effective choice on the
  delivery so later sessions follow the same policy.
- **Checks remain required**: disabling AI review skips the separate reviewer. Implementation
  and conflict resolution still run required checks; existing landing and approval gates
  continue to apply.
- **Clear run history**: label the reason for an additional review, such as `Review after
  rebase`, and ensure a run from #293 cannot appear to belong to #294.

## Implementation order

1. Replace automatic full reviews after rebasing with focused integration checks and
   review. Define the comparison against the previously reviewed delivery and incoming
   target changes; a conflict-free rebase alone does not prove there are no interactions.
2. Add the Configuration setting and implementation override, including delivery persistence
   and the path from successful implementation to landing when AI review is disabled.
3. Correct run grouping and display why each additional review started.

## Verification

- **Default delivery**: implementation receives one full review; reviewer fixes are checked
  in that session and a passing result proceeds to landing.
- **Rebased delivery**: unrelated target changes do not restart a full review; interacting
  changes and conflict resolutions receive focused checks and, when enabled, focused review.
- **Review disabled**: no separate AI review starts, including after a rebase. Required
  checks and configured approval gates still apply.
- **Overrides and resume**: a delivery retains its selected review policy across sessions
  and resumes, even if the board default changes.
- **Run history**: sessions are grouped under their actual delivery, and additional reviews
  show their trigger.

## Relevant code

- `cli/src/lib/agent/review.ts`: starts review after implementation and records its outcome.
- `cli/src/lib/agent/landing.ts`: currently requests another review after every rebase.
- `cli/src/guide/review.md`: already directs the reviewer to fix and verify in one session.

This is a proposal; no implementation or board task changes are included.
