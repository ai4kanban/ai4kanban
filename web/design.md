# The site's design

## Scope

This document defines the general visual rules for the public site in `web/`.
`kanban-ui/` is a separate app, although both use the same ink and ember so they feel
like one product.

Use `/design` to review the tokens and their measured contrast before changing the
palette. Keep that page in sync with the values in `web/app/globals.css`.

## Visual direction

The site is neo-brutalism on white paper: an open white page, sparse warm section
bands, hard offset shadows in a warm near-black ink, and one ember accent. The result
should feel tactile, direct, and deliberate rather than polished into a generic grid
of cards.

Keep that character concentrated: a borderless composition with one small outlined,
hard-shadowed control feels more neo-brutalist than a page where every region is
boxed. Use the brutalist element as punctuation around the action or active choice,
not as a container around all content.

Use empty space and neutral grounds to establish hierarchy. Warm bands, color,
outlines, and shadows are stronger signals and should remain scarce. White should hold
at least half of any screen; a page carrying one fill end to end reads dim whichever
fill it is, and the warm is worth something only where it is rare.

## Color

All reusable colors are tokens in the `@theme` block of `web/app/globals.css`.

| Token | Value | Role |
| --- | --- | --- |
| `--color-bg` | `#ffffff` | open page ground |
| `--color-band` | `#f8f5ef` | occasional warm section band |
| `--color-elev` | `#ffffff` | paper surface |
| `--color-code` | `#f0ebe1` | inset wash |
| `--color-border` | `#24231f` | outlines and hard shadows |
| `--color-ink` | `#24231f` | primary text |
| `--color-muted` | `#635a4e` | secondary text |
| `--color-accent` | `#dd4f1e` | the ember at rest — fills, shapes, glyphs |
| `--color-accent-deep` | `#b83a12` | the pressed ember, and the ember as text |
| `--color-growth` | `#2f6b46` | positive comparison signal |
| `--color-caution` | `#9e1b45` | negative comparison signal |

- **Keep the page open**: `bg` and `elev` are both white. A paper block is identified
  by its shadow or outline, not by a different white.
- **Use warm bands sparingly**: reserve `band` for a few full-width sections. Warmth
  works because it does not cover the whole page.
- **Use wash for insets**: `code` is the neutral step that lets a block sink into white.
  These neutral grounds should carry most hierarchy before color is introduced.
- **Treat ember as an object**: use it for fills, bars, marks, and other deliberate
  shapes, never as a page or general panel color. Do not introduce ember tints. A
  large ember area is allowed only where it *is* the action — the download hero's
  right half is a button scaled up, which is also why nothing small enough to need
  4.5:1 goes on it.
- **Rest on `accent`, press to `accent-deep`**: this is the board's order and it is not
  reversible. `accent-deep` is a state and a text color, never a default fill. A page
  that reaches for it first comes out brick-dark, which is the mood the washes exist to
  avoid.
- **Choose ember by contrast**: a shape or a glyph takes `accent` at the 3:1 bar.
  Anything read as prose — a chip's word, an eyebrow, a link — takes `accent-deep`.
  `accent-deep` is already as bright as 4.5:1 on the `code` wash allows, so there is no
  brighter readable ember to reach for.
- **Keep signals semantic**: growth and caution are reserved for comparison outcomes.
  They are not secondary brand accents.
- **Keep artwork colors out of the token set**: illustration-only pigments may vary,
  but must not carry text or become reusable interface colors.

## Surfaces and hierarchy

A **band** is not a surface, it is a ground: `band` filling one full-width section, with
no outline and no shadow, so panels sit on it exactly as they sit on the page. Give one
to a section that needs paper to read as paper, or to the closing section of a page. Two
or three on a page is the ceiling — past that the page is warm again.

- **Dissolve a band's edges, never rule them**: the tone arrives over a strip of pixels
  (`Band.tsx`) rather than starting on a line. A rule across the page says a boundary
  matters, and this one does not; a CSS gradient would be the only soft edge on a site
  made of hard shadows.
- **Let a hard edge stand on its own**: a band running into the ink footer needs no
  dissolve, because the footer is already the sharpest edge on the site.

A surface is either **raised** or **bare**. There is no faintly bordered middle state.

- **Raised**: paper or wash with `rounded-xl` and a hard `4px 4px 0` ink shadow. Use for
  an object that should stand apart from the page, such as the main panel in a section.
- **Bare**: paper or wash with no shadow or border. Use for parts of a composite, rows,
  tiles, artwork, and supporting regions.
- **Outlined**: add a full 2px ink outline only when an interactive target needs a clear
  edge or one raised surface must outrank its peers. Outlines stay ink in every state.
- **No nesting**: do not place raised or outlined blocks inside another raised block.
  Separate internal regions with spacing, neutral grounds, or necessary structural
  rules.
- **Match surface to ground**: paper separates from a band or wash; wash separates from
  white. Paper on the white page needs a shadow or outline to become a block.
- **Scale the signal**: large areas can be separated by fill alone. Small controls may
  need the ink outline because the neutral difference is too subtle at that size.

Shadows identify important objects. If everything casts one, nothing has priority. A
screen should contain only a handful of raised surfaces.

- **Spend brutalism where it has to be noticed**: the hard shadow and the ink outline are
  the loudest marks the theme owns, and they belong to what the reader must act on —
  buttons first, then the one panel a section is built around. Most components are
  neither; default them to bare, and let a wash step, spacing, and type carry them.
  Weight put on a block nobody clicks is weight the real action no longer has.

## Component styling

Follow the same general component grammar as the board, adapted to the site's tokens
and surface weights.

