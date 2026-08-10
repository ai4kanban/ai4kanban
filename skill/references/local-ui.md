# Run the board locally

The board in a window: it shows every track and drives the work from buttons instead of the
terminal. The board works fully without it; get it when you want the buttons. The markdown
files in `docs/kanban/` stay the single source of truth.

**This page is setup only — how to get it running.** Using it (what each button does, group
tasks, the Configuration dialog) is documented with the app itself:
<https://www.npmjs.com/package/ai4kanban-ui>, or `kanban-ui/README.md` in its repo.

## Get the app

Download it and open it: <https://ai4kanban.dev/download>

Nothing to install first — no Node, no npx, no terminal. It asks which project folder to
open the first time and remembers it; the folder path in its header opens another one. A
folder with no board is fine — it offers to make one there.

- **macOS** — the build we test and sign, so a fresh download opens with a double-click.
- **Windows and Linux** — built and published untested this release, and unsigned, so the
  system warns on first open. The download page says the one step past it.

Starting runs still needs your coding agent on the machine, same as from a terminal. The app
reads your own login shell environment when it starts, so an agent installed the normal way
is found.

To move to a newer version, download it — the app says when one is out and never updates
itself.

## The old way: run it yourself (deprecated)

Deprecated as of the release that shipped the app. It keeps working, and the package is
frozen rather than pulled, so a board someone opens tomorrow still comes up — but no release
lands there again, and nothing new is built for it. Use it only if the app can't run on your
machine.

```
npx ai4kanban-ui                      # deprecated — http://localhost:7420
npx ai4kanban-ui --board ../my-repo   # a board elsewhere (or set KANBAN_BOARD_DIR)
npx ai4kanban-ui --port 4000          # a different port
```

Localhost only. It ships a prebuilt server (nothing to compile) and finds the board by
walking up to the first `docs/kanban/todo/`.

The pages themselves are not deprecated — the app is those same pages in a window, and
reaching the board from another device still needs a server. What is deprecated is asking a
person to start one and open a browser.
