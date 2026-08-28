# The board's design

## Scope

This document defines the general visual and interaction rules for `kanban-ui/`.
Use `/design` to review the real tokens, components, states, and measured contrast
before changing the system. Keep that page in sync with `app/globals.css`.

The public site has its own rules in `web/design.md`. The two share ink, ember, hard
shadows, and physical interaction, but the board is denser and uses semantic pastels to
encode work state.

## Visual direction

The board is soft neo-brutalism: a warm cream ground, white paper blocks, faint neutral
insets, charcoal ink, hard offset shadows, and one ember accent. It should feel like a
tactile working tool—compact, legible, and responsive—without becoming visually noisy.

The ground stays warm rather than gray. Nothing uses pure black for text, and white is
reserved for paper surfaces.

## Color

All reusable colors are tokens in the `@theme` block of `app/globals.css`.

| Token | Value | Role |
| --- | --- | --- |
| `--color-nb-cream` | `#f7f7f4` | page ground |
| `--color-nb-canvas` | `#efeeeb` | the ground under a board of cards |
| `--color-nb-paper` | `#ffffff` | cards, dialogs, and controls |
| `--color-nb-sheet` | `#fbfaf7` | a card page's sections — cream's family, a rung lighter |
| `--color-nb-wash` | `#f4f3ef` | headers, insets, and quiet regions |
| `--color-nb-ink` | `#24231f` | text, outlines, and shadows |
| `--color-nb-ink-soft` | `#565550` | metadata, captions, and resting icons |
| `--color-nb-accent` | `#dd4f1e` | primary action and live activity |
| `--color-nb-accent-deep` | `#b83a12` | readable or pressed ember |
| `--color-nb-accent-soft` | `#f7ddce` | selected and active-state wash |
| `--color-nb-mint` / `-soft` / `-ink` | `#7fca9c` / `#e4f3ea` / `#2f6b46` | done or ready |
| `--color-nb-sky` / `-soft` / `-ink` | `#7fb4e0` / `#e6f1fb` / `#2c5c86` | neutral facts |
| `--color-nb-lilac` / `-soft` / `-ink` | `#b199e0` / `#efe9fb` / `#5a3f92` | grouping or schedules |
| `--color-nb-peach` / `-soft` / `-ink` | `#ec9a72` / `#fbe9dd` / `#8a4a28` | blockers, warnings, or risk |
| `--color-nb-accent-wash` | `#fbf0e9` | section ground: something to decide |
| `--color-nb-mint-wash` | `#eff8f2` | section ground: work already done |

- **Ration ember**: it marks the action to press or the activity happening now. It is
  not general decoration.
- **Use signals semantically**: mint, sky, lilac, and peach keep the same meaning across
  the board. Never choose one merely because it looks pleasing nearby.
- **Pair every signal**: use the soft value as a fill and its matching ink for readable
  text. Use the saturated value for small non-text shapes and progress marks.
- **Two fill strengths, one meaning**: `-soft` fills a chip or an alert — something you
  read off it. `-wash` is a whole section's ground, quiet enough to carry body text.
  Never use `-wash` for a chip or `-soft` for a section.
- **A neutral fill is a step of ink, not a colour**: a chip that means nothing in
  particular (`low`, no release, no cadence) fills with `ink 7%` over whatever is under
  it. An opaque near-wash fill vanishes on every ground but paper.
- **Prefer the neutral ramp**: cream, paper, and wash should carry ordinary hierarchy
  before color is introduced.
- **Do not rely on color alone**: pair state colors with text, an icon, a count, or
  position.

## Surfaces and hierarchy

A block uses a 1.5px ink outline, a rounded paper surface, and a hard `3px 3px 0` ink
shadow. Shadows never blur or change direction.

- **One elevation**: an object is either a raised block or a fill on the ground. Do not
  add intermediate shadows.
- **Flat inside raised**: use an outlined surface without a shadow for regions inside a
  larger block. Avoid blocks nested inside blocks.
