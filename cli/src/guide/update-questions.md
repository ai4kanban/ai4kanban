# Classify questions and decisions

A decision is a choice the work needs made. A question is a decision handed to the user:
project evidence cannot settle it, it materially affects what the user gets, and it has at
least two coherent options.

### The `[user]` test

Ask when the tradeoff materially changes the delivered result, the accepted scope, the user's
risk, or a meaningful ongoing cost, and a reasonable reviewer may reject it; a workflow's rules
add what else counts. Settle everything else yourself. Leave the question open and stop only
the work that depends on it. An obstacle only the user can clear is a question too: say what
cannot proceed and offer ways forward.

- **Write for users**: each option's outcome and main cost, your recommendation ticked; no
  card ids, agent names, or board jargon.
- **Options**: exclusive unless they genuinely combine (`--mode multi`); never write an
  "other" option, the user always gets one.
- **Not a question**: where a fix goes (`akb guide follow-up`), and one marked
  `skipped: true` — the user declined to answer it, which grants nothing.

```text
akb raw update-questions <id> \
  --append "[user] Which behavior should apply?" \
  --recommended-option "A — outcome and cost" \
  --option "B — outcome and cost"
```
