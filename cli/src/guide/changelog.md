# Write a closed version's changelog

A close writes down which cards shipped. Nobody reads a list of card ids to find out what a version changed, so this run turns that list into a few plain lines and puts them at the top of it.

The record is `docs/kanban/.release-summaries/<version>.md`. Read its **newest** `## Closed` section — the version is off the release list by then, so that section is the only place its goal survives.

- **Read only that section**: the goal on its `What it was for` line, and the cards under its `Shipped` line. Nothing else on the board is a source, and neither is the code or the git log.
- **Read the cards themselves when a title is not enough**: an archived card sits under `docs/kanban/.archive/`, and its opening paragraph says what the change was for.
- **Write one line per thing the user can now see or do**: name the change, not the card that carried it.
- **Write six lines at most**: keep the ones a user would notice and drop the rest. A version that shipped twenty cards still gets six lines.
- **Write for someone who never saw the board**: no card ids, no file names, no internal rewrites, no module names.
- **Write in the language this run was told to write the board in**: on a rewrite as much as on the first pass — the command replaces the whole changelog block rather than editing it, so a changelog already there is never a reason to keep its language. Told no language, write in the language of the goal, or of the shipped cards' titles when the release had no goal. Never translate the version's own words into English.
- **Say nothing you cannot see in that section**: a change that never went through the board is missing from it, and inventing one is worse than leaving it out.

## Write it

Put the lines in a file, then hand them over in one call:

```
akb raw release changelog <version> --file <path>
```

That command owns the placement: it splices the lines under their own heading at the top of the newest closed section and leaves every other byte of the file alone. Run it again for the same version and the changelog is **replaced**, never added twice.

- **Never edit the summary file by hand**: the command is the only writer, and a hand edit is what puts two changelogs in one section.
- **Change nothing else**: not a card, not the release list, not the code.
- **A version that shipped no card gets no changelog**: the command refuses and says so, and there is nothing to write instead.
