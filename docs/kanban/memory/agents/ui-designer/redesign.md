# What `ui-design` was corrected on

One line per correction: the mistake, then the design to use instead.

## Before drawing

- ❌ **Drew for a card that had already landed** → ✅ check the card is still in `todo/` first.
- ❌ **Drew against a view the app no longer has** → ✅ inspect the current screen first; a
  revision refreshes every affected screen and shared copy at once.
- ❌ **A second control for a job an existing one does** → ✅ reuse that feature's shape and
  interactions, changing only copy and actions.
- ❌ **Restyled shared chrome, or copied a sibling's chrome from memory** → ✅ shared chrome is
  out of scope; reread the sibling's frame before rendering — siblings are compared side by side.
- ❌ **Invented the app's words** → ✅ take strings from the app's i18n, in the board's language;
  CLI-supplied delivery text stays English.
- ❌ **Drew a frame the app never shows** → ✅ draw the real frame: the board cut at the edge, a
  card page inside its rail and chat, a dialog covering what is behind it.
- ❌ **Split one moment into several screens** → ✅ find the one state where they co-exist.
- ❌ **One language for a card asking for 中英文** → ✅ draw each surface in both languages, and
  size against the English render — it runs about a quarter longer.
- ❌ **A CLI workflow drawn as a screen** → ✅ keep commands as a short text block in the card.
- ❌ **Invented branding or hand-wrapped headlines** → ✅ real logo, natural wrapping, the
  supplied reference.
- ❌ **A static lookalike where the card wanted a capture** → ✅ run the real surface and shoot it.
- ❌ **A guide entry drawn as a link to the website** → ✅ reuse the app's in-place guide drawer.

## What a screen may do

- **Never pick for the user**: where two answers are real, show both, and the one that throws
  work away says so.
- **A new fact earns a new mark or nothing**: never overload a slot; a mark needs a tip.
- **A typed name lives in one box on its action**; generated text beside it never repeats it.
- **A value to copy and its copy button read as one**; a long path is cut from the left.
- **Saving reads at the caret**, and an in-flight start relabels the pressed button.
- **No bulk retry over failures**: each row is a different run.
- **A source is a type plus key/value pairs**, never one free-text string.
- ❌ **Every item repeats actions, timestamps and counts under stacked toolbars** → ✅ actions
  only on the focused item, one control row.
- ❌ **A form opened inside an item** → ✅ it opens outside the item.

## Refusals and empty states

- **A refusal answers where it was pressed**, in the slot the thing would fill; the page band
  is only for what has no control. If that slot is gone, it moves to what replaced it.
- **A refusal naming agents shows each one's character**, since an agent name can equal a step name.
- **Removing a title row still needs a window name and a ✕.**
- **An empty list gives no instruction that cannot be followed**; one honest line where the
  space is.
- ❌ **Skipped the state after success** → ✅ draw it, saying what did NOT happen.
- ❌ **A waiting state missing slots for facts the failure state asks for** → ✅ one panel, one
  submit, every fact collected, and the "nothing was made, and where it stuck" path drawn.

## Covering and clipping

- **An overlay always leaves a way off**: one in the pane head, one back in the top row, never
  a second ✕.
- **A thing gets a standing warning or a confirmation, never both**, and a confirmation never
  hides what must be read first.
- **A hover bubble never lands on a rule or a clipped row's last item**; reuse the board's own
  tooltip, growing away from edges.
- **Cut a scroll through body text, never a caption**, and fade a clipped panel into its ground.
- **A popover in a scrolling row escapes via a hidden copy over it**, or the scroller clips it.

## Characters and scenes

- **Characters differ by silhouette, pose and prop**, never a recolour or swapped hat.
- **Roster art comes from `kanban-ui/agent-art.md`**; an agent with none keeps its lettered card.
- **Correct a sprite sheet against the base art**: keep proportions and shading, change only
  what the sheet adds.
- ❌ **A crowded activity scene with permanent detail panes** → ✅ spacious room, recent
  successes only, details in floating sidebars; draw capacity and completion states.
- ❌ **Labels stacked under a figure** → ✅ role and harness above the head, card id at the feet.
- ❌ **A busy machine as a lit still** → ✅ an animation sheet that freezes on a working frame
  for reduced motion.

## Wording and width

- ❌ **Vague or childish phrasing about mistakes** → ✅ professional Chinese that names the
  issue, e.g. "需求理解偏差".
- **Write a Chinese line a few characters under its limit**, or it orphans two or three.
- **Event words stay English in Chinese notification rows; ids stay lowercase.**
- ❌ **A one-line fact bar drawn for desktop only on a surface phones open** → ✅ draw the narrow
  state: it wraps one fact per line, drops nothing, separated by gap rather than `·`.

## Figures and charts

- ❌ **Measured numbers and reported claims drawn alike** → ✅ a sourced figure links out; a
  reported one is unlinked and names who reported it.
- ❌ **Chart labels and arrows that break at phone width** → ✅ label as a legend on the heading
  row; the arrow stays inside the sentence.
- **A growing series is a line, never bars**, with text kept outside the chart graphic.
- **A figure spends no extra lines** over what the old one had.
- **A UI crop is worth it only if its words survive the shown width**: crop to the one block.
- ❌ **Annotating a picture like markdown** → ✅ one whole-file note control, one numbering
  across both anchors.
- ❌ **A machine verdict mixed into the user's notes** → ✅ set it apart clearly and say what it
  feeds into the next round.

## Rendering a mockup

- **Look at the rendered shot before finishing**: overflow only shows there; if no browser
  starts, say the frame was never seen.
- **The sandbox has no scripts, network, fonts or images**: art is inline SVG, media is drawn
  over its first frame.
- **Never add a CSS reset, and set tones with utility classes**: inline theme variables come out
  colourless.
- **Give boxes fixed heights, not stretch-to-fill**, or copied panes collapse or clip.
- **An inherited art module holds only what its card drew**: inline missing roster art first.
- **Configuration dialogs start from an existing dialog mockup**, with the sidebar sections
  reread first.
- **An email is drawn by running the product's own template**; hide images without placeholders.
- **Plain-text drawings are hard-wrapped as the file would be**, never re-wrapped.
- **An `.html` asset needs `<base href="about:srcdoc">`**, or its `#` links replace the frame.