- **Use wash for quiet structure**: headers, insets, empty regions, and supporting
  groups may use wash without gaining another outline or shadow.
- **Scale radii with the object**: large containers are rounder; controls and chips use
  progressively tighter radii. Keep related objects on the same radius rung.
- **Keep dividers quiet**: internal rules may use low-opacity ink when structure is
  already clear from the enclosing block.
- **Two hairline weights, both 1px**: ink at 12% for rules, dividers, and the frame of a
  quiet inset; ink at 25% for the frame of something you type in or press. A full-strength
  ink outline belongs to a raised block and nothing else.
- **A reading page is sections, not blocks**: on a long page you scroll and read — the
  card page — use `.nb-section`: 14px radius, no frame, no shadow, and a ground a clear
  step of ink off the page's. A stack of framed blocks reads as a stack of boxes, not as
  one page.
- **A reading page is white, and its sections lift off it**: the page sets `nb-paper` and
  every section is a light fill above it. Nothing is framed, so the ground is the whole of
  the hierarchy.
- **One ground, and colour only where a section MEANS something**: every section takes
  `nb-sheet` — the run log, the meta box, the subtasks, the delivery block, the body. The
  exceptions are `nb-mint-wash` for checks already done and `nb-accent-wash` for the one
  section holding a decision; peach `-soft` is an alert, a rung louder than either. A page
  that gives every block its own tint is a swatch sheet — the colours stop meaning anything.
- **Prose never sits on a signal**: a body ground is read through every line of it, so it
  stays in the warm neutral family. Signals are for the sections you glance at, not read.
- **The body is one section, both halves of it**: the longest prose on the page must not
  change ground halfway down. What parts a fold from what precedes it is its heading.
- **A well is a rung below its own chrome**: a log body under its title bar goes one step
  darker, never lighter and never paper — that step is what makes it read as recessed and
  what gives the block a bottom edge on the page.
- **Bands stacked together share their padding**: two sections one above the other are read
  as a run, so their kickers start on the same line.
- **Nothing inside a section draws ink**: rules between a section's chrome and its
  content are hairlines, and a row inside one lifts by lightening to paper rather than by
  throwing a hard shadow.

## Component styling

- **Buttons**: primary actions use ember; secondary actions use paper. Both keep the ink
  frame and hard shadow. Disabled buttons retain their resting shape but do not move.
  Risky actions use peach ink and should leave the visually safest exit clear.
- **Inputs and menus**: use paper, a hairline frame, and an ember focus outline — the
  focus ring, not the frame, is what has to be loud. The open dropdown panel floats free
  of its trigger, so it keeps the ink frame and hard shadow on every platform.
- **Small controls keep their ink**: a toggle, checkbox, or radio is too small to read as
  a shape from a hairline, so it keeps the full ink outline wherever it sits.
- **Chips and badges**: keep them compact, borderless, bold, and uppercase. Meaning
  comes from their semantic fill; avoid drawing a row of little framed boxes inside a
  card. Use only one marker for the same state.
- **Tabs and choices**: mark the active option once, with an ember underline, an ember
  frame, or a soft semantic fill. Inactive options use soft ink and strengthen on hover.
  A picker card's frame is the mark — do not also put a tinted plate behind its icon.
- **Dialogs and overlays**: place one raised paper block over a translucent ink scrim.
  Group the actions, support Escape and outside-click dismissal, and preserve a clear
  safe path.
- **A dialog is one block**: the panel's own frame is the only ink outline in it. The rule
  under the title bar is a hairline in every dialog, and so is every rule, inset, and
  control frame inside. Only an action keeps the button family's ink frame and hard
  shadow; a small button attached to a field — Save a key, Test the harness — is flat on
  the same hairline as the field it belongs to.
- **A dialog's sidebar sits on cream**: wash is for insets within a pane, not for the
  column beside it.
- **An inner window is a dialog one rung down**: a log or preview frame is a hairline, a
  paper title bar, a hairline under it, and a wash well below — the same shape wherever it
  is dropped, inside a dialog or on a page.
