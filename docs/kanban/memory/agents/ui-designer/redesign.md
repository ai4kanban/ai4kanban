# What `ui-design` was corrected on

## Before drawing

- ❌ **Drew a screen for a card that had already landed** → ✅ check the card is still in
  `todo/` first; mockups are discarded when the build starts, so drawing for an archived card
  is dead work.
- ❌ **Drew mockups for a change with no user interface in it** → ✅ reuse the existing screens
  and states, and draw only when the task needs a new interface decision.
- ❌ **A revised spec kept its outdated mockups** → ✅ reread the current design guide and
  refresh every affected screen, shared copy and card reference in the same revision.
- ❌ **Designed a second control for a job an existing one already does** → ✅ find the feature
  that already has that shape and reuse its components and interactions, changing only the
  copy and the actions.
- ❌ **Copied a sibling card's chrome without looking at it again** → ✅ siblings under one
  parent are drawn side by side, so reread the sibling's frame just before rendering — two
  versions of one page read as two products. A second tab of one page is that same page.
- ❌ **Invented the app's own words** → ✅ take every string from `kanban-ui/i18n/*/…`, and
  draw in the board's language. A delivery's pill and the line under it come from the CLI and
  stay English on a Chinese card page; only the chrome round them is translated.
- ❌ **Drew a whole 1280 frame the app never shows** → ✅ draw the frame the app really has:
  the board is cut at the paper's edge, a card page sits inside the rail and chat frame, and a
  dialog buries what is behind it rather than sitting beside it.
- ❌ **Split one moment into three screens** → ✅ before drawing three states, look for the
  single state where they co-exist.

- **The drawings live in `.akb/boards/docs/kanban/mockups/<card id>/`** — the board's own
  folder on the machine, gitignored. `akb spec` prints the path; older cards' drawings are
  still read from `docs/kanban/.mockups/`, which is not written to.
- **Read the app's own `design.md`**: `kanban-ui/design.md` for the board, `web/design.md` for
  the site. Colours, shadows, radii and type live there.
- **A mockup file is one screen at the size the card page clips it to**, so a second frame
  stacked under the first is invisible. Where a card names two surfaces, give each its own file.
- **A pane that overflows its dialog is drawn as a scrolled pane**, cut through body text —
  measure the groups against the dialog's real height before assuming they fit.

## Register

- **A new fact earns a new mark or nothing**: never overload a slot, and a mark with no tip
  says nothing.
- **One ember fill per row**: the move to press is ember, a second move that acts is the
  accent-deep ghost, a dismissal is the plain ink ghost.
- **A control inside a strip is a chip, not a block**: it acts rather than switching what you
  are looking at.
- **A band is the loudest thing on a page**, so it is for a state the user must act on;
  anything they may fix whenever they like is a quiet ghost in the top row.
- **Never a fourth tint on one surface**, and one dot carries two facts and no more — filled
  versus ring, and the hue.
- **A pane has no title of its own**: the sidebar already names it.
- **A box holding a value to copy hugs that value**, so the value and its copy button read as
  one thing.
- **A standing measure is not drawn in the app's loading shape**: an arc in a signal hue with
  a round cap reads as a spinner.
- **A source is a type plus its own key/value pairs, never one free-text string**: one row
  shape draws every source, and an item that named no type draws no source at all.
- **Reuse the board's own tooltip** rather than drawing a tooltip layer, hang it off a
  focusable element of its own, and grow a long one from the control's left edge so it does
  not run off the window.

## Saying no, and saying nothing

- **A refusal is answered where it was pressed**, in the slot the thing would have filled and
  never floated over the words that control stands under. The page's own band is for what has
  no control to hang from.
- **A refusal that fills a whole tile keeps the tile's ground**: a screen-sized alarm colour
  is read as an alarm.
- **Avoid redundant prompts**: where the controls already show the choice, add no explanatory
  refusal panel.
- **An empty list drops the standing note**, and a hint that is only sometimes true is drawn
  only then.
- **A page must not pick for the user**: where two answers are both real, both are ghosts and
  the one that throws work away says so.
- **No bulk retry over a list of failures**: each row is a different run to pick up.

## Covering, cutting and fading

- **A cover stops short of the only way to act**: an overlay with no way off it is a screen
  you are stuck on.
- **One way off, in the pane's own head; one way back, in the top row** — never a second ✕ in
  a corner that already has one.
- **A confirmation must not bury what has to be read before the flip**: a thing gets the
  standing warning or the confirmation, never both.
- **A hover bubble must not land on a band's rule, or on the last item of a clipped row** —
  both read as a broken render. Put what carries a tip where there is room above and beside it.
- **Land a scroll cut through body text**, never through a caption, and fade the last band of
  a clipped panel into its own ground.
- **A path is truncated from the left**: a path cut at the right end names nothing.
- **Saving reads at the caret, not in the corner.**

## Characters

- **Characters differ by silhouette, pose and prop**: one figure repeated, or the same body
  with a swapped hat or a recolour, is sent back.
- **The roster's characters are `kanban-ui/agent-art.md`'s**, one body and one prop each; an
  agent with no art file holds a lettered card, and inventing a prop for it draws art nobody
  ordered.
- **A prop is one silhouette, not a scene**: at roster size the figure is a few dozen pixels.
- **A sprite sheet is corrected against the base art, not redesigned**: keep the original
  proportions, limbs and shading, and change only what the sheet adds.

