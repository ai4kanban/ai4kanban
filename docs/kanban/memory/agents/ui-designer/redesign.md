# What `ui-design` was corrected on

## Before drawing

- ❌ **Drew a screen for a card that had already landed** → ✅ check the card is still in
  `todo/` first; mockups are discarded when the build starts, so drawing for an archived card
  is dead work.
- ❌ **Drew mockups for a change with no user interface in it** → ✅ draw only for an interface decision; discussion plan isolation belongs in write permissions, with no version controls.
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
- ❌ **Answered a card asking for 中英文 copy with one screen in the board's language** → ✅ the
  board's language rule governs one screen; a card that wants both languages wants each
  surface drawn twice, one file per language, or the English is never reviewed. Five states
  in two languages is ten entry files: put both languages' words and every state in one
  shared module, and let each entry be two lines naming a state and a language.
- ❌ **Sized a screen against the Chinese shot alone** → ✅ the same copy runs a quarter
  longer in English, so a pane that fits in 中文 clips in English — measure the English
  render, and trim the sample text until the last row of the longest state survives the cut.

- **The drawings live in `.akb/boards/docs/kanban/mockups/<card id>/`** — the board's own
  folder on the machine, gitignored. `akb spec` prints the path; older cards' drawings are
  still read from `docs/kanban/.mockups/`, which is not written to.
- **Read the app's own `design.md`**: `kanban-ui/design.md` for the board, `web/design.md` for
  the site. Colours, shadows, radii and type live there.
- **A mockup file is one screen at the size the card page clips it to**, so a second frame
  stacked under the first is invisible. Where a card names two surfaces, give each its own file.
- **A pane that overflows its dialog is drawn as a scrolled pane**, cut through body text —
  measure the groups against the dialog's real height before assuming they fit.
- **A figure whose argument is elsewhere spends no extra lines**: when a tree or diagram
  illustrates one branch of a claim, the new branch gets the line count the old one had, and
  its longest line stays no wider than the widest already in the picture — the tree scrolls
  sideways on a phone, so one extra character is a new failure to check.

## Register

- **A name the user types on this action lives in one box on that action**: the generated
  text beside it says "the same executor", never the name again — a name repeated in prose
  reads as one the config supplied. A box says it can be changed; the same name set as plain
  text says it cannot, and the foot names which round fixed it.
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
  not run off the window. A confirmation hung off a control in a narrow column is the same
  problem indoors: the panel is 320px and the Agents roster column is 292px, so anchoring it
  to the control's right edge puts its first words behind the pane's own scroll clip —
  anchor left and let it lie over the page.

## Saying no, and saying nothing

- **A refusal is answered where it was pressed**, in the slot the thing would have filled and
  never floated over the words that control stands under. The page's own band is for what has
  no control to hang from.
- **A refusal listing agents draws each one's roster character**: an agent's name can be the
  same word as the step it failed on, and the character is what says which one is meant.
- **A refusal that fills a whole tile keeps the tile's ground**: a screen-sized alarm colour
  is read as an alarm.
- **A refusal whose old slot was deleted moves onto whatever stands in for what failed**, at
  its foot — not into the bar that replaced the slot, which is already full.
- **Deleting a title row leaves two debts**: the window still needs a name and still needs its
  ✕. Give the replacement bar an empty form that carries both, or a dialog opened on nothing
  cannot be closed.
- **A standing note is dropped when its list is empty and moves to where the space is**:
  "select a run" beside an empty list is an instruction that cannot be followed, and the one
  honest line belongs in the big pane, not in the narrow column.
- **Avoid redundant prompts**: use accurate, brief, plain English; omit repeated labels and process explanations, preserve action consequences, and keep connector tiles to logo, name and action.
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
- **A one-line bar of Chinese facts needs ~740px**: name, step, time, run controls, outcome,
  ring, 耗时/费用/模型 and the window's own control leave under 150px for the name at 620 —
  it clips to five characters. Widen the window to the widest surface the same bar sits in.
- ❌ **A one-line bar drawn for the desktop only, on a surface the phone also opens** → ✅ that
  same bar is 343px on a phone, so draw the narrow state too: it wraps rather than clips —
  the name, the move on the run and the way off hold the first line, every fact drops to a
  line of its own, and the fact that wraps last is the one that changes line. Nothing is
  dropped. A `·` between wrapping facts lands at the start or the end of a broken line and
  reads as a failed render, so the wrapping form separates by gap instead.

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