- **Tooltips**: use ink with cream text, appear on keyboard focus as well as hover, and
  explain icon-only or abbreviated controls in sentence case.

## Interaction and motion

- **Press physically**: a pressable block lifts 1px on hover as its shadow grows, then
  settles 1px on activation as the shadow collapses.
- **Keep transitions mechanical**: 120ms is the default. Open, close, fade, and slide
  motion should stay below roughly one third of a second.
- **Move what the user touched**: avoid ambient animation. A small pulse indicating live
  agent activity is the sole standing exception.
- **Use motion to preserve origin**: menus may settle from their triggers and sheets may
  enter from their attached edge; nothing should move without a spatial reason.
- **Respect reduced motion**: motion-enhanced states must remain understandable when
  animation is disabled.

## Typography

- **Use the system sans** throughout the application and monospace for logs, commands,
  identifiers, and tabular technical values.
- **Build hierarchy with weight**: 800 for major titles, 700 for labels and chips, 600
  for secondary controls, and 400 for prose.
- **Track by role**: titles may use slight negative tracking; uppercase labels use
  positive tracking.
- **Keep supporting type quiet**: metadata and captions use soft ink and must not rival
  the object they annotate.
- **Protect readability**: dense does not mean cramped. Keep comfortable line height,
  allow labels to wrap where needed, and do not shrink essential information to fit.

## Layout

- **Optimize for scanning**: align repeated metadata, use stable columns, and keep the
  main work item visually stronger than its annotations.
- **Group before framing**: use proximity and shared alignment before adding another
  surface.
- **Preserve control size**: responsive layouts may hide labels when an icon remains
  unambiguous, but tap targets must not shrink.
- **Remove secondary structure on narrow screens** when it would consume the working
  area; keep the primary task and actions intact.

## Accessibility

- Hold all normal text, including small chips, to 4.5:1 contrast. Non-text shapes need
  at least 3:1. Add every new foreground/background pair to `/design`.
- Keep visible focus states and full keyboard operation for controls, menus, dialogs,
  tabs, and tooltips.
- Give icon-only actions accessible names and do not make hover the only path to
  information.
- Pair progress and status graphics with readable text or values.
- Treat zoom, narrow windows, long labels, and reduced motion as standard states.

## Language

- **Every word the app renders lives in `i18n/`**: one folder per surface, one file per
  language inside it, and that folder's `types.ts` beside them. A component asks with
  `useCopy()`; a server component or `lib/` imports `copy` from `i18n/`. Nothing is written
  where it is drawn.
- **Write new copy in English first**: `<surface>/en.ts` is the source of truth, and its
  folder's `types.ts` is the shape every other language has to fill — a key a language
  hasn't translated fails `pnpm typecheck`.
- **Extract whole sentences, never grammar**: branch on count in the component and give each
  branch its own key. A sentence with a code chip or a bolded run in it stays one key, drawn
  with `<Rich>` (`i18n/rich.tsx`).
- **Names are not copy**: product names, file names, paths, track names, shell commands and
  URLs stay in the component, as do the words the board's own rules hand down.
- **Read it from context, never from a prop**: `useLanguage()` in
  `components/language.tsx` gives the language the app is drawing in. `app/layout.tsx`
  reads it on the server and provides it above every page, so a component has it in its
  first paint and no screen draws English and corrects itself.
- **Tag text in another language**: put `lang` on the element when its words are not the
  language the document is in — the switcher's own two entries are the standing example.
- **Leave the setting where it is**: the switcher lives in Configuration under the rule,
  with Cloud. Nothing else offers one.

## Styling rules

- Write Tailwind utilities next to markup by default.
- Put only truly shared primitives and tokens in `app/globals.css`; keep component rules
  with the component that owns them.
- Reuse the established surface, control, chip, and motion conventions before adding a
  new class.
- Add a token only for a stable board-wide role. Do not create one to solve a single
  composition.
- Keep `/design` representative: specimens should import production components and use
  production styles rather than reimplementing them for the showcase.
