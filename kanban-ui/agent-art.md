# The agent characters

Configuration → Agents draws one character per agent. This is the recipe for the next one:
generate the image, name it after the agent, and commit it.

- **Where a file goes**: `kanban-ui/public/agent-art/<agent name>.png` — `builder.png`,
  `ui-design.png`. The name is the agent's own name from the catalog, not a title.
  `public/agents/` is a different folder: those are the coding agents' brand logos.
- **What draws without a file**: the pane draws the agent's first letter in the same pixel
  style. That is the normal state for an agent a project adds, so only the agents the
  command ships need art.

## The shared style line

Put this in front of every prompt below. It is what makes six characters read as one team.

> Pixel art sprite on a 16×16 pixel grid, exported at 96×96 PNG with hard pixel edges and a
> fully transparent background. One character, front-facing, centred, filling the frame from
> top to bottom. A 1-pixel charcoal `#24231f` outline all the way round, white `#ffffff`
> skin and shirt, and exactly one accent colour per character used only on the prop. No
> text, no shadow, no background, no gradients, no anti-aliasing.

Accents, one each, from `app/globals.css`: ember `#dd4f1e`, mint `#7fca9c`, sky `#7fb4e0`,
lilac `#b199e0`, peach `#ec9a72`.

## One prompt per agent

Each names the job and the one thing that separates that character from the others — a
different silhouette, a different pose, and a prop nobody else carries. The same body with a
swapped hat does not pass.

- **`planner.png`** — plans and refines cards. Standing straight, arms down, holding a
  **lilac clipboard** flat against the chest. Short neat hair, no headgear. The narrowest
  silhouette of the six.
- **`builder.png`** — builds cards and lands them. A wide, heavy stance with a **peach hard
  hat** whose brim breaks the head's outline, and a tool belt across the waist. The widest
  silhouette of the six.
- **`reviewer.png`** — checks what was built. Leaning forward slightly, holding a **sky
  magnifying glass** up beside the head so the lens sticks out past the body's edge.
- **`writer.png`** — writes the drafts and repurposes them (marketing boards). Seated at a
  low desk, both hands down, an **ember pen** held upright in one. The only seated character.
- **`ui-design.png`** — draws the screen a card changes. Holding a **mint canvas panel**
  across the front of the body, wide enough to hide the torso, with a brush in the free hand.
- **`technology-selection.png`** — picks the library a card leans on. Holding a **lilac stack
  of three blocks** out to one side at arm's length, weighing it, with round glasses on.

## Checking a result

- The six read as different workers at a glance, at 48px, without their names.
- They read as one family: same canvas, same pixel size, same outline weight.
- The background is transparent — the tile's paper shows through, and a paused agent is
  greyed by the pane rather than by the file.
