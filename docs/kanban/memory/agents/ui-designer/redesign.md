# What `ui-design` was corrected on

## Before drawing

- **Read the app's own `design.md`**: `kanban-ui/design.md` for the board, `web/design.md`
  for the public site. Colours, shadows, radii, hairlines and type live there — restating
  them here only goes stale.
- **Reuse a sibling card's `.mockups/` instead of drawing the page again**: siblings under
  one parent are drawn side by side, so look again just before rendering. Two versions of
  one page read as two products, not two moments.
- **Draw in Chinese, in the board's own words**: take them from `kanban-ui/i18n/*/zh.ts`.
  Invented copy is sent back.
- **A mockup file is ONE 1280 × 800 screen**: the card page draws it in an iframe clipped to
  exactly that, so a second frame stacked under the first is invisible. Where a card names
  two surfaces, pick the one whose layout is actually new and let the copy-only one follow
  the pattern it copies.
- **The runs panel is not a panel beside the board, it BURIES it**: 1040 × 760 over a 42%
  ink scrim at 1280 × 800 leaves 120px of dimmed rail at each edge. Anything that happens
  to the rail while that panel opens has to be said inside the panel, because the rail is
  not what the user is looking at.
- **Draw the frame the app really has**: the board's three columns are cut at the paper's
  edge at 1280, and a card page is drawn inside the rail + chat frame, never the whole
  1280. A drawing that fits everything in is a drawing of a different app.

## Register

- **A new fact earns a new mark or nothing**: never overload a slot, and a mark with no
  `nb-tip` says nothing.
- **One ember fill per row**: the move to press is ember, a second move that acts is the
  accent-deep ghost, a dismissal is the plain ink ghost. Two fills is two things shouting.
- **A tinted ghost keeps its INK shadow**: callers override colour and border only, so an
  accent-deep drop shadow is a shape the app has not got.
- **A control inside a strip is a chip, not a block**: it acts rather than switching what
  you are looking at. The ember block is for the strip's terminal move.
- **A band is the loudest thing on a page**, so it is for a state the user must act on.
  Anything they may fix whenever they like is a quiet ghost in the top row instead.
- **A fill that must read on paper AND on a card's sheet goes one step darker**, never a
  grey plate.
- **Never a fourth tint on one surface**: the editor's live selection, its held passage and
  a commented line are three tints of one hue, and that is the whole vocabulary.
- **One dot carries two facts and no more** — filled versus ring, and the hue. A second
  shape for the same state reads as a second state.
- **A pane has no title of its own**: the sidebar already names it, and the captions are
  the whole of the structure.
- **A source is a type plus its own key/value pairs, never one free-text string**: draw the
  type's mark and name from one table, then the values it carries. Never a row shape per
  connector, and nothing at all where the item named no type.

## Saying no, and saying nothing

- **A refusal goes in the slot the thing would have filled**, on peach-soft — never on the
  hint line. Peach above a box is for a state that persists; inside it, for the keystroke
  that just failed.
- **A refused move is answered where it was pressed**, in the confirmation-popover shape
  hung off that control. The page's peach band is for what has no control to hang from.
- **A refusal says the block and the way out, and nothing the screen already says.**
- **An empty list drops the standing note**: the empty panel's own line already says what
  would be there, and both together read as the same sentence twice.
- **A hint that is only true sometimes is drawn only then**: the chat's hint line exists
  while a reply is coming, so an idle box has nothing beneath it.
- **Dead space under the last reply is a state the rail is never in** — the transcript sits
  scrolled to its foot.
- **A page must not pick for the user**: where two answers are both real, both are ghosts
  and the one that throws work away says so in its body line.
- **No bulk retry over a list of failures**: each row is a different run to pick up.

## Covering, cutting and fading

- **A cover stops short of the only way to act**: a cover with no way off it is a screen
  you are stuck on, so an overlay ends at the composer's top edge.
- **One way off, in the pane's own head; one way back, in the top row.** Where a sheet's
  close ✕ already sits in that corner, a second ✕ is unreadable — use a labelled toggle.
- **A hover bubble must not land on a band's rule**: a tip drawn above the FIRST card of a
  module band covers that band's caption and hairline and reads as a broken render — hang it
  off a card that has another card above it.
- **Land a scroll cut through body text**, never through an 11px caption: sliced caption
  text reads as a broken render, a sliced character does not.
- **Text sliced flat at a panel's foot reads as a bug**: fade the last ~56px into the
  panel's own ground.
- **A cut frame needs real markup**: pull the column up with a negative margin inside the
  paper's `overflow-hidden`, and set bold with a `font-[700]` span — a literal `**…**` in a
  mockup's body reads as a broken renderer.
- **A path is truncated from the LEFT**: every plan sits in one folder, so a path cut at
  the right end names nothing.
- **Saving reads at the caret, not in the corner**: the chip rides the writing column's
  right end on the caret's own line.

## Characters

- **Characters differ by silhouette, pose and prop**: one figure repeated in every tile was
  rejected outright, and the same body with a swapped hat or a recolour does not pass either.
