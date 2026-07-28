---
title: Let a user read and edit the board in Obsidian
track: features
priority: med
roi: med
status: todo
blocked_by: []
related: [55]
modules: [skill, local-ui]
questions:
  - "[user] Finished cards move to .archive/, and Obsidian never shows a folder whose name starts with a dot. So a user reading the board in Obsidian sees only open work. Accept that, or drop the dot so finished cards are visible too? Dropping it changes the folder name for every board, not just Obsidian ones."
---

Let a user read and edit the board in Obsidian. The user opens the board folder in the
repo as a vault, and every card reads like a normal Obsidian note.

## Scope

- This is a format option on the markdown board, not a second backend. Same files, same
  layout, one switch that changes how a card is written.
- The vault is the board folder in the repo, `docs/kanban/`. The user opens that folder in
  Obsidian. The board stays in git, so it can still be reviewed and reverted.
- The file layout does not change: a folder per track, one file per card, the same index.
  What changes is how a card is written, so Obsidian reads it the way its users expect.
- Card meta becomes Obsidian properties. Our frontmatter is already YAML, so most of this
  is free — fix only what the properties panel shows badly.
- With the switch on, a card points at another card with a `[[wikilink]]` instead of a
  bare id, and the board gets a view file (`.base`) so Obsidian shows it with its own
  Bases plugin. Nothing here needs a community plugin.
- The script stays the only writer of frontmatter. If a user edits a card in Obsidian and
  breaks a field, the script should say what is wrong instead of crashing.
- Say plainly what this does not do: no drag-and-drop columns, and the board does not sit
  inside the user's own notes vault.

## Todo

- [x] Pick the vault layout: folder per track, one file per card, and where the index goes.
- [x] Check what Obsidian's properties panel shows for our frontmatter; adjust if it is unreadable.
- [ ] Put the Obsidian switch in `docs/kanban/ui.config.json`, off by default.
- [ ] Add a line about the Obsidian switch to the note inside `ui.config.json`.
- [ ] Add `kanban obsidian on|off`. It writes the switch and converts the board in one
      step, and running it twice is safe.
- [ ] Warn before rewriting every card, so the user can commit first.
- [ ] Convert every open card when the switch goes on, and write them back when it goes
      off. Delete `board.base` when it goes off.
- [ ] Leave `.archive/` alone. A finished card keeps whatever style it had.
- [ ] Keep bare ids as the default link style; write wikilinks only when the switch is on.
- [ ] Write `blocked_by` and `related` as quoted wikilinks
      (`- "[[56-read-and-edit-the-board-in-obsidian]]"`) when the switch is on.
- [ ] Read a link in any shape Obsidian writes: strip a folder path, a trailing `.md`, a
      `#heading` and a `|display name`, then read the number at the front.
- [ ] Read bare ids and wikilinks on every board, whatever the switch says, so turning it
      on or off never breaks a card.
- [ ] Write every link back in the plain quoted form, whatever shape it came in as.
- [ ] Never silently drop a link the tool cannot read. Name the card and the value.
- [ ] Fix every inbound link when a card is renamed, archived, or rejected, so no link
      points at a file that is gone.
- [ ] Write list properties as a bulleted block when the switch is on, so an edit in
      Obsidian leaves no diff.
- [ ] Read both list styles. Obsidian rewrites `blocked_by: [55]` into a bulleted list the
      moment a user edits properties.
- [ ] Carry through every frontmatter line the tool does not own, whatever it is named —
      including names with a space, a digit in front, or a hyphen.
- [ ] Handle a card a user edited by hand in Obsidian — validate and report, never crash.
- [ ] Add a `board.base` file with the board views: every open card grouped by status, and
      one view for blockers.
- [ ] Filter `board.base` to the cards under `todo/`, so the memory files and the index are
      not rows in it.
- [ ] Ignore `.obsidian/` in git. It is per-machine app state. `board.base` is a normal
      file and is committed.
