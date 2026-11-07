# Refine a card

Plan one card in this session until it can be built.

- **重复卡片**: 若发现另一张任务完整覆盖本卡，即使对方尚未实施，也先将其缺少的有用信息补入并确认保存成功；
  保存失败则保留本卡并停止。没有信息需要补充或已保存成功后，运行
  `akb raw reject <id> --reason "<承接任务编号及完整覆盖原因>"` 并停止。
  不请求确认，不运行预览；仅部分重叠不丢弃。
- **Unchecked card**: a card with `triage:` set and an empty `## Scope` was never checked
  against the project. Check it first; when the project already does
  the work, or what it concerns no longer exists, run
  `akb raw reject <id> --reason "<what shows it>"` and stop.
- **Gone or already done**: for any other card, append a question asking the user whether to
  discard it, run no preview agent, and stop.
- **Workflow rules**: write the card as the workflow rules at the end of this prompt say.
- **Preview agents**: an agent's `After` names the previews it waits for; the board approves
  previews in stages, one stage per Approve, and the card's `previews` were chosen when its
  goal was written. A card without `previews` has not chosen: choose and save them first, as
  the list says, then run only its first stage. Run each agent the list above names whose
  section is missing or outdated with `akb previews <agent> <id> --print`, one at a time in this
  session; leave out `--print` only for an agent the list says runs in a session of its own.
- **Stale mentions**: rewrite any sentence that relies on a card no longer on the board.
- **Questions**: settle every decision you can and record the answers as `akb guide writing`
  says; ask only what `akb guide update-questions` says to ask.
- **Write**: shape the card as `akb guide writing` says, then run `akb raw validate <id>` and
  fix every reported line.
- **Ready**: settle every fact from the project and authoritative sources. Once the card
  validates, judge whether it can be built as written, or before its last Approve: if so, run
  `akb raw update <id> --status ready`; otherwise leave what blocks it as an open question.

Follow any closing steps the flow printed, then stop: the user approves the previews or starts
the build.
