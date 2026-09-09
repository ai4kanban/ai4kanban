# Lightweight QA

Refine the card automatically from the request, the card, and only the relevant project
evidence. Inspect the affected path, task boundaries, and available spec agents' triggers first.
Follow `akb guide qa-loop` in this session when any of these conditions holds:

- **Plan size**: the plan is too big to implement and verify reliably in one task.
- **Spec agents**: a matching agent's section is missing or outdated.
- **Scenario gaps**: a brief walk through normal, edge, failure, recovery, and regression paths
  exposes unresolved behavior beyond a localized fix.
- **Unsettled scope**: the work is broader or more uncertain than the card shows, or fixes keep
  revealing further gaps.
- **User questions**: more than three `[user]` questions survive classification.

Otherwise settle implementation details and fix concrete omissions or contradictions directly.
Do not run or retain a question checklist.

Classify every surviving decision and hand-check with `akb guide update-questions`. Unless that
leaves a `[user]` question, finish the plan and continue to writing.
