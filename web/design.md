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

Neo-brutalism on paper: a light neutral page, white paper panels, hard offset shadows in
near-black ink, an ink outline where something has to be pointed at, and one azure.
Same ink and same hard shadows as `kanban-ui/app/globals.css`, but the ground is neutral
where the board's is cream, and the accent is an azure where the board takes its ember.
All of it lives in the `@theme` block of `web/app/globals.css`. Tailwind v4 turns each
token into a utility, so `--color-muted` is `text-muted`, `--color-elev` is `bg-elev`,
and so on.

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
| `--color-growth` | `#0f7350` | a win on the comparison pages |
| `--color-caution` | `#b32438` | a loss on the comparison pages |

The green and the red are not a second accent. Both label text, so both clear 4.5:1 on
the page. The azure is sampled off the watercolour mats the landing page mounts its
screenshots on — which is also why the page is white paper: the site has to sit next to
them.

**The three neutrals are a ramp**, not three shades of white: the page, the paper panel
laid on it, the wash inset back into that. Place a new surface on the ramp before you
place it on the page. The ramp is also how you say one block outranks the block beside
it — the loser sinks to the wash, the answer sits on the paper above it. Reach for a step
on the ramp before you reach for a color.

**The split between the two blues is contrast.** `accent` carries a paper label at only
3.84:1, so it keeps the work that is only a shape: a bar, a rail, the brightened fill of
a button held on hover. Anything you have to read takes `accent-deep` — 7.28:1 off the
page, 7.87:1 under a paper label. A blue block is `accent-deep` with an `elev` label.

**The blue is an object** — a fill, a bar, a mark. Never a page, never a panel, never an
outline. Filled blue blocks are what stop the page being a stack of white cards. Use it
at full strength or not at all — there is no tint. A block is either filled with
`accent-deep` and carrying a paper glyph, or it steps on the ramp instead.

**The shadow makes the block; the outline points at one.** Every block casts the same
hard ink shadow — `--color-ink` at `4px 4px 0` — and that alone is enough to lift paper
off the page. The 2px ink outline is the louder half of the pair and it is not the
default: a button wears it always, because a button is the one thing on the page you are
meant to hit, and a panel wears it only when it has to outrank the panel beside it. Frame
every card and the outline stops meaning anything. §3 is the whole rule.

**When the outline is there it is ink, in every state.** Hover does not recolour a border;
it moves the block half a unit up and left and grows the shadow from 4px to 6px. On a
button it also moves the fill — the primary brightens to the azure it is a deep cut of,
the paper one drops to the wash. That is the one moment the bright azure is a ground, and
nothing sits on it that isn't paper-white.

**Not every surface is a block either.** A shadow says *this one*, and only while the
things around it aren't saying it too. Put it on everything and a screen is a pile of
boxes with nothing in it to look at first. So it is for a surface that is an object on the
page: a card, the one panel a section is built around. Everything else is bare, and
separated by the ramp instead. Those are the only two options — §3.

**The logo is that rule at mark size.** `components/ui/Logo.tsx` is a square block —
`accent-deep` fill, ink outline, the same hard ink shadow — carrying a paper glyph, then
the name in the heaviest cut of the system sans, casting the same hard offset drop. The
mark is the page's vocabulary stated once rather than its own piece of art. The block
always names its own colors, because it is the same object on any ground; the word names
none, so it inherits the ink on the page and the paper in the footer. `public/logo-mark.svg`
and `public/logo.svg` carry the same geometry for anywhere off the site — change one,
change the other. The same mark is the favicon set in `public/`, declared once as
`siteIcons` in `lib/metadata.ts`; `app/` holds no icon files, because that convention
takes one image per role and a tab, a Windows shortcut and an iOS home screen each want a
different one. The board UI carries the same glyph in its own palette — a mark belongs to
the product, a colour and a frame belong to the surface it sits on.

Two things break the page's `max-w-5xl` column and run the full width of the viewport:

- **The watercolour banner** behind the landing page's hero. It is the one place the blue
  is a ground and not an object, and what earns it that is that it is a wash: masked so it
  dissolves into `--color-bg` before the section ends, never drawing an edge, with nothing
  you have to read sitting on pigment.
- **The site footer**, the one dark block: the palette inverted rather than a new color —
  the ink as the ground, the paper as the type at 70% for body, 30% for separators and
  15% for the pixel wordmark. Nothing inside it may name its own color, so anything shared
  with a light footer inherits and separates by opacity and weight.

The same inversion is the whole ground of the social share card,
`app/(en)/og-image/page.tsx` — the one thing seen alone, at thumbnail size, with no page
around it, where dark is what separates it. It is a render-only route; capture it at
1200×630 and upload the PNG to the versioned CDN name in `lib/site.ts`.

