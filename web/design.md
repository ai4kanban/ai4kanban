# Public site design

This is a small, evolving guide for `web/`.

## Shared language

- **Open, warm, direct**: white space and warm near-black ink give the content room.
  Spacing and typography do most of the grouping. Never fill controls with beige or tan.
- **Ember accent**: orange marks actions and points of emphasis. Larger areas can work
  when they serve the composition, as on the download page.
- **Selective tactile detail**: rounded corners, ink outlines, and hard offset shadows
  give buttons weight. Most content sits openly on the page.
- **Ink sparingly**: ink is for text and outlines. Never fill a tab, a page number or a
  selected state with it.
- **Tabs and pages**: the selected tab or page is deep-ember text over a short ember bar;
  the rest are muted text. No fills or shadows.
- **Clear typography**: Inter headings are bold and tightly spaced; body copy is calmer
  and comfortably readable. Monospace suits code and short labels.
- **Artwork with warmth**: pixel textures and watercolor-like washes accompany product
  screenshots and diagrams. Artwork can use a broader palette and soft shadows;
  surrounding text remains easy to read.
- **Obvious interaction**: actions have clear labels and visible states. Motion can
  reinforce an interaction or explanation, with an understandable reduced-motion state.

## Different pages, different compositions

These references demonstrate range, rather than a required page template:

- **Home**: a centered introduction, large product imagery, alternating copy and visuals,
  generous section spacing, and a warm closing section.
- **Claude Code guide**: a softly illustrated opening, a narrower reading column with
  navigation beside it, quiet table separators, and screenshots mounted on washes.
- **Download**: a compact utility composition joining warm neutral, ember, and ink
  areas into one offer, followed by straightforward platform help.

Choose layout, density, imagery, and section structure for the page's purpose. Future
pages may need new compositions or a redesign of existing patterns. These examples
are a starting point, not an exhaustive system or a promise that every detail is settled.

## Working with the design

- **Start with existing materials**: `app/globals.css` holds the palette and fonts;
  `components/styles.ts`, `components/ui/`, and the reference pages provide reusable
  pieces. Reuse what fits and adapt what does not.
- **Keep it usable**: preserve readable contrast, keyboard access, visible focus, and
  layouts that work with narrow screens and translated text.
- **Keep this guide small**: add a principle when it proves useful across pages. Leave
  page-specific measurements and implementation details with their components.
