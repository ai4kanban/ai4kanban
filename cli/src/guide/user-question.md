# Ask a user question

Hand a decision to the user only when every condition holds:

- **Unresolved**: the card, code, board, goal, relevant project sources, and module memory
  do not settle it. Research first.
- **User-owned**: it concerns taste, product direction, behavior, design, security,
  compatibility, spending, or a promise to users. Diagnose code and choose implementation
  details yourself.
- **Costly to reverse**: a wrong answer would ship something the user must live with. A
  tradeoff alone does not make the decision theirs.
- **Blocking**: the current workflow cannot finish safely without it. Its own guide defines
  what blocks that workflow; separate work belongs on another card.

Do not reopen a settled decision or ask about a reversible default. When no option has a
reason to beat another, choose one yourself.

## Write the question

Write one line the user answers at a glance by ticking. Name the decision, not the trouble
that raised it.

- **Ask, don't report**: ✅ `[user] Which region should the Supabase project live in?` —
  ❌ `[user] The region is undecided and cannot be changed later.`
- **Always offer options**: provide at least two short options, each with its reason, and
  mark the recommendation. The board adds a free-text choice; never write it yourself.
- **One decision per question**: fold a dependent choice into the options of the question
  it depends on.
- **Never edit by hand**: use `akb board update-questions` for every question change.

```text
akb board update-questions 12 --append "[user] Which region should the Supabase project live in?" \
  --recommended-option "eu-central-1 — nearest to the users the site has" \
  --option "us-east-1 — cheapest, and where #294 already runs"
```

Batch every question found in one pass into one command; `--append` repeats.
`akb guide resolve` covers the remaining question operations.