- ❌ **An Agent subgroup sits among general settings and leaves Workflows outside** → ✅ separate general settings and agent work into two peer groups; keep Workflows, Workflow agents and Board agents together.

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
  awaited `compile()` and a `loadStylesheet` resolving `tailwindcss` to the package root. It
  writes HTML and stops there — the shot is a second command, the headless-shell binary with
  `--screenshot --force-device-scale-factor=2 --window-size=<frame+80>`. A layout that
  overflows its dialog is only caught in that shot.
- **The previewer has no `next/link`**, though the board's renderer does: draw an `#id` jump
  as a plain `<a className="nb-idlink">` and both run it.
- **The Runs office backdrop is layers, not one picture**: `public/run-scene/layers/`
  (`office-base.png` is the empty room; desks and bots are separate). A drawer drawn over the
  base alone shows an empty office beside a "N 个运行中" strip. Place a `desk-work` frame and
  one `bot-actions` frame at `layout.json`'s world coordinates, scaled by the dialog's
  `camera: cover` factor — see [[run-scene-geometry-by-static-mock]] for why `sips
  --cropOffset` is not how to cut them.
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
- **Give a box a fixed height, never `flex-1`**: on a page taller than its container the box
  keeps its `min-h` and the caption under it lands behind the next block — the line is in the
  HTML and invisible in the shot, which reads as a design that has no such line.
- **The headless-shell binary is at**
  `~/Library/Caches/ms-playwright/chromium_headless_shell-<n>/chrome-headless-shell-mac-arm64/chrome-headless-shell`
  — not under `chrome-mac/`, which is the full Chromium's layout.
- **A browser that aborts needs `--single-process`**, on the Playwright headless-shell binary,
  which also prints the abort's reason. When no browser will start even then, add the frame up
  by hand, render to HTML to prove the component runs, and say the frame was never seen.
- **A `web/` page is previewed through the same renderer**: keep the folder flat, copy
  `web/app/globals.css` in and import it, swap aliased imports for local copies, and replace
  browser hooks with fixed display state — then verify through the running board, since a
  standalone renderer can hide failures in its React environment.
- **Start a Configuration dialog from an existing dialog mockup's frame**: the panel, its
  section list and the board behind it are already drawn; only the pane inside is the card's
  work. The section list is the part that goes stale — sections are regrouped and renamed
  between releases — so read `SECTIONS` and `i18n/configuration/*` and redraw the sidebar and
  the roster beside it before touching the pane.
- **A screen drawn inside a screen has no room for a scrim**: draw it as a paper block over a
  list that still reads.
- **Never bundle the board's own mockup library to preview with** — it shells out through the
  CLI and hangs.
