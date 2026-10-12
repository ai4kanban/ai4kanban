---
description: A new or changed user-facing feature — its screens, layouts, interactions, flows, and the text on them. Skip only a typo or a one-value spacing fix that needs no design decision, and shipped illustrations.
---

A folder of files in `.draft-first/.assets/<slug>/` with one entry file per state, embedded
in a paragraph of its own as
`<Asset src=".assets/<slug>/<entry>" label="<a few words>" device="desktop|mobile" />`,
where `device` is `desktop` for 1280×800 or `mobile` for 393×852. Name the entry for the state
it shows, such as `settings-empty.tsx`. The renderer ships with this skill; the project needs
none of it installed. Use fixed sample data, with no network or data fetching.

- **React projects**: a `.tsx` entry that default-exports the screen. Copy the real screen's
  source and change only what the task changes; import a copied stylesheet as
  `import "./globals.css"`, and Tailwind classes compile from it. Only React without hooks,
  `react-icons`, `next/link`, `next/image`, `clsx`, `tailwind-merge` and
  `class-variance-authority` are available.
- **Other web frameworks, such as Vue**: an `.html` entry. Copy the screen's template markup
  and its stylesheet inline, expanding child components, loops and conditions with the
  sample data.
- **Native UIs, such as Flutter or SwiftUI**: an `.html` entry that redraws the screen with the
  colours, fonts and spacing taken from the app's theme.

- **Whole screens**: one screen in one state per file, including the empty and failure
  states the task touches; draw each device the change reaches.
- **Every word**: titles, buttons, hints and error messages are part of the draft.
- **Reuse the contract**: place this contract's copy and images as they are, never redrawn.
