# The agent characters

Every built-in agent is the same small robot dressed for its job. The art is drawn in code —
`character-design/draw.mjs` — and `character-design/README.md` is the spec.

- **Where a file goes**: `node character-design/draw.mjs` writes each agent's 48×48 front
  view to `public/agent-art/<agent name>.png`, the name being the agent's own name from the
  catalog. It also rewrites the site's copies in `web/public/agent-art/` that already exist
  (the site's `planner.png` is `software-planner`) and the office atlas
  `public/run-scene/cast.{png,json}`, and inlines the avatars into `lib/agent-art.ts` — the
  app draws from there, so a PNG added by hand needs `node scripts/inline-agent-art.mjs`.
- **What draws without a file**: `base.png`, the plain robot with a blank patch on its arm.
  `Agents.tsx` lays the agent's first character over the patch, so an agent a project adds
  needs no art. `public/agents/` is a different folder: the coding agents' brand logos.
- **Adding a job**: follow "Adding a job" in `character-design/README.md`, rerun `draw.mjs`,
  and check `preview.html`.
