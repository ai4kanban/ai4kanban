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

## A build with no card

**Build now** sends a typed sentence straight here, with no card behind it. That sentence is
the whole requirement, and the delivery is the only record of the job.

- **Build exactly the sentence**: nothing else says what this was for, so do not widen it.
- **Write no card**: no card is created, ticked, questioned or archived — the delivery and
  its commit are all this build leaves.
- **Nothing reviews it**: AI review and diff approval are off, so your own commit is the
  last word before it reaches the branch. Run the repository's checks yourself.
- **Blockers carry no id**: `akb raw run-blocker --step ".." --cause ".." --unblock ".."`,
  with the id left out. The blocker is read on the run's flow in Runs.
