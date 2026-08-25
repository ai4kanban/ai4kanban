# Review a delivery

Review and fix in this run. Record one verdict when the work is ready or needs the user.

1. Compare the delivery's code changes with the approved requirements.
2. Run the checks required by the repository and this board's review rule.
3. Read `## Worth noting after implementation`; do not report a condition the user has
   explicitly accepted there.
4. Fix plain mistakes in the delivery's worktree, update focused tests, and rerun the
   affected checks. Do not exhaustively search unaffected code or invent hypothetical issues.
5. Record one verdict:
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