## Chinese copy in a fixed width

- ❌ **Vague, childish phrasing about mistakes** → ✅ professional, accessible Chinese that
  names the issue, such as "需求理解偏差".
- **Measure a Chinese line before writing it**: written to the limit, a line orphans two or
  three characters — write to a few under.
- **The notification rows' event words stay English inside the Chinese window.**
- **Never set a delivery id in an uppercase heading**: the ids are lowercase.

## The marketing editor

- **Overtype keeps the syntax marks in the line**, dimmed, with the text they mark styled. A
  fully rendered draft is the wrong drawing.
- **A heading there is bold, never bigger**: one size and one line height for every line, or
  the invisible textarea stops lining up.
- **A locked editor changes its ground, it does not dim its text.**
- **A selection raises a button, not an input**: a box that autofocuses eats the keystroke
  meant to replace the passage.
- **An IME composition is the OS's**: nothing of the app's may stand over it.

## Scenes and animation

- ❌ **An activity scene crowded with large figures and permanent detail panes** → ✅ design
  the spatial layout, sprite scale and motion first, and open details in floating sidebars.
- ❌ **Scaling a fixed room by cramming in desks and keeping every finished worker on screen**
  → ✅ keep the room spacious, allow paired desks, seat only the two most recent successes and
  let older ones leave — and draw the capacity and completion states before delivery.
- ❌ **Identity labels stacked under the figure** → ✅ role and harness above the head, the card
  id at the feet, checked against the shortest crop of the dialog.
- ❌ **A busy machine drawn as a lit still image** → ✅ supply a registered animation sprite
  sheet, keep the surrounding pixels fixed, and freeze on a working frame for reduced motion.
- ❌ **Scenery flattened while being lifted into its own layer** → ✅ keep the original
  silhouettes and shading, scale uniformly, and check the final displayed proportions rather
  than the source art alone.
- **Daylight is a fixed set of local-time views** — dawn, day, dusk, night — with no location,
  weather or seasonal input.

## Designing against the app that exists

- ❌ **A correct direction drawn as a simplified settings page** → ✅ preserve the current
  screen's complete layout and control sizes when adding a feature.
- ❌ **A spec drawn against a view the app no longer has** → ✅ inspect the current screen, its
  modes and its controls first.
- ❌ **Moving existing records and logs into new containers became a redesign** → ✅ reuse
  their components and visual structure, and change only their containers.
- ❌ **A mobile mockup drawn as a phone-width column on a desktop canvas** → ✅ use a real
  narrow viewport.
- ❌ **A CLI workflow maintained as an HTML screen** → ✅ keep terminal commands and output as
  a short fenced text block in the card; draw only actual visual surfaces.
- ❌ **Invented branding and hand-wrapped headlines** → ✅ use the real product logo, natural
  wrapping, and the supplied reference.
- **A start that is in flight swaps the pressed button's label, it does not spin**: a dot or
  an arc there is a control this app has not got.

## Rendering a mockup

- **Preview before finishing**: `kanban-ui/render-mockup.mjs` takes `<entry.tsx> <out.html>`,
  transpiles with `sucrase` (`typescript`, `jsx`, `imports`), runs the module in a `vm`, walks
  the folder's relative imports, compiles Tailwind from the folder's own `globals.css` with an
  awaited `compile()` and a `loadStylesheet` resolving `tailwindcss` to the package root, and
  screenshots headless Chrome at 2x. A layout that overflows its dialog is only caught here.
- **The script is untracked and vanishes between sessions**: when it is gone, write it again
  from this recipe rather than reaching for a new approach, and read it first — it grows.
- **It must sit in `kanban-ui/` and be run from there**, because Node resolves its
  dependencies beside the script.
- **Never add a CSS reset to the rendered page**: the built stylesheet already carries
  preflight, and an unlayered `*{margin:0}` beats every layered utility.
- **Set a tone with the utility class, never an inline `var()`**: Tailwind emits only the
  variables its generated utilities use, so a token reached only inline comes out colourless.
- **A copied class string has no `cn()` behind it**: copy a variant without its fill and add
  the caller's, or the stylesheet's order decides which wins.
- **Screenshot one frame at a time** by exporting that component alone; a frame that takes
  props needs a wrapper export, or it quietly draws the empty variant.
- **Art must be inline SVG**, because the sandbox has no scripts, network, fonts or images. A
  PNG travels only as a `data:` URI, shrunk first.
- **A scrolling row clips everything that hangs off it**: draw the row twice — the real one
  inside the scroller, and a hidden copy over it carrying the popover.
- **A browser that aborts needs `--single-process`**, on the Playwright headless-shell binary,
  which also prints the abort's reason. When no browser will start even then, add the frame up
  by hand, render to HTML to prove the component runs, and say the frame was never seen.
- **A `web/` page is previewed through the same renderer**: keep the folder flat, copy
  `web/app/globals.css` in and import it, swap aliased imports for local copies, and replace
  browser hooks with fixed display state — then verify through the running board, since a
  standalone renderer can hide failures in its React environment.
- **Start a Configuration dialog from an existing dialog mockup's frame**: the panel, its
  section list and the board behind it are already drawn; only the pane inside is the card's
  work.
- **A screen drawn inside a screen has no room for a scrim**: draw it as a paper block over a
  list that still reads.
- **Never bundle the board's own mockup library to preview with** — it shells out through the
  CLI and hangs.
