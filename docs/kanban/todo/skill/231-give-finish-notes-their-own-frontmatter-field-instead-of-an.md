---
title: Give finish notes their own frontmatter field instead of an open question
track: skill
priority: med
roi: med
status: ready
release: ""
blocked_by: []
related: []
modules: [skill, local-ui]
questions: []
---

When a build ends, the agent often has a note for the user that is not a question — what
is still unchecked, what to try on a real build. Call that a **finish note**. Today the
only place in the frontmatter for it is `questions:`, so it lands there as a `[user]`
question (the archived card that installed `akb` from the desktop app carried one this
way). That is wrong twice: the user is not meant to answer it,
and an open question reads like something is broken — scary on a card that is actually
done.

## Scope
- Add a frontmatter field `verify:` — a list of short lines, each one thing the user
  should check by hand before accepting the finished work.
- A verify line is a note to read, not a question to answer: no tags, no options, no
  answer box anywhere.
- A decision the user must make still goes to `questions:` as a `[user]` question — a
  verify line never carries one.
- Only board commands write the field, never an editor.
- The commands can append a line, drop lines, and clear the list — the same three edits
  `questions:` gets.
- Resolve skips verify lines.
- Verify lines keep a card from neither `ready` nor archive.
- An archived card keeps its verify lines.
- The flows — the instruction files in `cli/src/guide/` that walk the agent through each
  action — say at the end of a build where each line goes: a hand-check in `verify:`, a
  decision in `questions:`.
- When resolve meets a question that is really a finish note, it moves the note to
  `verify:` instead of answering it.
- On the board, a card with verify lines shows a chip of its own, separate from the
  open-question chip.
- That chip never uses the accent color that marks a question waiting on the user.
- The card page lists the lines under their own heading, as plain text with nothing to
  click or fill in.
- A board written before the field keeps working unchanged.

## Decided by the agent
- **The field's name?** `verify` — the lines are what the user checks at acceptance;
  "note" would say too little about what to do with them.
- **One string or a list?** A list of lines, like `questions:`, so the commands and the
  UI can handle them one at a time.
- **A tick-box per line in the UI?** No — the user checks, then archives; a done-state
  per line is machinery the value doesn't justify.

## Todo
- [ ] Add the `verify:` field and its board command — append, drop, clear — leaving every
      existing board readable.
- [ ] Update the flows so a finish note goes in `verify:` and only decisions stay open
      questions.
- [ ] Have resolve move a misfiled finish note to `verify:` instead of answering it.
- [ ] Keep verify lines from blocking resolve, `ready`, or archive.
- [ ] Show the lines in the local UI: the chip on the card, their own section on the card
      page, apart from open questions.
- [ ] Add the new command to the frontmatter-commands line in the skill note,
      `skill/SKILL.md`.
- [ ] Say in the daily-loop guide what a verify line is and what to do with one.
