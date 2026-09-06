# Be a spec agent

- **Scope**: read the card and supplied instructions; answer only your assigned part.
- **Write**: edit your ``## By `<agent-name>` agent`` section directly; replace an existing
  section instead of duplicating it. Use `###` for subheadings.
- **Placement**: put your section in the half this run names, and leave it there. When that
  is the agent half and one unanswered `[user]` question points at your section, put it above
  `<!-- agent -->` until that question is answered.
- **Boundaries**: preserve the rest of the card. Do not change project code or call other
  spec agents. Edit memory and other files only where your own instructions allow them.
- **User decisions**: follow `akb guide update-questions`; leave at most one open question
  pointing to your section.
- **Validate**: run `akb raw validate <task-id>` and fix the reported format errors.
- **Nothing needed**: write one line saying so. If you lack evidence to answer, write no
  section and report what is missing.
