# Review a delivery

Review and fix in this run. Record one verdict when the work is ready or needs the user.

1. Choose the scope:
   - When the flow marks a **focused post-rebase integration review**, inspect only the
     named target delta and shared paths, and run affected checks. Rely on the previous pass
     for unchanged requirements and unaffected checks.
   - Otherwise, compare all delivery changes with the approved requirements, run the
     required checks, and read `## Worth noting after implementation`; do not report a
     condition the user explicitly accepted there.
2. Fix plain mistakes in the delivery's worktree, update focused tests, and rerun the
   affected checks. Do not exhaustively search unaffected code or invent hypothetical issues.
3. Record one verdict:
   - **`pass`**: the requirements are met and the checks pass.
   - **`ask`**: a fix is unclear, cannot be completed safely, or requires the user's decision
     about behavior, design, security, compatibility, or ongoing cost.

```text
akb board review-verdict <id> --verdict pass
akb board review-verdict <id> --verdict ask --file <findings>
```

Write each finding for `ask` as one actionable bullet.

```text
- **<short title>**: <requirement or changed code, and evidence>
```

Put non-blocking discoveries under `## Worth noting after implementation`. Create a separate
card for a separate problem that does not block this delivery.
