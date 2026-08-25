# Review a delivery

Review and fix in this run. Record one verdict when the work is ready or needs the user.

1. Compare all delivery changes with the approved requirements, run the required checks, and
   read `## Worth noting after implementation`; do not report a condition the user explicitly
   accepted there.
2. Fix plain mistakes in the delivery's worktree, update focused tests, and rerun the
   affected checks. Investigate technical discoveries yourself; fix in-scope work and create
   or update a separate card for follow-up work. Do not exhaustively search unaffected code
   or invent hypothetical issues.
3. Record one verdict:
   - **`pass`**: the requirements are met and the checks pass.
   - **`ask`**: a fix is unclear, cannot be completed safely, or requires the user's decision
     about behavior, design, security, compatibility, or ongoing cost. Never ask the user to
     diagnose the code or choose an agent-owned implementation detail.

```text
akb board review-verdict <id> --verdict pass
akb board review-verdict <id> --verdict ask --file <findings>
```

Write each finding for `ask` as one actionable bullet.

```text
- **<short title>**: <requirement or changed code, and evidence>
```

Put an answered material decision surfaced by the build under `## Worth noting after
implementation`, using `- **<question>**: <answer>`, only when the user could reasonably
reverse it. Do not put diagnostics, run history, check results, suggestions, or unresolved
questions there. Create or update a separate card for a separate problem that does not block
this delivery.
