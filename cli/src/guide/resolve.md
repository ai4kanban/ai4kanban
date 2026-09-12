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
options and their spec-tmp files. Leave the surviving section in the half that agent's
`Output` setting names — `akb spec` prints it — so a section only set to agent use goes back
below the boundary once no unanswered `[user]` question points at it.

## Say what the answers did to a build in flight

A delivery builds the card as it was approved when it started, and applying answers is the
only thing that rewrites that card underneath it. You read the question and you wrote the
answer, so you are the only one who can tell a confirmation from a change — the board reads
your conclusion and never the card's text.

```text
akb delivery answered <delivery> --unchanged "<why>"
akb delivery answered <delivery> --changed "<why>"
```

- **Record it before you drop the questions**: dropping the last one is what puts the board
  back in motion, and until the conclusion is written the build neither goes back through
  review nor lands.
- **Judge the meaning, not the words**: confirming an option that is already built, writing
  down a decision the card already carries, and tidying prose are all `--unchanged`.
  Adding, dropping or changing a requirement is `--changed`.
- **A wrong implementation confirmed is still a change**: an answer that blesses work
  contradicting the approved copy is `--changed`, however finished that work is.
- **One conclusion per round**: it covers every answer you applied in this session. The
  delivery a `--changed` reopens starts on the card as it then reads, with none of its own.

`akb card implement <id> --print` prints the delivery's id and the copy it is building.
Nothing to record when no delivery is in flight.

## Curate the human half

Classify each answer with `akb guide update-questions`. Put answers classified as `Worth noting`
in that section; put other necessary lasting decisions below the boundary.

Re-read the whole human half against the same classification. Remove or move down entries that
fail it, repeat scope, or overlap another entry. Merge entries governed by one decision. One to
three independent items is normal; every additional item needs distinct user-facing stakes.

## Record lasting user decisions

Record only durable, user-facing answers that clear "What earns a note" in `akb guide board`,
in `memory/<module>/decisions.md`. Write one
`**<key>**: <call>` line under the relevant topic, without its rationale. Replace a
contradicted call instead of keeping both. If the user's answer is unclear, leave memory
unchanged and keep the question open.

Where the answer lands on a spec agent's section, also record it in that agent's memory —
"An agent's memory" in `akb guide update-questions`.

After applying the supplied answers, follow `akb guide qa-lightweight` to validate the updated card
and every question still open.
