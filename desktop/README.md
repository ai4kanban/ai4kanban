# AI4Kanban, as an app

The board in a window. Download it, open it, point it at a project — no Node, no npx, no
terminal to keep alive.

**[Download the latest release →](https://github.com/ai4kanban/ai4kanban/releases/latest)**

Starting runs still needs a coding agent on the machine (Claude Code or Codex). The app
reads your own login shell environment when it starts, so an agent installed the normal
way is found even though nothing here came from a terminal.

## Which builds ship

| System | Build | Signed | Tested |
| --- | --- | --- | --- |
| macOS (Apple Silicon, Intel) | `.dmg` / `.zip` | yes | yes |
| Windows | `.exe` installer | no | no |
| Linux | `.AppImage` | no | no |

macOS is the one we test each release. Windows and Linux are built and published untested
until someone reports otherwise, and both are unsigned this release, so the system warns on
first open:

- **Windows** — SmartScreen says "Windows protected your PC". Click **More info** →
  **Run anyway**.
- **Linux** — make it executable and run it: `chmod +x AI4Kanban-*.AppImage && ./AI4Kanban-*.AppImage`.

## What it is

It is a window onto the board UI (`../kanban-ui`), not a second version of it. The app
ships that same prebuilt server, starts it on a private loopback port under the user's own
shell environment, and shows it. Every button, run and log in the app is the board UI
itself — so a fix there is a fix here.

What the app adds, and all it adds:

- **Which project.** It asks on first launch and remembers it. The folder badge in the
  header opens another one; so does **File → Open Project…**. One board at a time, and a
  folder with no board lands on the make-a-board screen.
- **Finding your agent.** `$SHELL -ilc 'env -0'` at startup, so runs inherit the PATH a
  terminal would have given them (`lib/shell-env.js`).
- **Ending cleanly.** Closing the window ends the board server and every agent run under
  it — the server child leads its own process group for exactly this reason.
- **Saying a newer version is out.** Read from the newest GitHub release, shown as a line
  above the board with a link. The app never updates itself.

## Working on it

```
npm install
npm start          # builds the board UI if it isn't built, then opens the app
npm run bundle     # rebuild the board UI into resources/server/
npm run dist:mac   # package for macOS (see PUBLISHING.md for signing)
```

`resources/server/` is a build product of `../kanban-ui` and is gitignored. The version
comes from the root `VERSION` file — `node scripts/sync-version.mjs` stamps it here too.

How the app ships, and how the Mac build gets signed, is in the repo's `PUBLISHING.md`.
