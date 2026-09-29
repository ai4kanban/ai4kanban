# Refine a card

Plan one card in this session until it can be built. Change no project code.

- **Split**: only when the card holds independently plannable areas and one is still vague,
  follow the group procedure in `akb guide add-task`, create each subtask with
  `--schedule refine`, and stop.
- **Spec agents**: when an agent's `description` matches the scope and its section is missing
  or outdated, run `akb spec <agent> <id> --print` here, then continue.
- **Think like the one who ships it**: settle facts from the code and authoritative sources,
  then cover what shipping the change takes beyond the happy path — for example existing data
  and settings, release and rollback, failure, access, and ongoing cost.
- **Questions**: settle every question you can answer with high confidence, even one worth the
  user's attention, and record the important ones under `## Decided by the agent`. Ask only
  what is left and passes the `[user]` test in `akb guide update-questions`.
- **Write**: shape the card as `akb guide writing` says, then run `akb raw validate <id>` and
  fix every reported line.

Follow the flow's closing steps. When no `[user]` question is open and the handover names the
build, build the card in this session; otherwise stop.
