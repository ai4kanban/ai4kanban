# The module map

Write and repair `docs/kanban/modules.md` — a plain list of the project's modules.

A module is anything maintained in the codebase that grows independently. Judged by
meaning, not by folder; a handful of lines, not one per folder.

Keep the list short. A simple single-purpose project is one module, and more lines come
only as the code grows. Be strictest in a repo with no code, where the plan is all there
is to read: one line per part the plan clearly keeps separate, not one per piece it
mentions.

## Examples

A repo with `server/`, `packages/core/`, `web/`, `cli/`, and `docs/` might map to:

```
If a line here disagrees with the repo you just read, fix the line.

- **api** — the backend server and its shared core. `server/`, `packages/core/`.
- **web-app** — the browser app users sign into. `web/`.
- **cli** — the command-line client. `cli/`.
- **docs** — the public documentation site. `docs/`.
```

Five folders, four modules — the server and its core always change together, so they
are one line.

A repo with no code, where the plan names a phone habit tracker, a syncing server, a
database, a login flow, and push notifications:

```
- **app** — the phone app people record habits in. No code yet.
- **sync** — the server that keeps devices in agreement. No code yet.
```

Five pieces, two modules — the database, the login flow, and the notifications each live
inside one of those two.

## Repair

Whoever reads the map and sees it disagree with the repo fixes it in the same run: add
the missing line, delete or rename the dead one, fix a stale path. If the user says the
map is wrong, rebuild from scratch.
