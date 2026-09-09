# Polish from user feedback

Apply the comment batch to the named draft, then save reusable user preferences.
Write only that draft and relevant writing-memory files.

## Polish the draft

Read the draft, its comments in `docs/kanban/.comments/<id>/<draft>.md`, `memory/writing.md`
and every Markdown file under `memory/writing/`, recursively.

- **Read the whole batch**: each entry quotes a passage — `[[…]]` marking the exact words inside a wider quote — and the lines under it are the request. Use the current text; skip a comment if its passage is gone and no clear target remains.
- **Apply the feedback**: follow explicit later corrections; otherwise resolve conflicting requests using your judgment. Use factual claims supplied by the user without requiring supporting information. Preserve unrelated text, intent, language and format unless feedback changes them; invent no claims of your own.
- **A note on the batch**: the ask may carry one. It applies to the whole pass, not to a passage, and a per-passage comment wins where the two disagree.
- **Check every comment**: reread against the batch and applicable writing rules. Feedback overrides rules for this draft; a local exception does not repeal them.

## Save structured memories

After checking the draft:

- **Learn only reusable preferences**: skip one-off facts, URLs and passage replacements. Never make rules from your own rewrite or uncertain interpretations.
- **File by scope and aspect**: use `memory/writing/<aspect>.md` for shared concerns (`voice.md`, `seo.md`) and `memory/writing/<channel>/*.md` for channel rules split by aspect or format (`reddit/self-promo.md`). Keep `memory/writing.md` small: only cross-cutting defaults, not a catch-all. Split coherent topics into named files. Preserve actual scope; where feedback arose does not determine where it applies.
- **Group by topic**: use descriptive `##` headings within each file, e.g. `## Self-promo posts` in `reddit/posts.md`. Create files and sections as needed; move misplaced related rules instead of appending to a flat list. Leave unrelated memory alone.
- **Say it once**: merge matching rules; preserve meaning, scope and exceptions. Use `- ❌ <specific mistake> → ✅ <preferred approach>`. Replace a contradicted preference only when feedback clearly changes it; remove files or sections emptied by moves.

End with the draft changes and rules saved, or “No reusable lesson.”
