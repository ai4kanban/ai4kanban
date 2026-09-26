# What the user chose for `ui-design`

One line per durable choice the user made about these designs.

## Drawing on top of the app that exists

- **原型直接复制现有组件文件，再按需裁剪**：不照着界面重画。把组件和它依赖的样式一起复制过来，裁掉
  联网和数据读写、用固定数据展示状态，保留原有布局和控件，只设计本次改动的那一部分。裁到要重画的
  程度，就说明复制的范围选错了。
- **卡片含宣传文案时，只依据已确认的 copywriting 段作画**：文案段缺失、或它的 `[user]` 确认问题还
  没答，这个请求会被看板搁置，不启动。图上的字以确认稿为准，不自己改写。
- **布局要平衡，不留大块空白**：内容短时把操作放到详情对侧或提示条内，不让按钮贴在左侧、右边空出
  一大片。

## Runtimes

- **A runtime is the whole bundle, under a name the user typed**: 运行时 is that bundle, 连接器
  is the CLI, and 模型 survives only as the model-id box inside a runtime. Nothing on screen
  calls the bundle a model.
- **Global default is the first row, not a badge**: it cannot be deleted or renamed, and
  picking it is how a pick is cleared.
- **The harness card grid stayed, inside the row**: an expanded runtime's 连接器 is that same
  grid, both groups, same cards — never a dropdown.
- **The long settings fold away behind 高级设置**, while 测试连接, 删除 and the
  login-or-install line stand outside the fold.
- **A deletion says what it takes with it**: a cost only counts as said if it is said in the
  confirmation.
- **状态 is 未登录 / 未安装**, one at a time and said in words rather than by dimming.

## Agent pages and background work

- **Background work gets no control at all**: the header shows a chip only once an update is
  ready or has failed; while checking or downloading, draw nothing.
- **定期整理独占一行太丑**：收成「立即整理」旁的小控件，点击才展开周期设置；周期用含关闭和预设的单一
  菜单，预设选中即保存，自定义才显示数值、单位和可选时间。按在哪里就答在哪里。
- **「与 X 共用，修改同步生效」这类整行说明太占地方**：收成名称旁的「共用 · X」小标签，后果放进它的
  悬停提示；腾出的行让操作按钮并进名称行。
- **自建 Agent 只填名称、阶段、指令、运行时**：名称支持中文显示名，内部标识自动生成。指令框就是它
  整份 `AGENT.md`（frontmatter 在内），所以往里加一个键不需要新表单字段。
- **复制来的 agent 要画成复制后的样子**：运行时直接显示来源 agent 那一个；规则框里是复制来的原文，
  标题旁跟一个来源 agent 的头像和「复制自 X」，框下一行说明它单独保存、改它不影响来源。

## Deliveries on the card page

- **一个没有上限的重试只说「第几次」**：落地冲突的重开不设上限，所以卡片上不写分母。退避等待那一刻
  按运行重试的样子画，并说明等待期间不占合入位；标题下仍是安静的一行文字，因为没有要用户做的事。

## The Runs office

- **An immersive scene fills the dialog without a header**: history enters from the left, a
  selected bot opens its log on the right, and role names and harness logos stay visible.
- **Bots share one rear-facing work sheet**, with role-specific front-facing actions added
  only where they need a visible difference.

## Triage

- **Source groups hold columns of lightweight cards**, Add opens a small anchored composer,
  and dropped files are staged until the user submits.

## Pricing and numbers

- **定价一律画成具体金额，不留「待定 / 面议」**：档位块直接写出数字和计费周期，占位的价格不算画完
  这一屏。
- **Usage dashboard**: show production data only; no development data or environment switch.

## Storyboards

- **全片浏览用顶部时间线，不用侧栏索引**：条目多到一行放不下时，用悬停平滑放大代替横向滚动。
