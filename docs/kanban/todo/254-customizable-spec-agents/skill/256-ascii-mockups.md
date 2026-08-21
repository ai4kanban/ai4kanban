---
title: Draw a card's layout options in ASCII instead of a rendered screen
track: skill
priority: med
roi: high
status: todo
release: ""
blocked_by: [255]
related: [254]
modules: [skill, local-ui]
questions:
  - question: "[user] Which mockup style does a board start with?"
    mode: single
    options:
      - full mockups, as today — nothing changes for a board that never opens the setting
      - ASCII — cheaper on every card, and readable outside the app
    recommend: [1]
---

`ui-design` answers with two or three mockup files, each a React screen styled to look like
the real product. They are the slowest part of planning a card, they cost a long run each, and
they only exist as a picture inside the board's UI — from a terminal, or in a card pulled from
git, a mockup is a file name and nothing else. Let the agent draw in ASCII instead, and let
the board show that drawing everywhere the card is read.

## Scope
- **`ui-design` gains a setting — mockup style**: `ascii`, or `full` (what it draws today),
  declared the way #255 declares one.
- **An ASCII mockup is a plain-text drawing** of one screen: boxes, labels, and the words the
  user reads, in a `.txt` file under `docs/kanban/.mockups/<card id>/` — `a.txt` for `A`.
- **The card body is unchanged**: the same `<Mockup src=".mockups/254/a.txt" label="A" />` tag
  on its own line, and the same one line of plain words per option.
- **The board UI draws it as it stands**, in a monospaced block wide enough not to wrap, with
  the label and full-size link a rendered mockup already gets.
- **Anywhere else it reads itself**: `cat` shows the drawing, which is the point of the style.
- **One style per run, board-wide**: a card never carries a `.tsx` option and a `.txt` option
  side by side.
- **Switching style and running the agent again replaces the old files**, dropping the ones
  the new answer no longer points at — today's rule, across the two styles.
- **`akb guide ui-design` says how to draw in ASCII**: how wide a drawing may be, and that a
  screen still gets two or three options with one recommended.
- **"Mockups" in `akb guide board` gains the `.txt` format** beside `.tsx` and `.html`.
- Out: turning a drawing from one style into the other.

## Todo
- [ ] Declare `ui-design`'s mockup style setting, defaulting to what the board does today.
- [ ] Write the ASCII half of the `ui-design` prompt — what to draw, how wide, and that the
      drawing still stands alone in the card's words.
- [ ] Add `.txt` to the mockup rules in `akb guide board` and `akb guide ui-design`.
- [ ] Draw a `.txt` mockup in the card page's `<Mockup>` renderer, monospaced and unwrapped.
- [ ] Open one full size on its own page, the way a `.tsx` mockup opens.
- [ ] Keep a drawing readable on a narrow window — scroll it, never reflow it.
- [ ] Check a rerun after a style switch leaves only the new files in the card's folder.
- [ ] Run the agent both ways on one real card and compare what the two cost.
- [ ] Update the memory note that says a mockup is a `.tsx` or `.html` file.
