# Review a delivery

Review and fix in this run. Record one verdict when the work is ready or needs the user.

1. Compare all delivery changes with the approved requirements, run the required checks, and
   read `## Worth noting after implementation`; do not report a condition the user explicitly
   accepted there.
2. Fix plain mistakes in the delivery's worktree, update focused tests, and rerun the
   affected checks. Investigate technical discoveries yourself; fix in-scope work and create
   or update a separate card for follow-up work. Do not exhaustively search unaffected code
   or invent hypothetical issues.
3. Follow "Who owns the question" in `akb guide resolve` when a decision is the user's. For review, it is
   blocking only when this delivery cannot land safely without the answer.

4. Record one verdict:
   - **`pass`**: the requirements are met and the checks pass.
   - **`ask`**: a fix is unclear, cannot be completed safely, or requires a decision the
     section below leaves to the user.

```text
akb board review-verdict <id> --verdict pass
akb board review-verdict <id> --verdict ask --file <findings>
```

Do not reopen anything the card already answers, including
`## Worth noting after implementation`. A separate problem that does not block this
delivery belongs on another card.

The findings file is the delivery's record, not the question — one bullet per finding,
`- **<the question you asked>**: <evidence>`, so the record and the card name the same
decision.

Put an answered material decision surfaced by the build under `## Worth noting after
implementation`, using `- **<question>**: <answer>`, only when the user could reasonably
reverse it. Do not put diagnostics, run history, check results, suggestions, or unresolved
questions there. Create or update a separate card for a separate problem that does not block
this delivery.
