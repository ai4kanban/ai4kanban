# Implement a settled card

Build the approved card. Do not add, rewrite, or tag questions on it.

- **Stop on a real blocker**: when the work cannot safely continue, run
  `akb raw run-blocker <id> --step ".." --cause ".." --unblock ".."`, then stop. Each
  field is one short factual sentence, and `--unblock` names one concrete action—never a
  menu of alternatives.
- Do not replace or contradict what the card says.
- A printed, interactive implementation may stay uncommitted in the target checkout only
  when the card is still clear and localized under "Choose its refine effort" in
  `akb guide add-task`. Otherwise use the tracked implementation path. Background runs
  always keep their delivery, review, and landing path.
- On an eligible interactive change, run focused checks for the affected path plus every
  repository-required check.

## A build that writes its own card

**Build now** sends a typed sentence with no card behind it. Write the card first, in the
same run, then build it. The board points the run and its delivery at the card as the create
lands, so from there it is an ordinary build.

- **Create it first**: `akb raw create --title ".."`, plus `--release` when the prompt names
  one. The title is one short line read off the sentence, in the sentence's own language —
  add `--slug <short-english-slug>` when that is not English, because filenames are ASCII. No
  `--modules`, no `--question`, no `--schedule` — nothing has evaluated this idea.
- **The sentence is the summary**: replace the scaffold's opening paragraph with what the
  user typed, verbatim, in a fenced code block. Open the fence with more backticks than the
  longest run in the sentence, or the card fails validation on an unclosed fence.
- **Leave the rest of the scaffold**: `## Worth noting`, `## Scope`, `## Todo` and
  `## Decided by the agent` stay exactly as `raw create` wrote them.
- **Then build that card**: the code block is the whole requirement — build exactly it and
  widen it no further. `akb card implement <id> --print` is the flow from here.
- **Nothing reviews it**: AI review and diff approval are off, so your own commit is the last
  word before it reaches the branch. Run the repository's checks yourself.
- **Blockers before the card**: `akb raw run-blocker --step ".." --cause ".." --unblock ".."`
  with the id left out, read on the run's flow in Runs. Once the card exists, name it.
