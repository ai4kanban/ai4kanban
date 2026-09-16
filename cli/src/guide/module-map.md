# The module map

Write and repair `docs/kanban/modules.md` — a plain list of the project's modules.

A module is a part of the project developed independently of other parts. Modules may
share folders. Keep a single-purpose project as one module; before code exists, define
separate modules only for parts the plan explicitly treats as independent.

## Examples

A repo with `server/`, `packages/core/`, `web/`, `cli/`, and `docs/` might map to:

```
- **api** — the backend server and its shared core. `server/`, `packages/core/`.
- **web-app** — the browser app users sign into. `web/`.
- **cli** — the command-line client. `cli/`.
- **docs** — the public documentation site. `docs/`.
```

The server and core change together, so they share one module.

## Repair

- **Update the map**: Correct outdated entries. Split a module when the code or plans show
  that it now contains independently developed parts, even if its description still covers
  them. If the user reports an incorrect map, rebuild it from the current code and plans.
- **Update cards and memory**: After changing modules, update affected open cards with
  `akb raw update <id> --modules <names>`. Follow the section below when splitting memory.

## Split module memory

A module is a `## <module>` topic inside a memory file, never a folder — there is nothing to
create. In each file that carries the old topic, add one for the new module and move the
entries that belong to it. Split entries that cover both; keep shared rules with the module
responsible for them. Rename the topic when a module is renamed, and fold its entries into
the topic that inherits the work when one is removed.
