---
title: Make the board merge cleanly when two people write it
track: features
priority: low
roi: high
status: todo
release: next
blocked_by: []
related: [124]
modules: [skill]
questions: []
---

Two clones of one board must not fight. Today three files guarantee they do: `next-id`,
the README index, and `metrics.csv`.

Part of #124.

## Scope
- Two people create cards at the same time, and after a merge both cards survive with
  different ids — or the collision is caught and fixed by one command, not by hand.
- The README index stops being a conflict magnet: it merges cleanly, or the script can
  rebuild it from the cards at any time.
- `metrics.csv` the same: two rows for one day merge into one, or the script repairs
  the file.
- A solo board changes nothing: same files, same commands, same output.

## Todo
- [ ] Make card ids safe against two writers creating at once — or make the collision
      one command to fix.
- [ ] Add a script command that rebuilds the README index from the cards.
- [ ] Make `metrics.csv` merge or repair cleanly when two clones counted the same day.
- [ ] Prove it: two clones, cards created on both, merged both ways, nothing lost.
