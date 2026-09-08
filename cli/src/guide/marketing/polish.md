# Polish from user feedback

Apply one draft's comment batch, then save only reusable lessons from that feedback.
Write only the named draft and relevant writing-memory files. Leave the card, other
drafts and comments file alone.

## Read the feedback

Read the named draft, its list in `docs/kanban/.comments/<id>.json`,
`memory/writing.md` and every file under `memory/writing/`.

- **Anchor by quote**: `quote` identifies the passage; `from` and `to` are hints. `words` is the user's request.
- **Use the current draft**: if the quote has changed or disappeared, apply the request where it still fits; never restore deleted text just to edit it.
- **Resolve together**: read the whole batch before editing. Follow an explicit later correction; do not guess between incompatible requests.

## Polish

- **Apply every request**: make one coherent edit, changing neighbouring text only when needed. Keep unrelated text unchanged.
- **Preserve intent**: retain the argument, language and channel format unless the feedback explicitly changes them. Invent no facts or claims.
- **Check the result**: reread against every comment and applicable writing rule. User feedback takes precedence for this draft; a local exception does not repeal a general rule.
- **Block when necessary**: if a request cannot be resolved, run `akb raw run-blocker <id> --step ".." --cause ".." --unblock ".."` and stop without saving memory. Do not silently drop it.

## Save memories

Finish and check the draft before updating memory.

- **Learn from the user**: save a correction only when the feedback establishes a preference that applies to future pieces. Never turn your own rewrite or an uncertain interpretation into a rule.
- **Skip one-off edits**: facts, URLs, numbers and passage-specific replacements are not writing rules. No reusable lesson means no memory edit.
- **File by topic**: a lesson goes to the `memory/writing/` file whose topic it belongs to — what the rule checks, not the language, format or channel it was learned on. A rule that holds for one language or format only says so in its own wording. What no topic file covers stays in `memory/writing.md`.
- **A new file only when no topic fits**: name it for what it checks, one plain word where possible — `seo.md`, `voice.md`, `structure.md`. Never widen a rule to fit an existing file. File it once: a lesson touching two topics goes to the one it is mainly about. Source feedback cannot establish a channel-format rule.
- **Say it once**: update an existing matching rule or add `- ❌ <specific mistake> → ✅ <preferred approach>`, preserving the user's meaning and qualifiers. Replace a contradicted rule only when the feedback clearly changes the standing preference.
- **Keep edits small**: use the existing heading; create a topic file only when needed. Do not reorganize or prune unrelated memory.

End with a brief account of the draft changes and rules saved, or “No reusable lesson.”
