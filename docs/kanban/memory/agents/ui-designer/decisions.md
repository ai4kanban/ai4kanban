# What the user chose for `ui-design`

One line per durable choice the user made about these designs.

## Layout

- **布局要平衡**：内容短时把操作放到详情对侧或提示条内，不让一侧空出一大片。
- **后果说明收成名称旁的小标签**：「与 X 共用」这类说明不占整行，细节放悬停提示，腾出的行给操作。
- **悬停才出现的行内操作不预留位置**：平时文字用满整行，悬停时才截断到操作前。
- **下拉选项各带一行面向用户的说明**：如「适合速度优先于质量」，不出现规划时的内部说法。
- **示例问题只作启发**：轮播展示，不做成可点的按钮。
- **Asset 头栏精简**：不显示路径和版本数文字，左右留内边距；文件路径用复制图标，点击复制绝对路径。

## Runtimes

- **A runtime is the whole bundle, under a name the user typed**: 运行时 is the bundle, 连接器 is the CLI, 模型 is only the model id inside it; nothing calls the bundle a model.
- **Global default is the first row, not a badge**: it cannot be deleted or renamed, and picking it clears a pick.
- **连接器 is picked from a grid of harnesses inside the row**, never a dropdown.
- **Long settings fold behind 高级设置**; 测试连接, 删除 and the login-or-install line stay outside.
- **A deletion names what it takes with it in the confirmation.**
- **状态 is 未登录 / 未安装 in words**, one at a time, never shown by dimming.

## Agents and background work

- **Background work gets no control**: show something only once an update is ready or failed; nothing while checking or downloading.
- **定期整理是「立即整理」旁的小控件**：点开才设周期；菜单只含预设，选中即保存，自定义才展开数值、单位和时间。
- **周期菜单是周期 agent 的唯一控件**：按钮只写周期，失败只让按钮显示警示；菜单顶部用相对时间写「下次运行」、不列上次运行，停用放菜单末尾；工作流里沿用看板级的同一菜单。
- **自建 Agent 只填名称、阶段、指令、运行时**：名称可用中文，内部标识自动生成；指令就是整份 AGENT.md，新增键不加表单字段。
- **复制来的 agent 画成复制后的样子**：沿用来源的运行时和规则原文，标明「复制自 X」，并说明单独保存、改动不影响来源。

## Boards and pages

- **官网桌面顶栏只留少数入口**：次要页面收进一个「资源」下拉，长列表（如对比页）和语言切换只放页脚。
- **官网使用场景页不重复下载与 GitHub 按钮**：首屏竖排居中，标题占满一行，主视觉缩小装进水彩画框放在下方。
- **落地页讲流程用小图并排**：每步一张、各配标题和一行说明，不另加步骤条、大图或流程正文；图用 React 照真实界面画进固定框，不塞真实截图；首屏主视觉可用自动播放的录屏。
- **滚动切换的板块**：所有条目常驻、位置不动，只有一个高亮框随滚动丝滑滑过，配图同步切换；板块标题、导语和收尾句随列表一起固定，不留大空白；不做逐张盖上的纵向轮播。
- **两句式英文标题在句号处断成两行**：不让它自动折在句子中间。
- **官网避开发黄的底色**：米黄、土黄这类底色太丑，底和代码框用中性浅灰或白。
- **官网动效克制**：淡入、悬停轻微放大即可；不做滚动后缩高、悬浮胶囊、滚动隐藏顶栏或图标旋转。
- **对比页一眼看出赢家**：每个主题一张卡，两栏各一句结论，赢的一栏靠底色暗示、不写「胜出」；「两者都支持」逐项说双方怎么做；选择建议用两张同结构的「如果你希望」勾选卡，Pro 提示悬停才显示。
- **多份方案时「全部规划」「全部开始」是主操作**：每份方案自己的操作弱化成同一行的文字按钮，不用复选框。
- **测试用例两层浏览**：模块网格 → 用例网格 → 用例页。
- **无上限的重试只说「第几次」**：不写分母；退避等待说明不占合入位，无需用户操作。
- **Triage source groups hold columns of lightweight cards**; Add opens a small composer in place, and dropped files are staged until submit.
- **分镜全片浏览用顶部时间线，不用侧栏索引**：放不下时悬停放大，不横向滚动。
- **看板列靠整条列头区分，列身不加底色**：列头用灰底，只有「待执行」的圆点用绿色；「搁置」用深一档的灰，不给每列各配一种颜色。

## The Runs office

- **An immersive scene fills the dialog without a header**: history on one side, a selected bot's log on the other; role names and harness logos stay visible.
- **Bots share one work pose**, with role-specific actions only where a visible difference is needed.

## Pricing and numbers

- **定价画具体金额和计费周期**，不留「待定 / 面议」。
- **Usage dashboard shows production data only**: no development data or environment switch.
- **统计时段最短 30 天**；趋势图的点可悬停看当日各线数值。
