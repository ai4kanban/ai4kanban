# Implement a settled card

Build the approved card. Preserve settled decisions and unrelated questions.

- **Unchecked card**: a card with `triage:` set and an empty `## Scope` skipped planning; do
  what "Unchecked card" in `akb guide refine` says before building.
- **User-action blockers**: follow `akb guide update-questions` and append a `[user]`
  question describing the obstacle and action needed. Stop only dependent work; resume it
  after the user resolves the question. Settle routine technical choices yourself.
- Do not replace or contradict what the card says.
- **Approved mockups**: build each screen a card's mockup shows to match it, then compare
  your result with the mockup at desktop and phone widths and fix any difference.
- **Approved API previews**: build each surface a card's API preview shows to match it,
  and write its documentation from it.
- **Approved schema preview**: write the migration so the resulting schema matches the
  card's approved schema preview.
- **Building is not shipping**: unless the card's outcome is itself a deploy, release, or
  publish, finish once the change lands and the checks pass; do not push, deploy, release,
  or publish to complete it.
- **Defer what can wait**: queue as a follow-up any verification or step that needs the change
  live, and any other work this card does not require; never hold the card with a question
  about it.
- **Follow-ups**: follow `akb guide follow-up` for additional work.
- **Decisions made while building**: record an answered material decision the user could
  reasonably reverse under `## Worth noting after implementation`.
- A printed, interactive implementation may stay uncommitted in the target checkout only
  when the card already supplies a concrete outcome, boundaries, and build steps.
  Otherwise use the tracked implementation path. Background runs always keep their delivery
  path.
- **Checks**: nothing reviews the build after you; run focused checks for the affected path
  plus every repository-required check.

## A build that writes its own card

**Start now** sends a requirement with no card behind it — a typed sentence, the plan a
discussion settled, or a triage item. Write the card first, in the same run, then build it. The board points
the run and its delivery at the card as the create lands, so from there it is an ordinary
build.

- **Read the plan first**: given a plan's path or a triage item's file, that file is the
  requirement — read it, and everything below reads "the plan" for "the sentence".
- **Create it first**: `akb raw create --title ".."`. The title is one short line read off
  the sentence, or the plan's own title, in its own language — add
  `--slug <short-english-slug>` when that is not English, because filenames are ASCII. No `--modules`, no `--question`, no `--schedule` — nothing has evaluated this idea.
- **The requirement is the summary**: replace the scaffold's opening paragraph with the
  sentence, or the plan's whole text, verbatim, in a fenced code block. Open the fence with
  more backticks than the longest run inside it, or the card fails validation on an unclosed
  fence.
- **From a plan, name it**: pass `--source <plan path>` to the create.
- **From a triage item, file it**: pass `--triage <source-id>` to the create, and run
  `akb triage archive <source-id> --card <id>` straight after, before any build work.
- **Leave the rest of the scaffold**: `## Worth noting`, `## Scope`, `## Todo` and
  `## Decided by the agent` stay exactly as `raw create` wrote them.
- **Then build that card**: the code block is the whole requirement — build exactly it and
  widen it no further. `akb card implement <id> --print` is the flow from here.
