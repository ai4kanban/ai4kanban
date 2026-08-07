# The site's design

## 1. What this is

How the public site in `web/` looks and how it is put together. Read it before you
change a page. It covers `web/` only — `kanban-ui/` is a separate app with its own
theme. The site is a static export (`output: 'export'`), so every page is built to HTML.

**Run `/design` before you argue about a color.** `app/(en)/design/page.tsx` renders
every token and every block on one screen — importing the blocks from the same modules
the pages do — and prints the measured contrast of each pair. If you change a token or
add a surface, add its pair to that table, and update the hexes at the top of that file
to match `globals.css`; the contrast math runs at build time and can't read a CSS
variable. The page is `noindex` and disallowed in `robots.ts`.

## 2. The look

Neo-brutalism on paper: a light neutral page, white paper panels, near-black ink
outlines, hard offset shadows, and one azure. Same ink and same hard shadows as
`kanban-ui/app/globals.css`, but the ground is neutral where the board's is cream, and
the accent is an azure where the board takes its ember. All of it lives in the `@theme`
block of `web/app/globals.css`. Tailwind v4 turns each token into a utility, so
`--color-muted` is `text-muted`, `--color-elev` is `bg-elev`, and so on.

Ten colors, and only four of them are coloured:

| Token | Value | Used for |
| --- | --- | --- |
| `--color-bg` | `#f5f6f8` | the page — a light neutral, no cast |
| `--color-elev` | `#ffffff` | paper — the panel fill |
| `--color-border` | `#191c22` | every outline, and every hard shadow |
| `--color-ink` | `#191c22` | body text and headings — the same ink |
| `--color-muted` | `#4d5c73` | second-level text: leads, captions, nav links |
| `--color-accent` | `#2f7ff5` | the azure: fills and bars, nothing you have to read |
| `--color-accent-deep` | `#12509e` | the blue as text, and the blue you put a label on |
| `--color-code` | `#edeff3` | the wash: code blocks, terminals, panels inset on a panel |
| `--color-growth` | `#0f7350` | a win on the comparison pages; your half of `Loop.tsx` |
| `--color-caution` | `#b32438` | a loss on the comparison pages |

The green and the red are not a second accent. Both label text, so both clear 4.5:1 on
the page. The azure is sampled off the watercolour mats the landing page mounts its
screenshots on (`cdn.ai4kanban.dev/bloom-*.jpg`) — which is also why the page is white
paper: the site has to sit next to them.

**The three neutrals are a ramp**, not three shades of white: the page, the paper panel
laid on it, the wash inset back into that. Place a new surface on the ramp before you
place it on the page. The ramp is also how you say one card outranks the card beside it —
in `components/home/Compare.tsx` the traditional board sits in the wash and AI4Kanban on
the paper above it; the losing half of a `ComparisonTable` row sinks to the wash; the
middle stop in `HkAutonomy.tsx` is the one on paper. Reach for a step on the ramp before
you reach for a color.

**The split between the two blues is contrast.** `accent` carries a paper label at only
3.84:1, so it keeps the work that is only a shape: the eyebrow bar, the autonomy rail,
the brightened fill of a button held on hover. Anything you have to read takes
`accent-deep` — 7.28:1 off the page, 7.87:1 under a paper label. A blue block is
`accent-deep` with an `elev` label.

**The blue is an object** — a fill, a bar, a mark. Never a page, never a panel, never an
outline. Fill with it: the primary button, the skill bar at the middle of the iteration
diagram, the icon block in front of every node are what stop the page being a stack of
white cards. Use it at full strength or not at all — there is no tint. A block is either
filled with `accent-deep` and carrying a paper glyph, or it steps on the ramp instead.

**Every outline is ink, in every state.** Hover does not recolour a border; it moves the
block half a unit up and left and grows the shadow from 4px to 6px. On a button it also
moves the fill — the primary brightens to the azure it is a deep cut of, the paper one
drops to the wash. That is the one moment the bright azure is a ground, and nothing sits
on it that isn't paper-white.

**Every block casts the same ink shadow** — `--color-ink` under the blue button, the
paper button, and every card. The shadow is the block's weight, not a color effect.

**The logo is that rule at mark size.** `components/ui/Logo.tsx` is a square block —
`accent-deep` fill, ink outline, the same hard ink shadow — carrying a paper glyph of
three board columns that step down as work leaves the board, then the name. It is
deliberately not its own piece of art: the mark is the page's vocabulary stated once, so
it sits on the page rather than beside it. The name gets the block's other rule: set in
the heaviest cut of the system sans, at about seven tenths of the block so its cap-height
reads level with the square's edges, and casting the same hard offset drop every block on
the site casts. That is what makes it a mark rather than a label — the word is an object
lying on the page at the block's height, lit from the same corner, not type set beside a
logo. The site ships no display face for it and doesn't need one.

