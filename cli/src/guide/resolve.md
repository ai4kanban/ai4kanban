# Resolve questions

Apply the answers the user supplied to existing `[user]` questions. Leave every unanswered
question unchanged. During this phase, do not research it, choose for the user, raise
another question, or change project code.

## Apply each answer

1. Match each supplied answer to its open question. If the answer is missing or unclear,
   leave that question open.
2. Follow `akb guide writing`. Merge the answer into the existing decision, keep only the
   selected choice, remove obsolete or contradictory text, preserve completed work, and add
   newly required work as unchecked todos.
3. Drop each answered question after its answer is fully applied:

```text
akb raw update-questions <id> --drop <n[,n...]>
```

When an answer selects one of several options in a spec-agent section, remove the rejected
options and their spec-tmp files, then move the surviving section below the boundary.

## Curate the human half

Classify each answer with `akb guide update-questions`. Put answers classified as `Worth noting`
in that section; put other necessary lasting decisions below the boundary.

Re-read the whole human half against the same classification. Remove or move down entries that
fail it, repeat scope, or overlap another entry. Merge entries governed by one decision. One to
three independent items is normal; every additional item needs distinct user-facing stakes.

## Record lasting user decisions

Record only durable, user-facing answers in `memory/<module>/decisions.md`. Write one
`**<key>**: <call>` line under the relevant topic, without its rationale. Replace a
contradicted call instead of keeping both. If the user's answer is unclear, leave memory
unchanged and keep the question open.

After applying the supplied answers, follow `akb guide qa-loop` to validate the updated card
and every question still open.
