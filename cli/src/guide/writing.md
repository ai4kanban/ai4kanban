# Write a card

A card has a **human half** for review and a folded **agent half** for implementation.
Use this order and keep the English section titles and empty scaffold sections:

```text
<One short paragraph: the problem and the intended result.>

## Worth noting              <- user's answers first, then material decisions; empty if none
- **<decision>**: <chosen behavior and main cost in one sentence>

## Worth noting after implementation
- **<decision>**: <chosen behavior and main cost in one sentence>
                             <- settled by the build; omit when empty; no logs or open questions

## By `<name>` agent         <- preview owned by that agent

<!-- agent -->               <- folded content starts here

## Scope                     <- requirements, not rationale
### Done when                <- acceptance checklist, when supplied
- [ ] <observable result>

## Todo                      <- implementation only; finish planning before writing steps
- [ ] <one build step>

## Decided by the agent      <- other decisions and non-obvious findings the build needs
- **<decision>**: <answer and required action>
### Overruled by the user    <- superseded decisions, always last
```

- **Decisions**: use the material-decision test in `akb guide update-questions` for Worth noting;
  merge entries governed by one policy and keep only the decision and its main cost.
- **Delivery boundary**: Worth noting after implementation never changes approved scope or
  blocks an ongoing delivery; the build must fix deviations or refer them to the user.
- **Preview ownership**: produce preview sections only by running their agent; before changing
  owned content, read `akb raw agent-file <agent> AGENT.md`, then only the references needed
  for that change with `akb raw agent-file <agent> <path>`; paths are relative to the named
  agent's folder, and cross-agent references use their named owner; report unreadable rules
  before proceeding.
- **Preserve work**: leave checked todos and supplied Done when checklists unchanged; append a
  todo to reverse completed work, and move user-overruled decisions to Overruled by the user
  until the card leaves no room to repeat them.
- **Writing**: write clear behavior and necessary tradeoffs for a fresh reader, keep the human
  half self-contained, and state each fact once.
- **Frontmatter**: never edit frontmatter by hand; use `akb raw create`, `update`, or
  `update-questions`.
- **Validate**: run `akb raw validate <id>` after edits and fix every reported file and line.
