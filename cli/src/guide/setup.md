# Setup

```text
akb raw setup-status
akb raw setup-done <step>
```

Start at the first unticked step in `docs/kanban/setup-checklist.md`. Tick each step when
it is complete; never edit or delete the checklist directly. A missing checklist means
setup is finished.

## Working rules

- Ticked steps are settled. Do not ask for them again.
- Read the repository once: config, goal, memory, module map, README or package file,
  top-level tree, and configured planning sources. Skip dependencies and generated files.
- Reuse that scan. Setup is a bootstrap, not a repository audit.
- Only the final `tasks` step may create cards while setup is unfinished.
- If an older checklist still has an unticked `config` step, keep the scaffolded defaults
  unless the project clearly requires a change, then tick it.
- Never stop for an answer, the goal included. Classify any blocking decision with
  `akb guide update-questions` and put a resulting `[user]` question on the setup questions
  card; `setup-status` prints its id.
- A missing or empty goal is not a blocker. The steps after it read the repository instead,
  and none of them writes a goal the user did not give.

## The first-run conversation

This section applies only to the board app's `project` screen. Read the README, package
files, folder structure, and current config. Return one fenced `json` block and write
nothing.

```json
{
  "summary": "Ledger — the bookkeeping service behind Acme's billing API.",
  "name": "Ledger",
  "description": "The bookkeeping service behind Acme's billing API.",
  "unsure": false,
  "ask": ""
}
```

- `name` and `description` become the project heading and subheading.
- If the repository is unclear, set `unsure: true`, keep `summary` to one sentence, and put
  one short question in `ask` — it is shown as the hint of the description field. Do not
  guess.
- A correction returns the same JSON shape. Never ask for the goal here.

## `project`

Fill the project name and description in `docs/kanban/config.md`. Then `setup-done project`.

## `goal`

The board app normally completes this step. From a coding agent, ask once for the
long-term outcome and broad priority order, and save the answer in
`docs/kanban/memory/goal.md`. Then `setup-done goal` either way — no answer ticks the box
too, and `goal.md` is left empty. Never write a goal the user did not give.

## `agent`

The board app normally completes this step. From a coding agent, run `setup-done agent`;
the app can select its own Agent later.

## `decisions`

Write at most five high-level planning decisions to `docs/kanban/memory/decisions.md` as
`**<key>**: <decision>`. Take them from the repository scan — README, package files,
folder structure — and from the goal when there is one. Write only what the scan supports;
a repository that shows nothing gets no decisions. Ignore non-blocking content
discrepancies. Then `setup-done decisions`.

## `modules`

Write at most five user-visible parts to `docs/kanban/modules.md` as
`<module>: <purpose>`, read off the same scan. Write only the parts the repository
actually shows. Run `akb raw init`, then move each module-specific decision to that
module's `decisions.md`; keep cross-module decisions at project level. Then
`setup-done modules`.

## `tasks`

Choose exactly three clear, non-duplicate foundational tasks from the repository scan, the
decisions, the modules, and the goal when there is one. Read `akb guide add-task` once and
create each as a seed card: metadata plus one short opening paragraph. Do not write
`## Scope` or `## Todo`, and do not start refinement. Then `setup-done tasks`.

When the scan found nothing to build from — no README, no package file, nothing in the
tree — create no card and tick the box anyway. An empty board is the honest answer, and the
board offers the user the first card itself.

## Finish

Stop when the final tick succeeds. The board starts one background refinement for each
seed card after setup exits; do not start or wait for them here.