Two values are not tokens, because they are illustration rather than a surface: the
hairline in `HkDiagrams.tsx` and the linework in `RecipeArt.tsx`. Both are commented
where they are declared.

**Motion is for a diagram, and it carries that diagram's sentence.** Outside the hover
lift, animation moves one thing along the path the picture is arguing about — never a part
at a time. A drawing animated part by part is twenty things twitching and nothing to read,
so if a part moves it is because the signal is there *now*. Give every rule one period and
let each part differ only in its delay: no part owns a clock, so no part can drift out of
order.

Every picture says the same thing standing still, which is what it does under
`prefers-reduced-motion`; that media query wraps the rules rather than a `reduce` query
undoing them, so no-preference is the only state that moves — which means the resting
style has to be the one you'd draw by hand. Keyframes live in a `<style>` block in the
component that draws them: `globals.css` is tokens only, and a Tailwind class can't
declare a keyframe.

One trap, since half of the resting styles here are Tailwind utilities: **animate whichever
property the resting style set.** Tailwind v4 writes `-translate-x-full` to the independent
`translate` property, not to `transform`, and the two *compose* rather than override.

Two font stacks: `--font-sans` for everything, `--font-mono` for code, terminals, and
eyebrows. Sans is Inter, loaded by `next/font` in `lib/fonts.ts` and self-hosted out of
`_next/static/media` — both root layouts put `inter.variable` on `<html>`. The old system
stack is still there behind it, and still does real work: it draws the first paint, and
it draws every CJK glyph on the zh and ja pages, because the subset we ship is latin
only. Never add a CJK web font — they are megabytes. `--font-mono` is not a download.

`--font-pixel` (Silkscreen) draws the footer wordmark and nothing else — subset to the
six letters of AI4KANBAN and inlined as base64, so that one never touches the network.
Changing the word means re-subsetting; the recipe is in the comment above that rule.

Past the tokens and that `@font-face`, `globals.css` holds only smooth scroll and
`color-scheme: light` on `html`, and the background and text color on `body`.

## 3. The surfaces

A surface is **raised** or it is **bare**. There is deliberately nothing between the two,
and both live in `web/components/styles.ts`.

**Raised.** `rounded-xl`, a hard offset shadow `4px 4px 0` in the ink, and *no border*.
For a surface that is an object on the page — a card, the one panel a section is built
around. A handful per screen.

- `panel` — paper. On hover it slides half a unit up and left and the shadow grows to
  `6px 6px 0`, still in the ink.
- `panelStatic` — the same block with no hover. Use it when the card isn't clickable.
- `panelInset` — the same block filled with the wash instead of the paper, for a panel
  that reads as sunk into the page rather than laid on it: a terminal, a screenshot
  frame, a diagram whose own cards need paper to sit on.

**Bare.** No shadow and no border. Everything else: every part of a composite (a node in
a diagram, a tile in a grid, a row in a list), every block read by its own fill (a blue
bar, a `solid` `Chip`), and all artwork.

- `panelBare`, `panelBareInset` — `rounded-xl` with the paper or the wash and nothing
  else. On another radius there is nothing to import: `rounded-lg bg-elev` is the style.

**One thing in that file is not a surface.** `heroTop` — `mt-20 lg:mt-32` — is the band of
air between the header's rule and the first thing on a page, and every hero takes it. It
is shared rather than typed per page because each page guessing its own opening height is
the one inconsistency a reader sees before they have read a word, and it is larger than a
section gap on purpose — the top of a page is where the empty band is doing the work. The
landing page's watercolour banner is pinned to the same value from the other side, so
changing `heroTop` means changing that too or the wash starts below the header and draws
an edge across the page.

