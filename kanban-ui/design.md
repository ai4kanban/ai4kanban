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
| `--color-nb-paper` | `#ffffff` | cards, dialogs, and controls |
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

- **Ration ember**: it marks the action to press or the activity happening now. It is
  not general decoration.
- **Use signals semantically**: mint, sky, lilac, and peach keep the same meaning across
  the board. Never choose one merely because it looks pleasing nearby.
- **Pair every signal**: use the soft value as a fill and its matching ink for readable
  text. Use the saturated value for small non-text shapes and progress marks.
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

## Component styling

- **Buttons**: primary actions use ember; secondary actions use paper. Both keep the ink
  frame and hard shadow. Disabled buttons retain their resting shape but do not move.
  Risky actions use peach ink and should leave the visually safest exit clear.
- **Inputs and menus**: use paper, a 1.5px ink frame, and an ember focus outline.
  Dropdown panels follow the same paper-and-ink language on every platform.
- **Chips and badges**: keep them compact, borderless, bold, and uppercase. Meaning
  comes from their semantic fill; avoid drawing a row of little framed boxes inside a
  card. Use only one marker for the same state.
- **Tabs and choices**: mark the active option once, with an ember underline or soft
  semantic fill. Inactive options use soft ink and strengthen on hover.
- **Dialogs and overlays**: place one raised paper block over a translucent ink scrim.
  Group the actions, support Escape and outside-click dismissal, and preserve a clear
  safe path.
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
