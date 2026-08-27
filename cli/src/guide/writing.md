# Write a card

A card has a **human half** for review and a folded **agent half** for implementation.
Every flow writes a card in this order:

```text
<one short paragraph: the observable result and the current behavior or constraint it changes.>

## Worth noting              <- answered material decisions; omit when empty
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
- **Cut low-value notes**
- **Keep it glanceable**: merge decisions governed by one policy and remove repeats. One to
  three independent entries is normal; keep more only when each has distinct user-facing
  stakes.
- **Name the tradeoff**: each surviving entry says the cost, tradeoff, or option it beat.

## `Worth noting after implementation`

- **Keep it non-blocking**: this section never changes or blocks a delivery already in
  flight.
- **Exclude work logs**: never put diagnostics, run history, check results, suggestions,
  or unresolved questions here.

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
