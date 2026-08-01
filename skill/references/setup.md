# Setup

Setting a board up is a run of steps, and `docs/kanban/setup-checklist.md` is the record of
which ones finished. `init` writes it when it scaffolds a fresh board, with the boxes the
install already finished ticked. Repairing an older board never writes it.

**Its presence is the flag.** The file is there while setup is unfinished, and the tick that
closes the last box deletes it — so a board with no file is a board that is set up, and a
board made before the checklist existed stays quiet. An empty board is not a flag: no
checklist and no cards means setup finished and the backlog ran out, nothing more.

**Each step ticks its own box** with `${KB} setup-done <step>` the moment it finishes.
Never hand-edit the file — the local UI reads its shape to show how far setup got.
`${KB} setup-status` prints the same thing for you.

## No cards before the last box

Creating the first tasks is the checklist's last step. While the file is there, the flows
that create cards — propose, add — create nothing. There's nothing to plan from anyway:
the board's memory and module map aren't written yet, so anything proposed now would be a
guess. Instead of a card, tell the user:

- which step setup is waiting on (`${KB} setup-status` prints it), and
- that the first tasks come from setup's own last step.

Setup's own last step is the one exception — it creates the first tasks, then ticks its
box and the file is gone. That final tick also rewrites the config's **Setup gate** entry
to say the board is set up — the script does it, never by hand. A card the user writes by
hand, outside the skill, is not blocked.
