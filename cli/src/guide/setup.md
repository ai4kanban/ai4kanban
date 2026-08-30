# Setup

```text
akb board setup-status
akb board setup-done <step>
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
- Ask the user only for the goal. Put any other blocking decision on the setup questions
  card with `akb board update-questions`; `setup-status` prints its id.

## The first-run conversation

This section applies only to the board app's `project` screen. Read the README, package
files, folder structure, current config, and existing track folders. Return one fenced
`json` block and write nothing.

```json
{
  "summary": "Ledger — the bookkeeping service behind Acme's billing API.",
  "name": "Ledger",
  "description": "The bookkeeping service behind Acme's billing API.",
  "tracks": [
    { "name": "features", "note": "User-visible product work.", "was": "feature" }
  ],
  "unsure": false,
  "ask": ""
}
```

- `name` and `description` become the project heading and subheading.
- Track names use lowercase letters, digits, and dashes. Keep existing folders. Use `was`
  only when renaming a track.
- If the repository is unclear, set `unsure: true`, summarize what is known, and put one
  question in `ask`. Do not guess.
- A correction returns the same JSON shape. Never ask for the goal here.

## `project`

Fill the project name, description, and tracks in `docs/kanban/config.md`. Keep existing
track folders and create any confirmed new ones. Then `setup-done project`.

## `goal`

Ask the user for the long-term outcome and broad priority order. Save their words in
`docs/kanban/memory/goal.md`, set `reviewed` to `strong`, `good`, or `weak`, then
`setup-done goal`. If they provide no goal, stop.

## `agent`

The board app normally completes this step. From a coding agent, run `setup-done agent`;
the app can select its own Agent later.

## `decisions`

Write at most five high-level planning decisions not already answered by the goal to
`docs/kanban/memory/decisions.md` as `**<key>**: <decision>`. Ignore non-blocking content
discrepancies. Then `setup-done decisions`.

## `modules`

Write at most five user-visible parts to `docs/kanban/modules.md` as
`<module>: <purpose>`. Run `akb board init`, then move each module-specific decision to
that module's `decisions.md`; keep cross-module decisions at project level. Then
`setup-done modules`.

## `tasks`

Choose exactly three clear, non-duplicate foundational tasks from the goal, decisions, and
modules. Read `akb guide add-task` once and create each as a seed card: metadata plus one
short opening paragraph. Do not write `## Scope` or `## Todo`, and do not start refinement.
Then `setup-done tasks`.

## Finish

Stop when the final tick succeeds. The board starts one background refinement for each
seed card after setup exits; do not start or wait for them here.
