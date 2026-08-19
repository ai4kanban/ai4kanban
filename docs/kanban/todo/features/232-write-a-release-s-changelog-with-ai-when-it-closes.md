---
title: Write a release's changelog with AI when it closes
track: features
priority: med
roi: med
status: ready
release: ""
blocked_by: []
related: []
modules: [skill, local-ui]
questions: []
---

Closing a release writes a list of cards and nothing else. Have an agent write a short changelog in plain words, so the record says what the version changed for the user.

## Scope
- Keep everything a close writes today: the goal, the shipped cards, the cards still open, one dated section per close.
- Add a short changelog inside that dated section, directly under its heading and above the rest of it.
- Each changelog line says one thing the user can now see or do, in a few plain words.
- Keep file names, internal rewrites and card ids out of the changelog.
- Write it from the release goal and the cards archived under that version, and from nothing else.
- An agent writes it in the background, in a run of its own — one the runs panel lists and logs like any other run.
- The close finishes as soon as it has written the card list, and the changelog reaches the file when that run ends.
- `akb changelog <version>` starts the run.
- The command also works on a version that is already closed.
- The run writes into the newest dated section of that version's summary file.
- The run replaces a changelog already in that section, and never adds a second one.
- Closing from the board UI starts the run.
- Closing from the terminal names `akb changelog <version>` as the next command to type.
- A version that shipped no card gets no changelog, and nothing is started for it.
- The terminal's close says there is no changelog when nothing shipped, in place of naming the command.
- The Close dialog says before the close which of the two is coming: a changelog, or none because nothing shipped.
- The board UI says, once the close is done, when the run could not start or ended in failure.
- That message names `akb changelog <version>` as the way to get the changelog after all.
- The close writes its card list whether the changelog is ever written or not.
- `akb changelog <version>` writes nothing and says why when that version shipped no card.
- It does the same when the board holds no closed record of that version.
- The summary file's heading now says "This is a list of cards, not a changelog" — rewrite it to say the file carries a changelog written by an agent from the cards, and that a change which was never a card is still not in it.

## Todo
- [ ] Add `changelog <version>`: a run that writes a short changelog into the newest dated section of that version's summary file, above the card list.
- [ ] Have the run read the release goal and the cards archived under the version.
- [ ] Make the run replace a changelog already in that section instead of adding another.
- [ ] Have the run say there is nothing to write when the version shipped no card.
- [ ] Have the run say so when the board holds no closed record of the version.
- [ ] Have the board UI's close start the run.
- [ ] Say in the Close dialog whether a changelog is coming.
- [ ] Say in the board UI when the run could not start or failed, and name the command that writes the changelog.
- [ ] Have the terminal's close name the changelog command, and say there is none when nothing shipped.
- [ ] Keep the close writing its card list when the run is missing, refused, or fails.
- [ ] Rewrite the summary file's heading.
- [ ] Update `akb guide releases` and the user-facing docs that call the summary a list of cards.
- [ ] Close a test release end to end from both the command and the UI, and read the file.

## Decided by the agent
- **How does a close ask an agent, when the close itself only edits files?** It doesn't wait for one. The close writes the card list, and the changelog is a separate run started after it.
- **Why a run rather than something the close waits for?** An agent takes minutes, and a close that waited would hold up the board. Making a release already works this way: a release with a goal gets its cards from a run started once the release is written.
- **Does the terminal's close start that run itself?** No. An `akb board ...` command is bookkeeping and never starts a run, so the close names the command to type instead.
- **Does the UI need a way to write a closed version's changelog later?** No. A closed version is off the release list, so the UI has nowhere to offer it, and the UI never reads the summary files. Anything after the close is typed in the terminal.
- **Where does the failure message appear, if the closed version has left the UI?** On the board, right after the close — the same place the board says anything else about a close.
- **How can the board say the run failed, if it never reads the summary file?** From the run itself: it refused to start, or it ended in failure.
- **Does a changelog run that could not start get a retry button?** No. The message names the command instead.
- **Who is the changelog written for?** Someone who never saw the board, so every line has to make sense without it.
- **Where does the run read the release goal, when the close has already taken the version off the release list?** From the section the close just wrote, which contains the goal.
- **What if the summary file holds several dated sections, because a version id was used again?** The run always writes into the newest section. An older close's changelog is a hand edit — the command cannot reach it.
- **What language is the changelog in?** The language of the release goal, or of the shipped cards' titles when the release had no goal.
- **How long is it?** Six lines at most.
