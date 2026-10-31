# Revise

Make the requested change and fix what it contradicts in the card. Apply answers supported by
the project and leave only decisions the user owns.

- **Owned content first**: before the edit, follow "Agent sections" in `akb guide writing`.
- **Dependencies**: when the card comes to need another card's output, add that id to its
  `blocked_by` as `akb guide add-task` says.
- **Changed outcome**: If the request materially changes what the task delivers, run the
  affected checks in `akb guide evaluate-task` against the proposed revision, write it, then
  plan the new card in this session as `akb guide refine` says. Ordinary scope and wording
  changes need neither.
- **Preview agents**: when the revision adds or changes work a preview agent's `When` covers,
  such as images, page copy or a screen, add it to the card's `previews` and run it as
  "Preview agents" in `akb guide refine` says; a plan of that work written into `## Scope` is
  no substitute.
- **Drafts**: when the change affects a draft on the card, revise its files and previews in
  place on this run, with `akb spec` for each preview agent whose draft it affects, including
  one from an earlier stage. Keep the unaffected content and the IDs. A note or todo is no
  substitute.
- **Superseded decisions**: An entry under `## Decided by the agent`, or a line under the
  human half's `## Worth noting`, that the revision makes invalid is a call the user
  overruled — keep it. Move the line, as it stands, under a `### Overruled by the user`
  heading at the end of `## Decided by the agent`, adding the heading if the card has none.
  The subsection stays last inside that section. Delete an overruled line once the card
  leaves the builder no room to repeat that call.
- **The two halves**: write the card in the shape `akb guide writing` sets out; when the change
  lands in the agent half, re-read the opening paragraph and `## Worth noting` so both hold.
- **Record the correction**: a revision that fixes a missed requirement or a wrong design
  is the board's main signal that the design was wrong — write the one-line entry per
  "Record a redesign" in the Board guide. A wording or scope change needs none.
- **Other actions**: for another board action asked, follow `akb <action> <id> --print`.
