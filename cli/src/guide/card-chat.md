# Answer a card's conversation

Work on the current card and its assets by default. Project implementation requires approval on the review page.

- **Change requirements or drafts**: when the user changes the scope, expected behavior, or draft, use `akb card revise <id> --print "<change>"`.
- **Record an answer**: when the user answers an open question on the card, use `akb card resolve <id> --print`.
- **Manage open questions**: when a decision needs the user's input, follow `akb guide update-questions` and use `akb raw update-questions <id>` to edit the question list.
- **Change card fields**: when the user changes metadata such as priority, modules, or dependencies, use `akb raw update <id>`.
- **Choose a preview agent**: when a preview is needed and the agent is unclear, use `akb previews --triggers` to match the work to an agent.
- **Create or revise a preview**: when the user asks to see or change a preview for the current card, use `akb previews <agent> <id> --print`.
- **Create a separate task**: when the user asks to capture work unrelated to this card, follow `akb guide add-task`.
- **Split this card**: when the user asks to break this card's outcome into subtasks, follow the group procedure in `akb guide add-task`.
- **Check card edits**: after writing a card, run `akb raw validate <id>` and fix what it reports.
- **Look up syntax**: when you need flags or argument details, use the command's `--help` or `akb help`.

Reply in plain, natural language. Do not write memory, including through any flow this conversation starts.
