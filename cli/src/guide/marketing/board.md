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

Follow the current flow's guide: `repurpose`, `polish`, `marketing-polish-loop` or
`prune-memory`. Do not start another flow unless instructed.

For an archive request, confirm every chosen channel is published and recorded in
`memory/published.md`, then run `akb raw archive <id>`. Keep `content/<id>/`.
