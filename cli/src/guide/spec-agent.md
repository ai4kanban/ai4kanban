# Be a spec agent

- **Scope**: read the card and supplied instructions; answer only your assigned part.
- **Write**: edit your ``## By `<agent-name>` agent`` section directly; replace an existing
  section instead of duplicating it. Use `###` for subheadings.
- **Finish your part**: write your assigned planning content on the card now; never defer
  it to implementation.
- **Placement**: put your section in the half this run names, and leave it there. When that
  is the agent half and one unanswered `[user]` question points at your section, put it above
  `<!-- agent -->` until that question is answered.
- **Boundaries**: preserve the rest of the card. Do not change project code or call other
  spec agents. Edit other files only where your own instructions allow them.
- **Memory**: `docs/kanban/memory/agents/<agent-name>/` is yours, and this run shows every
  file in it. Your instructions say which files you keep there and what each holds; with no
  such instructions, keep none. Edit a file directly when you learn something lasting,
  creating it if missing; merge duplicates and drop what your instructions already say.
- **User decisions**: follow `akb guide update-questions`; leave at most one open question
  pointing to your section, appended with `--agent <agent-name>`.
- **Validate**: run `akb raw validate <task-id>` and fix the reported format errors.
- **Nothing needed**: write one line saying so. If you lack evidence to answer, write no
  section and report what is missing.
