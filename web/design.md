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

Three track hues, one per solo-founder task type. They are only for showing kinds of
work apart (the preset bar in `components/home/Presets.tsx`) and for a green check
mark. They are not a general palette.

| Token | Value |
| --- | --- |
| `--color-growth` | `#3fb950` |
| `--color-validation` | `#e3b341` |
| `--color-building` | `#58a6ff` |

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

## 5. The pages

English pages live under `app/(en)/`, translated ones under `app/(intl)/[locale]/`.
The split exists because each group needs its own `<html lang>`, and only a root
layout can render `<html>`. Route groups don't appear in URLs, so English keeps its
bare paths.

English (`app/(en)/`):

| Route | File |
| --- | --- |
| `/` | `page.tsx` |
| `/recipes` | `recipes/page.tsx` |
| `/recipes/<slug>` | `recipes/[slug]/page.tsx` |
| `/vs-github-issues` | `vs-github-issues/page.tsx` |
| `/vs-hermes-kanban` | `vs-hermes-kanban/page.tsx` |
| `/vs-vibe-kanban` | `vs-vibe-kanban/page.tsx` |
| `/og-image` | `og-image/page.tsx` — a 1200×630 frame you screenshot for the share card. Not indexed, not linked. |

Translated (`app/(intl)/[locale]/`), where `locale` is `zh`, `es`, `ja`, or `fr`:
`/zh`, `/zh/vs-github-issues`, `/zh/vs-hermes-kanban`, `/zh/vs-vibe-kanban` — and the
same four for `/es`, `/ja`, `/fr`. Recipes are English-only.

The route files are thin. The page body lives once in `components/pages/` —
`HomePage.tsx`, `VsGithubPage.tsx`, `VsHermesPage.tsx`, `VsVibePage.tsx` — and takes a
`locale`, so English and the four translations render the same component.

Sections sit in a folder per page: `components/home/`, `components/vs-github-issues/`,
`components/vs-hermes-kanban/`, `components/vs-vibe-kanban/`, `components/recipes/`,
plus `components/vs/` for parts all three comparison pages share.

Shared across every page: `Header.tsx`, `Footer.tsx`, `SectionHeading.tsx` (the
numbered eyebrow plus H2), `CodeBlock.tsx` (a code block with a copy button), and
`Rich.tsx`.

The language switcher sits in the footer. `Footer.tsx` renders `LanguageSwitcher.tsx`,
which lists all five languages, each in its own name, and links to the same page in
that language. Nothing redirects by browser language — the reader picks. On a page
that exists in English only, the switcher renders nothing; `TRANSLATED_PATHS` in
`lib/i18n.ts` is the list it checks.

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
name, which side of a comparison row wins — stays in a `*-content.ts` file next to the
components and is joined to the copy by key: `components/content.ts`,
`components/recipes/recipes-content.ts`, `components/vs-github-issues/vs-content.ts`,
and so on.

Copy strings are plain text, so a translator never edits JSX. `Rich.tsx` renders a
tiny Markdown subset for the little markup the text needs: `` `code` `` a code chip,
`**bold**`, `*italic*`, and `\n` a line break. Anything richer — a link, a button, a
diagram — is layout and belongs in the component.
