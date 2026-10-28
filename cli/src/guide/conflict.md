# Fit a delivery onto the moved target

The target branch moved while this delivery was being built, and the delivery has been
rebased onto its new tip. Make the combined result work.

- **Read both sides**: read the approved requirements, what the target brought in since the
  delivery's original base, and the delivery's own changes.
- **Target wins**: keep the target's behavior unless the approved card requires changing it,
  replay only the delivery's intent on top of it, and never restore stale details.
- **Resolve conflicts**: resolve every conflicted file the rebase stopped on.
- **Find what git cannot see**: look for changes on one side that override, duplicate, or
  break the other side's work, including in files only one side touched.
- **Fix by the project's conventions**: edit any file the fix needs, then run the project's
  own checks for the changed areas.
- **Stage the result**: `git add` every file you changed; do not commit or finish the rebase.
- **Stop when unsure**: if both intentions cannot be composed confidently or the checks still
  fail, stage nothing and run `akb delivery blocked <id> "<what is in the way>"`.
- **Repair Git state**: fix Git failures in the worktree yourself, keeping its commits and
  staged work.
- **Stay on this delivery**: do not change any card or create follow-up work.