- **The agent roster's characters are `kanban-ui/agent-art.md`'s**: one body, one prop each.
  Recolouring the body instead does not read as a roster.
- **An agent with no `public/agent-art/<name>.png` holds a card with its initial**, in an ink
  picked from its name — that is what ships, so inventing a prop for it draws art nobody
  ordered.
- **A prop is one silhouette, not a scene**: at 48px the character is ~24px of chest, so
  cut detail until a single outline is left.

## Chinese copy in a fixed width

- **Measure a Chinese line before writing it**: ~500px holds ~40 CJK characters and a 320px
  popover ~24 at 12px. Written to the limit, a line orphans two or three characters — write
  to a few under.
- **The notification rows' event words are English inside the Chinese window**, and are
  never translated. Only the chrome around them is Chinese.
- **Never set a delivery id in an uppercase heading**: the ids are lowercase 8 characters
  from an alphabet with no look-alikes.

## The marketing editor

- **overtype keeps the syntax marks in the line**, dimmed, with the text they mark styled.
  A fully rendered draft with the marks gone is the wrong drawing.
- **A heading there is BOLD, never bigger**: one size and one line height for every line,
  or the invisible textarea stops lining up.
- **A locked editor changes its ground, it does not dim its text**: fading the draft takes
  the already-quiet syntax markers with it.
- **A progress line is inset into the writing column**: run full-bleed it butts against the
  tab strip and reads as a second, wrongly-placed tab underline.
- **A selection raises a BUTTON, not an input**: a box that autofocuses on a selection eats
  the keystroke that was meant to replace the passage.
- **An IME composition is the OS's**: nothing of the app's may stand over it, and the
  candidate bar is drawn as system chrome rather than as a neo-brutalist block.

## Rendering a mockup

- **Preview before finishing**: transpile the `.tsx` with `sucrase`, run it in a `vm` whose
  only global is `React`, render with `react-dom/server`, build the CSS with tailwind's
  `compile()` over the markup's classes, then screenshot headless Chrome at 1280 × 800 with
  `--force-device-scale-factor=2`. A layout that overflows its dialog is only caught here.
- **`kanban-ui/render-mockup.mjs` is untracked and gets deleted between sessions**: when it
  is gone, write it again from this recipe rather than reaching for a new approach.
- **Triage needs order as well as capacity**: repeated heavy card frames look crowded and scattered; use date groups, aligned rows and quiet separators, keep Add on demand, and drop arbitrary first-screen item quotas.
- **The render script must SIT in `kanban-ui/` and be RUN from there**: Node looks beside
  the script, so one in `/tmp` cannot resolve `sucrase`, `tailwindcss` or `react-dom/server`.
- **Give sucrase the `imports` transform too** (`['typescript', 'jsx', 'imports']`), or the
  leftover `export` is a syntax error in the sandbox. It writes to `exports`, so the sandbox's
  `module.exports` and `exports` must be ONE object — two objects, and the default export
  comes back `undefined` as "Element type is invalid".
- **`compile()` is async and will not read a stylesheet for you**: `compiler.build is not a
  function` means a missing `await`, and `@import "tailwindcss"` throws until the call is
  handed a `loadStylesheet`. That loader resolves `tailwindcss` to
  `node_modules/tailwindcss/index.css` — the package root, never `dist/`.
- **Never add a CSS reset to the rendered page**: the built stylesheet already carries
  preflight, and an unlayered `*{margin:0}` beats every layered utility.
- **Screenshot one frame at a time**: append `module.exports.<Name> = <Name>` and render
  that component alone. Cropping through an `<iframe>` shoots blank — a `file://` frame
  inside a `data:` page is blocked.
- **A frame that takes props needs a wrapper export**, not a bare one: rendering the
  component name alone hands it `undefined` props and quietly draws the empty variant.
- **Only plain Tailwind is compiled**: the board's `nb-*` tokens do not exist there, so
  declare the palette as hex constants and pass colours through `style={{}}`.
- **Art must be inline SVG**: the sandbox has no scripts, network, fonts or images, so an
  `<img src="/…">` draws nothing and an emoji lands as tofu. The harness logos are paths in
  `public/agents/*.svg`; the channel marks come out of `react-icons` through
  `react-dom/server`.
- **A scrolling row clips everything that hangs off it**: draw the row twice — the real one
  inside the scroller, and a hidden copy over it carrying the popover — rather than guessing
  an anchor's `left`.
- **When no browser will start, measure instead of guessing**: add the frame up by hand,
  render to HTML anyway to prove the component runs, and say in the report that the frame
  was never seen.
- **整理记忆看起来像链接项，周期像必选项**：改为明确的 CTA，进入 Configurations → Agent → Memory Pruner；用户开启定期整理后才显示周期设置。
- **Correct direction can still be misleading UI**: preserve the current screen’s complete layout and control sizes when adding a feature; do not replace it with a simplified settings page.
- **定期整理独占一行太丑**：收成「立即整理」旁的小控件，点击才展开周期设置。
- **Attachment designs used an obsolete Create task view**: inspect the current composer and per-mode runtime controls before drawing the attachment.