**And one modifier.** `framed` — the 2px `border-border` outline, composed onto a raised
panel: `` `${panelStatic} ${framed}` ``. It composes where the fill can't, because no
panel string sets a border. Three kinds of thing carry the outline without asking, and
they are all *not panels*: every `Button`; the small blocks the ramp is too fine to hold
on its own (a neutral `Chip`, an `md` `IconChip`, a tag pill, the `Logo`'s block); and
anything that floats over whatever is under it and so needs an edge of its own. A *panel*
takes it only to say it is the primary one on the screen — one at a time, because the
second framed panel in a section cancels the first. Reach for the ramp first: a wash panel
next to a paper one already says which of the two is the answer, and it says it without
raising its voice.

What separates a bare block is the step it takes on the ramp, so put it on the step next
to its ground — paper on the page, paper on the wash, the wash on the page. Bare paper on
paper is not a block, it's a paragraph. That constraint is the point: the ramp is a real
separation and a 1px grey line is not, so needing the line usually means the block is on
the wrong step.

**Blocks don't nest.** The rule that decides most cases in practice: a raised block is one
object, so nothing inside it is raised or framed too — no shadow on its tiles, no outline
on its rows. Six ink rules *and* a border is that card drawn seven times. What dropping
the default border buys is that a table gets one set of lines instead of two: the rules
between the rows are the only edges on it, and they are what a table is. Where a divider
is wanted and a rule would be a third weight, change the fill instead.

**Size decides when bare is enough.** The step between two rungs of the ramp is small, so
it separates a large block on its own and a small one not at all. A full-width code block
in the wash needs nothing; a pill of two words does, which is why a neutral `Chip` carries
the outline. When a small bare block won't hold, the answer is an ink edge or a darker
fill — never a fainter line.

**Why there is no middle.** A faint grey border is the compromise that makes a page look
busy and undesigned at the same time — too weak to be the frame, too present to be
nothing — and the moment the system owns one, every block gets one and the page is a grid
of boxes again. If a block needs an edge, it takes the full 2px ink one.

**A diagram spells one idea one way.** Every node in a drawing is the same object, because
a picture that spells one idea two ways makes you learn both. And **a label in a node takes
`break-words`, always** — a browser will overflow a box before it splits a word, and the
longest noun in five languages is not the one you designed the cell around.

None of this governs a *line*. Rails and the strokes inside SVG diagrams are rules and
linework, not a block's border, and they are drawn at full strength like every other line
on the site (§2 lists the two illustration values that are not tokens). Raised-or-bare is
a question you ask about a surface.

About two dozen files import one of these. Compose extra classes onto them with a
template string:

```tsx
<div className={`${panelStatic} p-5`}>
```

What you cannot compose that way is the fill. Appending `bg-code` to a string that
already says `bg-elev` does nothing — two utilities set the same property, and the winner
is their order in the generated stylesheet, not the order you wrote them. That is why
each fill is its own export.

## 4. The styling rule

Write Tailwind utilities inline in the component. That is the default, even for a long
class list or an arbitrary value like `shadow-[8px_8px_0_0_#010409]` — keeping the
styles next to the markup is what makes a section easy to read and change on its own.

Two exceptions:

- `web/components/styles.ts` — for a piece many sections reuse. Today that is the raised
  and bare surfaces, the `framed` modifier, and `heroTop`. Don't add a string here for two
  or three call sites.
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
  vs/                 what all comparison pages share, including
                      diagram.tsx — the canvas, palette, motion and figures
                      (Person, Robot, Board, captions) every hero diagram
                      pair is drawn from. See the `vs-diagram` skill before
                      drawing one; a pair has to make the page's argument,
                      not illustrate it.
  vs-github-issues/   each comparison's own sections, plus its *-content.ts
  vs-hermes-kanban/
  vs-vibe-kanban/
  vs-linear/
  vs-multica/
  vs-task-master/
  download/           the release: which file each system takes (`builds.ts`,
                      joined to `lib/release.ts`, which reads the repo's
                      VERSION at build time) and the one button, which aims
                      itself at the reader's system in the browser
  recipes/            the index, the cards, and their art
  shots/              the board mockups the landing page draws
  Header.tsx          the one header, on every page — one row, sticky, the same
                      height at every width, and opaque so the hero's wash never
                      tints it as the page scrolls under
  MobileNav.tsx       below `md`, the nav collapses into this one button so the
                      header stays a single row
  SiteFooter.tsx      the dark band that ends the landing and comparison pages
  Footer.tsx          the thin footer the English-only recipes end on
                      Both carry LanguageSwitcher.tsx — five languages,
                      silent on a page that exists in English only
  CompareMenu.tsx     the header's comparisons dropdown, on Dropdown.tsx
  SectionHeading.tsx  numbered eyebrow plus H2
  CodeBlock.tsx       code block with a copy button
  Rich.tsx            the Markdown subset copy may use (§6)
  styles.ts           raised and bare, the only two surfaces, plus `framed` (§3)
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
  vs-multica/ vs-task-master/
```

- Write new copy in that page's `en.ts` first, then run `/translate-sync`.
- Every language declares the folder's type, so a key you add to English and a language
  hasn't translated yet is a build error, not a silently missing sentence.
- A page calls `getCopy(locale)` once and passes the result down.

Only words go in `i18n/`. Everything that isn't language — ordering, an emoji, a file
name, which side of a comparison row wins — stays with the components: either in the
section that draws it or in a `*-content.ts` file joined to the copy by key.
`components/content.ts` holds the GitHub URL.

Copy strings are plain text, so a translator never edits JSX. `Rich.tsx` renders a tiny
Markdown subset: `` `code` `` a code chip, `**bold**`, `*italic*`, and `\n` a line break.
Anything richer — a link, a button, a diagram — is layout and belongs in the component.
Its one prop, `code`, names the *ground* the text sits on, not the fill: `paper` (the
default) for the page or a paper panel, `wash` for text already on a `bg-code` block. The
chip takes the neighbouring step of the ramp either way, because a `bg-code` chip on a
`bg-code` panel is invisible.
