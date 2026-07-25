# Run the board locally (kanban-skill-ui)

An optional Next.js app that shows the board and drives the work from buttons instead of the
terminal. The board works fully without it; set it up only when you want the buttons. The
markdown files in `docs/kanban/` stay the single source of truth.

**This page is setup only — how to get it running.** Using it (what each button does, group
tasks, the Configuration dialog) is documented with the app itself:
<https://www.npmjs.com/package/kanban-skill-ui>, or `kanban-ui/README.md` in its repo.

## Run it

From your repo root (the folder that holds `docs/kanban/`):

```
npx kanban-skill-ui        # http://localhost:7420
```

Localhost only. It ships a prebuilt server (nothing to compile) and finds the board by
walking up to the first `docs/kanban/todo/`. Options:

```
npx kanban-skill-ui --board ../my-repo   # a board elsewhere (or set KANBAN_BOARD_DIR)
npx kanban-skill-ui --port 4000          # a different port
```

There's nothing to install — `npx` fetches the package and caches it. To pick up a newer
release, run it once as `npx kanban-skill-ui@latest`; later plain `npx kanban-skill-ui` runs
reuse that. (Prefer a permanent command? `npm install -g kanban-skill-ui`, then run
`kanban-skill-ui`, and `npm update -g kanban-skill-ui` to upgrade.)

Nothing else to set up: the app keeps its own settings next to the board, and creates them
when it first needs them. What those settings are, and what the buttons do, is in the app's
guide (linked above).
