---
title: Write a release's changelog with AI when it closes
track: features
priority: med
roi: med
status: todo
release: 0.7.2
blocked_by: []
related: [298]
modules: [skill, local-ui]
questions: []
---

Closing a release writes a list of cards and nothing else. Have an agent write a short changelog in plain words at the top of that record, so the version says what it changed for the user.

## Worth noting
- Six lines at most, each naming one thing the user can now see or do, written for someone who never saw the board.
- The changelog comes from the release goal and the cards archived under the version, and from nothing else — a change that never went through the board is still missing from it, and the file says so.
- Closing starts the run, from the board UI and from the terminal alike — the changelog has no other moment, and a step the user has to remember is a step nobody takes. Inside a run, or when the run cannot start, the close names `akb changelog <version>` to type instead.
- The changelog is read in the summary file, in an editor or in git. The board UI shows the run, never the text it wrote — reading a closed version's changelog on the board is #298, and does not ship with this card.

<!-- agent -->

## Scope
- Keep everything a close writes today: the goal, the shipped cards, the cards still open, one dated section per close.
- Add a short changelog inside that dated section, under a heading of its own, directly below the section's heading and above the rest of it.
- Each changelog line says one thing the user can now see or do, in a few plain words.
- Write six lines at most.
- Keep file names, internal rewrites and card ids out of the changelog.
- Write it from the release goal and the cards archived under that version, and from nothing else.
- Write it in the language of the release goal, or of the shipped cards' titles when the release had no goal.
- An agent writes it in the background, in a run of its own — one the runs panel lists and logs like any other run.
- The run belongs to no card, and is named for the version it writes.
- The close finishes as soon as it has written the card list, and the changelog reaches the file when that run ends.
- The close writes its card list whether the changelog is ever written or not.
- `akb changelog <version>` starts the run.
- The command also works on a version that is already closed.
- The run writes into the newest dated section of that version's summary file.
- The run rewrites what sits under the changelog heading already there, and never adds a second one.
- `akb changelog <version>` writes nothing and says why when that version shipped no card.
- It does the same when the board holds no closed record of that version.
- It does the same when a changelog run for that version is already going.
- Closing from the board UI starts the run.
- The Close dialog says before the close which of the two is coming: a changelog, or none because nothing shipped.
- The board UI says, once the close is done, when the run could not start or ended in failure.
- That message names `akb changelog <version>` as the way to get the changelog after all.
- A version that shipped no card gets no changelog, and nothing is started for it.
- Closing from the terminal starts the run too, and says which run is writing the changelog.
- A close run from inside a run starts nothing and names `akb changelog <version>` instead — a run never starts another.
- The terminal's close names that command as well when the run is refused or cannot spawn, so the changelog is always one command away.
- The terminal's close says there is no changelog when nothing shipped, in place of both.
- `akb help` lists `akb changelog <version>` beside the other commands that start a run.
- The summary file's heading now says "This is a list of cards, not a changelog" — rewrite it to say the file carries a changelog written by an agent from the cards, and that a change which was never a card is still not in it.

## Todo
- [ ] Add `changelog <version>`: a run that writes a short changelog into the newest dated section of that version's summary file, above the card list.
- [ ] Give the changelog a heading of its own inside that section, and have the run find and rewrite what sits under it rather than adding a second changelog.
- [ ] Have the run read the release goal and the cards archived under the version, and write in the language it finds there.
- [ ] Have the run say there is nothing to write when the version shipped no card.
- [ ] Have the run say so when the board holds no closed record of the version.
- [ ] Refuse a second changelog run for a version that already has one going, and say why.
- [ ] List `akb changelog <version>` in `akb help`.
- [ ] Have the board UI's close start the run, and show it in the runs panel as soon as it starts.
- [ ] Say in the Close dialog whether a changelog is coming.
- [ ] Say in the board UI when the run could not start or failed, and name the command that writes the changelog.
- [ ] Have the terminal's close start the run, name the command when it starts nothing, and say there is no changelog when nothing shipped.
- [ ] Keep the close writing its card list when the run is missing, refused, or fails.
- [ ] Rewrite the summary file's heading.
- [ ] Update `akb guide releases` and the user-facing docs that call the summary a list of cards.
- [ ] Close a test release end to end from both the command and the UI, and read the file.

## Decided by the agent
- **How does a close ask an agent, when the close itself only edits files?** It doesn't wait for one. The close writes the card list, and the changelog is a separate run started after it.
- **Should `release close` start a run, when no other `akb board ...` command does?** Yes, and only this one. The changelog has no other moment: the close is the last time anyone looks at the version, and a command the user has to remember afterwards is one nobody types. The rule it bends is there to stop a run spawning a copy of itself, so the close checks for that case and prints the command instead.
- **Why a run rather than something the close waits for?** An agent takes minutes, and a close that waited would hold up the board. Making a release already works this way: a release with a goal gets its cards from a run started once the release is written.
- **Which card does the run belong to?** None, the way `create`, `propose` and `plan-release` belong to none. It is named for the version it writes.
- **How does a second run replace the changelog instead of adding one?** It writes under a heading of its own inside the dated section, and that heading is what it finds and rewrites. Without one, nothing in the file marks where the changelog ends and the card list begins.
- **What if a changelog run for that version is already going?** The second one is refused and says why, so two runs never write the same section.
- **Does the UI need a way to write a closed version's changelog later?** No. A closed version is off the release list, so the UI has nowhere to offer it. Anything after the close is typed in the terminal.
- **Where does the failure message appear, if the closed version has left the UI?** On the board, right after the close — the same place the board says anything else about a close.
- **How can the board say the run failed, if it never reads the summary file?** From the run itself: it refused to start, or it ended in failure.
- **Does a changelog run that could not start get a retry button?** No. The message names the command instead.
- **Where does the run read the release goal, when the close has already taken the version off the release list?** From the section the close just wrote, which contains the goal.
- **What if the summary file holds several dated sections, because a version id was used again?** The run always writes into the newest section. An older close's changelog is a hand edit — the command cannot reach it.
