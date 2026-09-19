# Learn triage preferences from dismissals

Read the dismissals listed for you and keep what they say about the user's lasting triage
taste in `docs/kanban/memory/agents/planner/dismissed.md`. Writing nothing is a complete
result; most dismissals say nothing lasting.

The flow lists two things: new dismissals — each item's file in `docs/kanban/triage/dismissed/`
with the reason the user gave — and withdrawn source ids, items cited in `dismissed.md` that
the user has since restored.

- **Only what the user stated**: read the item and its reason together. Keep a note only
  where the reason states a lasting preference or constraint that would decide future items —
  "we don't serve enterprise SSO requests", not "duplicate" or "not now". Never infer one.
- **Where it goes**: under the `## <module>` heading from `docs/kanban/modules.md` the
  preference is about, creating the file or heading if missing. Never invent a module.
- **One line each**: `- **<preference>**: <why, in the user's terms> (<source-id>, ...)`.
  The source ids are the only link back to the evidence; always keep them.
- **Merge, don't repeat**: fold an equivalent preference into the existing line and add the
  new id. A listed dismissal whose id a line already cites was restored and dismissed again:
  judge that line afresh by the new reason, never add a second one.
- **The later word stands**: where a new reason contradicts a line, rewrite that line to the
  new position and cite both.
- **Withdraw restored evidence**: for each withdrawn id, remove it from every line; delete a
  line that has no source left.
- **Respect the user's edits**: a line with no source id was written by the user; leave it.
- **Change nothing else**: no card, no triage item, no other memory file; ask no questions.
- **Report**: each dismissal read and the line it added or changed, or that it earned none;
  each withdrawn id and what it removed.
