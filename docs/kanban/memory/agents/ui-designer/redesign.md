# What `ui-design` was corrected on

One line per correction: the mistake, then the design to use instead. Colours, sizes and
components are read from the app's own `design.md`, never written here.

## Before drawing

- ❌ **Drew a screen for a card that had already landed** → ✅ check the card is still in
  `todo/` first; a mockup drawn for an archived card is dead work.
- ❌ **Drew mockups for a change with no user interface in it** → ✅ draw only for an
  interface decision.
- ❌ **A spec drawn against a view the app no longer has** → ✅ inspect the current screen, its
  modes and its controls first. A revised spec refreshes every affected screen, shared copy
  and card reference in the same revision.
- ❌ **Designed a second control for a job an existing one already does** → ✅ find the feature
  that already has that shape and reuse its components and interactions, changing only the
  copy and the actions.
- ❌ **Copied a sibling card's chrome without looking at it again** → ✅ siblings under one
  parent are drawn side by side, so reread the sibling's frame just before rendering. A second
  tab of one page is that same page.
- ❌ **Invented the app's own words** → ✅ take every string from the app's own i18n files, and
  draw in the board's language. A delivery's pill and the line under it come from the CLI and
  stay English on a Chinese card page.
- ❌ **Drew a whole desktop frame the app never shows** → ✅ draw the frame the app really has:
  the board is cut at the paper's edge, a card page sits inside the rail and chat frame, and a
  dialog buries what is behind it rather than sitting beside it.
- ❌ **Split one moment into three screens** → ✅ before drawing three states, look for the
  single state where they co-exist.
- ❌ **Answered a card asking for 中英文 copy with one screen in the board's language** → ✅ a
  card that wants both languages wants each surface drawn twice, or the English is never
  reviewed. Put both languages' words and every state in one shared module, and let each entry
  be two lines naming a state and a language.
- ❌ **Sized a screen against the Chinese shot alone** → ✅ the same copy runs a quarter longer
  in English, so a pane that fits in 中文 clips in English — measure the English render.
- ❌ **Restyled shared chrome while redesigning one page** → ✅ shared chrome is out of scope;
  reuse the existing component unchanged, and preserve the current screen's layout and control
  sizes when adding a feature.
- ❌ **A mobile mockup drawn as a phone-width column on a desktop canvas** → ✅ use a real
  narrow viewport.
- ❌ **A CLI workflow maintained as an HTML screen** → ✅ keep terminal commands and output as
  a short fenced text block in the card; draw only actual visual surfaces.
- ❌ **Invented branding and hand-wrapped headlines** → ✅ use the real product logo, natural
  wrapping, and the supplied reference.
- ❌ **Rebuilt a screen as a static lookalike to fill a figure a card asked to photograph** →
  ✅ when the card wants a capture, run the real surface and shoot it; a replica is a drawing
  whatever it is labelled.
- ❌ **Drew a guide entry as a link out to the website** → ✅ reuse the app's own in-place
  guide drawer; an external link is a click that does nothing when the hand-off fails.

## Where a drawing lives

- **New drawings go in the board's own assets folder under the card's id**, referenced as
  `.assets/<id>/…`. `akb spec` prints the path; older cards' drawings elsewhere are still
  read, never written.
- **Read the app's own `design.md`** — `kanban-ui/design.md` for the board, `web/design.md`
  for the site — for every colour, shadow, radius and type choice.
- **A mockup file is one screen at the size the card page clips it to**, so a second frame
  stacked under the first is invisible. Where a card names two surfaces, give each its own
  file.

## What a screen may and may not do

- **A page must not pick for the user**: where two answers are both real, both are ghosts and
  the one that throws work away says so.
- **A new fact earns a new mark or nothing**: never overload a slot, and a mark with no tip
  says nothing.
- **A name the user types on this action lives in one box on that action**: the generated text
  beside it says "the same executor", never the name again — a name repeated in prose reads as
  one the config supplied.
- **A pane has no title of its own**: the sidebar already names it.
- **A box holding a value to copy hugs that value**, so the value and its copy button read as
  one thing. A path is truncated from the left; a path cut at the right end names nothing.
- **Saving reads at the caret, not in the corner**, and a start that is in flight swaps the
  pressed button's label rather than spinning.
- **No bulk retry over a list of failures**: each row is a different run to pick up.
- **A source is a type plus its own key/value pairs, never one free-text string**: one row
  shape draws every source.
- ❌ **Every item repeats its actions, timestamps and counts, under two stacked toolbars** → ✅
  actions appear only on the focused item; one control row, and only what the user acts on.
