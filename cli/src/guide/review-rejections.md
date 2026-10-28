# Learn from rejections and dismissals

Read the rejections and dismissals listed for you and keep what they say about what the user
lastingly does not want in `rejected.md` files. Writing nothing is a complete result; most
reasons say nothing lasting.

The flow lists new rejections (each card's file in `.archive/`), new dismissals (each item's
file in `docs/kanban/triage/dismissed/`), each with the reason the user gave, and withdrawn
source ids: items cited in `rejected.md` that the user has since restored.

- **Only what the user stated**: read the item and its reason together. Keep a note only
  where the reason states a lasting preference or constraint that would decide future cards or
  items — "we don't serve enterprise SSO requests", not "duplicate" or "not now". Never infer one.
- **Where it goes**: `docs/kanban/memory/agents/planner/<module>/rejected.md` for the module in
  `docs/kanban/modules.md` the preference is about, or
  `docs/kanban/memory/agents/planner/rejected.md` when it spans modules; create it if missing.
  Never invent a module.
- **One line each**: `- **<what not to do>**: <why, in the user's terms> (<source>, ...)`, a
  source being a card `#id` or an item's source id; always keep them.
- **Merge, don't repeat**: fold an equivalent preference into the existing line and add the
  new source. A listed dismissal whose id a line already cites was restored and dismissed again:
  judge that line afresh by the new reason, never add a second one.
- **The later word stands**: where a new reason contradicts a line, rewrite that line to the
  new position and cite both.
- **Withdraw restored evidence**: for each withdrawn id, remove it from every line; delete a
  line that has no source left.
- **Respect the user's edits**: a line with no source was written by the user; leave it.
- **Change nothing else**: no card, no triage item, no other memory file; ask no questions.
- **Report**: each rejection and dismissal read and the line it added or changed, or that it earned none;
  each withdrawn id and what it removed.
