# Classify questions, decisions, and checks

Use these categories whenever a flow finds an unresolved decision, an answered decision, or a
post-build hand-check. Research the card, prior user choices, and relevant project evidence
before classifying it.

### Question

A question is a decision that project evidence cannot answer, materially affects the user
experience, and has at least two coherent options. Ask it directly; state each option's outcome
and main cost, and recommend the option you would take.

An unresolved fact, unavailable source, technical detail, or choice the agent can safely make
within the accepted outcome is not a question. Settle it and record a lasting answer below the
human half when necessary.

### User-owned question (`[user]`)

Use this material-decision test here and for both `Worth noting` sections: the tradeoff
materially changes observable behavior, accepted scope, user risk, data or privacy,
compatibility, or meaningful ongoing cost, and a reasonable reviewer may reject it.

An unanswered question that passes this test is user-owned. Prefix it with `[user]`, leave it
open, and stop only the work that depends on its answer. Only `[user]` questions may survive a
completed QA pass.

```text
akb board update-questions <id> \
  --append "[user] Which behavior should apply?" \
  --recommended-option "A — outcome and cost" \
  --option "B — outcome and cost"
```

Questions are exclusive unless their options can genuinely be combined; the board supplies the
free-text choice. Use `--mode multi` only for combinable options, recommending every option you
would take. Use `--update <n>`, `--drop <n[,n...]>`, or `--to-verify <n[,n...]>` only for an
existing question.

### `Worth noting` and `Worth noting after implementation`

These sections contain answers, never open questions. Put an answered question in `## Worth
noting` when it passes the same material-decision test. Use `## Worth noting after
implementation` instead when implementation or review surfaced and answered it.

Put a necessary lasting answer that fails the test below the human half. Never use `Worth noting
after implementation` to accept work that contradicts the approved requirements; fix the work
or leave a user-owned question.

### `verify:`

A `verify:` line is a post-build check that needs human judgment or an environment the agent
cannot use. It is not a decision, carries no options, and does not block the card. Give a
reproducible setup, human action, expected result, and any required fixture. Put checks the
implementation agent can run in `## Todo` instead.
