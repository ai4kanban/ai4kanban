# Prune the memory

Prune the board's own record in `docs/kanban/memory/` and every agent's memory beside it in
`docs/kanban/memory/agents/<agent>/` — the planner's three among them (see "Who owns a memory
file" in `akb guide board`). `goal.md` is the user's: leave it alone.

One principle for all files: they exist to stop us re-proposing work, re-making a
design mistake, or re-asking a settled question. Rewrite each as **topics** (h2 title) —
usually a module — with plain-language takeaways under each section. Keep only what helps
future planning; drop code detail, dates, task ids, step-by-step stories.

Drop every entry that fails "What earns a note" in `akb guide board` — the bar that governs a
write governs what stays. Merge lines that say the same thing. Rewrite, don't just cut.

On top of that, per file:

- `agents/planner/rejected.md` — one line per idea: what not to propose and why. "Already
  done" is a shipped fact, not a rejection — it belongs in the published doc (with a
  `readme.md` line pointing at it), not here; drop it from `rejected.md`.
- `agents/planner/redesign.md` — one line per entry: the mistake, then the design to use.
  Drop an entry once that design is the obvious default.
- `readme.md` — the board's own record, one line per shipped user-facing behavior. Where a
  published doc covers it, the line is just a link to that doc's path. **Replace a prose
  entry with a link only after you have confirmed the doc covers that behavior** — search the
  docs first; no doc yet means the prose line stays: `readme.md` is the only record until we
  document it. Anything else — watermarks, a last focus, open gaps, internal detail —
  doesn't belong here; drop it.
- `agents/planner/decisions.md` — one line per live decision, in plain user-facing words.
  Drop anything that fails its bar in `akb guide board` ("Who owns a memory file"): a call
  about code detail, or one the published docs now cover. Drop a decision once the question
  no longer arises or `redesign.md` states it as a rule.
- `agents/<agent>/` — the files that agent's own AGENT.md defines, each pruned to what it says
  the file holds. Drop an entry once that agent's instructions or the design docs say it, and
  drop a file its instructions no longer name.

Prune a spec agent's files together, and drop the whole folder when its agent is gone from `akb
spec`. Drop anything a file says about how the product looks — colours, dimensions,
component detail belong in the app's `design.md`, not here — and fold a product fact worth
keeping into the lesson or the decision it supports.
