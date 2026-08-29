# Update a card's questions

Research first. Leave a question only when implementation or review cannot safely continue,
at least two coherent choices remain, evidence favors neither, and the choice materially
changes what the user receives or accepts. An unresolved fact, unavailable source, technical
detail, or manual check is not a user decision; settle it or put the check in `verify:`.

Ask one direct question, with at least two concise choices and one recommendation. Each choice
states its outcome and main cost. Questions are exclusive unless their choices can genuinely be
combined; the board supplies the free-text choice itself.

```text
akb board update-questions <id> \
  --append "[user] Which behavior should apply?" \
  --recommended-option "A — outcome and cost" \
  --option "B — outcome and cost"
```

Use `--mode multi` only when several choices may be combined, recommending every choice you
would take. Use `--update <n>`, `--drop <n[,n...]>`, or `--to-verify <n[,n...]>` only for a
question already on the card.
