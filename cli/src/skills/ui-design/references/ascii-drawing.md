## Mockup format: a plain-text drawing

Each mockup goes in the card body itself, in a fenced block under a `###` heading naming its
label. Write no file — this format leaves `docs/kanban/.mockups/<card id>/` empty, so the
drawing travels with the card through git.

- Draw the boxes, labels, controls and real-looking data the user sees, not boxes named
  "content area".
- No line may exceed 96 columns.
- Use plain ASCII or `─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼`; emoji and full-width characters break alignment.
- Put colour, hover and click-only details in a short `[note]` line below the drawing, inside
  its block.
