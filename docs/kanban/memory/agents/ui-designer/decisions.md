# What the user chose for `ui-design`

One line per durable choice the user made about these designs.

## Layout

- **布局要平衡**：内容短时把操作放到详情对侧或提示条内，不让右侧空出一大片。
- **整行说明太占地方**：「与 X 共用」这类后果说明收成名称旁的小标签，细节放悬停提示，腾出的行给操作。
- **示例问题只作启发**：一行小号灰字打字机轮播，不做成可点的按钮。
- **悬停才出现的行内操作不预留位置**：不悬停时文字用满整行，悬停时才截断到操作按钮前。
- **悬停提示只给纯图标按钮**：带文字的按钮靠文字说明，不加；窄屏收成纯图标时才加。

## Runtimes

- **A runtime is the whole bundle, under a name the user typed**: 运行时 is the bundle, 连接器
  is the CLI, 模型 is only the model-id box inside it; nothing calls the bundle a model.
- **Global default is the first row, not a badge**: it cannot be deleted or renamed, and
  picking it clears a pick.
- **连接器 stays the harness card grid inside the row**, never a dropdown.
- **Long settings fold behind 高级设置**; 测试连接, 删除 and the login-or-install line stay outside.
- **A deletion names what it takes with it in the confirmation.**
- **状态 is 未登录 / 未安装 in words**, one at a time, never shown by dimming.

## Agent pages and background work

- **Background work gets no control**: show a chip only once an update is ready or failed;
  nothing while checking or downloading.
- **定期整理是「立即整理」旁的小控件**：点开才设周期；单一菜单只含预设（助手不能关闭），选中即保存，自定义才展开
  数值、单位和时间。
- **工作流里周期 agent 的停用在周期菜单里**：沿用看板级周期 agent 的同一菜单，末尾加「停用」，不设独立按钮。
- **周期菜单只显示下次运行**：按钮只写周期；菜单顶部一行浅色小字「下次运行 21 小时后」（相对时间），无底色，不列上次运行；上次失败只把按钮变警示色。
- **下拉选项各带一行面向用户的说明**：如「适合速度优先于质量」，不出现规划时的内部说法。
- **自建 Agent 只填名称、阶段、指令、运行时**：名称可用中文，内部标识自动生成；指令框就是整份 AGENT.md，
  新增键不加表单字段。
- **复制来的 agent 画成复制后的样子**：沿用来源的运行时和规则原文，标明「复制自 X」，并说明单独保存、
  改动不影响来源。

## Discussions

- **多份方案时「全部规划」「全部开始」是主按钮**：每份方案的工作流、规划、开始弱化成同一行的文字按钮，只要有多份方案就一直显示；不用复选框。

## Test cases

- **两层浏览**：先是模块卡片网格，点进模块是更小的用例卡片网格，再点进用例页。

## Deliveries

- **无上限的重试只说「第几次」**：不写分母；退避等待按运行重试画，说明不占合入位，无需用户操作。

## The Runs office

- **An immersive scene fills the dialog without a header**: history from the left, a selected
  bot's log on the right; role names and harness logos stay visible.
- **Bots share one rear-facing work pose**, with role-specific actions only where a visible
  difference is needed.

## Triage

- **Source groups hold columns of lightweight cards**; Add opens a small anchored composer, and
  dropped files are staged until submit.

## Pricing and numbers

- **定价画具体金额和计费周期**，不留「待定 / 面议」。
- **Usage dashboard shows production data only**: no development data or environment switch.
- **统计时段最短 30 天**；趋势图的点可悬停看当日各线数值。

## Storyboards

- **全片浏览用顶部时间线，不用侧栏索引**：条目放不下时悬停放大，不横向滚动。