Ink letters cannot cast an ink shadow, so the drop is the ink copy down and right with a
paper halo held between it and the letters. Text shadows stack as whole strings under the
type, so the halo cuts a clean edge around every letter. It has to go all the way round
rather than sit on one side, because the shadow a letter needs protecting from is mostly
its neighbour's, and that arrives from the left. Without it the word has to be tracked
apart until the drops stop colliding, and a wordmark set that loose is no longer a mark —
the halo is what buys the tight setting. It is paper and not the wash because the header
band is paper, and a wash halo reads there as a grey line inside the letterform. The drop
stays well under the block's 4px at every step: the block is one shape and the word is
nine, and nine shapes each throwing the block's shadow would close up the page.

The block always names its own colors, because it is the same object on any ground; the
word names none, so it inherits the ink on the page and the paper in the footer. Only its
drop is told which ground it is on, through `tone` — against the page the gap is paper
and the shadow is ink, and on the dark share card that pair inverts to the ink and the
azure, since an ink shadow is invisible there and a paper one reads as a second copy of
the word rather than as its shadow. At `xs` there is no drop at all, the same size at
which the block gives up its shadow. `public/logo-mark.svg` and
`public/logo.svg` carry the same geometry for anywhere off the site — change one, change
the other. The header, the share card, and every comparison page render it — the `xs`
size is the product's tag beside a competitor's mark, which is why our side of those pages
is no longer a folder emoji. The brand is no longer a copy string, because the name is
the same word in all five languages. The same mark is the favicon set in `public/` — the
SVG, the 96px PNG, the `.ico`, the Apple touch icon and the two manifest sizes —
declared once as `siteIcons` in `lib/metadata.ts` and spread into both root layouts.
`app/` holds no icon files: that convention takes one image per role, and a tab, a
Windows shortcut and an iOS home screen each want a different one.

The board UI carries the same mark in its own palette — `kanban-ui/components/Logo.tsx`,
the identical glyph filled with that app's ember instead of this one's azure, and bare:
no frame, no shadow. A filled block there normally gets both, but at 22px a 1.5px ink
hairline is a seventh of the width on each side and turns the ember muddy rather than
framing it. The geometry is shared and nothing else is — a mark belongs to the product,
a colour and a frame belong to the surface it sits on.

Two things break the page's `max-w-5xl` column and run the full width of the viewport:

- **The watercolour banner** behind the landing page's hero, in the same azure on the
  same paper as the mats in `components/home/Loop.tsx`. It is the one place the blue is a
  ground and not an object, and what earns it that is that it is a wash: 60% opacity,
  masked so it dissolves into `--color-bg` before the section ends, never drawing an
  edge, with nothing you have to read sitting on pigment — the headline stays on paper.
  It is off below `sm`: a phone viewport is narrower than the wash's soft middle, so all
  that lands there is a crop of one corner, which reads as noise behind the headline
  rather than as the banner the section was drawn around.
- **The site footer**, the one dark block: the palette inverted rather than a new color —
  the ink as the ground, the paper as the type at 70% for body, 30% for separators and
  15% for the pixel wordmark. It ends the landing page and all comparison pages.
  Nothing inside it may name its own color; `LanguageSwitcher.tsx` sits in both footers,
  so it inherits and separates its links by opacity and weight.

The same inversion is the whole ground of one surface that is not on the site at all: the
social share card, `app/(en)/og-image/page.tsx`. It is the one thing seen alone — in
someone else's timeline, at thumbnail size, with no page around it — and dark is what
separates it there. It takes the footer's palette exactly and adds nothing: the ink as
the ground, the paper at full for the headline and 70% for the lead, and the bright azure
for the URL, which is the readable one of the two blues on the ink — with the `.dev` on
it dropped to dimmed paper, so the domain reads as the brand plus a suffix rather than as
nine characters of one weight. It is a render-only
route; capture it at 1200×630 and upload the PNG to the versioned CDN name in
`lib/site.ts`.

Two values are not tokens, because they are illustration rather than a surface: the
hairline in `HkDiagrams.tsx` and the linework in `RecipeArt.tsx`. Both are commented
where they are declared.

Two font stacks: `--font-sans` (the system stack) for everything, `--font-mono` for code,
terminals, and eyebrows. Neither is a download. The exception is `--font-pixel`
(Silkscreen), which draws the footer wordmark and nothing else — subset to the six
letters of AI4KANBAN and inlined as base64, so the site makes zero font requests.
Changing the word means re-subsetting; the recipe is in the comment above that rule.

Past the tokens and that `@font-face`, `globals.css` holds only smooth scroll and
`color-scheme: light` on `html`, and the background and text color on `body`.

## 3. The panel

Every card on the site is the same block, defined in `web/components/styles.ts`:

- `panel` — `rounded-xl`, a 2px `border-border` border, `bg-elev`, and a hard offset
  shadow `4px 4px 0` in the ink. On hover it slides half a unit up and left and the
  shadow grows to `6px 6px 0`, still in the ink. The border does not change.