- [ ] Add a check for a card file with no number in front of its name, and for two cards
      sharing one number. A duplicate number is a hard error naming both files.
- [ ] Make the check repair a `track:` that no longer matches the folder the file sits in,
      and move its README line to match.
- [ ] Never rewrite a card the tool cannot identify. Report the path and stop.
- [ ] Warn when the switch is on but the cards are still in the old style, and name the
      command that fixes it. Never convert from a warning.
- [ ] Run the board check after `update`, `archive` and `reject` too — today it only runs
      after `create` and `run`.
- [ ] Fix the local UI too: read a wikilink back to its id, and keep every property and
      link value it did not itself change. Today one save drops them.
- [ ] Do not add the Obsidian switch to the local UI's Configuration dialog. Flipping it
      rewrites card files, which only the script does.
- [ ] Cover a property named `due date` and one named `2nd owner` in the round-trip test.
- [ ] Test the whole loop on a real vault: create, refine, resolve, archive, reject.
- [ ] Test a rename and a move in a real vault: rename a card, move it to another track,
      then run the check.
- [ ] Check `kanban-ui` works against the vault.
- [ ] Add a guide page in `docs/guides/` on using the board with Obsidian.
- [ ] In the guide: how to open the board folder as a vault, and that adding it to an
      existing vault by symlink is at the user's own risk.
- [ ] In the guide: Bases needs Obsidian 1.10 or newer — that is the version that can group
      a view by a property.
- [ ] In the guide: Obsidian shows the board as a grouped table or cards. Drag-and-drop
      columns need a community plugin we do not ship or require.
- [ ] In the guide: `todo/README.md` is the written index, `board.base` is the view you
      sort and group.
- [ ] In the guide: renaming a card in Obsidian is fine as long as the number stays at the
      front of the name. "Make a copy" leaves a second card with the same number — rename
      it or delete it.
- [ ] In the guide: finished cards sit in a folder starting with a dot, so Obsidian does
      not show them. Read them in git.
- [ ] In the guide: when the backend is not the markdown board, the Obsidian switch is
      ignored, because there is no card file to write.
- [ ] Add a line to `web/` copy about Obsidian support (doc only — do not touch page code).

## Decided

- **The switch goes in `docs/kanban/ui.config.json`.** Every board setting lives in the
  file that already exists, so this card creates no file and adds one key to that one.

## Decided by the agent

- **The Obsidian switch is its own setting, not a value of `backend`.** `backend` says
  where cards live; this switch says how a card file is written. Two questions, so two
  keys in `ui.config.json`. A user who never opens Obsidian never sees this one.
- **The Obsidian way does not become the default.** Bare ids stay how `blocked_by` and
  `related` are written on every board. A wikilink is longer to read and costs more tokens
  on a card the agent reads on every run, and most users never open Obsidian. Wikilinks
  are written only when the Obsidian switch is on. This is not two code paths through the
  flows — it is one branch where frontmatter is written, and the read side already has to
  take both styles because Obsidian rewrites properties on its own.
- **Plain notes, not a plugin's file format.** The official way, no community plugin. So a
  card stays one markdown note with YAML properties. The popular `obsidian-kanban` board
  file is a community plugin, so it is out.
- **The board view is a `.base` file.** Bases is Obsidian's own plugin. A `.base` file
  holds the views; the data stays in the notes. It can group by one property — so `status`
  or `track` gives the board its columns as groups. Grouping a view by a property arrived
  in Obsidian 1.10, so that is the version the guide names. There is no drag-and-drop
  kanban view in the app; that is a community plugin. We say so instead of shipping one.
- **The vault stays in the repo.** The vault is the board folder itself. `goal.md` promises
  plain text in git, and a board at an outside path gives that up. So there is no vault
  path setting.
- **What that costs.** The board is not inside the user's own notes vault. They open the
  board folder as a second vault and switch between vaults, which Obsidian supports.
  Adding the folder to an existing vault by symlink does work, but Obsidian says use
  symlinks at your own risk, so the guide names it and does not recommend it.
