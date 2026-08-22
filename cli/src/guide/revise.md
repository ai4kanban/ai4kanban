# Revise

Make the requested change and stop.

- **Full rewrite only**: If the request replaces most of the card, changes its overall plan,
  or explicitly asks to refine it, read `docs/kanban/config.md`, the goal, and the relevant
  named memory, then load `akb guide refine` and follow it.
- **Spec agent sections**: Preserve every ``## By `<name>` agent`` section verbatim. If
  the revision invalidates one, run `akb spec <agent> <id> <short note>` after the edit.
- **Screen/UI changes**: Read `akb guide ui-design` before revising one.
- **Superseded decisions**: An entry under `## Decided by the agent`, or a line under the
  human half's `## Worth noting`, that the revision makes invalid is a call the user
  overruled — keep it. Move the line, as it stands, under a `### Overruled by the user`
  heading at the end of `## Decided by the agent`, adding the heading if the card has none.
  The subsection stays last inside that section.
- **The two halves**: write the card in the shape "Card format" in `akb guide board` sets
  out, and when the change lands in the agent half, re-read the opening paragraph and
  `## Worth noting` so both still hold.
- **Record the correction**: a revision that fixes a missed requirement or a wrong design
  is the board's main signal that the design was wrong — write the one-line entry per
  "Record a redesign" in the Board guide. A wording or scope change needs none.
- **Other actions**: If the revision request also asks to implement, reject, archive, or
  perform another board action, run `akb <action> <id> --print` and follow its flow.
