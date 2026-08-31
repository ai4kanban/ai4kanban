# Write a card

A card has a **human half** for review and a folded **agent half** for implementation.
Every flow writes a card in this order:

```text
<one short paragraph: the observable result and the current behavior or constraint it changes.>

## Worth noting              <- answered material decisions; keep empty when none
- **<question the decision settles>**: <answer>

## Worth noting after implementation
- **<question the decision settles>**: <answer>
                             <- answered material decisions building turned up; written
                                by review, omit when empty. Never approved delivery scope

## By `<name>` agent         <- only while a [user] open question points at it

<!-- agent -->               <- boundary

## Today
## Scope                     <- requirements, not rationale
## Todo                      <- one build step per checkbox
## By `<name>` agent
## Decided by the agent
- **<question the decision settles>**: <answer>
### Overruled by the user    <- always last
## Source
```

## `Worth noting`

- **Reserve it for review**: include only a decision a reasonable reviewer may reject
  because it materially changes observable behavior, accepted scope, user risk, data or
  privacy, compatibility, or meaningful ongoing cost.
- **Cut low-value notes**: remove decisions that merely repeat scope or lack a meaningful
  tradeoff.
- **Keep it glanceable**: one entry is one reviewer decision, written as one sentence that
  states the chosen behavior and its main cost. Merge entries governed by one policy. One
  to three independent entries is normal.
- **Cut the story**: omit chronology, evidence trails, exhaustive consequences, and the
  rejected option unless it is necessary to understand the main cost.

## `Worth noting after implementation`

- **Keep it non-blocking**: this section never changes or blocks a delivery already in
  flight.
- **Use the same compact format**: one reviewer decision and its main cost in one sentence.
- **Exclude work logs**: never put diagnostics, run history, check results, suggestions,
  or unresolved questions here.
- **Never approve a deviation here**: work that contradicts the approved requirements must
  be fixed or sent to the user by review.

## `Today`

- **Describe the starting point**: include only current behavior or constraints needed to
  understand the change.
- **Omit when unnecessary**: do not repeat facts already clear from the opening paragraph
  or scope.

## `Todo`

- **Preserve completed work**: never edit, delete, or untick a checked todo; append a todo
  to reverse it.

## `Decided by the agent`

- **Avoid duplicates**: include answered decisions that do not belong in either
  `Worth noting` section.
- **Preserve superseded calls**: move agent or review decisions the user reverses to
  `Overruled by the user`.

## `Source`

- **Keep provenance traceable**: identify the URL, file, or message context that led to the
  card and the relevant observation.
- **Omit when unnecessary**: a direct task needs no source section unless its origin matters.

## General writing requirements

- **Keep section titles fixed**: do not rename or translate an existing `##` or `###`
  section title, and leave empty scaffold sections in place.
- **Edit only the body**: use board commands for every frontmatter field (`akb guide board`).
- **Write for a fresh reader**: use professional, comprehensible language with no assumed
  conversation context.
- **Keep human half self-contained**: nothing above `<!-- agent -->` may rely on the folded
  agent half.
- **Keep bullets atomic**: use `- **<short title>**: <one clear sentence>` for one rule per
  bullet.
- **Specify behavior**: omit planning notes and unnecessary coding details.
- **Say each decision once**: merge duplicates across the three decision sections; remove
  decisions that only repeat scope or no longer apply.
