# Template selection

- **Keep the user's answer**: when the card records a picked template, apply it without searching again; when the user rejected them all, plan on a saved format; while a template question is unanswered, write no pages and do not search again.
- **Tags first**: once the brief is written, run `akb cloud template list-tags --category carousel`, then pick the main tag that best fits the post's content.
- **Search within the tag**: run `akb cloud template search --category carousel --tags <tag>`, adding topic keywords when they help; it returns bounded metadata only.
- **No match**: when no tag or result fits the content and the post's language, or the catalog cannot be reached, plan on a saved format; never widen the search or pad the candidates.
- **Preview up to three**: pick at most three that fit, and fetch each with `akb cloud template preview <name> --to <board-state>/assets/<card id>/`.
- **Ask first**: show the previews in your section, leave one `[user]` question with `akb guide update-questions` to pick one or reject them all, and stop.
- **Apply the pick**: only then run `akb cloud template get <name> --to <board-state>/assets/<card id>/<name>/` and follow its `template.md` in place of a saved format — its page types, look, length limits, content file and render command; your general rules still govern the copy.
- **Memory**: on completion, keep only this post's content files in `examples/<name>/` and its corrections in `format-<name>.md`; the template itself stays in the catalog.
