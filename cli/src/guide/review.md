# Review a delivery

Review and fix in this run. Record one verdict when the work is ready or needs the user.

1. Compare all delivery changes with the approved requirements, run the required checks, and
   read `## Worth noting after implementation`; do not report a condition the user explicitly
   accepted there.
2. Fix plain mistakes in the delivery's worktree, update focused tests, and rerun the
   affected checks. Investigate technical discoveries yourself; fix in-scope work and create
   or update a separate card for follow-up work. Do not exhaustively search unaffected code
   or invent hypothetical issues.
3. Ask the user first, when the decision is theirs. Every question reaches a card through
   `akb board update-questions` and never by editing the card — write it in the form "Ask a
   user question" in `akb guide board` defines, with the answer you recommend as the option
   that opens ticked.

```text
akb board update-questions <id> \
  --append "[user] Which region should the Supabase project live in?" \
    --recommended-option "eu-central-1 — nearest to the users the site has" \
    --option "us-east-1 — cheapest, and where #294 already runs" \
  --append "[user] Who runs the account setup?" \
    --recommended-option "I'll do it myself, then re-run review" \
    --option "you do it, and I'll paste in credentials"
```

4. Record one verdict:
   - **`pass`**: the requirements are met and the checks pass.
   - **`ask`**: a fix is unclear, cannot be completed safely, or requires the user's decision
     about behavior, design, security, compatibility, or ongoing cost. Never ask the user to
     diagnose the code or choose an agent-owned implementation detail.

```text
akb board review-verdict <id> --verdict pass
akb board review-verdict <id> --verdict ask --file <findings>
```

The findings file is the delivery's record, not the question — one bullet per finding,
`- **<the question you asked>**: <evidence>`, so the record and the card name the same
decision.

Put an answered material decision surfaced by the build under `## Worth noting after
implementation`, using `- **<question>**: <answer>`, only when the user could reasonably
reverse it. Do not put diagnostics, run history, check results, suggestions, or unresolved
questions there. Create or update a separate card for a separate problem that does not block
this delivery.