- ❌ **A form opened inside an item** → ✅ keep the item clean; the form opens outside it.
- ❌ **Borderless cards on a gray fill** → ✅ the user dislikes them; cards get a visible frame.

## Saying no, and saying nothing

- **A refusal is answered where it was pressed**, in the slot the thing would have filled and
  never floated over the words that control stands under. The page's own band is for what has
  no control to hang from.
- **A refusal listing agents draws each one's roster character**: an agent's name can be the
  same word as the step it failed on, and the character is what says which one is meant.
- **A refusal whose old slot was deleted moves onto whatever stands in for what failed**, at
  its foot.
- **Deleting a title row leaves two debts**: the window still needs a name and still needs its
  ✕, or a dialog opened on nothing cannot be closed.
- **An empty list drops its standing note and moves the one honest line to where the space
  is**: "select a run" beside an empty list is an instruction that cannot be followed.
- ❌ **Drew every state of a round-trip but the one after it succeeds** → ✅ the terminal
  action gets its own screen, and that screen's job is to say what did NOT happen.
- ❌ **Drew a waiting state holding only the ways to hand files in, while the failure state
  quoted a status nobody had anywhere to type** → ✅ every fact an entry collects gets its slot
  in one panel under one submit, and the "nothing was made, and where it stuck" path is drawn.

## Covering, cutting and fading

- **A cover stops short of the only way to act**: an overlay with no way off it is a screen
  you are stuck on. One way off in the pane's own head, one way back in the top row — never a
  second ✕ in a corner that already has one.
- **A confirmation must not bury what has to be read before the flip**: a thing gets the
  standing warning or the confirmation, never both.
- **A hover bubble must not land on a band's rule, or on the last item of a clipped row** —
  both read as a broken render.
- **Land a scroll cut through body text**, never through a caption, and fade the last band of
  a clipped panel into its own ground.
- **A scrolling row clips everything that hangs off it**: draw the row twice — the real one
  inside the scroller, and a hidden copy over it carrying the popover.
- **Reuse the board's own tooltip** rather than drawing a tooltip layer, and grow a long one
  from the control's left edge so it does not run off the window or behind a narrow pane's
  scroll clip.

## Characters and scenes

- **Characters differ by silhouette, pose and prop**: one figure repeated, or the same body
  with a swapped hat or a recolour, is sent back. A prop is one silhouette, not a scene.
- **The roster's characters are `kanban-ui/agent-art.md`'s**; an agent with no art file holds
  a lettered card, and inventing a prop for it draws art nobody ordered.
- **A sprite sheet is corrected against the base art, not redesigned**: keep the original
  proportions, limbs and shading, and change only what the sheet adds.
- ❌ **An activity scene crowded with large figures and permanent detail panes** → ✅ design
  the spatial layout, sprite scale and motion first, and open details in floating sidebars.
- ❌ **Scaling a fixed room by cramming in desks and keeping every finished worker on screen**
  → ✅ keep the room spacious, seat only the most recent successes, and draw the capacity and
  completion states before delivery.
- ❌ **Identity labels stacked under the figure** → ✅ role and harness above the head, the card
  id at the feet, checked against the shortest crop of the dialog.
- ❌ **A busy machine drawn as a lit still image** → ✅ supply a registered animation sprite
  sheet, keep the surrounding pixels fixed, and freeze on a working frame for reduced motion.
- ❌ **Scenery flattened while being lifted into its own layer** → ✅ keep the original
  silhouettes and shading, scale uniformly, and check the final displayed proportions.

## Chinese copy in a fixed width

- ❌ **Vague, childish phrasing about mistakes** → ✅ professional, accessible Chinese that
  names the issue, such as "需求理解偏差".
- **Measure a Chinese line before writing it**: written to the limit, a line orphans two or
  three characters — write to a few under.
- **The notification rows' event words stay English inside the Chinese window**, and a
  delivery id is never set in an uppercase heading — the ids are lowercase.
- ❌ **A one-line bar of facts drawn for the desktop only, on a surface the phone also opens**
  → ✅ draw the narrow state too: it wraps rather than clips, every fact drops to a line of its
  own, and nothing is dropped. A `·` between wrapping facts reads as a failed render, so
  separate by gap. Measure both widths — a Chinese bar of run facts needs about 740px, and the
  same bar on a phone gets about 343px.

## Figures and charts

- ❌ **A measured number and a reported claim drawn as the same kind of block** → ✅ a figure
  that links to its source is a raised, clickable tile; a figure that only has someone's word
  behind it sits on a deeper ground, unlinked, with one line naming who reported it.
