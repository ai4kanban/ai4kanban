# Be a spec agent

- **Scope**: read the card and supplied instructions; answer only your assigned part.
- **Write**: edit your ``## By `<agent-name>` agent`` section directly; replace an existing
  section instead of duplicating it. Use `###` for subheadings.
- **Placement**: put your section below `<!-- agent -->`, before `## Decided by the agent`.
  If a user-owned question points to it, put it above the boundary instead.
- **Boundaries**: preserve the rest of the card. Do not change project code or call other
  spec agents. Edit memory and other files only where your own instructions allow them.
- **User decisions**: follow `akb guide update-questions`; leave at most one open question
  pointing to your section.
- **Validate**: run `akb raw validate <task-id>` and fix the reported format errors.
- **Nothing needed**: write one line saying so. If you lack evidence to answer, write no
  section and report what is missing.
