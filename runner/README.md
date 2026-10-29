# wildcrane-runner

WildCrane's Local Runner. It connects this computer to WildCrane and runs the tasks WildCrane
sends on your local Claude Code, Codex, OpenCode or Cursor.

- **Mac and Windows**: download WildCrane from the
  [releases](https://github.com/ai4kanban/ai4kanban/releases?q=desktop-v&expanded=true). It sits
  in the menu bar (tray), signs in once, and notifies you when something needs your review. The
  release notes say how to open the unsigned build the first time.
- **Linux, or no desktop**: run it from a terminal; it runs tasks and shows no notifications.

```sh
npm install -g wildcrane-runner
wildcrane-runner
```

The first start opens your browser to sign in. Every start updates to the version WildCrane
names, and falls back to the previous one if the new one does not start.

- **Node**: 22 or newer.
- **One computer per account**: a second computer is refused while the first is connected.
- **Folders**: tasks run in `~/.wildcrane/work/`, or in a project folder listed in
  `~/.wildcrane/projects.json` (`{ "projects": ["/path/to/project"] }`). Any other folder is
  refused. The desktop app writes that list when you add a project in its settings.
- **Task folders**: a task's jobs share its board, `<project>/.akb/kanban` (kept out of git),
  or for a project with no folder here its own one, `~/.wildcrane/cache/<project>/.akb/kanban`
  (a git repository). They run one at a time and sync the card, memory and assets with
  WildCrane before and after each job.
- **Cache**: what a project keeps here is rebuilt from WildCrane by its next job. At start and
  once a day the Runner removes a project unused for 7 days or no longer in your account — its
  whole `cache/<project>/`, or only a linked folder's `.akb/` — unless a job runs there, a
  delivery is paused there, or its last sync failed.
- **Runner files**: `~/.wildcrane/bin/` holds the downloaded versions and the `akb` shim.
- **Periodic agents**: in each project folder it also runs the board's own agents (reflect,
  describe-project, review-dismissals, prune-memory) and each workflow's scheduled agents, when
  due by this computer's clock — on your runtime, so they use its quota.
- **akb**: tasks started from WildCrane run akb's workflows with the copy of `akb` the Runner
  carries (`dist/akb/`), on whichever of those the task's runtime names.

## Development

`npm install` here (it builds `dist/`), `npm test`, `npm run lint`. The Runner bundles the CLI's
harness, session and Realtime code from `../cli/src`, and the CLI itself into `dist/akb/`, so
`cli/` needs its own `npm install`.
Releasing: [`docs/deploy.md`](../docs/deploy.md).

The desktop app is `desktop/`: a Tauri 2 shell running the bundled Node on `dist/launcher.mjs`
with `WILDCRANE_DESKTOP=1`; the two speak JSON lines (`src/desktop.ts`). It needs Rust.
`npm install --include=dev` there, then `npm run dev`; `npm run lint` typechecks the windows,
`node scripts/preview.mjs` draws every window state into one page.
Releasing: [`docs/deploy.md`](../docs/deploy.md).
