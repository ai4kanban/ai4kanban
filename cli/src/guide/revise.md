# Revise

Make the requested change, then follow `akb guide qa-loop` to validate the updated card in
this session. Apply answers supported by the project and leave only decisions the user owns.

- **Changed outcome**: If the request materially changes what the task delivers, run the
  affected checks in `akb guide evaluate-task` against the proposed revision before writing
  it. Ordinary scope and wording changes do not repeat evaluation.
- **Superseded decisions**: An entry under `## Decided by the agent`, or a line under the
  human half's `## Worth noting`, that the revision makes invalid is a call the user
  overruled — keep it. Move the line, as it stands, under a `### Overruled by the user`
  heading at the end of `## Decided by the agent`, adding the heading if the card has none.
  The subsection stays last inside that section.
- **The two halves**: write the card in the shape `akb guide writing` sets
  out, and when the change lands in the agent half, re-read the opening paragraph and
  `## Worth noting` so both still hold.
- **Record the correction**: a revision that fixes a missed requirement or a wrong design
  is the board's main signal that the design was wrong — write the one-line entry per
  "Record a redesign" in the Board guide. A wording or scope change needs none.
- **Other actions**: If the revision request also asks to implement, reject, archive, or
  perform another board action, run `akb <action> <id> --print` and follow its flow.
