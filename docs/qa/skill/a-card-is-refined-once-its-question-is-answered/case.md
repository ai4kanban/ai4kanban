# 回答完卡片上最后一个问题，同一轮里细化到 ready

## Setup

- **看板**：接着 [建一张卡，让看板把它规划好](../create-a-card-and-let-it-plan/case.md) 的项目——#2「Rewrite the README as a one-minute quickstart」已细化过，带一个 `copywriting` 的 `[user]` 问题；看板文件已提交。
- **从没细化过的卡**：`akb raw create --title "Add a notes delete command" --question "[user] How does a user pick the note to delete?" --recommended-option "By its number in notes list" --option "By matching its text"`，得到 #3——`## Scope` 仍是建卡脚手架，状态 `todo`。
- **Agent**：默认的 Claude Code，真实运行，要已登录。
- **终端**：zsh，在项目根目录，不在任何 Claude Code 会话里（否则 `raw create` 会把那段对话记成 #3 的讨论，规划会接着它）；日志里的 `akb` 就是这次构建出的命令。

## Steps

1. 执行 `akb card resolve 2 "A — keep install from a copy of the repository"`。
   打印 `resolve — run <id>` 和跟踪、停止的命令。
   [01-resolve-2.log](01-resolve-2.log)

2. 半分钟后执行 `akb run log <这次 resolve 的 id>`。
   第一行 `[board] started from a copy of the session this card was created in`；回话说答案已写进卡片、问题已去掉、卡片已标为 **ready**，并提醒草稿 README 本身没被明确批准。
   [02-resolve-2-log.log](02-resolve-2-log.log)

3. 打开这次运行的会话记录（`~/.claude/projects/<项目>/<run id>.jsonl`）看这一轮的命令。
   只按答案改了受影响的那几行（安装方式那句），没有重做整张卡；同一轮里 `--drop 1`、`akb raw validate 2`、`akb raw update 2 --status ready`。
   [03-resolve-2-commands.log](03-resolve-2-commands.log)

4. 执行 `akb card resolve 3 "By its number in notes list"`。
   打印 `resolve — run <id>`。
   [04-resolve-3.log](04-resolve-3.log)

5. 一两分钟后执行 `akb run log <这次 resolve 的 id>`。
   回话说「its scope is still the blank template」，所以完整细化了整张卡；同一轮里跑了 `ui-designer` 专项（两张终端界面的稿），最后标为 **ready**。
   [05-resolve-3-log.log](05-resolve-3-log.log)

6. 打开这次运行的会话记录看命令。
   `akb guide resolve` 之后是 `akb guide refine`、`akb spec ui-designer 3 --print`、`akb raw validate 3`、`akb raw update 3 --status ready`，都在这一个会话里。
   [06-resolve-3-commands.log](06-resolve-3-commands.log)

7. 执行 `akb card revise 3 "Ask y/N before deleting; --yes skips the prompt"`。
   打印 `edit — run <id>`。
   [07-revise.log](07-revise.log)

8. 一分钟后执行 `akb run log <这次 edit 的 id>`。
   第一行 `[board] continuing the session this card was last planned in`——修改接着上一步的规划会话；卡片改为先确认、`--yes` 跳过，仍是 ready。
   [08-revise-log.log](08-revise-log.log)

9. 执行 `akb run list`。
   只有用户发起的四次运行：`create`、`resolve #2`、`resolve #3`、`edit #3`；没有另起的 `clarify` 或专项运行；`nothing running.`
   [09-runs.log](09-runs.log)

10. 执行 `akb raw list`。
    #2、#3 都是 `ready`，没有 open question。
    [10-list.log](10-list.log)

## Feedback

- **答完就能开工**：以前答完问题卡片停在 `todo`、要等看板过几分钟自己规划；现在一次答复就走到 ready，`run list` 上一行就是一件事。
- **力度掂量得合理**：只改了一句话的 #2 半分钟、$0.12；Scope 还是空模板的 #3 完整规划、带专项稿，1 分 39 秒、$0.64。
- **`run log` 没说「细化了」**：#2 的回话只说「marked ready」，看不出这一轮做过细化判断；会话记录里也没有重新执行 `akb guide refine`（会话从建卡那轮复制来，规则已在上下文里）。
- **ready 时还有一句「请先读草稿」**：#2 的 README 草稿用户并没有明确批准，agent 照样标了 ready，只在回话里提醒；只看看板列表的人不会注意到。
- **会话承接看得见**：三种第一行（copy / new session / continuing）把「这一轮接着哪段会话」说得很清楚。
- **专项和细化的长命令被截断**：`run log` 每条只显示第一行，`akb spec ui-designer 3 --print` 能看到，是因为它恰好在行首；藏在长命令中间的就看不到。
- **没有跑到的**：在界面里按「答复」、答案整个改变一张细化过的卡（应完整重做）、答完后还有新问题留下的那一种结局、构建/评审另开会话、用 `akb raw update-questions` 直接答题后看板定时器的自动细化（旧版本的第 5–10 步，与这次改动无关，已从本用例移出）。
