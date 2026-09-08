# Extract topics from a source

## 1. Extract

Read the whole source. Extract the claims worth a piece of their own: a question the reader
already has, a belief worth changing, a result worth showing.

**Rules**:

- **Strong signal only**: skip general lessons and thin angles; zero candidates is valid.
- **One piece, one argument**: a candidate that needs two is two candidates, or neither.

## 2. Route and validate

Read `docs/kanban/config.md`, `docs/kanban/memory/decisions.md`,
`docs/kanban/memory/published.md`, `docs/kanban/memory/rejected.md` and
`docs/kanban/modules.md`. Assign each candidate to the pillar it belongs to.

Return `add` or `skip`, with one line of evidence.

**Rules**:

- **Existing pillars only**: do not invent a pillar to fit an outside idea.
- **Validation gate**: keep only what this board may claim, has not published, and has not
  already turned down.
- **Nothing repeats what is out**: a topic that says again what `published.md` records is a
  topic to skip.

## 3. Create

Send each surviving candidate to `akb guide add-task` — adding `--proposed` to the `create`
call, because the board found this topic rather than a person asking for it — then report
what was created and skipped.

Write no draft: the report is where each topic's provenance is named, as `<name or
description> — <URL, file, or message context>`, never a generic label such as "external
research".
