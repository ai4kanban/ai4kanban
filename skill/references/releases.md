# Releases

Open releases live in `docs/kanban/releases.md`, one line each, in ship order; a card's `release` field names the release it belongs to, and an empty field means the card belongs to no release.

```
${KB} release new v2                # create a release before assigning cards to it
${KB} release new v2 --goal ".."    # create it with an optional goal
${KB} release new v2 --fill         # add high-priority, unblocked, non-root cards with no release
${KB} release goal v2 ".."          # change its goal; "" clears the goal
${KB} release list                  # show ship order, goals, card counts, and invalid references
${KB} update 14 --release v2        # assign a card; --release "" removes its assignment
${KB} release close v2              # record a release that shipped
${KB} release drop v2               # remove a release that will not ship
```

- **Ask for the goal**: When creating a release, ask what it should accomplish, save the answer in the user's words, and allow the user to continue without a goal.
- **Use valid identifiers**: Create the release before assigning cards to it, and use a case-sensitive identifier containing only letters, numbers, dots, dashes, or underscores.
- **Assign or remove a card**: Use `${KB} update <card-id> --release <release-id>` to assign a card and `${KB} update <card-id> --release ""` to remove it from that release without deleting the card.
- **Move groups consistently**: Assigning or clearing a group root applies the same release to every nested subtask, while an individual subtask can still be moved separately.
- **Fill a release without a goal**: Use `--fill` to add only high-priority cards that have no release, have no open blocker, and are not group roots, then report every skipped high-priority card and the failed test.
- **Plan a release with a goal**: Follow `references/plan-release.md` to add existing cards and create missing cards required by the goal, and run the process again whenever the goal changes.
- **Preserve existing assignments**: Filling or planning a release only adds cards with no release and never moves a card out of another release unless the user explicitly requests that move.
- **Reorder or rename carefully**: Edit `docs/kanban/releases.md` by hand, run `${KB} release list` to find cards that still use an old identifier, and update each affected card explicitly.
- **Close a shipped release once**: Run `release close` after shipped cards are archived; it writes the goal, shipped cards, and open leftovers to the summary, clears the release from open cards, and removes the release from the open list.
- **Treat open cards as unshipped**: A card still open when the release closes is recorded as not shipped even if all of its todo items are checked, so review the output and correct the summary file by hand if necessary.
- **Drop an unshipped release cleanly**: Run `release drop` to report its archived and open cards, clear the release from every open card, and remove it from the list without writing or changing a release summary.
- **Reuse identifiers safely**: A later release may reuse an old identifier, but closing or dropping it must not count cards already recorded by an earlier release with that identifier.
