# The agent characters

Configuration → Agents draws one character per agent. This is the recipe for the next one:
generate the image, name it after the agent, and commit it.

- **Where a file goes**: `kanban-ui/public/agent-art/<agent name>.png` — `builder.png`,
  `ui-design.png`. The name is the agent's own name from the catalog, not a title.
  `public/agents/` is a different folder: those are the coding agents' brand logos.
- **What draws without a file**: `base.png` — the same character with no prop — holding a
  card with the agent's initial, in one of the palette's five inks picked from its name.
  That is the normal state for an agent a project adds, so only the agents the command ships
  need art. The card is drawn over the PNG in `Agents.tsx`, not baked into it.
- **Still missing**: `writer.png`, the marketing board's role.

## The shared style line

Put this in front of every prompt below. It is what makes the characters read as one team:
they are the same robot, and only the prop tells them apart.

> Pixel art sprite exported at 96×96 PNG with hard pixel edges and a fully transparent
> background. One small black robot, front-facing, centred, standing on two stubby legs and
> filling the frame from top to bottom. Charcoal `#141312` rounded body, a cream `#f6f2e6`
> visor face with two mint `#3fa87a` rectangular eyes, a thin antenna topped with an ember
> `#f4511e` square, one arm holding the prop and the other a plain square hand at the end of
> a thin wire arm. No text, no shadow, no background, no gradients, no anti-aliasing.

Prop accents come from `app/globals.css`: ember `#dd4f1e`, mint `#7fca9c`, sky `#7fb4e0`,
lilac `#b199e0`, peach `#ec9a72`.

## One prompt per agent

Each names the job and the one prop nobody else carries. Same body, different prop — that is
the whole difference, and it has to be readable at 48px.

- **`planner.png`** — plans and refines cards. Holding a **three-column board** across the
  chest, its columns mint, ember and sky, each with a couple of cards in it.
- **`builder.png`** — builds cards and lands them. Holding an **ember hammer** upright on a
  wooden handle, head above the shoulder.
- **`reviewer.png`** — checks what was built. Holding a **peach-rimmed magnifying glass** up
  beside the head so the lens breaks the body's outline; a small sky mark inside the lens.
- **`writer.png`** — writes the drafts and repurposes them (marketing boards). Holding an
  **ember pen** upright, nib up, with a sheet of paper against the chest.
- **`ui-design.png`** — draws the screen a card changes. Holding a **browser window** across
  the chest — title bar with two dots, one lilac block and two pale panels — and a **peach
  pencil** in the free hand.
- **`technology-selection.png`** — picks the library a card leans on. Holding **two
  interlocking puzzle pieces**, one sky and one mint, meeting in front of the body.

## Checking a result

- The characters read as different workers at a glance, at 48px, without their names —
  which means the prop, not the body, carries it.
- They read as one family: same robot, same canvas, same pixel size, same baseline, so a row
  of them stands on one ground line.
- The background is transparent — the tile's paper shows through, and a paused agent is
  greyed by the pane rather than by the file.