- ❌ **A chart's average label laid inside the plot, and an outbound arrow set as a flex
  sibling of the link text** → ✅ both break at phone width: put the label on the chart's
  heading row as a legend, and the arrow inside the sentence so it follows the last word.
- **A series that keeps growing is a line, never bars**: a day is a point, so a bar goes from
  8px to invisible as the range grows. Keep every word outside the SVG so nothing distorts.
- **A figure whose argument is elsewhere spends no extra lines**: a new branch gets the line
  count the old one had, and its longest line stays no wider than the widest already there.
- **A UI crop is only worth a picture if its words survive the width it is shown at**: crop to
  the one block the sentence is about rather than showing a whole pane.
- ❌ **Annotation drawn only as a marked-up markdown passage** → ✅ a picture has no passages
  to select: open it with one whole-file note control beside it and one numbering running
  across both anchors.
- ❌ **A machine verdict stacked into the user's own note list** → ✅ separate them on ground,
  mark, anchor and affordance at once, and say what the verdict contributes to the next round
  at its own foot.

## Rendering a mockup

- **Preview before finishing**: render the entry to HTML with the folder's own renderer, then
  take the shot as a second command with the headless-shell binary. A layout that overflows
  its dialog is only caught in that shot; when no browser will start, render to HTML to prove
  the component runs and say the frame was never seen.
- **The renderer script is untracked and vanishes between sessions**: when it is gone, write
  it again from this recipe rather than reaching for a new approach, and read it first — it
  grows. It must sit in `kanban-ui/` and be run from there, because Node resolves its
  dependencies beside the script.
- **Art must be inline SVG**, because the sandbox has no scripts, network, fonts or images. A
  PNG travels only as a shrunk `data:` URI, and a native video or audio player is drawn from
  markup over a first frame rather than embedded.
- **Never add a CSS reset to the rendered page**: the built stylesheet already carries
  preflight, and an unlayered `*{margin:0}` beats every layered utility.
- **Set a tone with the utility class, never an inline `var()`**: only the variables the
  generated utilities use are emitted, so a token reached only inline comes out colourless. A
  copied class string has no `cn()` behind it either — copy a variant with its fill.
- **Screenshot one frame at a time** by exporting that component alone; a frame that takes
  props needs a wrapper export, or it quietly draws the empty variant.
- **Give a box a fixed height, never `flex-1`**, and give a copied pane `h-full` rather than
  the app's `min-h-full`: otherwise the caption lands behind the next block, or every `flex-1`
  collapses to content height and the dialog comes out empty below.
- **A pane taller than its dialog is drawn with a negative margin, never negative padding**:
  padding cannot go negative, so the drawing comes out unscrolled and nobody notices.
- **Prose dropped into a pane needs `min-w-0` on every box down to it**, or the paragraphs run
  out under the pane's edge, clipped mid-word.
- **An icon inside prose inherits the prose image frame**: an avatar in a card-body row needs
  its margin, border and size overridden.
- **Start a Configuration dialog from an existing dialog mockup's frame**: only the pane
  inside is the card's work, but the section list goes stale between releases — reread the
  sections and redraw the sidebar before touching the pane. A screen drawn inside a screen has
  no room for a scrim: draw it as a paper block over a list that still reads.
- **The Runs office backdrop is layers, not one picture**: place a desk frame and a bot frame
  at the layout's world coordinates, scaled by the dialog's camera factor — a drawer over the
  base alone shows an empty office beside a "running" strip.
- **An inherited art module carries only the agents that card drew**: every other roster row
  comes out as a lettered card, which reads as art nobody made. Inline the missing ones before
  drawing a roster.
- **A `web/` page is previewed through the same renderer**: keep the folder flat, copy the
  site's `globals.css` in, swap aliased imports for local copies, and replace browser hooks
  with fixed display state — then verify through the running board.
- **An email is drawn by running the product's own template**, patched for the copy, with
  images handed back as `data:` URIs; the images-off and plain-text states then come free.
  Hide images without placeholders or reserved height.
- **The board draws every mockup at 1280×800, so `max-sm:` never fires there**: a narrow
  screen hard-codes its stacked layout inside a 390px box, and a copied narrow dialog's
  `fixed` becomes `absolute`, or it spreads across the whole canvas.
- **Never bundle the board's own mockup library to preview with** — it shells out through the
  CLI and hangs.
- **An `.html` asset's `#` link resolves against the board page** and replaces the frame with
  it: put `<base href="about:srcdoc">` in its head, and in-page jumps, `:target` and
  `<details>` all work without scripts.