- **Obsidian-native writing.** Properties for the meta, and quoted wikilinks for
  `blocked_by` and `related` — a link must be quoted in YAML or Obsidian will not read it.
  The id stays the number in front of the file name, so nothing is lost.
- **Todos are already native.** The card body's `- [ ]` lines are Obsidian tasks, and its
  headings are normal markdown. The body needs no change at all.
- **Two things break today.** The script keeps only the fields it knows, so a property a
  user adds in Obsidian is dropped on the next write. And the script reads ids as numbers,
  so a wikilink would silently read as no link.
- **The local UI is affected.** It keeps its own copy of the card reader and writer. It
  throws away any link that is not a plain number, and it rebuilds the whole property block
  from the few fields it knows — so with the switch on, one ordinary save in the UI wipes
  every link and every property the user added in Obsidian.
- **The UI keeps values, it does not write them.** It never writes a wikilink itself. It
  keeps every property and every link value it did not change, exactly as it found them.
  So it does not need to read the switch at all, and it cannot lose a user's work.
- **One command turns it on: `kanban obsidian on`, and `off` turns it back.** The command
  writes the switch and converts the board in one step. The UI does not get this switch:
  flipping it rewrites card files, and only the script writes those.
- **The whole open board is converted in one go, both ways.** A user who turns it on opens
  Obsidian expecting links to click. A board where only recently touched cards have links
  just looks broken. Turning it off writes the cards back and removes `board.base`. The
  read side still takes both styles, so a half-converted board never breaks, and the whole
  rewrite is one diff the user can review. The command warns first, so they can commit.
- **A link is written as the plain quoted file name** — `- "[[56-read-and-edit-the-board-in-obsidian]]"`.
  Obsidian matches a link on the full name only; `[[56]]` resolves to nothing. The alias
  form is longer, not shorter, so it buys nothing. The read side takes any shape Obsidian
  may write — a folder path in front, a trailing `.md`, a `#heading`, a `|display name` —
  strips it, and reads the number at the front. Every write puts it back in the plain form.
- **With the switch on, a list property is written as a bulleted block.** That is the shape
  Obsidian writes back after any property edit, so matching it means editing a card in
  Obsidian leaves no diff at all.
- **A property the tool does not own is carried through untouched.** Today a line the
  reader does not recognise is dropped on the next write, and that includes any name with
  a space, a digit in front, or a hyphen — `due date` and `2nd owner` both vanish. The tool
  only needs to understand the fields it writes; the rest passes through as it is.
- **`board.base` sits at the vault root, `docs/kanban/board.base`, and lists only the cards
  under `todo/`.** Without that filter the memory files and the index show up as rows.
  `todo/README.md` stays the index: it is what the agent and GitHub read. The guide says
  the split in one line — the README is the written list, `board.base` is the view you
  sort and group.
- **A rename in Obsidian keeps the links but can lose the card.** Obsidian rewrites inbound
  links by itself, including the ones in `blocked_by` and `related`, so a renamed card
  stays linked. But the id is the number in front of the file name, so a rename that drops
  the number makes the card unreachable, and a move to another track folder leaves `track:`
  stale. The folder and the number stay the truth, and a check command finds the drift and
  repairs it instead of the tool crashing.
- **Two cards with the same number is a hard error.** A user can duplicate a card in
  Obsidian. Today the tool takes whichever file it finds first, and that order differs per
  machine, so it could edit or archive the wrong card. It names both files and stops.
- **A hand-edited switch is caught by a warning, never by a silent convert.** If someone
  sets the switch in the file instead of running the command, the board check says the
  switch is on while the cards still point at each other with bare ids, and names the one
  command that fixes it. It never converts on its own.
- **Finished cards are not converted and are not visible in the vault.** They move to
  `.archive/`, and Obsidian shows no folder that starts with a dot. Rejected cards are
  deleted, so there is nothing to convert.