- `panelStatic` — the same block with no hover. Use it when the card isn't clickable.
- `panelInset` — the same frame filled with the wash instead of the paper, for a panel
  that reads as sunk into the page rather than laid on it: a terminal, a screenshot
  frame, a diagram whose own cards need paper to sit on.

About two dozen files import one of the three. Compose extra classes onto it with a
template string:

```tsx
<div className={`${panelStatic} p-5`}>
```

What you cannot compose that way is the fill or the border. Appending `bg-code` to a
string that already says `bg-elev` does nothing — two utilities set the same property,
and the winner is their order in the generated stylesheet, not the order you wrote them.
That is why `panelInset` is its own export. A panel never needs a different border
anyway: the outline is ink on every block, so move the card on the ramp instead.

## 4. The styling rule

Write Tailwind utilities inline in the component. That is the default, even for a long
class list or an arbitrary value like `shadow-[8px_8px_0_0_#010409]` — keeping the
styles next to the markup is what makes a section easy to read and change on its own.

Two exceptions:

- `web/components/styles.ts` — for a piece many sections reuse. Today that is only the
  panel. Don't add a string here for two or three call sites.
- `web/app/globals.css` — tokens only. No utility classes, no component classes.

## 5. Where a component goes

```
components/
  ui/                 the primitives every page shares — Button, Chip, IconChip,
                      Logo. Import these rather than re-typing a class list.
                      Everything here is on /design.
  pages/              one file per page body, taking a `locale` — every language
                      renders the same component
  home/               the landing page's sections
  vs/                 what all comparison pages share
  vs-github-issues/   each comparison's own sections, plus its *-content.ts
  vs-hermes-kanban/
  vs-vibe-kanban/
  vs-linear/
  vs-multica/
  recipes/            the index, the cards, and their art
  shots/              the board mockups the landing page draws
  Header.tsx          the one header, on every page — one row, sticky, at
                      every width, and the same height at every width. The
                      band is paper on the page's neutral, opaque, so the
                      hero's azure wash never tints it as the page scrolls
                      under. HeaderLanguage.tsx is its language menu; the
                      footer's switcher is the path-aware one
  MobileNav.tsx       below `md`, the nav collapses into this one button so
                      the header stays a single row. The language switcher
                      and the GitHub button stay out in the row beside it —
                      both are `Button`'s `icon` size, and the menu borrows
                      the same block through `buttonClass` because a framed
                      icon next to a bare one reads as two different things
  SiteFooter.tsx      the dark band that ends the landing and comparison pages
  Footer.tsx          the thin footer the English-only recipes end on
                      Both carry LanguageSwitcher.tsx — five languages,
                      silent on a page that exists in English only
  CompareMenu.tsx     the header's comparisons dropdown, on Dropdown.tsx
  SectionHeading.tsx  numbered eyebrow plus H2
  CodeBlock.tsx       code block with a copy button
  Rich.tsx            the Markdown subset copy may use (§6)
  styles.ts           the panel (§3)
  content.ts          the GitHub URL
```

## 6. The copy

Every word the site renders lives in `web/i18n/`. Never type English into a component.
One folder per page — `shared/` for the chrome, `home/`, and one per comparison, named
like the component directory — and one file per language inside it:

```
i18n/
  index.ts            getCopy(locale), and the rules for writing a string anywhere here
  types.ts            the shapes pages share (PageMeta, VsHero…) and SiteCopy, which
                      joins the six folder types
  home/
    en.ts             the landing page in English — the source of truth
    zh.ts es.ts       …and the four translations, mirroring it key for key
    ja.ts fr.ts
    types.ts          HomeCopy: the shape all five declare
    index.ts          the five, keyed by locale
  shared/ vs-github-issues/ vs-hermes-kanban/ vs-vibe-kanban/ vs-linear/
  vs-multica/
```

- Write new copy in that page's `en.ts` first, then run `/translate-sync`.
- Every language declares the folder's type, so a key you add to English and a language
  hasn't translated yet is a build error, not a silently missing sentence.
- A page calls `getCopy(locale)` once and passes the result down.

Only words go in `i18n/`. Everything that isn't language — ordering, an emoji, a file
name, which side of a comparison row wins — stays with the components: either in the
section that draws it (the landing page keeps its icons, memory paths and agent marks
inline) or in a `*-content.ts` file joined to the copy by key
(`components/recipes/recipes-content.ts`, `components/vs-github-issues/vs-content.ts`).
`components/content.ts` holds the GitHub URL.

Copy strings are plain text, so a translator never edits JSX. `Rich.tsx` renders a tiny
Markdown subset: `` `code` `` a code chip, `**bold**`, `*italic*`, and `\n` a line break.
Anything richer — a link, a button, a diagram — is layout and belongs in the component.
Its one prop, `code`, names the *ground* the text sits on, not the fill: `paper` (the
default) for the page or a paper panel, `wash` for text already on a `bg-code` block. The
chip takes the neighbouring step of the ramp either way, because a `bg-code` chip on a
`bg-code` panel is invisible.
