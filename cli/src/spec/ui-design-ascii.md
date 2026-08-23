## Draw it in plain text

One `.txt` file per option, named for its label: `a.txt` is the option labelled `A`. The file
holds the drawing and nothing else — no code, no explanation, no markdown fence. Whoever opens
it in a terminal, an editor or the board sees the same thing.

- **Draw the screen, not a diagram of it**: the boxes the user sees, where they sit, and the
  words that are really in them — the headings, the labels on buttons, a row of real-looking
  data. A box labelled "content area" tells the reader nothing.
- **96 columns is the limit**: no line may be longer. The board never re-wraps a drawing, so a
  line past the edge is one the reader has to scroll to. Height is yours — a long screen is
  fine.
- **Every character is one column wide**: plain ASCII, or the box-drawing characters
  `─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼`. No emoji and no full-width characters: they break the columns in
  fonts that draw them wider.
- **Say what a drawing cannot show**: a colour, a hover, a state that only appears on a click
  goes in a short `[note]` line under the drawing, not into the boxes.

The card's words still have to stand on their own. The file is not in git, so the one line you
write under each tag is what a reader without the drawing picks by — say what that layout is
good for and what it costs, never "see the mockup".
