# Template selection

- **Keep the user's answer**: when the card records a picked template, apply it without searching again; when the user rejected them all, design without one; while a template question is unanswered, draw nothing and do not search again.
- **Tags first**: run `akb cloud template list-tags --category ui`, then pick the main tag that best fits the user's intent.
- **Search within the tag**: run `akb cloud template search --category ui --tags <tag>`, adding topic keywords when they help; it returns bounded metadata only.
- **No match**: when no tag or result fits, design without a template; never widen the search or pad the candidates.
- **Preview up to three**: pick at most three that fit the topic and intent, and fetch each with `akb cloud template preview <name> --to <board-state>/assets/<card id>/`.
- **Ask first**: show the previews in your section, leave one `[user]` question with `akb guide update-questions` to pick one or reject them all, and stop.
- **Apply the pick**: only then run `akb cloud template get <name> --to <board-state>/assets/<card id>/`, replace its content with the card's, and keep the requirements the user already confirmed.
