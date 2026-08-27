# Raise questions

Audit one task for decisions its plan still needs. Do not resolve a question, decide who
owns it, rewrite the card body, request specialized input, or mark the card ready.

Read the card, then inspect only the configuration, code, project sources, goal, and named
module memory needed to understand its plan. Check the behavior, constraints, contracts,
complete user flow, important edge cases, and build steps from several angles before
closing the pass.

Append every substantive gap as an untagged question in one command. Give each question at
least two plausible options so the resolver can compare concrete choices; do not tag a
question `[user]` or recommend an option in this pass.

```text
akb board update-questions <id> \
  --append "Which behavior should apply?" --option "A — reason" --option "B — reason" \
  --append "Which boundary should hold?" --option "A — reason" --option "B — reason"
```

If the plan has no substantive unanswered decision, change nothing. Different wording is
not a gap.