- **An email is drawn by running the product's own template**: copy `scripts/newsletter/
  template.mjs` into the mockup folder, patch the copy, render the issue with a `resolveImage`
  that hands back `data:` URIs, and write the `.html` products out — the images-off and
  plain-text states come from `withoutImages`/`renderText` for free.
- **A UI crop is only worth a picture if its words survive the width it is shown at**: an
  email figure lands at 552px, so a whole pane's table comes out as grey lines — crop to the
  one block the sentence is about.

- ❌ **Repeated the pixel office and sold its UI details as value** → ✅ show it once, call Runs an office, and use accurate headings and concrete user benefits in every newsletter state; introduce selected highlights without leading with their count.

- ❌ **Redesign a child card as one extra agent row without reading the parent and research** → ✅ design the full card-type flow and stage assignments first; the agent page must express that model.

- ❌ **Show types, presets and every stage configuration before the user can start** → ✅ lead with a ready-to-use workflow, one selected horizontal step tab and progressive settings; draw every secondary entry the design introduces.

- ❌ **A mockup shows controls without their states or entry paths** → ✅ retain the workflow rail even for one item; create and duplicate inline, protect marked built-ins, and use compact helper tiles; helpers are on request and expose only the selected helper’s extra requirements.

- ❌ **Give inline naming a miniature form and lone controls decorative panels** → ✅ save names on blur, discard empty new rows immediately, omit confirm/cancel buttons, and remove wrappers or explanatory copy that add no useful choice.

- ❌ **An Add agent beside the lead implies multiple owners and hides registration inside assignment** → ✅ keep one Select agent control, create reusable agents in Workflow agents, draw creation through return, and keep only local assignment settings in the workflow.

- ❌ **Repeat a field for an unnamed scope or the same toggle in list and detail** → ✅ bind extra requirements to the selected helper only, and keep each enable switch in one place.

- ❌ **Label a mockup summary as the agent’s built-in instructions** → ✅ omit the instruction viewer for built-in agents; show their purpose, runtime and user-added requirements.
- ❌ **Split one agent instruction into Purpose, Input and Deliverable fields** → ✅ use one Instructions field; show the actual editable file path after saving.

- ❌ **Unrelated screenshots labelled as the feature being described** → ✅ inspect each image, use the actual corresponding UI, and regenerate images-off and plain text from the corrected image descriptions.

- ❌ **An email drawn as one hero picture with some highlights illustrated and others bare** → ✅ drop the hero and give every highlight its own crop, so no screen appears twice and the rhythm holds down the letter.

- ❌ **Designed dist0 token forms and fetch results as source settings** → ✅ draw one grid card per connector, put shared status and logs in the board sidebar, and leave collection controls to the collection agent.

- ❌ **Rebuilt a screen as a static lookalike to fill a figure a card asked to photograph** → ✅ when the card wants a capture, run the real surface and shoot it — `screenshots/` first, then the page itself; a replica is a drawing whatever it is labelled.

- ❌ **Images-off previews replace pictures with bulky alt-text panels** → ✅ hide images without placeholders or reserved height; retain alt attributes in the normal email.

- ❌ **Drew every state of a round-trip but the one after it succeeds** → ✅ the terminal
  action gets its own screen, and that screen's job is to say what did NOT happen — nothing
  archived, no stage advanced, the artifact still where it was.
- ❌ **Marked which round left each file, and let the row's summary collide with the chips**
  → ✅ a per-item mark costs the row its trailing summary: move the status down to a second
  line under the chips, beside what is left over. Naming the stale files beats counting them.
- ❌ **Drew a waiting state holding only the ways to hand files in, while the failure state quoted a status nobody had anywhere to type** → ✅ every fact an entry collects gets its slot in that one panel under one submit, and the "nothing was made, and where it stuck" path is drawn rather than implied by the failure screen downstream.

- ❌ **A machine verdict stacked into the user's own note list** → ✅ separate them on four axes at once — ground, mark, anchor and affordance: read-only ✓/✕ lines against the brief's criteria on the sheet, numbered cards against a quotation with edit and delete on the wash. What the verdict contributes to the next round is said at its own foot, not doubled onto the button.

- ❌ **Annotation drawn only as a marked-up markdown passage** → ✅ a picture has no passages to select: open it with one whole-file note control beside it and that note's number on its corner, and let one numbering run across both anchors in the list below.

- ❌ **A handoff drawn as a file browser: contract checks, per-round file lists, previews and annotation, twenty-two screens nobody could learn** → ✅ a paths box and a status line; when the card's mechanism itself is in question, draw nothing until it settles. It settled to one `akb:` key, and the whole design was then one READ-ONLY row: an added agent's page already holds its entire `AGENT.md`, so a new key needs no field — the only question left is where its meaning is said, and that is beside the setting the meaning depends on. A key the connector reinterprets goes under 运行时, in the same help slot `unknownHarness` already uses.

- ❌ **A chart's average label laid inside the plot, and an outbound arrow set as a flex sibling of the link text** → ✅ both break at phone width: the label lands on the curve, and a source that wraps strands the arrow at the right edge. Put the label on the chart's heading row as a legend — dashed swatch, then the words — and put the arrow inside the sentence so it follows the last word.

- ❌ **A measured number and a reported claim drawn as the same kind of block** → ✅ a figure that links to its source is a raised, clickable tile; a figure that only has someone's word behind it sits on the deeper `code` ground, unlinked, with one line naming who reported it. Same paragraph, two grounds — or the claim inherits the proof's credibility for free.

- **A series that keeps growing is a line, never bars**: a day is a point, so 66 days and 400 days are the same picture at different densities, while a bar goes from 8px to invisible. Stretch the curve with `preserveAspectRatio="none"` and `vector-effect="non-scaling-stroke"`, and keep every word outside the SVG so nothing distorts with it.
