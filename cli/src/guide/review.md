# Review a delivery

Review and fix in this run. Record one verdict when the work is ready or needs the user.

1. Compare all delivery changes with the approved requirements, run the required checks, and
   read `## Worth noting after implementation`; do not report a condition the user explicitly
   accepted there.
2. Fix plain mistakes in the delivery's worktree, update focused tests, and rerun the
   affected checks. Resolve implementation details yourself. Drop unrelated implementation
   discoveries after noting them in the run log; never create or update another card from
   review. Do not exhaustively search unaffected code or invent hypothetical issues.
3. Follow "Decide what survives" in `akb guide qa-loop` when a decision is the user's. For
   review, it is blocking only when this delivery cannot land safely without the answer.

4. Record one verdict:
   - **`pass`**: the requirements are met and the checks pass.
   - **`ask`**: the delivery cannot land safely without a user-facing decision about
     observable behavior, scope, risk, privacy, compatibility, or meaningful cost.

```text
akb board review-verdict <id> --verdict pass
akb board review-verdict <id> --verdict ask --file <findings>
```

Do not reopen anything the card already answers, including
`## Worth noting after implementation`. Review never creates or updates another card.

The findings file is the delivery's record, not the question — one bullet per finding,
`- **<the question you asked>**: <evidence>`, so the record and the card name the same
decision.

Put an answered material decision surfaced by the build under `## Worth noting after
implementation` only when the user could reasonably reverse it, using the compact format in
`akb guide writing`. Never use the section to accept work that contradicts the approved
requirements; fix that work or record an `ask` verdict. Drop separate implementation work;
task discovery belongs to an explicit planning flow.
