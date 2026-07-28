# Prune the memory set

Prune every file in the memory set (see "The memory set" in `SKILL.md`). Prune whichever
copy you're compressing: the project-wide one at `docs/kanban/memory/` or a module's at
`docs/kanban/memory/<module>/`. `goal.md` is not in the set — it's user-owned, leave it alone.

One principle for all files: they exist to stop us re-proposing work, re-making a
design mistake, or re-asking a settled question. Rewrite each as **topics** — areas of
the product — with plain-language takeaways under each. Keep only what helps future
planning; drop code detail, dates, task ids, step-by-step stories, and the reasoning
behind settled decisions. Merge lines that say the same thing. Rewrite, don't just cut.

On top of that, per file:

- `rejected.md` — one line per idea: what not to propose and why. "Already done" is a
  shipped fact, not a rejection — it belongs in the published doc (with a `readme.md`
  line pointing at it), not here; drop it from `rejected.md`.
- `redesign.md` — one line per entry: the mistake, then the design to use. Drop an
  entry once that design is the obvious default.
- `readme.md` — one line per shipped user-facing behavior. Where a published doc covers
  it, the line is just a link to that doc's path. **Replace a prose entry with a link
  only after you have confirmed the doc covers that behavior** — search the docs first;
  no doc yet means the prose line stays: `readme.md` is the only record until we
  document it. Anything else — watermarks, a last focus, open gaps, internal detail —
  doesn't belong here; drop it.
- `decisions.md` — one line per live decision, in plain user-facing words. Drop anything
  that fails its bar in SKILL.md ("The memory set"): a call about code detail, or one the
  published docs now cover. Drop a decision once the question no longer arises or
  `redesign.md` states it as a rule.
