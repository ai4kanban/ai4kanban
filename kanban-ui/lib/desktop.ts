// Is this board running inside the desktop app, or being served to a browser?
//
// The app (../desktop) starts this very server and sets KANBAN_DESKTOP=1 on it.
// Two things turn on that answer, and nothing else does: the app offers its own
// folder picker where the browser can only name a command to type, and the
// browser gets the notice that opening the board this way is deprecated.
//
// It is read on the server, not sniffed in the browser, so the first paint is
// already right — no bar that flashes up and disappears.

export function isDesktop(): boolean {
  return process.env.KANBAN_DESKTOP === "1";
}
