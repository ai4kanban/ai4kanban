# What the user chose for `ui-design`

## Runtimes

- **A runtime is the whole bundle, under a name the user typed**: 运行时 is that bundle, 连接器
  is the CLI, and 模型 survives only as the model-id box inside a runtime. Nothing on screen
  calls the bundle a model.
- **Global default is the first row, not a badge**: it cannot be deleted or renamed, and
  picking it is how a pick is cleared.
- **The harness card grid stayed, inside the row**: an expanded runtime's 连接器 is that same
  grid, both groups, same cards — never a dropdown.
- **The long settings fold away behind 高级设置**, while 测试连接, 删除 and the
  login-or-install line stand outside the fold, with 删除 at the runtime's title.
- **A deletion says what it takes with it**: a cost only counts as said if it is said in the
  confirmation.
- **状态 is 未登录 / 未安装**, one at a time and said in words rather than by dimming.

## The marketing board and its cards

- **One column, no vetting**: a marketing card is never vetted, so 选题 and 周期任务 are the
  whole board.
- **A marketing card's face is id, one mark, title, channels** — no priority, roi, release,
  questions or todo bar.
- **The channel tab strip scrolls sideways and never folds a tab into its mark**: every tab
  keeps its mark, name, dot and cross, and the strip is cut under a fade.
- **A channel page is never an offer to draft it** — the repurpose already drafted it. Only
  `source` still offers 起草.
- **发布 became 标记已发布**, named for what the press does: it records the URL and posts
  nothing.
- **营销稿文案**：保留「记下」的语气，选区入口用「记条意见」；改写状态用「正在按 N 条意见修改」，
  提示用「修改期间暂不可编辑」。

## Deliveries on the card page

- **一个没有上限的重试只说「第几次」**：落地冲突的重开不设上限，所以卡片上不写分母。退避等待那一刻
  按运行重试的样子画——交付块里一条 peach 条，写下还剩多少秒、下一次是第几次、卡在哪个文件上，并说明
  等待期间不占合入位；标题下仍是安静的一行文字，因为没有要用户做的事。

## Agent pages and background work

- **Background work gets no control at all**: the header shows a chip only once an update is
  ready or has failed; while checking or downloading, draw nothing. A failure explains a
  confirmed cause with no download link or retry button.
- **定期整理独占一行太丑**：收成「立即整理」旁的小控件，点击才展开周期设置；周期用含关闭和预设的单一
  菜单，预设选中即保存，自定义才显示数值、单位和可选时间。按在哪里就答在哪里——预设保存失败说在列表脚下。
- **自建 Agent 只填名称、阶段、指令、运行时**：名称支持中文显示名，内部标识自动生成且只在详情的
  文件路径里露面，用户永远不面对 `AGENT.md` 原文。旧声明里已有的用途和交付要求以只读方式引在指令框
  旁，说明它们仍生效、保存不会动到它们、要改就打开上面那个路径——放在框外，改指令就删不掉它们。
- **升级复制来的设置要画成复制后的样子**：运行时直接显示来源 agent 那一个，不再是「全局默认」；规则框里
  是复制来的原文，标题旁跟一个来源 agent 的头像和「复制自 X」，框下那一行说明它单独保存、改它不影响来源。

## Triage

- **Source groups hold columns of lightweight cards**, Add opens a small anchored composer,
  and dropped files are staged until the user submits.

## The Runs office

- **An immersive scene fills the dialog without a header**: history enters from the left, a
  selected bot opens its log on the right, and role names and harness logos stay visible.
- **Bots share one rear-facing work sheet**, with role-specific front-facing actions added
  only where they need a visible difference.

## Pricing

- **定价一律画成具体金额，不留「待定 / 面议」**：档位块直接写出数字和计费周期，占位的价格不算画完这一屏。

## Reading usage

- **Usage dashboard**: show production data only; no development data or environment switch.

## Drawing on top of the app that exists

- **原型直接复制现有组件文件，再按需裁剪**：不照着界面重画。把组件和它依赖的样式一起复制过来，裁掉
  联网和数据读写、用固定数据展示状态，保留原有布局和控件，只设计本次改动的那一部分——同时省下生成
  时间和视觉偏差。裁到要重画的程度，就说明复制的范围选错了。