- **Buttons**: primary actions use ember, secondary actions use paper, and the header's
  Download reverses the paper block to ink so the chrome gains a solid CTA without a
  third hue. All keep a clear ink frame and hard shadow; disabled actions keep their
  resting shape but do not lift or press. Risky actions use their semantic signal
  instead of competing with the primary ember action.
- **Inputs and menus**: use paper, an ink frame, comfortable padding, and an ember focus
  outline. Popovers and option lists should look like part of the same system rather
  than a platform-default control.
- **Chips and badges**: keep them compact. Use outlined paper for a neutral label or a
  full-strength semantic fill with readable text; avoid tinted fills and show only one
  marker for a given state.
- **Tabs and choices**: indicate the active option once—with an ember underline or a
  clear step on the neutral ramp. Inactive options use muted ink and strengthen on
  hover.
- **Dialogs and overlays**: use one raised paper surface over an ink scrim. Separate the
  title structurally, keep actions together, and make the safe way out visually clear.
- **Tooltips**: use inverted ink and paper, appear on keyboard focus as well as hover,
  and explain rather than repeat the trigger label.

## Interaction and motion

- **Hover by lifting**: move an interactive raised object slightly up and left and grow
  its shadow to `6px 6px 0`. Do not recolor its outline.
- **Keep motion purposeful**: animation should explain a diagram, confirm interaction,
  or introduce a block as one unit. Avoid ambient movement competing with the copy.
- **Use one clock per idea**: parts of a single diagram may differ in delay, but should
  share a period so the sequence cannot drift.
- **Design the resting state first**: every illustration and interaction must remain
  understandable without animation.
- **Respect reduced motion**: enable motion only when `prefers-reduced-motion` is
  `no-preference`; the default styles should already describe the finished state.
- **Avoid property conflicts**: do not animate a property already controlled by another
  state, and match the CSS property used by the resting style.

## Illustration

Illustrations may use a broader palette than the interface when they remain clearly
artwork and never carry readable content on pigment.

- **Mount artwork; do not turn it into the page**: colorful grounds act as mats behind
  a print, with enough unpainted space for the subject to remain legible.
- **Paint a mat on `band`, not on white**: the prints are white, so a white mat has
  neither an outer edge on a white page nor anything for the print to sit against. This
  is the site's other use of the warm tone.
- **Keep artwork visually separate from UI chrome**: illustration colors do not become
  panel fills, borders, or text colors.
- **Open a bandless section with the pixel mark**: `PixelMark.tsx` is the band's texture
  at section scale — wash cells and one ember. Use it where a section needs a head but
  the page has no warmth left to spend on another band.
- **Prefer still clarity**: an illustration must communicate the same idea in its static
  state. Motion can reinforce the argument, not supply it.
- **Use consistent visual grammar**: repeated diagrams should use the same node, line,
  label, and signal conventions.

## Typography

- **Sans by default**: Inter is the primary face for headings and body copy, with the
  system stack as fallback.
- **Mono for functional text**: use the monospace stack for code, terminals, and short
  eyebrow labels, not for ordinary prose.
- **Keep CJK lightweight**: let the system stack render Chinese and Japanese rather than
  adding large web-font downloads.
- **Build hierarchy with scale and weight**: color should not be needed to distinguish a
  heading from its supporting copy.
- **Plan for translation**: allow labels to wrap, avoid fixed text heights, and test
  narrow layouts with long words and CJK text.

## Layout and spacing

- **Use a consistent content column**: all page content stays within the shared maximum
  width. A band is the one thing that runs full-viewport, and its content stays in the
  column like everything else.
- **Let whitespace group content**: prefer spacing over extra boxes, borders, and
  dividers.
- **Keep page openings generous**: the first content block needs a clear band of air
  below the header, larger than an ordinary section gap.
- **Reflow by default**: responsive layouts should reflow their content. Scale a whole
  illustration only when its proportions are essential to the meaning.
- **Make lines decisive**: when a rule is necessary, use the system's full ink weight.
  Do not introduce faint gray dividers.

## Accessibility

- Keep normal text at or above 4.5:1 contrast and large graphical shapes at or above
  3:1. Verify new token pairs on `/design`.
- One pair is knowingly short, and it is the only one: the paper label on the primary
  button's resting ember, at 4.03:1. It rests on the ember the board's own primary
  action rests on; the readable cut made the site's largest area of color brick-dark.
  The button is bold, outlined, and shadowed, and color is never its only marker. Do not
  read this as licence for a second exception — take a new short pair to `/design` and
  fix the design instead.
- Never use color as the only indication of state, meaning, or interactivity.
- Preserve visible focus styles and clear interactive boundaries.
- Keep readable text off decorative pigment and other unpredictable backgrounds.
- Treat reduced motion, keyboard navigation, zoom, and translated copy as core design
  states rather than exceptions.

## Page copy

The words every page renders live in `i18n/<page>/<locale>.ts`; English is the source
the other four languages follow (`i18n/index.ts`).

- **Keep the Markdown mirrors in step with the copy**: a change to the landing copy in
  `i18n/home/` is not finished until `public/index.md` says the same thing, and
  `public/llms.txt` — the site's description and the home entry's title and summary —
  matches the new mirror. The mirrors are what AI crawlers read instead of the page, so
  a stale one describes a site we no longer have.
- **Mirror the page, don't extend it**: a mirror carries the page's sections, in the
  page's order, in plain Markdown. Content the page dropped is dropped here too.
- **Mirrors stay English**: they are not translated.

## Styling rules

- Write Tailwind utilities next to the markup by default.
- Put only widely reused visual primitives in shared style exports.
- Keep `web/app/globals.css` limited to tokens, font declarations, and true global
  document defaults; do not add component classes there.
- Use scoped styles only when generated content provides no markup on which to place
  utilities.
- Reuse the existing tokens and primitives before adding a new visual rule. A new token
  should describe a site-wide role, not solve one local composition.
