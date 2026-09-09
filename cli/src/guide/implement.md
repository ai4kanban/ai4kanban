# Implement a settled card

Build the approved card. Preserve settled decisions and unrelated questions.

- **User-action blockers**: follow `akb guide update-questions` and append a `[user]`
  question describing the obstacle and action needed. Stop only dependent work; resume it
  after the user resolves the question. Settle routine technical choices yourself.
- Do not replace or contradict what the card says.
- A printed, interactive implementation may stay uncommitted in the target checkout only
  when the card is still clear and localized under "Choose its refine effort" in
  `akb guide add-task`. Otherwise use the tracked implementation path. Background runs
  always keep their delivery, review, and landing path.
- On an eligible interactive change, run focused checks for the affected path plus every
  repository-required check.

## A build that writes its own card

**Build now** sends a requirement with no card behind it — a typed sentence, or the plan a
discussion settled. Write the card first, in the same run, then build it. The board points
the run and its delivery at the card as the create lands, so from there it is an ordinary
build.

- **Read the plan first**: given a plan's path, that file is the requirement — read it, and
  everything below reads "the plan" for "the sentence".
- **Create it first**: `akb raw create --title ".."`, plus `--release` when the prompt names
  one. The title is one short line read off the sentence, or the plan's own title, in its own
  language — add `--slug <short-english-slug>` when that is not English, because filenames are
  ASCII. No `--modules`, no `--question`, no `--schedule` — nothing has evaluated this idea.
- **The requirement is the summary**: replace the scaffold's opening paragraph with the
  sentence, or the plan's whole text, verbatim, in a fenced code block. Open the fence with
  more backticks than the longest run inside it, or the card fails validation on an unclosed
  fence.
- **From a plan, name it**: end the card with `## Source` carrying the plan's path from the
  project root, the way a create off a plan writes it — once the discussion has let the plan
  go, that path is the only way back to the file. It is the card's last section.
- **Leave the rest of the scaffold**: `## Worth noting`, `## Scope`, `## Todo` and
  `## Decided by the agent` stay exactly as `raw create` wrote them.
- **Then build that card**: the code block is the whole requirement — build exactly it and
  widen it no further. `akb card implement <id> --print` is the flow from here.
- **Nothing reviews it**: AI review and diff approval are off, so your own commit is the last
  word before it reaches the branch. Run the repository's checks yourself.
