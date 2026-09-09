# Marketing board context

Work only on the files named by the current flow. Read additional context only when needed.
Paths below are relative to `docs/kanban/`.

- **`todo/<id>.md`**: topic metadata; no card body. Use `akb raw` commands for frontmatter changes.
- **`content/<id>/source.md`**: the user's source argument. Repurposing preserves it; polish edits it only when it is the named draft.
- **`content/<id>/<channel>.md`**: one channel's draft; supporting assets share the topic folder.
- **`memory/writing.md`**: small entry point and cross-cutting defaults; split coherent topics into named files.
- **`memory/writing/<aspect>.md`**: shared writing concerns, such as `voice.md`, `structure.md` or `seo.md`.
- **`memory/writing/<channel>/*.md`**: channel-specific rules split by aspect or format, such as `reddit/posts.md`. Use topic headings within every file; read nested files too.
- **`memory/decisions.md`**: positioning, audience and permitted claims; pillar-specific decisions may live under `memory/<pillar>/`.
- **`memory/rejected.md`**: rejected topics and reasons; pillar-specific rejections may live under `memory/<pillar>/`.
- **`memory/published.md`**: date, channel, URL and result for each published piece.

## What earns a note

Memory holds only what improves a future choice. Writing nothing is a normal, complete
outcome — never manufacture a lesson to satisfy a closing step.

- **Honor an opt-out**: told not to record, write no memory at all for that action, and
  finish what was asked for.
- **Require lasting value**: a durable preference, constraint, decision, or lesson that
  would materially change a later call. Nothing else.
- **Skip housekeeping**: a duplicate, a routine status change, and a fact already captured
  elsewhere earn no note. Rejecting a duplicate says nothing about the topic.
- **Merge, don't repeat**: rewrite an equivalent entry in place instead of adding a second.

`memory/published.md` is the record of published work, not a note — it follows the archive
step below.

Follow the current flow's guide: `repurpose`, `polish`, `marketing-polish-loop` or
`prune-memory`. Do not start another flow unless instructed.

For an archive request, confirm every chosen channel is published and recorded in
`memory/published.md`, then run `akb raw archive <id>`. Keep `content/<id>/`.
