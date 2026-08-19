---
title: Write a release's changelog with AI when it closes
track: features
priority: med
roi: med
status: todo
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
- Write it from the release goal and the cards archived under that release, and from nothing else.
- An agent writes it as a background run — the kind that shows in the runs panel with its own log — so the close never waits for it.
- The close finishes as soon as it has written the card list, and the changelog reaches the file when the run ends.
- `akb changelog <version>` is that run.
- The run can also be started on its own later, on a version that is already closed.
- The run writes into the newest dated section of that version's summary file.
- Running it again replaces the changelog it wrote before, and never adds a second one.
- Closing from the board UI starts the run.
- Closing from the terminal names `akb changelog <version>` as the next command to type.
- The close writes its card list whether the changelog is ever written or not.
- A version that shipped no card gets no changelog, and no run is started for it.
- The Close dialog says which of the two is about to happen: a run will write the changelog, or nothing shipped so there is none.
- After the close, the board says when the run could not start or ended in failure, and names the command that writes the changelog.
- A run that fails partway leaves the card list as it was, and running it again is how the changelog gets written.
- `akb changelog <version>` writes nothing and says why when that version shipped no card, and when the board has no closed record of it.
- The summary file's heading says today "This is a list of cards, not a changelog" — rewrite it: the file now carries a changelog written by an agent from the cards, and a change that was never a card is still not in it.

## Todo
- [ ] Add `changelog <version>`: a run that writes a short changelog into the newest dated section of that version's summary file, above the card list.
- [ ] Have the run read the release goal and the shipped cards.
- [ ] Make a second run replace the changelog it wrote before instead of adding another.
- [ ] Have the run write nothing, and say why, when no card shipped or the board has no closed record of that version.
- [ ] Have the board UI's close start the run.
- [ ] Say in the Close dialog whether a changelog is coming.
- [ ] Say after the close when the run could not start or failed, and name the command that writes the changelog.
- [ ] Have the terminal's close name the changelog command, and say there is none when nothing shipped.
- [ ] Keep the close writing its card list when the run is missing, refused, or fails.
- [ ] Rewrite the summary file's heading.
- [ ] Update `akb guide releases` and the user-facing docs that call the summary a list of cards.
- [ ] Close a test release end to end from both the command and the UI, and read the file.

## Decided by the agent
- **How does a close ask an agent, when the close itself only edits files?** It doesn't wait for one. The close writes the card list, and the changelog is a separate run started after it. Making a release already works this way: a release with a goal is filled by a run started once the release is written.
- **Does the terminal's close start that run itself?** No. An `akb board ...` command is bookkeeping and never starts a run, so the close names the command to type instead.
- **Does the UI need a way to write a closed version's changelog later?** No. A closed version is off the release list, so the UI has nowhere to offer it, and the UI never reads the summary files. Anything after the close is typed in the terminal.
- **How can the board say the changelog is missing, if it never reads the summary file?** From the run itself — it refused to start, or it ended in failure.
- **Does a changelog run that could not start get a retry button?** No. The notice names the command instead.
- **Who is the changelog written for?** Someone who never saw the board, so every line has to make sense without it.
- **Where does the run read the release goal, when the close has already taken the version off the release list?** From the section the close just wrote: it carries the goal.
- **What if the summary file holds several dated sections, because a version id was used again?** The run writes into the newest section only. Fixing an older one is a hand edit.
- **What language is the changelog in?** The language of the release goal, or of the shipped cards' titles when the release had no goal.
- **How long is it?** Six lines at most.
