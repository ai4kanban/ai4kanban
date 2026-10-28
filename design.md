# WildCrane design

## Scope

One system for every new WildCrane surface: the web app, the card review page and its
share links, the landing site, and the Runner's menu bar panel and notifications. Record only
what a reviewed screen uses; add a component here the first time one ships.

The reference screens are the task list, the card review page and the landing hero
drawn for #2024. Where an older mockup disagrees with them, they win.

## Visual direction

Soft neo-brutalism: a warm cream ground, white paper blocks, charcoal ink outlines, hard
offset shadows and one ember accent. It should feel like a tactile, calm working tool — the
user's work is the loudest thing on screen, never the chrome.

- **Light only**: there is no dark theme yet. Do not add `dark:` styles.
- **The Runner follows the system**: see [Runner](#runner).

## Logo

The files live in `brand/`. Use them; never redraw or recolour the mark.

| File | Use |
| --- | --- |
| `logo.svg` | crane + wordmark, ink on light grounds |
| `logo-dark.svg` | the same for dark media outside the app (slides, video) |
| `logo-mark.svg`, `crane-glyph.svg` | the crane alone |
| `favicon.svg` / `favicon.ico` | browser tab, simplified for 16px |
| `desktop-icon.*` | the Runner's app icon and its notifications |
| `apple-touch-icon.png`, `web-app-manifest-*.png` | home-screen icons |

- **Colour**: the crane and the name take ink; only the crest is ember.
- **Crane + wordmark** where nothing else names the app: the app's top bar and the landing
  header. The wordmark's capitals stand as tall as the nav text beside it; the crane keeps
  its own size and is not shrunk to match.
- **The crane alone** where the name is already on screen or room is tight.
- **Sizes**: crane 22px high with a 13px wordmark in the app top bar; 30px with 13.5px on the
  landing header. Minimum: crane 16px (use `favicon.svg` below 24px), wordmark 10.5px.
- **The name is a brand**: "WildCrane" is never translated.
- **Regenerate the PNGs** with `node brand/export.mjs` after changing an SVG.

## Color

All colours are tokens; see the [snippet](#globalscss-snippet).

| Token | Value | Role |
| --- | --- | --- |
| `nb-cream` | `#f7f7f4` | page ground |
| `nb-paper` | `#ffffff` | blocks, fields, secondary buttons |
| `nb-wash` | `#f4f3ef` | quiet fills inside a block: insets, placeholders |
| `nb-ink` | `#24231f` | text, outlines, shadows |
| `nb-ink-soft` | `#565550` | meta, captions, inactive tabs, resting icons |
| `nb-accent` | `#dd4f1e` | ember: the primary action, the active tab, live work |
| `nb-accent-deep` | `#b83a12` | ember text on a tint, hover |
| `nb-accent-soft` | `#f7ddce` | ember tint: "to review" |
| `nb-mint` / `-soft` / `-ink` | `#7fca9c` / `#e4f3ea` / `#2f6b46` | done, connected |
| `nb-sky` / `-soft` / `-ink` | `#7fb4e0` / `#e6f1fb` / `#2c5c86` | in progress, neutral facts |
| `nb-peach` / `-soft` / `-ink` | `#ec9a72` / `#fbe9dd` / `#8a4a28` | paused, blocked, risk |
| `nb-lilac` / `-soft` / `-ink` | `#b199e0` / `#efe9fb` / `#5a3f92` | people, grouping |

- **Ration ember**: it marks what to press or what is happening now, never decoration.
- **Signals keep one meaning** everywhere. A `-soft` fill always carries its own `-ink`
  text; the saturated value is for dots and small shapes only.
- **Hairlines are ink at a percentage, 1px**: 12% for rules and dividers, 25% for the frame
  of a field or picker. Full ink belongs to blocks and buttons.
- **Never colour alone**: a state also has a label or an icon.
- **No pure black text**; white is for paper surfaces and text on ember.

## Typography

- **System sans** everywhere (`font-sans`); monospace only for commands, ids and logs.
- **Weight carries hierarchy**: 800 for page titles and prices, 700 for labels, titles and
  buttons, 600 for a subline, 400 for prose.
- **App sizes**: 13.5px nav and tabs, 14.5px row titles, 12.5px meta, 14px buttons, 15px
  input text.
- **Landing sizes**: hero 52px English / 46px Chinese, `leading-[1.12]`,
  `tracking-[-0.03em]`; subline 19px/600; body 15px at `leading-[1.65]`, max 500px wide.
- **Kickers** use `.nb-tag`: 11px uppercase, `0.12em` tracking, led by an ember dot.
- **Emphasis** in a headline is `.nb-mark`, a translucent ember band under one phrase. Once
  per view.

## Spacing and radius

- **Top bar**: 48px in the app, 56px on the landing; a 12% hairline under it, no fill.
- **Content column**: 880px for a list, 840px for the review page's reading column, 1120px for
  the landing.
- **Rhythm**: 24px between blocks, 16px inside a panel, 8–12px between controls.
- **List rows**: 62px, 16px side padding, 12% hairlines between rows.
- **Radius scales with size**: 16px panel, 10–11px button, 9px small button and inner
  frame, 8px field, 6px chip, full for avatars and dots.

## Components

- **Panel** (`.nb-panel`): 1.5px ink outline, 16px radius, paper, `3px 3px 0` ink shadow.
  Raise the block you act in (the composer, the work under review); lists and side panels
  keep the outline and drop the shadow. Never nest raised blocks.
- **Buttons**: 1.5px ink frame and hard shadow, `.nb-press`. Primary is ember with white
  700 text; secondary is paper with ink text. Sizes: 44px hero, 40px page action, 36px
  header and composer, 32px in-row with a 2px shadow. One primary per region; Approve sits
  right of Request changes. A quiet action (New task, Send) is plain ink-soft text.
- **Tabs**: text only. The active tab is ink 700 with a 2px rounded ember bar laid over the
  hairline (`bottom-[-1px]`); the rest are ink-soft. A count follows in ink-soft. The same
  pattern marks the current nav item and the desktop/phone switch.
- **Fields and pickers**: paper, 8px radius, 25% hairline, firming to solid ink on focus
  (`nb-field`). A picker shows its label in ink-soft, then the value and a chevron.
- **Status chip** (`.nb-chip`): borderless, `-soft` fill with `-ink` text and an icon.
  To review → ember, In progress → sky, Paused → peach, Done → mint. Fixed width in a list
  so titles align.
- **Avatar**: a round `-soft` fill with its `-ink` initial.
- **Preview frame**: the work under review shows in its own style inside one panel, never
  restyled as WildCrane. A preview inside a figure gets 12px padding and a 9px inner radius
  with no second border.
- **Dialog**: one raised panel over `.nb-scrim`; the panel's frame is its only ink outline,
  rules inside are hairlines. Esc and an outside click close it; actions sit bottom right.
- **Empty state**: one honest line where the list would be, next to the control that fills
  it. Never an instruction the user cannot follow from there.
- **Tooltip** (`.nb-tip` + `data-tip`): ink bubble, cream text, sentence case; shows on
  hover and keyboard focus. Every icon-only control has one.
- **Icons**: Feather (`react-icons/fi`), 11–16px, in the text colour beside them.

## Motion

- **Press physically**: hover lifts 1px and grows the shadow; active settles 1px and
  collapses it. 120ms.
- **Nothing moves by itself** except a live-work indicator. Opening and closing stays under
  a third of a second and respects `prefers-reduced-motion`.

## Phone width

Below `md` (48rem):

- **One column**: side panels stack under the main work. The review page keeps its order —
  title, facts, decision, card with previews in place — and comments open over the page.
- **No sideways scrolling** to read; a tab row may scroll sideways.
- **Tap targets are 44px**; nothing is reachable only by hover.
- **A dialog becomes a full-screen page** with its actions pinned full width at the foot.
- **Write it as `max-md:` utilities** beside the markup.

## Language and tone

- **Every UI string ships in 中文 and English**. Size layouts against English, which runs
  about a quarter longer; keep a Chinese line a few characters under its limit so it never
  orphans one or two.
- **Write for the user, only what they need now**: every screen, notification and email
  says what the user can do or what happened, never how it works inside, and carries only
  what they need to decide or act at that moment; delete the rest rather than rephrasing it.
  Who did something and when stays off unless the user acts on it: "Approved", not who
  approved it or when.
- **Professional, plain wording**: the standard phrasing of product UIs ("Approve preview",
  「确认预览」), the same verb on the button as in the sentence that leads to it.
- **Names are not copy**: product names, file names, commands and URLs stay untranslated.

## Runner

The menu bar panel and system notifications follow macOS / Windows native styling:
system font, system controls, system light/dark. No ink outlines or hard shadows.

- **Brand only**: the crane from `brand/` (a monochrome template image in the menu bar,
  `desktop-icon` as the app and notification icon) and ember as the tint of the one primary
  action.
- **Status dots** may use `nb-mint` / `nb-peach` for connected / disconnected, always beside
  a label.

## Accessibility

- Text meets 4.5:1, including chips; non-text marks meet 3:1.
- Every control is keyboard-reachable with a visible focus (`nb-focus` or the base ink
  outline); icon-only controls carry an accessible name.

## globals.css snippet

Tailwind v4. Paste into a new surface's `globals.css`; it yields `bg-nb-*` / `text-nb-*`
utilities and the classes above.

```css
@import "tailwindcss";

@theme {
  --color-nb-ink: #24231f;
  --color-nb-ink-soft: #565550;
  --color-nb-cream: #f7f7f4;
  --color-nb-paper: #ffffff;
  --color-nb-wash: #f4f3ef;
  --color-nb-accent: #dd4f1e;
  --color-nb-accent-deep: #b83a12;
  --color-nb-accent-soft: #f7ddce;
  --color-nb-mint: #7fca9c;
  --color-nb-mint-soft: #e4f3ea;
  --color-nb-mint-ink: #2f6b46;
  --color-nb-sky: #7fb4e0;
  --color-nb-sky-soft: #e6f1fb;
  --color-nb-sky-ink: #2c5c86;
  --color-nb-peach: #ec9a72;
  --color-nb-peach-soft: #fbe9dd;
  --color-nb-peach-ink: #8a4a28;
  --color-nb-lilac: #b199e0;
  --color-nb-lilac-soft: #efe9fb;
  --color-nb-lilac-ink: #5a3f92;
  --font-sans: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    Helvetica, Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
}

body {
  background: var(--color-nb-cream);
  color: var(--color-nb-ink);
  -webkit-font-smoothing: antialiased;
}

@layer base {
  :focus-visible {
    outline: 1.5px solid var(--color-nb-ink);
    outline-offset: 0;
  }
}

@utility nb-focus {
  &:focus-visible {
    outline: 1.5px solid var(--color-nb-ink);
    outline-offset: -1.5px;
    box-shadow:
      3px 3px 0 0 var(--color-nb-accent-soft),
      6px 6px 0 0 var(--color-nb-ink);
  }
}

@utility nb-field {
  &:focus-within {
    outline: 1.5px solid var(--color-nb-ink);
    outline-offset: -1.5px;
  }
}

.nb-panel {
  border: 1.5px solid var(--color-nb-ink);
  border-radius: 16px;
  background: var(--color-nb-paper);
  box-shadow: 3px 3px 0 0 var(--color-nb-ink);
}

.nb-press {
  transition: transform 120ms ease, box-shadow 120ms ease, background-color 120ms ease,
    border-color 120ms ease;
}
.nb-press:hover {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 0 var(--color-nb-ink);
}
.nb-press:active {
  transform: translate(1px, 1px);
  box-shadow: 1px 1px 0 0 var(--color-nb-ink);
}

.nb-tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--color-nb-ink);
}

.nb-mark {
  background-image: linear-gradient(
    color-mix(in srgb, var(--color-nb-accent) 42%, transparent),
    color-mix(in srgb, var(--color-nb-accent) 42%, transparent)
  );
  background-repeat: no-repeat;
  background-size: 100% 0.26em;
  background-position: 0 90%;
  padding: 0 1px;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}

.nb-chip {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  border-radius: 6px;
  padding: 2.5px 6px;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.nb-tip {
  position: relative;
}
.nb-tip::after {
  content: attr(data-tip);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  background: var(--color-nb-ink);
  color: var(--color-nb-cream);
  font-size: 10.5px;
  font-weight: 700;
  text-transform: none;
  letter-spacing: 0;
  padding: 4px 7px;
  border-radius: 6px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease;
  z-index: 30;
}
.nb-tip:not([data-tip])::after,
.nb-tip[data-tip=""]::after {
  content: none;
}
.nb-tip:hover::after,
.nb-tip:focus-visible::after,
.nb-tip:has(> :focus-visible)::after {
  opacity: 1;
}

.nb-scrim {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 16px;
  overflow-y: auto;
  background: color-mix(in srgb, var(--color-nb-ink) 42%, transparent);
}
```

Hairlines are inline: `color-mix(in srgb, var(--color-nb-ink) 12%, transparent)` for
rules, `25%` for field frames.
