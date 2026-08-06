# The site's design

## 1. What this is

How the public site in `web/` looks and how it is put together. Read it before you
change a page.

It covers `web/` only. `kanban-ui/` is a separate app with its own theme — nothing
here applies to it.

The site is a static export (`output: 'export'` in `next.config.mjs`), so there is no
server at runtime. Every page is built to HTML.

## 2. The look

A dark theme in GitHub's colors. All of it lives in the `@theme` block of
`web/app/globals.css`. Tailwind v4 turns each token into a utility, so
`--color-muted` is `text-muted`, `--color-elev` is `bg-elev`, and so on.

Seven colors:

| Token | Value | Used for |
| --- | --- | --- |
| `--color-bg` | `#0d1117` | the page background |
| `--color-elev` | `#161b22` | a raised surface — the panel fill |
| `--color-border` | `#21262d` | every border |
| `--color-ink` | `#e6edf3` | body text and headings |
| `--color-muted` | `#9198a1` | second-level text: leads, captions, nav links |
| `--color-accent` | `#58a6ff` | the one accent — eyebrows, links, hover states |
| `--color-code` | `#0a0e14` | code blocks, terminals, and panels inset on a panel |

One green, `--color-growth` `#3fb950`. It is only for a check mark on the comparison
pages and for the half of the work that is yours in `components/home/Loop.tsx`. It is
not a second accent.

Two font stacks: `--font-sans` (the system stack) for everything, `--font-mono` for
code, terminals, and eyebrows.

That is the whole system. `globals.css` is about 30 lines — the tokens, smooth scroll
on `html`, and the background and text color on `body`. There is nothing else in it.

## 3. The panel

Every card on the site is the same block, defined in `web/components/styles.ts`:

- `panel` — `rounded-lg`, a 2px `border-border` border, `bg-elev`, and a hard offset
  shadow `4px 4px 0 #010409`. On hover it slides half a unit up and left, the border
  turns `accent/50`, and the shadow grows to `6px 6px 0` in the accent color.
- `panelStatic` — the same block with no hover. Use it when the card isn't clickable.

About two dozen files import one of the two. Compose extra classes onto it with a
template string:

```tsx
<div className={`${panelStatic} bg-code p-5`}>
```

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
  pages/              one file per page body, taking a `locale` — every language
                      renders the same component
  home/               the landing page's sections, and the only page with its own
                      chrome (HomeHeader, HomeFooter)
  vs/                 what all four comparison pages share
  vs-github-issues/   each comparison's own sections, plus its *-content.ts
  vs-hermes-kanban/
  vs-vibe-kanban/
  vs-linear/
  recipes/            the index, the cards, and their art
  shots/              the board mockups the landing page draws
  Header.tsx          chrome for the comparison and recipe pages
  Footer.tsx          the same, carrying LanguageSwitcher.tsx — five languages,
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

- `en.ts` is the source of truth. Write new copy here first.
- `types.ts` holds `SiteCopy`, the shape of that copy.
- `zh.ts`, `es.ts`, `ja.ts`, `fr.ts` each declare `const copy: SiteCopy`, so a key you
  add to English and a language hasn't translated yet is a build error, not a silently
  missing sentence.
- `index.ts` exports `getCopy(locale)`. A page calls it once and passes the result
  down.

Only words go in `i18n/`. Everything that isn't language — ordering, an emoji, a file
name, which side of a comparison row wins — stays with the components: either in the
section that draws it (the landing page keeps its icons, memory paths and agent marks
inline) or in a `*-content.ts` file joined to the copy by key —
`components/recipes/recipes-content.ts`, `components/vs-github-issues/vs-content.ts`,
and so on. `components/content.ts` holds the one constant every page links to, the
GitHub URL.

Copy strings are plain text, so a translator never edits JSX. `Rich.tsx` renders a
tiny Markdown subset for the little markup the text needs: `` `code` `` a code chip,
`**bold**`, `*italic*`, and `\n` a line break. Anything richer — a link, a button, a
diagram — is layout and belongs in the component.
