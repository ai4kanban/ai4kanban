## Draw it as the real screen

One file per option, named for its label: `a.tsx` is the option labelled `A`.

- **`.tsx`**: one default-exported React component, using only React, Tailwind classes and
  inline icons. This is the format to reach for.
- **`.html`**: a complete, self-styled page. Use it for a screen that is not a component.

Match the product's own look — inspect its screens and reuse their colours, fonts and
spacing. If it has no style yet, use a plain, neutral one.

Even a plain screen takes a long file, so what you trim to stay inside one screen is detail
out of the drawing, never lines out of the code.

A screen that is not a web page — a terminal, a command's output — is drawn as monospaced
text inside the mockup like anything else, so a card never carries two kinds of drawing.
