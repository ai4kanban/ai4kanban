# Plan a release against its goal

Use this process to fill an existing release with the open cards required by its goal and to create any required cards that are missing from the board.

- **Read the release goal**: Run `${KB} release list` and use the selected release's goal as the boundary for every card you include, create, or leave out.
- **Use the fallback when no goal exists**: Assign each high-priority card that has no release, no open blocker, and is not a group root with `${KB} update <card-id> --release <release-id>`, report every high-priority card left out with the failed test, and stop.
- **Read the open board**: Run `${KB} list` to review every open card's identifier, title, release, priority, blockers, and summary before making assignments.
- **Read the relevant product context**: Review `docs/kanban/memory/goal.md` and the memory files for every module touched by the release goal before judging whether work belongs.
- **Select cards by outcome**: For every open card with no release, assign it with `${KB} update <card-id> --release <release-id>` only when completing it directly delivers part of the release goal.
- **Assign groups through the root**: When a whole group belongs in the release, assign its root so every nested subtask receives the same release assignment.
- **Include required blockers**: Assign every still-open, unassigned card that blocks an included card because the release cannot ship without that prerequisite.
- **Protect other releases**: Leave cards already assigned to another release where they are unless the user explicitly asks to move them.
- **Exclude unrelated work**: Leave out cards that do not help deliver the release goal, regardless of their priority or general value.
- **Find missing work**: Compare the full release goal with the cards already on the board and identify each required outcome that no existing card covers.
- **Create only necessary cards**: For each uncovered requirement, follow “Add one task idea” in `references/add-task.md` and include `--release <release-id>` when creating the card.
- **Avoid duplicate work**: Do not create a card when an existing card already covers the requirement, even if that card is already assigned to this release.
- **Keep repeated runs safe**: Leave current release assignments unchanged and add only newly relevant or newly missing work each time the process runs.
- **Make supported decisions directly**: Choose inclusions, exclusions, and missing cards without asking for approval when the goal and board provide enough evidence.
- **Report the result**: Finish with `moved in`, `written`, and `left out` lists containing card identifiers and titles, plus one brief reason for every item left out.
