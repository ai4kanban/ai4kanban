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
- **Superseded decisions**: An entry under `## Decided by the agent`, or a line under the
  human half's `## Worth noting`, that the revision makes invalid is a call the user
  overruled — keep it. Move the line, as it stands, under a `### Overruled by the user`
  heading at the end of `## Decided by the agent`, adding the heading if the card has none.
  The subsection stays last inside that section.
- **The two halves**: write the card in the shape `akb guide writing` sets out; when the change
  lands in the agent half, re-read the opening paragraph and `## Worth noting` so both hold.
- **Record the correction**: a revision that fixes a missed requirement or a wrong design
  is the board's main signal that the design was wrong — write the one-line entry per
  "Record a redesign" in the Board guide. A wording or scope change needs none.
- **An agent's section sent back**: a revision that rewrites, drops, or overrules what a spec
  agent wrote is that agent being corrected — append the one line per "An agent's memory" in
  `akb guide update-questions`.
- **Other actions**: for another board action asked, follow `akb <action> <id> --print`.
