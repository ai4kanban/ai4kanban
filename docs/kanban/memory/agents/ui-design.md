# ui-design

What I learned drawing this product's screens. Read before drawing.

## The product's look

- **Two design docs, one per app**: `kanban-ui/design.md` is the board (soft neo-brutalism —
  warm cream ground, white paper blocks, `1.5px` ink outline, hard `3px 3px 0` shadow, one
  ember accent). `web/design.md` is the public site. Read the one the card touches.
- **Ember is rationed**: `#dd4f1e` marks the action to press, the live thing, or the current
  selection — never decoration. Mint/sky/lilac/peach keep fixed meanings; `-soft` fills a
  chip, `-wash` grounds a whole section.
- **Characters differ by silhouette, pose and prop**: one figure repeated in every tile was
  rejected outright. The same body with a swapped hat or a recolour does not pass either.

## The Configuration dialog

- **1040 × 700, fixed**: a 200px nav column on the left, so a pane gets **792 × 607** to work
  in after its `24px` padding. A pane taller than that scrolls vertically; sideways it must
  never scroll.
- **Its parts are in `kanban-ui/components/settings.tsx`**: a captioned `Group`, a `Panel`
  inset (`nb-sheet`, hairline frame, no shadow), one `Row` per decision, and the `Switch`,
  `Note` and `Status` that go in them. Reuse their sizes — 11px uppercase captions with
  `0.1em` tracking, 13.5px bold row labels, 12px soft-ink body.
- **A pane has no title of its own**: the sidebar already names it. The captions are the
  whole of the structure.

## The Runs panel

- **Two panes, 1040 × 470**: a 240px rail of flow rows on the left — status dot, bold action,
  then `#id` (or nothing, on a card-less flow) and a `N sessions · time` line; a flow of more
  than one session threads its steps under it on a hairline rail. The right pane is the flow's
  title, its time, a peach band for how it ended, the `note` the user typed, then the run log.
- **The dots are the vocabulary**: ember pulse live, mint passed, sky the user stopped it,
  peach something went wrong or is waiting on you. `agent-shared.tsx` draws the blocker in
  peach with an uppercase kicker and a Step/Cause/To continue list; `FlowEnding` in
  `sessions.tsx` is the same peach band as one plain paragraph.
- **A pause normally reads on the card page**, as the title-band pill and one line that
  `cli/src/lib/agent/pause.ts` words. Where there is no card, the flow in Runs is the only
  surface left, and the way back is a command to copy rather than a button.
- **Delivery ids are lowercase 8 characters** from an alphabet with no look-alikes
  (`commit-mode.ts`) — never set one in an uppercase heading.

## Drawing a rendered-screen mockup

- **The frame is 1280 × 800** and the mockup runs in a sandboxed iframe: no scripts, no
  network, no fonts, no images. Art must be inline SVG — an `<img src="/…">` draws nothing.
- **Only plain Tailwind is compiled for it**, from the classes in the markup. The board's
  `nb-*` theme tokens do not exist there, so declare the palette as hex constants at the top
  of the file and pass colours through `style={{}}`.
- **Preview before finishing.** From `kanban-ui/`, transpile the `.tsx` with `sucrase`, run
  it in a `vm` context whose only global is `React`, render with `react-dom/server`, build
  the CSS with `tailwindcss`'s `compile()` over the markup's classes, then screenshot the
  page with `/Applications/Google Chrome.app/…/Google Chrome --headless --screenshot
  --window-size=1280,800`. `--force-device-scale-factor=2` is what makes small type legible
  enough to judge. This is the only way to catch a layout that overflows the dialog.
- **Screenshot one frame at a time** when a mockup stacks several: append
  `module.exports.<Name> = <Name>` to the transpiled source and render that component alone.
  A stacked mockup is taller than the 1280 × 800 frame, and a whole-page shot is too small
  to judge any one screen in.
