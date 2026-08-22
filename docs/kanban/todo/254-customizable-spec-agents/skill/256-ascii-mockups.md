---
title: Draw a card's layout options in ASCII instead of a rendered screen
track: skill
priority: med
roi: high
status: ready
release: 0.7.2
blocked_by: []
related: [254]
modules: [skill, local-ui]
questions: []
verify:
  - run ui-design both ways on one real card and compare what each costs — that is what would flip the default
---

`ui-design` answers with two or three mockup files, each a React screen styled to look like
the real product. They are the slowest part of planning a card, they cost a long run each, and
they only exist as a picture inside the board's UI — a user working from a terminal sees a
file name and no drawing. Let the agent draw in ASCII instead, so the file reads as itself
wherever it is opened.

## Worth noting
- **ASCII stays off by default**, so a board that never opens the setting keeps drawing full
  mockups. The default is worth revisiting once both styles have been tried on a real card —
  if ASCII reads well enough, it is the cheaper thing to start with.
- **An ASCII mockup is still not shared**: it sits in `docs/kanban/.mockups/`, which stays
  out of git, so a teammate who pulls the card gets the layout only in its own words.

<!-- agent -->

## Scope
- **`ui-design` gains a setting — mockup style**: `ascii`, or `full` (what it draws today),
  declared as a `SpecAgentSetting` in `cli/src/lib/spec-agents.ts`.
- **`full` is the default**: a board that never opens the setting draws what it draws now.
- **An ASCII mockup is a plain-text drawing** of one screen: boxes, labels, and the words the
  user reads.
- **One `.txt` file per option**, under `docs/kanban/.mockups/<card id>/`: `a.txt` is the
  option labelled `A`.
- **The card body is unchanged**: the same `<Mockup src=".mockups/254/a.txt" label="A" />` tag
  on its own line, and the same one line of plain words per option.
- **The board UI draws it as it stands**, in a monospaced block wide enough not to wrap, with
  the label and full-size link a rendered mockup already gets.
- **The file is the drawing**: opening it in a terminal or an editor shows the same thing the
  card page shows.
- **The setting is board-wide, so one card is drawn in one style**: never a `.tsx` option and
  a `.txt` option side by side.
- **Running the agent again replaces that card's mockups**, whichever style they were in, and
  deletes the ones the new answer no longer points at.
- **`akb guide ui-design` says how to draw in ASCII**: how wide a drawing may be, and that a
  screen still gets two or three options with one recommended.
- **"Mockups" in `akb guide board` gains the `.txt` format** beside `.tsx` and `.html`.
- Out: turning a drawing from one style into the other.

## Todo
- [ ] Declare `ui-design`'s mockup style setting, defaulting to what the board does today.
- [ ] Write the ASCII half of the `ui-design` prompt — what to draw, how wide, and that the
      drawing still stands alone in the card's words.
- [ ] Add `.txt` to the mockup rules in `akb guide board` and `akb guide ui-design`.
- [ ] Show a `.txt` mockup on the card page where its tag sits, in a monospaced block wide
      enough not to wrap.
- [ ] Open one full size on its own page, the way a `.tsx` mockup opens.
- [ ] Keep a drawing readable on a narrow window — scroll it, never reflow it.
- [ ] Check a rerun after a style switch leaves only the new files in the card's folder.
- [ ] Update `docs/guides/daily-loop.md` where it tells the user a mockup is a `.tsx` or an
      `.html` file, and where it says `ui-design` answers with drawn screens.
- [ ] Update the memory notes: the one that says a mockup is a `.tsx` or `.html` file, and the
      design note that says a screen is never drawn in ASCII.

## Decided by the agent
- **Is an ASCII mockup kept in git, since it is plain text?**: no. It sits in
  `docs/kanban/.mockups/` with the rest, which stays out of git.
- **Which mockup style does a board start with?**: `full`, what it draws today. #254 says a
  board that sets nothing runs exactly as it does now, so ASCII arrives by being switched
  on.
